// public/js/ui.js
import { loadConversations, incrementUnreadCount, handleNewConversation, handleUpdateConversation, removeConversationFromUI } from './conversations.js';
import { setupWebSocket } from './websocket.js';
import { state, currentConversation } from './state.js';
import { api } from './api.js';
import { log, formatTime } from './utils.js';
import feather from 'feather-icons';
import { closeConversation, selectConversation } from './events.js';


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
  const author = message.author.trim();
  const messageClass = author === state.TWILIO_PHONE_NUMBER ? 'right' : 'left';

  const messageHtml = `
    <div class="message ${messageClass}">
      <span>${message.body}</span>
      <time>${formatTime(message.dateCreated)}</time>
    </div>
  `;
  messagesContainer.insertAdjacentHTML('beforeend', messageHtml);

  // Auto-scroll to bottom if enabled
  if (state.autoScrollEnabled) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

export function showMessageInput() {
  document.getElementById('message-input').style.display = 'flex';
}

export function updateConversationHeader(sid, name, email, phoneNumber, dob, state) {
  const headerElement = document.getElementById('messages-title');
  headerElement.style.display = 'flex';
  headerElement.innerHTML = `
    <div class="contact-card-wrapper">
      <div class="contact-card">
        <div class="contact-card-avatar">
          <i data-feather="user" class="icon avatar-icon"></i>
        </div>
        <div class="contact-card-content">
          <div class="contact-card-main">
            <h2 class="contact-name">${name || 'Unknown'}</h2>
            <div class="contact-card-details">
              <div class="contact-info-row">
                <div class="contact-item">
                  <i data-feather="phone" class="icon contact-icon"></i>
                  <span>${phoneNumber || 'N/A'}</span>
                </div>
                <div class="contact-item">
                  <i data-feather="mail" class="icon contact-icon"></i>
                  <a href="mailto:${email}" target="_blank" rel="noopener noreferrer">${email || 'N/A'}</a>
                </div>
              </div>
              <div class="contact-info-row">
                <div class="contact-item">
                  <i data-feather="calendar" class="icon contact-icon"></i>
                  <span>DOB: ${dob || 'N/A'}</span>
                </div>
                <div class="contact-item">
                  <i data-feather="map-pin" class="icon contact-icon"></i>
                  <span>State: ${state || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="header-controls">
        <div id="call-controls">
          <button id="call-btn" aria-label="Start Call" title="Start Call">
            <i data-feather="phone-call"></i>
          </button>
          <button id="start-video-call-btn" aria-label="Start Video Call" title="Start Video Call">
            <i data-feather="video"></i>
          </button>
          <button id="mute-btn" aria-label="Mute Call" title="Mute Call" style="display: none;">
            <i data-feather="mic-off"></i>
          </button>
          <button id="end-call-btn" aria-label="End Call" title="End Call" style="display: none;">
            <i data-feather="phone-off"></i>
          </button>
          <span id="call-status"></span>
        </div>
        <button class="close-button" id="close-conversation-btn" aria-label="Close Conversation">
          <i data-feather="x"></i>
        </button>
      </div>
    </div>
  `;

  // Attach event listener to close button
  document.getElementById('close-conversation-btn').addEventListener('click', closeConversation);

  // Replace Feather Icons
  feather.replace();
}

// Export all necessary functions
export {
  incrementUnreadCount,
  handleNewConversation,
  handleUpdateConversation,
  removeConversationFromUI,
};