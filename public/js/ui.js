// public/js/ui.js
import { loadConversations, incrementUnreadCount, handleNewConversation, handleUpdateConversation, removeConversationFromUI } from './conversations.js';
import { setupWebSocket } from './websocket.js';
import { state, currentConversation } from './state.js';
import { api } from './api.js';
import { log, formatTime } from './utils.js';
import feather from 'feather-icons';
import { selectConversation } from './events.js';


export async function initializeApp() {
  try {
    const config = await api.getConfig();
    state.TWILIO_PHONE_NUMBER = config.TWILIO_PHONE_NUMBER;
    state.NGROK_URL = config.NGROK_URL;

    const conversations = await loadConversations();
    renderConversations(conversations || []); // Ensure an array is passed
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

  if (Array.isArray(conversations)) {
    conversations.forEach((conversation) => {
      const conversationHtml = createConversationHtml(conversation);
      conversationsDiv.insertAdjacentHTML('beforeend', conversationHtml);
    });

    if (currentConversation.sid) {
      document.getElementById(`conv-${currentConversation.sid}`)?.classList.add('selected');
    }

    attachConversationListeners();
    feather.replace(); // Replace any new Feather icons
  } else {
    log('No conversations to render or invalid data received');
  }
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
    conv.addEventListener('click', (e) => {
      e.preventDefault();
      const sid = conv.dataset.sid;
      console.log(`Conversation clicked in ui.js, SID: ${sid}`);
      selectConversation(sid);
    });
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

async function deleteConversation(sid) {
  try {
    await api.deleteConversation(sid);
    removeConversationFromUI(sid);
    if (currentConversation.sid === sid) {
      showNoConversationSelected();
    }
    log(`Conversation ${sid} deleted successfully`);
  } catch (error) {
    log('Error deleting conversation', { sid, error });
    alert('Failed to delete conversation. Please try again.');
  }
}

export function renderMessages(messages) {
  const messagesContainer = document.getElementById('messages');
  messagesContainer.innerHTML = ''; // Clear existing messages

  messages.forEach((message) => {
    appendMessage(message);
  });

  // Scroll to the bottom of the messages container
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

export function appendMessage(message) {
  const messagesContainer = document.getElementById('messages');
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  messageElement.classList.add(message.author === state.TWILIO_PHONE_NUMBER ? 'sent' : 'received');

  const contentElement = document.createElement('div');
  contentElement.classList.add('message-content');
  contentElement.textContent = message.body;

  const timeElement = document.createElement('div');
  timeElement.classList.add('message-time');
  timeElement.textContent = formatTime(message.dateCreated);

  messageElement.appendChild(contentElement);
  messageElement.appendChild(timeElement);

  messagesContainer.appendChild(messageElement);

  // Scroll to the bottom of the messages container
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

export function showMessageInput() {
  document.getElementById('message-input').style.display = 'flex';
}

export function updateConversationHeader(sid, name, email, phoneNumber, dob, state) {
  const headerElement = document.getElementById('contact-info');
  if (headerElement) {
    headerElement.innerHTML = `
      <div>
        <h2>${name || 'Unknown'}</h2>
        <p>${phoneNumber || ''}</p>
        <p>${email || ''}</p>
        <p>DOB: ${dob || 'N/A'}</p>
        <p>State: ${state || 'N/A'}</p>
      </div>
    `;
  }
}

// Export all necessary functions
export {
  incrementUnreadCount,
  handleNewConversation,
  handleUpdateConversation,
  removeConversationFromUI,
};