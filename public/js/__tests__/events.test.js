// public/js/__tests__/events.test.js

/**
 * @jest-environment jsdom
 */

import {
  setupEventListeners,
  validateInput,
  validateForm,
  handleSendMessage,
  openNewConversationModal,
  closeModal,
  performSearch,
  checkScrollPosition,
  selectConversation,
  closeConversation,
  handleDeleteConversation,
  setupConversationListeners,
  setupFormValidation,
} from '../events.js';

import { api } from '../api.js';
import { currentConversation, state } from '../state.js';
import {
  debounce,
  log,
  isValidPhoneNumber,
  isValidName,
  isValidEmail,
  isValidDate,
  isValidState,
  isValidMessage,
  setUserInteracted,
} from '../utils.js';
import {
  loadConversations,
  deleteConversation,
  updateLatestMessagePreview,
  moveConversationToTop,
} from '../conversations.js';
import { renderConversations, updateConversationHeader } from '../ui.js';
import feather from 'feather-icons';

// Mock dependencies
jest.mock('../api.js');
jest.mock('../state.js');
jest.mock('../utils.js');
jest.mock('../conversations.js');
jest.mock('../call.js');
jest.mock('../ui.js');
jest.mock('feather-icons');

describe('events.js', () => {
  beforeEach(() => {
    // Set up DOM elements
    document.body.innerHTML = `
      <!-- Elements needed for validateInput and validateForm -->
      <form id="test-form">
        <input name="phoneNumber" data-validate="phone" value="" />
        <span class="error-message" data-for="phoneNumber"></span>
        <input name="name" data-validate="name" value="" />
        <span class="error-message" data-for="name"></span>
        <input name="email" data-validate="email" value="" />
        <span class="error-message" data-for="email"></span>
        <input name="dob" data-validate="dob" value="" />
        <span class="error-message" data-for="dob"></span>
        <input name="state" data-validate="state" value="" />
        <span class="error-message" data-for="state"></span>
        <input name="message" data-validate="message" value="" />
        <span class="error-message" data-for="message"></span>
      </form>

      <!-- Elements needed for handleSendMessage -->
      <input id="new-message" value="" />
      <button id="send-message-btn"></button>
      <div id="message-sent-indicator"></div>

      <!-- Elements needed for openNewConversationModal -->
      <div id="new-conversation-modal" style="display: none;">
        <form id="new-conversation-form"></form>
      </div>

      <!-- Elements needed for performSearch -->
      <input id="search-input" value="" />

      <!-- Elements needed for selectConversation -->
      <div id="messages"></div>
      <div id="messages-title"></div>
      <div id="message-input"></div>
      <div id="no-conversation"></div>
      <div id="loading-spinner"></div>
      <div id="conversations"></div>

      <!-- Elements needed for checkScrollPosition -->
      <div id="messages" style="height: 300px; overflow-y: scroll;"></div>

      <!-- Elements needed for handleDeleteConversation -->
      <button class="delete-btn" data-sid="CH1234567890"></button>

      <!-- Elements needed for setupEventListeners -->
      <input id="new-message" />
      <button id="send-message-btn"></button>
      <button id="new-conversation-btn"></button>
      <div id="messages"></div>
      <form id="new-conversation-form"></form>

      <!-- Other elements as needed -->
    `;

    // Reset the mocks
    jest.resetAllMocks();
    currentConversation.sid = null;
    state.conversationsLoaded = true;
    state.autoScrollEnabled = false;

    // Mock implementations
    debounce.mockImplementation((fn) => fn);
    setUserInteracted.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    window.alert = undefined;
  });

  describe('validateInput', () => {
    it('should validate a valid phone number input', () => {
      const phoneInput = document.querySelector('input[name="phoneNumber"]');
      phoneInput.value = '+1234567890';
      const errorElement = document.querySelector('.error-message[data-for="phoneNumber"]');

      const dependencies = {
        isValidPhoneNumber: jest.fn().mockReturnValue(true),
      };

      const event = { target: phoneInput };
      validateInput(event, dependencies);

      expect(dependencies.isValidPhoneNumber).toHaveBeenCalledWith('+1234567890');
      expect(errorElement.textContent).toBe('');
      expect(phoneInput.classList.contains('invalid')).toBe(false);
    });

    it('should invalidate an invalid phone number input', () => {
      const phoneInput = document.querySelector('input[name="phoneNumber"]');
      phoneInput.value = 'invalid phone';
      const errorElement = document.querySelector('.error-message[data-for="phoneNumber"]');

      const dependencies = {
        isValidPhoneNumber: jest.fn().mockReturnValue(false),
      };

      const event = { target: phoneInput };
      validateInput(event, dependencies);

      expect(dependencies.isValidPhoneNumber).toHaveBeenCalledWith('invalid phone');
      expect(errorElement.textContent).toBe('Please enter a valid phone number in the format +XXXXXXXXXXX');
      expect(phoneInput.classList.contains('invalid')).toBe(true);
    });

    // Similar tests for other input types can be added here
  });

  describe('validateForm', () => {
    it('should validate the form and return true when all inputs are valid', () => {
      const form = document.getElementById('test-form');

      // Set valid values
      form.querySelector('input[name="phoneNumber"]').value = '+1234567890';
      form.querySelector('input[name="name"]').value = 'John Doe';
      form.querySelector('input[name="email"]').value = 'john@example.com';
      form.querySelector('input[name="dob"]').value = '1990-01-01';
      form.querySelector('input[name="state"]').value = 'CA';
      form.querySelector('input[name="message"]').value = 'Hello';

      // Mock dependencies to return true
      const dependencies = {
        isValidPhoneNumber: jest.fn().mockReturnValue(true),
        isValidName: jest.fn().mockReturnValue(true),
        isValidEmail: jest.fn().mockReturnValue(true),
        isValidDate: jest.fn().mockReturnValue(true),
        isValidState: jest.fn().mockReturnValue(true),
        isValidMessage: jest.fn().mockReturnValue(true),
      };

      const result = validateForm(form, dependencies);

      expect(result).toBe(true);
      expect(dependencies.isValidPhoneNumber).toHaveBeenCalledWith('+1234567890');
      expect(dependencies.isValidName).toHaveBeenCalledWith('John Doe');
      expect(dependencies.isValidEmail).toHaveBeenCalledWith('john@example.com');
      expect(dependencies.isValidDate).toHaveBeenCalledWith('1990-01-01');
      expect(dependencies.isValidState).toHaveBeenCalledWith('CA');
      expect(dependencies.isValidMessage).toHaveBeenCalledWith('Hello');
    });

    it('should validate the form and return false when an input is invalid', () => {
      const form = document.getElementById('test-form');

      // Set values, make name invalid
      form.querySelector('input[name="phoneNumber"]').value = '+1234567890';
      form.querySelector('input[name="name"]').value = ''; // invalid name
      form.querySelector('input[name="email"]').value = 'john@example.com';
      form.querySelector('input[name="dob"]').value = '1990-01-01';
      form.querySelector('input[name="state"]').value = 'CA';
      form.querySelector('input[name="message"]').value = 'Hello';

      // Mock dependencies, name validation returns false
      const dependencies = {
        isValidPhoneNumber: jest.fn().mockReturnValue(true),
        isValidName: jest.fn().mockReturnValue(false),
        isValidEmail: jest.fn().mockReturnValue(true),
        isValidDate: jest.fn().mockReturnValue(true),
        isValidState: jest.fn().mockReturnValue(true),
        isValidMessage: jest.fn().mockReturnValue(true),
      };

      const result = validateForm(form, dependencies);

      expect(result).toBe(false);
      expect(dependencies.isValidName).toHaveBeenCalledWith('');
    });
  });

  describe('handleSendMessage', () => {
    it('should send a message when input is valid and conversation is selected', async () => {
      const inputField = document.getElementById('new-message');
      inputField.value = 'Hello World';

      const messageSentIndicator = document.getElementById('message-sent-indicator');

      currentConversation.sid = 'CH1234567890';

      api.sendMessage.mockResolvedValue();

      await handleSendMessage();

      expect(api.sendMessage).toHaveBeenCalledWith('CH1234567890', 'Hello World');
      expect(inputField.value).toBe(''); // input should be cleared

      // Message sent indicator should show 'Message Sent'
      expect(messageSentIndicator.textContent).toBe('Message Sent');
      expect(messageSentIndicator.classList.contains('show')).toBe(true);
    });

    it('should not send a message when input is empty', async () => {
      const inputField = document.getElementById('new-message');
      inputField.value = '';

      api.sendMessage.mockClear();

      await handleSendMessage();

      expect(api.sendMessage).not.toHaveBeenCalled();
    });

    it('should alert when no conversation is selected', async () => {
      const inputField = document.getElementById('new-message');
      inputField.value = 'Hello World';

      currentConversation.sid = null;

      window.alert = jest.fn();

      await handleSendMessage();

      expect(window.alert).toHaveBeenCalledWith('Please select a conversation before sending a message.');
      expect(api.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle error when sendMessage fails', async () => {
      const inputField = document.getElementById('new-message');
      inputField.value = 'Hello World';

      const messageSentIndicator = document.getElementById('message-sent-indicator');

      currentConversation.sid = 'CH1234567890';

      api.sendMessage.mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Adjusted to return a promise
      await handleSendMessage();

      expect(api.sendMessage).toHaveBeenCalledWith('CH1234567890', 'Hello World');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending message:', expect.any(Error));

      // Message sent indicator should show 'Failed to send message'
      expect(messageSentIndicator.textContent).toBe('Failed to send message');
      expect(messageSentIndicator.classList.contains('show')).toBe(true);
      expect(messageSentIndicator.classList.contains('error')).toBe(true);
    });
  });

  describe('openNewConversationModal', () => {
    it('should open the new conversation modal', () => {
      const modal = document.getElementById('new-conversation-modal');
      modal.style.display = 'none';

      openNewConversationModal();

      expect(modal.style.display).toBe('flex');
    });
  });

  describe('closeModal', () => {
    it('should close the modal', () => {
      const modal = document.getElementById('new-conversation-modal');
      modal.style.display = 'flex';

      closeModal();

      expect(modal.style.display).toBe('none');
    });
  });

  describe('performSearch', () => {
    it('should perform search when query is not empty', async () => {
      const searchInput = document.getElementById('search-input');
      searchInput.value = 'test';

      const mockResults = [
        {
          sid: 'CH1234567890',
          friendlyName: 'Test Conversation',
          lastMessage: 'Hello, world!',
          lastMessageTime: new Date().toISOString(),
          unreadCount: 0,
          attributes: {
            phoneNumber: '+19876543210',
            name: 'Test User',
            email: 'testuser@example.com',
            dob: '1990-01-01',
            state: 'CA',
          },
        },
      ];

      api.searchConversations.mockResolvedValue(mockResults);

      await performSearch(api, log);

      expect(api.searchConversations).toHaveBeenCalledWith('test');
      expect(renderConversations).toHaveBeenCalledWith(mockResults);
    });

    it('should load conversations when query is empty', async () => {
      const searchInput = document.getElementById('search-input');
      searchInput.value = '';

      loadConversations.mockResolvedValue();

      await performSearch(api, log);

      expect(api.searchConversations).not.toHaveBeenCalled();
      expect(loadConversations).toHaveBeenCalled();
    });
  });

  describe('selectConversation', () => {
    it('should select conversation when valid sid is provided', async () => {
      const sid = 'CH1234567890';

      state.conversationsLoaded = true;
      currentConversation.sid = null;

      const conversationDetails = {
        sid,
        friendlyName: 'Test Conversation',
        attributes: {
          name: 'Test User',
          email: 'test@example.com',
          phoneNumber: '+1234567890',
          dob: '1990-01-01',
          state: 'CA',
        },
      };

      api.getConversationDetails.mockResolvedValue(conversationDetails);
      api.getMessages.mockResolvedValue([]);

      await selectConversation(sid);

      expect(currentConversation.sid).toBe(sid);
      expect(api.getConversationDetails).toHaveBeenCalledWith(sid);
      expect(api.getMessages).toHaveBeenCalledWith(sid, { limit: 1000, order: 'asc' });
    });

    it('should not select conversation if conversations are not loaded', async () => {
      const sid = 'CH1234567890';

      state.conversationsLoaded = false;
      currentConversation.sid = null;

      window.alert = jest.fn();

      await selectConversation(sid);

      expect(window.alert).toHaveBeenCalledWith('Please wait until conversations are fully loaded.');
      expect(api.getConversationDetails).not.toHaveBeenCalled();
    });
  });

  // Removed startConversation tests as per your request

  describe('handleDeleteConversation', () => {
    it('should delete conversation when API call succeeds', async () => {
      const sid = 'CH1234567890';
      const deleteButton = document.querySelector(`.delete-btn[data-sid="${sid}"]`);
      deleteButton.disabled = false;

      deleteConversation.mockResolvedValue();

      await handleDeleteConversation(sid);

      expect(deleteConversation).toHaveBeenCalledWith(sid);
      expect(log).toHaveBeenCalledWith('Conversation deleted successfully', { sid });
      expect(deleteButton.disabled).toBe(true);
      expect(deleteButton.innerHTML).toContain('Deleting...');
    });

    it('should alert and re-enable delete button when API call fails', async () => {
      const sid = 'CH1234567890';
      const deleteButton = document.querySelector(`.delete-btn[data-sid="${sid}"]`);
      deleteButton.disabled = false;

      deleteConversation.mockRejectedValue(new Error('Network error'));

      window.alert = jest.fn();

      await handleDeleteConversation(sid);

      expect(deleteConversation).toHaveBeenCalledWith(sid);
      expect(log).toHaveBeenCalledWith('Error deleting conversation', { sid, error: expect.any(Error) });
      expect(window.alert).toHaveBeenCalledWith('Failed to delete conversation. Please try again.');
      expect(deleteButton.disabled).toBe(false);
      expect(deleteButton.innerHTML).toContain('trash-2');
    });
  });

  describe('checkScrollPosition', () => {
    it('should set autoScrollEnabled to true when scrolled to bottom', () => {
      const messagesDiv = document.getElementById('messages');

      // Mock clientHeight and scrollHeight
      Object.defineProperty(messagesDiv, 'clientHeight', { value: 200 });
      Object.defineProperty(messagesDiv, 'scrollHeight', { value: 300 });

      messagesDiv.scrollTop = 100;

      checkScrollPosition();

      expect(state.autoScrollEnabled).toBe(true);
    });

    it('should set autoScrollEnabled to false when not scrolled to bottom', () => {
      const messagesDiv = document.getElementById('messages');

      // Mock clientHeight and scrollHeight
      Object.defineProperty(messagesDiv, 'clientHeight', { value: 200 });
      Object.defineProperty(messagesDiv, 'scrollHeight', { value: 300 });

      messagesDiv.scrollTop = 50;

      checkScrollPosition();

      expect(state.autoScrollEnabled).toBe(false);
    });

    it('should log warning if messages div is not found', () => {
      document.body.innerHTML = '';
      checkScrollPosition();

      expect(log).toHaveBeenCalledWith('Messages div not found');
    });
  });

  describe('closeConversation', () => {
    it('should reset current conversation and update UI elements', () => {
      currentConversation.sid = 'CH1234567890';

      const messagesTitle = document.getElementById('messages-title');
      const messages = document.getElementById('messages');
      const messageInput = document.getElementById('message-input');
      const noConversation = document.getElementById('no-conversation');

      closeConversation();

      expect(currentConversation.sid).toBeNull();
      expect(messagesTitle.innerHTML).toBe('');
      expect(messagesTitle.style.display).toBe('none');
      expect(messages.innerHTML).toBe('');
      expect(messages.style.display).toBe('none');
      expect(messageInput.style.display).toBe('none');
      expect(noConversation.style.display).toBe('flex');
      expect(loadConversations).toHaveBeenCalled();
      expect(updateLatestMessagePreview).toHaveBeenCalledWith('CH1234567890');
    });
  });

  describe('setupFormValidation', () => {
    it('should attach event listeners to inputs with data-validate attribute', () => {
      const form = document.getElementById('new-conversation-form');
      form.innerHTML = `
        <input name="test-input" data-validate="test" />
      `;
      const input = form.querySelector('[data-validate]');

      const addEventListenerSpy = jest.spyOn(input, 'addEventListener');

      setupFormValidation();

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));
    });

    it('should not throw error if form is not found', () => {
      document.body.innerHTML = ''; // Remove form
      expect(() => {
        setupFormValidation();
      }).not.toThrow();
    });
  });

  describe('setupConversationListeners', () => {
    it('should add click event listener to conversations container', () => {
      const conversationsContainer = document.getElementById('conversations');
      const addEventListenerSpy = jest.spyOn(conversationsContainer, 'addEventListener');

      setupConversationListeners();

      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should log warning if conversations container is not found', () => {
      document.body.innerHTML = ''; // Remove conversations container
      setupConversationListeners();

      expect(log).toHaveBeenCalledWith('Conversations container not found');
    });
  });

  describe('setupEventListeners', () => {
    it('should set up event listeners for send message input and button', () => {
      const newMessageInput = document.getElementById('new-message');
      const sendMessageBtn = document.getElementById('send-message-btn');

      const inputAddEventListenerSpy = jest.spyOn(newMessageInput, 'addEventListener');
      const btnAddEventListenerSpy = jest.spyOn(sendMessageBtn, 'addEventListener');

      setupEventListeners();

      expect(inputAddEventListenerSpy).toHaveBeenCalledWith('keypress', expect.any(Function));
      expect(btnAddEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should log warning if new message input or send button is not found', () => {
      document.body.innerHTML = ''; // Remove elements
      setupEventListeners();

      expect(log).toHaveBeenCalledWith('New message input or send button not found');
    });
  });

  // Additional tests for edge cases and branches

  describe('Edge Cases and Branches', () => {
    describe('handleSendMessage', () => {
      it('should log when message input field is not found', async () => {
        document.body.innerHTML = ''; // Remove elements

        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await handleSendMessage();

        expect(log).toHaveBeenCalledWith('Message input field not found');
      });

      it('should not send message if message is only whitespace', async () => {
        const inputField = document.getElementById('new-message');
        inputField.value = '   ';

        await handleSendMessage();

        expect(api.sendMessage).not.toHaveBeenCalled();
      });
    });

    describe('selectConversation', () => {
      it('should do nothing if isSelecting is true', async () => {
        state.conversationsLoaded = true;
        currentConversation.sid = null;

        // Set isSelecting to true
        const originalIsSelecting = require('../events.js').isSelecting;
        require('../events.js').isSelecting = true;

        await selectConversation('CH1234567890');

        expect(currentConversation.sid).toBeNull();
        expect(api.getConversationDetails).not.toHaveBeenCalled();

        // Restore isSelecting
        require('../events.js').isSelecting = originalIsSelecting;
      });

      it('should handle error when getConversationDetails fails', async () => {
        const sid = 'CH1234567890';

        state.conversationsLoaded = true;
        currentConversation.sid = null;

        api.getConversationDetails.mockRejectedValue(new Error('Network error'));
        window.alert = jest.fn();

        await selectConversation(sid);

        expect(window.alert).toHaveBeenCalledWith('Error: Network error');
      });
    });

    describe('handleDeleteConversation', () => {
      it('should handle case where delete button is not found', async () => {
        document.body.innerHTML = ''; // Remove elements

        await handleDeleteConversation('CH1234567890');

        // Since deleteButton is not found, nothing should happen
        expect(deleteConversation).not.toHaveBeenCalled();
      });
    });
  });
});