// public/js/__mocks__/utils.js

export const log = jest.fn();
export const formatTime = jest.fn((date) => new Date(date).toLocaleTimeString());