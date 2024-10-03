// app.js

// Load environment variables based on NODE_ENV
if (process.env.NODE_ENV === 'test') {
  require('dotenv').config({ path: '.env.test' });
} else {
  require('dotenv').config();
}

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
// Remove webpack requires from the top
// const webpack = require('webpack');
// const webpackDevMiddleware = require('webpack-dev-middleware');
// const webpackHotMiddleware = require('webpack-hot-middleware');
// const config = require('./webpack.config.js');

// Import Modules
const setupWebSocket = require('./modules/websocket');
const smsServiceFactory = require('./modules/smsService');
const videoModule = require('./modules/video');
const conversations = require('./modules/conversations');
// const searchModule = require('./modules/search');

// Import Routes
const conversationsRouter = require('./routes/conversations');
const searchRouter = require('./routes/search');
const startConversationRouter = require('./routes/startConversation');
const callParamsRouter = require('./routes/callParams');

// Import Broadcast Singleton
const broadcastModule = require('./modules/broadcast');

// Constants
const MILLISECONDS_IN_SECOND = 1000;
const SECONDS_IN_MINUTE = 60;
const HEARTBEAT_INTERVAL_MS = 10 * MILLISECONDS_IN_SECOND; // 10 seconds
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_MINUTES * SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const DEFAULT_PORT = 3000;

// Initialize Express App
const app = express();
const server = http.createServer(app);

// Conditionally require webpack and related middleware
if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV === 'development') {
  const webpack = require('webpack');
  const webpackDevMiddleware = require('webpack-dev-middleware');
  const webpackHotMiddleware = require('webpack-hot-middleware');
  const config = require('./webpack.config.js'); // Ensure webpack.config.js is correctly configured

  const compiler = webpack(config);
  app.use(
    webpackDevMiddleware(compiler, {
      publicPath: config.output.publicPath,
      stats: { colors: true },
    })
  );
  app.use(
    webpackHotMiddleware(compiler, {
      log: console.log,
      path: '/__webpack_hmr',
      heartbeat: HEARTBEAT_INTERVAL_MS,
    })
  );
}

// Rate Limiting
const isTestEnv = process.env.NODE_ENV === 'test';
const shouldApplyRateLimiting = !isTestEnv || process.env.TEST_RATE_LIMITING === 'true';

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS, // configurable window
  max: RATE_LIMIT_MAX_REQUESTS, // configurable max requests
  standardHeaders: true,
  legacyHeaders: false,
});
if (shouldApplyRateLimiting) {
  app.use(limiter);
}

// CORS Middleware
app.use(cors());

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Body Parser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logger
const logger = require('./modules/logger');

// Initialize SMS Service
let sendSMS = () => {
  console.warn('SMS service not initialized');
};

// Initialize WebSocket and Other Asynchronous Operations Only If Not in Test Environment
if (process.env.NODE_ENV !== 'test') {
  // Initialize WebSocket
  const { broadcast } = setupWebSocket(server);
  broadcastModule.setBroadcast(broadcast); // Set the broadcast function in the singleton

  // Initialize SMS Service
  const smsService = smsServiceFactory(broadcastModule.getBroadcast());
  ({ sendSMS } = smsService);
}

// Routes
app.use('/conversations', conversationsRouter);
app.use('/search', searchRouter);
app.use('/start-conversation', startConversationRouter);
app.use('/call-params', callParamsRouter);

// Configuration Endpoint
app.get('/config', (req, res) => {
  res.json({
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    NGROK_URL: process.env.NGROK_URL,
  });
});

// Token Generation Endpoint
const twilio = require('twilio');
const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;
const { VideoGrant } = AccessToken;

app.get('/token', async (req, res, next) => {
  try {
    logger.info('Token request received', { query: req.query });

    const { identity } = req.query;
    if (!identity || !identity.trim()) {
      logger.warn('Missing identity in token request');
      return res.status(HTTP_BAD_REQUEST).json({
        error: 'Identity is required and must not be empty',
      });
    }

    const accessToken = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: true,
    });

    const videoGrant = new VideoGrant();

    accessToken.addGrant(voiceGrant);
    accessToken.addGrant(videoGrant);

    const token = accessToken.toJwt();

    res.json({ token, identity });
  } catch (error) {
    logger.error('Error generating token', { error });
    next(error);
  }
});

// Voice Endpoint
app.post('/voice', async (req, res, next) => {
  try {
    const { To } = req.body;
    if (!To) {
      logger.warn('Missing "To" phone number in voice request');
      return res.status(HTTP_BAD_REQUEST).send('Missing "To" phone number.');
    }

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.dial({ callerId: process.env.TWILIO_PHONE_NUMBER }, To);

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    logger.error('Error handling voice request', { error });
    next(error);
  }
});

// SMS Service setup
let smsService;
if (process.env.NODE_ENV === 'test') {
  smsService = { sendSMS: () => Promise.resolve({ messageSid: 'SM123', success: true }) };
} else {
  const smsServiceFactory = require('./modules/smsService');
  smsService = smsServiceFactory(broadcastModule.getBroadcast());
}

const setSmsService = (service) => {
  smsService = service;
};

// Video Room Creation Endpoint
app.post('/create-room', async (req, res, next) => {
  try {
    const { customerPhoneNumber, conversationSid } = req.body;

    // Validate Phone Number
    if (
      !customerPhoneNumber ||
      !/^\+[1-9]\d{1,14}$/.test(customerPhoneNumber)
    ) {
      logger.warn('Invalid customer phone number', { customerPhoneNumber });
      return res.status(HTTP_BAD_REQUEST).json({ error: 'Invalid customer phone number' });
    }

    // Create Video Room
    const room = await videoModule.createVideoRoom();
    const roomLink = `${process.env.NGROK_URL}/video-room/${room.sid}`;

    // Send SMS
    await smsService.sendSMS(
      customerPhoneNumber,
      `Join the video call here: ${roomLink}`,
      conversationSid,
      process.env.TWILIO_PHONE_NUMBER
    );

    res.json({ link: roomLink, roomName: room.sid });
  } catch (error) {
    logger.error('Error creating video room or sending SMS', { error });
    next(error);
  }
});

// Serve Video Room HTML
app.get('/video-room/:roomName', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'video-room.html'));
});

// Twilio Webhook Endpoint
app.post(
  '/twilio-webhook',
  bodyParser.urlencoded({ extended: false }),
  async (req, res, next) => {
    try {
      const {
        EventType,
        ConversationSid,
        Body,
        Author,
        DateCreated,
        SmsMessageSid,
        From,
      } = req.body;

      if (EventType && ConversationSid) {
        logger.info('Webhook event received', { EventType, ConversationSid });

        if (EventType === 'onMessageAdded') {
          const conversation = await conversations.fetchConversation(ConversationSid);
          const broadcast = broadcastModule.getBroadcast();

          if (broadcast) {
            broadcast({
              type: 'updateConversation',
              conversationSid: conversation.sid,
              friendlyName: conversation.friendlyName,
              lastMessage: Body,
              lastMessageTime: DateCreated,
              attributes: JSON.parse(conversation.attributes || '{}'),
            });

            broadcast({
              type: 'newMessage',
              conversationSid: conversation.sid,
              author: Author,
              body: Body,
              dateCreated: DateCreated,
            });
          }
        }
      } else if (SmsMessageSid) {
        // Handle Incoming SMS
        logger.info('Incoming SMS received', { SmsMessageSid, From, Body });
        // Additional processing can be handled here if needed
      } else {
        logger.warn('Unknown webhook format received', { reqBody: req.body });
      }

      res.status(HTTP_OK).send('<Response></Response>');
    } catch (error) {
      logger.error('Error processing webhook', { error });
      next(error);
    }
  }
);

// Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled Error', {
    message: err.message,
    stack: err.stack,
    ...err,
  });
  res
    .status(HTTP_INTERNAL_SERVER_ERROR)
    .json({ error: 'Internal Server Error', details: err.message });
  next(err);
});

// Start the Server Only If Not in Test Environment and If App.js is Run Directly
  if (process.env.NODE_ENV !== 'test' && require.main === module) {
    const PORT = process.env.PORT || DEFAULT_PORT;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        ngrokUrl: process.env.NGROK_URL,
      });
    });
  }

// Export the Express app for testing
module.exports = app;
module.exports.setSmsService = setSmsService;