// public/js/events.js

import { api } from './api.js';
import { currentConversation, state } from './state.js';
import { playNotificationSound, isValidDate, debounce, log, toggleTheme,setUserInteracted} from './utils.js';
import { loadConversations, updateLatestMessagePreview, deleteConversation } from './conversations.js';
import { setupCallControls } from './call.js';
import { 
  renderConversations, 
  updateConversationHeader, 
  showMessageInput, 
  renderMessages,
  moveConversationToTop 
} from './ui.js';
import feather from 'feather-icons';

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
}

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

  api.sendMessage(currentConversation.sid, message)
    .then(() => {
      inputField.value = ''; // Clear the input field after sending the message
      
      // Show message sent indicator
      const indicator = document.getElementById('message-sent-indicator');
      if (indicator) {
        indicator.textContent = 'Message Sent';
        indicator.classList.add('show');
        setTimeout(() => {
          indicator.classList.remove('show');
        }, 3000); // Hide after 3 seconds
      }

      // Optionally, you can update the conversation preview here
      updateLatestMessagePreview(currentConversation.sid, {
        body: message,
        author: state.TWILIO_PHONE_NUMBER,
        dateCreated: new Date().toISOString()
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
        }, 3000); // Hide after 3 seconds
      }
    });
}

export function openNewConversationModal() {
  clearNewConversationForm();
  document.getElementById('new-conversation-modal').style.display = 'flex';
}

export function closeModal() {
  document.getElementById('new-conversation-modal').style.display = 'none';
}

function clearNewConversationForm() {
  const form = document.querySelector('#new-conversation-modal form');
  if (form) {
    form.reset();
  }
}

export function startConversation(event) {
  event.preventDefault();
  const form = event.target;
  const phoneNumber = form.phoneNumber.value.trim();
  const message = form.message.value.trim();
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const dob = form.dob.value.trim();
  const stateField = form.state.value.trim();

  // Additional validation
  if (!/^\+[0-9]{10,15}$/.test(phoneNumber)) {
    alert('Please enter a valid phone number in the format +XXXXXXXXXXX');
    return;
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('Please enter a valid email address');
    return;
  }

  if (dob && !isValidDate(dob)) {
    alert('Please enter a valid date of birth');
    return;
  }

  if (phoneNumber && message && name) {
    api.startConversation({ phoneNumber, message, name, email, dob, state: stateField })
      .then(async (response) => {
        if (response.existing) {
          const userConfirmed = confirm(
            'This conversation already exists. Would you like to open it?'
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
  } else {
    alert('Please fill in all required fields.');
  }
}

function setupSearch() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(performSearch, 300));
  } else {
    log('Search input not found');
  }
}

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

export function checkScrollPosition() {
  const messagesDiv = document.getElementById('messages');
  if (messagesDiv.scrollTop + messagesDiv.clientHeight >= messagesDiv.scrollHeight - 10) {
    state.autoScrollEnabled = true;
  } else {
    state.autoScrollEnabled = false;
  }
}

export async function selectConversation(sid) {
  console.log(`selectConversation called with SID: ${sid}`);
  if (!state.conversationsLoaded) {
    console.log('Conversations not loaded yet');
    alert('Please wait until conversations are fully loaded.');
    return;
  } 
  setUserInteracted(); 
  currentConversation.sid = sid;
  console.log(`Current conversation SID set to: ${currentConversation.sid}`);

  document.getElementById('loading-spinner').style.display = 'block';
  document.getElementById('messages').style.display = 'none';
  document.getElementById('message-input').style.display = 'none';
  document.getElementById('messages-title').style.display = 'flex';
  document.getElementById('no-conversation').style.display = 'none';

  try {
    console.log('Attempting to fetch conversation details');
    const conversation = await api.getConversationDetails(sid);
    console.log('Conversation details fetched:', conversation);

    // Deselect other conversations
    document.querySelectorAll('.conversation').forEach((conv) => {
      conv.classList.remove('selected');
    });
    const selectedConversation = document.getElementById(`conv-${sid}`);
    if (selectedConversation) {
      selectedConversation.classList.add('selected');

      // Remove unread indicators immediately
      selectedConversation.classList.remove('unread');
      const unreadBadge = selectedConversation.querySelector('.unread-badge');
      if (unreadBadge) {
        unreadBadge.remove();
      }
    }

    const attributes = conversation.attributes || {};

    // Conditionally call mark-read without awaiting
    if (conversation.unreadCount > 0) {
      api.markMessagesAsRead(sid).catch((error) => {
        log('Error marking messages as read', { error });
      });
    }

    const name = attributes.name || conversation.friendlyName;
    const email = attributes.email || '';
    const phoneNumber = attributes.phoneNumber || '';
    const dob = attributes.dob || '';
    const state = attributes.state || '';

    // Update the conversation header and call controls
    updateConversationHeader(sid, name, email, phoneNumber, dob, state);
    // **Attach event listeners to the new call buttons**
    setupCallControls();


    // Fetch and render messages
    const messages = await api.getMessages(sid, { limit: 1000, order: 'asc' });
    renderMessages(messages);
    
    document.getElementById('messages').style.display = 'block';
    showMessageInput();

    // Scroll to bottom of messages
    const messagesDiv = document.getElementById('messages');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

  } catch (error) {
    console.error('Error in selectConversation:', error);
    if (error.response) {
      log('Error loading conversation', { error: error.response.data });
      alert(`Error: ${error.response.data.error || 'Unknown error occurred.'}`);
    } else {
      log('Error loading conversation', { error: error.message });
      alert(`Error: ${error.message}`);
    }
  } finally {
    document.getElementById('loading-spinner').style.display = 'none';
  }
}

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

function handleDeleteConversation(sid) {
  if (confirm('Are you sure you want to delete this conversation?')) {
    deleteConversation(sid)
      .then(() => {
        if (currentConversation.sid === sid) {
          closeConversation();
        }
      })
      .catch((error) => {
        console.error('Error deleting conversation:', error);
        alert('Failed to delete conversation. Please try again.');
      });
  }
}

export function setupConversationListeners() {
  const conversationsContainer = document.getElementById('conversations');
  if (conversationsContainer) {
    conversationsContainer.addEventListener('click', handleConversationClick);
  } else {
    console.error('Conversations container not found');
  }
}

function handleConversationClick(event) {
  const conversationElement = event.target.closest('.conversation');
  if (conversationElement && !event.target.closest('.delete-btn')) {
    event.preventDefault();
    const sid = conversationElement.dataset.sid;
    selectConversation(sid);
  }
}