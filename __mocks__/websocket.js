// __mocks__/websocket.js

const mockBroadcast = jest.fn();

const setupWebSocket = jest.fn(() => ({
  broadcast: mockBroadcast
}));

module.exports = setupWebSocket;