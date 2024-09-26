// public/js/call.js
import { currentConversation, state } from './state.js';
import { api } from './api.js';
import { log } from './utils.js';
import { Device } from 'twilio-client';
import axios from 'axios';

let call = null;
let isMuted = false;
let device = null;
let callStatusElement = null;
let callStartTime;
let callDurationInterval;

// At the beginning of the file
console.log('call.js loaded');

export function setupCallControls() {
  console.log('setupCallControls function called');

  // Initialize callStatusElement
  callStatusElement = document.getElementById('call-status');
  console.log('Call status element:', callStatusElement);

  // Attach event listeners for the call controls
  const callBtn = document.getElementById('call-btn');
  if (callBtn) {
    console.log('Call button found');
    callBtn.addEventListener('click', () => {
      console.log('Call button clicked');
      makeCall();
    });
  } else {
    console.log('Call button not found');
  }

  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    console.log('Mute button found');
    muteBtn.addEventListener('click', () => {
      console.log('Mute button clicked');
      toggleMute();
    });
  } else {
    console.log('Mute button not found');
  }

  const endCallBtn = document.getElementById('end-call-btn');
  if (endCallBtn) {
    console.log('End call button found');
    endCallBtn.addEventListener('click', () => {
      console.log('End call button clicked');
      endCall();
    });
  } else {
    console.log('End call button not found');
  }

  // Video call button
  const startVideoCallBtn = document.getElementById('start-video-call-btn');
  if (startVideoCallBtn) {
    console.log('Start video call button found');
    startVideoCallBtn.addEventListener('click', () => {
      console.log('Start video call button clicked');
      startVideoCall();
    });
  } else {
    console.log('Start video call button not found');
  }

  console.log('setupCallControls function completed');
}

async function setupDevice() {
  try {
    const identity = 'user_' + Date.now();  // Generate a unique identity
    const response = await api.getConfig(); // Assuming your backend provides a token endpoint
    const tokenResponse = await axios.get(`${state.NGROK_URL}/token`, {
      params: { identity: identity },
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (!tokenResponse.data || !tokenResponse.data.token) {
      throw new Error('No token received from server');
    }

    device = new Twilio.Device(tokenResponse.data.token, {
      codecPreferences: ['opus', 'pcmu'],
      fakeLocalDTMF: true,
      debug: true,
      enableRingingState: true,
    });

    device.on('ready', () => {
      console.log('Twilio.Device Ready!');
    });

    device.on('error', (error) => {
      console.error('Twilio.Device Error:', error);
    });

    device.on('disconnect', () => {
      console.log('Call ended.');
      updateCallStatus('Call ended');
      stopCallDurationTimer();
      setTimeout(() => {
        updateCallStatus('');
      }, 3000);
    });

    console.log('Twilio.Device setup complete');
  } catch (error) {
    console.error('Error setting up Twilio device:', error);
    throw error;
  }
}

async function makeCall() {
  if (!currentConversation.sid) {
    alert('Please select a conversation before making a call.');
    return;
  }

  if (call && call.status() === 'open') {
    alert('You are already in a call.');
    return;
  }

  try {
    if (!device) {
      console.log('Twilio Device not set up. Attempting to set up...');
      await setupDevice();
    }

    console.log('Fetching call parameters...');
    const params = await api.getCallParams(currentConversation.sid);

    // Send SMS notification
    const smsMessage = `Your provider is going to call you from ${params.From} in 5 seconds.`;
    await api.sendMessage(currentConversation.sid, smsMessage);

    console.log('SMS notification sent. Waiting 5 seconds before initiating call...');
    updateCallStatus('Notifying patient...');

    // Wait for 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Initiating call...');
    call = device.connect({ To: params.To, From: params.From });
    updateCallStatus('Calling...');

    // Set up event handlers for the call
    call.on('accept', () => {
      console.log('Call accepted');
      updateCallStatus('In call');
      startCallDurationTimer();

      updateCallControls(true); // Hide call button, show mute and end call buttons
    });

    call.on('disconnect', () => {
      console.log('Call disconnected');
      updateCallStatus('Call ended');
      stopCallDurationTimer();

      updateCallControls(false); // Show call button, hide mute and end call buttons
    });

    call.on('error', (error) => {
      console.error('Call error:', error);
      updateCallStatus('Call error');
    });

  } catch (error) {
    console.error('Error making call:', error);
    alert('Failed to initiate call. Please check the console for more details.');
  }
}

function toggleMute() {
  if (call) {
    isMuted = !isMuted;
    call.mute(isMuted);
    const muteButtonIcon = document.getElementById('mute-btn').querySelector('i');
    if (isMuted) {
      console.log('Call muted');
      muteButtonIcon.setAttribute('data-feather', 'mic-off');
    } else {
      console.log('Call unmuted');
      muteButtonIcon.setAttribute('data-feather', 'mic');
    }
    feather.replace();
  }
}

function endCall() {
  if (call) {
    call.disconnect();
    updateCallControls(false); // Show call button, hide mute and end call buttons
    updateCallStatus('Call ended');
  }
}

function updateCallControls(isInCall) {
  const callButton = document.getElementById('call-btn');
  const muteButton = document.getElementById('mute-btn');
  const endCallButton = document.getElementById('end-call-btn');

  if (callButton && muteButton && endCallButton) {
    if (isInCall) {
      callButton.style.display = 'none';
      muteButton.style.display = 'inline-block';
      endCallButton.style.display = 'inline-block';
    } else {
      callButton.style.display = 'inline-block';
      muteButton.style.display = 'none';
      endCallButton.style.display = 'none';
    }
  }
}

function startCallDurationTimer() {
  callStartTime = new Date();
  callDurationInterval = setInterval(updateCallDuration, 1000);
}

function stopCallDurationTimer() {
  clearInterval(callDurationInterval);
}

function updateCallDuration() {
  const now = new Date();
  const duration = now - callStartTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  const formattedDuration = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
  updateCallStatus(`In call - ${formattedDuration}`);
}

function updateCallStatus(status) {
  if (callStatusElement) {
    callStatusElement.textContent = status;

    // Remove existing status classes
    callStatusElement.classList.remove('calling', 'in-call', 'call-ended', 'call-error');

    // Add the appropriate class
    if (status.toLowerCase().includes('calling')) {
      callStatusElement.classList.add('calling');
    } else if (status.toLowerCase().includes('in call')) {
      callStatusElement.classList.add('in-call');
    } else if (status.toLowerCase().includes('call ended')) {
      callStatusElement.classList.add('call-ended');
    } else if (status.toLowerCase().includes('error')) {
      callStatusElement.classList.add('call-error');
    }
  } else {
    console.log('Call status element not found');
  }
}

async function startVideoCall() {
  try {
    const conversationSid = currentConversation.sid;
    const phoneElement = document.querySelector('.contact-item span');

    if (!phoneElement) {
      throw new Error('Phone number element not found');
    }

    const customerPhoneNumber = phoneElement.textContent.trim();
    console.log('Retrieved phone number:', customerPhoneNumber);

    if (!/^\+[1-9]\d{1,14}$/.test(customerPhoneNumber)) {
      throw new Error(`Invalid phone number format: ${customerPhoneNumber}`);
    }

    const response = await api.createVideoRoom({ customerPhoneNumber, conversationSid });
    const { link, roomName } = response;

    console.log('Room link:', link);

    // Open the video room in a new window or tab
    window.open(`/video-room/${roomName}`, '_blank');
  } catch (error) {
    console.error('Error starting video call:', error);
    alert('Failed to start video call. Please try again.');
  }
}