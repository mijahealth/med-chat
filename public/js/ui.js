// public/js/ui.js

/**
 * This file is like the manager of a big playground for our chat app.
 * It helps set up all the different parts of the playground, like the
 * slide (conversations list), the sandbox (message area), and the toy box
 * (message input). It makes sure everything looks nice and works well
 * together, so you can have fun chatting with your friends!
 */


import {
  loadConversations,
  incrementUnreadCount,
  handleNewConversation,
  handleUpdateConversation,
  removeConversationFromUI,
} from './conversations.js';
import { setupWebSocket } from './websocket.js';
import { state, currentConversation } from './state.js';
import { api } from './api.js';
import { log, formatTime } from './utils.js';
import feather from 'feather-icons';
import { closeConversation, setupConversationListeners } from './events.js';

/**
 * Starts the app by setting up all the necessary parts.
 * 
 * Imagine you're setting up a big playroom. This function gets all the toys
 * ready, puts them in the right places, and makes sure everything is working
 * before you start playing.
 *
 * @async
 * @returns {Promise<void>}
 */
export async function initializeApp() {
  try {
    const config = await api.getConfig();
    state.TWILIO_PHONE_NUMBER = config.TWILIO_PHONE_NUMBER;
    state.NGROK_URL = config.NGROK_URL;

    // Load conversations and render them
    const conversations = await loadConversations();

    // Event listener will be attached after rendering conversations
    renderConversations(conversations || []);

    // Other initializations
    setupWebSocket();
    showNoConversationSelected();
  } catch (error) {
    log('Error initializing app', { error });
  }
  feather.replace();
}

/**
 * Shows a message when no conversation is selected.
 * 
 * It's like when you open your toy box but haven't picked out a toy to play with yet.
 * This function shows a message saying "Pick a toy to play with!"
 */
export function showNoConversationSelected() {
  document.getElementById('messages-title').style.display = 'none';
  document.getElementById('no-conversation').style.display = 'flex';
  document.getElementById('messages').innerHTML = '';
  document.getElementById('message-input').style.display = 'none';
}

/**
 * Displays all the conversations in a list on the screen.
 * 
 * Think of this like arranging all your coloring books on a shelf. Each book
 * (conversation) is put in a neat row so you can see all of them at once.
 *
 * @param {Array} conversations - A list of all the conversations to show.
 */
export function renderConversations(conversations) {
  const conversationsDiv = document.getElementById('conversations');
  conversationsDiv.innerHTML = ''; // Clear existing conversations

  console.log('Rendering conversations:', conversations);

  if (Array.isArray(conversations)) {
    conversations.forEach((conversation) => {
      console.log('Processing conversation:', conversation);

      // Ensure conversation.attributes exists
      conversation.attributes = conversation.attributes || {};

      const lastMessageText = conversation.lastMessage || 'No messages yet';
      console.log('Last message text:', lastMessageText);

      const conversationHtml = createConversationHtml({
        ...conversation,
        lastMessage: lastMessageText,
      });
      conversationsDiv.insertAdjacentHTML('beforeend', conversationHtml);
    });

    if (currentConversation.sid) {
      document
        .getElementById(`conv-${currentConversation.sid}`)
        ?.classList.add('selected');
    }

    feather.replace(); // Replace any new Feather icons

    // Attach event listeners for conversation clicks after rendering
    setupConversationListeners();
  } else {
    log('No conversations to render or invalid data received');
  }
}

/**
 * Creates the HTML for a single conversation.
 * 
 * This is like drawing a picture of a friend. You include their name,
 * when you last talked, and what you talked about. This function does
 * that, but for a conversation on the computer.
 *
 * @param {Object} conversation - All the details about one conversation.
 * @returns {string} The pretty HTML picture of the conversation.
 */
function createConversationHtml(conversation) {
  const lastMessageTime = formatTime(conversation.lastMessageTime);
  const displayName = conversation.friendlyName || conversation.sid;
  const lastMessageText = conversation.lastMessage || 'No messages yet';
  const unreadBadge =
    conversation.unreadCount > 0
      ? `<span class="unread-badge">${conversation.unreadCount}</span>`
      : '<span class="unread-indicator"></span>';

  return `
    <div class="conversation ${conversation.unreadCount > 0 ? 'unread' : ''}" 
         id="conv-${conversation.sid}" 
         data-sid="${conversation.sid}">
      <div class="conversation-header">
        <div class="unread-indicator-column">
          ${unreadBadge}
        </div>
        <div class="conversation-details">
          <div class="header-left">
            <strong>${displayName}</strong>
            <span class="phone-number">
              ${conversation.attributes?.phoneNumber || ''}
            </span>
          </div>
          <div class="header-right">
            <span class="time">${lastMessageTime}</span>
            <button class="delete-btn" data-sid="${conversation.sid}" 
                    aria-label="Delete Conversation">
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

/**
 * Moves a conversation to the top of the list.
 * 
 * Imagine you have a stack of papers, and you find one that's really important.
 * This function is like taking that important paper and putting it on top of the stack.
 *
 * @param {string} conversationSid - The special code for the conversation to move.
 */
export function moveConversationToTop(conversationSid) {
  const conversationsDiv = document.getElementById('conversations');
  const conversationDiv = document.getElementById(`conv-${conversationSid}`);
  if (conversationDiv && conversationsDiv.firstChild !== conversationDiv) {
    conversationsDiv.insertBefore(conversationDiv, conversationsDiv.firstChild);
  }
}

/**
 * Shows all the messages in the current conversation.
 * 
 * This is like opening a book and seeing all the words on the pages.
 * Each message is like a sentence in the book, and this function
 * puts all those sentences on the screen for you to read.
 *
 * @param {Array} messages - A list of all the messages to show.
 */
export function renderMessages(messages) {
  const messagesContainer = document.getElementById('messages');
  messagesContainer.innerHTML = ''; // Clear existing messages

  messages.forEach((message) => {
    appendMessage(message);
  });

  // Scroll to the bottom of the messages container
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Adds a new message to the screen.
 * 
 * Think of this like adding a new sticker to your sticker book.
 * Each message is a sticker, and this function puts the new sticker
 * in just the right spot in your book.
 *
 * @param {Object} message - All the details about the new message.
 */
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

/**
 * Makes the message input area visible.
 * 
 * It's like opening your toy box so you can get your toys out to play.
 * This function opens up the area where you can type new messages.
 */
export function showMessageInput() {
  document.getElementById('message-input').style.display = 'flex';
}

/**
 * Updates the information at the top of the chat.
 * 
 * Imagine you're playing with a friend and you put their name tag on.
 * This function is like putting the name tag on the chat, so you know
 * who you're talking to and some fun facts about them.
 *
 * @param {string} sid - The special code for this conversation.
 * @param {string} name - The name of the person you're talking to.
 * @param {string} email - Their email address.
 * @param {string} phoneNumber - Their phone number.
 * @param {string} dob - When they were born.
 * @param {string} state - Where they live.
 */
export function updateConversationHeader(
  sid,
  name,
  email,
  phoneNumber,
  dob,
  state,
) {
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
                  <a href="mailto:${email}" 
                  target="_blank" 
                  rel="noopener noreferrer">
                  ${email || 'N/A'}
                  </a>
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
  document
    .getElementById('close-conversation-btn')
    .addEventListener('click', closeConversation);

  // Replace Feather Icons
  feather.replace();
}

/**
 * Sets up hot module replacement (HMR) for this module.
 * 
 * Imagine you're building with Lego, and you can change one piece without
 * knocking down the whole thing. That's what this does for our app!
 * 
 * When the app is running in development mode:
 * 1. It cleans up the old version of this module when it's about to be replaced.
 * 2. It accepts updates to this module and re-initializes the UI.
 * 
 * This helps developers see their changes quickly without refreshing the whole page.
 * 
 * @remarks
 * This code only runs in development mode when HMR is enabled.
 * In production, this entire block is ignored.
 * 
 * @example
 * // This code is typically at the end of a module file
 * if (module['hot']) {
 *   module['hot'].dispose(() => {
 *     // Cleanup code here
 *   });
 *   module['hot'].accept(() => {
 *     // Re-initialization code here
 *   });
 * }
 */
if (module['hot']) {
  module['hot'].dispose(() => {
    // Clean up any event listeners or timers here
    log('Cleaning up UI module');
  });
  module['hot'].accept(() => {
    log('UI module updated');
    // Re-initialize UI if necessary
    initializeApp().catch((error) => {
      console.error('Error re-initializing UI:', error);
    });
  });
}

// Export all necessary functions from the conversations module
export {
  incrementUnreadCount,
  handleNewConversation,
  handleUpdateConversation,
  removeConversationFromUI,
};