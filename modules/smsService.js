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

    logger.info('Attempting to send SMS', {
      to,
      body,
      conversationSid,
      messageKey,
    });

    if (sentMessagesCache.has(messageKey)) {
      logger.warn('Duplicate SMS detected', { to, body, messageKey });
      return null;
    }

    try {
      if (conversationSid) {
        // Send SMS via conversation messaging binding
        logger.info('Sending SMS via Conversation', { conversationSid, body });
        const conversationMessage = await client.conversations.v1
          .conversations(conversationSid)
          .messages.create({
            body,
            author: author || process.env.TWILIO_PHONE_NUMBER,
          });
        logger.info('Message added to conversation', {
          conversationSid,
          conversationMessageSid: conversationMessage.sid,
        });

        // Add to cache to prevent duplicates
        addToCache(messageKey);
        logger.info('Added message to cache', { messageKey });

        // Prepare message details for broadcasting
        const messageDetails = {
          type: 'newMessage',
          conversationSid,
          messageSid: conversationMessage.sid,
          author: author || process.env.TWILIO_PHONE_NUMBER,
          body,
          dateCreated: new Date().toISOString(),
        };

        // Broadcast the new message
        if (typeof broadcast === 'function') {
          logger.info('Broadcasting new message', { messageDetails });
          broadcast(messageDetails);
        } else {
          logger.warn('Broadcast function is not available', {
            messageDetails,
          });
        }

        // Update conversation preview if applicable
        try {
          logger.info('Fetching conversation for update', { conversationSid });
          const conversation = await client.conversations.v1
            .conversations(conversationSid)
            .fetch();
          if (typeof broadcast === 'function') {
            const updateDetails = {
              type: 'updateConversation',
              conversationSid: conversation.sid,
              friendlyName: conversation.friendlyName,
              lastMessage: body,
              lastMessageTime: messageDetails.dateCreated,
              attributes: JSON.parse(conversation.attributes || '{}'),
            };
            logger.info('Broadcasting conversation update', { updateDetails });
            broadcast(updateDetails);
          }
        } catch (convError) {
          logger.error('Error fetching conversation for update', {
            conversationSid,
            error: convError,
          });
        }

        logger.info('SMS sent successfully via Conversation', {
          to,
          body,
          conversationSid,
          messageSid: conversationMessage.sid,
        });

        return { success: true, messageSid: conversationMessage.sid };
      } else {
        // Send SMS directly via messages.create
        logger.info('Sending SMS via Twilio Messages API', { to, body });
        const message = await client.messages.create({
          body,
          from: process.env.TWILIO_PHONE_NUMBER,
          to,
        });
        logger.info('SMS sent via Twilio Messages API', {
          messageSid: message.sid,
          to,
          body,
        });

        // Add to cache to prevent duplicates
        addToCache(messageKey);
        logger.info('Added message to cache', { messageKey });

        // Prepare message details for broadcasting
        const messageDetails = {
          type: 'newMessage',
          to,
          messageSid: message.sid,
          author: process.env.TWILIO_PHONE_NUMBER,
          body,
          dateCreated: new Date().toISOString(),
        };

        // Broadcast the new message
        if (typeof broadcast === 'function') {
          logger.info('Broadcasting new message', { messageDetails });
          broadcast(messageDetails);
        } else {
          logger.warn('Broadcast function is not available', {
            messageDetails,
          });
        }

        logger.info('SMS sent successfully via Messages API', {
          to,
          body,
          messageSid: message.sid,
        });

        return { success: true, messageSid: message.sid };
      }
    } catch (error) {
      logger.error('Error sending SMS', {
        to,
        body,
        conversationSid,
        error: error.message,
        twilioCode: error.code,
        twilioMoreInfo: error.moreInfo,
      });
      throw error;
    }
  }

  return {
    sendSMS,
  };
}

module.exports = smsService;
