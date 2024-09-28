import { currentConversation, state } from './state.js';
import { playNotificationSound, log } from './utils.js';
import { handleNewMessage } from './messages.js';
import {
  handleNewConversation,
  handleUpdateConversation,
  removeConversationFromUI,
} from './conversations.js';

// Constants
const RECONNECT_DELAY = 5000; // in milliseconds

let socket;

export function setupWebSocket() {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    log('WebSocket is already connected or connecting');
    return;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    log('WebSocket connection established');
  };

  socket.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (error) {
      log('Error parsing WebSocket message:', error);
      return;
    }

    handleWebSocketMessage(data);
  };

  socket.onclose = () => {
    log('WebSocket connection closed');
    setTimeout(setupWebSocket, RECONNECT_DELAY); // Attempt to reconnect after 5 seconds
  };

  socket.onerror = (error) => {
    log('WebSocket error:', error);
  };
}

function handleWebSocketMessage(data) {
  log('Received WebSocket message', data);

  switch (data.type) {
    case 'newMessage':
      log('New message received', {
        conversationSid: data.conversationSid,
        messageSid: data.messageSid,
        author: data.author,
        body: data.body,
      });
      handleNewMessage(data);
      break;

    case 'newConversation':
      log('New conversation received', {
        conversationSid: data.conversationSid,
        friendlyName: data.friendlyName,
        attributes: data.attributes,
      });
      handleNewConversation(data);
      break;

    case 'updateConversation':
      log('Conversation update received', {
        conversationSid: data.conversationSid,
        friendlyName: data.friendlyName,
        lastMessage: data.lastMessage,
        lastMessageTime: data.lastMessageTime,
      });
      handleUpdateConversation(data);
      break;

    case 'deleteConversation':
      log('Conversation deletion notification received', {
        conversationSid: data.conversationSid,
      });
      removeConversationFromUI(data.conversationSid);
      if (currentConversation.sid === data.conversationSid) {
        // Clear the current conversation if it was deleted
        currentConversation.sid = null;
        document.getElementById('messages').innerHTML = '';
        document.getElementById('messages-title').innerHTML = '';
        document.getElementById('message-input').style.display = 'none';
        log('Cleared message pane for deleted conversation', {
          conversationSid: data.conversationSid,
        });
      }
      break;

    default:
      log('Unknown WebSocket message type', data);
  }

  // Play notification sound for new messages not from us
  if (data.type === 'newMessage' && data.author !== state.TWILIO_PHONE_NUMBER) {
    playNotificationSound();
  }
}

// Export the socket for potential use in other modules
export { socket };