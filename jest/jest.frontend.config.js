// jest/jest.frontend.config.js

/** @type {import('jest').Config} */
module.exports = {
  displayName: 'frontend',
  rootDir: '../', // Set rootDir to the project root
  collectCoverage: true,
  coverageDirectory: 'coverage/frontend',
  collectCoverageFrom: [
    'public/js/**/*.js', // Includes all JS files in public/js/
    '!public/js/**/*.test.js', // Excludes test files from coverage
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testEnvironment: 'jsdom', // Use jsdom for frontend testing
  testMatch: [
    '**/public/js/__tests__/**/*.test.js',
    '**/public/js/**/*.spec.js',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/jest/', // Ignore the jest/ directory
    '<rootDir>/node_modules/', // Ensure node_modules is ignored
  ],
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest', // If you're using Babel
  },
  setupFilesAfterEnv: ['<rootDir>/jest/setupFrontendTests.js'], // Ensure this file exists
  moduleNameMapper: {
    // Handle static assets
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg)$': '<rootDir>/__mocks__/fileMock.js', // Updated path
  },
};