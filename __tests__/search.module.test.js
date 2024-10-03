// __tests__/search.module.test.js

// Set NODE_ENV to 'test' before importing any modules
process.env.NODE_ENV = 'test';

// Mock necessary modules
jest.mock('../twilioClient', () => {
  const conversationsListMock = jest.fn();
  const participantsListMock = jest.fn();
  const messagesListMock = jest.fn();

  // Mock conversation instance
  const conversationInstanceMock = jest.fn((sid) => ({
    participants: {
      list: participantsListMock,
    },
    messages: {
      list: messagesListMock,
    },
  }));

  // Make conversationsMock a jest mock function
  const conversationsMock = jest.fn((sid) => conversationInstanceMock(sid));
  conversationsMock.list = conversationsListMock;

  const clientMock = {
    conversations: {
      v1: {
        conversations: conversationsMock,
      },
    },
  };

  // Expose mocks for testing
  clientMock.__conversationsListMock = conversationsListMock;
  clientMock.__participantsListMock = participantsListMock;
  clientMock.__messagesListMock = messagesListMock;
  clientMock.__conversationInstanceMock = conversationInstanceMock;

  return clientMock;
});

jest.mock('../modules/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Import modules
const searchModule = require('../modules/search');
const client = require('../twilioClient');
const logger = require('../modules/logger');

// Start writing tests
describe('Search Module', () => {
  let dateNowSpy;

  beforeEach(() => {
    searchModule.stopCacheUpdates();

    jest.useFakeTimers(); // Use legacy timers

    // Mock Date.now()
    dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2021-01-01T00:00:00Z').getTime());

    // Reset conversationCache and lastCacheUpdate
    searchModule._cacheData.conversationCache.length = 0; // Clear the array
    searchModule._cacheData.lastCacheUpdate = 0;

    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    searchModule.stopCacheUpdates();
    jest.useRealTimers();
  });

  describe('updateCache', () => {
    it('should update the cache when called and enough time has passed', async () => {
      const mockConversations = [
        {
          sid: 'CH123',
          friendlyName: 'Test Conversation',
          attributes: '{}',
        },
      ];

      const mockParticipants = [
        {
          messagingBinding: {
            address: '+1234567890',
          },
        },
      ];

      const mockMessages = [
        {
          body: 'Last message',
          dateCreated: new Date(),
        },
      ];

      client.__conversationsListMock.mockResolvedValue(mockConversations);
      client.__participantsListMock.mockResolvedValue(mockParticipants);
      client.__messagesListMock.mockResolvedValue(mockMessages);

      await searchModule.updateCache();

      expect(searchModule._cacheData.conversationCache).toHaveLength(1);
      expect(searchModule._cacheData.conversationCache[0]).toEqual({
        sid: 'CH123',
        friendlyName: 'Test Conversation',
        phoneNumber: '+1234567890',
        email: '',
        name: '',
        lastMessage: 'Last message',
        lastMessageTime: mockMessages[0].dateCreated,
      });

      expect(logger.info).toHaveBeenCalledWith('Updating conversation cache');
      expect(logger.info).toHaveBeenCalledWith(
        'Cache updated with 1 conversations'
      );
    });

    it('should not update the cache if CACHE_TTL has not passed', async () => {
      searchModule._cacheData.lastCacheUpdate = Date.now();

      await searchModule.updateCache();

      expect(client.__conversationsListMock).not.toHaveBeenCalled();
      expect(searchModule._cacheData.conversationCache).toEqual([]);
    });

    it('should handle errors during cache update', async () => {
      const error = new Error('Twilio error');
      client.__conversationsListMock.mockRejectedValue(error);

      await searchModule.updateCache();

      expect(logger.error).toHaveBeenCalledWith(
        'Error updating conversation cache',
        { error }
      );
      expect(searchModule._cacheData.conversationCache).toEqual([]);
    });

    it('should handle conversations with no participants or messages', async () => {
      const mockConversations = [
        {
          sid: 'CH123',
          friendlyName: 'Test Conversation',
          attributes: '{}',
        },
      ];

      const mockParticipants = []; // No participants
      const mockMessages = []; // No messages

      client.__conversationsListMock.mockResolvedValue(mockConversations);
      client.__participantsListMock.mockResolvedValue(mockParticipants);
      client.__messagesListMock.mockResolvedValue(mockMessages);

      await searchModule.updateCache();

      expect(searchModule._cacheData.conversationCache).toHaveLength(1);
      expect(searchModule._cacheData.conversationCache[0]).toEqual({
        sid: 'CH123',
        friendlyName: 'Test Conversation',
        phoneNumber: '',
        email: '',
        name: '',
        lastMessage: '',
        lastMessageTime: null,
      });
    });

    it('should handle invalid JSON in conversation attributes', async () => {
      const mockConversations = [
        {
          sid: 'CH123',
          friendlyName: 'Test Conversation',
          attributes: '{invalidJson}',
        },
      ];

      const mockParticipants = [
        {
          messagingBinding: {
            address: '+1234567890',
          },
        },
      ];

      const mockMessages = [
        {
          body: 'Last message',
          dateCreated: new Date(),
        },
      ];

      client.__conversationsListMock.mockResolvedValue(mockConversations);
      client.__participantsListMock.mockResolvedValue(mockParticipants);
      client.__messagesListMock.mockResolvedValue(mockMessages);

      await searchModule.updateCache();

      expect(logger.error).toHaveBeenCalledWith(
        'Error parsing conversation attributes',
        expect.objectContaining({
          conversationSid: 'CH123',
          error: expect.any(Error),
        })
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Error updating conversation cache',
        { error: expect.any(Error) }
      );

      expect(searchModule._cacheData.conversationCache).toEqual([]);
    });
  });

  describe('searchConversations', () => {
    beforeEach(() => {
      searchModule._cacheData.conversationCache = [
        {
          sid: 'CH123',
          friendlyName: 'Test Conversation',
          phoneNumber: '+1234567890',
          email: 'test@example.com',
          name: 'Test User',
          lastMessage: 'Hello',
          lastMessageTime: new Date(),
        },
        {
          sid: 'CH124',
          friendlyName: 'Another Conversation',
          phoneNumber: '+0987654321',
          email: 'another@example.com',
          name: 'Another User',
          lastMessage: 'Hi',
          lastMessageTime: new Date(),
        },
      ];
    });

    it('should return matching conversations based on phone number', () => {
      const results = searchModule.searchConversations('+1234567890');
      expect(results).toHaveLength(1);
      expect(results[0].sid).toBe('CH123');
      expect(logger.info).toHaveBeenCalledWith('Performing search', {
        query: '+1234567890',
      });
      expect(logger.info).toHaveBeenCalledWith('Search completed', {
        query: '+1234567890',
        resultsCount: 1,
      });
    });

    it('should return matching conversations based on email', () => {
      const results = searchModule.searchConversations('test@example.com');
      expect(results).toHaveLength(1);
      expect(results[0].sid).toBe('CH123');
    });

    it('should return matching conversations based on name', () => {
      const results = searchModule.searchConversations('Test User');
      expect(results).toHaveLength(1);
      expect(results[0].sid).toBe('CH123');
    });

    it('should return matching conversations based on friendlyName', () => {
      const results = searchModule.searchConversations('Another Conversation');
      expect(results).toHaveLength(1);
      expect(results[0].sid).toBe('CH124');
    });

    it('should return empty array when no matches are found', () => {
      const results = searchModule.searchConversations('Nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should be case-insensitive', () => {
      const results = searchModule.searchConversations('test user');
      expect(results).toHaveLength(1);
      expect(results[0].sid).toBe('CH123');
    });

    it('should handle empty query', () => {
      const results = searchModule.searchConversations('');
      expect(results).toHaveLength(2);
    });

    it('should return empty array when conversationCache is empty', () => {
      searchModule._cacheData.conversationCache.length = 0;
      const results = searchModule.searchConversations('any query');
      expect(results).toHaveLength(0);
    });
  });
});