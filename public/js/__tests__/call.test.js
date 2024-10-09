// public/js/__tests__/call.test.js

/**
 * @jest-environment jsdom
 */

import { callModule, setupCallControls } from '../call.js';
import { api } from '../api.js';
import { currentConversation, state } from '../state.js';
import axios from 'axios';
import feather from 'feather-icons';

// Mock dependencies
jest.mock('../api.js');
jest.mock('axios');
jest.mock('feather-icons');

// Helper to simulate DOM elements
function createDOMElements() {
  document.body.innerHTML = `
    <div id="call-status"></div>
    <button id="call-btn"><i data-feather="phone"></i></button>
    <button id="mute-btn" style="display: none;"><i data-feather="mic"></i></button>
    <button id="end-call-btn" style="display: none;"><i data-feather="phone-off"></i></button>
    <button id="start-video-call-btn"><i data-feather="video"></i></button>
    <div class="contact-item">
      <span>+19876543210</span>
    </div>
  `;
}

describe('call.js', () => {
  beforeEach(() => {
    createDOMElements();
    currentConversation.sid = 'CH1234567890';
    state.NGROK_URL = 'http://localhost:3000';
    state.TWILIO_PHONE_NUMBER = '+1234567890';
    callModule.call = null;
    callModule.device = null;
    callModule.isMuted = false;
    callModule.callDurationInterval = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('setupCallControls', () => {
    it('should set up event listeners for call controls', () => {
      const callButton = document.getElementById('call-btn');
      const muteButton = document.getElementById('mute-btn');
      const endCallButton = document.getElementById('end-call-btn');
      const startVideoCallButton = document.getElementById('start-video-call-btn');

      const callButtonSpy = jest.spyOn(callButton, 'addEventListener');
      const muteButtonSpy = jest.spyOn(muteButton, 'addEventListener');
      const endCallButtonSpy = jest.spyOn(endCallButton, 'addEventListener');
      const startVideoCallButtonSpy = jest.spyOn(startVideoCallButton, 'addEventListener');

      setupCallControls();

      expect(callButtonSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(muteButtonSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(endCallButtonSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(startVideoCallButtonSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('makeCall', () => {
    it('should alert if no conversation is selected', async () => {
      currentConversation.sid = null;
      window.alert = jest.fn();

      await callModule.makeCall();

      expect(window.alert).toHaveBeenCalledWith('Please select a conversation before making a call.');
    });

    it('should alert if a call is already in progress', async () => {
      window.alert = jest.fn();

      // Simulate an active call
      const mockCall = {
        status: jest.fn(() => 'open'),
      };
      callModule.call = mockCall;

      await callModule.makeCall();

      expect(window.alert).toHaveBeenCalledWith('You are already in a call.');
    });

    it('should set up the device if not already set up', async () => {
      axios.get.mockResolvedValueOnce({
        data: { token: 'test-token' },
      });
    
      api.getCallParams.mockResolvedValueOnce({
        To: '+19876543210',
        From: '+1234567890',
      });
    
      api.sendMessage.mockResolvedValueOnce({});
    
      window.alert = jest.fn();
    
      await callModule.makeCall();
    
      // Assertions
      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:3000/token',
        expect.objectContaining({
          params: { identity: expect.stringContaining('user_') },
          headers: { 'ngrok-skip-browser-warning': 'true' },
        })
      );
    
      expect(api.getCallParams).toHaveBeenCalledWith('CH1234567890');
      expect(api.sendMessage).toHaveBeenCalled();
    
      // Verify that the Device was initialized with the correct token
      expect(callModule.device).toBeDefined();
      expect(callModule.device.token).toBe('test-token');
    
      // Verify that the device's 'connect' method was called with the correct params
      expect(callModule.device.eventHandlers['connect']).toBeDefined();
    });

    it('should handle errors during call setup', async () => {
      axios.get.mockResolvedValueOnce({
        data: { token: 'test-token' },
      });

      api.getCallParams.mockRejectedValueOnce(new Error('Network error'));
      window.alert = jest.fn();

      await callModule.makeCall();

      expect(window.alert).toHaveBeenCalledWith('Failed to initiate call. Please check the console for more details.');
    });
  });

  describe('toggleMute', () => {
    it('should toggle the mute state of the call', () => {
      // Set up a mock call object
      const mockCall = {
        mute: jest.fn(),
      };
      callModule.call = mockCall;

      // Mock DOM elements
      const muteButtonIcon = document.querySelector('#mute-btn i');
      feather.replace = jest.fn();

      // Initial state: not muted
      callModule.toggleMute();
      expect(mockCall.mute).toHaveBeenCalledWith(true);
      expect(feather.replace).toHaveBeenCalled();

      // Second toggle: muted
      callModule.toggleMute();
      expect(mockCall.mute).toHaveBeenCalledWith(false);
    });

    it('should warn if there is no active call', () => {
      console.warn = jest.fn();

      callModule.call = null;
      callModule.toggleMute();

      expect(console.warn).toHaveBeenCalledWith('toggleMute called but no active call found');
    });
  });

  describe('endCall', () => {
    it('should disconnect the call and update UI', () => {
      // Set up a mock call object
      const mockCall = {
        disconnect: jest.fn(),
      };
      callModule.call = mockCall;

      callModule.endCall();

      expect(mockCall.disconnect).toHaveBeenCalled();
      expect(callModule.call).toBeNull();
    });

    it('should warn if there is no active call', () => {
      console.warn = jest.fn();

      callModule.call = null;
      callModule.endCall();

      expect(console.warn).toHaveBeenCalledWith('endCall called but no active call found');
    });
  });

  describe('handleCallAccept', () => {
    it('should update call status and UI on call accept', () => {
      jest.spyOn(callModule, 'updateCallStatus').mockImplementation(() => {});
      jest.spyOn(callModule, 'startCallDurationTimer').mockImplementation(() => {});
      jest.spyOn(callModule, 'updateCallControls').mockImplementation(() => {});

      callModule.handleCallAccept();

      expect(callModule.updateCallStatus).toHaveBeenCalledWith('In call');
      expect(callModule.startCallDurationTimer).toHaveBeenCalled();
      expect(callModule.updateCallControls).toHaveBeenCalledWith(true);
    });
  });

  describe('handleCallDisconnect', () => {
    it('should update call status and UI on call disconnect', () => {
      jest.spyOn(callModule, 'updateCallStatus').mockImplementation(() => {});
      jest.spyOn(callModule, 'stopCallDurationTimer').mockImplementation(() => {});
      jest.spyOn(callModule, 'updateCallControls').mockImplementation(() => {});

      callModule.handleCallDisconnect();

      expect(callModule.updateCallStatus).toHaveBeenCalledWith('Call ended');
      expect(callModule.stopCallDurationTimer).toHaveBeenCalled();
      expect(callModule.updateCallControls).toHaveBeenCalledWith(false);
      expect(callModule.call).toBeNull();
    });
  });

  describe('handleCallError', () => {
    it('should handle call errors', () => {
      const error = new Error('Test error');
      console.error = jest.fn();
      jest.spyOn(callModule, 'updateCallStatus').mockImplementation(() => {});
      jest.spyOn(callModule, 'stopCallDurationTimer').mockImplementation(() => {});
      jest.spyOn(callModule, 'updateCallControls').mockImplementation(() => {});

      callModule.handleCallError(error);

      expect(console.error).toHaveBeenCalledWith('Call encountered an error:', error);
      expect(callModule.updateCallStatus).toHaveBeenCalledWith('Call error');
      expect(callModule.stopCallDurationTimer).toHaveBeenCalled();
      expect(callModule.updateCallControls).toHaveBeenCalledWith(false);
      expect(callModule.call).toBeNull();
    });
  });

  describe('updateCallStatus', () => {
    it('should update the call status display', () => {
      const callStatusElement = document.getElementById('call-status');
      callModule.updateCallStatus('In call');

      expect(callStatusElement.textContent).toBe('In call');
      expect(callStatusElement.className).toContain('in-call');
    });

    it('should warn if call status element is not found', () => {
      console.warn = jest.fn();
      document.body.innerHTML = ''; // Remove all elements

      callModule.updateCallStatus('In call');

      expect(console.warn).toHaveBeenCalledWith('Call status element not found');
    });
  });

  describe('startCallDurationTimer', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start the call duration timer', () => {
      const callStatusElement = document.getElementById('call-status');
      callModule.startCallDurationTimer();

      expect(callModule.callDurationInterval).not.toBeNull();

      jest.advanceTimersByTime(5000);
      expect(callStatusElement.textContent).toBe('0:05');
    });
  });

  describe('stopCallDurationTimer', () => {
    it('should stop the call duration timer', () => {
      global.clearInterval = jest.fn();
      callModule.callDurationInterval = 12345;

      callModule.stopCallDurationTimer();

      expect(global.clearInterval).toHaveBeenCalledWith(12345);
      expect(callModule.callDurationInterval).toBeNull();
    });
  });

  describe('startVideoCall', () => {
    it('should start a video call and open a new window', async () => {
      api.createVideoRoom.mockResolvedValueOnce({
        link: '/video-room/test-room',
        roomName: 'test-room',
      });

      window.open = jest.fn();

      await callModule.startVideoCall();

      expect(api.createVideoRoom).toHaveBeenCalledWith({
        customerPhoneNumber: '+19876543210',
        conversationSid: 'CH1234567890',
      });

      expect(window.open).toHaveBeenCalledWith('/video-room/test-room', '_blank');
    });

    it('should alert if phone number is invalid', async () => {
      const phoneElement = document.querySelector('.contact-item span');
      phoneElement.textContent = 'invalid-phone';

      window.alert = jest.fn();

      await callModule.startVideoCall();

      expect(window.alert).toHaveBeenCalledWith('Failed to start video call. Please try again.');
    });

    it('should handle errors during video call setup', async () => {
      api.createVideoRoom.mockRejectedValueOnce(new Error('Network error'));
      window.alert = jest.fn();

      await callModule.startVideoCall();

      expect(window.alert).toHaveBeenCalledWith('Failed to start video call. Please try again.');
    });
  });
});