// public/js/__mocks__/utils.js

export const log = jest.fn();
export const formatTime = jest.fn(() => '12:00 PM');
export const scrollToBottom = jest.fn();
export const checkScrollPosition = jest.fn();
export const playNotificationSound = jest.fn();
export const debounce = jest.fn((fn) => fn);
export const isValidDate = jest.fn(() => true);
export const setUserInteracted = jest.fn();
export const isValidPhoneNumber = jest.fn(() => true);
export const isValidName = jest.fn(() => true);
export const isValidEmail = jest.fn(() => true);
export const isValidState = jest.fn(() => true);
export const isValidMessage = jest.fn(() => true);