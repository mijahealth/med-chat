// public/js/events.js

/**
 * The Event Organizer for Our Chat Playground
 * 
 * Imagine this file is like a friendly robot that helps run our chat playground.
 * It watches for when you want to do things like send a message, start a new chat,
 * or look for a specific conversation. When you do these things, the robot knows
 * exactly what to do to make the playground work just right. It's always ready to
 * help you have fun and talk with your friends in the chat app!
 */

import { api } from './api.js';
import { currentConversation, state } from './state.js';
import {
  debounce,
  log,
  setUserInteracted,
  isValidPhoneNumber,
  isValidName,
  isValidEmail,
  isValidDate,
  isValidState,
  isValidMessage,
} from './utils.js';
import {
  loadConversations,
  updateLatestMessagePreview,
  deleteConversation,
} from './conversations.js';
import { setupCallControls } from './call.js';
import {
  renderConversations,
  updateConversationHeader,
  showMessageInput,
  renderMessages,
  moveConversationToTop,
} from './ui.js';
import feather from 'feather-icons';

let isSelecting = false;

// Constants for magic numbers
const MESSAGE_DISPLAY_DURATION = 3000;
const SEARCH_DEBOUNCE_DELAY = 300;
const SELECT_CONVERSATION_DEBOUNCE_DELAY = 300;

/**
 * Initializes the application by setting up event listeners.
 * 
 * @returns {void}
 */
function initializeApplication() {
  setupEventListeners();
  // Add any other initialization logic here
}

/**
 * Sets up all event listeners for the application.
 * 
 * @returns {void}
 */
export function setupEventListeners() {
  // Send Message on Enter and Button Click
  const newMessageInput = document.getElementById('new-message');
  const sendMessageBtn = document.getElementById('send-message-btn');
  if (newMessageInput && sendMessageBtn) {
    newMessageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSendMessage();
      }
    });
    sendMessageBtn.addEventListener('click', handleSendMessage);
  } else {
    log('New message input or send button not found');
    setupConversationListeners();
  }

  // New Conversation Button
  const newConversationBtn = document.getElementById('new-conversation-btn');
  if (newConversationBtn) {
    newConversationBtn.addEventListener('click', openNewConversationModal);
  } else {
    log('New conversation button not found');
  }

  // Attach event listener to the new conversation form
  const newConversationForm = document.getElementById('new-conversation-form');
  if (newConversationForm) {
    newConversationForm.addEventListener('submit', startConversation);
  } else {
    log('New conversation form not found');
  }

  // Attach event listeners for call controls
  setupCallControls();

  // Setup Search
  setupSearch();

  // Scroll Event for Auto-Scroll
  const messagesDiv = document.getElementById('messages');
  if (messagesDiv) {
    messagesDiv.addEventListener('scroll', checkScrollPosition);
  } else {
    log('Messages div not found');
  }

  // Setup form validation
  setupFormValidation();
}

/**
 * Sets up form validation for the new conversation form.
 * 
 * @returns {void}
 */
function setupFormValidation() {
  const form = document.getElementById('new-conversation-form');
  const inputs = form.querySelectorAll('[data-validate]');

  inputs.forEach((input) => {
    input.addEventListener('input', validateInput);
    input.addEventListener('blur', validateInput);
  });
}

/**
 * Validates a single input field.
 * 
 * @param {Event} event - The input event.
 * @returns {boolean} True if the input is valid, false otherwise.
 */
function validateInput(event) {
  const input = event.target;
  const value = input.value.trim();
  const validationType = input.dataset.validate;
  let isValid = true;
  let errorMessage = '';

  switch (validationType) {
    case 'phone':
      isValid = isValidPhoneNumber(value);
      errorMessage =
        'Please enter a valid phone number in the format +XXXXXXXXXXX';
      break;
    case 'name':
      isValid = isValidName(value);
      errorMessage = 'Name is required';
      break;
    case 'email':
      isValid = isValidEmail(value);
      errorMessage = 'Please enter a valid email address';
      break;
    case 'dob':
      isValid = isValidDate(value);
      errorMessage = 'Please enter a valid date of birth';
      break;
    case 'state':
      isValid = isValidState(value);
      errorMessage = 'State is required';
      break;
    case 'message':
      isValid = isValidMessage(value);
      errorMessage = 'Message is required';
      break;
  }

  const errorElement = document.querySelector(
    `.error-message[data-for="${input.name}"]`,
  );
  if (!isValid) {
    errorElement.textContent = errorMessage;
    input.classList.add('invalid');
  } else {
    errorElement.textContent = '';
    input.classList.remove('invalid');
  }

  return isValid;
}

/**
 * Validates the entire form.
 * 
 * @param {HTMLFormElement} form - The form to validate.
 * @returns {boolean} True if the form is valid, false otherwise.
 */
function validateForm(form) {
  const inputs = form.querySelectorAll('[data-validate]');
  let isValid = true;

  inputs.forEach((input) => {
    if (!validateInput({ target: input })) {
      isValid = false;
    }
  });

  return isValid;
}

/**
 * Handles sending a new message.
 * 
 * @returns {void}
 */
export function handleSendMessage() {
  const inputField = document.getElementById('new-message');
  const message = inputField.value.trim();

  if (message === '') {
    return; // Don't send an empty message
  }

  if (!currentConversation.sid) {
    alert('Please select a conversation before sending a message.');
    return;
  }

  api
    .sendMessage(currentConversation.sid, message)
    .then(() => {
      inputField.value = ''; // Clear the input field after sending the message

      // Show message sent indicator
      const indicator = document.getElementById('message-sent-indicator');
      if (indicator) {
        indicator.textContent = 'Message Sent';
        indicator.classList.add('show');
        setTimeout(() => {
          indicator.classList.remove('show');
        }, MESSAGE_DISPLAY_DURATION); // Hide after 3 seconds
      }

      // Optionally, you can update the conversation preview here
      updateLatestMessagePreview(currentConversation.sid, {
        body: message,
        author: state.TWILIO_PHONE_NUMBER,
        dateCreated: new Date().toISOString(),
      });

      // Move the conversation to the top of the list
      moveConversationToTop(currentConversation.sid);

      // Note: We're not appending the message to the UI here.
      // The WebSocket will handle displaying the message to ensure consistency.
    })
    .catch((error) => {
      console.error('Error sending message:', error);
      // Show error message to the user
      const indicator = document.getElementById('message-sent-indicator');
      if (indicator) {
        indicator.textContent = 'Failed to send message';
        indicator.classList.add('show', 'error');
        setTimeout(() => {
          indicator.classList.remove('show', 'error');
        }, MESSAGE_DISPLAY_DURATION); // Hide after 3 seconds
      }
    });
}

/**
 * Opens the new conversation modal.
 * 
 * @returns {void}
 */
export function openNewConversationModal() {
  clearNewConversationForm();
  document.getElementById('new-conversation-modal').style.display = 'flex';
}

/**
 * Closes the modal.
 * 
 * @returns {void}
 */
export function closeModal() {
  document.getElementById('new-conversation-modal').style.display = 'none';
}

/**
 * Clears the new conversation form.
 * 
 * @returns {void}
 */
function clearNewConversationForm() {
  const form = document.querySelector('#new-conversation-modal form');
  if (form) {
    form.reset();
    form
      .querySelectorAll('.error-message')
      .forEach((el) => (el.textContent = ''));
    form
      .querySelectorAll('.invalid')
      .forEach((el) => el.classList.remove('invalid'));
  }
}

/**
 * Sets up the search functionality.
 * 
 * @returns {void}
 */
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(performSearch, SEARCH_DEBOUNCE_DELAY));
  } else {
    log('Search input not found');
  }
}

/**
 * Performs a search based on the current input.
 * 
 * @returns {Promise<void>}
 */
export async function performSearch() {
  const query = document.getElementById('search-input').value.trim();
  if (query === '') {
    await loadConversations(); // Reset to show all conversations
    return;
  }

  try {
    const results = await api.searchConversations(query);
    renderConversations(results);
  } catch (error) {
    console.error('Error performing search:', error);
  }
}

/**
 * Checks the scroll position of the messages div.
 * 
 * @returns {void}
 */
export function checkScrollPosition() {
  const messagesDiv = document.getElementById('messages');
  if (
    messagesDiv.scrollTop + messagesDiv.clientHeight >=
    messagesDiv.scrollHeight - 10
  ) {
    state.autoScrollEnabled = true;
  } else {
    state.autoScrollEnabled = false;
  }
}

/**
 * Updates the UI for conversation selection.
 * 
 * @returns {void}
 */
function updateUIForConversationSelection() {
  document.getElementById('loading-spinner').style.display = 'block';
  document.getElementById('messages').style.display = 'none';
  document.getElementById('message-input').style.display = 'none';
  document.getElementById('messages-title').style.display = 'flex';
  document.getElementById('no-conversation').style.display = 'none';
}

/**
 * Updates the selected conversation in the UI.
 * 
 * @param {string} sid - The SID of the selected conversation.
 * @returns {void}
 */
function updateConversationSelection(sid) {
  document.querySelectorAll('.conversation').forEach((conv) => {
    conv.classList.remove('selected');
  });
  const selectedConversation = document.getElementById(`conv-${sid}`);
  if (selectedConversation) {
    selectedConversation.classList.add('selected');
    selectedConversation.classList.remove('unread');
    const unreadBadge = selectedConversation.querySelector('.unread-badge');
    if (unreadBadge) {
      unreadBadge.remove();
    }
  }
}

/**
 * Updates the conversation details in the UI.
 * 
 * @param {string} sid - The SID of the conversation.
 * @param {Object} conversation - The conversation object.
 * @returns {void}
 */
function updateConversationDetails(sid, conversation) {
  const attributes = conversation.attributes || {};
  const name = attributes.name || conversation.friendlyName;
  const email = attributes.email || '';
  const phoneNumber = attributes.phoneNumber || '';
  const dob = attributes.dob || '';
  const state = attributes.state || '';

  updateConversationHeader(sid, name, email, phoneNumber, dob, state);
  setupCallControls();
}

/**
 * Fetches and renders messages for a conversation.
 * 
 * @param {string} sid - The SID of the conversation.
 * @returns {Promise<void>}
 */
async function fetchAndRenderMessages(sid) {
  const messages = await api.getMessages(sid, { limit: 1000, order: 'asc' });
  renderMessages(messages);
  document.getElementById('messages').style.display = 'block';
  showMessageInput();
  const messagesDiv = document.getElementById('messages');
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/**
 * Handles errors that occur during conversation selection.
 * 
 * @param {Error} error - The error that occurred.
 * @returns {void}
 */
function handleConversationError(error) {
  console.error('Error in selectConversation:', error);
  if (error.response) {
    log('Error loading conversation', { error: error.response.data });
    alert(`Error: ${error.response.data.error || 'Unknown error occurred.'}`);
  } else {
    log('Error loading conversation', { error: error.message });
    alert(`Error: ${error.message}`);
  }
}

/**
 * Selects a conversation and updates the UI accordingly.
 * 
 * @param {string} sid - The SID of the conversation to select.
 * @returns {Promise<void>}
 */
export const selectConversation = debounce(async (sid) => {
  if (isSelecting || sid === currentConversation.sid) {return;}
  
  isSelecting = true;
  console.log(`selectConversation called with SID: ${sid}`);
  
  if (!state.conversationsLoaded) {
    console.log('Conversations not loaded yet');
    alert('Please wait until conversations are fully loaded.');
    isSelecting = false;
    return;
  }

  setUserInteracted();
  currentConversation.sid = sid;
  console.log(`Current conversation SID set to: ${currentConversation.sid}`);

  updateUIForConversationSelection();

  try {
    console.log('Attempting to fetch conversation details');
    const conversation = await api.getConversationDetails(sid);
    console.log('Conversation details fetched:', conversation);

    updateConversationSelection(sid, conversation);
    updateConversationDetails(sid, conversation);

    if (conversation.unreadCount > 0) {
      api.markMessagesAsRead(sid).catch((error) => {
        log('Error marking messages as read', { error });
      });
    }

    await fetchAndRenderMessages(sid);
  } catch (error) {
    handleConversationError(error);
  } finally {
    document.getElementById('loading-spinner').style.display = 'none';
    isSelecting = false;
  }
}, SELECT_CONVERSATION_DEBOUNCE_DELAY);

/**
 * Closes the current conversation and updates the UI.
 * 
 * @returns {void}
 */
export function closeConversation() {
  const lastConversationSid = currentConversation.sid;
  currentConversation.sid = null;
  document.getElementById('messages-title').innerHTML = '';
  document.getElementById('messages-title').style.display = 'none';
  document.getElementById('messages').innerHTML = '';
  document.getElementById('message-input').style.display = 'none';
  document.getElementById('no-conversation').style.display = 'flex';

  // Deselect conversations
  document.querySelectorAll('.conversation').forEach((conv) => {
    conv.classList.remove('selected');
  });

  // Reload conversations to update previews
  loadConversations();

  // Fetch the latest message if the conversation wasn't deleted
  if (lastConversationSid) {
    updateLatestMessagePreview(lastConversationSid);
  }
}

/**
 * Handles the deletion of a conversation.
 * 
 * @param {string} sid - The SID of the conversation to delete.
 * @returns {Promise<void>}
 */
async function handleDeleteConversation(sid) {
  const deleteButton = document.querySelector(`.delete-btn[data-sid="${sid}"]`);
  if (deleteButton) {
    deleteButton.disabled = true;
    deleteButton.innerHTML =
      '<i data-feather="trash-2" aria-hidden="true"></i> Deleting...';
    feather.replace();

    try {
      await deleteConversation(sid);
      log('Conversation deleted successfully', { sid });
    } catch (error) {
      log('Error deleting conversation', { sid, error });
      alert('Failed to delete conversation. Please try again.');
      deleteButton.disabled = false;
      deleteButton.innerHTML =
        '<i data-feather="trash-2" aria-hidden="true"></i>';
      feather.replace();
    }
  }
}

/**
 * Sets up event listeners for conversation interactions.
 * 
 * @returns {void}
 */
export function setupConversationListeners() {
  const conversationsContainer = document.getElementById('conversations');
  if (conversationsContainer) {
    conversationsContainer.addEventListener('click', (event) => {
      const deleteButton = event.target.closest('.delete-btn');
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        const {sid} = deleteButton.dataset;
        if (sid) {
          handleDeleteConversation(sid);
        }
      } else {
        const conversationElement = event.target.closest('.conversation');
        if (conversationElement) {
          const {sid} = conversationElement.dataset;
          if (sid) {
            selectConversation(sid);
          }
        }
      }
    });
    log('Conversation container click listener added');
  } else {
    log('Conversations container not found');
  }
}

/**
 * Starts a new conversation or opens an existing one.
 * 
 * @param {Event} event - The form submission event.
 * @returns {void}
 */
export function startConversation(event) {
  event.preventDefault();
  const form = event.target;

  if (validateForm(form)) {
    const phoneNumber = form.phoneNumber.value.trim();
    const message = form.message.value.trim();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const dob = form.dob.value.trim();
    const stateField = form.state.value.trim();

    api
      .startConversation({
        phoneNumber,
        message,
        name,
        email,
        dob,
        state: stateField,
      })
      .then(async (response) => {
        if (response.existing) {
          const userConfirmed = confirm(
            'This conversation already exists. Would you like to open it?',
          );
          if (userConfirmed) {
            closeModal();
            selectConversation(response.sid);
          }
        } else {
          await loadConversations();
          closeModal();
          selectConversation(response.sid);
        }
        // Clear the form regardless of whether a new conversation was created or not
        clearNewConversationForm();
      })
      .catch((error) => {
        console.error('Error starting conversation:', error);
        alert('Failed to start a new conversation. Please try again.');
      });
  }
}

// Hot module replacement logic
if (module.hot) {
  module.hot.dispose(() => {
    // Remove all event listeners
    log('Removing event listeners');
    document.removeEventListener('DOMContentLoaded', initializeApplication);
    // Remove other event listeners as necessary
  });
  module.hot.accept(() => {
    log('Events module updated');
    // Re-attach event listeners
    setupEventListeners();
  });
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApplication);
