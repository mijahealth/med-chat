// jest/jest.backend.config.js

/** @type {import('jest').Config} */
module.exports = {
  displayName: 'backend',
  rootDir: '../', // Set rootDir to the project root
  collectCoverage: true,
  coverageDirectory: 'coverage/backend',
  collectCoverageFrom: [
    'app.js',
    'routes/**/*.js',
    'modules/**/*.js',
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
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js?(x)',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/jest/',        // Ignore the jest/ directory
    '<rootDir>/node_modules/', // Ensure node_modules is ignored
  ],
  // Ensure 'preset' is not set unless necessary
};