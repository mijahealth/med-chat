// modules/search.js
const client = require('../twilioClient');
const logger = require('./logger');

// Cache to store conversation data
let conversationCache = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 60 seconds

// Update Cache Function
async function updateCache() {
  const now = Date.now();
  if (now - lastCacheUpdate > CACHE_TTL) {
    try {
      logger.info('Updating conversation cache');
      const conversations = await client.conversations.v1.conversations.list();
      conversationCache = await Promise.all(
        conversations.map(async (conv) => {
          const participants = await client.conversations.v1.conversations(conv.sid).participants.list();
          const attributes = JSON.parse(conv.attributes || '{}');
          const messages = await client.conversations.v1.conversations(conv.sid).messages.list({limit: 1, order: 'desc'});
          const lastMessage = messages[0] ? messages[0].body : '';
          const lastMessageTime = messages[0] ? messages[0].dateCreated : null;
          return {
            sid: conv.sid,
            friendlyName: conv.friendlyName,
            phoneNumber: participants[0]?.messagingBinding?.address || '',
            email: attributes.email || '',
            name: attributes.name || '',
            lastMessage: lastMessage,
            lastMessageTime: lastMessageTime,
          };
        })
      );
      lastCacheUpdate = now;
      logger.info(`Cache updated with ${conversationCache.length} conversations`);
    } catch (error) {
      logger.error('Error updating conversation cache', { error });
    }
  }
}

// Search Function
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

// Initialize Cache
updateCache();

// Periodic Cache Update
setInterval(updateCache, CACHE_TTL);

module.exports = {
  searchConversations,
  updateCache,
};