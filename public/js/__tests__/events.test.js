// public/js/__tests__/events.test.js

/**
 * @jest-environment jsdom
 */

import { fireEvent, getByText, getByPlaceholderText, getByLabelText } from '@testing-library/dom';
import { setupEventListeners } from '../events.js';

// Mock dependencies
jest.mock('../api.js', () => ({
  api: {
    sendMessage: jest.fn(),
    startConversation: jest.fn(),
    getConversationDetails: jest.fn(),
    searchConversations: jest.fn(),
    getMessages: jest.fn(),
    markMessagesAsRead: jest.fn(),
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

    // Initialize event listeners
    setupEventListeners();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    document.body.innerHTML = ''; // Clean up the DOM
  });

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

  test('should handle form submission for starting a new conversation', async () => {
    const newConvBtn = getByLabelText(container, 'New Conversation');
    fireEvent.click(newConvBtn);

    const form = container.querySelector('#new-conversation-form');
    const phoneInput = getByLabelText(container, 'Phone Number');
    const nameInput = getByLabelText(container, 'Name');
    const emailInput = getByLabelText(container, 'Email');
    const dobInput = getByLabelText(container, 'Date of Birth');
    const stateInput = getByLabelText(container, 'State');
    const messageTextarea = getByLabelText(container, 'Message');
    const submitButton = getByText(container, 'Start Conversation');

    // Fill in the form
    fireEvent.change(phoneInput, { target: { value: '+19876543210' } });
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
    fireEvent.change(dobInput, { target: { value: '1990-01-01' } });
    fireEvent.change(stateInput, { target: { value: 'CA' } });
    fireEvent.change(messageTextarea, { target: { value: 'Hello there!' } });

    // Mock the API response for starting a conversation
    api.startConversation.mockResolvedValue({
      existing: false,
      sid: '456',
    });

    // Click the submit button
    fireEvent.submit(form);

    // Wait for the promise to resolve
    await Promise.resolve();

    // Check that startConversation was called correctly
    expect(api.startConversation).toHaveBeenCalledWith({
      phoneNumber: '+19876543210',
      message: 'Hello there!',
      name: 'John Doe',
      email: 'john@example.com',
      dob: '1990-01-01',
      state: 'CA',
    });

    // Check that loadConversations was called
    expect(loadConversations).toHaveBeenCalled();

    // Check that the modal was closed
    const modal = container.querySelector('#new-conversation-modal');
    expect(modal).toHaveStyle('display: none');

    // Check that moveConversationToTop was called with the new SID
    expect(moveConversationToTop).toHaveBeenCalledWith('456');
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

  test('should update autoScrollEnabled state when scrolling messages div', () => {
    const messagesDiv = container.querySelector('#messages');

    // Initially, autoScrollEnabled is true
    expect(state.autoScrollEnabled).toBe(true);

    // Simulate scrolling to top
    fireEvent.scroll(messagesDiv, { target: { scrollTop: 0 } });

    // Expect autoScrollEnabled to be false
    expect(state.autoScrollEnabled).toBe(false);

    // Simulate scrolling to bottom
    fireEvent.scroll(messagesDiv, { target: { scrollTop: messagesDiv.scrollHeight } });

    // Expect autoScrollEnabled to be true
    expect(state.autoScrollEnabled).toBe(true);
  });

  test('should handle incoming WebSocket newMessage', () => {
    // Mock WebSocket
    const mockAddEventListener = jest.fn();
    const mockWebSocketInstance = {
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: mockAddEventListener,
      removeEventListener: jest.fn(),
    };
    global.WebSocket = jest.fn(() => mockWebSocketInstance);

    // Re-import events.js to ensure it uses the mocked WebSocket
    jest.resetModules();
    const { setupEventListeners } = require('../events.js');

    setupEventListeners();

    // Define the new message data
    const newMessageData = {
      type: 'newMessage',
      conversationSid: '123',
      messageSid: 'msg-456',
      author: '+19876543210',
      body: 'New message via WebSocket',
      dateCreated: '2024-10-05T12:00:00Z',
    };

    // Simulate receiving a WebSocket message
    const onMessage = mockAddEventListener.mock.calls.find(
      (call) => call[0] === 'message'
    )[1];
    onMessage({ data: JSON.stringify(newMessageData) });

    // Expect handleNewMessage to have been called with newMessageData
    expect(handleNewMessage).toHaveBeenCalledWith(newMessageData);
  });
});