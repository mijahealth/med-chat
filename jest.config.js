// jest.config.js
/** @type {import('jest').Config} */
module.exports = {
  projects: [
    '<rootDir>/jest/jest.backend.config.js', // Backend configurations
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/public/js/__tests__/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/jest/setupFrontendTests.js'],
      moduleNameMapper: {
        '\\.(css|less|sass|scss)$': '<rootDir>/jest/__mocks__/styleMock.js',
        '\\.(gif|ttf|eot|svg)$': '<rootDir>/jest/__mocks__/fileMock.js',
        '^feather-icons$': '<rootDir>/jest/__mocks__/feather-icons.js', // Ensure feather-icons is mocked
      },
      transform: {
        '^.+\\.jsx?$': 'babel-jest',
      },
    },
  ],
};