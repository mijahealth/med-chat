// public/js/conversations.js
import { api } from './api.js';
import { formatTime, log } from './utils.js';
import { currentConversation, state } from './state.js';
import { selectConversation } from './events.js';
import { renderConversations, updateConversationPreview, moveConversationToTop } from './render.js';

export async function loadConversations() {
  document.getElementById('loading-spinner').style.display = 'block';

  try {
    const conversations = await api.getConversations();

    // Sort conversations by newest first
    conversations.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    renderConversations(conversations);

    if (currentConversation.sid) {
      document.getElementById(`conv-${currentConversation.sid}`)?.classList.add('selected');
    }

    state.conversationsLoaded = true;
  } catch (error) {
    log('Error loading conversations', { error });
  } finally {
    document.getElementById('loading-spinner').style.display = 'none';
  }
}

export async function updateLatestMessagePreview(conversationSid) {
  try {
    const messages = await api.getMessages(conversationSid, { limit: 1, order: 'desc' });
    const latestMessage = messages[0];
    if (latestMessage) {
      updateConversationPreview(conversationSid, latestMessage);
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      log(`Conversation ${conversationSid} not found, it may have been deleted.`);
    } else {
      log('Error fetching latest message', { error });
    }
  }
}

export function incrementUnreadCount(conversationSid) {
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);
  if (conversationDiv) {
    conversationDiv.classList.add('unread');
    let unreadBadge = conversationDiv.querySelector('.unread-badge');
    if (unreadBadge) {
      const currentCount = parseInt(unreadBadge.textContent) || 0;
      unreadBadge.textContent = currentCount + 1;
    } else {
      conversationDiv.querySelector('.unread-indicator-column').innerHTML = `
        <span class="unread-badge">1</span>
      `;
    }
  }
}

export function handleNewConversation(data) {
  const existingConversation = document.getElementById(`conv-${data.conversationSid}`);

  if (existingConversation) {
    log('Conversation already exists, updating', { conversationSid: data.conversationSid });
    updateConversationPreview(data.conversationSid, {
      body: data.lastMessage,
      dateCreated: new Date().toISOString(),
    });
    moveConversationToTop(data.conversationSid);
    return;
  }

  renderConversations([data], true);
}

export function handleUpdateConversation(data) {
  const conversationDiv = document.getElementById(`conv-${data.conversationSid}`);
  if (conversationDiv) {
    // Update the friendly name
    const nameElement = conversationDiv.querySelector('strong');
    if (nameElement) {
      nameElement.textContent = data.friendlyName;
    }

    // Update the last message
    const lastMessageDiv = conversationDiv.querySelector('.last-message');
    if (lastMessageDiv) {
      lastMessageDiv.textContent = data.lastMessage;
    }

    // Update the time
    const timeDiv = conversationDiv.querySelector('.time');
    if (timeDiv) {
      timeDiv.textContent = formatTime(data.lastMessageTime);
    }

    // Move the conversation to the top of the list
    moveConversationToTop(data.conversationSid);

    // Don't mark as unread or increment count here
  }
}

export function removeConversationFromUI(conversationSid) {
  const conversationElement = document.getElementById(`conv-${conversationSid}`);
  if (conversationElement) {
    conversationElement.remove();
    log('Conversation removed from UI', { conversationSid });
  } else {
    log('Conversation element not found for deletion', { conversationSid });
  }

  // If the deleted conversation is currently selected, clear the message pane
  if (currentConversation.sid === conversationSid) {
    currentConversation.sid = null;
    document.getElementById('messages').innerHTML = '';
    document.getElementById('messages-title').innerHTML = '';
    document.getElementById('message-input').style.display = 'none';
    log('Cleared message pane for deleted conversation', { conversationSid });
  }
}