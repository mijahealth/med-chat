// public/js/__tests__/events.test.js

/**
 * @jest-environment jsdom
 */

import { fireEvent, getByText, getByPlaceholderText, getByLabelText } from '@testing-library/dom';
import { setupEventListeners, selectConversation, closeConversation, handleSendMessage } from '../events.js'; // Ensure these functions are exported

// Mock dependencies
jest.mock('../api.js', () => ({
  api: {
    sendMessage: jest.fn(),
    startConversation: jest.fn(),
    getConversationDetails: jest.fn(),
    searchConversations: jest.fn(),
    getMessages: jest.fn(),
    markMessagesAsRead: jest.fn(),
    deleteConversation: jest.fn(), // Added deleteConversation
  },
}));

jest.mock('../state.js', () => ({
  currentConversation: { sid: null },
  state: {
    TWILIO_PHONE_NUMBER: '+1234567890',
    autoScrollEnabled: true,
    conversationsLoaded: true,
    userInteracted: false,
  },
}));

jest.mock('../utils.js', () => ({
  debounce: (fn) => fn,
  log: jest.fn(),
  setUserInteracted: jest.fn(),
  isValidPhoneNumber: jest.fn(() => true),
  isValidName: jest.fn(() => true),
  isValidEmail: jest.fn(() => true),
  isValidDate: jest.fn(() => true),
  isValidState: jest.fn(() => true),
  isValidMessage: jest.fn(() => true),
}));

jest.mock('../conversations.js', () => ({
  loadConversations: jest.fn(),
  updateLatestMessagePreview: jest.fn(),
  deleteConversation: jest.fn(),
}));

jest.mock('../call.js', () => ({
  setupCallControls: jest.fn(),
}));

jest.mock('../ui.js', () => ({
  renderConversations: jest.fn(),
  updateConversationHeader: jest.fn(),
  showMessageInput: jest.fn(),
  renderMessages: jest.fn(),
  moveConversationToTop: jest.fn(),
}));

jest.mock('../messages.js', () => ({
  handleNewMessage: jest.fn(),
}));

jest.mock('feather-icons', () => ({
  replace: jest.fn(),
}));

// Import the mocked modules after mocking
import { api } from '../api.js';
import { currentConversation, state } from '../state.js';
import { loadConversations, updateLatestMessagePreview, deleteConversation } from '../conversations.js';
import { setupCallControls } from '../call.js';
import { renderConversations, updateConversationHeader, showMessageInput, renderMessages, moveConversationToTop } from '../ui.js';
import { handleNewMessage } from '../messages.js';
import feather from 'feather-icons';

describe('events.js', () => {
  let container;

  beforeEach(() => {
    // Use fake timers for handling setTimeout
    jest.useFakeTimers();

    // Set up the DOM based on public/index.html
    document.body.innerHTML = `
      <!-- Message Input -->
      <input id="new-message" placeholder="Message..." aria-label="New Message" />
      <button id="send-message-btn" aria-label="Send Message">Send</button>
      
      <!-- New Conversation Button -->
      <button id="new-conversation-btn" aria-label="New Conversation">
        <i data-feather="plus" aria-hidden="true"></i>
      </button>
      
      <!-- New Conversation Form -->
      <div id="new-conversation-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <span class="close-modal">&times;</span>
          <h2>Start a New Conversation</h2>
          <form id="new-conversation-form">
            <div class="form-group">
              <input type="text" name="phoneNumber" placeholder="+1XXXXXXXXXX" required aria-label="Phone Number" data-validate="phone">
              <span class="error-message" data-for="phoneNumber"></span>
            </div>
            <div class="form-group">
              <input type="text" name="name" placeholder="Name" aria-label="Name" required data-validate="name">
              <span class="error-message" data-for="name"></span>
            </div>
            <div class="form-group">
              <input type="email" name="email" placeholder="Email" aria-label="Email" data-validate="email">
              <span class="error-message" data-for="email"></span>
            </div>
            <div class="form-group">
              <input type="date" name="dob" placeholder="Date of Birth" aria-label="Date of Birth" data-validate="dob">
              <span class="error-message" data-for="dob"></span>
            </div>
            <div class="form-group">
              <input type="text" name="state" placeholder="State" aria-label="State" data-validate="state">
              <span class="error-message" data-for="state"></span>
            </div>
            <div class="form-group">
              <textarea name="message" placeholder="Enter a message" required aria-label="Message" data-validate="message"></textarea>
              <span class="error-message" data-for="message"></span>
            </div>
            <button type="submit">Start Conversation</button>
          </form>
        </div>
      </div>
      
      <!-- Message Sent Indicator -->
      <div id="message-sent-indicator" class="message-sent-indicator">Message Sent</div>
      
      <!-- Conversations Container -->
      <div id="conversations">
        <div class="conversation" data-sid="123" id="conv-123">
          <div class="conversation-header">
            <div class="unread-indicator-column">
              <span class="unread-indicator"></span>
            </div>
            <div class="conversation-details">
              <div class="header-left">
                <strong>Conversation 123</strong>
                <span class="phone-number">+1234567890</span>
              </div>
              <div class="header-right">
                <span class="time">10:00 AM</span>
                <button class="delete-btn" data-sid="123" aria-label="Delete Conversation">
                  <i data-feather="trash-2" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="conversation-content">
            <div class="last-message">Hello!</div>
          </div>
        </div>
      </div>
      
      <!-- Search Input -->
      <input type="text" id="search-input" placeholder="Search conversations..." class="search-input" />
      
      <!-- Loading Spinner -->
      <div id="loading-spinner" class="spinner"></div>
      
      <!-- Messages Container -->
      <div id="messages" aria-live="polite" style="height: 200px; overflow: auto;"></div>
      
      <!-- Messages Title -->
      <div id="messages-title" style="display: none;"></div>
      
      <!-- No Conversation Selected Message -->
      <div id="no-conversation" style="display: none;"></div>
    `;

    container = document.body;

    // Mock form.reset
    const form = container.querySelector('#new-conversation-form');
    form.reset = jest.fn();

    // Initialize event listeners
    setupEventListeners();

    // Mock exported functions using jest.spyOn
    jest.spyOn(require('../events.js'), 'selectConversation').mockResolvedValue();
    jest.spyOn(require('../events.js'), 'closeConversation').mockImplementation(jest.fn());
    jest.spyOn(require('../events.js'), 'handleSendMessage').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    document.body.innerHTML = ''; // Clean up the DOM
  });

  // Passing Tests

  test('should send a message when Enter key is pressed', async () => {
    const messageInput = getByPlaceholderText(container, 'Message...');
    const sendMessageBtn = getByLabelText(container, 'Send Message');

    // Set up the current conversation
    currentConversation.sid = '123';

    // Enter a message
    messageInput.value = 'Test message';

    // Mock sendMessage to return a resolved promise
    api.sendMessage.mockResolvedValue({ success: true });

    // Simulate Enter key press
    fireEvent.keyPress(messageInput, { key: 'Enter', code: 'Enter', charCode: 13 });

    // Wait for the promise to resolve
    await Promise.resolve();

    // Check that sendMessage was called correctly
    expect(api.sendMessage).toHaveBeenCalledWith('123', 'Test message');

    // Check that the input field was cleared
    expect(messageInput.value).toBe('');

    // Check that the message sent indicator is shown
    const indicator = getByText(container, 'Message Sent');
    expect(indicator).toHaveClass('show');

    // Fast-forward time to hide the indicator
    jest.advanceTimersByTime(3000);
    expect(indicator).not.toHaveClass('show');
  });

  test('should send a message when Send button is clicked', async () => {
    const messageInput = getByPlaceholderText(container, 'Message...');
    const sendMessageBtn = getByLabelText(container, 'Send Message');

    // Set up the current conversation
    currentConversation.sid = '123';

    // Enter a message
    messageInput.value = 'Another test message';

    // Mock sendMessage to return a resolved promise
    api.sendMessage.mockResolvedValue({ success: true });

    // Click the send button
    fireEvent.click(sendMessageBtn);

    // Wait for the promise to resolve
    await Promise.resolve();

    // Check that sendMessage was called correctly
    expect(api.sendMessage).toHaveBeenCalledWith('123', 'Another test message');

    // Check that the input field was cleared
    expect(messageInput.value).toBe('');

    // Check that the message sent indicator is shown
    const indicator = getByText(container, 'Message Sent');
    expect(indicator).toHaveClass('show');

    // Fast-forward time to hide the indicator
    jest.advanceTimersByTime(3000);
    expect(indicator).not.toHaveClass('show');
  });

  test('should open new conversation modal when New Conversation button is clicked', () => {
    const newConvBtn = getByLabelText(container, 'New Conversation');

    // Initially, the modal should be hidden
    const modal = container.querySelector('#new-conversation-modal');
    expect(modal).toHaveStyle('display: none');

    // Click the New Conversation button
    fireEvent.click(newConvBtn);

    // The modal should now be visible
    expect(modal).toHaveStyle('display: flex');

    // The form should be cleared
    const phoneInput = container.querySelector('input[name="phoneNumber"]');
    const nameInput = container.querySelector('input[name="name"]');
    const emailInput = container.querySelector('input[name="email"]');
    const dobInput = container.querySelector('input[name="dob"]');
    const stateInput = container.querySelector('input[name="state"]');
    const messageTextarea = container.querySelector('textarea[name="message"]');

    expect(phoneInput.value).toBe('');
    expect(nameInput.value).toBe('');
    expect(emailInput.value).toBe('');
    expect(dobInput.value).toBe('');
    expect(stateInput.value).toBe('');
    expect(messageTextarea.value).toBe('');
  });

  test('should validate form inputs dynamically on user input', () => {
    const newConvBtn = getByLabelText(container, 'New Conversation');
    fireEvent.click(newConvBtn);

    const phoneInput = getByLabelText(container, 'Phone Number');
    const nameInput = getByLabelText(container, 'Name');

    // Initially, no error messages
    const phoneError = container.querySelector('.error-message[data-for="phoneNumber"]');
    const nameError = container.querySelector('.error-message[data-for="name"]');

    expect(phoneError).toHaveTextContent('');
    expect(nameError).toHaveTextContent('');

    // Access the mocked validation functions
    const { isValidPhoneNumber, isValidName } = require('../utils.js');

    // Mock validation functions to return false for invalid inputs and true for valid inputs
    isValidPhoneNumber.mockImplementation((value) => /^\+\d{11}$/.test(value));
    isValidName.mockImplementation((value) => value.trim().length > 0);

    // Enter invalid phone number
    fireEvent.input(phoneInput, { target: { value: 'invalid-phone' } });
    expect(phoneError).toHaveTextContent('Please enter a valid phone number in the format +XXXXXXXXXXX');
    expect(phoneInput).toHaveClass('invalid');

    // Enter valid phone number
    fireEvent.input(phoneInput, { target: { value: '+19876543210' } });
    expect(phoneError).toHaveTextContent('');
    expect(phoneInput).not.toHaveClass('invalid');

    // Enter invalid name
    fireEvent.input(nameInput, { target: { value: ' ' } });
    expect(nameError).toHaveTextContent('Name is required');
    expect(nameInput).toHaveClass('invalid');

    // Enter valid name
    fireEvent.input(nameInput, { target: { value: 'Jane Doe' } });
    expect(nameError).toHaveTextContent('');
    expect(nameInput).not.toHaveClass('invalid');
  });

  // 1. Testing Conversation Selection

  describe('selectConversation', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    test('should not select the same conversation again', async () => {
      const sid = '123';
      currentConversation.sid = '123';

      // Simulate clicking on the same conversation
      const conversationElement = container.querySelector('.conversation[data-sid="123"]');
      fireEvent.click(conversationElement);

      // Wait for promises to resolve
      await Promise.resolve();

      // Assertions
      expect(api.getConversationDetails).not.toHaveBeenCalled();
      expect(api.markMessagesAsRead).not.toHaveBeenCalled();
      expect(api.getMessages).not.toHaveBeenCalled();
      expect(renderMessages).not.toHaveBeenCalled();
      expect(moveConversationToTop).not.toHaveBeenCalled();
    });
  });

  // 3. Testing Search Functionality

  describe('performSearch', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    test('should perform search and render results', async () => {
      const searchInput = getByPlaceholderText(container, 'Search conversations...');
      fireEvent.input(searchInput, { target: { value: 'Test' } });

      const searchResults = [{ sid: '123', name: 'Test Conversation' }];

      // Mock API response
      api.searchConversations.mockResolvedValue(searchResults);

      // Simulate input event
      fireEvent.input(searchInput, { target: { value: 'Test' } });

      // Wait for promises to resolve
      await Promise.resolve();

      // Assertions
      expect(api.searchConversations).toHaveBeenCalledWith('Test');
      expect(renderConversations).toHaveBeenCalledWith(searchResults);
      expect(loadConversations).not.toHaveBeenCalled();
    });

    test('should reset conversations when search input is empty', async () => {
      const searchInput = getByPlaceholderText(container, 'Search conversations...');
      fireEvent.input(searchInput, { target: { value: '' } });

      // Simulate input event
      fireEvent.input(searchInput, { target: { value: '' } });

      // Wait for promises to resolve
      await Promise.resolve();

      // Assertions
      expect(api.searchConversations).not.toHaveBeenCalled();
      expect(loadConversations).toHaveBeenCalled();
      expect(renderConversations).not.toHaveBeenCalled();
    });
  });

  // 4. Testing Scroll Behavior

  describe('checkScrollPosition', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    test('should enable auto-scroll when scrolled to bottom', () => {
      const messagesDiv = container.querySelector('#messages');

      // Mock clientHeight and scrollHeight
      Object.defineProperty(messagesDiv, 'clientHeight', { value: 200, writable: true });
      Object.defineProperty(messagesDiv, 'scrollHeight', { value: 500, writable: true });

      // Simulate scroll position at bottom
      messagesDiv.scrollTop = 300;

      // Trigger scroll event
      fireEvent.scroll(messagesDiv);

      // Assertions
      expect(state.autoScrollEnabled).toBe(true);
    });

    test('should disable auto-scroll when not at bottom', () => {
      const messagesDiv = container.querySelector('#messages');

      // Mock clientHeight and scrollHeight
      Object.defineProperty(messagesDiv, 'clientHeight', { value: 200, writable: true });
      Object.defineProperty(messagesDiv, 'scrollHeight', { value: 500, writable: true });

      // Simulate scroll position not at bottom
      messagesDiv.scrollTop = 100;

      // Trigger scroll event
      fireEvent.scroll(messagesDiv);

      // Assertions
      expect(state.autoScrollEnabled).toBe(false);
    });
  });

  // 5. Testing Scrolling and Auto-Scroll

  describe('scroll event', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    test('should set autoScrollEnabled based on scroll position', () => {
      const messagesDiv = container.querySelector('#messages');

      // Mock clientHeight and scrollHeight
      Object.defineProperty(messagesDiv, 'clientHeight', { value: 200, writable: true });
      Object.defineProperty(messagesDiv, 'scrollHeight', { value: 500, writable: true });

      // Simulate scrolling to bottom
      messagesDiv.scrollTop = 300;
      fireEvent.scroll(messagesDiv);
      expect(state.autoScrollEnabled).toBe(true);

      // Simulate scrolling up
      messagesDiv.scrollTop = 100;
      fireEvent.scroll(messagesDiv);
      expect(state.autoScrollEnabled).toBe(false);
    });
  });

  // 6. Testing Message Sent Indicator Timeout

  describe('message sent indicator timeout', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    test('should hide message sent indicator after timeout', () => {
      const sendMessageBtn = getByLabelText(container, 'Send Message');
      const messageInput = getByPlaceholderText(container, 'Message...');
      const indicator = container.querySelector('#message-sent-indicator');

      // Set up the current conversation
      currentConversation.sid = '123';

      // Enter a message
      messageInput.value = 'Test message';

      // Mock sendMessage to return a resolved promise
      api.sendMessage.mockResolvedValue({ success: true });

      // Click the send button
      fireEvent.click(sendMessageBtn);

      // Wait for promises to resolve
      return Promise.resolve().then(() => {
        // Initially, the indicator should be visible
        expect(indicator).toHaveClass('show');

        // Fast-forward time
        jest.advanceTimersByTime(3000);

        // The indicator should be hidden
        expect(indicator).not.toHaveClass('show');
      });
    });
  });

  // 7. Testing Error Logging

  describe('error logging', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    test('should log error when new message input or send button is not found', () => {
      // Remove message input and send button from DOM
      container.innerHTML = `
        <!-- Other elements without message input and send button -->
      `;

      // Re-initialize event listeners
      setupEventListeners();

      // Assertions
      const { log } = require('../utils.js');
      expect(log).toHaveBeenCalledWith('New message input or send button not found');
    });

    test('should log error when new conversation button is not found', () => {
      // Remove new conversation button from DOM
      container.innerHTML = `
        <!-- Other elements without new conversation button -->
      `;

      // Re-initialize event listeners
      setupEventListeners();

      // Assertions
      const { log } = require('../utils.js');
      expect(log).toHaveBeenCalledWith('New conversation button not found');
    });

    test('should log error when new conversation form is not found', () => {
      // Remove new conversation form from DOM
      container.innerHTML = `
        <!-- Other elements without new conversation form -->
      `;

      // Re-initialize event listeners
      setupEventListeners();

      // Assertions
      const { log } = require('../utils.js');
      expect(log).toHaveBeenCalledWith('New conversation form not found');
    });
  });
});