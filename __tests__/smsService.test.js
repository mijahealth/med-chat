// __tests__/smsService.test.js

// Set NODE_ENV to 'test' before importing any modules
process.env.NODE_ENV = 'test';

// Set necessary environment variables
process.env.TWILIO_PHONE_NUMBER = '+1234567890';
process.env.NGROK_URL = 'http://localhost:3000';

// Mock necessary modules
jest.mock('../twilioClient', () => {
  const messagesCreateMock = jest.fn();
  const conversationsFetchMock = jest.fn();
  const conversationsMock = jest.fn((sid) => ({
    messages: {
      create: messagesCreateMock,
    },
    fetch: conversationsFetchMock,
  }));

  const clientMock = {
    conversations: {
      v1: {
        conversations: conversationsMock,
      },
    },
    messages: {
      create: jest.fn(),
    },
  };

  // Expose the mocks to be accessible in tests
  clientMock.__messagesCreateMock = messagesCreateMock;
  clientMock.__conversationsFetchMock = conversationsFetchMock;
  clientMock.__conversationsMock = conversationsMock;

  return clientMock;
});

jest.mock('../modules/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Import modules
const smsServiceFactory = require('../modules/smsService');
const client = require('../twilioClient');
const logger = require('../modules/logger');

// Start writing tests
describe('smsService', () => {
  let smsService;
  let mockBroadcast;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock broadcast function
    mockBroadcast = jest.fn();

    // Create smsService instance
    smsService = smsServiceFactory(mockBroadcast);
  });

  describe('sendSMS', () => {
    it('should send SMS via Conversation when conversationSid is provided', async () => {
      const to = '+1987654321';
      const body = 'Test message';
      const conversationSid = 'CH123';
      const author = '+1234567890';

      // Mock Twilio client's methods
      const mockConversationMessage = { sid: 'IM123' };
      client.__messagesCreateMock.mockResolvedValue(mockConversationMessage);

      const mockConversation = {
        sid: conversationSid,
        friendlyName: 'Test Conversation',
        attributes: '{}',
      };
      client.__conversationsFetchMock.mockResolvedValue(mockConversation);

      const result = await smsService.sendSMS(to, body, conversationSid, author);

      expect(result).toEqual({ success: true, messageSid: 'IM123' });

      // Ensure Twilio client's methods were called correctly
      expect(client.conversations.v1.conversations).toHaveBeenCalledWith(conversationSid);
      expect(client.__messagesCreateMock).toHaveBeenCalledWith({
        body,
        author: author || process.env.TWILIO_PHONE_NUMBER,
      });

      expect(client.__conversationsFetchMock).toHaveBeenCalled();

      // Ensure broadcast was called
      expect(mockBroadcast).toHaveBeenCalledTimes(2);

      // Ensure logger was used
      expect(logger.info).toHaveBeenCalledWith('Sending SMS via Conversation', {
        conversationSid,
        body,
      });
    });

    it('should send SMS via Messages API when conversationSid is not provided', async () => {
      const to = '+1987654321';
      const body = 'Test message';

      const mockMessage = { sid: 'SM123' };
      client.messages.create.mockResolvedValue(mockMessage);

      const result = await smsService.sendSMS(to, body);

      expect(result).toEqual({ success: true, messageSid: 'SM123' });

      // Ensure Twilio client's methods were called correctly
      expect(client.messages.create).toHaveBeenCalledWith({
        body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to,
      });

      // Ensure broadcast was called
      expect(mockBroadcast).toHaveBeenCalledTimes(1);

      // Ensure logger was used
      expect(logger.info).toHaveBeenCalledWith('Sending SMS via Twilio Messages API', {
        to,
        body,
      });
    });

    it('should prevent sending duplicate messages', async () => {
      const to = '+1987654321';
      const body = 'Test message';

      const mockMessage = { sid: 'SM123' };
      client.messages.create.mockResolvedValue(mockMessage);

      const result1 = await smsService.sendSMS(to, body);
      const result2 = await smsService.sendSMS(to, body);

      expect(result1).toEqual({ success: true, messageSid: 'SM123' });
      expect(result2).toBeNull();

      // Ensure client.messages.create was called only once
      expect(client.messages.create).toHaveBeenCalledTimes(1);

      // Ensure logger.warn was called for duplicate
      expect(logger.warn).toHaveBeenCalledWith('Duplicate SMS detected', {
        to,
        body,
        messageKey: `${to}-${body}`,
      });
    });

    it('should handle error when sending SMS via Conversation', async () => {
      const to = '+1987654321';
      const body = 'Test message';
      const conversationSid = 'CH123';
      const author = '+1234567890';

      const error = new Error('Twilio error');
      error.code = 20001;
      error.moreInfo = 'https://www.twilio.com/docs/errors/20001';

      client.__messagesCreateMock.mockRejectedValue(error);

      await expect(
        smsService.sendSMS(to, body, conversationSid, author)
      ).rejects.toThrow('Twilio error');

      // Ensure logger.error was called
      expect(logger.error).toHaveBeenCalledWith('Error sending SMS', {
        to,
        body,
        conversationSid,
        error: error.message,
        twilioCode: error.code,
        twilioMoreInfo: error.moreInfo,
      });
    });

    it('should handle error when sending SMS via Messages API', async () => {
      const to = '+1987654321';
      const body = 'Test message';

      const error = new Error('Twilio error');
      error.code = 20001;
      error.moreInfo = 'https://www.twilio.com/docs/errors/20001';

      client.messages.create.mockRejectedValue(error);

      await expect(smsService.sendSMS(to, body)).rejects.toThrow('Twilio error');

      // Ensure logger.error was called
      expect(logger.error).toHaveBeenCalledWith('Error sending SMS', {
        to,
        body,
        conversationSid: null,
        error: error.message,
        twilioCode: error.code,
        twilioMoreInfo: error.moreInfo,
      });
    });

    it('should log a warning if broadcast function is not available', async () => {
      const to = '+1987654321';
      const body = 'Test message';

      // Create smsService instance without broadcast function
      smsService = smsServiceFactory(null);

      const mockMessage = { sid: 'SM123' };
      client.messages.create.mockResolvedValue(mockMessage);

      const result = await smsService.sendSMS(to, body);

      expect(result).toEqual({ success: true, messageSid: 'SM123' });

      // Ensure logger.warn was called
      expect(logger.warn).toHaveBeenCalledWith(
        'Broadcast function is not available',
        expect.any(Object)
      );
    });

    it('should handle exceptions when fetching conversation for update', async () => {
      const to = '+1987654321';
      const body = 'Test message';
      const conversationSid = 'CH123';
      const author = '+1234567890';

      const mockConversationMessage = { sid: 'IM123' };
      client.__messagesCreateMock.mockResolvedValue(mockConversationMessage);

      const error = new Error('Fetch conversation error');
      client.__conversationsFetchMock.mockRejectedValue(error);

      const result = await smsService.sendSMS(to, body, conversationSid, author);

      expect(result).toEqual({ success: true, messageSid: 'IM123' });

      // Ensure logger.error was called
      expect(logger.error).toHaveBeenCalledWith('Error fetching conversation for update', {
        conversationSid,
        error,
      });
    });
  });
});