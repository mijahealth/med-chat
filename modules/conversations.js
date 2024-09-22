// modules/conversations.js
const client = require('../twilioClient');
const logger = require('./logger');

async function getConversationByPhoneNumber(phoneNumber) {
  try {
    const conversations = await client.conversations.v1.conversations.list();
    return conversations.find((conv) => {
      const convAttributes = JSON.parse(conv.attributes || '{}');
      return convAttributes.phoneNumber === phoneNumber;
    });
  } catch (error) {
    logger.error('Error fetching conversation by phone number', { error });
    throw error;
  }
}

async function createConversation(friendlyName, attributes) {
  try {
    return await client.conversations.v1.conversations.create({
      friendlyName,
      attributes: JSON.stringify(attributes),
    });
  } catch (error) {
    logger.error('Error creating conversation', { friendlyName, attributes, error });
    throw error;
  }
}

async function updateConversationAttributes(sid, attributes) {
  try {
    return await client.conversations.v1.conversations(sid).update({
      attributes: JSON.stringify(attributes),
    });
  } catch (error) {
    logger.error('Error updating conversation attributes', { sid, attributes, error });
    throw error;
  }
}

async function addParticipant(conversationSid, phoneNumber) {
  try {
    return await client.conversations.v1
      .conversations(conversationSid)
      .participants.create({
        'messagingBinding.address': phoneNumber,
        'messagingBinding.proxyAddress': process.env.TWILIO_PHONE_NUMBER,
        'messagingBinding.type': 'sms',
      });
  } catch (error) {
    logger.error('Error adding participant', { conversationSid, phoneNumber, error });
    throw error;
  }
}

async function addMessage(conversationSid, message, author) {
  try {
    return await client.conversations.v1.conversations(conversationSid).messages.create({
      body: message,
      author,
    });
  } catch (error) {
    logger.error('Error adding message to conversation', { conversationSid, message, author, error });
    throw error;
  }
}

async function fetchConversation(sid) {
  try {
    return await client.conversations.v1.conversations(sid).fetch();
  } catch (error) {
    logger.error('Error fetching conversation', { sid, error });
    throw error;
  }
}

async function listConversations() {
  try {
    return await client.conversations.v1.conversations.list();
  } catch (error) {
    logger.error('Error listing conversations', { error });
    throw error;
  }
}

async function deleteConversation(sid) {
  try {
    return await client.conversations.v1.conversations(sid).remove();
  } catch (error) {
    logger.error('Error deleting conversation', { sid, error });
    throw error;
  }
}

async function listMessages(conversationSid, params = {}) {
  try {
    return await client.conversations.v1.conversations(conversationSid).messages.list(params);
  } catch (error) {
    logger.error('Error listing messages', { conversationSid, params, error });
    throw error;
  }
}

async function markMessagesAsRead(conversationSid) {
  try {
    const messages = await listMessages(conversationSid, { limit: 1000 });
    const messagesToUpdate = messages.filter(
      (message) =>
        !JSON.parse(message.attributes || '{}').read &&
        message.author !== process.env.TWILIO_PHONE_NUMBER
    );

    await Promise.all(
      messagesToUpdate.map((message) =>
        client.conversations.v1
          .conversations(conversationSid)
          .messages(message.sid)
          .update({ attributes: JSON.stringify({ read: true }) })
      )
    );

    logger.info('Marked messages as read', { conversationSid, count: messagesToUpdate.length });
  } catch (error) {
    logger.error('Error marking messages as read', { conversationSid, error });
    throw error;
  }
}

module.exports = {
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
};