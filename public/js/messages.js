// public/js/messages.js

import { api } from './api.js';
import { currentConversation, state } from './state.js';
import { updateConversationPreview, incrementUnreadCount } from './conversations.js';
import { appendMessage, renderMessages, moveConversationToTop } from './ui.js';
import { log, playNotificationSound } from './utils.js';

const HTTP_STATUS_NOT_FOUND = 404;

/**
 * Fetches and displays messages for a conversation.
 * 
 * Imagine you're looking at a big book of messages. This function finds all the
 * messages for one conversation and shows them to you, newest first. If it can't
 * find the conversation, it tells you it might be lost.
 *
 * @param {string} sid - The special code that tells us which conversation to look at.
 * @returns {Promise<void>} Nothing, but it does its job in the background.
 */
export async function loadMessages(sid) {
  try {
    const messages = await api.getMessages(sid, { limit: 1000, order: 'asc' });
    renderMessages(messages);
    
    const latestMessage = messages[messages.length - 1];
    if (latestMessage) {
      updateConversationPreview(sid, latestMessage);
    }
  } catch (error) {
    if (error.response && error.response.status === HTTP_STATUS_NOT_FOUND) {
      log(`Conversation ${sid} was not found, it may have been deleted.`);
      // Handle conversation not found
    } else {
      log(`Error fetching messages for conversation ${sid}`, { error });
    }
  }
}

/**
 * Handles a new message that just arrived.
 * 
 * Think of this like getting a new letter. If it's not from you, it makes a sound
 * to let you know. It then puts the letter in the right place - either with the
 * conversation you're looking at now, or in a different pile. It also updates a
 * little note that tells you what the latest message says.
 *
 * @param {Object} data - All the information about the new message.
 * @param {string} data.author - Who sent the message.
 * @param {string} data.conversationSid - Which conversation the message belongs to.
 * @param {string} data.body - What the message says.
 * @param {string} [data.dateCreated] - When the message was created.
 * @returns {void}
 */
export function handleNewMessage(data) {
  // Play notification sound if the message is not from us
  if (data.author !== state.TWILIO_PHONE_NUMBER) {
    playNotificationSound();
  }

  // Ensure dateCreated is properly set
  if (!data.dateCreated) {
    data.dateCreated = new Date().toISOString();
  }

  if (currentConversation.sid === data.conversationSid) {
    appendMessage(data);
  } else {
    // Only increment unread count for messages not from us
    if (data.author !== state.TWILIO_PHONE_NUMBER) {
      incrementUnreadCount(data.conversationSid);
    }
  }

  // Update preview for the conversation
  updateConversationPreview(data.conversationSid, {
    body: data.body,
    author: data.author,
    dateCreated: data.dateCreated,
  });

  moveConversationToTop(data.conversationSid);
}