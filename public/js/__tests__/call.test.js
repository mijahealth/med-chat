/**
 * @jest-environment jsdom
 */

import { callModule, setupCallControls } from '../call.js';
import { api } from '../api.js';
import { currentConversation, state } from '../state.js';
import axios from 'axios';
import feather from 'feather-icons';
import { log, isValidPhoneNumber } from '../utils.js';

// Mock dependencies
jest.mock('../api.js');
jest.mock('../utils.js');
jest.mock('axios');
jest.mock('feather-icons');
jest.useFakeTimers();


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

    it('should handle error when fetching token fails', async () => {
      axios.get.mockRejectedValueOnce(new Error('Token fetch error'));
      window.alert = jest.fn();
    
      await callModule.makeCall();
    
      expect(window.alert).toHaveBeenCalledWith('Failed to initiate call. Please check the logs for more details.');
      expect(log).toHaveBeenCalledWith('Error making call:', expect.any(Error));
    });

    it('should alert if a call is already in progress', async () => {
      window.alert = jest.fn();
      const mockCall = { status: jest.fn(() => 'open') };
      callModule.call = mockCall;

      await callModule.makeCall();

      expect(window.alert).toHaveBeenCalledWith('You are already in a call.');
    });

    it('should set up the device if not already set up', async () => {
      axios.get.mockResolvedValueOnce({ data: { token: 'test-token' } });
      api.getCallParams.mockResolvedValueOnce({ To: '+19876543210', From: '+1234567890' });
      api.sendMessage.mockResolvedValueOnce({});
      window.alert = jest.fn();

      await callModule.makeCall();

      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:3000/token',
        expect.objectContaining({
          params: { identity: expect.stringContaining('user_') },
          headers: { 'ngrok-skip-browser-warning': 'true' },
        })
      );
      expect(api.getCallParams).toHaveBeenCalledWith('CH1234567890');
      expect(api.sendMessage).toHaveBeenCalled();
      expect(callModule.device).toBeDefined();
    });

    it('should handle errors during call setup', async () => {
      axios.get.mockResolvedValueOnce({ data: { token: 'test-token' } });
      api.getCallParams.mockRejectedValueOnce(new Error('Network error'));
      window.alert = jest.fn();

      await callModule.makeCall();

      expect(window.alert).toHaveBeenCalledWith('Failed to initiate call. Please check the logs for more details.');
      expect(log).toHaveBeenCalledWith('Error making call:', expect.any(Error));
    });
  });

  describe('toggleMute', () => {
    it('should toggle the mute state of the call', () => {
      const mockCall = { mute: jest.fn() };
      callModule.call = mockCall;
      const muteButtonIcon = document.querySelector('#mute-btn i');
      feather.replace = jest.fn();

      callModule.toggleMute();
      expect(mockCall.mute).toHaveBeenCalledWith(true);
      expect(feather.replace).toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith('Microphone is now muted.');

      callModule.toggleMute();
      expect(mockCall.mute).toHaveBeenCalledWith(false);
      expect(log).toHaveBeenCalledWith('Microphone is now unmuted.');
    });

    it('should warn if there is no active call', () => {
      callModule.call = null;
      callModule.toggleMute();
      expect(log).toHaveBeenCalledWith('toggleMute called but no active call found');
    });

    it('should log when mute button icon element is not found', () => {
      const mockCall = { mute: jest.fn() };
      callModule.call = mockCall;
      // Remove mute button icon
      const muteButtonIcon = document.querySelector('#mute-btn i');
      if (muteButtonIcon) muteButtonIcon.remove();
    
      callModule.toggleMute();
    
      expect(log).toHaveBeenCalledWith('Mute button icon element not found');
    });
  });

  describe('endCall', () => {
    it('should disconnect the call and update UI', () => {
      const mockCall = { disconnect: jest.fn() };
      callModule.call = mockCall;

      callModule.endCall();

      expect(mockCall.disconnect).toHaveBeenCalled();
      expect(callModule.call).toBeNull();
    });

    it('should warn if there is no active call', () => {
      callModule.call = null;
      callModule.endCall();

      expect(log).toHaveBeenCalledWith('endCall called but no active call found');
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
      jest.spyOn(callModule, 'updateCallStatus').mockImplementation(() => {});
      jest.spyOn(callModule, 'stopCallDurationTimer').mockImplementation(() => {});
      jest.spyOn(callModule, 'updateCallControls').mockImplementation(() => {});

      callModule.handleCallError(error);

      expect(log).toHaveBeenCalledWith('Call encountered an error:', error);
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

    it('should handle missing call status element in updateCallStatus', () => {
      // Remove call status element
      const callStatusElement = document.getElementById('call-status');
      if (callStatusElement) callStatusElement.remove();
    
      callModule.updateCallStatus('In call');
    
      expect(log).toHaveBeenCalledWith('Call status element not found');
    });

    it('should warn if call status element is not found', () => {
      document.body.innerHTML = ''; // Remove all elements
      callModule.updateCallStatus('In call');

      expect(log).toHaveBeenCalledWith('Call status element not found');
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

    it('should handle missing call status element during timer updates', () => {
      // Remove call status element
      const callStatusElement = document.getElementById('call-status');
      if (callStatusElement) callStatusElement.remove();
  
      callModule.startCallDurationTimer();
  
      jest.advanceTimersByTime(1000);
  
      // Ensure that no errors occur and function handles the missing element
      expect(log).not.toHaveBeenCalledWith('Call status element not found during timer');
    });
  });

  describe('startVideoCall', () => {
    it('should start a video call and open a new window', async () => {
      api.createVideoRoom.mockResolvedValueOnce({
        link: '/video-room/test-room',
        roomName: 'test-room',
      });

      window.open = jest.fn();
      isValidPhoneNumber.mockReturnValueOnce(true);

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
      isValidPhoneNumber.mockReturnValueOnce(false);

      await callModule.startVideoCall();

      expect(window.alert).toHaveBeenCalledWith('Failed to start video call. Please try again.');
    });

    it('should handle errors during video call setup', async () => {
      api.createVideoRoom.mockRejectedValueOnce(new Error('Network error'));
      window.alert = jest.fn();
      isValidPhoneNumber.mockReturnValueOnce(true);

      await callModule.startVideoCall();

      expect(window.alert).toHaveBeenCalledWith('Failed to start video call. Please try again.');
      expect(log).toHaveBeenCalledWith('Error starting video call:', expect.any(Error));
    });
  });
});