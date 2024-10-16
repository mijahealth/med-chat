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
  moduleDirectories: ['node_modules', 'public/js'],
  resetMocks: true,
  clearMocks: true,
  restoreMocks: true,
  modulePathIgnorePatterns: [
    '<rootDir>/__mocks__',    // Ignore backend mocks
    '<rootDir>/__tests__',    // Ignore backend tests
    '<rootDir>/modules/',     // Optionally ignore backend modules
    '<rootDir>/routes/',      // Optionally ignore backend routes
  ],
};