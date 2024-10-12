// public/js/__tests__/websocket.test.js

// Mock the dependent modules first
jest.mock('../state');
jest.mock('../utils');
jest.mock('../messages');
jest.mock('../conversations');
  
  // Define a MockWebSocket class to simulate WebSocket behavior
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
  
    triggerMessageRaw(rawData) {
      if (this.onmessage) this.onmessage({ data: rawData });
    }
  
    triggerClose() {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) this.onclose();
    }
  }
  
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
    let websocket;
  
    // Use fake timers for reconnection tests
    beforeAll(() => {
      jest.useFakeTimers();
    });
  
    afterAll(() => {
      jest.useRealTimers();
    });
  
    beforeEach(() => {
      // Reset module registry and clear all mocks before each test
      jest.resetModules();
      jest.clearAllMocks();
  
      // Create a new MockWebSocket instance
      mockSocket = new MockWebSocket('wss://example.com');
  
      // Mock the global WebSocket constructor to return the mockSocket
      global.WebSocket = jest.fn(() => mockSocket);
  
      // Now require the module under test
      websocket = require('../websocket');
      setupClientWebSocket = websocket.setupClientWebSocket;
      handleWebSocketMessage = websocket.handleWebSocketMessage;
  
      // Spy on handleWebSocketMessage to monitor its calls
      jest.spyOn(websocket, 'handleWebSocketMessage');
  
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
  
      // Mock document methods to prevent errors during DOM manipulations
      document.getElementById = jest.fn().mockImplementation((id) => {
        return {
          style: {},
          innerHTML: '',
        };
      });
  
      document.body.removeChild = jest.fn();
    });
  
    afterEach(() => {
      // Restore the original WebSocket after each test
      delete global.WebSocket;
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
        const errorEvent = new Event('error');
        mockSocket.triggerError(errorEvent);
        expect(log).toHaveBeenCalledWith('WebSocket error:', errorEvent);
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
  
      // Additional Tests to Improve Coverage
  
      describe('WebSocket Event Handlers', () => {
        describe('socket.onmessage', () => {
          it('should log an error and not call handleWebSocketMessage when message is invalid JSON', () => {
            setupClientWebSocket('wss://example.com');
  
            const invalidJSON = 'invalid json';
  
            // Simulate receiving an invalid JSON message
            mockSocket.triggerMessageRaw(invalidJSON);
  
            // Expect that log was called with a SyntaxError
            expect(log).toHaveBeenCalledWith('Error parsing WebSocket message:', expect.any(SyntaxError));
  
            // Expect that handleWebSocketMessage was not called
            expect(websocket.handleWebSocketMessage).not.toHaveBeenCalled();
          });
        });
  
        describe('handling deleteConversation message when it is current conversation', () => {
          it('should clear DOM elements and log when current conversation is deleted', () => {
            // Set the current conversation SID
            const currentSid = 'conv123';
            require('../state').currentConversation.sid = currentSid;
  
            // Mock DOM elements
            const messagesEl = { innerHTML: '' };
            const messagesTitleEl = { innerHTML: '' };
            const messageInputEl = { style: { display: 'block' } };
            
            // Mock `document.getElementById` to return the mocked elements
            document.getElementById.mockImplementation((id) => {
              switch (id) {
                case 'messages':
                  return messagesEl;
                case 'messages-title':
                  return messagesTitleEl;
                case 'message-input':
                  return messageInputEl;
                default:
                  return null;
              }
            });
  
            const deleteData = {
              type: 'deleteConversation',
              conversationSid: currentSid,
            };
  
            handleWebSocketMessage(deleteData);
  
            // Expect that removeConversationFromUI was called with the correct SID
            expect(removeConversationFromUI).toHaveBeenCalledWith(currentSid);
  
            // Expect that currentConversation.sid is set to null
            expect(require('../state').currentConversation.sid).toBeNull();
  
            // Expect that DOM elements are cleared and hidden
            expect(messagesEl.innerHTML).toBe('');
            expect(messagesTitleEl.innerHTML).toBe('');
            expect(messageInputEl.style.display).toBe('none');
  
            // Expect that log was called with the appropriate message
            expect(log).toHaveBeenCalledWith('Cleared message pane for deleted conversation', { conversationSid: currentSid });
          });
        });
  
        describe('handleWebSocketMessage', () => {
          it('should log unknown message type', () => {
            const unknownData = {
              type: 'unknownType',
              someField: 'value',
            };
            handleWebSocketMessage(unknownData);
            expect(log).toHaveBeenCalledWith('Unknown WebSocket message type', unknownData);
          });
        });
      });
    });
  });