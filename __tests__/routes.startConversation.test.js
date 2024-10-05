// __tests__/routes.startConversation.test.js

// Set NODE_ENV before importing any modules
process.env.NODE_ENV = 'test';
process.env.TWILIO_PHONE_NUMBER = '+10987654321'; // Set a mock Twilio phone number

// Mock necessary modules before importing the route
jest.mock('../modules/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../modules/conversations', () => ({
  createConversation: jest.fn(),
  addParticipant: jest.fn(),
  listMessages: jest.fn(),
}));

jest.mock('../modules/broadcast', () => ({
  setBroadcast: jest.fn(),
  getBroadcast: jest.fn(() => jest.fn()),
}));

// Correctly mock smsService to return a function that returns an object with sendSMS
jest.mock('../modules/smsService', () =>
  jest.fn(() => ({
    sendSMS: jest.fn(() =>
      Promise.resolve({ messageSid: 'SM123', success: true })
    ),
  }))
);

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

// Import the route after setting up mocks
const startConversationRoute = require('../routes/startConversation');
const conversations = require('../modules/conversations');
const smsServiceFactory = require('../modules/smsService');
const broadcastModule = require('../modules/broadcast');
const logger = require('../modules/logger');

describe('POST /startConversation', () => {
  let app;
  let sendSMSMock;

  beforeAll(() => {
    app = express();
    app.use(bodyParser.json());
    app.use('/', startConversationRoute);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the SMS service and broadcast module
    sendSMSMock = jest
      .fn()
      .mockResolvedValue({ messageSid: 'SM123', success: true });

    // Ensure smsServiceFactory returns an object with sendSMS
    smsServiceFactory.mockReturnValue({ sendSMS: sendSMSMock });
    broadcastModule.getBroadcast.mockReturnValue({});
  });

  it('should start a conversation successfully with valid data', async () => {
    const phoneNumber = '+12345678901';
    const message = 'Hello, this is a test message';
    const name = 'Test User';
    const email = 'test@example.com';
    const dob = '1990-01-01';
    const state = 'CA';

    const conversationSid = 'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    conversations.createConversation.mockResolvedValue({
      sid: conversationSid,
    });

    conversations.addParticipant.mockResolvedValue({});

    const res = await request(app)
      .post('/')
      .send({ phoneNumber, message, name, email, dob, state });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ sid: conversationSid, existing: false });

    expect(conversations.createConversation).toHaveBeenCalledWith(
      name,
      expect.objectContaining({
        email,
        name,
        phoneNumber,
        dob,
        state,
      })
    );

    expect(conversations.addParticipant).toHaveBeenCalledWith(
      conversationSid,
      phoneNumber
    );

    expect(sendSMSMock).toHaveBeenCalledWith(
      phoneNumber,
      expect.stringContaining(message),
      conversationSid,
      process.env.TWILIO_PHONE_NUMBER
    );

    expect(logger.info).toHaveBeenCalledWith(
      'Starting new conversation',
      expect.objectContaining({
        phoneNumber,
        name,
        email,
        dob,
        state,
      })
    );
  });

  it('should return 400 when phoneNumber is missing', async () => {
    const message = 'Hello, this is a test message';
    const res = await request(app).post('/').send({ message });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('errors');
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'phoneNumber', // Changed from 'param' to 'path'
          msg: 'Invalid phone number format',
        }),
      ])
    );
  });

  it('should return 400 when phoneNumber is invalid', async () => {
    const phoneNumber = '12345';
    const message = 'Hello, this is a test message';

    const res = await request(app)
      .post('/')
      .send({ phoneNumber, message });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('errors');
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'phoneNumber', // Changed from 'param' to 'path'
          msg: 'Invalid phone number format',
        }),
      ])
    );
  });

  it('should return 400 when message is empty', async () => {
    const phoneNumber = '+12345678901';
    const message = '';

    const res = await request(app)
      .post('/')
      .send({ phoneNumber, message });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('errors');
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'message', // Changed from 'param' to 'path'
          msg: 'Message content cannot be empty',
        }),
      ])
    );
  });

  it('should start conversation when optional fields are missing', async () => {
    const phoneNumber = '+12345678901';
    const message = 'Hello, this is a test message';

    const conversationSid = 'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    conversations.createConversation.mockResolvedValue({
      sid: conversationSid,
    });

    conversations.addParticipant.mockResolvedValue({});

    const res = await request(app).post('/').send({ phoneNumber, message });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ sid: conversationSid, existing: false });

    expect(conversations.createConversation).toHaveBeenCalledWith(
      `Conversation with ${phoneNumber}`,
      expect.objectContaining({
        email: undefined,
        name: undefined,
        phoneNumber,
        dob: undefined,
        state: undefined,
      })
    );

    expect(conversations.addParticipant).toHaveBeenCalledWith(
      conversationSid,
      phoneNumber
    );

    expect(sendSMSMock).toHaveBeenCalledWith(
      phoneNumber,
      expect.stringContaining(message),
      conversationSid,
      process.env.TWILIO_PHONE_NUMBER
    );
  });

  it('should handle error when conversation creation fails', async () => {
    const phoneNumber = '+12345678901';
    const message = 'Hello, this is a test message';
    const errorMsg = 'Conversation creation failed';

    conversations.createConversation.mockRejectedValue(new Error(errorMsg));

    const res = await request(app)
      .post('/')
      .send({ phoneNumber, message });

    expect(res.statusCode).toEqual(500);

    expect(logger.error).toHaveBeenCalledWith(
      'Error in start conversation route',
      expect.objectContaining({
        error: errorMsg,
        stack: expect.any(String),
      })
    );
  });

  it('should handle error when adding participant fails', async () => {
    const phoneNumber = '+12345678901';
    const message = 'Hello, this is a test message';
    const errorMsg = 'Add participant failed';

    const conversationSid = 'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    conversations.createConversation.mockResolvedValue({
      sid: conversationSid,
    });

    conversations.addParticipant.mockRejectedValue(new Error(errorMsg));

    const res = await request(app)
      .post('/')
      .send({ phoneNumber, message });

    expect(res.statusCode).toEqual(500);

    expect(logger.error).toHaveBeenCalledWith(
      'Error in start conversation route',
      expect.objectContaining({
        error: errorMsg,
        stack: expect.any(String),
      })
    );
  });

  it('should handle error when sending SMS fails', async () => {
    const phoneNumber = '+12345678901';
    const message = 'Hello, this is a test message';
    const errorMsg = 'SMS sending failed';

    const conversationSid = 'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    conversations.createConversation.mockResolvedValue({
      sid: conversationSid,
    });

    conversations.addParticipant.mockResolvedValue({});

    sendSMSMock.mockRejectedValue(new Error(errorMsg));

    const res = await request(app)
      .post('/')
      .send({ phoneNumber, message });

    expect(res.statusCode).toEqual(500);

    expect(logger.error).toHaveBeenCalledWith(
      'Error in start conversation route',
      expect.objectContaining({
        error: errorMsg,
        stack: expect.any(String),
      })
    );
  });
  it('should handle invalid email format', async () => {
    const phoneNumber = '+12345678901';
    const message = 'Test message';
    const email = 'invalid-email';

    const res = await request(app)
      .post('/')
      .send({ phoneNumber, message, email });

    expect(res.statusCode).toEqual(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'email',
          msg: 'Invalid email format',
        }),
      ])
    );
  });

  it('should handle invalid date of birth format', async () => {
    const phoneNumber = '+12345678901';
    const message = 'Test message';
    const dob = 'invalid-date';

    const res = await request(app)
      .post('/')
      .send({ phoneNumber, message, dob });

    expect(res.statusCode).toEqual(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'dob',
          msg: 'Invalid date format',
        }),
      ])
    );
  });

  it('should handle error when logging latest message fails', async () => {
    const phoneNumber = '+12345678901';
    const message = 'Test message';
    const conversationSid = 'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    conversations.createConversation.mockResolvedValue({ sid: conversationSid });
    conversations.addParticipant.mockResolvedValue({});
    conversations.listMessages.mockRejectedValue(new Error('Failed to list messages'));

    const res = await request(app)
      .post('/')
      .send({ phoneNumber, message });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ sid: conversationSid, existing: false });

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching latest message After conversation creation',
      expect.objectContaining({
        conversationSid,
        error: 'Failed to list messages',
      })
    );
  });

  it('should handle successful message logging', async () => {
    const phoneNumber = '+12345678901';
    const message = 'Test message';
    const conversationSid = 'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const latestMessage = {
      sid: 'MSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      author: 'system',
      body: 'Test message',
      dateCreated: new Date().toISOString(),
    };

    conversations.createConversation.mockResolvedValue({ sid: conversationSid });
    conversations.addParticipant.mockResolvedValue({});
    conversations.listMessages.mockResolvedValue([latestMessage]);

    const res = await request(app)
      .post('/')
      .send({ phoneNumber, message });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ sid: conversationSid, existing: false });

    expect(logger.info).toHaveBeenCalledWith(
      'Latest message After conversation creation',
      expect.objectContaining({
        conversationSid,
        messageSid: latestMessage.sid,
        author: latestMessage.author,
        body: latestMessage.body,
        dateCreated: latestMessage.dateCreated,
      })
    );
  });

  it('should handle case when no messages are found', async () => {
    const phoneNumber = '+12345678901';
    const message = 'Test message';
    const conversationSid = 'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    conversations.createConversation.mockResolvedValue({ sid: conversationSid });
    conversations.addParticipant.mockResolvedValue({});
    conversations.listMessages.mockResolvedValue([]);

    const res = await request(app)
      .post('/')
      .send({ phoneNumber, message });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ sid: conversationSid, existing: false });

    expect(logger.info).toHaveBeenCalledWith(
      'No messages found After conversation creation',
      { conversationSid }
    );
  });

  it('should include disclaimer in the first message', async () => {
    const phoneNumber = '+12345678901';
    const message = 'Test message';
    const conversationSid = 'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    conversations.createConversation.mockResolvedValue({ sid: conversationSid });
    conversations.addParticipant.mockResolvedValue({});

    const res = await request(app)
      .post('/')
      .send({ phoneNumber, message });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ sid: conversationSid, existing: false });

    expect(sendSMSMock).toHaveBeenCalledWith(
      phoneNumber,
      expect.stringContaining('Test message'),
      conversationSid,
      process.env.TWILIO_PHONE_NUMBER
    );

    expect(sendSMSMock).toHaveBeenCalledWith(
      phoneNumber,
      expect.stringContaining('(Note: you may reply STOP to no longer receive messages from us. Msg&Data Rates may apply.)'),
      conversationSid,
      process.env.TWILIO_PHONE_NUMBER
    );
  });
});