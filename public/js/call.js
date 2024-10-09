// public/js/call.js

import axios from 'axios';
import { api } from './api.js';
import { currentConversation, state } from './state.js';
import feather from 'feather-icons';
import { isValidPhoneNumber } from './utils.js';

// Import Twilio Device for voice calls
import { Device } from 'twilio-client';

export const callModule = {
  call: null,
  device: null,
  isMuted: false,
  callDurationInterval: null,

  /**
   * Initiates a voice call.
   * @returns {Promise<void>}
   */
  async makeCall() {
    if (!currentConversation.sid) {
      alert('Please select a conversation before making a call.');
      return;
    }

    if (this.call && this.call.status() === 'open') {
      alert('You are already in a call.');
      return;
    }

    try {
      if (!this.device) {
        // Fetch Twilio capability token
        const response = await axios.get(`${state.NGROK_URL}/token`, {
          params: { identity: `user_${Date.now()}` },
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        const {token} = response.data;

        // Initialize Twilio Device
        this.device = new Device(token, {
          codecPreferences: ['opus', 'pcmu'],
          fakeLocalDTMF: true,
          enableRingingState: true,
        });

        // Attach event listeners
        this.device.on('ready', () => {
          console.log('Twilio.Device Ready to make and receive calls!');
        });

        this.device.on('error', (error) => {
          console.error('Twilio.Device Error:', error);
        });

        this.device.on('connect', (conn) => {
          this.call = conn;
          this.handleCallAccept();
          this.call.on('disconnect', () => {
            this.handleCallDisconnect();
          });
          this.call.on('error', (error) => {
            this.handleCallError(error);
          });
        });

        this.device.on('disconnect', () => {
          this.handleCallDisconnect();
        });
      }

      // Get call parameters
      const params = await api.getCallParams(currentConversation.sid);

      // Send initial message to notify customer
      await api.sendMessage(currentConversation.sid, 'Calling you now...');

      // Make the call
      this.device.connect(params);

      // Update UI
      this.updateCallStatus('Calling...');
    } catch (error) {
      console.error('Error making call:', error);
      alert('Failed to initiate call. Please check the console for more details.');
    }
  },

  /**
   * Toggles mute state of the call.
   */
  toggleMute() {
    if (this.call) {
      this.isMuted = !this.isMuted;
      this.call.mute(this.isMuted);

      const muteButtonIcon = document.querySelector('#mute-btn i');
      if (muteButtonIcon) {
        muteButtonIcon.setAttribute('data-feather', this.isMuted ? 'mic-off' : 'mic');
        feather.replace();
      } else {
        console.warn('Mute button icon element not found');
      }

      console.log(`Microphone is now ${this.isMuted ? 'muted' : 'unmuted'}.`);
    } else {
      console.warn('toggleMute called but no active call found');
    }
  },

  /**
   * Ends the current call.
   */
  endCall() {
    if (this.call) {
      this.call.disconnect();
      this.call = null;
    } else {
      console.warn('endCall called but no active call found');
    }
  },

  /**
   * Handles call acceptance.
   */
  handleCallAccept() {
    this.updateCallStatus('In call');
    this.startCallDurationTimer();
    this.updateCallControls(true);
  },

  /**
   * Handles call disconnection.
   */
  handleCallDisconnect() {
    this.updateCallStatus('Call ended');
    this.stopCallDurationTimer();
    this.updateCallControls(false);
    this.call = null;
  },

  /**
   * Handles call errors.
   * @param {Error} error
   */
  handleCallError(error) {
    console.error('Call encountered an error:', error);
    this.updateCallStatus('Call error');
    this.stopCallDurationTimer();
    this.updateCallControls(false);
    this.call = null;
  },

  /**
   * Updates the call status display.
   * @param {string} status
   */
  updateCallStatus(status) {
    const callStatusElement = document.getElementById('call-status');
    if (callStatusElement) {
      callStatusElement.textContent = status;
      callStatusElement.className = ''; // Reset classes
      if (status === 'In call') {
        callStatusElement.classList.add('in-call');
      } else if (status === 'Call ended') {
        callStatusElement.classList.add('call-ended');
      } else if (status === 'Call error') {
        callStatusElement.classList.add('call-error');
      } else {
        callStatusElement.classList.add('call-status');
      }
    } else {
      console.warn('Call status element not found');
    }
  },

  /**
   * Starts the call duration timer.
   */
  startCallDurationTimer() {
    const callStatusElement = document.getElementById('call-status');
    const startTime = Date.now();

    this.callDurationInterval = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      const minutes = Math.floor(elapsedTime / 60000);
      const seconds = Math.floor((elapsedTime % 60000) / 1000);
      const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      if (callStatusElement) {
        callStatusElement.textContent = timeString;
      }
    }, 1000);
  },

  /**
   * Stops the call duration timer.
   */
  stopCallDurationTimer() {
    clearInterval(this.callDurationInterval);
    this.callDurationInterval = null;
  },

  /**
   * Updates call control buttons based on call state.
   * @param {boolean} inCall
   */
  updateCallControls(inCall) {
    const callButton = document.getElementById('call-btn');
    const muteButton = document.getElementById('mute-btn');
    const endCallButton = document.getElementById('end-call-btn');

    if (inCall) {
      if (callButton) {callButton.style.display = 'none';}
      if (muteButton) {muteButton.style.display = 'inline-block';}
      if (endCallButton) {endCallButton.style.display = 'inline-block';}
    } else {
      if (callButton) {callButton.style.display = 'inline-block';}
      if (muteButton) {muteButton.style.display = 'none';}
      if (endCallButton) {endCallButton.style.display = 'none';}
    }
  },

  /**
   * Starts a video call.
   * @returns {Promise<void>}
   */
  async startVideoCall() {
    const phoneElement = document.querySelector('.contact-item span');
    const customerPhoneNumber = phoneElement ? phoneElement.textContent.trim() : null;

    if (!customerPhoneNumber || !isValidPhoneNumber(customerPhoneNumber)) {
      alert('Failed to start video call. Please try again.');
      return;
    }

    try {
      const response = await api.createVideoRoom({
        customerPhoneNumber,
        conversationSid: currentConversation.sid,
      });

      window.open(response.link, '_blank');
    } catch (error) {
      console.error('Error starting video call:', error);
      alert('Failed to start video call. Please try again.');
    }
  },
};

/**
 * Sets up event listeners for call controls.
 */
export function setupCallControls() {
  const callButton = document.getElementById('call-btn');
  const muteButton = document.getElementById('mute-btn');
  const endCallButton = document.getElementById('end-call-btn');
  const startVideoCallButton = document.getElementById('start-video-call-btn');

  if (callButton) {
    callButton.addEventListener('click', () => callModule.makeCall());
  }

  if (muteButton) {
    muteButton.addEventListener('click', () => callModule.toggleMute());
  }

  if (endCallButton) {
    endCallButton.addEventListener('click', () => callModule.endCall());
  }

  if (startVideoCallButton) {
    startVideoCallButton.addEventListener('click', () => callModule.startVideoCall());
  }
}