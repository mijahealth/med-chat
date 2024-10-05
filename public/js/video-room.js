// public/js/video-room.js

import axios from 'axios';
import feather from 'feather-icons';
import Video from 'twilio-video';

// Replace alert with a custom modal function or a logging mechanism
function showAlert(message) {
  alert(message);
}

console.log('Video room script loaded');

let videoRoom, localTrack, localAudioTrack;
let isMuted = false;

// Audio visualization
let audioContext, analyser, dataArray;

// Constants
const AUDIO_LEVEL_DIVISOR = 128;
const BOX_SHADOW_BLUR = 20;
const BOX_SHADOW_SPREAD = 10;

async function setupVideo() {
  const userName = document.getElementById('user-name').value.trim();
  if (!userName) {
    showAlert('Please enter your name before joining.');
    return;
  }

  console.log('Setup video called');
  const lastPart = window.location.pathname.split('/').pop();
  const [roomName] = lastPart.split('?');
  
    console.log('Room name:', roomName);

  try {
    showLoading(true);
    console.log('Fetching token');
    const response = await axios.get(
      `/token?identity=${encodeURIComponent(userName)}`
    );
    const { token, identity } = response.data;
    console.log('Token received for identity:', identity);
    console.log('Creating local audio and video tracks');
    try {
      // Create local tracks using destructuring directly into the variables
      ([localAudioTrack, localTrack] = await Promise.all([
        Video.createLocalAudioTrack(),
        Video.createLocalVideoTrack(),
      ]));

      // Publish local tracks
      const tracksToPublish = [];
      if (localAudioTrack) {
        tracksToPublish.push(localAudioTrack);
        console.log('Local audio track created and added to publish list');
      } else {
        console.error('Failed to create local audio track');
      }

      if (localTrack) {
        tracksToPublish.push(localTrack);
        console.log('Local video track created and added to publish list');
      } else {
        console.error('Failed to create local video track');
      }

      // Connect to the video room with published tracks
      console.log('Connecting to video room with local tracks');
      videoRoom = await Video.connect(token, {
        name: roomName,
        tracks: tracksToPublish,
        dominantSpeaker: true,
      });
      console.log('Connected to video room:', videoRoom.name);

      // Update UI
      document.getElementById('join-container').style.display = 'none';
      document.getElementById('video-container').classList.add('active');
      document.getElementById('video-controls').classList.add('active');

      // Handle existing participants
      videoRoom.participants.forEach(participantConnected);
      videoRoom.on('participantConnected', participantConnected);
      videoRoom.on('participantDisconnected', participantDisconnected);

      // Attach local video to DOM and display local participant name
      setupLocalParticipant(userName);

      // Add event listeners for local audio track
      if (localAudioTrack) {
        console.log('Local audio track created');
        localAudioTrack.on('enabled', () => {
          console.log('Local audio track enabled');
        });
        localAudioTrack.on('disabled', () => {
          console.log('Local audio track disabled');
        });
      }

      setupControlListeners();

      // Setup audio visualization
      if (localAudioTrack) {
        const audioStream = new MediaStream([
          localAudioTrack.mediaStreamTrack,
        ]);
        setupAudioVisualization(audioStream);
      }

      showLoading(false);
    } catch (trackError) {
      console.error('Error creating or publishing local tracks:', trackError);
      showAlert(
        'Could not access the camera or microphone. Please enable them.'
      );
      showLoading(false);
    }
  } catch (error) {
    console.error('Error connecting to video room:', error);
    showAlert('Failed to connect to the video room. Please try again.');
    showLoading(false);
  }
}

function setupControlListeners() {
  // Mute Button Listener
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.addEventListener('click', toggleMute);
    console.log('Mute button listener added');
  } else {
    console.error('Mute button not found');
  }

  // Hangup Button Listener
  const hangupBtn = document.getElementById('hangup-btn');
  if (hangupBtn) {
    hangupBtn.addEventListener('click', hangUp);
    console.log('Hangup button listener added');
  } else {
    console.error('Hangup button not found');
  }
}

function toggleMute() {
  if (localAudioTrack) {
    isMuted = !isMuted;
    localAudioTrack.enable(!isMuted);
    updateButtonState('mute-btn', isMuted);
    console.log(`Microphone is now ${isMuted ? 'muted' : 'unmuted'}.`);

    // Log the current state of all local audio tracks
    videoRoom.localParticipant.audioTracks.forEach((publication) => {
      if (publication.track) {
        console.log(`Track enabled: ${publication.track.isEnabled}`);
      }
    });
  } else {
    console.error('No local audio track available to mute/unmute.');
  }
}

function hangUp() {
  if (videoRoom) {
    videoRoom.disconnect();
    console.log('Disconnected from video room');

    // Clean up local tracks
    if (localTrack) {
      localTrack.stop();
      localTrack = null;
      console.log('Local video track stopped and cleared');
    }
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack = null;
      console.log('Local audio track stopped and cleared');
    }

    // Reset UI
    document.getElementById('video-container').classList.remove('active');
    document.getElementById('video-controls').classList.remove('active');
    document.getElementById('join-container').style.display = 'flex';

    // Clear video containers
    document.getElementById('local-video').innerHTML = '';
    document.getElementById('remote-video').innerHTML = '';
    console.log('UI reset and video containers cleared');
  } else {
    console.error('No video room to disconnect from');
  }
}

function updateButtonState(buttonId, isActive) {
  const button = document.getElementById(buttonId);
  if (button) {
    if (isActive) {
      button.classList.add('bg-red-500', 'hover:bg-red-600');
      button.classList.remove('bg-gray-200', 'hover:bg-gray-300');
    } else {
      button.classList.remove('bg-red-500', 'hover:bg-red-600');
      button.classList.add('bg-gray-200', 'hover:bg-gray-300');
    }
  } else {
    console.error(`Button with ID ${buttonId} not found`);
  }
}

function participantConnected(participant) {
  console.log('Participant connected:', participant.identity);
  const remoteMediaContainer = document.getElementById('remote-video');

  const participantContainer = document.createElement('div');
  participantContainer.id = participant.sid;
  participantContainer.classList.add('relative', 'w-full', 'h-full');

  const nameOverlay = document.createElement('div');
  nameOverlay.textContent = participant.identity;
  nameOverlay.classList.add(
    'absolute',
    'bottom-2',
    'left-2',
    'bg-black',
    'bg-opacity-50',
    'text-white',
    'px-2',
    'py-1',
    'rounded',
    'z-10'
  );
  participantContainer.appendChild(nameOverlay);

  remoteMediaContainer.appendChild(participantContainer);

  participant.tracks.forEach((publication) => {
    if (publication.isSubscribed) {
      attachTrack(publication.track, participantContainer);
    }
  });

  participant.on('trackSubscribed', (track) => {
    attachTrack(track, participantContainer);
  });

  participant.on('trackUnsubscribed', (track) => {
    detachTrack(track);
  });

  participant.on('disconnected', () => {
    console.log('Participant disconnected:', participant.identity);
    participantContainer.remove();
  });
}

function attachTrack(track, container) {
  const element = track.attach();
  container.appendChild(element);
  console.log(`Attached ${track.kind} track from ${track.sid}`);
}

function participantDisconnected(participant) {
  console.log('Participant disconnected:', participant.identity);
  participant.tracks.forEach((publication) => {
    if (publication.track) {
      detachTrack(publication.track);
    }
  });
}

function setupLocalParticipant(userName) {
  const localMediaContainer = document.getElementById('local-video');
  localMediaContainer.classList.add('relative', 'w-full', 'h-full');

  if (localTrack) {
    const videoElement = localTrack.attach();
    videoElement.classList.add('w-full', 'h-full', 'object-cover');
    localMediaContainer.innerHTML = ''; // Clear any existing content
    localMediaContainer.appendChild(videoElement);
    console.log('Local video track attached. Video element:', videoElement);
  }

  const nameOverlay = document.createElement('div');
  nameOverlay.textContent = userName;
  nameOverlay.classList.add(
    'absolute',
    'bottom-2',
    'left-2',
    'bg-black',
    'bg-opacity-50',
    'text-white',
    'px-2',
    'py-1',
    'rounded',
    'z-10'
  );
  localMediaContainer.appendChild(nameOverlay);
}

function detachTrack(track) {
  track.detach().forEach((element) => {
    element.remove();
  });
  console.log(`Detached ${track.kind} track from ${track.sid}`);
}

function showLoading(isLoading) {
  const joinButton = document.getElementById('join-call-btn');
  const loadingSpinner = document.getElementById('loading-spinner');
  if (joinButton && loadingSpinner) {
    if (isLoading) {
      joinButton.disabled = true;
      joinButton.classList.add('opacity-50', 'cursor-not-allowed');
      loadingSpinner.style.display = 'inline-block';
      joinButton.querySelector('span').textContent = 'Joining...';
    } else {
      joinButton.disabled = false;
      joinButton.classList.remove('opacity-50', 'cursor-not-allowed');
      loadingSpinner.style.display = 'none';
      joinButton.querySelector('span').textContent = 'Join Video Call';
    }
  } else {
    console.error('Join button or loading spinner not found');
  }
}

function setupAudioVisualization(stream) {
  if (!stream) {
    console.error('No audio stream available for visualization');
    return;
  }

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    updateAudioVisualization();
  } catch (error) {
    console.error('Error setting up audio visualization:', error);
  }
}

function updateAudioVisualization() {
  if (!analyser || !dataArray) {
    return;
  }

  try {
    analyser.getByteFrequencyData(dataArray);
    const average =
      dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
    const audioLevel = average / AUDIO_LEVEL_DIVISOR; // Normalize to 0-1 range

    const muteButton = document.getElementById('mute-btn');
    if (muteButton) {
      muteButton.style.boxShadow =
        `0 0 ${audioLevel * BOX_SHADOW_BLUR}px ` +
        `${audioLevel * BOX_SHADOW_SPREAD}px rgba(59, 130, 246, ${audioLevel})`;
    }

    requestAnimationFrame(updateAudioVisualization);
  } catch (error) {
    console.error('Error updating audio visualization:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  feather.replace();
  console.log('DOM fully loaded and icons replaced');

  const joinCallBtn = document.getElementById('join-call-btn');
  const userNameInput = document.getElementById('user-name');

  if (joinCallBtn && userNameInput) {
    joinCallBtn.addEventListener('click', () => {
      console.log('Call button clicked');
      if (userNameInput.value.trim()) {
        setupVideo();
      } else {
        showAlert('Please enter your name before joining.');
      }
    });
    console.log('Join call button listener added');
  } else {
    console.error('Join call button or user name input not found');
  }
});