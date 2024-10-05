// jest/setupFrontendTests.js

import '@testing-library/jest-dom';
import 'whatwg-fetch'; // If you use fetch in your code

beforeEach(() => {
    jest.resetAllMocks();
  });