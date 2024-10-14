const jest = require('jest-mock');

// Create mock functions
const conversationsListMock = jest.fn();
const participantsListMock = jest.fn();
const messagesListMock = jest.fn();
const messagesCreateMock = jest.fn();
const conversationsFetchMock = jest.fn();
const videoRoomsCreateMock = jest.fn();  // Add video rooms create mock

// Mock conversation instance
const conversationInstanceMock = jest.fn((sid) => ({
  participants: {
    list: participantsListMock,
  },
  messages: {
    list: messagesListMock,
    create: messagesCreateMock,
  },
  fetch: conversationsFetchMock,
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
  messages: {
    create: messagesCreateMock,
  },
  video: {
    v1: {
      rooms: {
        create: videoRoomsCreateMock,  // Add video rooms create mock
      },
    },
  },
};

// Expose mocks for testing
clientMock.__conversationsListMock = conversationsListMock;
clientMock.__participantsListMock = participantsListMock;
clientMock.__messagesListMock = messagesListMock;
clientMock.__messagesCreateMock = messagesCreateMock;
clientMock.__conversationsFetchMock = conversationsFetchMock;
clientMock.__conversationInstanceMock = conversationInstanceMock;
clientMock.__videoRoomsCreateMock = videoRoomsCreateMock;  // Expose video rooms create mock

module.exports = clientMock;