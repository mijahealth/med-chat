// jest/setupFrontendTests.js
/** @type {import('jest').Config} */
module.exports = {
  projects: [
    '<rootDir>/jest/jest.backend.config.js',    // Backend configurations
    '<rootDir>/jest/jest.frontend.config.js',   // Frontend configurations
  ],
};