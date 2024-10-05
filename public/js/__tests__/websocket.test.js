// public/js/__tests__/websocket.test.js
import { setupWebSocket, socket } from '../websocket';
import { handleWebSocketMessage } from '../websocket';
import { handleNewMessage, handleNewConversation, handleUpdateConversation, removeConversationFromUI } from '../messages';
import { log } from '../utils';

jest.mock('../messages');
jest.mock('../utils');

describe('WebSocket Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.WebSocket = require('../../jest/__mocks__/websocket').WebSocketMock;
  });

  test('setupWebSocket establishes a connection', () => {
    setupWebSocket('ws://localhost');

    expect(socket).toBeDefined();
    expect(socket.url).toBe('ws://localhost');
    expect(socket.readyState).toBe(0); // CONNECTING
  });

  test('handleWebSocketMessage processes newMessage correctly', () => {
    const messageData = {
      type: 'newMessage',
      conversationSid: 'conv1',
      messageSid: 'msg1',
      author: '+1234567890',
      body: 'Hello',
    };

    handleWebSocketMessage(messageData);

    expect(handleNewMessage).toHaveBeenCalledWith(messageData);
    expect(log).toHaveBeenCalledWith('New message received', expect.any(Object));
  });

  test('handleWebSocketMessage processes newConversation correctly', () => {
    const messageData = {
      type: 'newConversation',
      conversationSid: 'conv2',
      friendlyName: 'Jane Doe',
      attributes: { phoneNumber: '+0987654321' },
    };

    handleWebSocketMessage(messageData);

    expect(handleNewConversation).toHaveBeenCalledWith(messageData);
    expect(log).toHaveBeenCalledWith('New conversation received', expect.any(Object));
  });

  test('handleWebSocketMessage processes updateConversation correctly', () => {
    const messageData = {
      type: 'updateConversation',
      conversationSid: 'conv1',
      friendlyName: 'John Doe Updated',
      lastMessage: 'Updated message',
      lastMessageTime: '2023-10-05T13:00:00Z',
    };

    handleWebSocketMessage(messageData);

    expect(handleUpdateConversation).toHaveBeenCalledWith(messageData);
    expect(log).toHaveBeenCalledWith('Conversation update received', expect.any(Object));
  });

  test('handleWebSocketMessage processes deleteConversation correctly', () => {
    const messageData = {
      type: 'deleteConversation',
      conversationSid: 'conv1',
    };
    currentConversation.sid = 'conv1';

    handleWebSocketMessage(messageData);

    expect(removeConversationFromUI).toHaveBeenCalledWith('conv1');
    expect(currentConversation.sid).toBeNull();
    expect(log).toHaveBeenCalledWith('Conversation deletion notification received', expect.any(Object));
    // Add assertions for DOM updates if applicable
  });

  test('handleWebSocketMessage handles unknown message types', () => {
    const messageData = {
      type: 'unknownType',
      data: 'Some data',
    };

    handleWebSocketMessage(messageData);

    expect(log).toHaveBeenCalledWith('Unknown WebSocket message type', messageData);
  });

  // Add more tests for different scenarios...
});