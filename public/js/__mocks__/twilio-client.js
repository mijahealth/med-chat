// public/js/__mocks__/twilio-client.js

export class Device {
  constructor(token, options) {
    this.token = token;
    this.options = options;
    this.eventHandlers = {};

    // Mock the 'on' method
    this.on = jest.fn((event, handler) => {
      this.eventHandlers[event] = handler;
    });
  }

  connect(params) {
    // Simulate connection
    const connection = {
      on: jest.fn((event, handler) => {
        // Store event handlers for the connection
        if (!this.connectionEventHandlers) {
          this.connectionEventHandlers = {};
        }
        this.connectionEventHandlers[event] = handler;
      }),
      disconnect: jest.fn(() => {
        // Call the 'disconnect' handler if it exists
        if (this.connectionEventHandlers && this.connectionEventHandlers['disconnect']) {
          this.connectionEventHandlers['disconnect']();
        }
      }),
      mute: jest.fn(),
      status: jest.fn(() => 'open'),
    };

    // Simulate 'connect' event
    if (this.eventHandlers['connect']) {
      this.eventHandlers['connect'](connection);
    }

    return connection;
  }

  disconnectAll() {
    jest.fn();
  }
}