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

// Create a mock function for conversations.v1.conversations that can be called with a SID
const mockConversationsFunction = jest.fn((sid) => ({
  fetch: jest.fn(() => Promise.resolve({ sid, friendlyName: 'Test Conversation', attributes: '{}' })),
  remove: jest.fn(() => Promise.resolve()),
  messages: {
    list: jest.fn(() => Promise.resolve([])),
    create: jest.fn(() => Promise.resolve({ sid: 'IM123' })),
  },
  participants: {
    create: jest.fn(() => Promise.resolve({})),
  },
}));

// Attach 'list' and 'create' methods to the conversations mock function
mockConversationsFunction.list = jest.fn(() => Promise.resolve([]));
mockConversationsFunction.create = jest.fn(() => Promise.resolve({ sid: 'CH123' }));

// Define the twilio mock function
const twilio = jest.fn(() => ({
  conversations: {
    v1: {
      conversations: mockConversationsFunction,
      video: {
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