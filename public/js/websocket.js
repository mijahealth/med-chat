// public/js/websocket.js
import { currentConversation, state } from './state.js';
import { playNotificationSound, log } from './utils.js';
import { handleNewMessage } from './messages.js';
import {
  handleNewConversation,
  handleUpdateConversation,
  removeConversationFromUI,
} from './conversations.js';

export function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.onopen = () => {
    log('WebSocket connection established');
  };

  socket.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      return;
    }

    handleWebSocketMessage(data);
  };

  socket.onclose = () => {
    log('WebSocket connection closed');
    setTimeout(setupWebSocket, 5000); // Attempt to reconnect after 5 seconds
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'newMessage':
      handleNewMessage(data);
      break;
    case 'newConversation':
      handleNewConversation(data);
      break;
    case 'updateConversation':
      handleUpdateConversation(data);
      break;
    case 'deleteConversation':
      removeConversationFromUI(data.conversationSid);
      break;
    default:
      log('Unknown WebSocket message type:', data);
  }
}