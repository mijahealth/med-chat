// public/js/__mocks__/state.js

export const currentConversation = {
  sid: 'CH_DEFAULT_SID', // Default SID, can be overridden in tests
};

export const state = {
  TWILIO_PHONE_NUMBER: '+1234567890', // Default Twilio phone number
  NGROK_URL: 'http://localhost:3000',  // Default NGROK URL
  userInteracted: false,
  autoScrollEnabled: true,
  conversationsLoaded: false,
  currentTheme: 'light',
  appInitialized: false, // Added this line
};