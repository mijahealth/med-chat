// __tests__/logger.test.js

const logger = require('../modules/logger');

describe('Logger Module', () => {
  it('should have info, warn, and error methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should log info messages without throwing', () => {
    expect(() => logger.info('Test info message')).not.toThrow();
  });

  it('should log warn messages without throwing', () => {
    expect(() => logger.warn('Test warn message')).not.toThrow();
  });

  it('should log error messages without throwing', () => {
    expect(() => logger.error('Test error message')).not.toThrow();
  });
});