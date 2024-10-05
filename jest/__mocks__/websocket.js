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
      // Mock send implementation
    }
  
    close() {
      this.readyState = WebSocketMock.CLOSED;
      if (this.onclose) {this.onclose();}
    }
  
    // Method to simulate receiving a message
    receiveMessage(data) {
      if (this.onmessage) {this.onmessage({ data: JSON.stringify(data) });}
    }
  
    // Method to simulate opening the connection
    open() {
      this.readyState = WebSocketMock.OPEN;
      if (this.onopen) {this.onopen();}
    }
  }
  
  global.WebSocket = WebSocketMock;