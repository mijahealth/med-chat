// public/js/messages.js
import { api } from './api.js';
import { currentConversation, state } from './state.js';
import { appendMessage, renderMessages, moveConversationToTop } from './ui.js';
import {
  updateLatestMessagePreview,
  incrementUnreadCount,
} from './conversations.js';
import { log, playNotificationSound } from './utils.js';
export async function loadMessages(sid) {
  try {
    const messages = await api.getMessages(sid, { limit: 1000, order: 'asc' });
    renderMessages(messages);

    const latestMessage = messages[messages.length - 1];
    if (latestMessage) {
      updateConversationPreview(sid, latestMessage);
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      log(`Conversation ${sid} was not found, it may have been deleted.`);
      // Handle conversation not found
    } else {
      log(`Error fetching messages for conversation ${sid}`, { error });
    }
  }
}

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

  // Update preview for all messages
  updateLatestMessagePreview(data.conversationSid, {
    body: data.body,
    author: data.author,
    dateCreated: data.dateCreated,
  });

  moveConversationToTop(data.conversationSid);
}
