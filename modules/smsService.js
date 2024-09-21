// modules/smsService.js
const client = require('../twilioClient');

// In-memory cache for deduplication
const sentMessagesCache = new Set();
const CACHE_TTL = 60000; // 60 seconds

function addToCache(messageKey) {
  sentMessagesCache.add(messageKey);
  setTimeout(() => {
    sentMessagesCache.delete(messageKey);
  }, CACHE_TTL);
}

function generateMessageKey(to, body) {
  return `${to}-${body}`;
}

function smsService(broadcast) {
  async function sendSMS(to, body, conversationSid = null, author = null) {
    const messageKey = generateMessageKey(to, body);
    
    if (sentMessagesCache.has(messageKey)) {
      console.warn(`Duplicate SMS detected. Skipping sending to ${to} with body "${body}".`);
      return null;
    }

    try {
      // Send SMS via Twilio
      const message = await client.messages.create({
        body: body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to,
      });

      // Add to cache to prevent duplicates
      addToCache(messageKey);

      // If a conversation SID is provided, add the message to the conversation
      if (conversationSid) {
        await client.conversations.v1.conversations(conversationSid).messages.create({
          body: body,
          author: author || process.env.TWILIO_PHONE_NUMBER,
        });
      }

      // Prepare message details for broadcasting
      const messageDetails = {
        type: 'newMessage',
        conversationSid: conversationSid,
        messageSid: message.sid,
        author: author || process.env.TWILIO_PHONE_NUMBER,
        body: body,
        dateCreated: new Date().toISOString(),
      };

      // Broadcast the new message to all connected clients
      broadcast(messageDetails);

      // Update conversation preview if conversationSid is provided
      if (conversationSid) {
        // Fetch the updated conversation to get the friendly name and attributes
        const conversation = await client.conversations.v1.conversations(conversationSid).fetch();

        broadcast({
          type: 'updateConversation',
          conversationSid: conversation.sid,
          friendlyName: conversation.friendlyName,
          lastMessage: body,
          lastMessageTime: messageDetails.dateCreated,
          attributes: JSON.parse(conversation.attributes || '{}'),
        });
      }

      // Log the SMS sent
      console.log(`SMS sent to ${to} with body "${body}" and added to conversation ${conversationSid}`);

      return message;
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  return {
    sendSMS,
  };
}

module.exports = smsService;