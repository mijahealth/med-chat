// modules/search.js

const client = require('../twilioClient');
const logger = require('./logger');

// Cache to store conversation data
const cacheData = {
  conversationCache: [],
  lastCacheUpdate: 0,
};
const CACHE_TTL = 60000; // 60 seconds

let cacheUpdateInterval;

/**
 * Updates the conversation cache by fetching data from Twilio
 */
const updateCache = async () => {
  const now = Date.now();
  if (now - cacheData.lastCacheUpdate > CACHE_TTL) {
    try {
      logger.info('Updating conversation cache');
      const conversations = await client.conversations.v1.conversations.list();
      cacheData.conversationCache = await Promise.all(
        conversations.map(async (conv) => {
          let attributes = {};
          try {
            attributes = JSON.parse(conv.attributes || '{}');
          } catch (err) {
            logger.error('Error parsing conversation attributes', {
              error: err,
              conversationSid: conv.sid,
            });
            throw err; // Re-throw to be caught in outer catch block
          }
          const participants = await client.conversations.v1
            .conversations(conv.sid)
            .participants.list();
          const messages = await client.conversations.v1
            .conversations(conv.sid)
            .messages.list({ limit: 1, order: 'desc' });
          const lastMessage = messages[0] ? messages[0].body : '';
          const lastMessageTime = messages[0] ? messages[0].dateCreated : null;
          return {
            sid: conv.sid,
            friendlyName: conv.friendlyName,
            phoneNumber: participants[0]?.messagingBinding?.address || '',
            email: attributes.email || '',
            name: attributes.name || '',
            lastMessage,
            lastMessageTime,
          };
        })
      );
      cacheData.lastCacheUpdate = now;
      logger.info(
        `Cache updated with ${cacheData.conversationCache.length} conversations`
      );
    } catch (error) {
      logger.error('Error updating conversation cache', { error });
      cacheData.conversationCache = []; // Clear cache on error
    }
  }
};

/**
 * Searches conversations based on the query
 * @param {string} query - The search query
 * @returns {Array} - Array of matching conversations
 */
function searchConversations(query) {
  logger.info('Performing search', { query });
  const normalizedQuery = query.toLowerCase();
  const results = cacheData.conversationCache.filter(
    (conv) =>
      conv.phoneNumber.includes(normalizedQuery) ||
      conv.email.toLowerCase().includes(normalizedQuery) ||
      conv.name.toLowerCase().includes(normalizedQuery) ||
      conv.friendlyName.toLowerCase().includes(normalizedQuery)
  );
  logger.info('Search completed', { query, resultsCount: results.length });
  return results;
}

/**
 * Initializes the cache update process
 */
function initializeCacheUpdates() {
  updateCache();
  cacheUpdateInterval = setInterval(updateCache, CACHE_TTL);
}

/**
 * Stops the cache update process
 */
function stopCacheUpdates() {
  if (cacheUpdateInterval) {
    clearInterval(cacheUpdateInterval);
    cacheUpdateInterval = null;
  }
}

// Only initialize cache updates if not in test environment
if (process.env.NODE_ENV !== 'test') {
  initializeCacheUpdates();
}

module.exports = {
  searchConversations,
  updateCache,
  initializeCacheUpdates,
  stopCacheUpdates,
  // Exporting for testing purposes
  _cacheData: cacheData,
  CACHE_TTL,
};