// public/js/__mocks__/twilio-video.js

export default {
  connect: jest.fn(() =>
    Promise.resolve({
      participants: new Map(),
      localParticipant: {
        tracks: new Map(),
        audioTracks: new Map(),
        videoTracks: new Map(),
      },
      on: jest.fn(),
      disconnect: jest.fn(),
    })
  ),
  createLocalAudioTrack: jest.fn(() =>
    Promise.resolve({
      attach: jest.fn(() => document.createElement('audio')),
      mediaStreamTrack: {},
      stop: jest.fn(),
      isEnabled: true,
      enable: jest.fn(),
      on: jest.fn(),
    })
  ),
  createLocalVideoTrack: jest.fn(() =>
    Promise.resolve({
      attach: jest.fn(() => document.createElement('video')),
      mediaStreamTrack: {},
      stop: jest.fn(),
      isEnabled: true,
      enable: jest.fn(),
      on: jest.fn(),
    })
  ),
};