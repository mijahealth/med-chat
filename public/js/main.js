// main.js

/**
 * This file is like the control center for our app.
 * It brings together all the pieces and starts everything up.
 * 
 * We're importing special tools from other files to help run our app.
 * It's like getting all our toys from different toy boxes to play with.
 */
import { initializeApp } from './ui.js';
import { setupEventListeners, closeModal } from './events.js';
import { setupWebSocket } from './websocket.js';
import { state } from './state.js';
import { log } from './utils.js';
import { setupCallControls } from './call.js';
import feather from 'feather-icons';

/**
 * Starts up our entire computer program.
 * 
 * This is like turning on a big machine with lots of parts.
 * It sets up the screen, listens for button clicks, connects to the internet,
 * and makes everything look pretty with icons.
 * If something goes wrong, it tells us there's a problem.
 * 
 * @returns {Promise<void>} Nothing, but it might take a little time to finish.
 */
async function initializeApplication() {
  try {
    log('Initializing application...');
    await initializeApp();
    setupEventListeners();
    if (typeof setupCallControls === 'function') {
      setupCallControls();
    }
    setupWebSocket();
    feather.replace();
    state.appInitialized = true;
    log('Application initialization complete');
  } catch (error) {
    console.error('Error during application initialization:', error);
    alert('There was an error initializing the application. Please refresh.');
  }
}

/**
 * Tells the app to start when the webpage is ready.
 * 
 * This is like telling a race car to start its engine when the track is clear.
 * We wait for the webpage to be fully loaded before we begin.
 */
document.addEventListener('DOMContentLoaded', initializeApplication);

/**
 * Makes it easy to close windows in our app from anywhere.
 * 
 * This is like having a magic wand that can close any door in a big castle.
 * We can use it from any room (any part of our code) to close a specific door (modal).
 */
window.closeModal = closeModal;

/**
 * Catches any unexpected problems in our app.
 * 
 * This is like having a safety net under a tightrope walker.
 * If something goes wrong that we didn't plan for, this will catch it and tell us about it.
 * 
 * @param {ErrorEvent} event - Information about what went wrong.
 */
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
});

/**
 * Says goodbye when we close the app.
 * 
 * This is like waving goodbye to a friend when they leave.
 * It lets the computer know we're done using the app.
 */
window.addEventListener('beforeunload', () => {
  log('Application closing');
});

/**
 * Allows us to update parts of the app without restarting it.
 * 
 * This is like changing the tires on a car while it's still moving.
 * It's a special trick that helps developers update the app quickly.
 */
if (module.hot) {
  module.hot.accept([
    './ui.js',
    './events.js',
    './conversations.js',
    './websocket.js',
    './state.js',
    './utils.js',
    './call.js'
  ], () => {
    log('Hot Module Replacement triggered');
    initializeApplication();
  });
}

/**
 * Shares our main startup function with other parts of the app.
 * 
 * This is like letting other kids use our favorite toy.
 * It allows other parts of our app to start everything up if they need to.
 */
export { initializeApplication };