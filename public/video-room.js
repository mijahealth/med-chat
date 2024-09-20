console.log('Video room script loaded');

let videoRoom, localTrack, localAudioTrack;
let isMuted = false;

// Audio visualization
let audioContext, analyser, dataArray;
let animationFrame;

async function setupVideo() {
    console.log('Setup video called');
    const roomName = window.location.pathname.split('/').pop().split('?')[0]; // Remove query parameters
    console.log('Room name:', roomName);

    try {
        showLoading(true);
        console.log('Fetching token');
        const response = await axios.get('/token');
        const token = response.data.token;
        console.log('Token received:', token.substr(0, 10) + '...' + token.substr(-10));

        console.log('Creating local audio and video tracks');
        try {
            // Create local tracks
            [localAudioTrack, localTrack] = await Promise.all([
                Twilio.Video.createLocalAudioTrack(),
                Twilio.Video.createLocalVideoTrack()
            ]);

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
            videoRoom = await Twilio.Video.connect(token, { name: roomName, tracks: tracksToPublish });
            console.log('Connected to video room:', videoRoom.name);

            // Update UI
            document.getElementById('join-container').style.display = 'none';
            document.getElementById('video-container').classList.add('active');
            document.getElementById('video-controls').classList.add('active');

            // Handle existing participants
            videoRoom.participants.forEach(participantConnected);
            videoRoom.on('participantConnected', participantConnected);
            videoRoom.on('participantDisconnected', participantDisconnected);

            // Attach local video to DOM
            if (localTrack) {
                const localMediaContainer = document.getElementById('local-video');
                const videoElement = localTrack.attach();
                localMediaContainer.innerHTML = ''; // Clear any existing content
                localMediaContainer.appendChild(videoElement);
                console.log('Local video track attached. Video element:', videoElement);
            }

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
                const audioStream = new MediaStream([localAudioTrack.mediaStreamTrack]);
                setupAudioVisualization(audioStream);
            }

            showLoading(false);
        } catch (trackError) {
            console.error('Error creating or publishing local tracks:', trackError);
            alert('Could not access the camera or microphone. Please ensure they are working and the page has permission to access them.');
            showLoading(false);
        }

    } catch (error) {
        console.error('Error connecting to video room:', error);
        alert('Failed to connect to the video room. Please try again.');
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
        videoRoom.localParticipant.audioTracks.forEach(publication => {
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

    participant.tracks.forEach(publication => {
        if (publication.isSubscribed) {
            attachTrack(publication.track, remoteMediaContainer);
        }
    });

    participant.on('trackSubscribed', track => {
        attachTrack(track, remoteMediaContainer);
    });

    participant.on('trackUnsubscribed', track => {
        detachTrack(track);
    });

    participant.on('disconnected', () => {
        console.log('Participant disconnected:', participant.identity);
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

    // Optional: Create Room Modal Logic
    /*
    const createRoomModal = document.getElementById('create-room-modal');
    const openCreateRoomBtn = document.getElementById('open-create-room');
    const createRoomForm = document.getElementById('create-room-form');

    if (openCreateRoomBtn && createRoomModal && createRoomForm) {
        openCreateRoomBtn.addEventListener('click', () => {
            createRoomModal.classList.remove('hidden');
        });

        createRoomForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('room-password').value;

            try {
                const response = await axios.post('/create-room', { password });
                const { roomName } = response.data;
                // Redirect to the new room
                window.location.href = `/room/${roomName}`;
            } catch (error) {
                console.error('Error creating room:', error);
                alert('Failed to create room. Please try again.');
            }
        });
    } else {
        console.error('Create room elements not found');
    }
    */
});