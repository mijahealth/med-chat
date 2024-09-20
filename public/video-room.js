console.log('Video room script loaded');

let videoRoom, localTrack, localAudioTrack;
let isMuted = false;
let isCameraOff = false;

// Audio visualization
let audioContext, analyser, dataArray;
let animationFrame;

async function setupVideo() {
  console.log('Setup video called');
  const roomName = window.location.pathname.split('/').pop();
  console.log('Room name:', roomName);
  
  try {
    showLoading(true);
    console.log('Fetching token');
    const response = await axios.get('/token');
    const token = response.data.token;
    console.log('Token received:', token.substr(0, 10) + '...' + token.substr(-10));

    console.log('Connecting to video room');
    videoRoom = await Twilio.Video.connect(token, { name: roomName });
    console.log('Connected to video room:', videoRoom.name);
    
    document.getElementById('join-call-btn').style.display = 'none';
    document.getElementById('video-controls').style.display = 'flex';

    videoRoom.participants.forEach(participantConnected);
    videoRoom.on('participantConnected', participantConnected);
    videoRoom.on('participantDisconnected', participantDisconnected);

    console.log('Creating local audio and video tracks');
    [localAudioTrack, localTrack] = await Promise.all([
      Twilio.Video.createLocalAudioTrack(),
      Twilio.Video.createLocalVideoTrack().then(track => {
        const localMediaContainer = document.getElementById('local-video');
        localMediaContainer.appendChild(track.attach());
        console.log('Camera loaded and local video track attached.');
      }).catch(error => {
        console.error('Failed to create local video track:', error);
        alert('Could not access the camera. Please ensure the camera is working and the page has permission to access it.');
      })
    ]);

    setupControlListeners();
    
    const audioStream = new MediaStream([localAudioTrack.mediaStreamTrack]);
    setupAudioVisualization(audioStream);
    
    showLoading(false);

  } catch (error) {
    console.error('Error connecting to video room:', error);
    alert('Failed to connect to the video room. Please try again.');
    showLoading(false);
  }
}

function setupControlListeners() {
  document.getElementById('mute-btn').addEventListener('click', toggleMute);
  document.getElementById('camera-btn').addEventListener('click', toggleCamera);
  document.getElementById('hangup-btn').addEventListener('click', hangUp);
}

function toggleMute() {
  if (localAudioTrack) {
    isMuted = !isMuted;
    localAudioTrack.enable(!isMuted);
    updateButtonState('mute-btn', isMuted);
  }
}

function toggleCamera() {
  if (localTrack) {
    isCameraOff = !isCameraOff;
    localTrack.enable(!isCameraOff);
    updateButtonState('camera-btn', isCameraOff);
  }
}

function hangUp() {
  if (videoRoom) {
    videoRoom.disconnect();
    window.close();
  }
}

function updateButtonState(buttonId, isActive) {
  const button = document.getElementById(buttonId);
  if (isActive) {
    button.classList.add('bg-red-500', 'hover:bg-red-600');
    button.classList.remove('bg-gray-200', 'hover:bg-gray-300');
  } else {
    button.classList.remove('bg-red-500', 'hover:bg-red-600');
    button.classList.add('bg-gray-200', 'hover:bg-gray-300');
  }
}

function participantConnected(participant) {
  console.log('Participant connected:', participant.identity);
  const remoteMediaContainer = document.getElementById('remote-video');

  participant.tracks.forEach(publication => {
    if (publication.isSubscribed) {
      attachTrack(publication.track, remoteMediaContainer);
    }
  });

  participant.on('trackSubscribed', track => {
    attachTrack(track, remoteMediaContainer);
  });
}

function attachTrack(track, container) {
  const element = track.attach();
  container.appendChild(element);
  console.log(`Attached ${track.kind} track from ${track.sid}`);
}

function participantDisconnected(participant) {
  console.log('Participant disconnected:', participant.identity);
  participant.tracks.forEach(publication => {
    if (publication.track) {
      detachTrack(publication.track);
    }
  });
}

function detachTrack(track) {
  track.detach().forEach(element => {
    element.remove();
  });
  console.log(`Detached ${track.kind} track from ${track.sid}`);
}

function showLoading(isLoading) {
  const joinButton = document.getElementById('join-call-btn');
  const loadingSpinner = document.getElementById('loading-spinner');
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
  if (!analyser || !dataArray) return;
  
  try {
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
    const audioLevel = average / 128; // Normalize to 0-1 range
    
    const muteButton = document.getElementById('mute-btn');
    if (muteButton) {
      muteButton.style.boxShadow = `0 0 ${audioLevel * 20}px ${audioLevel * 10}px rgba(59, 130, 246, ${audioLevel})`;
    }
    
    animationFrame = requestAnimationFrame(updateAudioVisualization);
  } catch (error) {
    console.error('Error updating audio visualization:', error);
  }
}

document.addEventListener('DOMContentLoaded', (event) => {
  feather.replace(); // Initialize feather icons right when the DOM is fully loaded
  console.log('DOM fully loaded and icons replaced');
  const joinCallBtn = document.getElementById('join-call-btn');
  if (joinCallBtn) {
    joinCallBtn.addEventListener('click', setupVideo);
    console.log('Join call button listener added');
  } else {
    console.error('Join call button not found');
  }
});