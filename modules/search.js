const client = require('../twilioClient');
const logger = require('./logger');

// Cache to store conversation data
let conversationCache = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 60 seconds

let cacheUpdateInterval;

/**
 * Updates the conversation cache by fetching data from Twilio
 */
async function updateCache() {
  const now = Date.now();
  if (now - lastCacheUpdate > CACHE_TTL) {
    try {
      logger.info('Updating conversation cache');
      const conversations = await client.conversations.v1.conversations.list();
      conversationCache = await Promise.all(
        conversations.map(async (conv) => {
          const participants = await client.conversations.v1
            .conversations(conv.sid)
            .participants.list();
          const attributes = JSON.parse(conv.attributes || '{}');
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
      lastCacheUpdate = now;
      logger.info(
        `Cache updated with ${conversationCache.length} conversations`
      );
    } catch (error) {
      logger.error('Error updating conversation cache', { error });
    }
  }
}

/**
 * Searches conversations based on the query
 * @param {string} query - The search query
 * @returns {Array} - Array of matching conversations
 */
function searchConversations(query) {
  logger.info('Performing search', { query });
  const normalizedQuery = query.toLowerCase();
  const results = conversationCache.filter(
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
  // Initial cache update
  updateCache();

  // Periodic Cache Update
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
  _conversationCache: conversationCache,
};