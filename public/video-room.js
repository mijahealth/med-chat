console.log('Video room script loaded');

let videoRoom, localTrack;

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
    
    videoRoom.participants.forEach(participantConnected);
    videoRoom.on('participantConnected', participantConnected);
    videoRoom.on('participantDisconnected', participantDisconnected);

    console.log('Creating local video track');
    localTrack = await Twilio.Video.createLocalVideoTrack();
    const localMediaContainer = document.getElementById('local-video');
    localMediaContainer.appendChild(localTrack.attach());
    console.log('Local video track attached');
  } catch (error) {
    console.error('Error connecting to video room:', error);
    alert('Failed to connect to the video room. Please try again.');
  }
}

function participantConnected(participant) {
  console.log('Participant connected:', participant.identity);
  const remoteMediaContainer = document.getElementById('remote-video');
  participant.tracks.forEach(publication => {
    if (publication.isSubscribed) {
      remoteMediaContainer.appendChild(publication.track.attach());
    }
  });
  participant.on('trackSubscribed', track => {
    remoteMediaContainer.appendChild(track.attach());
  });
}

function participantDisconnected(participant) {
  console.log('Participant disconnected:', participant.identity);
  participant.tracks.forEach(publication => {
    const attachedElements = publication.track.detach();
    attachedElements.forEach(element => element.remove());
  });
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