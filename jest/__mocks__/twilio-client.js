// jest/__mocks__/twilio-client.js

export const Device = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn().mockReturnValue({
      on: jest.fn(),
      mute: jest.fn(),
      disconnect: jest.fn(),
      status: jest.fn(),
    }),
  }));