// public/js/ui.js
import { setupEventListeners, selectConversation } from './events.js';
import { loadConversations, incrementUnreadCount, handleNewConversation, handleUpdateConversation, removeConversationFromUI } from './conversations.js';
import { setupWebSocket } from './websocket.js';
import { state, currentConversation } from './state.js';
import { api } from './api.js';
import { log, formatTime } from './utils.js';
import feather from 'feather-icons';

export async function initializeApp() {
  try {
    const config = await api.getConfig();
    state.TWILIO_PHONE_NUMBER = config.TWILIO_PHONE_NUMBER;
    state.NGROK_URL = config.NGROK_URL;

    setupEventListeners();
    const conversations = await loadConversations();
    renderConversations(conversations);
    setupWebSocket();
    showNoConversationSelected();
  } catch (error) {
    log('Error initializing app', { error });
  }
  feather.replace();
}

export function showNoConversationSelected() {
  document.getElementById('messages-title').style.display = 'none';
  document.getElementById('no-conversation').style.display = 'flex';
  document.getElementById('messages').innerHTML = '';
  document.getElementById('message-input').style.display = 'none';
}

export function renderConversations(conversations) {
  const conversationsDiv = document.getElementById('conversations');
  conversationsDiv.innerHTML = ''; // Clear existing conversations

  conversations.forEach((conversation) => {
    const conversationHtml = createConversationHtml(conversation);
    conversationsDiv.insertAdjacentHTML('beforeend', conversationHtml);
  });

  if (currentConversation.sid) {
    document.getElementById(`conv-${currentConversation.sid}`)?.classList.add('selected');
  }

  attachConversationListeners();
  feather.replace(); // Replace any new Feather icons
}

function createConversationHtml(conversation) {
  const lastMessageTime = formatTime(conversation.lastMessageTime);
  const displayName = conversation.friendlyName || conversation.sid;
  const lastMessageText = conversation.lastMessage || 'No messages yet';
  const unreadBadge = conversation.unreadCount > 0
    ? `<span class="unread-badge">${conversation.unreadCount}</span>`
    : '<span class="unread-indicator"></span>';

  return `
    <div class="conversation ${conversation.unreadCount > 0 ? 'unread' : ''}" id="conv-${conversation.sid}" data-sid="${conversation.sid}">
      <div class="conversation-header">
        <div class="unread-indicator-column">
          ${unreadBadge}
        </div>
        <div class="conversation-details">
          <div class="header-left">
            <strong>${displayName}</strong>
            <span class="phone-number">${conversation.attributes?.phoneNumber || ''}</span>
          </div>
          <div class="header-right">
            <span class="time">${lastMessageTime}</span>
            <button class="delete-btn" data-sid="${conversation.sid}" aria-label="Delete Conversation">
              <i data-feather="trash-2" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
      <div class="conversation-content">
        <div class="last-message">${lastMessageText}</div>
      </div>
    </div>
  `;
}

function attachConversationListeners() {
  document.querySelectorAll('.conversation').forEach(conv => {
    conv.addEventListener('click', () => selectConversation(conv.dataset.sid));
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversation(btn.dataset.sid);
    });
  });
}

export function updateLatestMessagePreview(conversationSid, message) {
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);
  if (conversationDiv) {
    const lastMessageDiv = conversationDiv.querySelector('.last-message');
    const timeDiv = conversationDiv.querySelector('.time');
    if (lastMessageDiv) {
      lastMessageDiv.textContent = message.body;
    }
    if (timeDiv) {
      timeDiv.textContent = formatTime(message.dateCreated);
    }
  }
}

export function moveConversationToTop(conversationSid) {
  const conversationsDiv = document.getElementById('conversations');
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);
  if (conversationDiv && conversationsDiv.firstChild !== conversationDiv) {
    conversationsDiv.insertBefore(conversationDiv, conversationsDiv.firstChild);
  }
}

function deleteConversation(sid) {
  // Implementation for deleting a conversation
  // This should call the API to delete the conversation and then update the UI
}

export function renderMessages(messages) {
  // Implementation for rendering messages in the selected conversation
}

export function appendMessage(message) {
  // Implementation for appending a new message to the current conversation
}

export function showMessageInput() {
  document.getElementById('message-input').style.display = 'flex';
}

// Export other necessary functions that might be used in other modules
export {
  incrementUnreadCount,
  handleNewConversation,
  handleUpdateConversation,
  removeConversationFromUI
};