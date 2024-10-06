// jest/jest.frontend.config.js
/** @type {import('jest').Config} */
module.exports = {
  displayName: 'frontend',
  rootDir: '../',
  coverageDirectory: 'coverage/frontend',
  collectCoverageFrom: [
    'public/js/**/*.js',
    '!public/js/**/*.test.js',
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
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg)$': '<rootDir>/jest/__mocks__/fileMock.js',
  },
};