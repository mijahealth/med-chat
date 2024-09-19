// conversations.js
const client = require('../twilioClient');

async function getConversationByPhoneNumber(phoneNumber) {
  const conversations = await client.conversations.v1.conversations.list();
  return conversations.find((conv) => {
    const convAttributes = JSON.parse(conv.attributes || '{}');
    return convAttributes.phoneNumber === phoneNumber;
  });
}

async function createConversation(friendlyName, attributes) {
  return await client.conversations.v1.conversations.create({
    friendlyName,
    attributes: JSON.stringify(attributes),
  });
}

async function updateConversationAttributes(sid, attributes) {
  return await client.conversations.v1.conversations(sid).update({
    attributes: JSON.stringify(attributes),
  });
}

async function addParticipant(conversationSid, phoneNumber) {
  return await client.conversations.v1
    .conversations(conversationSid)
    .participants.create({
      'messagingBinding.address': phoneNumber,
      'messagingBinding.proxyAddress': process.env.TWILIO_PHONE_NUMBER,
      'messagingBinding.type': 'sms',
    });
}

async function addMessage(conversationSid, message, author) {
  return await client.conversations.v1.conversations(conversationSid).messages.create({
    body: message,
    author,
  });
}

async function fetchConversation(sid) {
  return await client.conversations.v1.conversations(sid).fetch();
}

async function listConversations() {
  return await client.conversations.v1.conversations.list();
}

async function deleteConversation(sid) {
  return await client.conversations.v1.conversations(sid).remove();
}

async function listMessages(conversationSid, params = {}) {
    return await client.conversations.v1.conversations(conversationSid).messages.list(params);
  }

  async function markMessagesAsRead(conversationSid) {
    const messages = await listMessages(conversationSid, { limit: 1000 });
  
    const messagesToUpdate = messages.filter(
      (message) =>
        !JSON.parse(message.attributes || '{}').read &&
        message.author !== process.env.TWILIO_PHONE_NUMBER
    );
  
    // Update messages concurrently
    await Promise.all(
      messagesToUpdate.map((message) =>
        client.conversations.v1
          .conversations(conversationSid)
          .messages(message.sid)
          .update({ attributes: JSON.stringify({ read: true }) })
      )
    );
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