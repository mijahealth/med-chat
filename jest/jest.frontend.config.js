/** @type {import('jest').Config} */
module.exports = {
  displayName: 'frontend',
  rootDir: '../',  // Correctly points to the project root
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
    '\\.(css|less|scss|sass)$': '<rootDir>/public/js/__mocks__/styleMock.js',
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg)$': '<rootDir>/public/js/__mocks__/fileMock.js',
    '^twilio-client$': '<rootDir>/public/js/__mocks__/twilio-client.js',
  },
  moduleDirectories: ['node_modules', 'public/js'],
  resetMocks: true,
  clearMocks: true,
  restoreMocks: true,
};