// __tests__/routes.callParams.test.js

const request = require('supertest');
const express = require('express');
const callParamsRouter = require('../routes/callParams');
const conversations = require('../modules/conversations');
const logger = require('../modules/logger');

// Mock the dependencies
jest.mock('../modules/conversations');
jest.mock('../modules/logger');

describe('GET /call-params/:sid', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/call-params', callParamsRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  it('should return From and To numbers when valid sid is provided and phoneNumber exists', async () => {
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    const mockConversation = {
      attributes: JSON.stringify({ phoneNumber: '+0987654321' }),
    };

    conversations.fetchConversation.mockResolvedValue(mockConversation);

    const response = await request(app).get('/call-params/C1234567890');

    expect(conversations.fetchConversation).toHaveBeenCalledWith('C1234567890');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      From: '+1234567890',
      To: '+0987654321',
    });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should return 404 when sid is missing', async () => {
    const response = await request(app).get('/call-params/');

    expect(response.status).toBe(404); // Express will return 404 for missing route parameters
  });

  it('should return 400 when phoneNumber is missing in conversation attributes', async () => {
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    const mockConversation = {
      attributes: JSON.stringify({}), // No phoneNumber
    };

    conversations.fetchConversation.mockResolvedValue(mockConversation);

    const response = await request(app).get('/call-params/C1234567890');

    expect(conversations.fetchConversation).toHaveBeenCalledWith('C1234567890');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'No phone number associated with this conversation.',
    });
    expect(logger.warn).toHaveBeenCalledWith('No phone number associated with conversation', {
      sid: 'C1234567890',
    });
  });

  it('should return 404 when conversation is not found', async () => {
    const mockError = new Error('Conversation not found');
    mockError.code = 20404;

    conversations.fetchConversation.mockRejectedValue(mockError);

    const response = await request(app).get('/call-params/C1234567890');

    expect(conversations.fetchConversation).toHaveBeenCalledWith('C1234567890');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Conversation C1234567890 not found.',
    });
    expect(logger.error).toHaveBeenCalledWith('Error fetching call parameters', {
      sid: 'C1234567890',
      error: mockError,
    });
  });

  it('should pass unexpected errors to the next middleware', async () => {
    const mockError = new Error('Unexpected error');
    mockError.code = 500;

    conversations.fetchConversation.mockRejectedValue(mockError);

    // To capture the next middleware, we'll need to set up an error handler
    app.use((err, req, res, next) => {
      res.status(500).json({ error: 'Internal Server Error' });
    });

    const response = await request(app).get('/call-params/C1234567890');

    expect(conversations.fetchConversation).toHaveBeenCalledWith('C1234567890');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal Server Error' });
    expect(logger.error).toHaveBeenCalledWith('Error fetching call parameters', {
      sid: 'C1234567890',
      error: mockError,
    });
  });

  it('should return 500 when conversation attributes contain invalid JSON', async () => {
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    const mockConversation = {
      attributes: 'Invalid JSON', // This will cause JSON.parse to throw
    };

    conversations.fetchConversation.mockResolvedValue(mockConversation);

    const response = await request(app).get('/call-params/C1234567890');

    expect(conversations.fetchConversation).toHaveBeenCalledWith('C1234567890');
    expect(response.status).toBe(500); // JSON.parse error should be caught as an unexpected error
    expect(response.body).toEqual({ error: 'Internal Server Error' });
    expect(logger.error).toHaveBeenCalledWith('Error fetching call parameters', {
      sid: 'C1234567890',
      error: expect.any(SyntaxError),
    });
  });
});