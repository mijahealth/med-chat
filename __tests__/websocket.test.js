// __tests__/websocket.test.js

const http = require('http');
const WebSocket = require('ws');
const setupWebSocket = require('../modules/websocket');
const logger = require('../modules/logger');

jest.mock('ws');
jest.mock('../modules/logger');

describe('WebSocket Module', () => {
  let server;

  beforeEach(() => {
    server = http.createServer();
    WebSocket.Server.mockClear();
  });

  afterEach(() => {
    jest.resetModules();
    delete process.env.NODE_ENV;
  });

  it('should not initialize WebSocket server in test environment', () => {
    process.env.NODE_ENV = 'test';
    const { broadcast } = setupWebSocket(server);
    expect(broadcast).toBeDefined();
    expect(typeof broadcast).toBe('function');
    broadcast({ message: 'test' }); // Should not throw
    expect(WebSocket.Server).not.toHaveBeenCalled();
  });

  it('should initialize WebSocket server in non-test environment', () => {
    process.env.NODE_ENV = 'development';
    const { broadcast } = setupWebSocket(server);
    expect(WebSocket.Server).toHaveBeenCalledWith({ server });
    expect(broadcast).toBeDefined();
    expect(typeof broadcast).toBe('function');
  });

  it('should broadcast messages to connected clients', () => {
    process.env.NODE_ENV = 'development';
    const mockClient = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
    };
    WebSocket.Server.mockImplementation(() => ({
      on: jest.fn(),
      clients: [mockClient],
    }));

    const { broadcast } = setupWebSocket(server);
    const message = { type: 'test', data: 'test data' };
    broadcast(message);
    expect(mockClient.send).toHaveBeenCalledWith(JSON.stringify(message));
    expect(logger.info).toHaveBeenCalledWith('Broadcasted message via WebSocket', { data: message });
  });
});