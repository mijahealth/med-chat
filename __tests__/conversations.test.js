// __tests__/conversations.test.js

// Set NODE_ENV and TWILIO_PHONE_NUMBER before importing any modules
process.env.NODE_ENV = 'test';
process.env.TWILIO_PHONE_NUMBER = '+1234567890';

// Mock necessary modules
jest.mock('../modules/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../modules/conversations', () => ({
  fetchConversation: jest.fn(),
  listConversations: jest.fn(),
  addMessage: jest.fn(),
  listMessages: jest.fn(),
  deleteConversation: jest.fn(),
  markMessagesAsRead: jest.fn(),
  isMessageRead: jest.fn(),
}));

jest.mock('../modules/broadcast', () => ({
  getBroadcast: jest.fn(),
}));

// Import modules
const request = require('supertest');
const app = require('../app');
const conversations = require('../modules/conversations');
const logger = require('../modules/logger');
const { getBroadcast } = require('../modules/broadcast');

// Constants
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

describe('Conversations Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /conversations', () => {
    it('should return a list of all conversations', async () => {
      const mockConversations = [
        {
          sid: 'CH123',
          friendlyName: 'Test Conversation',
          attributes: { phoneNumber: '+0987654321' },
          lastMessage: 'Hello!',
          lastMessageTime: new Date().toISOString(),
          unreadCount: 2,
        },
      ];
      conversations.listConversations.mockResolvedValue(mockConversations);

      const response = await request(app).get('/conversations');

      expect(response.status).toBe(HTTP_OK);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sid: 'CH123',
            friendlyName: 'Test Conversation',
            lastMessage: 'Hello!',
            unreadCount: 2,
          }),
        ])
      );
    });

    it('should handle errors when fetching conversations', async () => {
      conversations.listConversations.mockRejectedValue(
        new Error('Error fetching conversations')
      );

      const response = await request(app).get('/conversations');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
    });
  });

  describe('GET /conversations/:sid', () => {
    it('should return conversation details when valid sid is provided', async () => {
      const mockConversation = {
        sid: 'CH123',
        friendlyName: 'Test Conversation',
        attributes: JSON.stringify({ phoneNumber: '+0987654321' }),
      };

      const mockMessages = [
        {
          sid: 'IM123',
          body: 'Hello',
          author: '+1234567890', // Twilio number
          dateCreated: new Date().toISOString(),
          attributes: '{}',
        },
      ];

      const mockAllMessages = [
        {
          sid: 'IM123',
          body: 'Hello',
          author: '+0987654321', // Customer's number
          dateCreated: new Date().toISOString(),
          attributes: JSON.stringify({ read: false }),
        },
        {
          sid: 'IM124',
          body: 'Hi',
          author: '+0987654321',
          dateCreated: new Date().toISOString(),
          attributes: JSON.stringify({ read: true }),
        },
      ];

      conversations.fetchConversation.mockResolvedValue(mockConversation);
      conversations.listMessages
        .mockResolvedValueOnce(mockMessages) // For latest message
        .mockResolvedValueOnce(mockAllMessages); // For unread count
      conversations.isMessageRead.mockImplementation((msg) => {
        const attributes = JSON.parse(msg.attributes || '{}');
        return attributes.read || false;
      });

      const response = await request(app).get('/conversations/CH123');

      expect(response.status).toBe(HTTP_OK);
      expect(response.body).toEqual({
        sid: 'CH123',
        friendlyName: 'Test Conversation',
        attributes: { phoneNumber: '+0987654321' },
        lastMessage: 'Hello',
        lastMessageTime: expect.any(String),
        unreadCount: 1,
      });
    });

    it('should handle invalid JSON in conversation attributes', async () => {
      const mockConversation = {
        sid: 'CH123',
        friendlyName: 'Test Conversation',
        attributes: '{invalidJson}',
      };

      const mockMessages = [
        {
          sid: 'IM123',
          body: 'Hello',
          author: '+1234567890',
          dateCreated: new Date().toISOString(),
          attributes: '{}',
        },
      ];

      const mockAllMessages = [
        {
          sid: 'IM123',
          body: 'Hello',
          author: '+0987654321',
          dateCreated: new Date().toISOString(),
          attributes: JSON.stringify({ read: false }),
        },
      ];

      conversations.fetchConversation.mockResolvedValue(mockConversation);
      conversations.listMessages
        .mockResolvedValueOnce(mockMessages)
        .mockResolvedValueOnce(mockAllMessages);
      conversations.isMessageRead.mockImplementation((msg) => {
        const attributes = JSON.parse(msg.attributes || '{}');
        return attributes.read || false;
      });

      const response = await request(app).get('/conversations/CH123');

      expect(response.status).toBe(HTTP_OK);
      expect(response.body).toEqual({
        sid: 'CH123',
        friendlyName: 'Test Conversation',
        attributes: {},
        lastMessage: 'Hello',
        lastMessageTime: expect.any(String),
        unreadCount: 1,
      });
    });

    it('should return 404 if conversation not found', async () => {
      const error = new Error('Conversation not found');
      error.code = 20404;
      conversations.fetchConversation.mockRejectedValue(error);

      const response = await request(app).get('/conversations/CH123');

      expect(response.status).toBe(HTTP_NOT_FOUND);
      expect(response.body).toHaveProperty('error', 'Conversation CH123 not found.');
    });

    it('should handle errors when fetching conversation', async () => {
      const error = new Error('Error fetching conversation');
      error.code = 500;
      conversations.fetchConversation.mockRejectedValue(error);

      const response = await request(app).get('/conversations/CH123');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
    });
  });

  describe('GET /conversations/:sid/messages', () => {
    it('should return messages in a conversation', async () => {
      const mockMessages = [
        {
          sid: 'IM123',
          body: 'Hello',
          author: '+0987654321',
          dateCreated: new Date().toISOString(),
        },
        {
          sid: 'IM124',
          body: 'Hi',
          author: '+0987654321',
          dateCreated: new Date().toISOString(),
        },
      ];

      conversations.listMessages.mockResolvedValue(mockMessages);

      const response = await request(app).get('/conversations/CH123/messages');

      expect(response.status).toBe(HTTP_OK);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sid: 'IM123', body: 'Hello' }),
          expect.objectContaining({ sid: 'IM124', body: 'Hi' }),
        ])
      );
    });

    it('should return 404 if conversation not found', async () => {
      const error = new Error('Conversation not found');
      error.code = 20404;
      conversations.listMessages.mockRejectedValue(error);

      const response = await request(app).get('/conversations/CH123/messages');

      expect(response.status).toBe(HTTP_NOT_FOUND);
      expect(response.body).toHaveProperty('error', 'Conversation CH123 not found.');
    });

    it('should handle validation errors for invalid limit', async () => {
      const response = await request(app).get(
        '/conversations/CH123/messages?limit=invalid'
      );

      expect(response.status).toBe(HTTP_BAD_REQUEST);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle validation errors for invalid order', async () => {
      const response = await request(app).get(
        '/conversations/CH123/messages?order=invalidOrder'
      );

      expect(response.status).toBe(HTTP_BAD_REQUEST);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle errors when listing messages', async () => {
      const error = new Error('Error listing messages');
      conversations.listMessages.mockRejectedValue(error);

      const response = await request(app).get('/conversations/CH123/messages');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
    });
  });

  describe('POST /conversations/:sid/messages', () => {
    it('should add a message to a conversation', async () => {
      const mockMessage = {
        sid: 'IM123',
        body: 'Test message',
        author: '+0987654321',
        dateCreated: new Date().toISOString(),
      };
      conversations.addMessage.mockResolvedValue(mockMessage);

      const response = await request(app)
        .post('/conversations/CH123/messages')
        .send({ message: 'Test message', author: '+0987654321' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining(mockMessage));
    });

    it('should return 400 if message is invalid', async () => {
      const response = await request(app)
        .post('/conversations/CH123/messages')
        .send({ message: '' });

      expect(response.status).toBe(HTTP_BAD_REQUEST);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 404 if conversation not found when adding message', async () => {
      const error = new Error('Conversation not found');
      error.code = 20404;
      conversations.addMessage.mockRejectedValue(error);

      const response = await request(app)
        .post('/conversations/CH123/messages')
        .send({ message: 'Test message', author: '+0987654321' });

      expect(response.status).toBe(HTTP_NOT_FOUND);
      expect(response.body).toHaveProperty('error', 'Conversation CH123 not found.');
    });

    it('should handle errors when adding message', async () => {
      const error = new Error('Error adding message');
      conversations.addMessage.mockRejectedValue(error);

      const response = await request(app)
        .post('/conversations/CH123/messages')
        .send({ message: 'Test message', author: '+0987654321' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
    });
  });

  describe('POST /conversations/:sid/mark-read', () => {
    it('should mark all messages in a conversation as read', async () => {
      conversations.markMessagesAsRead.mockResolvedValue();

      const response = await request(app).post('/conversations/CH123/mark-read');

      expect(response.status).toBe(HTTP_OK);
      expect(response.body).toHaveProperty('message', 'Messages marked as read');
    });

    it('should handle errors when marking messages as read', async () => {
      const error = new Error('Error marking messages as read');
      conversations.markMessagesAsRead.mockRejectedValue(error);

      const response = await request(app).post('/conversations/CH123/mark-read');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
    });
  });

  describe('DELETE /conversations/:sid', () => {
    it('should delete a conversation', async () => {
      conversations.deleteConversation.mockResolvedValue();

      const response = await request(app)
        .delete('/conversations/CH123')
        .send({ confirmToken: 'CONFIRM_DELETE' });

      expect(response.status).toBe(HTTP_OK);
      expect(response.body).toHaveProperty(
        'message',
        'Conversation CH123 deleted successfully.'
      );
    });

    it('should return 404 if the conversation does not exist', async () => {
      const error = new Error('Conversation not found');
      error.code = 20404;
      conversations.deleteConversation.mockRejectedValue(error);

      const response = await request(app)
        .delete('/conversations/CH123')
        .send({ confirmToken: 'CONFIRM_DELETE' });

      expect(response.status).toBe(HTTP_NOT_FOUND);
      expect(response.body).toHaveProperty('error', 'Conversation CH123 not found.');
    });

    it('should return 400 if confirm token is missing or invalid', async () => {
      const response = await request(app).delete('/conversations/CH123').send({});

      expect(response.status).toBe(HTTP_BAD_REQUEST);
      expect(response.body).toHaveProperty(
        'error',
        'Invalid or missing confirmation token.'
      );
    });

    it('should handle errors when deleting conversation', async () => {
      const error = new Error('Error deleting conversation');
      conversations.deleteConversation.mockRejectedValue(error);

      const response = await request(app)
        .delete('/conversations/CH123')
        .send({ confirmToken: 'CONFIRM_DELETE' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
    });
  });
});