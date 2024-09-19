// app.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const { body, param, validationResult } = require('express-validator');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const twilio = require('twilio');
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const client = require('./twilioClient');
const {
  getConversationByPhoneNumber,
  createConversation,
  updateConversationAttributes,
  addParticipant,
  addMessage,
  fetchConversation,
  listConversations,
  deleteConversation,
  listMessages,
  markMessagesAsRead,
} = require('./modules/conversations');

const setupWebSocket = require('./modules/websocket');

// Create an Express application
const app = express();
const server = http.createServer(app);
const { broadcast } = setupWebSocket(server);

// Middleware to set CORS headers
app.use(cors());
app.options('*', cors());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Allow client.js to access environment variables
app.get('/config', (req, res) => {
  res.json({
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    NGROK_URL: process.env.NGROK_URL,
  });
});

// Fetch call parameters for initiating a call
app.get('/call-params/:sid', async (req, res) => {
  const { sid } = req.params;
  console.log(`Call parameters requested for conversation SID: ${sid}`);

  try {
    // Fetch conversation participants
    const participants = await client.conversations.v1.conversations(sid).participants.list();

    // Find the participant who is not the Twilio phone number
    const participant = participants.find(
      (p) => p.messagingBinding.address !== process.env.TWILIO_PHONE_NUMBER
    );

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found in the conversation.' });
    }

    const toNumber = participant.messagingBinding.address;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    res.json({ To: toNumber, From: fromNumber });
  } catch (err) {
    console.error('Error fetching call parameters:', err);
    res.status(500).json({ error: 'Failed to fetch call parameters', details: err.message });
  }
});

// Generate Twilio Access Token
app.get('/token', (req, res) => {
  console.log('Token request received');
  try {
    const requiredEnvVars = [
      'TWILIO_ACCOUNT_SID',
      'TWILIO_API_KEY',
      'TWILIO_API_SECRET',
      'TWILIO_TWIML_APP_SID',
    ];

    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Generate a unique identity for this token
    const identity = 'browser-user-' + crypto.randomBytes(6).toString('hex');

    console.log('Creating AccessToken...');
    const accessToken = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity: identity }
    );
    console.log('AccessToken created for identity:', identity);

    console.log('Creating VoiceGrant...');
    const grant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: true,
    });
    console.log(
      'VoiceGrant created with outgoingApplicationSid:',
      process.env.TWILIO_TWIML_APP_SID
    );

    accessToken.addGrant(grant);
    console.log('Grant added to AccessToken');

    const token = accessToken.toJwt();
    console.log('JWT token generated successfully');

    // Log the first and last 10 characters of the token for debugging
    console.log('Token preview:', `${token.substr(0, 10)}...${token.substr(-10)}`);

    res.json({ token: token, identity: identity });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({
      error: 'Failed to generate token',
      details: error.message,
    });
  }
});

// Voice endpoint to handle call requests
app.post('/voice', (req, res) => {
  console.log('Received request from Twilio:', req.body); // Log the incoming request body

  const { To } = req.body; // Extract the "To" parameter

  if (!To) {
    console.error('Missing "To" phone number.');
    return res.status(400).send('Missing "To" phone number.');
  }

  const twiml = new twilio.twiml.VoiceResponse();

  // Generate TwiML to dial the specified number
  twiml.dial(
    {
      callerId: process.env.TWILIO_PHONE_NUMBER,
    },
    To
  );

  // Log the TwiML response
  console.log('Generated TwiML:', twiml.toString());

  res.type('text/xml');
  res.send(twiml.toString());
});

app.post('/twilio-webhook', bodyParser.urlencoded({ extended: false }), async (req, res) => {
  console.log('Webhook received at:', new Date().toISOString());
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  const eventType = req.body.EventType;
  const conversationSid = req.body.ConversationSid;

  if (eventType && conversationSid) {
    console.log(`Received webhook: ${eventType} for conversation ${conversationSid}`);

    if (eventType === 'onMessageAdded') {
      // Handle conversation message added events
      const messageSid = req.body.MessageSid;
      const messageBody = req.body.Body;
      const author = req.body.Author;
      const dateCreated = req.body.DateCreated;

      console.log(`New message in conversation ${conversationSid}:`);
      console.log(`  Message SID: ${messageSid}`);
      console.log(`  Author: ${author}`);
      console.log(`  Body: ${messageBody}`);

      try {
        // Fetch conversation details
        const conversation = await fetchConversation(conversationSid);

        // Broadcast the updated conversation to all connected clients via WebSocket
        broadcast({
          type: 'updateConversation',
          conversationSid: conversation.sid,
          friendlyName: conversation.friendlyName,
          lastMessage: messageBody,
          lastMessageTime: dateCreated,
          attributes: JSON.parse(conversation.attributes || '{}'),
        });
        console.log('Broadcasted updateConversation event');

        // Broadcast the newMessage event to all connected clients via WebSocket
        broadcast({
          type: 'newMessage',
          conversationSid: conversation.sid,
          author: author,
          body: messageBody,
          dateCreated: dateCreated,
        });
        console.log('Broadcasted newMessage event');
      } catch (error) {
        console.error('Error fetching conversation details:', error);
      }
    } else {
      console.log(`Received unexpected event type: ${eventType}`);
    }
  } else if (req.body.SmsMessageSid) {
    // Handle incoming SMS messages
    console.log('Received incoming SMS message');
    const messageSid = req.body.SmsMessageSid;
    const messageBody = req.body.Body;
    const from = req.body.From;

    // Log the SMS message
    console.log(`SMS from ${from}: ${messageBody}`);

    // Optionally, you can add code here to create a new conversation or forward the message
  } else {
    console.log('Received unknown webhook format');
  }

  // Twilio requires a valid response, even if empty
  res.status(200).send('<Response></Response>');
});


// Endpoint to list all conversations
app.get('/conversations', async (req, res) => {
  res.set('Cache-Control', 'no-store');

  try {
    const conversations = await listConversations();

    const conversationSummaries = await Promise.all(
      conversations.map(async (conversation) => {
        // Fetch the latest message
        const messages = await listMessages(conversation.sid, { limit: 1, order: 'desc' });
        const lastMessage = messages.length > 0 ? messages[0] : null;

        // Calculate unread count (fetch messages in ascending order)
        const allMessages = await listMessages(conversation.sid);
        const unreadCount = allMessages.filter(
          (message) =>
            !JSON.parse(message.attributes || '{}').read &&
            message.author !== process.env.TWILIO_PHONE_NUMBER
        ).length;

        return {
          sid: conversation.sid,
          friendlyName: conversation.friendlyName,
          lastMessage: lastMessage ? lastMessage.body : 'No messages yet',
          lastMessageTime: lastMessage ? lastMessage.dateCreated : null,
          unreadCount: unreadCount,
        };
      })
    );

    res.json(conversationSummaries);
  } catch (err) {
    console.error('Error fetching conversations:', err.stack);
    res.status(500).json({ error: 'Failed to fetch conversations', details: err.message });
  }
});

// Delete a conversation
app.delete(
  '/conversations/:sid',
  [param('sid').isString().withMessage('Conversation SID must be a string')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sid } = req.params;
    const { confirmToken } = req.body;

    // Improved confirmation process for better user experience
    if (!confirmToken || confirmToken !== 'CONFIRM_DELETE') {
      return res.status(400).json({
        error:
          'Invalid or missing confirmation token. Action not allowed. Please type "CONFIRM_DELETE" to confirm.',
      });
    }

    try {
      await deleteConversation(sid);

      console.log(`Conversation ${sid} deleted successfully.`);
      res.json({ message: `Conversation ${sid} deleted successfully.` });
    } catch (err) {
      console.error(`Error deleting conversation ${sid}:`, err.stack);

      // Specific error handling for Twilio-related issues
      if (err.code === 20404) {
        res.status(404).json({
          error: `Conversation ${sid} not found. It may have already been deleted.`,
          details: err.message,
        });
      } else {
        res.status(500).json({
          error: `Failed to delete conversation ${sid}`,
          details: err.message,
        });
      }
    }
  }
);

// Add a message to a conversation
app.post(
  '/conversations/:sid/messages',
  [
    param('sid').isString().withMessage('Conversation SID must be a string'),
    body('message').isString().trim().isLength({ min: 1 }).withMessage('Message content cannot be empty'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { sid } = req.params;
      const { message } = req.body;

      console.log(`Attempting to send message to conversation SID: ${sid}`);
      console.log(`Message content: "${message}"`);

      const author = process.env.TWILIO_PHONE_NUMBER;

      // Add a new message to the specified conversation
      const sentMessage = await addMessage(sid, message, author);

      console.log(`Message sent with SID: ${sentMessage.sid}`);

      // Broadcast the new message to all connected WebSocket clients
      broadcast({
        type: 'newMessage',
        conversationSid: sid,
        messageSid: sentMessage.sid,
        author: author,
        body: message,
      });

      res.json({ message: 'Message sent', sid: sentMessage.sid });
    } catch (err) {
      console.error(`Error adding message to conversation ${req.params.sid}:`, err.stack);

      if (err.code === 20404) {
        res.status(404).json({
          error: `Conversation ${req.params.sid} not found.`,
          details: err.message,
        });
      } else {
        res.status(500).json({
          error: `Failed to send message to conversation ${req.params.sid}`,
          details: err.message,
        });
      }
    }
  }
);

// Fetch messages from a conversation
app.get(
  '/conversations/:sid/messages',
  [param('sid').isString().withMessage('Conversation SID must be a string')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { sid } = req.params;

      // Fetch all messages from the specified conversation
      const messages = await listMessages(sid);

      res.json(messages);
    } catch (err) {
      console.error(`Error fetching messages for conversation ${req.params.sid}:`, err.stack);

      // Specific error handling for Twilio-related issues
      if (err.code === 20404) {
        res.status(404).json({
          error: `Conversation ${req.params.sid} not found.`,
          details: err.message,
        });
      } else {
        res.status(500).json({
          error: `Failed to fetch messages for conversation ${req.params.sid}`,
          details: err.message,
        });
      }
    }
  }
);

// Start a new conversation (updated to include name and email)
app.post(
  '/start-conversation',
  [
    body('phoneNumber').matches(/^\+\d{10,15}$/).withMessage('Invalid phone number format'),
    body('message').isString().trim().isLength({ min: 1 }).withMessage('Message content cannot be empty'),
    body('name').optional().isString().trim(),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('dob').optional().isString().withMessage('Invalid date format'),
    body('state').optional().isString().trim().withMessage('Invalid state'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { phoneNumber, message, name, email, dob, state } = req.body;

      // Check if the request is coming from Zapier
      const isZapierRequest =
        req.headers['user-agent'] && req.headers['user-agent'].includes('Zapier');

      console.log(
        `Attempting to start a conversation with Phone: ${phoneNumber}, Name: ${name}, Email: ${email}, DOB: ${dob}, State: ${state}, Zapier: ${isZapierRequest}`
      );

      // Additional metadata for attributes
      const attributes = {
        email: email,
        name: name,
        phoneNumber: phoneNumber,
        dob: dob,
        state: state,
      };

      // Check for existing conversation
      let existingConversation = await getConversationByPhoneNumber(phoneNumber);

      if (existingConversation) {
        console.log(`Existing conversation found with SID: ${existingConversation.sid}`);
      
        // Update existing conversation attributes
        await updateConversationAttributes(existingConversation.sid, attributes);
        console.log(`Updated attributes for conversation: ${existingConversation.sid}`);
      
        // Only add a new message if the request is from Zapier
        if (isZapierRequest) {
          const newMessage = await addMessage(
            existingConversation.sid,
            message,
            process.env.TWILIO_PHONE_NUMBER
          );
          console.log(`New message added to existing conversation: ${message}`);
      
          // Broadcast the updated conversation to all connected clients via WebSocket
          broadcast({
            type: 'updateConversation',
            conversationSid: existingConversation.sid,
            friendlyName: name || `Conversation with ${phoneNumber}`,
            lastMessage: message,
            lastMessageTime: newMessage.dateCreated,
            attributes: attributes,
          });
        } else {
          // If not from Zapier, just update the conversation attributes
          broadcast({
            type: 'updateConversation',
            conversationSid: existingConversation.sid,
            friendlyName: name || `Conversation with ${phoneNumber}`,
            attributes: attributes,
          });
        }
      
        res.json({ sid: existingConversation.sid, existing: true });
      } else {
        // Create a new conversation
        const friendlyName = name || `Conversation with ${phoneNumber}`;
        const conversation = await createConversation(friendlyName, attributes);

        console.log(
          `New conversation created with SID: ${conversation.sid} and Friendly Name: ${conversation.friendlyName}`
        );

        // Add participant to the conversation
        await addParticipant(conversation.sid, phoneNumber);

        // Send the initial message with a disclaimer
        const firstMessage = `${message} (Note: you may reply STOP to no longer receive messages from us. Msg&Data Rates may apply.)`;
        const newMessage = await addMessage(conversation.sid, firstMessage, process.env.TWILIO_PHONE_NUMBER);

        // Broadcast the new conversation to all connected clients via WebSocket
        broadcast({
          type: 'newConversation',
          conversationSid: conversation.sid,
          friendlyName: conversation.friendlyName,
          lastMessage: firstMessage,
          lastMessageTime: newMessage.dateCreated,
          attributes: attributes,
        });

        res.json({ sid: conversation.sid, existing: false });
      }
    } catch (err) {
      console.error('Error starting a new conversation:', err.stack);
      res.status(500).json({
        error: 'Failed to start a new conversation',
        details: err.message,
      });
    }
  }
);

// Fetch conversation details (including attributes)
app.get('/conversations/:sid', async (req, res) => {
  try {
    const { sid } = req.params;

    const conversation = await fetchConversation(sid);
    const attributes = JSON.parse(conversation.attributes || '{}');

    // Fetch messages to count unread
    const messages = await listMessages(sid);

    const unreadCount = messages.filter(
      (message) =>
        !JSON.parse(message.attributes || '{}').read &&
        message.author !== process.env.TWILIO_PHONE_NUMBER
    ).length;

    res.json({
      sid: conversation.sid,
      friendlyName: conversation.friendlyName,
      attributes: attributes,
      unreadCount: unreadCount,
    });
  } catch (err) {
    console.error(`Error fetching conversation ${req.params.sid}:`, err);

    if (err.code === 20404) {
      res.status(404).json({
        error: `Conversation ${req.params.sid} not found.`,
        details: err.message,
      });
    } else {
      res.status(500).json({
        error: `Failed to fetch conversation ${req.params.sid}`,
        details: err.message,
      });
    }
  }
});

// Endpoint to mark messages as read
app.post('/conversations/:sid/mark-read', async (req, res) => {
  try {
    const { sid } = req.params;

    await markMessagesAsRead(sid);

    res.json({ success: true });
  } catch (err) {
    console.error(`Error marking messages as read in conversation ${req.params.sid}:`, err);
    res.status(500).json({
      error: `Failed to mark messages as read in conversation ${req.params.sid}`,
      details: err.message,
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`ngrok URL: ${process.env.NGROK_URL}`);
});