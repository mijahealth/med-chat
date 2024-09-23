require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');

// Import Modules
const setupWebSocket = require('./modules/websocket');
const smsServiceFactory = require('./modules/smsService');
const videoModule = require('./modules/video');
const conversations = require('./modules/conversations');
const searchModule = require('./modules/search');

// Import Routes
const conversationsRouter = require('./routes/conversations');
const searchRouter = require('./routes/search');
const startConversationRouter = require('./routes/startConversation');
const callParamsRouter = require('./routes/callParams'); // Add this line

// Import Broadcast Singleton
const broadcastModule = require('./modules/broadcast');

// Initialize Express App
const app = express();
const server = http.createServer(app);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS Middleware
app.use(cors());

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Body Parser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logger
const logger = require('./modules/logger');

// Initialize WebSocket
const { broadcast } = setupWebSocket(server);
broadcastModule.setBroadcast(broadcast); // Set the broadcast function in the singleton

// Initialize SMS Service
const smsService = smsServiceFactory(broadcast);
const { sendSMS } = smsService;

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
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const VideoGrant = AccessToken.VideoGrant;

app.get('/token', async (req, res, next) => {
  try {
    logger.info('Token request received', { query: req.query });

    const { identity } = req.query;
    if (!identity || !identity.trim()) {
      logger.warn('Missing identity in token request');
      return res.status(400).json({
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
      return res.status(400).send('Missing "To" phone number.');
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

// Video Room Creation Endpoint
app.post('/create-room', async (req, res, next) => {
  try {
    const { customerPhoneNumber, conversationSid } = req.body;

    // Validate Phone Number
    if (!customerPhoneNumber || !/^\+[1-9]\d{1,14}$/.test(customerPhoneNumber)) {
      logger.warn('Invalid customer phone number', { customerPhoneNumber });
      return res.status(400).json({ error: 'Invalid customer phone number' });
    }

    // Create Video Room
    const room = await videoModule.createVideoRoom();
    const roomLink = `${process.env.NGROK_URL}/video-room/${room.sid}`;

    // Send SMS via Centralized Function
    await sendSMS(
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
app.post('/twilio-webhook', bodyParser.urlencoded({ extended: false }), async (req, res, next) => {
  try {
    const { EventType, ConversationSid, MessageSid, Body, Author, DateCreated, SmsMessageSid, From } = req.body;

    if (EventType && ConversationSid) {
      logger.info('Webhook event received', { EventType, ConversationSid });

      if (EventType === 'onMessageAdded') {
        // Handle Message Added
        const conversation = await conversations.fetchConversation(ConversationSid);
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
    } else if (SmsMessageSid) {
      // Handle Incoming SMS
      logger.info('Incoming SMS received', { SmsMessageSid, From, Body });
      // Additional processing can be handled here if needed
    } else {
      logger.warn('Unknown webhook format received', { reqBody: req.body });
    }

    res.status(200).send('<Response></Response>');
  } catch (error) {
    logger.error('Error processing webhook', { error });
    next(error);
  }
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled Error', { error: err });
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Start the Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, { ngrokUrl: process.env.NGROK_URL });
});