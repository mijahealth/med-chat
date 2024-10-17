/** @type {import('jest').Config} */
module.exports = {
  displayName: 'backend',
  rootDir: '../',
  coverageDirectory: 'coverage/backend',
  collectCoverageFrom: [
    'app.js',
    'routes/**/*.js',
    'modules/**/*.js',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/public/',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80,
    },
  },
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/__tests__/**/*.test.js',
    '<rootDir>/tests/**/*.test.js',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/public/',
    '<rootDir>/node_modules/',
  ],
  moduleNameMapper: {
    '^modules/logger$': '<rootDir>/__mocks__/logger.js',
    '^modules/broadcast$': '<rootDir>/__mocks__/broadcast.js',
    '^twilioClient$': '<rootDir>/__mocks__/twilioClient.js',
    '^modules/conversations$': '<rootDir>/__mocks__/conversations.js',
    '^modules/smsService$': '<rootDir>/__mocks__/smsService.js',
    '^modules/websocket$': '<rootDir>/__mocks__/websocket.js',
    '^modules/video$': '<rootDir>/__mocks__/video.js',
  },
  modulePathIgnorePatterns: ['<rootDir>/public/js/__mocks__'], // Add this line
  // ... other configurations
};