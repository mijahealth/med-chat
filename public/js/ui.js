// public/js/ui.js
import { setupEventListeners } from './events.js';
import { loadConversations } from './conversations.js';
import { setupWebSocket } from './websocket.js';
import { state } from './state.js';
import { api } from './api.js';
import { log } from './utils.js';
import feather from 'feather-icons';

export async function initializeApp() {
  try {
    // Fetch configuration from the server
    const config = await api.getConfig();
    state.TWILIO_PHONE_NUMBER = config.TWILIO_PHONE_NUMBER;
    state.NGROK_URL = config.NGROK_URL;

    setupEventListeners();
    await loadConversations();
    setupWebSocket();
    showNoConversationSelected();
  } catch (error) {
    log('Error initializing app', { error });
  }
  feather.replace(); // Replace all Feather icons after the app is initialized
}

export function showNoConversationSelected() {
  document.getElementById('messages-title').style.display = 'none';
  document.getElementById('no-conversation').style.display = 'flex';
  // Clear any existing conversation details
  document.getElementById('messages').innerHTML = '';
  document.getElementById('message-input').style.display = 'none';
}