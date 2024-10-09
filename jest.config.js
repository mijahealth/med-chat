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
        '\\.(css|less|scss|sass)$': '<rootDir>/public/js/__mocks__/styleMock.js',
        '\\.(gif|ttf|eot|svg|png|jpg|jpeg)$': '<rootDir>/public/js/__mocks__/fileMock.js',
        '^twilio-client$': '<rootDir>/public/js/__mocks__/twilio-client.js',
      },
      transform: {
        '^.+\\.jsx?$': 'babel-jest',
      },
    },
  ],
};