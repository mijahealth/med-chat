// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Create an Express application
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Define the rate limiter for all requests
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window (here, per 15 minutes)
  message: 'Too many requests from this IP, please try again later.',
});

// Apply the rate limiter to routes
app.use(apiLimiter);

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

    // Fetch the participant's phone number if available
    const participants = await client.conversations.v1.conversations(sid).participants.list();
    const author = process.env.TWILIO_PHONE_NUMBER;

    console.log(`Message will be sent with author: ${author}`);
    console.log(`Participants for conversation SID ${sid}:`, participants);

    // Add a new message to the specified conversation
    const sentMessage = await client.conversations.v1.conversations(sid)
      .messages
      .create({ 
        body: message, 
        author: author 
      });

    console.log(`Message sent with SID: ${sentMessage.sid}`);

    res.json({ message: 'Message sent', sid: sentMessage.sid });
  } catch (err) {
    console.error(`Error adding message to conversation ${req.params.sid}:`, err.stack);
    
    // Specific error handling for Twilio-related issues
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

// Start a new conversation with enhanced error handling
app.post('/start-conversation', [
  body('phoneNumber').matches(/^\+\d{10,15}$/).withMessage('Invalid phone number format'),
  body('message').isString().trim().isLength({ min: 1 }).withMessage('Message content cannot be empty')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const { phoneNumber, message } = req.body;

    console.log(`Attempting to start a conversation with phoneNumber: ${phoneNumber}`);

    // Check if a conversation already exists with the given phone number
    const conversations = await client.conversations.v1.conversations.list();
    const existingConversation = conversations.find(conv => 
      conv.friendlyName === `Conversation with ${phoneNumber}`
    );

    if (existingConversation) {
      console.log(`Existing conversation found with SID: ${existingConversation.sid}`);
      res.json({ sid: existingConversation.sid, existing: true });
    } else {
      // Create a new conversation if none exists
      const conversation = await client.conversations.v1.conversations.create({
        friendlyName: `Conversation with ${phoneNumber}`,
      });

      console.log(`New conversation created with SID: ${conversation.sid} and friendlyName: ${conversation.friendlyName}`);

      try {
        // Add participant to the conversation
        await client.conversations.v1.conversations(conversation.sid)
          .participants
          .create({
            'messagingBinding.address': phoneNumber,
            'messagingBinding.proxyAddress': process.env.TWILIO_PHONE_NUMBER,
            'messagingBinding.type': 'sms'
          });

        // Send the initial message
        await client.conversations.v1.conversations(conversation.sid)
          .messages
          .create({ body: message, author: process.env.TWILIO_PHONE_NUMBER });

        res.json({ sid: conversation.sid, existing: false });
      } catch (err) {
        // Handle specific Twilio-related errors
        if (err.message.includes('A binding for this participant and proxy address already exists')) {
          console.log(`Binding already exists. Cleaning up new conversation with SID: ${conversation.sid}`);
          await client.conversations.v1.conversations(conversation.sid).remove(); 
          res.json({ sid: conversation.sid, existing: true });
        } else {
          throw err;
        }
      }
    }
  } catch (err) {
    console.error('Error starting a new conversation:', err.stack);
    res.status(500).json({ error: 'Failed to start a new conversation', details: err.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});