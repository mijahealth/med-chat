const WebSocket = require('ws');
const http = require('http');
const setupWebSocket = require('../modules/websocket');
const logger = require('../modules/logger');
const broadcastModule = require('../modules/broadcast');

jest.mock('ws');
jest.mock('../modules/logger');
jest.mock('../modules/broadcast');

describe('WebSocket Module', () => {
  let server;
  let mockWss;
  let mockWs;

  beforeEach(() => {
    server = new http.Server();
    mockWss = {
      on: jest.fn(),
      clients: new Set(),
    };
    mockWs = {
      on: jest.fn(),
      send: jest.fn(),
      readyState: WebSocket.OPEN,
    };
    WebSocket.Server.mockImplementation(() => mockWss);
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not set up WebSocket server in test environment', () => {
    process.env.NODE_ENV = 'test';
    const result = setupWebSocket(server);
    expect(WebSocket.Server).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('WebSocket server not initialized in test environment');
    expect(result.broadcast).toBeInstanceOf(Function);
  });

  it('should set up WebSocket server correctly', () => {
    setupWebSocket(server);
    expect(WebSocket.Server).toHaveBeenCalledWith({ server });
    expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith('WebSocket server setup complete');
  });

  it('should handle new connections', () => {
    setupWebSocket(server);
    const connectionHandler = mockWss.on.mock.calls[0][1];
    connectionHandler(mockWs);
    expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith('New WebSocket connection established');
  });

  it('should handle incoming messages', () => {
    setupWebSocket(server);
    const connectionHandler = mockWss.on.mock.calls[0][1];
    connectionHandler(mockWs);
    const messageHandler = mockWs.on.mock.calls[0][1];
    messageHandler('test message');
    expect(logger.info).toHaveBeenCalledWith('Received WebSocket message', { message: 'test message' });
  });

  it('should handle connection close', () => {
    setupWebSocket(server);
    const connectionHandler = mockWss.on.mock.calls[0][1];
    connectionHandler(mockWs);
    const closeHandler = mockWs.on.mock.calls[1][1];
    closeHandler();
    expect(logger.info).toHaveBeenCalledWith('WebSocket connection closed');
  });

  it('should broadcast messages to all connected clients', () => {
    const { broadcast } = setupWebSocket(server);
    mockWss.clients.add(mockWs);
    broadcast({ type: 'test', data: 'message' });
    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'test', data: 'message' }));
    expect(logger.info).toHaveBeenCalledWith('Broadcasted message via WebSocket', { data: { type: 'test', data: 'message' } });
  });

  it('should set broadcast function in broadcastModule', () => {
    setupWebSocket(server);
    expect(broadcastModule.setBroadcast).toHaveBeenCalledWith(expect.any(Function));
  });
});