// public/js/__mocks__/call.js

export const makeCall = jest.fn(() => Promise.resolve());
export const toggleMute = jest.fn();
export const endCall = jest.fn();
export const setupCallControls = jest.fn();
export const handleCallAccept = jest.fn();
export const handleCallDisconnect = jest.fn();
export const handleCallError = jest.fn();
export const updateCallStatus = jest.fn();
export const startCallDurationTimer = jest.fn();
export const stopCallDurationTimer = jest.fn();
export const startVideoCall = jest.fn(() => Promise.resolve());