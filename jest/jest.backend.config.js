// jest/jest.backend.config.js
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
    '/public/'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/__tests__/**/*.test.js',
    '<rootDir>/tests/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/public/',
    '<rootDir>/node_modules/'
  ],
  // ... other configurations
};