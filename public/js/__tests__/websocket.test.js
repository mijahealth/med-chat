// public/js/__tests__/websocket.test.js

// Mock the dependent modules first
jest.mock('../state', () => ({
    currentConversation: { sid: null },
    state: {
      TWILIO_PHONE_NUMBER: '+1234567890',
    },
  }));
  
  jest.mock('../utils', () => ({
    playNotificationSound: jest.fn(),
    log: jest.fn(),
  }));
  
  jest.mock('../messages', () => ({
    handleNewMessage: jest.fn(),
  }));
  
  jest.mock('../conversations', () => ({
    handleNewConversation: jest.fn(),
    handleUpdateConversation: jest.fn(),
    removeConversationFromUI: jest.fn(),
  }));
  
  describe('WebSocket Module', () => {
    let mockSocket;
    let setupClientWebSocket;
    let handleWebSocketMessage;
    let log;
    let playNotificationSound;
    let handleNewMessage;
    let handleNewConversation;
    let handleUpdateConversation;
    let removeConversationFromUI;
  
    // Define a MockWebSocket class
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        this.send = jest.fn();
        this.close = jest.fn();
        this.onopen = null;
        this.onerror = null;
        this.onmessage = null;
        this.onclose = null;
      }
  
      // Constants to mimic WebSocket readyState
      static get CONNECTING() { return 0; }
      static get OPEN() { return 1; }
      static get CLOSING() { return 2; }
      static get CLOSED() { return 3; }
  
      // Helper methods to simulate events
      triggerOpen() {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) this.onopen();
      }
  
      triggerError(error) {
        if (this.onerror) this.onerror(error);
      }
  
      triggerMessage(data) {
        if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
      }
  
      triggerClose() {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) this.onclose();
      }
    }
  
    beforeEach(() => {
      // Reset module registry
      jest.resetModules();
  
      // Create a new MockWebSocket instance
      mockSocket = new MockWebSocket('wss://example.com');
  
      // Mock the global WebSocket constructor
      global.WebSocket = jest.fn(() => mockSocket);
  
      // Now require the module under test
      const websocket = require('../websocket');
      setupClientWebSocket = websocket.setupClientWebSocket;
      handleWebSocketMessage = websocket.handleWebSocketMessage;
  
      // Import the mocked modules
      const mockedState = require('../state');
      const utils = require('../utils');
      const messages = require('../messages');
      const conversations = require('../conversations');
  
      // Assign the mocked functions to variables for easy access
      log = utils.log;
      playNotificationSound = utils.playNotificationSound;
      handleNewMessage = messages.handleNewMessage;
      handleNewConversation = conversations.handleNewConversation;
      handleUpdateConversation = conversations.handleUpdateConversation;
      removeConversationFromUI = conversations.removeConversationFromUI;
  
      // Clear previous mock calls and implementations
      jest.clearAllMocks();
  
      // Mock document methods to prevent errors during DOM manipulations
      document.getElementById = jest.fn().mockReturnValue({
        style: {},
        innerHTML: '',
      });
  
      document.body.removeChild = jest.fn();
    });
  
    afterEach(() => {
      // Restore the original WebSocket after each test
      delete global.WebSocket;
      jest.clearAllMocks();
    });
  
    describe('setupClientWebSocket', () => {
      it('should create a new WebSocket connection', () => {
        setupClientWebSocket('wss://example.com');
        expect(global.WebSocket).toHaveBeenCalledWith('wss://example.com');
      });

      it('should set up onopen handler', () => {
        setupClientWebSocket('wss://example.com');
        expect(mockSocket.onopen).toBeDefined();
        // Simulate the open event
        mockSocket.triggerOpen();
        expect(log).toHaveBeenCalledWith('WebSocket connection established');
      });
  
      it('should set up onerror handler', () => {
        setupClientWebSocket('wss://example.com');
        expect(mockSocket.onerror).toBeDefined();
        // Simulate an error event
        mockSocket.triggerError('Test error');
        expect(log).toHaveBeenCalledWith('WebSocket error:', 'Test error');
      });
    });
  
    describe('handleWebSocketMessage', () => {
      it('should handle new message', () => {
        const messageData = {
          type: 'newMessage',
          conversationSid: 'conv123',
          messageSid: 'msg123',
          author: 'Alice',
          body: 'Hello!',
        };
        handleWebSocketMessage(messageData);
        expect(handleNewMessage).toHaveBeenCalledWith(messageData);
      });
  
      it('should handle new conversation', () => {
        const conversationData = {
          type: 'newConversation',
          conversationSid: 'conv123',
          friendlyName: 'New Chat',
          attributes: {},
        };
        handleWebSocketMessage(conversationData);
        expect(handleNewConversation).toHaveBeenCalledWith(conversationData);
      });
  
      it('should handle conversation update', () => {
        const updateData = {
          type: 'updateConversation',
          conversationSid: 'conv123',
          friendlyName: 'Updated Chat',
          lastMessage: 'New message',
          lastMessageTime: '2023-05-01T12:00:00Z',
        };
        handleWebSocketMessage(updateData);
        expect(handleUpdateConversation).toHaveBeenCalledWith(updateData);
      });
  
      it('should handle conversation deletion', () => {
        const deleteData = {
          type: 'deleteConversation',
          conversationSid: 'conv123',
        };
        handleWebSocketMessage(deleteData);
        expect(removeConversationFromUI).toHaveBeenCalledWith('conv123');
      });
  
      it('should play notification sound for new messages not from us', () => {
        const messageData = {
          type: 'newMessage',
          author: 'Alice',
          conversationSid: 'conv123',
        };
        handleWebSocketMessage(messageData);
        expect(playNotificationSound).toHaveBeenCalled();
      });
  
      it('should not play notification sound for messages from us', () => {
        const messageData = {
          type: 'newMessage',
          author: '+1234567890', // Assuming this is the TWILIO_PHONE_NUMBER
          conversationSid: 'conv123',
        };
        handleWebSocketMessage(messageData);
        expect(playNotificationSound).not.toHaveBeenCalled();
      });
    });
  });