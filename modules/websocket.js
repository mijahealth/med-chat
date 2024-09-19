// websocket.js
const WebSocket = require('ws');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    ws.on('message', (message) => {
      console.log('Received message:', message);
    });
    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });

  function broadcast(data) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  return { wss, broadcast };
}

module.exports = setupWebSocket;