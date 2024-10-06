// public/js/__tests__/main.test.js

/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

describe('Main Module', () => {
  let initializeAppMock;
  let setupEventListenersMock;
  let closeModalMock;
  let setupWebSocketMock;
  let stateMock;
  let logMock;
  let setupCallControlsMock;
  let featherMock;

  beforeEach(() => {
    jest.resetModules(); // Clear module registry to allow fresh imports
    jest.clearAllMocks(); // Clear mock history

    // Mock implementations for all imported modules
    initializeAppMock = jest.fn();
    setupEventListenersMock = jest.fn();
    closeModalMock = jest.fn();
    setupWebSocketMock = jest.fn();
    stateMock = { appInitialized: false };
    logMock = jest.fn();
    setupCallControlsMock = jest.fn();
    featherMock = { replace: jest.fn() };

    // Mocking '../ui.js'
    jest.mock('../ui.js', () => ({
      initializeApp: initializeAppMock,
    }));

    // Mocking '../events.js'
    jest.mock('../events.js', () => ({
      setupEventListeners: setupEventListenersMock,
      closeModal: closeModalMock,
    }));

    // Mocking '../websocket.js'
    jest.mock('../websocket.js', () => ({
      setupWebSocket: setupWebSocketMock,
    }));

    // Mocking '../state.js'
    jest.mock('../state.js', () => ({
      state: stateMock,
    }));

    // Mocking '../utils.js'
    jest.mock('../utils.js', () => ({
      log: logMock,
    }));

    // Mocking '../call.js'
    jest.mock('../call.js', () => ({
      setupCallControls: setupCallControlsMock,
    }));

    // Mocking 'feather-icons'
    jest.mock('feather-icons', () => featherMock);

    // Mock global console methods to prevent actual logging during tests
    global.console = {
      ...global.console,
      error: jest.fn(),
      log: jest.fn(),
    };

    // Mock window.alert
    global.window.alert = jest.fn();

    // Mock module.hot for HMR tests
    global.module = {
      hot: {
        accept: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('initializeApplication', () => {
    let initializeApplication;

    beforeEach(async () => {
      // Import the main module after setting up mocks
      const main = await import('../main.js');
      initializeApplication = main.initializeApplication;
    });

    test('should initialize the application successfully', async () => {
      // Arrange
      initializeAppMock.mockResolvedValue(); // Simulate successful initialization

      // Act
      await initializeApplication();

      // Assert
      expect(logMock).toHaveBeenCalledWith('Initializing application...');
      expect(initializeAppMock).toHaveBeenCalledTimes(1);
      expect(setupEventListenersMock).toHaveBeenCalledTimes(1);
      expect(setupCallControlsMock).toHaveBeenCalledTimes(1);
      expect(setupWebSocketMock).toHaveBeenCalledTimes(1);
      expect(featherMock.replace).toHaveBeenCalledTimes(1);
      expect(stateMock.appInitialized).toBe(true);
      expect(logMock).toHaveBeenCalledWith('Application initialization complete');
    });

    test('should skip setupCallControls if it is not a function', async () => {
      // Arrange
      initializeAppMock.mockResolvedValue();
      
      // Redefine the mock for '../call.js' to have setupCallControls as undefined
      jest.unmock('../call.js');
      jest.mock('../call.js', () => ({
        setupCallControls: undefined,
      }));

      // Re-import the main module to apply the new mock
      const main = await import('../main.js');
      initializeApplication = main.initializeApplication;

      // Act
      await initializeApplication();

      // Assert
      expect(logMock).toHaveBeenCalledWith('Initializing application...');
      expect(initializeAppMock).toHaveBeenCalledTimes(1);
      expect(setupEventListenersMock).toHaveBeenCalledTimes(1);
      expect(setupCallControlsMock).not.toHaveBeenCalled(); // Should not be called
      expect(setupWebSocketMock).toHaveBeenCalledTimes(1);
      expect(featherMock.replace).toHaveBeenCalledTimes(1);
      expect(stateMock.appInitialized).toBe(true);
      expect(logMock).toHaveBeenCalledWith('Application initialization complete');
    });

    test('should handle errors during initialization', async () => {
      // Arrange
      const error = new Error('Initialization failed');
      initializeAppMock.mockRejectedValue(error); // Simulate initialization failure

      // Act
      await initializeApplication();

      // Assert
      expect(logMock).toHaveBeenCalledWith('Initializing application...');
      expect(initializeAppMock).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith('Error during application initialization:', error);
      expect(window.alert).toHaveBeenCalledWith('There was an error initializing the application. Please refresh.');
      expect(stateMock.appInitialized).toBe(false);
    });
  });

  describe('DOMContentLoaded Event', () => {
    let initializeApplication;
    let initializeSpy;

    beforeEach(async () => {
      // Import the main module
      const main = await import('../main.js');
      initializeApplication = main.initializeApplication;

      // Spy on initializeApplication
      initializeSpy = jest.spyOn(main, 'initializeApplication');
    });

    test('should call initializeApplication when DOM is fully loaded', () => {
      // Act
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);

      // Assert
      expect(initializeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Global Functions and Event Listeners', () => {
    beforeEach(async () => {
      // Import the main module to set up global functions and event listeners
      await import('../main.js');
    });

    test('should set window.closeModal to closeModal function', () => {
      expect(window.closeModal).toBe(closeModalMock);
    });

    test('should handle uncaught errors with window error event listener', () => {
      // Arrange
      const error = new Error('Uncaught error');

      // Act
      window.dispatchEvent(new ErrorEvent('error', { error }));

      // Assert
      expect(console.error).toHaveBeenCalledWith('Uncaught error:', error);
    });

    test('should log message when application is closing', () => {
      // Act
      window.dispatchEvent(new Event('beforeunload'));

      // Assert
      expect(logMock).toHaveBeenCalledWith('Application closing');
    });
  });

  describe('Hot Module Replacement (HMR)', () => {
    beforeEach(async () => {
      // Ensure module.hot is defined
      global.module.hot = {
        accept: jest.fn(),
      };

      // Import the main module to set up HMR
      await import('../main.js');
    });

    test('should accept module updates and re-initialize application', () => {
      // Assert that module.hot.accept was called with correct parameters
      expect(module.hot.accept).toHaveBeenCalledWith(
        [
          './ui.js',
          './events.js',
          './conversations.js',
          './websocket.js',
          './state.js',
          './utils.js',
          './call.js',
        ],
        expect.any(Function)
      );

      // Retrieve the callback function passed to module.hot.accept
      const acceptCallback = module.hot.accept.mock.calls[0][1];

      // Spy on initializeApplication to verify it gets called upon HMR
      const main = require('../main.js');
      const initializeSpy = jest.spyOn(main, 'initializeApplication');

      // Act: Invoke the HMR callback
      acceptCallback();

      // Assert
      expect(logMock).toHaveBeenCalledWith('Hot Module Replacement triggered');
      expect(initializeSpy).toHaveBeenCalled();
    });
  });
});