import { api } from './api.js';
import { formatTime, log } from './utils.js';
import { currentConversation, state } from './state.js';
import { renderConversations, moveConversationToTop } from './ui.js';

export async function loadConversations() {
  document.getElementById('loading-spinner').style.display = 'block';

  try {
    const conversations = await api.getConversations();

    conversations.sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime),
    );

    renderConversations(conversations);

    if (currentConversation.sid) {
      const selectedConv = document.getElementById(`conv-${currentConversation.sid}`);
      if (selectedConv) {
        selectedConv.classList.add('selected');
      }
    }

    state.conversationsLoaded = true;
    state.conversations = conversations;
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
    const [latestMessage] = await api.getMessages(conversationSid, {
      limit: 1,
      order: 'desc',
    });
    if (latestMessage) {
      updateConversationPreview(conversationSid, latestMessage);
    }
  } catch (error) {
    const NOT_FOUND_STATUS = 404;
    if (error.response && error.response.status === NOT_FOUND_STATUS) {
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
  const existingIndex = state.conversations.findIndex(
    (conv) => conv.sid === data.sid
  );

  if (existingIndex !== -1) {
    state.conversations[existingIndex] = {
      ...state.conversations[existingIndex],
      ...data,
    };
  } else {
    state.conversations.push(data);
  }
  renderConversations(state.conversations, true);
}

export function handleUpdateConversation(data) {
  const conversationIndex = state.conversations.findIndex(
    (conv) => conv.sid === data.sid
  );

  if (conversationIndex !== -1) {
    state.conversations[conversationIndex] = {
      ...state.conversations[conversationIndex],
      ...data,
      lastMessage: data.lastMessage || state.conversations[conversationIndex].lastMessage,
    };

    const conversationDiv = document.getElementById(`conv-${data.sid}`);
    if (conversationDiv) {
      const nameElement = conversationDiv.querySelector('strong');
      if (nameElement) {
        nameElement.textContent = data.friendlyName || nameElement.textContent;
      }

      const lastMessageDiv = conversationDiv.querySelector('.last-message');
      if (lastMessageDiv) {
        lastMessageDiv.textContent = data.lastMessage || lastMessageDiv.textContent;
      }

      const timeDiv = conversationDiv.querySelector('.time');
      if (timeDiv && data.lastMessageTime) {
        timeDiv.textContent = formatTime(data.lastMessageTime);
      }

      moveConversationToTop(data.sid);
    }
  }

  renderConversations(state.conversations);
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

export function updateConversationPreview(conversationSid, latestMessage) {
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);
  if (conversationDiv) {
    const lastMessageDiv = conversationDiv.querySelector('.last-message');
    const timeDiv = conversationDiv.querySelector('.time');
    if (lastMessageDiv) {
      lastMessageDiv.textContent = latestMessage.body;
    }
    if (timeDiv && latestMessage.dateCreated) {
      timeDiv.textContent = formatTime(latestMessage.dateCreated);
    }
  }
}

if (module.hot) {
  module.hot.dispose(() => {
    log('Cleaning up conversations module');
  });
  module.hot.accept(() => {
    log('Conversations module updated');
    loadConversations().catch((error) => {
      console.error('Error reloading conversations:', error);
    });
  });
}