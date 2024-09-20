// modules/search.js

const client = require('../twilioClient');

// Cache to store conversation data
let conversationCache = [];
let lastCacheUpdate = 0;

// Function to update the cache
async function updateCache() {
  console.log('Updating conversation cache');
  const now = Date.now();
  if (now - lastCacheUpdate > 60000) { // Update cache every minute
    try {
      const conversations = await client.conversations.v1.conversations.list();
      conversationCache = await Promise.all(conversations.map(async (conv) => {
        const participants = await client.conversations.v1.conversations(conv.sid).participants.list();
        const attributes = JSON.parse(conv.attributes || '{}');
        return {
          sid: conv.sid,
          friendlyName: conv.friendlyName,
          phoneNumber: participants[0]?.messagingBinding?.address || '',
          email: attributes.email || '',
          name: attributes.name || '',
          lastMessage: conv.lastMessage?.body || '',
          lastMessageTime: conv.lastMessage?.dateCreated || null,
        };
      }));
      lastCacheUpdate = now;
      console.log(`Cache updated with ${conversationCache.length} conversations`);
    } catch (error) {
      console.error('Error updating conversation cache:', error);
    }
  }
}

// Function to perform the search
function searchConversations(query) {
  console.log(`Searching conversations with query: ${query}`);
  const normalizedQuery = query.toLowerCase();
  return conversationCache.filter(conv => 
    conv.phoneNumber.includes(normalizedQuery) ||
    conv.email.toLowerCase().includes(normalizedQuery) ||
    conv.name.toLowerCase().includes(normalizedQuery) ||
    conv.friendlyName.toLowerCase().includes(normalizedQuery)
  );
}

// Initialize cache
updateCache();

// Set up interval to update cache every minute
setInterval(updateCache, 60000);

module.exports = {
  searchConversations,
  updateCache,
};