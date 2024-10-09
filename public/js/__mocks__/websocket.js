// public/js/__mocks__/websocket.js

export const setupClientWebSocket = jest.fn();
export const handleWebSocketMessage = jest.fn();
export const socket = {
  readyState: 1,
  send: jest.fn(),
  close: jest.fn(),
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null,
};