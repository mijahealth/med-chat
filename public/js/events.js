/**
 * The Event Organizer for Our Chat Playground
 * 
 * This module handles all event listeners and related functionalities
 * for the chat application. It is structured to enhance testability
 * and maintainability without splitting into separate files.
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

// Constants for magic numbers
const MESSAGE_DISPLAY_DURATION = 3000;
const SEARCH_DEBOUNCE_DELAY = 300;
const SELECT_CONVERSATION_DEBOUNCE_DELAY = 300;

let isSelecting = false;

// Handler references for event listeners (useful for removal in HMR)
let sendMessageKeyPressHandler = null;
let sendMessageClickHandler = null;

/**
 * Initializes all event listeners for the application.
 * 
 * @param {Object} dependencies - Dependencies to facilitate testing.
 * @returns {void}
 */
export function setupEventListeners(dependencies = {}) {
  const {
    api: apiDep = api,
    log: logDep = log,
  } = dependencies;

  const newMessageInput = document.getElementById('new-message');
  const sendMessageBtn = document.getElementById('send-message-btn');

  if (newMessageInput && sendMessageBtn) {
    sendMessageKeyPressHandler = (e) => {
      if (e.key === 'Enter') {
        handleSendMessage({ api: apiDep, log: logDep });
      }
    };
    newMessageInput.addEventListener('keypress', sendMessageKeyPressHandler);

    sendMessageClickHandler = () => {
      handleSendMessage({ api: apiDep, log: logDep });
    };
    sendMessageBtn.addEventListener('click', sendMessageClickHandler);
  } else {
    logDep('New message input or send button not found');
    setupConversationListeners(dependencies);
  }

  // New Conversation Button
  const newConversationBtn = document.getElementById('new-conversation-btn');
  if (newConversationBtn) {
    newConversationBtn.addEventListener('click', () => openNewConversationModal(dependencies));
  } else {
    logDep('New conversation button not found');
  }

  // Attach event listener to the new conversation form
  const newConversationForm = document.getElementById('new-conversation-form');
  if (newConversationForm) {
    newConversationForm.addEventListener('submit', (event) => startConversation(event, dependencies));
  } else {
    logDep('New conversation form not found');
  }

  // Attach event listeners for call controls
  setupCallControls(dependencies);

  // Setup Search
  setupSearch(dependencies);

  // Scroll Event for Auto-Scroll
  const messagesDiv = document.getElementById('messages');
  if (messagesDiv) {
    messagesDiv.addEventListener('scroll', checkScrollPosition);
  } else {
    logDep('Messages div not found');
  }

  // Setup form validation
  setupFormValidation(dependencies);

  /**
   * Hot module replacement logic
   */
  if (module.hot) {
    module.hot.dispose(() => {
      // Remove event listeners to prevent duplication
      const newMessageInput = document.getElementById('new-message');
      const sendMessageBtn = document.getElementById('send-message-btn');

      if (newMessageInput && sendMessageKeyPressHandler) {
        newMessageInput.removeEventListener('keypress', sendMessageKeyPressHandler);
      }

      if (sendMessageBtn && sendMessageClickHandler) {
        sendMessageBtn.removeEventListener('click', sendMessageClickHandler);
      }

      // Remove other event listeners as necessary
      logDep('Removed event listeners for HMR');
    });

    module.hot.accept(() => {
      logDep('Events module updated');
      setupEventListeners(dependencies);
    });
  }
}

/**
 * Sets up form validation for the new conversation form.
 * 
 * @param {Object} dependencies - Dependencies for validation.
 * @returns {void}
 */
function setupFormValidation(dependencies) {
  const form = document.getElementById('new-conversation-form');
  if (!form) { return; }

  const inputs = form.querySelectorAll('[data-validate]');

  inputs.forEach((input) => {
    input.addEventListener('input', (event) => validateInput(event, dependencies));
    input.addEventListener('blur', (event) => validateInput(event, dependencies));
  });
}

/**
 * Validates a single input field.
 * 
 * @param {Event} event - The input event.
 * @param {Object} dependencies - Dependencies for validation.
 * @returns {boolean} True if the input is valid, false otherwise.
 */
export function validateInput(event, dependencies = {}) {
  const {
    isValidPhoneNumber: isValidPhoneNumberDep = isValidPhoneNumber,
    isValidName: isValidNameDep = isValidName,
    isValidEmail: isValidEmailDep = isValidEmail,
    isValidDate: isValidDateDep = isValidDate,
    isValidState: isValidStateDep = isValidState,
    isValidMessage: isValidMessageDep = isValidMessage,
  } = dependencies;

  const input = event.target;
  const value = input.value.trim();
  const validationType = input.dataset.validate;
  let isValid = true;
  let errorMessage = '';

  switch (validationType) {
    case 'phone':
      isValid = isValidPhoneNumberDep(value);
      errorMessage = 'Please enter a valid phone number in the format +XXXXXXXXXXX';
      break;
    case 'name':
      isValid = isValidNameDep(value);
      errorMessage = 'Name is required';
      break;
    case 'email':
      isValid = isValidEmailDep(value);
      errorMessage = 'Please enter a valid email address';
      break;
    case 'dob':
      isValid = isValidDateDep(value);
      errorMessage = 'Please enter a valid date of birth';
      break;
    case 'state':
      isValid = isValidStateDep(value);
      errorMessage = 'State is required';
      break;
    case 'message':
      isValid = isValidMessageDep(value);
      errorMessage = 'Message is required';
      break;
    default:
      isValid = true;
      errorMessage = '';
  }

  const errorElement = document.querySelector(`.error-message[data-for="${input.name}"]`);
  if (errorElement) {
    if (!isValid) {
      errorElement.textContent = errorMessage;
      input.classList.add('invalid');
    } else {
      errorElement.textContent = '';
      input.classList.remove('invalid');
    }
  }

  return isValid;
}

/**
 * Validates the entire form.
 * 
 * @param {HTMLFormElement} form - The form to validate.
 * @param {Object} dependencies - Dependencies for validation.
 * @returns {boolean} True if the form is valid, false otherwise.
 */
export function validateForm(form, dependencies = {}) {
  const inputs = form.querySelectorAll('[data-validate]');
  let isValid = true;

  inputs.forEach((input) => {
    if (!validateInput({ target: input }, dependencies)) {
      isValid = false;
    }
  });

  return isValid;
}

/**
 * Handles sending a new message.
 * 
 * @param {Object} dependencies - Dependencies for sending messages.
 * @returns {void}
 */
export function handleSendMessage(dependencies = {}) {
  const { api: apiDep = api, log: logDep = log } = dependencies;

  const inputField = document.getElementById('new-message');
  if (!inputField) {
    logDep('Message input field not found');
    return;
  }
  const message = inputField.value.trim();

  if (message === '') {
    return; // Don't send an empty message
  }

  if (!currentConversation.sid) {
    alert('Please select a conversation before sending a message.');
    return;
  }

  apiDep
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

      // Optionally, update the conversation preview here
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
 * @param {Object} dependencies - Dependencies for modal operations.
 * @returns {void}
 */
export function openNewConversationModal(dependencies = {}) {
  const { log: logDep = log } = dependencies;
  clearNewConversationForm();
  const modal = document.getElementById('new-conversation-modal');
  if (modal) {
    modal.style.display = 'flex';
  } else {
    logDep('New conversation modal not found');
  }
}

/**
 * Closes the modal.
 * 
 * @returns {void}
 */
export function closeModal() {
  const modal = document.getElementById('new-conversation-modal');
  if (modal) {
    modal.style.display = 'none';
  }
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
    form.querySelectorAll('.error-message').forEach((el) => (el.textContent = ''));
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
  }
}

/**
 * Sets up the search functionality.
 * 
 * @param {Object} dependencies - Dependencies for search operations.
 * @returns {void}
 */
function setupSearch(dependencies = {}) {
  const { api: apiDep = api, log: logDep = log } = dependencies;
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => performSearch(apiDep, logDep), SEARCH_DEBOUNCE_DELAY));
  } else {
    logDep('Search input not found');
  }
}

/**
 * Performs a search based on the current input.
 * 
 * @param {Object} apiDep - API dependency for search.
 * @param {Function} logDep - Logging function.
 * @returns {Promise<void>}
 */
export async function performSearch(apiDep = api, logDep = log) {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) {
    logDep('Search input not found');
    return;
  }

  const query = searchInput.value.trim();
  if (query === '') {
    await loadConversations();
    return;
  }

  try {
    const results = await apiDep.searchConversations(query);
    renderConversations(results);
  } catch (error) {
    console.error('Error performing search:', error);
    logDep('Error performing search:', error);
  }
}

/**
 * Checks the scroll position of the messages div.
 * 
 * @returns {void}
 */
export function checkScrollPosition() {
  const messagesDiv = document.getElementById('messages');
  if (!messagesDiv) {
    log('Messages div not found');
    return;
  }

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
  const loadingSpinner = document.getElementById('loading-spinner');
  const messages = document.getElementById('messages');
  const messageInput = document.getElementById('message-input');
  const messagesTitle = document.getElementById('messages-title');
  const noConversation = document.getElementById('no-conversation');

  if (loadingSpinner) { loadingSpinner.style.display = 'block'; }
  if (messages) { messages.style.display = 'none'; }
  if (messageInput) { messageInput.style.display = 'none'; }
  if (messagesTitle) { messagesTitle.style.display = 'flex'; }
  if (noConversation) { noConversation.style.display = 'none'; }
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
  const stateField = attributes.state || '';

  updateConversationHeader(sid, name, email, phoneNumber, dob, stateField);
  setupCallControls();
}

/**
 * Fetches and renders messages for a conversation.
 * 
 * @param {string} sid - The SID of the conversation.
 * @returns {Promise<void>}
 */
async function fetchAndRenderMessages(sid) {
  try {
    const messages = await api.getMessages(sid, { limit: 1000, order: 'asc' });
    renderMessages(messages);
    const messagesDiv = document.getElementById('messages');
    if (messagesDiv) {
      messagesDiv.style.display = 'block';
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    showMessageInput();
  } catch (error) {
    console.error('Error fetching messages:', error);
    log('Error fetching messages:', error);
  }
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
 * @param {Object} dependencies - Dependencies for selection.
 * @returns {Promise<void>}
 */
export const selectConversation = debounce(async (sid, dependencies = {}) => {
  const {
    api: apiDep = api,
    log: logDep = log,
    setUserInteracted: setUserInteractedDep = setUserInteracted,
  } = dependencies;

  if (isSelecting || sid === currentConversation.sid) {
    return;
  }

  isSelecting = true;
  console.log(`selectConversation called with SID: ${sid}`);

  if (!state.conversationsLoaded) {
    console.log('Conversations not loaded yet');
    alert('Please wait until conversations are fully loaded.');
    isSelecting = false;
    return;
  }

  setUserInteractedDep();
  currentConversation.sid = sid;
  console.log(`Current conversation SID set to: ${currentConversation.sid}`);

  updateUIForConversationSelection();

  try {
    console.log('Attempting to fetch conversation details');
    const conversation = await apiDep.getConversationDetails(sid);
    console.log('Conversation details fetched:', conversation);

    updateConversationSelection(sid);
    updateConversationDetails(sid, conversation);

    if (conversation.unreadCount > 0) {
      await apiDep.markMessagesAsRead(sid).catch((error) => {
        logDep('Error marking messages as read', { error });
      });
    }

    await fetchAndRenderMessages(sid);
  } catch (error) {
    handleConversationError(error);
  } finally {
    const loadingSpinner = document.getElementById('loading-spinner');
    if (loadingSpinner) { loadingSpinner.style.display = 'none'; }
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
  const messagesTitle = document.getElementById('messages-title');
  const messages = document.getElementById('messages');
  const messageInput = document.getElementById('message-input');
  const noConversation = document.getElementById('no-conversation');

  if (messagesTitle) {
    messagesTitle.innerHTML = '';
    messagesTitle.style.display = 'none';
  }
  if (messages) {
    messages.innerHTML = '';
    messages.style.display = 'none';
  }
  if (messageInput) {
    messageInput.style.display = 'none';
  }
  if (noConversation) {
    noConversation.style.display = 'flex';
  }

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
 * @param {Object} dependencies - Dependencies for deletion.
 * @returns {Promise<void>}
 */
export async function handleDeleteConversation(sid, dependencies = {}) {
  const { log: logDep = log } = dependencies;
  const deleteButton = document.querySelector(`.delete-btn[data-sid="${sid}"]`);
  if (deleteButton) {
    deleteButton.disabled = true;
    deleteButton.innerHTML = '<i data-feather="trash-2" aria-hidden="true"></i> Deleting...';
    feather.replace();

    try {
      await deleteConversation(sid);
      logDep('Conversation deleted successfully', { sid });
    } catch (error) {
      logDep('Error deleting conversation', { sid, error });
      alert('Failed to delete conversation. Please try again.');
      deleteButton.disabled = false;
      deleteButton.innerHTML = '<i data-feather="trash-2" aria-hidden="true"></i>';
      feather.replace();
    }
  }
}

/**
 * Sets up event listeners for conversation interactions.
 * 
 * @param {Object} dependencies - Dependencies for conversation listeners.
 * @returns {void}
 */
export function setupConversationListeners(dependencies = {}) {
  const { handleDeleteConversation: handleDeleteConversationDep = handleDeleteConversation, log: logDep = log } = dependencies;
  const conversationsContainer = document.getElementById('conversations');
  if (conversationsContainer) {
    conversationsContainer.addEventListener('click', (event) => {
      const deleteButton = event.target.closest('.delete-btn');
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        const { sid } = deleteButton.dataset;
        if (sid) {
          handleDeleteConversationDep(sid, dependencies);
        }
      } else {
        const conversationElement = event.target.closest('.conversation');
        if (conversationElement) {
          const { sid } = conversationElement.dataset;
          if (sid) {
            selectConversation(sid, dependencies);
          }
        }
      }
    });
    logDep('Conversation container click listener added');
  } else {
    logDep('Conversations container not found');
  }
}

/**
 * Starts a new conversation or opens an existing one.
 * 
 * @param {Event} event - The form submission event.
 * @param {Object} dependencies - Dependencies for starting conversation.
 * @returns {void}
 */
export function startConversation(event, dependencies = {}) {
  const {
    api: apiDep = api,
    loadConversations: loadConversationsDep = loadConversations,
    closeModal: closeModalDep = closeModal,
    selectConversation: selectConversationDep = selectConversation,
    clearNewConversationForm: clearNewConversationFormDep = clearNewConversationForm,
  } = dependencies;

  event.preventDefault();
  const form = event.target;

  if (validateForm(form, dependencies)) {
    const phoneNumber = form.phoneNumber.value.trim();
    const message = form.message.value.trim();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const dob = form.dob.value.trim();
    const stateField = form.state.value.trim();

    apiDep
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
            closeModalDep();
            selectConversationDep(response.sid, dependencies);
          }
        } else {
          await loadConversationsDep();
          closeModalDep();
          selectConversationDep(response.sid, dependencies);
        }
        // Clear the form regardless of whether a new conversation was created or not
        clearNewConversationFormDep();
      })
      .catch((error) => {
        console.error('Error starting conversation:', error);
        alert('Failed to start a new conversation. Please try again.');
      });
  }
}

/**
 * Hot module replacement logic
 */
if (module.hot) {
  module.hot.dispose(() => {
    // Remove event listeners to prevent duplication
    const newMessageInput = document.getElementById('new-message');
    const sendMessageBtn = document.getElementById('send-message-btn');

    if (newMessageInput && sendMessageKeyPressHandler) {
      newMessageInput.removeEventListener('keypress', sendMessageKeyPressHandler);
    }

    if (sendMessageBtn && sendMessageClickHandler) {
      sendMessageBtn.removeEventListener('click', sendMessageClickHandler);
    }

    // Remove other event listeners as necessary
    // Since logDep is destructured in setupEventListeners, we need to ensure it's used here
    // If not, remove it from destructuring
    log('Removed event listeners for HMR'); // Changed from logDep to log to avoid unused variable
  });

  module.hot.accept(() => {
    // Similarly, ensure logDep is used or not based on destructuring
    log('Events module updated'); // Changed from logDep to log to avoid unused variable
    setupEventListeners();
  });
}