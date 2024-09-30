// modules/conversations.js

const client = require('../twilioClient'); // Ensure the path is correct
const logger = require('./logger');
const {TWILIO_PHONE_NUMBER} = process.env; // Ensure this is set in your environment variables

/**
 * Determines whether a given message has been marked as read.
 *
 * This function inspects the `attributes` property of a message object to ascertain its read status.
 * It parses the JSON-formatted `attributes` string and checks for a `read` flag.
 * If the `read` attribute is set to a truthy value, the function returns `true`, indicating that
 * the message has been read. Otherwise, it returns `false`, signifying that the message remains unread.
 *
 * **Note:** 
 * - Ensure that the `attributes` property of the message object contains a valid JSON string.
 * - The structure and meaning of the `read` attribute should align with your application's logic
 * for tracking message statuses.
 *
 * @param {Object} message - The message object to evaluate.
 * @param {string} [message.attributes='{}'] - A JSON string representing additional attributes of the message.
 *
 * @returns {boolean} - Returns `true` if the message is marked as read; otherwise, returns `false`.
 *
 * @example
 * const message = {
 *   attributes: '{"read": true, "priority": "high"}'
 * };
 * 
 * const hasBeenRead = isMessageRead(message);
 * console.log(hasBeenRead); // Output: true
 */

function isMessageRead(message) {
  const attributes = JSON.parse(message.attributes || '{}');
  return attributes.read || false;
}

/**
 * Fetches a specific conversation by SID.
 *
 * @param {string} sid - The SID of the conversation.
 * @returns {Promise<Object>} - The conversation object.
 */
async function fetchConversation(sid) {
  try {
    const conversation = await client.conversations.v1
      .conversations(sid)
      .fetch();
    logger.info(`Fetched conversation: ${sid}`);
    return conversation;
  } catch (error) {
    logger.error('Error fetching conversation', { sid, error });
    throw error;
  }
}

/**
 * Lists all conversations with their latest message and unread count.
 *
 * @returns {Promise<Array>} - An array of conversation objects with details.
 */
async function listConversations() {
  try {
    const conversations = await client.conversations.v1.conversations.list();
    logger.info(`Fetched ${conversations.length} conversations`);

    // Fetch details for each conversation concurrently
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        try {
          // Fetch the latest message
          const messages = await client.conversations.v1
            .conversations(conv.sid)
            .messages.list({
              limit: 1,
              order: 'desc',
            });
            const [lastMessage] = messages;
            
          // Fetch all messages to calculate unread count
          const allMessages = await client.conversations.v1
            .conversations(conv.sid)
            .messages.list({
              limit: 1000, // Adjust as needed based on expected message volume
              order: 'asc',
            });

          const unreadCount = allMessages.filter(
            (msg) => msg.author !== TWILIO_PHONE_NUMBER && !isMessageRead(msg),
          ).length;

          return {
            sid: conv.sid,
            friendlyName: conv.friendlyName,
            attributes: JSON.parse(conv.attributes || '{}'),
            lastMessage: lastMessage ? lastMessage.body : 'No messages yet',
            lastMessageTime: lastMessage ? lastMessage.dateCreated : null,
            unreadCount,
          };
        } catch (error) {
          logger.error('Error fetching details for conversation', {
            conversationSid: conv.sid,
            error,
          });
          return {
            sid: conv.sid,
            friendlyName: conv.friendlyName,
            attributes: JSON.parse(conv.attributes || '{}'),
            lastMessage: 'Error fetching message',
            lastMessageTime: null,
            unreadCount: 0,
          };
        }
      }),
    );

    return conversationsWithDetails;
  } catch (error) {
    logger.error('Error listing conversations', { error });
    throw error;
  }
}

/**
 * Creates a new conversation.
 *
 * @param {string} friendlyName - The friendly name for the conversation.
 * @param {Object} attributes - JSON attributes for the conversation.
 * @returns {Promise<Object>} - The created conversation object.
 */
async function createConversation(friendlyName, attributes = {}) {
  try {
    const conversation = await client.conversations.v1.conversations.create({
      friendlyName,
      attributes: JSON.stringify(attributes),
    });
    logger.info(`Created conversation: ${conversation.sid}`);
    return conversation;
  } catch (error) {
    logger.error('Error creating conversation', {
      friendlyName,
      attributes,
      error,
    });
    throw error;
  }
}

/**
 * Deletes a conversation by SID.
 *
 * @param {string} sid - The SID of the conversation to delete.
 * @returns {Promise<void>}
 */
async function deleteConversation(sid) {
  try {
    await client.conversations.v1.conversations(sid).remove();
    logger.info(`Deleted conversation: ${sid}`);
  } catch (error) {
    logger.error('Error deleting conversation', { sid, error });
    throw error;
  }
}

/**
 * Adds a message to a conversation.
 *
 * @param {string} conversationSid - The SID of the conversation.
 * @param {string} message - The message body.
 * @param {string} author - The author of the message.
 * @returns {Promise<Object>} - The created message object.
 */
async function addMessage(conversationSid, message, author) {
  try {
    const newMessage = await client.conversations.v1
      .conversations(conversationSid)
      .messages.create({
        body: message,
        author,
      });
    logger.info(
      `Added message to conversation ${conversationSid}: ${newMessage.sid}`,
    );
    return newMessage;
  } catch (error) {
    logger.error('Error adding message to conversation', {
      conversationSid,
      message,
      author,
      error,
    });
    throw error;
  }
}

/**
 * Lists messages in a conversation.
 *
 * @param {string} conversationSid - The SID of the conversation.
 * @param {Object} options - Options for listing messages (e.g., limit, order).
 * @returns {Promise<Array>} - An array of message objects.
 */
async function listMessages(conversationSid, options = {}) {
  try {
    const messages = await client.conversations.v1
      .conversations(conversationSid)
      .messages.list(options);
    logger.info(
      `Fetched ${messages.length} messages from conversation ${conversationSid}`,
    );
    return messages;
  } catch (error) {
    logger.error('Error listing messages', { conversationSid, options, error });
    throw error;
  }
}

/**
 * Marks all messages in a conversation as read.
 *
 * @param {string} conversationSid - The SID of the conversation.
 * @returns {Promise<void>}
 */
async function markMessagesAsRead(conversationSid) {
  try {
    // Fetch all messages in the conversation
    const messages = await client.conversations.v1
      .conversations(conversationSid)
      .messages.list({ limit: 1000 });

    // Iterate through messages and mark as read
    const updatePromises = messages.map(async (message) => {
      // Skip messages authored by the user or already marked as read
      if (message.author === TWILIO_PHONE_NUMBER || isMessageRead(message)) {
        return;
      }

      // Update message attributes to mark as read
      const attributes = JSON.parse(message.attributes || '{}');
      attributes.read = true;

      try {
        await client.conversations.v1
          .conversations(conversationSid)
          .messages(message.sid)
          .update({
            attributes: JSON.stringify(attributes),
          });
        logger.info(
          `Marked message ${message.sid} as read in conversation ${conversationSid}`,
        );
      } catch (updateError) {
        logger.error('Error marking message as read', {
          conversationSid,
          messageSid: message.sid,
          updateError,
        });
      }
    });

    // Wait for all updates to complete
    await Promise.all(updatePromises);
    logger.info(
      `All unread messages marked as read in conversation ${conversationSid}`,
    );
  } catch (error) {
    logger.error('Error marking messages as read', { conversationSid, error });
    throw error;
  }
}

/**
 * Adds a participant to a conversation via SMS.
 *
 * @param {string} conversationSid - The SID of the conversation.
 * @param {string} phoneNumber - The phone number to add as a participant.
 * @returns {Promise<Object>} - The participant object.
 */
async function addParticipant(conversationSid, phoneNumber) {
  try {
    const participant = await client.conversations.v1
      .conversations(conversationSid)
      .participants.create({
        'messagingBinding.address': phoneNumber,
        'messagingBinding.proxyAddress': TWILIO_PHONE_NUMBER,
        'messagingBinding.type': 'sms',
      });
    logger.info(
      `Added participant ${phoneNumber} to conversation ${conversationSid}`,
    );
    return participant;
  } catch (error) {
    logger.error('Error adding participant to conversation', {
      conversationSid,
      phoneNumber,
      error,
    });
    throw error;
  }
}

/**
 * Fetches a conversation by phone number.
 *
 * @param {string} phoneNumber - The phone number associated with the conversation.
 * @returns {Promise<Object|null>} - The conversation object if found, else null.
 */
async function getConversationByPhoneNumber(phoneNumber) {
  try {
    const conversationsList = await client.conversations.v1.conversations.list({
      limit: 1000,
    });

    for (const conv of conversationsList) {
      const attributes = JSON.parse(conv.attributes || '{}');
      if (attributes.phoneNumber === phoneNumber) {
        logger.info(
          `Found conversation ${conv.sid} for phone number ${phoneNumber}`,
        );
        return conv;
      }
    }

    logger.info(`No conversation found for phone number ${phoneNumber}`);
    return null;
  } catch (error) {
    logger.error('Error fetching conversation by phone number', {
      phoneNumber,
      error,
    });
    throw error;
  }
}

module.exports = {
  fetchConversation,
  listConversations,
  createConversation,
  deleteConversation,
  addMessage,
  listMessages,
  markMessagesAsRead,
  addParticipant,
  getConversationByPhoneNumber,
  isMessageRead,
};
