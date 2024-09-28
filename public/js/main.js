// main.js
import { initializeApp } from './ui.js';
import { setupEventListeners, closeModal } from './events.js';
import { loadConversations } from './conversations.js';
import { setupWebSocket } from './websocket.js';
import { state } from './state.js';
import { log } from './utils.js';
import { setupCallControls } from './call.js';
import feather from 'feather-icons';

async function initializeApplication() {
  try {
    log('Initializing application...');
    await initializeApp();
    setupEventListeners();
    if (typeof setupCallControls === 'function') {
      setupCallControls();
    }
    setupWebSocket();
    feather.replace();
    state.appInitialized = true;
    log('Application initialization complete');
  } catch (error) {
    console.error('Error during application initialization:', error);
    alert('There was an error initializing the application. Please refresh the page and try again.');
  }
}

document.addEventListener('DOMContentLoaded', initializeApplication);

window.closeModal = closeModal;

window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
});

window.addEventListener('beforeunload', () => {
  log('Application closing');
});

if (module.hot) {
  module.hot.accept([
    './ui.js',
    './events.js',
    './conversations.js',
    './websocket.js',
    './state.js',
    './utils.js',
    './call.js'
  ], () => {
    log('Hot Module Replacement triggered');
    initializeApplication();
  });
}

export { initializeApplication };