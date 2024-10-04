// modules/smsService.js
const client = require('../twilioClient');
const logger = require('./logger');

/**
 * SMS Service Factory
 * @param {Function} broadcast - Function to broadcast messages via WebSocket
 * @returns {Object} - SMS service with sendSMS method
 */
function smsService(broadcast) {
  /**
   * Broadcasts a message if the broadcast function is available.
   * @param {Object} messageDetails - The details of the message to broadcast.
   */
  function broadcastMessage(messageDetails) {
    if (typeof broadcast === 'function') {
      logger.info('Broadcasting message', { messageDetails });
      broadcast(messageDetails);
    } else {
      logger.warn('Broadcast function is not available', { messageDetails });
    }
  }

  /**
   * Sends an SMS message via Twilio Conversations.
   * @param {string} to - Recipient phone number.
   * @param {string} body - Message content.
   * @param {string|null} conversationSid - Associated Conversation SID.
   * @param {string|null} author - Author of the message.
   * @returns {Promise<Object>} - Result containing success status and message SID.
   */
  async function sendViaConversation(to, body, conversationSid, author) {
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
    broadcastMessage(messageDetails);

    // Update conversation preview if applicable
    try {
      logger.info('Fetching conversation for update', { conversationSid });
      const conversation = await client.conversations.v1
        .conversations(conversationSid)
        .fetch();
      const updateDetails = {
        type: 'updateConversation',
        conversationSid: conversation.sid,
        friendlyName: conversation.friendlyName,
        lastMessage: body,
        lastMessageTime: messageDetails.dateCreated,
        attributes: JSON.parse(conversation.attributes || '{}'),
      };
      logger.info('Broadcasting conversation update', { updateDetails });
      broadcastMessage(updateDetails);
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
  }

  /**
   * Sends an SMS message directly via Twilio Messages API.
   * @param {string} to - Recipient phone number.
   * @param {string} body - Message content.
   * @returns {Promise<Object>} - Result containing success status and message SID.
   */
  async function sendViaMessagesAPI(to, body) {
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
    broadcastMessage(messageDetails);

    logger.info('SMS sent successfully via Messages API', {
      to,
      body,
      messageSid: message.sid,
    });

    return { success: true, messageSid: message.sid };
  }

  /**
   * Sends an SMS message via Twilio.
   * @param {string} to - Recipient phone number.
   * @param {string} body - Message content.
   * @param {string|null} conversationSid - Associated Conversation SID.
   * @param {string|null} author - Author of the message.
   * @returns {Promise<Object>} - Twilio message object.
   */
  async function sendSMS(to, body, conversationSid = null, author = null) {
    logger.info('Attempting to send SMS', {
      to,
      body,
      conversationSid,
    });

    try {
      if (conversationSid) {
        return await sendViaConversation(to, body, conversationSid, author);
      } else {
        return await sendViaMessagesAPI(to, body);
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