// public/js/__tests__/video-room.test.js
import { setupVideo, toggleMute, hangUp } from '../video-room';
import axios from 'axios';
import Video from 'twilio-video';
import { playNotificationSound, log } from '../utils';

jest.mock('axios');
jest.mock('twilio-video');
jest.mock('../utils');

describe('Video Room Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="join-container">
        <input id="user-name" value="John Doe" />
        <button id="join-call-btn">Join Video Call</button>
        <div id="loading-spinner" style="display: none;"></div>
      </div>
      <div id="video-container"></div>
      <div id="video-controls"></div>
      <div id="local-video"></div>
      <div id="remote-video"></div>
      <div id="call-status"></div>
    `;
  });

  test('setupVideo should initialize video call successfully', async () => {
    const mockConfig = { TWILIO_PHONE_NUMBER: '+1234567890', NGROK_URL: 'https://example.ngrok.io' };
    axios.get.mockResolvedValueOnce({ data: mockConfig });

    const mockToken = 'mock-token';
    axios.get.mockResolvedValueOnce({ data: { token: mockToken, identity: 'John Doe' } });

    const mockAudioTrack = { attach: jest.fn(() => document.createElement('audio')), on: jest.fn(), stop: jest.fn() };
    const mockVideoTrack = { attach: jest.fn(() => document.createElement('video')), on: jest.fn(), stop: jest.fn() };
    Video.createLocalAudioTrack.mockResolvedValue(mockAudioTrack);
    Video.createLocalVideoTrack.mockResolvedValue(mockVideoTrack);

    const mockRoom = {
      name: 'room1',
      participants: [],
      on: jest.fn(),
      disconnect: jest.fn(),
    };
    Video.connect.mockResolvedValue(mockRoom);

    await setupVideo();

    expect(axios.get).toHaveBeenCalledWith('/config');
    expect(axios.get).toHaveBeenCalledWith('/token?identity=John%20Doe');
    expect(Video.createLocalAudioTrack).toHaveBeenCalled();
    expect(Video.createLocalVideoTrack).toHaveBeenCalled();
    expect(Video.connect).toHaveBeenCalledWith(mockToken, expect.any(Object));
    expect(document.getElementById('join-container').style.display).toBe('none');
    expect(document.getElementById('video-container').classList).toContain('active');
    expect(document.getElementById('video-controls').classList).toContain('active');
    // Add more assertions as needed...
  });

  test('toggleMute should mute and unmute the local audio track', () => {
    const mockAudioTrack = { enable: jest.fn() };
    Video.createLocalAudioTrack.mockResolvedValue(mockAudioTrack);
    state.userInteracted = true;

    // Assume setupVideo has been called and audio track is established
    setupVideo();

    toggleMute();
    expect(mockAudioTrack.enable).toHaveBeenCalledWith(false);

    toggleMute();
    expect(mockAudioTrack.enable).toHaveBeenCalledWith(true);
  });

  test('hangUp should disconnect from the video room and clean up tracks', () => {
    const mockRoom = {
      disconnect: jest.fn(),
      localParticipant: {
        tracks: {
          forEach: jest.fn((callback) => callback({ track: { stop: jest.fn() } })),
        },
      },
    };
    Video.connect.mockResolvedValue(mockRoom);

    setupVideo();
    hangUp();

    expect(mockRoom.disconnect).toHaveBeenCalled();
    expect(mockRoom.localParticipant.tracks.forEach).toHaveBeenCalled();
    expect(document.getElementById('video-container').classList).not.toContain('active');
    expect(document.getElementById('join-container').style.display).toBe('flex');
    // Add more assertions as needed...
  });

  // Add more tests for error handling, UI updates, etc.
});