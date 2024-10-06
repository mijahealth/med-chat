// jest/__mocks__/websocket.js

export class WebSocketMock {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocketMock.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
  }

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  send(data) {
    // Mock send method
  }

  close() {
    this.readyState = WebSocketMock.CLOSED;
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Normal Closure' });
    }
  }

  // Method to simulate receiving a message
  mockReceiveMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }

  // Method to simulate opening the connection
  mockOpen() {
    this.readyState = WebSocketMock.OPEN;
    if (this.onopen) {
      this.onopen();
    }
  }

  // Method to simulate an error
  mockError(error) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
}