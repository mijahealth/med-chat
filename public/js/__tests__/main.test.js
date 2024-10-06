/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

// ---------------------------
// Mocking External Modules
// ---------------------------

// Mock '../ui.js' module
jest.mock('../ui.js', () => ({
  __esModule: true,
  initializeApp: jest.fn(),
}));

// Mock '../events.js' module
jest.mock('../events.js', () => ({
  __esModule: true,
  setupEventListeners: jest.fn(),
  closeModal: jest.fn(),
}));

// Mock '../websocket.js' module
jest.mock('../websocket.js', () => ({
  __esModule: true,
  setupWebSocket: jest.fn(),
}));

// Mock '../state.js' module
jest.mock('../state.js', () => ({
  __esModule: true,
  state: { appInitialized: false },
}));

// Mock '../utils.js' module
jest.mock('../utils.js', () => ({
  __esModule: true,
  log: jest.fn(),
}));

// Mock '../call.js' module
jest.mock('../call.js', () => ({
  __esModule: true,
  setupCallControls: jest.fn(),
}));

// Mock 'feather-icons' module
const mockReplace = jest.fn();
jest.mock('feather-icons', () => ({
  __esModule: true,
  default: {
    replace: mockReplace,
  },
}));

// ---------------------------
// Test Suite for Main Module
// ---------------------------

describe('Main Module', () => {
  let setupEventListenersMock;
  let closeModalMock;
  let setupWebSocketMock;
  let stateMock;
  let logMock;
  let featherMock;

  // ---------------------------
  // Common Setup for Each Test
  // ---------------------------
  beforeEach(() => {
    jest.resetModules(); // Reset module registry
    jest.clearAllMocks(); // Clear mock history

    // Require modules after resetting to apply mocks
    const eventsModule = require('../events.js');
    const websocketModule = require('../websocket.js');
    const stateModule = require('../state.js');
    const utilsModule = require('../utils.js');
    const callModule = require('../call.js');
    const featherModule = require('feather-icons');

    // Set up spies on mocked functions
    setupEventListenersMock = jest.spyOn(eventsModule, 'setupEventListeners');
    closeModalMock = jest.spyOn(eventsModule, 'closeModal');
    setupWebSocketMock = jest.spyOn(websocketModule, 'setupWebSocket');
    stateMock = stateModule.state;
    logMock = jest.spyOn(utilsModule, 'log');
    // Note: Do not set up a spy on setupCallControls here
    // It will be handled within individual tests as needed

    featherMock = featherModule.default;

    // Mock global objects
    global.console = {
      ...global.console,
      error: jest.fn(),
      log: jest.fn(),
    };

    global.window.alert = jest.fn();

    // Mock module.hot for HMR
    global.module = {
      hot: {
        accept: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.resetAllMocks(); // Reset all mocks
    delete global.module; // Remove global.module to prevent leaks
  });

  // -----------------------------------
  // Tests for initializeApplication
  // -----------------------------------
  describe('initializeApplication', () => {
    let initializeApplication;
    let initializeAppMock;
    let main;

    beforeEach(async () => {
      // Import main.js after setting up mocks
      main = await import('../main.js');
      initializeApplication = main.initializeApplication;

      const uiModule = await import('../ui.js');
      initializeAppMock = jest.spyOn(uiModule, 'initializeApp');
    });

    test('should initialize the application successfully', async () => {
      initializeAppMock.mockResolvedValue();
      
      await initializeApplication();
      
      console.log('Mock function calls:');
      console.log('initializeApp:', initializeAppMock.mock.calls);
      console.log('setupEventListeners:', setupEventListenersMock.mock.calls);
      console.log('setupWebSocket:', setupWebSocketMock.mock.calls);
      console.log('feather.replace:', featherMock.replace.mock.calls);

      // Assertions to verify the initialization flow
      expect(logMock).toHaveBeenCalledWith('Initializing application...');
      expect(initializeAppMock).toHaveBeenCalledTimes(1);
      expect(setupEventListenersMock).toHaveBeenCalledTimes(1);
      expect(setupWebSocketMock).toHaveBeenCalledTimes(1);
      expect(featherMock.replace).toHaveBeenCalledTimes(1);
      expect(stateMock.appInitialized).toBe(true);
      expect(logMock).toHaveBeenCalledWith('Application initialization complete');
    });

    test('should skip setupCallControls if it is not a function', async () => {
      // Use jest.isolateModules to isolate module mocking
      await jest.isolateModules(async () => {
        // Dynamically mock '../call.js' with setupCallControls as undefined
        await jest.doMock('../call.js', () => ({
          __esModule: true,
          setupCallControls: undefined,
        }));

        // Re-import main.js after setting up the new mock
        const mainModule = await import('../main.js');
        const initializeApplication = mainModule.initializeApplication;

        // Re-require necessary modules
        const eventsModule = require('../events.js');
        const websocketModule = require('../websocket.js');
        const stateModule = require('../state.js');
        const utilsModule = require('../utils.js');
        const featherModule = require('feather-icons');

        // Re-setup spies with the new mock
        setupEventListenersMock = jest.spyOn(eventsModule, 'setupEventListeners');
        closeModalMock = jest.spyOn(eventsModule, 'closeModal');
        setupWebSocketMock = jest.spyOn(websocketModule, 'setupWebSocket');
        stateMock = stateModule.state;
        logMock = jest.spyOn(utilsModule, 'log');
        // Since setupCallControls is undefined, do not set up a spy
        const callModule = require('../call.js');
        // setupCallControlsMock remains undefined

        featherMock = featherModule.default;

        // Import and set up initializeAppMock
        const uiModule = require('../ui.js');
        initializeAppMock = jest.spyOn(uiModule, 'initializeApp');
        initializeAppMock.mockResolvedValue(); // Mock successful initialization

        await initializeApplication(); // Execute the function under test

        // Assertions to verify that setupCallControls was skipped
        expect(logMock).toHaveBeenCalledWith('Initializing application...');
        expect(initializeAppMock).toHaveBeenCalledTimes(1);
        expect(setupEventListenersMock).toHaveBeenCalledTimes(1);
        // Since setupCallControls is undefined, ensure it was not called
        // No spy exists, so we can't check calls; instead, ensure no errors occurred
        expect(setupWebSocketMock).toHaveBeenCalledTimes(1);
        expect(featherMock.replace).toHaveBeenCalledTimes(1);
        expect(stateMock.appInitialized).toBe(true);
        expect(logMock).toHaveBeenCalledWith('Application initialization complete');
      });
    });

    test('should handle errors during initialization', async () => {
      const error = new Error('Initialization failed');
      initializeAppMock.mockRejectedValue(error); // Mock initialization failure

      await initializeApplication(); // Execute the function

      // Assertions to verify error handling
      expect(logMock).toHaveBeenCalledWith('Initializing application...');
      expect(initializeAppMock).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith('Error during application initialization:', error);
      expect(window.alert).toHaveBeenCalledWith('There was an error initializing the application. Please refresh.');
      expect(stateMock.appInitialized).toBe(false);
    });
  });

  // -----------------------------------
  // Tests for DOMContentLoaded Event
  // -----------------------------------
  describe('DOMContentLoaded Event', () => {
    let initializeApplication;
    let initializeSpy;
    let main;

    beforeEach(async () => {
      main = await import('../main.js');
      initializeApplication = main.initializeApplication;
      initializeSpy = jest.spyOn(main, 'initializeApplication');
    });

    test('should call initializeApplication when DOM is fully loaded', () => {
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);

      expect(initializeSpy).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------
  // Tests for Global Functions and Event Listeners
  // -----------------------------------
  describe('Global Functions and Event Listeners', () => {
    let main;

    beforeEach(async () => {
      main = await import('../main.js');
    });

    test('should set window.closeModal to closeModal function', () => {
      const { closeModal } = require('../events.js');
      expect(window.closeModal).toBe(closeModalMock);
    });

    test('should handle uncaught errors with window error event listener', () => {
      const error = new Error('Uncaught error');
      window.dispatchEvent(new ErrorEvent('error', { error }));
      expect(console.error).toHaveBeenCalledWith('Uncaught error:', error);
    });

    test('should log message when application is closing', () => {
      window.dispatchEvent(new Event('beforeunload'));
      expect(logMock).toHaveBeenCalledWith('Application closing');
    });
  });

  // -----------------------------------
  // Tests for Hot Module Replacement (HMR)
  // -----------------------------------
  describe('Hot Module Replacement (HMR)', () => {
    let main;

    beforeEach(async () => {
      // Clear previous accept calls
      global.module.hot.accept.mockClear();

      main = await import('../main.js');
    });

    test('should accept module updates and re-initialize application', () => {
      expect(global.module.hot.accept).toHaveBeenCalledWith(
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

      // Retrieve the accept callback
      const acceptCallback = global.module.hot.accept.mock.calls[0][1];
      const initializeSpy = jest.spyOn(main, 'initializeApplication');

      acceptCallback(); // Invoke the callback

      // Assertions to verify HMR behavior
      expect(logMock).toHaveBeenCalledWith('Hot Module Replacement triggered');
      expect(initializeSpy).toHaveBeenCalled();
    });
  });
});