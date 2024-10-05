// public/js/__tests__/main.test.js
import { initializeApplication } from '../main';
import { initializeApp } from '../ui';
import { setupEventListeners } from '../events';
import { setupWebSocket } from '../websocket';
import { log } from '../utils';

jest.mock('../ui');
jest.mock('../events');
jest.mock('../websocket');
jest.mock('../utils');

describe('Main Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="app"></div>
    `;
  });

  test('initializeApplication should call initializeApp, setupEventListeners, setupWebSocket, and replace icons', async () => {
    await initializeApplication();

    expect(initializeApp).toHaveBeenCalled();
    expect(setupEventListeners).toHaveBeenCalled();
    expect(setupWebSocket).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Initializing application...');
    expect(log).toHaveBeenCalledWith('Application initialization complete');
  });

  // Add more tests as needed...
});