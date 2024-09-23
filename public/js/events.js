// public/js/events.js
import { api } from './api.js';
import { currentConversation, state } from './state.js';
import { playNotificationSound, isValidDate, debounce, log, toggleTheme } from './utils.js';
import { selectConversation, loadConversations } from './conversations.js';
import { setupCallControls } from './call.js';
import feather from 'feather-icons';
import { isValidDate } from './utils.js';

export function setupEventListeners() {
  // User interaction tracking for sound notifications
  document.addEventListener('click', () => {
    state.userInteracted = true;
  });

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
  }

  // Theme Toggle Button
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  } else {
    log('Theme toggle button not found');
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

function handleSendMessage() {
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

function openNewConversationModal() {
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

function startConversation(event) {
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
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'search-input';
  searchInput.placeholder = 'Search conversations...';
  searchInput.classList.add('search-input');

  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.insertBefore(searchInput, sidebar.firstChild);
    searchInput.addEventListener('input', debounce(performSearch, 300));
  } else {
    log('Sidebar not found for search input');
  }
}

async function performSearch() {
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

function checkScrollPosition() {
  const messagesDiv = document.getElementById('messages');
  if (messagesDiv.scrollTop + messagesDiv.clientHeight >= messagesDiv.scrollHeight - 10) {
    state.autoScrollEnabled = true;
  } else {
    state.autoScrollEnabled = false;
  }
}