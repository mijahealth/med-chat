// __tests__/routes.search.test.js

// Mock the searchModule and logger
jest.mock('../modules/search');
jest.mock('../modules/logger');

const express = require('express');
const request = require('supertest');
const searchRouter = require('../routes/search');
const searchModule = require('../modules/search');
const logger = require('../modules/logger');



describe('Search Routes', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/search', searchRouter);
    
    // Error handling middleware for catching errors passed to next()
    app.use((err, req, res, next) => {
      res.status(500).json({ error: 'Internal Server Error' });
    });
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /search', () => {
    it('should return search results when valid query is provided', async () => {
      const mockResults = [{ id: 1, name: 'Test Conversation' }];
      searchModule.updateCache.mockResolvedValue();
      searchModule.searchConversations.mockReturnValue(mockResults);

      const response = await request(app)
        .get('/search')
        .query({ query: 'test' })
        .expect(200);

      expect(response.body).toEqual(mockResults);
      expect(searchModule.updateCache).toHaveBeenCalledTimes(1);
      expect(searchModule.searchConversations).toHaveBeenCalledWith('test');
      expect(logger.info).toHaveBeenCalledWith('Search completed', {
        query: 'test',
        resultsCount: mockResults.length,
      });
    });

    it('should return 400 if query parameter is missing', async () => {
      const response = await request(app)
        .get('/search')
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors[0]).toHaveProperty('msg', 'Query must be a string');
      expect(logger.warn).toHaveBeenCalledWith('Validation errors on search', {
        errors: expect.any(Array),
      });
    });

    it('should return 400 if query parameter is not a string', async () => {
      // Sending an array to simulate non-string input
      const response = await request(app)
        .get('/search')
        .query({ query: ['test', 'another'] })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors[0]).toHaveProperty('msg', 'Query must be a string');
      expect(logger.warn).toHaveBeenCalledWith('Validation errors on search', {
        errors: expect.any(Array),
      });
    });

    it('should handle errors from searchModule.updateCache and respond with 500', async () => {
      searchModule.updateCache.mockRejectedValue(new Error('Cache update failed'));

      const response = await request(app)
        .get('/search')
        .query({ query: 'test' })
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal Server Error');
      expect(searchModule.updateCache).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('Error performing search', {
        searchQuery: 'test',
        error: expect.any(Error),
      });
    });

    it('should handle errors from searchModule.searchConversations and respond with 500', async () => {
      searchModule.updateCache.mockResolvedValue();
      searchModule.searchConversations.mockImplementation(() => {
        throw new Error('Search failed');
      });

      const response = await request(app)
        .get('/search')
        .query({ query: 'test' })
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal Server Error');
      expect(searchModule.updateCache).toHaveBeenCalledTimes(1);
      expect(searchModule.searchConversations).toHaveBeenCalledWith('test');
      expect(logger.error).toHaveBeenCalledWith('Error performing search', {
        searchQuery: 'test',
        error: expect.any(Error),
      });
    });
  });
});