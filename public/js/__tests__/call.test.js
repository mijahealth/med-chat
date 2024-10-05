// public/js/__tests__/call.test.js
import { setupCallControls, makeCall, toggleMute, endCall } from '../call';
import { api } from '../api';
import { Device } from 'twilio-client';
import { currentConversation, state } from '../state';
import '@testing-library/jest-dom/extend-expect';

jest.mock('twilio-client');
jest.mock('../api');

describe('Call Module', () => {
  let callControls;
  
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="call-btn">Call</button>
      <button id="mute-btn">Mute</button>
      <button id="end-call-btn">End Call</button>
      <span id="call-status"></span>
    `;
    setupCallControls();
    state.NGROK_URL = 'https://example.ngrok.io';
    currentConversation.sid = 'conv1';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('makeCall initiates a call successfully', async () => {
    const mockToken = 'mock-token';
    const mockParams = { To: '+1234567890', From: '+0987654321' };
    api.getCallParams.mockResolvedValue(mockParams);
    api.sendMessage.mockResolvedValue({});
    
    Device.mockImplementation(() => ({
      connect: jest.fn(() => ({
        on: jest.fn(),
        status: jest.fn().mockReturnValue('open'),
      })),
      on: jest.fn(),
    }));

    await makeCall();

    expect(api.getCallParams).toHaveBeenCalledWith('conv1');
    expect(api.sendMessage).toHaveBeenCalledWith('conv1', `Your provider is going to call you from ${mockParams.From} in 5 seconds.`);
    expect(Device).toHaveBeenCalledWith(mockToken, expect.any(Object));
    // Further assertions based on how the call is handled
  });

  test('toggleMute mutes and unmutes the call', () => {
    const mockCall = {
      mute: jest.fn(),
    };
    Device.mockImplementation(() => ({
      connect: jest.fn(() => mockCall),
      on: jest.fn(),
    }));
    state.userInteracted = true;
    // Assume makeCall has been called and call is established
    makeCall();
    
    toggleMute();
    expect(mockCall.mute).toHaveBeenCalledWith(true);
    
    toggleMute();
    expect(mockCall.mute).toHaveBeenCalledWith(false);
  });

  test('endCall disconnects the call', () => {
    const mockCall = {
      disconnect: jest.fn(),
      status: jest.fn().mockReturnValue('open'),
    };
    Device.mockImplementation(() => ({
      connect: jest.fn(() => mockCall),
      on: jest.fn(),
    }));
    // Assume makeCall has been called and call is established
    makeCall();
    
    endCall();
    expect(mockCall.disconnect).toHaveBeenCalled();
    expect(document.getElementById('call-status').textContent).toBe('Call ended');
  });

  // Add more tests for error handling, UI updates, etc.
});// public/js/__tests__/call.test.js
import { setupCallControls, makeCall, toggleMute, endCall } from '../call';
import { api } from '../api';
import { Device } from 'twilio-client';
import { currentConversation, state } from '../state';
import '@testing-library/jest-dom/extend-expect';

jest.mock('twilio-client');
jest.mock('../api');

describe('Call Module', () => {
  let callControls;
  
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="call-btn">Call</button>
      <button id="mute-btn">Mute</button>
      <button id="end-call-btn">End Call</button>
      <span id="call-status"></span>
    `;
    setupCallControls();
    state.NGROK_URL = 'https://example.ngrok.io';
    currentConversation.sid = 'conv1';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('makeCall initiates a call successfully', async () => {
    const mockToken = 'mock-token';
    const mockParams = { To: '+1234567890', From: '+0987654321' };
    api.getCallParams.mockResolvedValue(mockParams);
    api.sendMessage.mockResolvedValue({});
    
    Device.mockImplementation(() => ({
      connect: jest.fn(() => ({
        on: jest.fn(),
        status: jest.fn().mockReturnValue('open'),
      })),
      on: jest.fn(),
    }));

    await makeCall();

    expect(api.getCallParams).toHaveBeenCalledWith('conv1');
    expect(api.sendMessage).toHaveBeenCalledWith('conv1', `Your provider is going to call you from ${mockParams.From} in 5 seconds.`);
    expect(Device).toHaveBeenCalledWith(mockToken, expect.any(Object));
    // Further assertions based on how the call is handled
  });

  test('toggleMute mutes and unmutes the call', () => {
    const mockCall = {
      mute: jest.fn(),
    };
    Device.mockImplementation(() => ({
      connect: jest.fn(() => mockCall),
      on: jest.fn(),
    }));
    state.userInteracted = true;
    // Assume makeCall has been called and call is established
    makeCall();
    
    toggleMute();
    expect(mockCall.mute).toHaveBeenCalledWith(true);
    
    toggleMute();
    expect(mockCall.mute).toHaveBeenCalledWith(false);
  });

  test('endCall disconnects the call', () => {
    const mockCall = {
      disconnect: jest.fn(),
      status: jest.fn().mockReturnValue('open'),
    };
    Device.mockImplementation(() => ({
      connect: jest.fn(() => mockCall),
      on: jest.fn(),
    }));
    // Assume makeCall has been called and call is established
    makeCall();
    
    endCall();
    expect(mockCall.disconnect).toHaveBeenCalled();
    expect(document.getElementById('call-status').textContent).toBe('Call ended');
  });

  // Add more tests for error handling, UI updates, etc.
});