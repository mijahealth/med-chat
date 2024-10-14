// __mocks__/websocket.js

const mockWebsocket = jest.fn(() => ({
    broadcast: jest.fn(),
  }));
  
  module.exports = mockWebsocket;