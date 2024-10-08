// __tests__/websocket.test.js

const WebSocket = require('ws');
const http = require('http');
const setupWebSocket = require('../modules/websocket');
const logger = require('../modules/logger');
const broadcastModule = require('../modules/broadcast');

// Mock dependencies
jest.mock('ws');
jest.mock('../modules/logger');
jest.mock('../modules/broadcast');

describe('WebSocket Module', () => {
  let mockServer;
  let originalEnv;

  beforeEach(() => {
    mockServer = new http.Server();
    originalEnv = process.env.NODE_ENV;
    jest.resetAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should not set up WebSocket server in test environment', () => {
    process.env.NODE_ENV = 'test';
    const result = setupWebSocket(mockServer);
    
    expect(WebSocket.Server).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('WebSocket server not initialized in test environment');
    expect(result.broadcast).toBeInstanceOf(Function);
    expect(result.broadcast()).toBeUndefined();
  });

  it('should set up WebSocket server in non-test environment', () => {
    process.env.NODE_ENV = 'development';
    const mockWss = {
      on: jest.fn(),
      clients: new Set(),
    };
    WebSocket.Server.mockImplementation(() => mockWss);

    setupWebSocket(mockServer);

    expect(WebSocket.Server).toHaveBeenCalledWith({ server: mockServer });
    expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith('WebSocket server setup complete');
  });

  it('should handle new WebSocket connections', () => {
    process.env.NODE_ENV = 'development';
    const mockWs = {
      on: jest.fn(),
    };
    const mockWss = {
      on: jest.fn(),
      clients: new Set(),
    };
    WebSocket.Server.mockImplementation(() => mockWss);

    setupWebSocket(mockServer);

    // Simulate a new connection
    const connectionHandler = mockWss.on.mock.calls.find(call => call[0] === 'connection')[1];
    connectionHandler(mockWs);

    expect(logger.info).toHaveBeenCalledWith('New WebSocket connection established');
    expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('should broadcast messages to all connected clients', () => {
    process.env.NODE_ENV = 'development';
    const mockWss = {
      on: jest.fn(),
      clients: new Set([
        { readyState: WebSocket.OPEN, send: jest.fn() },
        { readyState: WebSocket.CLOSED, send: jest.fn() },
        { readyState: WebSocket.OPEN, send: jest.fn() },
      ]),
    };
    WebSocket.Server.mockImplementation(() => mockWss);

    setupWebSocket(mockServer);

    // Get the broadcast function
    const broadcast = broadcastModule.setBroadcast.mock.calls[0][0];
    const testData = { message: 'Test message' };

    broadcast(testData);

    const clientsArray = Array.from(mockWss.clients);
    expect(mockWss.clients.size).toBe(3);
    expect(clientsArray[0].send).toHaveBeenCalledWith(JSON.stringify(testData));
    expect(clientsArray[1].send).not.toHaveBeenCalled();
    expect(clientsArray[2].send).toHaveBeenCalledWith(JSON.stringify(testData));
    expect(logger.info).toHaveBeenCalledWith('Broadcasted message via WebSocket', { data: testData });
  });
});