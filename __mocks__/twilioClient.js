// __mocks__/twilioClient.js

const jest = require('jest-mock');

// Create mock functions
const conversationsListMock = jest.fn();
const participantsListMock = jest.fn();
const messagesListMock = jest.fn();

// Mock conversation instance
const conversationInstanceMock = jest.fn((sid) => ({
  participants: {
    list: participantsListMock,
  },
  messages: {
    list: messagesListMock,
  },
}));

// Make conversationsMock a jest mock function
const conversationsMock = jest.fn((sid) => conversationInstanceMock(sid));
conversationsMock.list = conversationsListMock;

// Create the client mock
const clientMock = {
  conversations: {
    v1: {
      conversations: conversationsMock,
    },
  },
};

// Expose mocks for testing
clientMock.__conversationsListMock = conversationsListMock;
clientMock.__participantsListMock = participantsListMock;
clientMock.__messagesListMock = messagesListMock;
clientMock.__conversationInstanceMock = conversationInstanceMock;

module.exports = clientMock;