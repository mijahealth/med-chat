// public/js/call.js

import { currentConversation, state } from './state.js';
import { api } from './api.js';
import { Device } from 'twilio-client';
import axios from 'axios';

let call = null;
let isMuted = false;
let device = null;
let callStatusElement = null;
let callStartTime = null;
let callDurationInterval = null;

// Constants for magic numbers
const CALL_END_STATUS_DURATION = 3000;
const CALL_NOTIFICATION_DELAY = 5000;
const CALL_DURATION_UPDATE_INTERVAL = 1000;
const MILLISECONDS_IN_MINUTE = 60000;
const MILLISECONDS_IN_SECOND = 1000;

console.log('call.js loaded');

/**
 * Initializes the call controls and event listeners.
 */
function setupCallControls() {
  try {
    callStatusElement = document.getElementById('call-status');

    const callButton = document.getElementById('call-btn');
    const muteButton = document.getElementById('mute-btn');
    const endCallButton = document.getElementById('end-call-btn');
    const startVideoCallButton = document.getElementById('start-video-call-btn');

    if (callButton) {
      callButton.addEventListener('click', async () => {
        console.log('Call button clicked');
        await makeCall();
      });
    } else {
      console.warn('Call button element not found');
    }

    if (muteButton) {
      muteButton.addEventListener('click', () => {
        console.log('Mute button clicked');
        toggleMute();
      });
    } else {
      console.warn('Mute button element not found');
    }

    if (endCallButton) {
      endCallButton.addEventListener('click', () => {
        console.log('End call button clicked');
        endCall();
      });
    } else {
      console.warn('End call button element not found');
    }

    if (startVideoCallButton) {
      startVideoCallButton.addEventListener('click', async () => {
        console.log('Start video call button clicked');
        await startVideoCall();
      });
    } else {
      console.warn('Start video call button element not found');
    }

    console.log('Call controls setup complete');
  } catch (error) {
    console.error('Error setting up call controls:', error);
  }
}

/**
 * Configures the Twilio device for making calls.
 * @returns {Promise<void>}
 */
async function setupDevice() {
  try {
    const identity = `user_${Date.now()}`;
    console.log(`Setting up Twilio device with identity: ${identity}`);

    const tokenResponse = await axios.get(`${state.NGROK_URL}/token`, {
      params: { identity },
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (!tokenResponse.data || !tokenResponse.data.token) {
      throw new Error('No token received from server');
    }

    device = new Device(tokenResponse.data.token, {
      codecPreferences: ['opus', 'pcmu'],
      fakeLocalDTMF: true,
      debug: true,
      enableRingingState: true,
    });

    device.on('ready', () => {
      console.log('Twilio.Device is ready');
    });

    device.on('error', (error) => {
      console.error('Twilio.Device Error:', error);
    });

    device.on('disconnect', () => {
      console.log('Twilio.Device disconnected');
      handleCallDisconnect();
    });

    console.log('Twilio.Device setup complete');
  } catch (error) {
    console.error('Error setting up Twilio device:', error);
    throw error;
  }
}

/**
 * Handles actions to perform when a call is disconnected.
 */
function handleCallDisconnect() {
  updateCallStatus('Call ended');
  stopCallDurationTimer();
  updateCallControls(false);
  setTimeout(() => {
    updateCallStatus('');
  }, CALL_END_STATUS_DURATION);
}

/**
 * Initiates a call to the current conversation.
 * @returns {Promise<void>}
 */
async function makeCall() {
  if (!currentConversation.sid) {
    alert('Please select a conversation before making a call.');
    console.warn('makeCall aborted: No conversation selected');
    return;
  }

  if (call && call.status() === 'open') {
    alert('You are already in a call.');
    console.warn('makeCall aborted: Call already in progress');
    return;
  }

  try {
    if (!device) {
      console.log('Twilio Device not set up. Attempting to set up...');
      await setupDevice();
    }

    console.log('Fetching call parameters...');
    const params = await api.getCallParams(currentConversation.sid);
    console.debug('Call parameters fetched:', params);

    // Send SMS notification
    const smsMessage = `Your provider is going to call you from ${params.From} in 5 seconds.`;
    await api.sendMessage(currentConversation.sid, smsMessage);
    console.log('SMS notification sent:', smsMessage);

    updateCallStatus('Notifying patient...');

    // Wait for 5 seconds before initiating the call
    await delay(CALL_NOTIFICATION_DELAY);

    console.log('Initiating call...');
    call = device.connect({ To: params.To, From: params.From });
    updateCallStatus('Calling...');

    // Set up event handlers for the call
    call.on('accept', handleCallAccept);
    call.on('disconnect', handleCallDisconnect);
    call.on('error', handleCallError);

  } catch (error) {
    console.error('Error making call:', error);
    alert('Failed to initiate call. Please check the console for more details.');
    updateCallStatus('Call failed');
  }
}

/**
 * Handles call acceptance.
 */
function handleCallAccept() {
  console.log('Call accepted by the recipient');
  updateCallStatus('In call');
  startCallDurationTimer();
  updateCallControls(true);
}

/**
 * Handles call errors.
 * @param {Error} error - The error object.
 */
function handleCallError(error) {
  console.error('Call encountered an error:', error);
  updateCallStatus('Call error');
  stopCallDurationTimer();
  updateCallControls(false);
}

/**
 * Toggles the mute state of the current call.
 */
function toggleMute() {
  try {
    if (!call) {
      console.warn('toggleMute called but no active call found');
      return;
    }

    isMuted = !isMuted;
    call.mute(isMuted);
    console.log(isMuted ? 'Call muted' : 'Call unmuted');

    const muteButton = document.getElementById('mute-btn');
    if (!muteButton) {
      console.warn('Mute button element not found');
      return;
    }

    const muteButtonIcon = muteButton.querySelector('i');
    if (muteButtonIcon) {
      muteButtonIcon.setAttribute('data-feather', isMuted ? 'mic-off' : 'mic');
      feather.replace();
    } else {
      console.warn('Mute button icon element not found');
    }
  } catch (error) {
    console.error('Error toggling mute state:', error);
  }
}

/**
 * Ends the current call.
 */
function endCall() {
  try {
    if (!call) {
      console.warn('endCall called but no active call found');
      return;
    }

    call.disconnect();
    console.log('Call disconnected by user');
    updateCallControls(false);
    updateCallStatus('Call ended');
  } catch (error) {
    console.error('Error ending call:', error);
  }
}

/**
 * Updates the visibility of call control buttons based on call state.
 * @param {boolean} isInCall - Whether a call is currently active.
 */
function updateCallControls(isInCall) {
  try {
    const callButton = document.getElementById('call-btn');
    const muteButton = document.getElementById('mute-btn');
    const endCallButton = document.getElementById('end-call-btn');

    if (!callButton || !muteButton || !endCallButton) {
      console.warn('One or more call control buttons not found');
      return;
    }

    if (isInCall) {
      callButton.style.display = 'none';
      muteButton.style.display = 'inline-block';
      endCallButton.style.display = 'inline-block';
    } else {
      callButton.style.display = 'inline-block';
      muteButton.style.display = 'none';
      endCallButton.style.display = 'none';
    }

    console.log(`Call controls updated: isInCall = ${isInCall}`);
  } catch (error) {
    console.error('Error updating call controls:', error);
  }
}

/**
 * Starts the call duration timer.
 */
function startCallDurationTimer() {
  try {
    callStartTime = new Date();
    callDurationInterval = setInterval(updateCallDuration, CALL_DURATION_UPDATE_INTERVAL);
    console.log('Call duration timer started');
  } catch (error) {
    console.error('Error starting call duration timer:', error);
  }
}

/**
 * Stops the call duration timer.
 */
function stopCallDurationTimer() {
  try {
    if (callDurationInterval) {
      clearInterval(callDurationInterval);
      callDurationInterval = null;
      console.log('Call duration timer stopped');
    }
  } catch (error) {
    console.error('Error stopping call duration timer:', error);
  }
}

/**
 * Updates the call duration display.
 */
function updateCallDuration() {
  try {
    if (!callStartTime) {
      console.warn('updateCallDuration called but callStartTime is not set');
      return;
    }

    const now = new Date();
    const duration = now - callStartTime;
    const minutes = Math.floor(duration / MILLISECONDS_IN_MINUTE);
    const seconds = Math.floor((duration % MILLISECONDS_IN_MINUTE) / MILLISECONDS_IN_SECOND);
    const formattedDuration = `${padZero(minutes)}:${padZero(seconds)}`;

    updateCallStatus(`In call - ${formattedDuration}`);
  } catch (error) {
    console.error('Error updating call duration:', error);
  }
}

/**
 * Pads a number with a leading zero if necessary.
 * @param {number} num - The number to pad.
 * @returns {string} The padded number as a string.
 */
function padZero(num) {
  return num.toString().padStart(2, '0');
}

/**
 * Updates the call status display.
 * @param {string} status - The current call status.
 */
function updateCallStatus(status) {
  try {
    if (!callStatusElement) {
      console.warn('Call status element not found');
      return;
    }

    callStatusElement.textContent = status;
    callStatusElement.className = ''; // Reset classes

    if (status.toLowerCase().includes('calling')) {
      callStatusElement.classList.add('calling');
    } else if (status.toLowerCase().includes('in call')) {
      callStatusElement.classList.add('in-call');
    } else if (status.toLowerCase().includes('call ended')) {
      callStatusElement.classList.add('call-ended');
    } else if (status.toLowerCase().includes('error')) {
      callStatusElement.classList.add('call-error');
    }

    console.log(`Call status updated to: ${status}`);
  } catch (error) {
    console.error('Error updating call status:', error);
  }
}

/**
 * Initiates a video call.
 * @returns {Promise<void>}
 */
export async function startVideoCall() {
  try {
    const conversationSid = currentConversation.sid;
    const phoneElement = document.querySelector('.contact-item span');

    if (!phoneElement) {
      throw new Error('Phone number element not found');
    }

    const customerPhoneNumber = phoneElement.textContent.trim();
    console.log('Retrieved phone number:', customerPhoneNumber);

    if (!isValidPhoneNumber(customerPhoneNumber)) {
      throw new Error(`Invalid phone number format: ${customerPhoneNumber}`);
    }

    console.log('Creating video room...');
    const response = await api.createVideoRoom({
      customerPhoneNumber,
      conversationSid,
    });

    const { link, roomName } = response;
    console.log('Video room created:', { link, roomName });

    // Open the video room in a new window or tab
    window.open(`/video-room/${roomName}`, '_blank');
  } catch (error) {
    console.error('Error starting video call:', error);
    alert('Failed to start video call. Please try again.');
  }
}

/**
 * Validates the phone number format.
 * @param {string} phoneNumber - The phone number to validate.
 * @returns {boolean} Whether the phone number is valid.
 */
function isValidPhoneNumber(phoneNumber) {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
}

/**
 * Delays execution for a specified amount of time.
 * @param {number} ms - Milliseconds to delay.
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Initialize call controls when the script is loaded
document.addEventListener('DOMContentLoaded', setupCallControls);

export { makeCall, toggleMute, endCall, setupCallControls, handleCallAccept, handleCallDisconnect,handleCallError,updateCallStatus, startCallDurationTimer, stopCallDurationTimer};