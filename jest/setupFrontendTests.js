// jest/setupFrontendTests.js

import '@testing-library/jest-dom';
import 'whatwg-fetch'; // If you use fetch in your code

beforeEach(() => {
  jest.resetAllMocks();
  // Add loading-spinner to the DOM
  const spinner = document.createElement('div');
  spinner.id = 'loading-spinner';
  document.body.appendChild(spinner);
});

afterEach(() => {
  // Clean up after tests
  const spinner = document.getElementById('loading-spinner');
  if (spinner) {
    document.body.removeChild(spinner);
  }
});