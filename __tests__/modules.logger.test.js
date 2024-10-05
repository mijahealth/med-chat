// __tests__/modules.logger.test.js

const logger = require('../modules/logger');
const winston = require('winston');

describe('Logger Module', () => {
  let mockTransport;
  let originalConsoleTransport;

  beforeAll(() => {
    // Store the original Console transport to restore later
    originalConsoleTransport = logger.transports.find(
      (t) => t instanceof winston.transports.Console
    );

    // Create a mock transport with a jest.fn() for the log method
    mockTransport = new winston.transports.Console();
    mockTransport.log = jest.fn((info, callback) => {
      callback();
    });

    // Replace the original Console transport with the mock transport
    logger.remove(originalConsoleTransport);
    logger.add(mockTransport);
  });

  afterAll(() => {
    // Restore the original Console transport after all tests
    logger.remove(mockTransport);
    logger.add(originalConsoleTransport);
  });

  beforeEach(() => {
    // Clear all mock calls before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(logger).toBeDefined();
  });

  it('should log info level messages', () => {
    const message = 'This is an info message';
    logger.info(message);

    expect(mockTransport.log).toHaveBeenCalledTimes(1);
    const logArgs = mockTransport.log.mock.calls[0][0];
    expect(logArgs.level).toBe('info');
    expect(logArgs.message).toBe(message);
    expect(logArgs).toHaveProperty('timestamp');
  });

  it('should log warn level messages', () => {
    const message = 'This is a warning message';
    logger.warn(message);

    expect(mockTransport.log).toHaveBeenCalledTimes(1);
    const logArgs = mockTransport.log.mock.calls[0][0];
    expect(logArgs.level).toBe('warn');
    expect(logArgs.message).toBe(message);
    expect(logArgs).toHaveProperty('timestamp');
  });

  it('should log error level messages with metadata', () => {
    const message = 'This is an error message';
    const meta = { errorCode: 500, user: 'testUser' };
    logger.error(message, meta);

    expect(mockTransport.log).toHaveBeenCalledTimes(1);
    const logArgs = mockTransport.log.mock.calls[0][0];
    expect(logArgs.level).toBe('error');
    expect(logArgs.message).toBe(message);
    expect(logArgs).toHaveProperty('timestamp');
    expect(logArgs).toMatchObject(meta);
  });

  it('should format log messages correctly', () => {
    const message = 'Formatted log message';
    const meta = { action: 'testing', status: 'success' };
    logger.info(message, meta);

    expect(mockTransport.log).toHaveBeenCalledTimes(1);
    const logArgs = mockTransport.log.mock.calls[0][0];

    // Check if all required properties are present
    expect(logArgs).toHaveProperty('timestamp');
    expect(logArgs).toHaveProperty('level', 'info');
    expect(logArgs).toHaveProperty('message', message);
    expect(logArgs).toMatchObject(meta);

    // Optionally, verify the formatted string
    // Since the formatter uses printf, the actual formatted message is sent to the transport's output.
    // To test the formatted message, you would need to capture the transport's output stream.
    // This is more complex and generally not necessary unless you have custom formatting logic.
  });

  it('should handle logging without metadata', () => {
    const message = 'Logging without metadata';
    logger.info(message);

    expect(mockTransport.log).toHaveBeenCalledTimes(1);
    const logArgs = mockTransport.log.mock.calls[0][0];
    expect(logArgs.level).toBe('info');
    expect(logArgs.message).toBe(message);
    expect(logArgs).toHaveProperty('timestamp');
  });

  it('should handle multiple log levels sequentially', () => {
    const infoMsg = 'Info message';
    const warnMsg = 'Warn message';
    const errorMsg = 'Error message';
    const errorMeta = { errorCode: 404 };

    logger.info(infoMsg);
    logger.warn(warnMsg);
    logger.error(errorMsg, errorMeta);

    expect(mockTransport.log).toHaveBeenCalledTimes(3);

    const [infoLog, warnLog, errorLog] = mockTransport.log.mock.calls;

    // Info log assertions
    expect(infoLog[0].level).toBe('info');
    expect(infoLog[0].message).toBe(infoMsg);
    expect(infoLog[0]).toHaveProperty('timestamp');

    // Warn log assertions
    expect(warnLog[0].level).toBe('warn');
    expect(warnLog[0].message).toBe(warnMsg);
    expect(warnLog[0]).toHaveProperty('timestamp');

    // Error log assertions
    expect(errorLog[0].level).toBe('error');
    expect(errorLog[0].message).toBe(errorMsg);
    expect(errorLog[0]).toHaveProperty('timestamp');
    expect(errorLog[0]).toMatchObject(errorMeta);
  });
});