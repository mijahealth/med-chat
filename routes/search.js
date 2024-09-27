// routes/search.js
const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const logger = require('../modules/logger');
const searchModule = require('../modules/search');

// GET /search?query=...
router.get(
  '/',
  [query('query').isString().withMessage('Query must be a string')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors on search', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { query: searchQuery } = req.query;
    if (!searchQuery) {
      logger.warn('Empty search query received');
      return res.status(400).json({ error: 'Search query is required' });
    }

    try {
      await searchModule.updateCache(); // Ensure cache is up-to-date
      const results = searchModule.searchConversations(searchQuery);
      logger.info('Search completed', {
        query: searchQuery,
        resultsCount: results.length,
      });
      res.json(results);
    } catch (error) {
      logger.error('Error performing search', { searchQuery, error });
      next(error);
    }
  },
);

module.exports = router;
