/**
 * ELI5 Summary:
 * This file sets up a special phone line (WebSocket) between your computer and a server.
 * It listens for different types of messages, like new chat messages or updates to conversations.
 * When it receives a message, it figures out what type it is and does the right thing with it,
 * like showing a new message or updating a conversation on your screen.
 */

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

/**
 * Sets up the WebSocket connection.
 * ELI5: This function creates a special phone line to talk to the server.
 * If the line is already working, it doesn't do anything.
 * If the line gets cut, it tries to call back after a short wait.
 * 
 * @param {string} [server] The WebSocket server URL to connect to. If not provided, it will use the current window's location to create the connection.
 */
export function setupWebSocket(server) {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    log('WebSocket is already connected or connecting');
    return;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = server || `${protocol}//${window.location.host}`;
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
    setTimeout(() => setupWebSocket(server), RECONNECT_DELAY);
  };

  socket.onerror = (error) => {
    log('WebSocket error:', error);
  };
}

/**
 * Handles incoming WebSocket messages.
 * ELI5: This function is like a mail sorter. It looks at each message that comes in,
 * figures out what kind of message it is, and then sends it to the right place to be dealt with.
 * 
 * @param {Object} data The parsed message data from the WebSocket.
 * @param {string} data.type The type of the message (e.g., 'newMessage', 'newConversation').
 * @param {string} [data.conversationSid] The unique identifier for the conversation.
 * @param {string} [data.messageSid] The unique identifier for the message.
 * @param {string} [data.author] The author of the message.
 * @param {string} [data.body] The content of the message.
 * @param {string} [data.friendlyName] The friendly name of the conversation.
 * @param {Object} [data.attributes] Additional attributes of the conversation.
 * @param {string} [data.lastMessage] The last message in the conversation.
 * @param {string} [data.lastMessageTime] The timestamp of the last message.
 */
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

if (module.hot) {
  module.hot.dispose(() => {
    log('Closing WebSocket connection');
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
  });
  module.hot.accept(() => {
    log('WebSocket module updated');
    setupWebSocket();
  });
}

// Export the socket for potential use in other modules
export { socket };