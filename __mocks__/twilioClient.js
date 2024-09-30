// __mocks__/twilioClient.js

const mockConversations = {
  v1: {
    conversations: {
      list: jest.fn().mockResolvedValue([
        {
          sid: 'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          friendlyName: 'Test Conversation 1',
          attributes: '{}',
        },
        {
          sid: 'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          friendlyName: 'Test Conversation 2',
          attributes: '{"email":"test2@example.com","name":"Test User 2"}',
        },
      ]),
      conversations: (_sid) => ({
        participants: {
          list: jest.fn().mockResolvedValue([
            {
              sid: 'PAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
              messagingBinding: { address: '+1234567890' },
              identity: 'User1',
            },
          ]),
        },
        messages: {
          list: jest.fn().mockResolvedValue([
            {
              body: 'Hello, this is a test message.',
              dateCreated: '2024-09-30T20:00:00Z',
            },
          ]),
        },
      }),
    },
  },
};

module.exports = mockConversations;