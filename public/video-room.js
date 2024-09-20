console.log('Video room script loaded');

let videoRoom, localTrack, localAudioTrack;
let isMuted = false;
let isCameraOff = false;

async function setupVideo() {
  console.log('Setup video called');
  const roomName = window.location.pathname.split('/').pop();
  console.log('Room name:', roomName);
  
  try {
    console.log('Fetching token');
    const response = await axios.get('/token');
    const token = response.data.token;
    console.log('Token received:', token.substr(0, 10) + '...' + token.substr(-10));

    console.log('Connecting to video room');
    videoRoom = await Twilio.Video.connect(token, { name: roomName });
    console.log('Connected to video room:', videoRoom.name);
    
    // Hide join button and show controls
    document.getElementById('join-call-btn').style.display = 'none';
    document.getElementById('controls').style.display = 'block';

    videoRoom.participants.forEach(participantConnected);
    videoRoom.on('participantConnected', participantConnected);
    videoRoom.on('participantDisconnected', participantDisconnected);

    console.log('Creating local audio and video tracks');
    [localAudioTrack, localTrack] = await Promise.all([
      Twilio.Video.createLocalAudioTrack(),
      Twilio.Video.createLocalVideoTrack()
    ]);
    const localMediaContainer = document.getElementById('local-video');
    localMediaContainer.appendChild(localTrack.attach());
    console.log('Local video track attached');

    setupControlListeners();

  } catch (error) {
    console.error('Error connecting to video room:', error);
    alert('Failed to connect to the video room. Please try again.');
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
    document.getElementById('mute-btn').textContent = isMuted ? 'Unmute' : 'Mute';
  }
}

function toggleCamera() {
  if (localTrack) {
    isCameraOff = !isCameraOff;
    localTrack.enable(!isCameraOff);
    document.getElementById('camera-btn').textContent = isCameraOff ? 'Turn Camera On' : 'Turn Camera Off';
  }
}

function hangUp() {
  if (videoRoom) {
    videoRoom.disconnect();
    window.close();
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

document.addEventListener('DOMContentLoaded', (event) => {
  console.log('DOM fully loaded');
  const joinCallBtn = document.getElementById('join-call-btn');
  if (joinCallBtn) {
    joinCallBtn.addEventListener('click', setupVideo);
    console.log('Join call button listener added');
  } else {
    console.error('Join call button not found');
  }
});