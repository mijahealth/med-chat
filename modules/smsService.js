/* eslint-env node */

// modules/smsService.js
const client = require('../twilioClient');
const logger = require('./logger');

/**
 * SMS Service Factory
 * @param {Function} broadcast - Function to broadcast messages via WebSocket
 * @returns {Object} - SMS service with sendSMS method
 */
function smsService(broadcast) {
  // In-memory cache for deduplication
  const sentMessagesCache = new Set();
  const CACHE_TTL = 60000; // 60 seconds

  /**
   * Adds a message key to the cache to prevent duplication
   * @param {string} messageKey 
   */
  function addToCache(messageKey) {
    sentMessagesCache.add(messageKey);
    setTimeout(() => {
      sentMessagesCache.delete(messageKey);
    }, CACHE_TTL);
  }

  /**
   * Generates a unique key for a message based on recipient and body
   * @param {string} to 
   * @param {string} body 
   * @returns {string} 
   */
  function generateMessageKey(to, body) {
    return `${to}-${body}`;
  }

  /**
   * Sends an SMS message via Twilio
   * @param {string} to - Recipient phone number
   * @param {string} body - Message content
   * @param {string|null} conversationSid - Associated Conversation SID
   * @param {string|null} author - Author of the message
   * @returns {Promise<Object|null>} - Twilio message object or null if duplicate
   */
  async function sendSMS(to, body, conversationSid = null, author = null) {
    const messageKey = generateMessageKey(to, body);

    if (sentMessagesCache.has(messageKey)) {
      logger.warn('Duplicate SMS detected', { to, body });
      return null;
    }

    try {
      // Send SMS via Twilio
      const message = await client.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to,
      });

      // Add to cache to prevent duplicates
      addToCache(messageKey);

      // Add message to conversation if SID provided
      if (conversationSid) {
        await client.conversations.v1.conversations(conversationSid).messages.create({
          body,
          author: author || process.env.TWILIO_PHONE_NUMBER,
        });
      }

      // Prepare message details for broadcasting
      const messageDetails = {
        type: 'newMessage',
        conversationSid,
        messageSid: message.sid,
        author: author || process.env.TWILIO_PHONE_NUMBER,
        body,
        dateCreated: new Date().toISOString(),
      };

      // Broadcast the new message
      broadcast(messageDetails);

      // Update conversation preview if applicable
      if (conversationSid) {
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

      logger.info('SMS sent successfully', { to, body, conversationSid });

      return message;
    } catch (error) {
      logger.error('Error sending SMS', { to, body, conversationSid, error });
      throw error;
    }
  }

  return {
    sendSMS,
  };
}

module.exports = smsService;