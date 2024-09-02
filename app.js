// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

// Create an Express application
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve the HTML file for the conversation UI
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Endpoint to list all conversations
app.get('/conversations', async (req, res) => {
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Fetch all conversations
    const conversations = await client.conversations.v1.conversations.list();

    // Send the conversation list as JSON to the client
    res.json(conversations);
  } catch (err) {
    console.error('Error fetching conversations:', err.stack);
    res.status(500).json({ error: 'Failed to fetch conversations', details: err.message });
  }
});

// Endpoint to delete a conversation
app.delete('/conversations/:sid', async (req, res) => {
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const { sid } = req.params;

    // Delete the conversation by SID
    await client.conversations.v1.conversations(sid).remove();

    res.json({ message: `Conversation ${sid} deleted successfully.` });
  } catch (err) {
    console.error(`Error deleting conversation ${req.params.sid}:`, err.stack);
    res.status(500).json({ error: `Failed to delete conversation ${req.params.sid}`, details: err.message });
  }
});

// Endpoint to add a message to a conversation
app.post('/conversations/:sid/messages', async (req, res) => {
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const { sid } = req.params;
    const { message } = req.body;

    // Logging: Start
    console.log(`Attempting to send message to conversation SID: ${sid}`);
    console.log(`Message content: "${message}"`);
    // Logging: End

    // Fetch the participant's phone number if available
    const participants = await client.conversations.v1.conversations(sid).participants.list();

    // Determine the author based on whether the message is being sent from the UI
    const author = process.env.TWILIO_PHONE_NUMBER; // Your Twilio phone number from the environment variables

    // **New Logging: Start**
    console.log(`Message will be sent with author: ${author}`);
    console.log(`Participants for conversation SID ${sid}:`, participants);
    // **New Logging: End**

    // Add a new message to the specified conversation
    const sentMessage = await client.conversations.v1.conversations(sid)
      .messages
      .create({ 
        body: message, 
        author: author // The Twilio phone number should be the author
      });

    // Logging: Start
    console.log(`Message sent with SID: ${sentMessage.sid}`);
    // Logging: End

    res.json({ message: 'Message sent', sid: sentMessage.sid });
  } catch (err) {
    console.error(`Error adding message to conversation ${req.params.sid}:`, err.stack);
    res.status(500).json({ error: `Failed to send message to conversation ${req.params.sid}`, details: err.message });
  }
});

// Endpoint to get messages from a specific conversation
app.get('/conversations/:sid/messages', async (req, res) => {
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
    res.status(500).json({ error: `Failed to fetch messages for conversation ${req.params.sid}`, details: err.message });
  }
});

app.post('/start-conversation', async (req, res) => {
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const { phoneNumber, message } = req.body;

    console.log(`Attempting to start a conversation with phoneNumber: ${phoneNumber}`);

    // Ensure phone numbers are in the correct E.164 format
    if (!/^\+\d{10,15}$/.test(phoneNumber)) {
      throw new Error('Invalid phone number format');
    }

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
        await client.conversations.v1.conversations(conversation.sid)
          .participants
          .create({
            'messagingBinding.address': phoneNumber,
            'messagingBinding.proxyAddress': process.env.TWILIO_PHONE_NUMBER,
            'messagingBinding.type': 'sms'
          });

        await client.conversations.v1.conversations(conversation.sid)
          .messages
          .create({ body: message, author: process.env.TWILIO_PHONE_NUMBER });

        res.json({ sid: conversation.sid, existing: false });
      } catch (err) {
        if (err.message.includes('A binding for this participant and proxy address already exists')) {
          console.log(`Binding already exists. Cleaning up new conversation with SID: ${conversation.sid}`);
          await client.conversations.v1.conversations(conversation.sid).remove(); // Clean up the newly created conversation
          res.json({ sid: existingConversation.sid, existing: true });
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

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});