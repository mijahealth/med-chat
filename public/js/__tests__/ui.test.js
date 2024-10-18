/**
 * @jest-environment jsdom
 */

// Import necessary testing utilities
import { fireEvent } from '@testing-library/dom';
import '@testing-library/jest-dom';

// Mock dependencies by referencing their module paths
jest.mock('../conversations.js');
jest.mock('../websocket.js');
jest.mock('../state.js');
jest.mock('../api.js');
jest.mock('../utils.js');
jest.mock('feather-icons');
jest.mock('../events.js');

// Import the module to test after mocking dependencies
import {
  initializeApp,
  showNoConversationSelected,
  renderConversations,
  appendMessage,
  showMessageInput,
  updateConversationHeader,
  moveConversationToTop,
} from '../ui.js';

// Import the mocked modules for use in tests
import { loadConversations } from '../conversations.js';
import { setupClientWebSocket } from '../websocket.js';
import { state, currentConversation } from '../state.js';
import { api } from '../api.js';
import { log, formatTime } from '../utils.js';
import feather from 'feather-icons';
import { closeConversation, setupConversationListeners } from '../events.js';

describe('ui.js', () => {
  // Set up the DOM before each test
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Set up a basic DOM structure
    document.body.innerHTML = `
      <div id="messages-title"></div>
      <div id="no-conversation"></div>
      <div id="messages"></div>
      <div id="message-input"></div>
      <div id="conversations"></div>
    `;
  });

  describe('initializeApp', () => {
    it('should initialize app correctly', async () => {
      // Arrange: Mock API response and loadConversations
      const mockConfig = {
        TWILIO_PHONE_NUMBER: '+1234567890',
        NGROK_URL: 'https://ngrok.io',
      };
      const mockConversations = [
        { sid: 'C1', lastMessage: 'Hello', lastMessageTime: Date.now(), unreadCount: 2 },
        { sid: 'C2', lastMessage: 'Hi', lastMessageTime: Date.now(), unreadCount: 0 },
      ];

      api.getConfig.mockResolvedValue(mockConfig);
      loadConversations.mockResolvedValue(mockConversations);

      // Act
      await initializeApp();

      // Assert: Check state updates
      expect(api.getConfig).toHaveBeenCalledTimes(1);
      expect(state.TWILIO_PHONE_NUMBER).toBe(mockConfig.TWILIO_PHONE_NUMBER);
      expect(state.NGROK_URL).toBe(mockConfig.NGROK_URL);

      // Check loadConversations was called
      expect(loadConversations).toHaveBeenCalledTimes(1);

      // Check that conversations are rendered
      const conversationsDiv = document.getElementById('conversations');
      expect(conversationsDiv).not.toBeNull();
      expect(conversationsDiv.children.length).toBe(2);

      // Check first conversation
      const conv1 = document.getElementById('conv-C1');
      expect(conv1).toBeInTheDocument();
      expect(conv1).toHaveClass('conversation', 'unread');
      expect(conv1).toHaveAttribute('data-sid', 'C1');
      expect(conv1.querySelector('strong')).toHaveTextContent('C1'); // Adjusted selector
      expect(conv1.querySelector('.phone-number')).toHaveTextContent(''); // As per mock data
      expect(conv1.querySelector('.last-message')).toHaveTextContent('Hello');
      expect(conv1.querySelector('.unread-badge')).toHaveTextContent('2');

      // Check second conversation
      const conv2 = document.getElementById('conv-C2');
      expect(conv2).toBeInTheDocument();
      expect(conv2).toHaveClass('conversation');
      expect(conv2).not.toHaveClass('unread');
      expect(conv2).toHaveAttribute('data-sid', 'C2');
      expect(conv2.querySelector('strong')).toHaveTextContent('C2'); // Adjusted selector
      expect(conv2.querySelector('.phone-number')).toHaveTextContent(''); // As per mock data
      expect(conv2.querySelector('.last-message')).toHaveTextContent('Hi');
      expect(conv2.querySelector('.unread-indicator')).toBeInTheDocument();

      // Check that feather.replace was called twice
      expect(feather.replace).toHaveBeenCalledTimes(2);

      // Check that setupClientWebSocket and other initializations were called
      expect(setupClientWebSocket).toHaveBeenCalledTimes(1);
      
      // Updated Expectations for log
      expect(log).toHaveBeenCalledTimes(5);
      expect(log).toHaveBeenNthCalledWith(1, 'Rendering conversations:', mockConversations);
      expect(log).toHaveBeenNthCalledWith(2, 'Processing conversation:', mockConversations[0]);
      expect(log).toHaveBeenNthCalledWith(3, 'Last message text:', 'Hello');
      expect(log).toHaveBeenNthCalledWith(4, 'Processing conversation:', mockConversations[1]);
      expect(log).toHaveBeenNthCalledWith(5, 'Last message text:', 'Hi');

      expect(setupConversationListeners).toHaveBeenCalledTimes(1);
    });

    it('should handle errors during initialization', async () => {
      // Arrange: Mock API to throw an error
      const mockError = new Error('Failed to fetch config');
      api.getConfig.mockRejectedValue(mockError);

      // Act
      await initializeApp();

      // Assert: Check that log was called with the error
      expect(api.getConfig).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith('Error initializing app', { error: mockError });

      // Ensure other initializations did not occur
      const conversationsDiv = document.getElementById('conversations');
      expect(conversationsDiv.innerHTML).toBe('');
      expect(setupClientWebSocket).not.toHaveBeenCalled();
      expect(feather.replace).toHaveBeenCalledTimes(1); // Still called after catch
    });
  });

  describe('showNoConversationSelected', () => {
    it('should display no-conversation message and hide messages and input', () => {
      // Arrange: Set initial styles
      const messagesTitle = document.getElementById('messages-title');
      const noConversation = document.getElementById('no-conversation');
      const messages = document.getElementById('messages');
      const messageInput = document.getElementById('message-input');

      messagesTitle.style.display = 'block';
      noConversation.style.display = 'none';
      messages.innerHTML = '<p>Some messages</p>';
      messageInput.style.display = 'block';

      // Act
      showNoConversationSelected();

      // Assert
      expect(messagesTitle).toHaveStyle('display: none');
      expect(noConversation).toHaveStyle('display: flex');
      expect(messages).toBeEmptyDOMElement();
      expect(messageInput).toHaveStyle('display: none');
    });
  });

  describe('renderConversations', () => {
    it('should render conversations correctly', () => {
      // Arrange: Create mock conversations
      const mockConversations = [
        {
          sid: 'C1',
          friendlyName: 'Alice',
          lastMessage: 'Hey there!',
          lastMessageTime: 1609459200000, // Jan 1, 2021
          unreadCount: 1,
          attributes: { phoneNumber: '+1111111111' },
        },
        {
          sid: 'C2',
          friendlyName: 'Bob',
          lastMessage: 'Hello!',
          lastMessageTime: 1609545600000, // Jan 2, 2021
          unreadCount: 0,
          attributes: { phoneNumber: '+2222222222' },
        },
      ];

      // Mock formatTime
      formatTime.mockImplementation((date) => new Date(date).toLocaleTimeString());

      // Act
      renderConversations(mockConversations);

      // Assert: Check that conversations are rendered in the DOM
      const conversationsDiv = document.getElementById('conversations');
      expect(conversationsDiv).not.toBeNull();
      expect(conversationsDiv.children.length).toBe(2);

      // Check first conversation
      const conv1 = document.getElementById('conv-C1');
      expect(conv1).toBeInTheDocument();
      expect(conv1).toHaveClass('conversation', 'unread');
      expect(conv1).toHaveAttribute('data-sid', 'C1');
      expect(conv1.querySelector('strong')).toHaveTextContent('Alice'); // Adjusted selector
      expect(conv1.querySelector('.phone-number')).toHaveTextContent('+1111111111');
      expect(conv1.querySelector('.last-message')).toHaveTextContent('Hey there!');
      expect(conv1.querySelector('.unread-badge')).toHaveTextContent('1');

      // Check second conversation
      const conv2 = document.getElementById('conv-C2');
      expect(conv2).toBeInTheDocument();
      expect(conv2).toHaveClass('conversation');
      expect(conv2).not.toHaveClass('unread');
      expect(conv2).toHaveAttribute('data-sid', 'C2');
      expect(conv2.querySelector('strong')).toHaveTextContent('Bob'); // Adjusted selector
      expect(conv2.querySelector('.phone-number')).toHaveTextContent('+2222222222');
      expect(conv2.querySelector('.last-message')).toHaveTextContent('Hello!');
      expect(conv2.querySelector('.unread-indicator')).toBeInTheDocument();

      // Check that feather.replace was called
      expect(feather.replace).toHaveBeenCalledTimes(1);

      // Check that setupConversationListeners was called
      expect(setupConversationListeners).toHaveBeenCalledTimes(1);
    });

    it('should handle empty conversations array', () => {
      // Act
      renderConversations([]);

      // Assert: Conversations div should be empty
      const conversationsDiv = document.getElementById('conversations');
      expect(conversationsDiv).toBeEmptyDOMElement();

      // Since an empty array is still an array, 'log' should have been called once
      expect(log).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith('Rendering conversations:', []);
    });

    it('should handle invalid data', () => {
      // Act
      renderConversations(null);

      // Assert
      const conversationsDiv = document.getElementById('conversations');
      expect(conversationsDiv).toBeEmptyDOMElement();
      expect(log).toHaveBeenCalledWith('No conversations to render or invalid data received');
    });
  });

  describe('appendMessage', () => {
    it('should append a message to the messages container', () => {
      // Arrange
      const messagesContainer = document.getElementById('messages');
      state.TWILIO_PHONE_NUMBER = '+1234567890';
      state.autoScrollEnabled = true;

      const mockMessage = {
        author: '+1234567890',
        body: 'Test message',
        dateCreated: 1609459200000, // Jan 1, 2021
      };

      // Mock formatTime
      formatTime.mockReturnValue('12:00 PM');

      // Act
      appendMessage(mockMessage);

      // Assert
      expect(messagesContainer.children.length).toBe(1);
      const messageDiv = messagesContainer.firstElementChild; // Use firstElementChild
      expect(messageDiv).toBeInTheDocument();
      expect(messageDiv).toHaveClass('message', 'right');
      expect(messageDiv.querySelector('span')).toHaveTextContent('Test message');
      expect(messageDiv.querySelector('time')).toHaveTextContent('12:00 PM');

      // Check auto-scroll
      expect(messagesContainer.scrollTop).toBe(messagesContainer.scrollHeight);

      // No expectations for feather.replace since appendMessage does not call it
    });

    it('should append a message from another author to the messages container', () => {
      // Arrange
      const messagesContainer = document.getElementById('messages');
      state.TWILIO_PHONE_NUMBER = '+1234567890';
      state.autoScrollEnabled = true;

      const mockMessage = {
        author: '+0987654321',
        body: 'Hello from Bob',
        dateCreated: 1609459200000, // Jan 1, 2021
      };

      // Mock formatTime
      formatTime.mockReturnValue('1:00 PM');

      // Act
      appendMessage(mockMessage);

      // Assert
      expect(messagesContainer.children.length).toBe(1);
      const messageDiv = messagesContainer.firstElementChild; // Use firstElementChild
      expect(messageDiv).toBeInTheDocument();
      expect(messageDiv).toHaveClass('message', 'left');
      expect(messageDiv.querySelector('span')).toHaveTextContent('Hello from Bob');
      expect(messageDiv.querySelector('time')).toHaveTextContent('1:00 PM');

      // Check auto-scroll
      expect(messagesContainer.scrollTop).toBe(messagesContainer.scrollHeight);

      // No expectations for feather.replace since appendMessage does not call it
    });

    it('should not auto-scroll if autoScrollEnabled is false', () => {
      // Arrange
      const messagesContainer = document.getElementById('messages');
      state.TWILIO_PHONE_NUMBER = '+1234567890';
      state.autoScrollEnabled = false;

      const mockMessage = {
        author: '+1234567890',
        body: 'Test message',
        dateCreated: 1609459200000, // Jan 1, 2021
      };

      // Mock formatTime
      formatTime.mockReturnValue('12:00 PM');

      // Set initial scrollTop
      messagesContainer.scrollTop = 0;

      // Act
      appendMessage(mockMessage);

      // Assert
      expect(messagesContainer.scrollTop).toBe(0);
    });
  });

  describe('showMessageInput', () => {
    it('should display the message input area', () => {
      // Arrange
      const messageInput = document.getElementById('message-input');
      messageInput.style.display = 'none';

      // Act
      showMessageInput();

      // Assert
      expect(messageInput).toHaveStyle('display: flex');
    });
  });

  describe('updateConversationHeader', () => {
    it('should update the conversation header correctly', () => {
      // Arrange
      const messagesTitle = document.getElementById('messages-title');
      messagesTitle.style.display = 'none';

      // Mock closeConversation
      closeConversation.mockImplementation(() => {});

      // Act
      updateConversationHeader(
        'C1',
        'Alice',
        'alice@example.com',
        '+1111111111',
        '1990-01-01',
        'California'
      );

      // Assert
      expect(messagesTitle).toHaveStyle('display: flex');
      expect(messagesTitle.innerHTML).toContain('Alice');
      expect(messagesTitle.innerHTML).toContain('alice@example.com');
      expect(messagesTitle.innerHTML).toContain('+1111111111');
      expect(messagesTitle.innerHTML).toContain('DOB: 1990-01-01');
      expect(messagesTitle.innerHTML).toContain('State: California');

      // Check that the name is a hyperlink
      const nameLink = messagesTitle.querySelector('.customer-link');
      expect(nameLink).toBeInTheDocument();
      expect(nameLink.href).toContain('/customer/1111111111');
      expect(nameLink.textContent.trim()).toBe('Alice');  // Use trim() here

      // Check that the avatar icon is now an info icon
      const avatarIcon = messagesTitle.querySelector('.avatar-icon');
      expect(avatarIcon).toBeInTheDocument();
      expect(avatarIcon.getAttribute('data-feather')).toBe('info');

      // Check that closeConversation was attached to the close button
      const closeButton = document.getElementById('close-conversation-btn');
      expect(closeButton).toBeInTheDocument();

      // Simulate click event
      fireEvent.click(closeButton);
      expect(closeConversation).toHaveBeenCalledTimes(1);

      // Check that feather.replace was called
      expect(feather.replace).toHaveBeenCalledTimes(1);
    });
  });

  describe('moveConversationToTop', () => {
    it('should move the specified conversation to the top', () => {
      // Arrange: Create two conversation divs
      const conversationsDiv = document.getElementById('conversations');
      const conv1 = document.createElement('div');
      conv1.id = 'conv-C1';
      const conv2 = document.createElement('div');
      conv2.id = 'conv-C2';

      conversationsDiv.appendChild(conv1);
      conversationsDiv.appendChild(conv2);

      // Act: Move C2 to top
      moveConversationToTop('C2');

      // Assert
      expect(conversationsDiv.firstChild).toBe(conv2);
      expect(conversationsDiv.lastChild).toBe(conv1);
    });

    it('should not move if conversation is already at top', () => {
      // Arrange: Create two conversation divs
      const conversationsDiv = document.getElementById('conversations');
      const conv1 = document.createElement('div');
      conv1.id = 'conv-C1';
      const conv2 = document.createElement('div');
      conv2.id = 'conv-C2';

      conversationsDiv.appendChild(conv1);
      conversationsDiv.appendChild(conv2);

      // Act: Move C1 to top (already at top)
      moveConversationToTop('C1');

      // Assert
      expect(conversationsDiv.firstChild).toBe(conv1);
      expect(conversationsDiv.lastChild).toBe(conv2);
    });

    it('should do nothing if the conversation does not exist', () => {
      // Arrange: Create one conversation div
      const conversationsDiv = document.getElementById('conversations');
      const conv1 = document.createElement('div');
      conv1.id = 'conv-C1';
      conversationsDiv.appendChild(conv1);

      // Act: Attempt to move a non-existent conversation
      moveConversationToTop('C2');

      // Assert
      expect(conversationsDiv.firstChild).toBe(conv1);
      expect(conversationsDiv.childElementCount).toBe(1);
    });
  });
});