// jest.config.js
/** @type {import('jest').Config} */
module.exports = {
  displayName: 'frontend',
  rootDir: '../', // Correctly points to the project root
  coverageDirectory: 'coverage/frontend',
  collectCoverageFrom: [
    'public/js/**/*.js',
    '!public/js/**/*.test.js',
    '!public/js/**/*.spec.js',
    '!public/js/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/public/js/__tests__/**/*.test.js',
    '<rootDir>/public/js/**/*.spec.js',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
  ],
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/jest/setupFrontendTests.js'],
  moduleNameMapper: {
    // '^./api.js$': '<rootDir>/public/js/__mocks__/api.js',
    // '^./state.js$': '<rootDir>/public/js/__mocks__/state.js',
    // '^./conversations.js$': '<rootDir>/public/js/__mocks__/conversations.js',
    // '^./ui.js$': '<rootDir>/public/js/__mocks__/ui.js',
    // '^./utils.js$': '<rootDir>/public/js/__mocks__/utils.js',
    // Add other module mappings as needed, excluding the ones being mocked
  },
  moduleDirectories: ['node_modules', 'public/js'],
  resetMocks: true,
  clearMocks: true,
  restoreMocks: true,
};