// __mocks__/twilio.js

// Mock Classes
class VoiceGrant {
  constructor(options) {
    this.outgoingApplicationSid = options.outgoingApplicationSid;
    this.incomingAllow = options.incomingAllow;
  }
}

class VideoGrant {}

class AccessToken {
  constructor(accountSid, apiKey, apiSecret, options) {
    this.accountSid = accountSid;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.identity = options.identity;
    this.grants = [];
  }

  addGrant(grant) {
    this.grants.push(grant);
  }

  toJwt() {
    return 'mocked-jwt-token';
  }
}

AccessToken.VoiceGrant = VoiceGrant;
AccessToken.VideoGrant = VideoGrant;

class VoiceResponse {
  constructor() {
    this.response = '';
  }

  dial(options, number) {
    this.response += `<Dial callerId="${options.callerId}">${number}</Dial>`;
  }

  toString() {
    return `<Response>${this.response}</Response>`;
  }
}

// Define the twilio mock function
const twilio = jest.fn(() => ({
  conversations: {
    v1: {
      conversations: {
        list: jest.fn(() => Promise.resolve([])),
        create: jest.fn(() => Promise.resolve({ sid: 'CH123' })),
        remove: jest.fn(() => Promise.resolve()),
        fetch: jest.fn(() => Promise.resolve({ sid: 'CH123', attributes: '{}' })),
        messages: jest.fn(() => ({
          list: jest.fn(() => Promise.resolve([])),
          create: jest.fn(() => Promise.resolve({ sid: 'IM123' })),
        })),
        participants: jest.fn(() => ({
          create: jest.fn(() => Promise.resolve({})),
        })),
      },
    },
    video: {
      v1: {
        rooms: {
          create: jest.fn(() => Promise.resolve({ sid: 'RM123', uniqueName: 'VideoRoom_123' })),
        },
      },
    },
  },
  jwt: {
    AccessToken,
  },
  twiml: {
    VoiceResponse,
  },
}));

// Assign properties to the twilio mock function itself
twilio.jwt = {
  AccessToken,
};

twilio.twiml = {
  VoiceResponse,
};

module.exports = twilio;