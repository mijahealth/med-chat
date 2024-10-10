// public/js/__tests__/messages.test.js

// Mock dependencies before importing the module under test
jest.mock('../api.js');
jest.mock('../ui.js');
jest.mock('../utils.js');
jest.mock('../state.js');
jest.mock('../conversations.js');

// Now import the module under test
import { loadMessages, handleNewMessage } from '../messages.js';

// Import the mocked modules
import { api } from '../api.js';
import { renderMessages, appendMessage, moveConversationToTop } from '../ui.js'; // Corrected
import { updateConversationPreview, incrementUnreadCount } from '../conversations.js'; // Corrected
import { log, playNotificationSound } from '../utils.js';
import { state, currentConversation } from '../state.js';

// Mock Date to return a fixed time
const FIXED_DATE = new Date('2024-04-01T12:00:00Z');
jest.useFakeTimers().setSystemTime(FIXED_DATE);

describe('messages.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadMessages', () => {
    it('should fetch messages and render them successfully', async () => {
      const sid = 'CH1234567890';

      // Mock getMessages to return a list of messages
      const mockMessages = [
        { sid: 'IM1', author: '+1234567890', body: 'First message', dateCreated: '2024-04-01T12:00:00Z' },
        { sid: 'IM2', author: '+19876543210', body: 'Second message', dateCreated: '2024-04-01T12:05:00Z' },
      ];
      api.getMessages.mockResolvedValueOnce(mockMessages);

      await loadMessages(sid);

      // Assertions
      expect(api.getMessages).toHaveBeenCalledWith(sid, { limit: 1000, order: 'asc' });
      expect(renderMessages).toHaveBeenCalledWith(mockMessages);
      expect(updateConversationPreview).toHaveBeenCalledWith(sid, mockMessages[mockMessages.length - 1]); // Now correctly imported
    });

    it('should handle conversation not found (404)', async () => {
      const sid = 'CH_NON_EXISTENT';
      const error = {
        response: {
          status: 404,
        },
      };
      api.getMessages.mockRejectedValueOnce(error);

      await loadMessages(sid);

      // Assertions
      expect(api.getMessages).toHaveBeenCalledWith(sid, { limit: 1000, order: 'asc' });
      expect(log).toHaveBeenCalledWith(`Conversation ${sid} was not found, it may have been deleted.`);
    });

    it('should handle other errors', async () => {
      const sid = 'CH_ERROR';
      const error = new Error('Network Error');
      api.getMessages.mockRejectedValueOnce(error);

      await loadMessages(sid);

      // Assertions
      expect(api.getMessages).toHaveBeenCalledWith(sid, { limit: 1000, order: 'asc' });
      expect(log).toHaveBeenCalledWith(`Error fetching messages for conversation ${sid}`, { error });
    });
  });

  describe('handleNewMessage', () => {
    beforeEach(() => {
      // Set up initial state using the mocked state
      state.TWILIO_PHONE_NUMBER = '+1234567890';
      currentConversation.sid = 'CH1234567890';
    });

    it('should handle new message from the current user without playing notification sound', () => {
      const messageData = {
        author: '+1234567890',
        conversationSid: 'CH1234567890',
        body: 'New message from me',
        dateCreated: '2024-04-01T12:10:00Z',
      };

      handleNewMessage(messageData);

      // Assertions
      expect(playNotificationSound).not.toHaveBeenCalled();
      expect(appendMessage).toHaveBeenCalledWith(messageData); // Now correctly imported from ui.js
      expect(updateConversationPreview).toHaveBeenCalledWith('CH1234567890', {
        body: 'New message from me',
        author: '+1234567890',
        dateCreated: '2024-04-01T12:10:00Z',
      });
      expect(moveConversationToTop).toHaveBeenCalledWith('CH1234567890');
      expect(incrementUnreadCount).not.toHaveBeenCalled();
    });

    it('should handle new message from another user in the current conversation', () => {
      const messageData = {
        author: '+19876543210',
        conversationSid: 'CH1234567890',
        body: 'New message from another user',
        dateCreated: '2024-04-01T12:15:00Z',
      };

      handleNewMessage(messageData);

      // Assertions
      expect(playNotificationSound).toHaveBeenCalled();
      expect(appendMessage).toHaveBeenCalledWith(messageData); // Now correctly imported from ui.js
      expect(updateConversationPreview).toHaveBeenCalledWith('CH1234567890', {
        body: 'New message from another user',
        author: '+19876543210',
        dateCreated: '2024-04-01T12:15:00Z',
      });
      expect(moveConversationToTop).toHaveBeenCalledWith('CH1234567890');
      expect(incrementUnreadCount).not.toHaveBeenCalled();
    });

    it('should handle new message from another user in a different conversation', () => {
      const messageData = {
        author: '+19876543210',
        conversationSid: 'CH0987654321',
        body: 'New message in another conversation',
        dateCreated: '2024-04-01T12:20:00Z',
      };

      handleNewMessage(messageData);

      // Assertions
      expect(playNotificationSound).toHaveBeenCalled();
      expect(appendMessage).not.toHaveBeenCalled();
      expect(incrementUnreadCount).toHaveBeenCalledWith('CH0987654321');
      expect(updateConversationPreview).toHaveBeenCalledWith('CH0987654321', {
        body: 'New message in another conversation',
        author: '+19876543210',
        dateCreated: '2024-04-01T12:20:00Z',
      });
      expect(moveConversationToTop).toHaveBeenCalledWith('CH0987654321');
    });

    it('should set dateCreated if not provided', () => {
      const messageData = {
        author: '+19876543210',
        conversationSid: 'CH1234567890',
        body: 'Message without date',
        // dateCreated is undefined
      };

      handleNewMessage(messageData);

      // Assertions
      expect(messageData.dateCreated).toBe(FIXED_DATE.toISOString());
      expect(playNotificationSound).toHaveBeenCalled();
      expect(appendMessage).toHaveBeenCalledWith({
        ...messageData,
        dateCreated: FIXED_DATE.toISOString(),
      });
      expect(updateConversationPreview).toHaveBeenCalledWith('CH1234567890', {
        body: 'Message without date',
        author: '+19876543210',
        dateCreated: FIXED_DATE.toISOString(),
      });
      expect(moveConversationToTop).toHaveBeenCalledWith('CH1234567890');
    });

    it('should not play notification sound for messages from Twilio phone number', () => {
      const messageData = {
        author: '+1234567890', // Same as state.TWILIO_PHONE_NUMBER
        conversationSid: 'CH0987654321',
        body: 'Message from Twilio number',
        dateCreated: '2024-04-01T12:25:00Z',
      };
    
      handleNewMessage(messageData);
    
      // Assertions
      expect(playNotificationSound).not.toHaveBeenCalled();
      expect(appendMessage).not.toHaveBeenCalled();
      expect(incrementUnreadCount).not.toHaveBeenCalled(); // Updated
      expect(updateConversationPreview).toHaveBeenCalledWith('CH0987654321', {
        body: 'Message from Twilio number',
        author: '+1234567890',
        dateCreated: '2024-04-01T12:25:00Z',
      });
      expect(moveConversationToTop).toHaveBeenCalledWith('CH0987654321');
    });
  });
});