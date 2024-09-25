// main.js

import { initializeApp } from './ui.js';
import { setupEventListeners, closeModal } from './events.js';
import { loadConversations } from './conversations.js';
import { setupWebSocket } from './websocket.js';
import { state } from './state.js';
import { log } from './utils.js';
import feather from 'feather-icons';

// main.js

async function initializeApplication() {
  try {
    log('Initializing application...');

    // Initialize the UI
    await initializeApp();
    log('UI initialized');

    // Setup event listeners
    setupEventListeners();
    log('Event listeners set up');

    // Load conversations
    await loadConversations();
    log('Conversations loaded');

    // Setup WebSocket connection (only once)
    setupWebSocket();
    log('WebSocket connection established');

    // Replace Feather icons
    feather.replace();
    log('Feather icons replaced');

    // Set the application as initialized
    state.appInitialized = true;
    log('Application initialization complete');

  } catch (error) {
    console.error('Error during application initialization:', error);
    alert('There was an error initializing the application. Please refresh the page and try again.');
  }
}

// Make closeModal globally available for use in HTML onclick attributes
window.closeModal = closeModal;

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApplication);

// Handle any uncaught errors
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  // You might want to log this error to your server or show a user-friendly error message
});

// Optionally, you can add a cleanup function to be called when the window is closing
window.addEventListener('beforeunload', () => {
  // Perform any necessary cleanup here
  log('Application closing');
});

// If you need to expose any functions or objects globally, you can do so here
// window.someGlobalFunction = someFunction;

// If you have any environment-specific configurations, you can set them up here
// if (process.env.NODE_ENV === 'development') {
//   // Set up development-specific configurations
// }

export {
  initializeApplication
}; 