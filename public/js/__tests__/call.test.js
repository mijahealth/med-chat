// public/js/__tests__/call.test.js

import { jest } from '@jest/globals';
import {
  makeCall,
  toggleMute,
  endCall,
  setupCallControls,
  startVideoCall,
  handleCallAccept,
  handleCallDisconnect,
  handleCallError,
  updateCallStatus,
  startCallDurationTimer,
  stopCallDurationTimer,
  updateCallDuration,
  callState, // Imported for testing purposes
} from '../call.js';
import { currentConversation, state } from '../state.js';
import { api } from '../api.js';
import { Device } from 'twilio-client';
import axios from 'axios';

jest.mock('../state.js');
jest.mock('../api.js');
jest.mock('twilio-client');
jest.mock('axios');

describe('Call Module', () => {
  let mockDevice;
  let mockCall;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers('modern');

    document.body.innerHTML = `
      <div id="call-status"></div>
      <button id="call-btn"></button>
      <button id="mute-btn"><i data-feather="mic"></i></button>
      <button id="end-call-btn"></button>
      <button id="start-video-call-btn"></button>
      <div class="contact-item"><span>+1234567890</span></div>
    `;

    mockCall = {
      on: jest.fn(),
      mute: jest.fn(),
      disconnect: jest.fn(),
      status: jest.fn().mockReturnValue('closed'),
    };

    mockDevice = {
      on: jest.fn(),
      connect: jest.fn().mockReturnValue(mockCall),
    };

    Device.mockImplementation(() => mockDevice);

    currentConversation.sid = 'mock-conversation-sid';
    state.NGROK_URL = 'https://mock-ngrok-url.com';
    axios.get.mockResolvedValue({ data: { token: 'mock-token' } });
    api.getCallParams.mockResolvedValue({
      To: '+1234567890',
      From: '+0987654321',
    });
    api.sendMessage.mockResolvedValue();
    api.createVideoRoom.mockResolvedValue({ link: 'mock-link', roomName: 'mock-room' });

    global.alert = jest.fn();
    global.feather = { replace: jest.fn() };
    global.window.open = jest.fn();

    // Mock console methods
    global.console.error = jest.fn();
    global.console.log = jest.fn();
    global.console.warn = jest.fn();

    // Spy on setInterval and clearInterval
    jest.spyOn(global, 'setInterval');
    jest.spyOn(global, 'clearInterval');

    // Initialize call controls
    setupCallControls();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('setupCallControls', () => {
    it('should set up event listeners for call controls', async () => {
      const callBtn = document.getElementById('call-btn');
      const muteBtn = document.getElementById('mute-btn');
      const endCallBtn = document.getElementById('end-call-btn');
      const startVideoCallBtn = document.getElementById('start-video-call-btn');

      callBtn.click();
      await jest.runAllTimersAsync();
      expect(api.getCallParams).toHaveBeenCalledWith('mock-conversation-sid');

      // After makeCall, callState.call should be set to mockCall
      toggleMute();
      expect(mockCall.mute).toHaveBeenCalledWith(true);

      endCallBtn.click();
      expect(mockCall.disconnect).toHaveBeenCalled();

      startVideoCallBtn.click();
      await jest.runAllTimersAsync();
      expect(api.createVideoRoom).toHaveBeenCalled();
    });
  });

  describe('makeCall', () => {
    it('should alert if no conversation is selected', async () => {
      currentConversation.sid = null;
      await makeCall();
      expect(global.alert).toHaveBeenCalledWith('Please select a conversation before making a call.');
      expect(console.warn).toHaveBeenCalledWith('makeCall aborted: No conversation selected');
    });
  });

  describe('startVideoCall', () => {
    it('should start a video call successfully', async () => {
      await startVideoCall();
      expect(api.createVideoRoom).toHaveBeenCalledWith({
        customerPhoneNumber: '+1234567890',
        conversationSid: 'mock-conversation-sid',
      });
      expect(global.window.open).toHaveBeenCalledWith('/video-room/mock-room', '_blank');
    });

    it('should handle errors when starting a video call', async () => {
      api.createVideoRoom.mockRejectedValue(new Error('Failed to create video room'));
      await startVideoCall();
      expect(global.alert).toHaveBeenCalledWith('Failed to start video call. Please try again.');
      expect(console.error).toHaveBeenCalledWith('Error starting video call:', expect.any(Error));
    });
  });

  describe('handleCallError', () => {
    it('should update call status and log error', () => {
      const error = new Error('Test error');
      handleCallError(error);
      expect(document.getElementById('call-status').textContent).toBe('Call error');
      expect(console.error).toHaveBeenCalledWith('Call encountered an error:', error);
    });
  });

  describe('updateCallStatus', () => {
    it('should update call status element', () => {
      updateCallStatus('Test status');
      expect(document.getElementById('call-status').textContent).toBe('Test status');
    });
  });
});