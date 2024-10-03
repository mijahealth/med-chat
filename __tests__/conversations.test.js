// __tests__/conversations.test.js

// Set NODE_ENV to 'test' before importing any modules
process.env.NODE_ENV = 'test';

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
}));

// Import modules
const request = require('supertest');
const app = require('../app');
const conversations = require('../modules/conversations');
const logger = require('../modules/logger');

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
          phoneNumber: '+1234567890',
          email: 'test@example.com',
          name: 'Test Name',
          lastMessage: 'Hello!',
          lastMessageTime: new Date().toISOString(),
          unreadCount: 2,
        },
      ];
      conversations.listConversations.mockResolvedValue(mockConversations);

      const response = await request(app).get('/conversations');

      expect(response.status).toBe(HTTP_OK);
      expect(response.body).toEqual(expect.arrayContaining([
        expect.objectContaining({
          sid: 'CH123',
          friendlyName: 'Test Conversation',
          lastMessage: 'Hello!',
          unreadCount: 2,
        }),
      ]));
    });

    it('should handle errors when fetching conversations', async () => {
      conversations.listConversations.mockRejectedValue(new Error('Error fetching conversations'));

      const response = await request(app).get('/conversations');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
    });
  });

  describe('POST /conversations/:sid/messages', () => {
    it('should add a message to a conversation', async () => {
      const mockMessage = {
        sid: 'IM123',
        body: 'Test message',
        author: '+1234567890',
        dateCreated: new Date().toISOString(),
      };
      conversations.addMessage.mockResolvedValue(mockMessage);

      const response = await request(app)
        .post('/conversations/CH123/messages')
        .send({ message: 'Test message', author: '+1234567890' });

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
  });

  describe('POST /conversations/:sid/mark-read', () => {
    it('should mark all messages in a conversation as read', async () => {
      conversations.markMessagesAsRead.mockResolvedValue();

      const response = await request(app).post('/conversations/CH123/mark-read');
      
      expect(response.status).toBe(HTTP_OK);
      expect(response.body).toHaveProperty('message', 'Messages marked as read');
    });
  });

  describe('DELETE /conversations/:sid', () => {
    it('should delete a conversation', async () => {
      conversations.deleteConversation.mockResolvedValue();

      const response = await request(app)
        .delete('/conversations/CH123')
        .send({ confirmToken: 'CONFIRM_DELETE' });
      
      expect(response.status).toBe(HTTP_OK);
      expect(response.body).toHaveProperty('message', 'Conversation CH123 deleted successfully.');
    });

    it('should return 404 if the conversation does not exist', async () => {
      conversations.deleteConversation.mockRejectedValue({ code: 20404 });

      const response = await request(app)
        .delete('/conversations/CH123')
        .send({ confirmToken: 'CONFIRM_DELETE' });

      expect(response.status).toBe(HTTP_NOT_FOUND);
      expect(response.body).toHaveProperty('error', 'Conversation CH123 not found.');
    });

    it('should return 400 if confirm token is missing or invalid', async () => {
      const response = await request(app).delete('/conversations/CH123').send({});
      
      expect(response.status).toBe(HTTP_BAD_REQUEST);
      expect(response.body).toHaveProperty('error', 'Invalid or missing confirmation token.');
    });
  });
});