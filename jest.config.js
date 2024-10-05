// jest.config.js

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    '<rootDir>/jest/jest.backend.config.js',
    '<rootDir>/jest/jest.frontend.config.js', // Ensure this is included
    // Future frontend config paths can be added here
    // "<rootDir>/jest/jest.anotherFrontend.config.js"
  ],
};