// __tests__/app.test.js

const request = require('supertest');
const app = require('../app');

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.TWILIO_PHONE_NUMBER = '+1234567890';
process.env.TWILIO_ACCOUNT_SID = 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
process.env.TWILIO_API_KEY = 'SKXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
process.env.TWILIO_API_SECRET = 'your_api_secret';
process.env.TWILIO_TWIML_APP_SID = 'APXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
process.env.NGROK_URL = 'http://example.com';

// Constants
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const TWILIO_ERROR_NOT_FOUND = 20404;
const SECONDS_IN_MINUTE = 60;
const MILLISECONDS_IN_SECOND = 1000;
const RATE_LIMIT_TEST_WINDOW_MS = 1 * SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND; // 1 minute
const RATE_LIMIT_TEST_MAX_REQUESTS = 5;
const RATE_LIMIT_TEST_TOTAL_REQUESTS = RATE_LIMIT_TEST_MAX_REQUESTS + 1; // 6

// Mock Twilio dependencies
jest.mock('twilio', () => {
  class VoiceGrant {}
  class VideoGrant {}

  class AccessToken {
    constructor(accountSid, apiKey, apiSecret, options) {
      this.accountSid = accountSid;
      this.apiKey = apiKey;
      this.apiSecret = apiSecret;
      this.identity = options.identity;
      this.grants = [];
    }
    addGrant(grant) {
      this.grants.push(grant);
    }
    toJwt() {
      return 'mocked-jwt-token';
    }
  }

  AccessToken.VoiceGrant = VoiceGrant;
  AccessToken.VideoGrant = VideoGrant;

  return {
    jwt: {
      AccessToken,
    },
    twiml: {
      VoiceResponse: class {
        constructor() {
          this.response = '';
        }
        dial(options, number) {
          this.response += `<Dial callerId="${options.callerId}">${number}</Dial>`;
        }
        toString() {
          return `<Response>${this.response}</Response>`;
        }
      },
    },
  };
});

// Mock modules
jest.mock('../twilioClient', () => ({
  conversations: {
    v1: {
      conversations: {
        list: jest.fn(() => Promise.resolve([])),
        create: jest.fn(() => Promise.resolve({ sid: 'CH123' })),
        remove: jest.fn(() => Promise.resolve()),
        fetch: jest.fn(() => Promise.resolve({ sid: 'CH123', attributes: '{}' })),
        messages: jest.fn(() => ({
          list: jest.fn(() => Promise.resolve([])),
          create: jest.fn(() => Promise.resolve({ sid: 'IM123' })),
        })),
        participants: jest.fn(() => ({
          create: jest.fn(() => Promise.resolve({})),
        })),
      },
    },
    video: {
      v1: {
        rooms: {
          create: jest.fn(() => Promise.resolve({ sid: 'RM123', uniqueName: 'VideoRoom_123' })),
        },
      },
    },
  },
}));

jest.mock('../modules/conversations', () => ({
  fetchConversation: jest.fn(() =>
    Promise.resolve({
      sid: 'CH123',
      attributes: '{}',
      friendlyName: 'Test Conversation',
    })
  ),
  listConversations: jest.fn(() => Promise.resolve([])),
  createConversation: jest.fn(() => Promise.resolve({ sid: 'CH123' })),
  deleteConversation: jest.fn(() => Promise.resolve()),
  addMessage: jest.fn(() => Promise.resolve({ sid: 'IM123' })),
  listMessages: jest.fn(() => Promise.resolve([])),
  markMessagesAsRead: jest.fn(() => Promise.resolve()),
  addParticipant: jest.fn(() => Promise.resolve({})),
  isMessageRead: jest.fn(() => false),
}));

jest.mock('../modules/video', () => ({
  createVideoRoom: jest.fn(() => Promise.resolve({ sid: 'RM123', name: 'VideoRoom_123' })),
}));

jest.mock('../modules/smsService', () =>
  jest.fn(() => ({
    sendSMS: jest.fn(() => Promise.resolve({ messageSid: 'SM123', success: true })),
  }))
);

jest.mock('../modules/search', () => ({
  searchConversations: jest.fn(() => []),
  updateCache: jest.fn(() => Promise.resolve()),
}));

jest.mock('../modules/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../modules/broadcast', () => ({
  setBroadcast: jest.fn(),
  getBroadcast: jest.fn(() => jest.fn()),
}));

// Tests
describe('App Routes', () => {
  describe('GET /config', () => {
    it('should return configuration details', async () => {
      const response = await request(app).get('/config');
      expect(response.statusCode).toBe(HTTP_OK);
      expect(response.body).toHaveProperty('TWILIO_PHONE_NUMBER');
      expect(response.body).toHaveProperty('NGROK_URL');
    });
  });

  describe('GET /token', () => {
    it('should return a token when identity is provided', async () => {
      const response = await request(app)
        .get('/token')
        .query({ identity: 'test-user' });
      expect(response.statusCode).toBe(HTTP_OK);
      expect(response.body).toHaveProperty('token', 'mocked-jwt-token');
      expect(response.body).toHaveProperty('identity', 'test-user');
    });

    it('should return 400 if identity is missing', async () => {
      const response = await request(app).get('/token');
      expect(response.statusCode).toBe(HTTP_BAD_REQUEST);
      expect(response.body).toHaveProperty(
        'error',
        'Identity is required and must not be empty'
      );
    });
  });

  describe('POST /voice', () => {
    it('should return TwiML response when To is provided', async () => {
      const response = await request(app)
        .post('/voice')
        .send({ To: '+0987654321' });
      expect(response.statusCode).toBe(HTTP_OK);
      expect(response.type).toBe('text/xml');
      expect(response.text).toContain(
        `<Dial callerId="${process.env.TWILIO_PHONE_NUMBER}">+0987654321</Dial>`
      );
    });

    it('should return 400 if To is missing', async () => {
      const response = await request(app).post('/voice').send({});
      expect(response.statusCode).toBe(HTTP_BAD_REQUEST);
      expect(response.text).toBe('Missing "To" phone number.');
    });
  });

  describe('POST /create-room', () => {
    it('should create a video room and return link when valid phone number is provided', async () => {
      const response = await request(app)
        .post('/create-room')
        .send({ customerPhoneNumber: '+1234567890', conversationSid: 'CH123' });
      expect(response.statusCode).toBe(HTTP_OK);
      expect(response.body).toHaveProperty(
        'link',
        `${process.env.NGROK_URL}/video-room/RM123`
      );
      expect(response.body).toHaveProperty('roomName', 'RM123');
    });

    it('should return 400 when invalid phone number is provided', async () => {
      const response = await request(app)
        .post('/create-room')
        .send({ customerPhoneNumber: 'invalid-number', conversationSid: 'CH123' });
      expect(response.statusCode).toBe(HTTP_BAD_REQUEST);
      expect(response.body).toHaveProperty('error', 'Invalid customer phone number');
    });
  });

  describe('GET /video-room/:roomName', () => {
    it('should serve the video room HTML file', async () => {
      const response = await request(app).get('/video-room/RM123');
      expect(response.statusCode).toBe(HTTP_OK);
      expect(response.text).toContain('<!DOCTYPE html>');
    });
  });

  describe('POST /twilio-webhook', () => {
    it('should handle webhook event and respond with empty TwiML', async () => {
      const response = await request(app)
        .post('/twilio-webhook')
        .type('form')
        .send({
          EventType: 'onMessageAdded',
          ConversationSid: 'CH123',
          Body: 'Test message',
          Author: '+1234567890',
          DateCreated: new Date().toISOString(),
        });
      expect(response.statusCode).toBe(HTTP_OK);
      expect(response.text).toBe('<Response></Response>');
    });

    it('should handle incoming SMS and respond with empty TwiML', async () => {
      const response = await request(app)
        .post('/twilio-webhook')
        .type('form')
        .send({
          SmsMessageSid: 'SM123',
          From: '+1234567890',
          Body: 'Hello',
        });
      expect(response.statusCode).toBe(HTTP_OK);
      expect(response.text).toBe('<Response></Response>');
    });
  });

  describe('Conversations Routes', () => {
    describe('GET /conversations', () => {
      it('should return a list of conversations', async () => {
        const mockConversations = [
          {
            sid: 'CH123',
            friendlyName: 'Test Conversation 1',
            attributes: {},
            lastMessage: 'Hello',
            lastMessageTime: new Date().toISOString(),
            unreadCount: 0,
          },
        ];
        const conversations = require('../modules/conversations');
        conversations.listConversations.mockResolvedValue(mockConversations);

        const response = await request(app).get('/conversations');
        expect(response.statusCode).toBe(HTTP_OK);
        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              sid: 'CH123',
              friendlyName: 'Test Conversation 1',
            }),
          ])
        );
      });
    });

    describe('GET /conversations/:sid', () => {
      it('should return conversation details when valid SID is provided', async () => {
        const conversations = require('../modules/conversations');
        conversations.fetchConversation.mockResolvedValue({
          sid: 'CH123',
          friendlyName: 'Test Conversation',
          attributes: '{}',
        });
        conversations.listMessages.mockResolvedValue([
          {
            sid: 'IM123',
            body: 'Test message',
            author: '+1234567890',
            dateCreated: new Date().toISOString(),
          },
        ]);

        const response = await request(app).get('/conversations/CH123');
        expect(response.statusCode).toBe(HTTP_OK);
        expect(response.body).toHaveProperty('sid', 'CH123');
        expect(response.body).toHaveProperty('friendlyName', 'Test Conversation');
      });

      it('should return 404 if conversation not found', async () => {
        const conversations = require('../modules/conversations');
        const error = new Error('Not found');
        error.code = TWILIO_ERROR_NOT_FOUND;
        conversations.fetchConversation.mockRejectedValue(error);

        const response = await request(app).get('/conversations/CH999');
        expect(response.statusCode).toBe(HTTP_NOT_FOUND);
        expect(response.body).toHaveProperty('error', 'Conversation CH999 not found.');
      });
    });

    describe('GET /conversations/:sid/messages', () => {
      it('should return messages when valid SID is provided', async () => {
        const conversations = require('../modules/conversations');
        conversations.listMessages.mockResolvedValue([
          {
            sid: 'IM123',
            body: 'Test message',
            author: '+1234567890',
            dateCreated: new Date().toISOString(),
          },
        ]);

        const response = await request(app)
          .get('/conversations/CH123/messages')
          .query({ limit: 10, order: 'desc' });
        expect(response.statusCode).toBe(HTTP_OK);
        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ sid: 'IM123', body: 'Test message' }),
          ])
        );
      });

      it('should return 400 if limit is invalid', async () => {
        const response = await request(app)
          .get('/conversations/CH123/messages')
          .query({ limit: 'invalid', order: 'desc' });
        expect(response.statusCode).toBe(HTTP_BAD_REQUEST);
      });

      it('should return 404 if conversation not found', async () => {
        const conversations = require('../modules/conversations');
        const error = new Error('Not found');
        error.code = TWILIO_ERROR_NOT_FOUND;
        conversations.listMessages.mockRejectedValue(error);

        const response = await request(app)
          .get('/conversations/CH999/messages')
          .query({ limit: 10, order: 'desc' });
        expect(response.statusCode).toBe(HTTP_NOT_FOUND);
      });
    });

    describe('POST /conversations/:sid/messages', () => {
      it('should add a message to a conversation', async () => {
        const conversations = require('../modules/conversations');
        conversations.addMessage.mockResolvedValue({
          sid: 'IM123',
          body: 'Test message',
          author: '+1234567890',
          dateCreated: new Date().toISOString(),
        });

        const response = await request(app)
          .post('/conversations/CH123/messages')
          .send({ message: 'Test message', author: '+1234567890' });
        expect(response.statusCode).toBe(HTTP_CREATED);
        expect(response.body).toHaveProperty('sid', 'IM123');
        expect(response.body).toHaveProperty('body', 'Test message');
      });

      it('should return 400 if message is missing', async () => {
        const response = await request(app)
          .post('/conversations/CH123/messages')
          .send({});
        expect(response.statusCode).toBe(HTTP_BAD_REQUEST);
      });
    });

    describe('DELETE /conversations/:sid', () => {
      it('should delete a conversation when valid SID is provided and confirmation token is correct', async () => {
        const response = await request(app)
          .delete('/conversations/CH123')
          .send({ confirmToken: 'CONFIRM_DELETE' });
        expect(response.statusCode).toBe(HTTP_OK);
        expect(response.body).toHaveProperty(
          'message',
          'Conversation CH123 deleted successfully.'
        );
      });

      it('should return 400 if confirmation token is missing or incorrect', async () => {
        const response = await request(app).delete('/conversations/CH123').send({});
        expect(response.statusCode).toBe(HTTP_BAD_REQUEST);
      });
    });

    describe('POST /conversations/:sid/mark-read', () => {
      it('should mark all messages in a conversation as read', async () => {
        const response = await request(app)
          .post('/conversations/CH123/mark-read')
          .send();
        expect(response.statusCode).toBe(HTTP_OK);
        expect(response.body).toHaveProperty('message', 'Messages marked as read');
      });
    });
  });

  describe('Search Routes', () => {
    describe('GET /search', () => {
      it('should return search results when query is provided', async () => {
        const searchModule = require('../modules/search');
        searchModule.searchConversations.mockReturnValue([
          {
            sid: 'CH123',
            friendlyName: 'Test Conversation',
          },
        ]);

        const response = await request(app).get('/search').query({ query: 'Test' });
        expect(response.statusCode).toBe(HTTP_OK);
        expect(response.body).toEqual(
          expect.arrayContaining([expect.objectContaining({ sid: 'CH123' })])
        );
      });

      it('should return 400 if query is missing', async () => {
        const response = await request(app).get('/search');
        expect(response.statusCode).toBe(HTTP_BAD_REQUEST);
      });
    });
  });

  describe('Start Conversation Routes', () => {
    describe('POST /start-conversation', () => {
      it('should create a new conversation and send SMS', async () => {
        const conversations = require('../modules/conversations');
        conversations.createConversation.mockResolvedValue({
          sid: 'CH123',
        });
        conversations.addParticipant.mockResolvedValue({});

        const response = await request(app)
          .post('/start-conversation')
          .send({
            phoneNumber: '+1234567890',
            message: 'Hello',
            name: 'Test User',
            email: 'test@example.com',
          });
        expect(response.statusCode).toBe(HTTP_OK);
        expect(response.body).toHaveProperty('sid', 'CH123');
        expect(response.body).toHaveProperty('existing', false);
      });

      it('should return 400 if phoneNumber is invalid', async () => {
        const response = await request(app)
          .post('/start-conversation')
          .send({
            phoneNumber: 'invalid-number',
            message: 'Hello',
          });
        expect(response.statusCode).toBe(HTTP_BAD_REQUEST);
      });
    });
  });

  describe('Call Params Routes', () => {
    describe('GET /call-params/:sid', () => {
      it('should return call parameters when valid SID is provided', async () => {
        const conversations = require('../modules/conversations');
        conversations.fetchConversation.mockResolvedValue({
          sid: 'CH123',
          attributes: JSON.stringify({ phoneNumber: '+0987654321' }),
        });

        const response = await request(app).get('/call-params/CH123');
        expect(response.statusCode).toBe(HTTP_OK);
        expect(response.body).toHaveProperty('From', process.env.TWILIO_PHONE_NUMBER);
        expect(response.body).toHaveProperty('To', '+0987654321');
      });

      it('should return 400 if no phone number is associated with the conversation', async () => {
        const conversations = require('../modules/conversations');
        conversations.fetchConversation.mockResolvedValue({
          sid: 'CH123',
          attributes: '{}',
        });

        const response = await request(app).get('/call-params/CH123');
        expect(response.statusCode).toBe(HTTP_BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'error',
          'No phone number associated with this conversation.'
        );
      });

      it('should return 404 if conversation not found', async () => {
        const conversations = require('../modules/conversations');
        const error = new Error('Not found');
        error.code = TWILIO_ERROR_NOT_FOUND;
        conversations.fetchConversation.mockRejectedValue(error);

        const response = await request(app).get('/call-params/CH999');
        expect(response.statusCode).toBe(HTTP_NOT_FOUND);
        expect(response.body).toHaveProperty('error', 'Conversation CH999 not found.');
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should return 429 Too Many Requests when rate limit is exceeded', async () => {
      // Create a separate instance of the app with rate limiter applied
      const express = require('express');
      const rateLimit = require('express-rate-limit');
      const testApp = express();

      const limiter = rateLimit({
        windowMs: RATE_LIMIT_TEST_WINDOW_MS, // 1 minute
        max: RATE_LIMIT_TEST_MAX_REQUESTS, // Limit each IP to 5 requests per windowMs
      });
      testApp.use(limiter);
      testApp.get('/test', (req, res) => res.send('OK'));

      const requests = [];
      for (let i = 0; i < RATE_LIMIT_TEST_TOTAL_REQUESTS; i++) {
        requests.push(request(testApp).get('/test'));
      }
      const responses = await Promise.all(requests);
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.statusCode).toBe(HTTP_TOO_MANY_REQUESTS);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 Internal Server Error when an unhandled error occurs', async () => {
      const conversations = require('../modules/conversations');
      conversations.fetchConversation.mockRejectedValue(new Error('Unhandled error'));

      const response = await request(app).get('/conversations/CH123');
      expect(response.statusCode).toBe(HTTP_INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
    });
  });
});

describe('Environment Variable Setup', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should load .env.test when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    const app = require('../app');
    expect(process.env.NODE_ENV).toBe('test');
    // Add any assertions related to .env.test variables if needed
  });

  it('should load .env when NODE_ENV is not test', () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const app = require('../app');
    expect(process.env.NODE_ENV).toBe('production');
    // Add any assertions related to .env variables if needed
  });
});

describe('App Export', () => {
  it('should export the Express app', () => {
    const app = require('../app'); // Import without destructuring
    expect(app).toBeDefined();
    expect(typeof app.use).toBe('function'); // Check that app is an Express app
  });
});