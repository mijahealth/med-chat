// modules/websocket.js
const WebSocket = require('ws');
const logger = require('./logger');
const broadcastModule = require('./broadcast');

/**
 * Sets up WebSocket server and returns broadcast function
 * @param {http.Server} server 
 * @returns {Object} - Contains broadcast method
 */
function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    logger.info('New WebSocket connection established');

    ws.on('message', (message) => {
      logger.info('Received WebSocket message', { message });
      // Handle incoming messages if needed
    });

    ws.on('close', () => {
      logger.info('WebSocket connection closed');
    });
  });

  /**
   * Broadcasts data to all connected WebSocket clients
   * @param {Object} data 
   */
  function broadcast(data) {
    const dataString = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(dataString);
      }
    });
    logger.info('Broadcasted message via WebSocket', { data });
  }

  // Set the broadcast function in the singleton module
  broadcastModule.setBroadcast(broadcast);

  logger.info('WebSocket server setup complete');

  return { broadcast };
}

module.exports = setupWebSocket;