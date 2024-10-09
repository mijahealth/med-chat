// public/js/__mocks__/utils.js

// Mock all exported functions from utils.js
export const log = jest.fn();

// Mock formatTime to return a predictable string
export const formatTime = jest.fn((dateString) => {
  const date = new Date(dateString);
  // Return a fixed format for consistency in tests
  return `${date.getHours()}:${date.getMinutes()}`;
});

// Mock scrollToBottom as a no-op
export const scrollToBottom = jest.fn();

// Mock checkScrollPosition to manipulate state without side effects
export const checkScrollPosition = jest.fn(() => {
  // Optionally, you can set state.autoScrollEnabled based on test needs
});

// Mock playNotificationSound to prevent actual audio playback
export const playNotificationSound = jest.fn();

// Mock debounce to return the original function without delay
export const debounce = jest.fn((fn) => fn);

// Mock isValidDate with simple logic
export const isValidDate = jest.fn((dateString) => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  const timestamp = date.getTime();
  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) return false;
  return date.toISOString().startsWith(dateString);
});

// Mock setUserInteracted to manipulate state without side effects
export const setUserInteracted = jest.fn(() => {
  // Assuming state is imported in the actual module
  // You can modify the mock state here if needed
});

// Mock validator functions with basic logic
export const isValidPhoneNumber = jest.fn((phone) => {
  return /^\+[0-9]{10,15}$/.test(phone);
});

export const isValidName = jest.fn((name) => {
  return typeof name === 'string' && name.trim().length > 0;
});

export const isValidEmail = jest.fn((email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
});

export const isValidState = jest.fn((state) => {
  return typeof state === 'string' && state.trim().length > 0;
});

export const isValidMessage = jest.fn((message) => {
  return typeof message === 'string' && message.trim().length > 0;
});