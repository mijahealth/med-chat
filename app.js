// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const AccessToken = require('twilio').jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const path = require('path');
const NGROK_URL = 'https://7229-47-154-125-116.ngrok-free.app';
const crypto = require('crypto');

// Create an Express application
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


// Middleware to set CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, ngrok-skip-browser-warning');
  next();
});

// Serve static files from the "public" directory
console.log('Setting up static file serving...');
app.use(express.static(path.join(__dirname, 'public')));
console.log('Static file serving set up');

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Allow client.js to process.env variables
app.get('/config', (req, res) => {
  res.json({
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER
  });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    console.log('Received message:', message);
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

app.get('/token', (req, res) => {
  console.log('Token request received');
  try {
    const requiredEnvVars = [
      'TWILIO_ACCOUNT_SID',
      'TWILIO_API_KEY',
      'TWILIO_API_SECRET',
      'TWILIO_TWIML_APP_SID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

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
      incomingAllow: true
    });
    console.log('VoiceGrant created with outgoingApplicationSid:', process.env.TWILIO_TWIML_APP_SID);

    accessToken.addGrant(grant);
    console.log('Grant added to AccessToken');

    const token = accessToken.toJwt();
    console.log('JWT token generated successfully');

    // Log the first and last 10 characters of the token for debugging
    console.log('Token preview:', `${token.substr(0, 10)}...${token.substr(-10)}`);

    res.json({ token: token, identity: identity });
  } catch (error) {
    console.error('Error generating token:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate token', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.get('/call-params/:sid', async (req, res) => {
  const { sid } = req.params;
  console.log(`Call parameters requested for conversation SID: ${sid}`);

  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      throw new Error('Missing required environment variables for Twilio client');
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    console.log('Fetching participants for the conversation...');
    const participants = await client.conversations.v1.conversations(sid).participants.list();
    console.log(`Found ${participants.length} participants in the conversation`);

    const userParticipant = participants.find(p => p.messagingBinding && p.messagingBinding.type === 'sms');

    if (!userParticipant) {
      console.log('No SMS participant found in the conversation');
      return res.status(400).json({ error: 'No SMS participant found in this conversation' });
    }

    const userPhoneNumber = userParticipant.messagingBinding.address;
    console.log(`User phone number found: ${userPhoneNumber}`);

    const callParams = {
      To: userPhoneNumber,
      From: process.env.TWILIO_PHONE_NUMBER
    };

    console.log('Call parameters prepared:', callParams);
    res.json(callParams);
  } catch (err) {
    console.error('Error fetching call parameters:', err);
    res.status(500).json({ error: 'Failed to fetch call parameters', details: err.message });
  }
});

app.post('/voice', (req, res) => {
  console.log('Received request from Twilio:', req.body);  // Log the incoming request body

  const { To } = req.body;  // Extract the "To" parameter

  if (!To) {
    console.error('Missing "To" phone number.');
    return res.status(400).send('Missing "To" phone number.');
  }

  const twiml = new twilio.twiml.VoiceResponse();

  // Generate TwiML to dial the specified number
  twiml.dial({
    callerId: process.env.TWILIO_PHONE_NUMBER
  }, To);

  // Log the TwiML response
  console.log('Generated TwiML:', twiml.toString());

  res.type('text/xml');
  res.send(twiml.toString());
});


// Webhook route
app.post('/twilio-webhook', (req, res) => {
  console.log('Webhook received at:', new Date().toISOString());
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  const eventType = req.body.EventType;
  const conversationSid = req.body.ConversationSid;

  console.log(`Received webhook: ${eventType} for conversation ${conversationSid}`);

  if (eventType === 'onMessageAdded') {
    const messageSid = req.body.MessageSid;
    const messageBody = req.body.Body;
    const author = req.body.Author;
    console.log(`New message in conversation ${conversationSid}:`);
    console.log(`  Message SID: ${messageSid}`);
    console.log(`  Author: ${author}`);
    console.log(`  Body: ${messageBody}`);
    
    // Determine if a response is needed (message from the user's phone)
    const needsResponse = author === process.env.USER_PHONE_NUMBER;

    // Broadcast the new message to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'newMessage',
          conversationSid,
          messageSid,
          author,
          body: messageBody,
          needsResponse
        }));
      }
    });
  } else {
    console.log(`Received unexpected event type: ${eventType}`);
  }

  // Twilio response to stop the default auto-response
  const twiml = new twilio.twiml.MessagingResponse();
  res.type('text/xml').send(twiml.toString());  // This acts as a 200 OK response to Twilio.
});

// Endpoint to list all conversations
app.get('/conversations', async (req, res) => {
  // Disable caching of conversation data
  res.set('Cache-Control', 'no-store');  

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const conversations = await client.conversations.v1.conversations.list();

    const conversationSummaries = await Promise.all(conversations.map(async conversation => {
      const messages = await client.conversations.v1.conversations(conversation.sid).messages.list({ limit: 1 });
      const lastMessage = messages.length > 0 ? messages[0] : null;
      return {
        sid: conversation.sid,
        friendlyName: conversation.friendlyName,
        lastMessage: lastMessage ? lastMessage.body : 'No messages yet',
        lastMessageTime: lastMessage ? lastMessage.dateCreated : null
      };
    }));

    res.json(conversationSummaries);
  } catch (err) {
    console.error('Error fetching conversations:', err.stack);
    res.status(500).json({ error: 'Failed to fetch conversations', details: err.message });
  }
});

// Enhanced Error Handling and Refactored Confirmation for Deleting a Conversation
app.delete('/conversations/:sid', [
  param('sid').isString().withMessage('Conversation SID must be a string')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { sid } = req.params;
  const { confirmToken } = req.body;

  // Improved confirmation process for better user experience
  if (!confirmToken || confirmToken !== 'CONFIRM_DELETE') {
    return res.status(400).json({ error: 'Invalid or missing confirmation token. Action not allowed. Please type "CONFIRM_DELETE" to confirm.' });
  }

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.conversations.v1.conversations(sid).remove();

    console.log(`Conversation ${sid} deleted successfully.`);  
    res.json({ message: `Conversation ${sid} deleted successfully.` });
  } catch (err) {
    console.error(`Error deleting conversation ${sid}:`, err.stack);

    // Specific error handling for Twilio-related issues
    if (err.code === 20404) {
      res.status(404).json({ error: `Conversation ${sid} not found. It may have already been deleted.`, details: err.message });
    } else {
      res.status(500).json({ error: `Failed to delete conversation ${sid}`, details: err.message });
    }
  }
});

// Enhanced Error Handling for Adding a Message to a Conversation
app.post('/conversations/:sid/messages', [
  param('sid').isString().withMessage('Conversation SID must be a string'),
  body('message').isString().trim().isLength({ min: 1 }).withMessage('Message content cannot be empty')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const { sid } = req.params;
    const { message } = req.body;

    console.log(`Attempting to send message to conversation SID: ${sid}`);
    console.log(`Message content: "${message}"`);

    const author = process.env.TWILIO_PHONE_NUMBER;

    // Add a new message to the specified conversation
    const sentMessage = await client.conversations.v1.conversations(sid)
      .messages
      .create({ 
        body: message, 
        author: author 
      });

    console.log(`Message sent with SID: ${sentMessage.sid}`);

    // Broadcast the new message to all connected WebSocket clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'newMessage',
          conversationSid: sid,
          messageSid: sentMessage.sid,
          author: author,
          body: message,
          needsResponse: false
        }));
      }
    });

    res.json({ message: 'Message sent', sid: sentMessage.sid });
  } catch (err) {
    console.error(`Error adding message to conversation ${req.params.sid}:`, err.stack);
    
    if (err.code === 20404) {
      res.status(404).json({ error: `Conversation ${req.params.sid} not found.`, details: err.message });
    } else {
      res.status(500).json({ error: `Failed to send message to conversation ${req.params.sid}`, details: err.message });
    }
  }
});

// Enhanced Error Handling for Fetching Messages from a Specific Conversation
app.get('/conversations/:sid/messages', [
  param('sid').isString().withMessage('Conversation SID must be a string')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const { sid } = req.params;

    // Fetch all messages from the specified conversation
    const messages = await client.conversations.v1.conversations(sid)
      .messages
      .list();

    res.json(messages);
  } catch (err) {
    console.error(`Error fetching messages for conversation ${req.params.sid}:`, err.stack);
    
    // Specific error handling for Twilio-related issues
    if (err.code === 20404) {
      res.status(404).json({ error: `Conversation ${req.params.sid} not found.`, details: err.message });
    } else {
      res.status(500).json({ error: `Failed to fetch messages for conversation ${req.params.sid}`, details: err.message });
    }
  }
});

app.post('/start-conversation', [
  body('phoneNumber').matches(/^\+\d{10,15}$/).withMessage('Invalid phone number format'),
  body('message').isString().trim().isLength({ min: 1 }).withMessage('Message content cannot be empty'),
  body('name').optional().isString().trim(), // Validate name as an optional string
  body('email').optional().isEmail().withMessage('Invalid email format') // Validate email as an optional field
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const { phoneNumber, message, name, email } = req.body;

    console.log(`Attempting to start a conversation with Phone: ${phoneNumber}, Name: ${name}, Email: ${email}`);

    // Additional metadata for attributes
    const attributes = JSON.stringify({
      email: email,
      name: name // Include name in attributes for data management
    });

    // Modified existing conversation check to include 'name'
    const conversations = await client.conversations.v1.conversations.list();
    const existingConversation = conversations.find(conv => 
      conv.friendlyName === name || conv.friendlyName === `Conversation with ${phoneNumber}`
    );

    if (existingConversation) {
      console.log(`Existing conversation found with SID: ${existingConversation.sid}`);
      // Update existing conversation attributes
      await client.conversations.v1.conversations(existingConversation.sid)
        .update({ attributes: attributes });

      // Notify existing WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'existingConversation',
            conversationSid: existingConversation.sid,
            friendlyName: existingConversation.friendlyName,
            lastMessage: message // Optionally send the last message added
          }));
        }
      });

      res.json({ sid: existingConversation.sid, existing: true });
    } else {
      // Create a new conversation with name and attributes
      const conversation = await client.conversations.v1.conversations.create({
        friendlyName: name || `Conversation with ${phoneNumber}`,
        attributes: attributes
      });

      console.log(`New conversation created with SID: ${conversation.sid} and Friendly Name: ${conversation.friendlyName}`);

      // Add participant to the conversation
      await client.conversations.v1.conversations(conversation.sid)
        .participants
        .create({
          'messagingBinding.address': phoneNumber,
          'messagingBinding.proxyAddress': process.env.TWILIO_PHONE_NUMBER,
          'messagingBinding.type': 'sms'
        });

      // Send the initial message with a disclaimer
      const firstMessage = `${message} (Note: you may reply STOP to no longer receive messages from us. Msg&Data Rates may apply.)`;
      await client.conversations.v1.conversations(conversation.sid)
        .messages
        .create({ body: firstMessage, author: process.env.TWILIO_PHONE_NUMBER });

      // Broadcast the new conversation to all connected clients via WebSocket
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'newConversation',
            conversationSid: conversation.sid,
            friendlyName: conversation.friendlyName,
            lastMessage: firstMessage
          }));
        }
      });

      res.json({ sid: conversation.sid, existing: false });
    }
  } catch (err) {
    console.error('Error starting a new conversation:', err.stack);
    res.status(500).json({ error: 'Failed to start a new conversation', details: err.message });
  }
});

// Update your /make-call/:sid route in app.js

app.post('/make-call/:sid', async (req, res) => {
  const { sid } = req.params;

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Fetch the conversation to get the participant's phone number
    const participants = await client.conversations.v1.conversations(sid).participants.list();
    const userParticipant = participants.find(p => p.messagingBinding.type === 'sms');

    if (!userParticipant) {
      return res.status(400).json({ error: 'No SMS participant found in this conversation' });
    }

    const userPhoneNumber = userParticipant.messagingBinding.address;

    // Initiate the call
    const call = await client.calls.create({
      twiml: '<Response><Say>Hello, this is a call from your Twilio application.</Say></Response>',
      to: userPhoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    console.log(`Call initiated with SID: ${call.sid}`);
    res.json({ message: 'Call initiated', callSid: call.sid });
  } catch (err) {
    console.error('Error initiating call:', err);
    res.status(500).json({ error: 'Failed to initiate call', details: err.message });
  }
});

app.get('/check-env', (req, res) => {
  const envVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_API_KEY',
    'TWILIO_API_SECRET',
    'TWILIO_TWIML_APP_SID',
    'TWILIO_PHONE_NUMBER',
    'NGROK_URL'
  ];

  const missingVars = envVars.filter(varName => !process.env[varName]);

  if (missingVars.length === 0) {
    res.json({ message: 'All required environment variables are set.' });
  } else {
    res.status(500).json({ error: 'Missing environment variables', missingVars });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`ngrok URL: ${NGROK_URL}`);
});