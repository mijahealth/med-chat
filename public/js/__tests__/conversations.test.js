// conversations.test.js

// Import necessary modules and functions
import * as Conversations from '../conversations';
import { api } from '../api';
import { renderConversations, moveConversationToTop } from '../ui';
import { formatTime, log } from '../utils';
import { state, currentConversation } from '../state';

// Mock modules to use manual mocks from __mocks__
jest.mock('../api');
jest.mock('../ui');
jest.mock('../utils');
jest.mock('../state');

// Helper function to set up DOM elements
function setupDOM() {
  document.body.innerHTML = `
    <div id="loading-spinner" style="display: none;"></div>
    <div id="conv-conv1" class="conversation">
      <strong>Friend 1</strong>
      <div class="last-message">Hello</div>
      <div class="time">10:00 AM</div>
      <div class="unread-indicator-column">
        <span class="unread-badge">1</span>
      </div>
    </div>
    <div id="conv-conv2" class="conversation">
      <strong>Friend 2</strong>
      <div class="last-message">Hi</div>
      <div class="time">12:00 PM</div>
      <div class="unread-indicator-column"></div>
    </div>
    <div id="messages"></div>
    <div id="messages-title"></div>
    <input id="message-input" style="display: none;" />
  `;
}

describe('Conversations Module', () => {
  // Setup before each test to ensure consistent test environments
  beforeEach(() => {
    jest.clearAllMocks();
    state.conversations = []; // Ensure conversations are always initialized
    state.conversationsLoaded = false;
    currentConversation.sid = null;
    setupDOM();
  });

  // Tests for loadConversations
  describe('loadConversations', () => {
    it('should fetch and render conversations successfully', async () => {
      const mockConversations = [
        { sid: 'conv1', lastMessage: 'Hello', lastMessageTime: '2023-10-01T10:00:00Z' },
        { sid: 'conv2', lastMessage: 'Hi', lastMessageTime: '2023-10-02T12:00:00Z' },
      ];

      // Mocking the API response
      api.getConversations.mockResolvedValue(mockConversations);

      await Conversations.loadConversations();

      // Assertions to validate expected behavior
      expect(api.getConversations).toHaveBeenCalledTimes(1);
      expect(renderConversations).toHaveBeenCalledWith(mockConversations);
      expect(state.conversationsLoaded).toBe(true);
      expect(state.conversations).toEqual(mockConversations);
      expect(document.getElementById('loading-spinner').style.display).toBe('none');
    });

    it('should highlight the selected conversation if currentConversation.sid is set', async () => {
      const mockConversations = [
        { sid: 'conv1', lastMessage: 'Hello', lastMessageTime: '2023-10-01T10:00:00Z' },
        { sid: 'conv2', lastMessage: 'Hi', lastMessageTime: '2023-10-02T12:00:00Z' },
      ];
    
      // Set currentConversation.sid
      currentConversation.sid = 'conv2';
    
      // Mocking the API response
      api.getConversations.mockResolvedValue(mockConversations);
    
      // Setup DOM element for the selected conversation
      const conv2Div = document.createElement('div');
      conv2Div.id = 'conv-conv2';
      document.body.appendChild(conv2Div);
    
      await Conversations.loadConversations();
    
      expect(document.getElementById('conv-conv2').classList.contains('selected')).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('API Error');
      api.getConversations.mockRejectedValue(mockError);

      const result = await Conversations.loadConversations();

      expect(api.getConversations).toHaveBeenCalledTimes(1);
      expect(renderConversations).not.toHaveBeenCalled();
      expect(state.conversationsLoaded).toBe(false);
      expect(state.conversations).toEqual([]);
      expect(log).toHaveBeenCalledWith('Error loading conversations', { error: mockError });
      expect(result).toEqual([]);
      expect(document.getElementById('loading-spinner').style.display).toBe('none');
    });

    it('should handle sorting of conversations by lastMessageTime', async () => {
      const mockConversations = [
        { sid: 'conv1', lastMessage: 'Hello', lastMessageTime: '2023-10-01T10:00:00Z' },
        { sid: 'conv2', lastMessage: 'Hi', lastMessageTime: '2023-10-02T12:00:00Z' },
        { sid: 'conv3', lastMessage: 'Hey', lastMessageTime: '2023-09-30T09:00:00Z' },
      ];

      api.getConversations.mockResolvedValue(mockConversations);

      await Conversations.loadConversations();

      const sortedConversations = [
        { sid: 'conv2', lastMessage: 'Hi', lastMessageTime: '2023-10-02T12:00:00Z' },
        { sid: 'conv1', lastMessage: 'Hello', lastMessageTime: '2023-10-01T10:00:00Z' },
        { sid: 'conv3', lastMessage: 'Hey', lastMessageTime: '2023-09-30T09:00:00Z' },
      ];

      expect(renderConversations).toHaveBeenCalledWith(sortedConversations);
      expect(state.conversations).toEqual(sortedConversations);
    });
  });

  // Tests for updateLatestMessagePreview
  describe('updateLatestMessagePreview', () => {
    it('should handle no latest message gracefully', async () => {
      const conversationSid = 'conv1';
      api.getMessages.mockResolvedValue([]);

      await Conversations.updateLatestMessagePreview(conversationSid);

      expect(api.getMessages).toHaveBeenCalledWith(conversationSid, { limit: 1, order: 'desc' });
      // No updates should be made
      const conversationDiv = document.getElementById(`conv-${conversationSid}`);
      const lastMessageDiv = conversationDiv.querySelector('.last-message');
      const timeDiv = conversationDiv.querySelector('.time');

      expect(lastMessageDiv.textContent).toBe('Hello');
      expect(timeDiv.textContent).toBe('10:00 AM'); // Original time
    });

    it('should handle 404 error specifically', async () => {
      const conversationSid = 'conv1';
      const mockError = { response: { status: 404 } };
      api.getMessages.mockRejectedValue(mockError);

      await Conversations.updateLatestMessagePreview(conversationSid);

      expect(log).toHaveBeenCalledWith(
        `Conversation ${conversationSid} not found, it may have been deleted.`
      );
    });

    it('should handle other errors', async () => {
      const conversationSid = 'conv1';
      const mockError = new Error('Network Error');
      api.getMessages.mockRejectedValue(mockError);

      await Conversations.updateLatestMessagePreview(conversationSid);

      expect(log).toHaveBeenCalledWith('Error fetching latest message', { error: mockError });
    });
  });

  // Tests for incrementUnreadCount
  describe('incrementUnreadCount', () => {
    it('should increment unread count when badge exists', () => {
      const conversationSid = 'conv1';
      const conversationDiv = document.getElementById(`conv-${conversationSid}`);

      const unreadBadge = conversationDiv.querySelector('.unread-badge');
      unreadBadge.textContent = '2';

      Conversations.incrementUnreadCount(conversationSid);

      expect(unreadBadge.textContent).toBe('3');
      expect(conversationDiv.classList.contains('unread')).toBe(true);
    });

    it('should create unread badge when it does not exist', () => {
      const conversationSid = 'conv2';
      const conversationDiv = document.getElementById(`conv-${conversationSid}`);
      // Remove existing unread badge if any
      const existingBadge = conversationDiv.querySelector('.unread-badge');
      if (existingBadge) existingBadge.remove();

      Conversations.incrementUnreadCount(conversationSid);

      const newBadge = conversationDiv.querySelector('.unread-badge');
      expect(newBadge).not.toBeNull();
      expect(newBadge.textContent).toBe('1');
      expect(conversationDiv.classList.contains('unread')).toBe(true);
    });

    it('should do nothing if conversation element does not exist', () => {
      const conversationSid = 'conv3';

      Conversations.incrementUnreadCount(conversationSid);

      expect(document.getElementById(`conv-${conversationSid}`)).toBeNull();
      expect(log).not.toHaveBeenCalled();
    });
  });

  // Tests for handleNewConversation
  describe('handleNewConversation', () => {
    it('should add a new conversation if it does not exist', () => {
      const newConversation = { sid: 'conv3', lastMessage: 'New message' };

      Conversations.handleNewConversation(newConversation);

      expect(state.conversations.length).toBe(1);
      expect(state.conversations[0]).toEqual(newConversation);
      expect(renderConversations).toHaveBeenCalledWith(state.conversations, true);
    });

    it('should update existing conversation if it exists', () => {
      // Initial conversation state setup
      state.conversations = [{ sid: 'conv1', lastMessage: 'Old Message' }];

      const updatedConversation = { sid: 'conv1', lastMessage: 'Updated Message' };

      Conversations.handleNewConversation(updatedConversation);

      expect(state.conversations.length).toBe(1);
      expect(state.conversations[0].lastMessage).toBe('Updated Message');
      expect(renderConversations).toHaveBeenCalledWith(state.conversations, true);
    });
  });

  // Tests for handleUpdateConversation
  describe('handleUpdateConversation', () => {
    it('should not update if conversation does not exist', () => {
      // Initial conversation state setup
      state.conversations = [{ sid: 'conv1', lastMessage: 'Old Message' }];

      const updatedConversation = { sid: 'conv2', lastMessage: 'New Message' };

      Conversations.handleUpdateConversation(updatedConversation);

      expect(state.conversations.length).toBe(1);
      expect(state.conversations[0].lastMessage).toBe('Old Message');
      expect(renderConversations).toHaveBeenCalledWith(state.conversations);
    });

    it('should handle missing elements gracefully in handleUpdateConversation', () => {
      // Initial conversation state setup
      state.conversations = [{ sid: 'conv1', lastMessage: 'Old Message' }];
    
      const updatedConversation = { sid: 'conv1', lastMessage: 'Updated Message' };
    
      // Remove conversation DOM element to simulate missing element
      const conversationDiv = document.getElementById('conv-conv1');
      if (conversationDiv) conversationDiv.remove();
    
      Conversations.handleUpdateConversation(updatedConversation);
    
      // Verify that no errors occur and state is updated
      expect(state.conversations[0].lastMessage).toBe('Updated Message');
      // Ensure that renderConversations is called to update the UI
      expect(renderConversations).toHaveBeenCalledWith(state.conversations);
    });
  });

  // Tests for removeConversationFromUI
  describe('removeConversationFromUI', () => {
    it('should remove the conversation element from the DOM', () => {
      const conversationSid = 'conv1';
      currentConversation.sid = 'conv1';

      Conversations.removeConversationFromUI(conversationSid);

      const conversationDiv = document.getElementById(`conv-${conversationSid}`);
      expect(conversationDiv).toBeNull();
      expect(log).toHaveBeenCalledWith('Conversation removed from UI', { conversationSid });
      expect(currentConversation.sid).toBeNull();
    });

    it('should log if the conversation element does not exist', () => {
      const conversationSid = 'conv3';
      Conversations.removeConversationFromUI(conversationSid);

      expect(log).toHaveBeenCalledWith('Conversation element not found for deletion', { conversationSid });
    });
    it('should clear DOM elements and log when current conversation is deleted', () => {
      const conversationSid = 'conv1';
      currentConversation.sid = 'conv1';
    
      // Setup DOM elements
      const messagesDiv = document.getElementById('messages');
      const messagesTitle = document.getElementById('messages-title');
      const messageInput = document.getElementById('message-input');
      messageInput.style.display = 'block';
    
      Conversations.removeConversationFromUI(conversationSid);
    
      expect(currentConversation.sid).toBeNull();
      expect(messagesDiv.innerHTML).toBe('');
      expect(messagesTitle.innerHTML).toBe('');
      expect(messageInput.style.display).toBe('none');
      expect(log).toHaveBeenCalledWith('Cleared message pane for deleted conversation', { conversationSid });
    });
  });

  // Tests for fetchConversation
  describe('fetchConversation', () => {
    it('should fetch conversation details successfully', async () => {
      const conversationSid = 'conv1';
      const mockDetails = { sid: 'conv1', friendlyName: 'Friend 1', participants: ['user1', 'user2'] };

      api.getConversationDetails.mockResolvedValue(mockDetails);

      const result = await Conversations.fetchConversation(conversationSid);

      expect(api.getConversationDetails).toHaveBeenCalledWith(conversationSid);
      expect(result).toEqual(mockDetails);
    });

    it('should handle errors when fetching conversation details', async () => {
      const conversationSid = 'conv1';
      const mockError = new Error('Fetch Error');

      api.getConversationDetails.mockRejectedValue(mockError);

      await expect(Conversations.fetchConversation(conversationSid)).rejects.toThrow('Fetch Error');

      expect(api.getConversationDetails).toHaveBeenCalledWith(conversationSid);
      expect(log).toHaveBeenCalledWith('Error fetching conversation', { sid: conversationSid, error: mockError });
    });
  });

  // Tests for listConversations
  describe('listConversations', () => {
    it('should list conversations successfully', async () => {
      const mockConversations = [
        { sid: 'conv1', lastMessage: 'Hello' },
        { sid: 'conv2', lastMessage: 'Hi' },
      ];

      api.getConversations.mockResolvedValue(mockConversations);

      const result = await Conversations.listConversations();

      expect(api.getConversations).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockConversations);
    });

    it('should handle errors when listing conversations', async () => {
      const mockError = new Error('List Error');
      api.getConversations.mockRejectedValue(mockError);

      await expect(Conversations.listConversations()).rejects.toThrow('List Error');

      expect(api.getConversations).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith('Error listing conversations', { error: mockError });
    });
  });

  // Tests for createConversation
  describe('createConversation', () => {
    it('should create a new conversation successfully', async () => {
      const newConversationData = { friendlyName: 'New Friend' };
      const mockConversation = { sid: 'conv3', friendlyName: 'New Friend' };

      api.startConversation.mockResolvedValue(mockConversation);

      const result = await Conversations.createConversation(newConversationData);

      expect(api.startConversation).toHaveBeenCalledWith(newConversationData);
      expect(result).toEqual(mockConversation);
    });

    it('should handle errors when creating a conversation', async () => {
      const newConversationData = { friendlyName: 'New Friend' };
      const mockError = new Error('Create Error');

      api.startConversation.mockRejectedValue(mockError);

      await expect(Conversations.createConversation(newConversationData)).rejects.toThrow('Create Error');

      expect(api.startConversation).toHaveBeenCalledWith(newConversationData);
      expect(log).toHaveBeenCalledWith('Error creating conversation', { error: mockError });
    });
  });

  // Tests for deleteConversation
  describe('deleteConversation', () => {
    it('should delete a conversation successfully', async () => {
      const conversationSid = 'conv1';

      api.deleteConversation.mockResolvedValue();

      await Conversations.deleteConversation(conversationSid);

      expect(api.deleteConversation).toHaveBeenCalledWith(conversationSid);
      expect(log).toHaveBeenCalledWith('Conversation deleted successfully', { sid: conversationSid });
    });

    it('should handle errors when deleting a conversation', async () => {
      const conversationSid = 'conv1';
      const mockError = new Error('Delete Error');

      api.deleteConversation.mockRejectedValue(mockError);

      await expect(Conversations.deleteConversation(conversationSid)).rejects.toThrow('Delete Error');

      expect(api.deleteConversation).toHaveBeenCalledWith(conversationSid);
      expect(log).toHaveBeenCalledWith('Error deleting conversation', { sid: conversationSid, error: mockError });
    });
  });

  // Tests for addMessage
  describe('addMessage', () => {
    it('should add a message successfully', async () => {
      const conversationSid = 'conv1';
      const message = 'Hello there!';
      const mockMessage = { id: 'msg1', body: 'Hello there!', dateCreated: '2023-10-05T17:00:00Z' };

      api.sendMessage.mockResolvedValue(mockMessage);

      const result = await Conversations.addMessage(conversationSid, message);

      expect(api.sendMessage).toHaveBeenCalledWith(conversationSid, message);
      expect(result).toEqual(mockMessage);
    });

    it('should handle errors when adding a message', async () => {
      const conversationSid = 'conv1';
      const message = 'Hello there!';
      const mockError = new Error('Send Message Error');

      api.sendMessage.mockRejectedValue(mockError);

      await expect(Conversations.addMessage(conversationSid, message)).rejects.toThrow('Send Message Error');

      expect(api.sendMessage).toHaveBeenCalledWith(conversationSid, message);
      expect(log).toHaveBeenCalledWith('Error adding message', { conversationSid, error: mockError });
    });
  });

  // Tests for listMessages
  describe('listMessages', () => {
    it('should list messages successfully with default options', async () => {
      const conversationSid = 'conv1';
      const mockMessages = [
        { id: 'msg1', body: 'Hello' },
        { id: 'msg2', body: 'Hi' },
      ];

      api.getMessages.mockResolvedValue(mockMessages);

      const result = await Conversations.listMessages(conversationSid);

      expect(api.getMessages).toHaveBeenCalledWith(conversationSid, {});
      expect(result).toEqual(mockMessages);
    });

    it('should list messages successfully with provided options', async () => {
      const conversationSid = 'conv1';
      const options = { limit: 10, order: 'asc' };
      const mockMessages = [
        { id: 'msg1', body: 'Hello' },
        { id: 'msg2', body: 'Hi' },
      ];

      api.getMessages.mockResolvedValue(mockMessages);

      const result = await Conversations.listMessages(conversationSid, options);

      expect(api.getMessages).toHaveBeenCalledWith(conversationSid, options);
      expect(result).toEqual(mockMessages);
    });

    it('should handle errors when listing messages', async () => {
      const conversationSid = 'conv1';
      const mockError = new Error('List Messages Error');

      api.getMessages.mockRejectedValue(mockError);

      await expect(Conversations.listMessages(conversationSid)).rejects.toThrow('List Messages Error');

      expect(api.getMessages).toHaveBeenCalledWith(conversationSid, {});
      expect(log).toHaveBeenCalledWith('Error listing messages', { conversationSid, error: mockError });
    });
  });

  // Tests for markMessagesAsRead
  describe('markMessagesAsRead', () => {
    it('should mark messages as read successfully', async () => {
      const conversationSid = 'conv1';

      api.markMessagesAsRead.mockResolvedValue();

      await Conversations.markMessagesAsRead(conversationSid);

      expect(api.markMessagesAsRead).toHaveBeenCalledWith(conversationSid);
    });

    it('should handle errors when marking messages as read', async () => {
      const conversationSid = 'conv1';
      const mockError = new Error('Mark Read Error');

      api.markMessagesAsRead.mockRejectedValue(mockError);

      await expect(Conversations.markMessagesAsRead(conversationSid)).rejects.toThrow('Mark Read Error');

      expect(api.markMessagesAsRead).toHaveBeenCalledWith(conversationSid);
      expect(log).toHaveBeenCalledWith('Error marking messages as read', { conversationSid, error: mockError });
    });
  });

  // Tests for updateConversationPreview
  describe('updateConversationPreview', () => {
    it('should handle missing latestMessage fields gracefully', () => {
      const conversationSid = 'conv1';
      const latestMessage = { body: '', dateCreated: '' };

      Conversations.updateConversationPreview(conversationSid, latestMessage);

      const conversationDiv = document.getElementById(`conv-${conversationSid}`);
      const lastMessageDiv = conversationDiv.querySelector('.last-message');
      const timeDiv = conversationDiv.querySelector('.time');

      expect(lastMessageDiv.textContent).toBe('');
      expect(timeDiv.textContent).toBe('10:00 AM'); // Original time
    });

    it('should do nothing if conversation element does not exist', () => {
      const conversationSid = 'conv3';
      const latestMessage = { body: 'Hello', dateCreated: '2023-10-07T19:00:00Z' };

      Conversations.updateConversationPreview(conversationSid, latestMessage);

      expect(log).not.toHaveBeenCalled();
    });
  });
});