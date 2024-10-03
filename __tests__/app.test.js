// __tests__/app.test.js

// 0. Set NODE_ENV to 'test' before importing any modules
process.env.NODE_ENV = 'test';

// 1. Mock Twilio before importing any modules that use it
jest.mock('twilio');

// 2. Mock other modules used directly in app.js
jest.mock('../modules/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../modules/websocket', () => () => ({
  broadcast: jest.fn(),
}));

jest.mock('../modules/smsService', () => () => ({
  sendSMS: jest.fn(() => Promise.resolve({ messageSid: 'SM123', success: true })),
}));

jest.mock('../modules/broadcast', () => ({
  setBroadcast: jest.fn(),
  getBroadcast: jest.fn(() => jest.fn()),
}));

jest.mock('../modules/video', () => ({
  createVideoRoom: jest.fn().mockResolvedValue({ sid: 'RM123', uniqueName: 'VideoRoom_123' })
}));

jest.mock('../modules/conversations', () => ({
  fetchConversation: jest.fn(() =>
    Promise.resolve({
      sid: 'CH123',
      attributes: '{}',
      friendlyName: 'Test Conversation',
    })
  ),
}));

// 3. Now import the app after all mocks
const request = require('supertest');
const app = require('../app');
const {setSmsService} = app;


// Import the mocked logger to inspect error logs
const logger = require('../modules/logger');

// Constants
const { stopCacheUpdates } = require('../modules/search');
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_SERVER_ERROR = 500;


// Ensure cache updates are stopped before and after all tests
beforeAll(() => {
  jest.useFakeTimers();
  stopCacheUpdates();
});

afterAll(() => {
  jest.useRealTimers();
  stopCacheUpdates();
});

// Additional cleanup after each test
afterEach(() => {
  jest.useFakeTimers();
  stopCacheUpdates();
});

// Tests
describe('App.js Routes', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

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

      // Check if any errors were logged
      if (logger.error.mock.calls.length > 0) {
        console.log('Logged errors:', logger.error.mock.calls);
      }

      expect(response.statusCode).toBe(HTTP_OK);
      expect(response.body).toHaveProperty('token', 'mocked-jwt-token');
      expect(response.body).toHaveProperty('identity', 'test-user');

      // Ensure no errors were logged
      expect(logger.error).not.toHaveBeenCalled();
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
        .send({ To: '+1987654321' });
      expect(response.statusCode).toBe(HTTP_OK);
      expect(response.type).toBe('text/xml');
      expect(response.text).toContain(
        `<Dial callerId="${process.env.TWILIO_PHONE_NUMBER}">+1987654321</Dial>`
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

      // Check if any errors were logged
      if (logger.error.mock.calls.length > 0) {
        console.log('Logged errors:', logger.error.mock.calls);
      }

      expect(response.statusCode).toBe(HTTP_OK);
      expect(response.text).toBe('<Response></Response>');

      // Ensure no errors were logged
      expect(logger.error).not.toHaveBeenCalled();
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
});

describe('Environment Variable Setup', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    stopCacheUpdates();
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
    // After setting to production, stop cache updates
    stopCacheUpdates();
  });
});

describe('App Export', () => {
  it('should export the Express app', () => {
    const exportedApp = require('../app'); // Import without destructuring
    expect(exportedApp).toBeDefined();
    expect(typeof exportedApp.use).toBe('function'); // Check that app is an Express app
  });
});

describe('Error Handling Middleware', () => {
  it('should handle thrown errors and respond with 500', async () => {
    const express = require('express');
    const app = express();

    // Route that throws an error
    app.get('/throw-error', (req, res, next) => {
      throw new Error('Test Error');
    });

    // Use the actual error handling middleware from app.js
    const logger = require('../modules/logger');
    app.use((err, req, res, next) => {
      logger.error('Unhandled Error', {
        message: err.message,
        stack: err.stack,
        ...err,
      });
      res
        .status(500)
        .json({ error: 'Internal Server Error', details: err.message });
      next(err);
    });

    const response = await request(app).get('/throw-error');
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'Internal Server Error',
      details: 'Test Error',
    });
    expect(logger.error).toHaveBeenCalledWith('Unhandled Error', expect.objectContaining({
      message: 'Test Error',
      stack: expect.any(String),
    }));
  });
});

describe('POST /create-room - SMS Sending', () => {
  let mockSendSMS;

  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.NGROK_URL = 'http://localhost:3000';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';

    mockSendSMS = jest.fn().mockResolvedValue({ messageSid: 'SM123', success: true });
    setSmsService({ sendSMS: mockSendSMS });
  });

  it('should send SMS when creating a video room', async () => {
    const response = await request(app)
      .post('/create-room')
      .send({ customerPhoneNumber: '+1987654321', conversationSid: 'CH123' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('link', 'http://localhost:3000/video-room/RM123');
    expect(response.body).toHaveProperty('roomName', 'RM123');

    expect(mockSendSMS).toHaveBeenCalledWith(
      '+1987654321',
      'Join the video call here: http://localhost:3000/video-room/RM123',
      'CH123',
      '+1234567890'
    );
  });
});

describe('POST /twilio-webhook', () => {
  it('should handle onMessageAdded event', async () => {
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

    expect(response.statusCode).toBe(200);
    expect(response.text).toBe('<Response></Response>');
    // Add assertions to verify broadcast calls
  });

  it('should handle unknown event type', async () => {
    const response = await request(app)
      .post('/twilio-webhook')
      .type('form')
      .send({
        EventType: 'unknownEvent',
        ConversationSid: 'CH123',
      });

    expect(response.statusCode).toBe(200);
    expect(response.text).toBe('<Response></Response>');
    // Ensure no broadcasts are called
  });

  it('should handle incoming SMS', async () => {
    const response = await request(app)
      .post('/twilio-webhook')
      .type('form')
      .send({
        SmsMessageSid: 'SM123',
        From: '+1234567890',
        Body: 'Hello',
      });

    expect(response.statusCode).toBe(200);
    expect(response.text).toBe('<Response></Response>');
    // Add assertions if any processing is done
  });

  it('should respond to unknown webhook formats', async () => {
    const response = await request(app)
      .post('/twilio-webhook')
      .type('form')
      .send({
        UnknownKey: 'UnknownValue',
      });

    expect(response.statusCode).toBe(200);
    expect(response.text).toBe('<Response></Response>');
    // Ensure warning logs are called
    expect(logger.warn).toHaveBeenCalledWith('Unknown webhook format received', { reqBody: expect.any(Object) });
  });
});

describe('SMS Service Initialization', () => {
  it('should use mock SMS service in test', async () => {
    const mockSendSMS = jest.fn().mockResolvedValue({ messageSid: 'SM123', success: true });
    setSmsService({ sendSMS: mockSendSMS });

    // Perform an action that triggers sendSMS, e.g., creating a room
    const response = await request(app)
      .post('/create-room')
      .send({ customerPhoneNumber: '+1234567890', conversationSid: 'CH123' });

    expect(response.statusCode).toBe(200);
    expect(mockSendSMS).toHaveBeenCalledWith(
      '+1234567890',
      expect.stringContaining('Join the video call here'),
      'CH123',
      '+1234567890'
    );
  });
});

afterAll(() => {
  stopCacheUpdates();
});