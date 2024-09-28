// public/js/conversations.js
import { api } from './api.js';
import { formatTime, log } from './utils.js';
import { currentConversation, state } from './state.js';
import { renderConversations, moveConversationToTop } from './ui.js';

export async function loadConversations() {
  document.getElementById('loading-spinner').style.display = 'block';

  try {
    const conversations = await api.getConversations();

    // Sort conversations by newest first
    conversations.sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime),
    );

    renderConversations(conversations);

    if (currentConversation.sid) {
      document
        .getElementById(`conv-${currentConversation.sid}`)
        ?.classList.add('selected');
    }

    state.conversationsLoaded = true;
    return conversations;
  } catch (error) {
    log('Error loading conversations', { error });
    return [];
  } finally {
    document.getElementById('loading-spinner').style.display = 'none';
  }
}

export async function updateLatestMessagePreview(conversationSid) {
  try {
    const messages = await api.getMessages(conversationSid, {
      limit: 1,
      order: 'desc',
    });
    const latestMessage = messages[0];
    if (latestMessage) {
      updateConversationPreview(conversationSid, latestMessage);
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      log(
        `Conversation ${conversationSid} not found, it may have been deleted.`,
      );
    } else {
      log('Error fetching latest message', { error });
    }
  }
}

export function incrementUnreadCount(conversationSid) {
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);
  if (conversationDiv) {
    conversationDiv.classList.add('unread');
    const unreadBadge = conversationDiv.querySelector('.unread-badge');
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
  const existingConversation = document.getElementById(
    `conv-${data.conversationSid}`,
  );

  if (existingConversation) {
    log('Conversation already exists, updating', {
      conversationSid: data.conversationSid,
    });
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
  const conversationDiv = document.getElementById(
    `conv-${data.conversationSid}`,
  );
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
  const conversationElement = document.getElementById(
    `conv-${conversationSid}`,
  );
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

export async function fetchConversation(sid) {
  try {
    return await api.getConversationDetails(sid);
  } catch (error) {
    log('Error fetching conversation', { sid, error });
    throw error;
  }
}

export async function listConversations() {
  try {
    return await api.getConversations();
  } catch (error) {
    log('Error listing conversations', { error });
    throw error;
  }
}

export async function createConversation(data) {
  try {
    return await api.startConversation(data);
  } catch (error) {
    log('Error creating conversation', { error });
    throw error;
  }
}

export async function deleteConversation(sid) {
  try {
    await api.deleteConversation(sid);
    removeConversationFromUI(sid);
    log('Conversation deleted successfully', { sid });
  } catch (error) {
    log('Error deleting conversation', { sid, error });
    throw error;
  }
}

export async function addMessage(conversationSid, message) {
  try {
    return await api.sendMessage(conversationSid, message);
  } catch (error) {
    log('Error adding message', { conversationSid, error });
    throw error;
  }
}

export async function listMessages(conversationSid, options = {}) {
  try {
    return await api.getMessages(conversationSid, options);
  } catch (error) {
    log('Error listing messages', { conversationSid, error });
    throw error;
  }
}

export async function markMessagesAsRead(conversationSid) {
  try {
    await api.markMessagesAsRead(conversationSid);
  } catch (error) {
    log('Error marking messages as read', { conversationSid, error });
    throw error;
  }
}

export async function addParticipant(conversationSid, participantData) {
  // This function would need to be implemented in the API
  log('addParticipant function not implemented');
}

export async function getConversationByPhoneNumber(phoneNumber) {
  // This function would need to be implemented in the API
  log('getConversationByPhoneNumber function not implemented');
}

export function isMessageRead(message) {
  // Implement logic to determine if a message is read
  // This might depend on how you're tracking read status in your application
  return message.read || false;
}

export function updateConversationPreview(conversationSid, latestMessage) {
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);
  if (conversationDiv) {
    const lastMessageDiv = conversationDiv.querySelector('.last-message');
    const timeDiv = conversationDiv.querySelector('.time');
    if (lastMessageDiv) {
      lastMessageDiv.textContent = latestMessage.body;
    }
    if (timeDiv) {
      timeDiv.textContent = formatTime(latestMessage.dateCreated);
    }
  }
}

if (module.hot) {
  module.hot.dispose(() => {
    log('Cleaning up conversations module');
    // Perform any necessary cleanup
  });
  module.hot.accept(() => {
    log('Conversations module updated');
    // Re-initialize conversations if necessary
    loadConversations().catch((error) => {
      console.error('Error reloading conversations:', error);
    });
  });
}


export function showNoConversationSelected() {
  document.getElementById('messages-title').style.display = 'none';
  document.getElementById('no-conversation').style.display = 'flex';
  document.getElementById('messages').innerHTML = '';
  document.getElementById('message-input').style.display = 'none';
}
