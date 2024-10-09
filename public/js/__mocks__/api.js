// public/js/__mocks__/api.js

/**
 * Mock implementation of the api module for testing purposes.
 */

export const api = {
  getConfig: jest.fn(() =>
    Promise.resolve({
      TWILIO_PHONE_NUMBER: '+1234567890',
      NGROK_URL: 'http://localhost:3000',
    })
  ),

  getConversations: jest.fn(() =>
    Promise.resolve([
      // Return a list of mock conversations
      {
        sid: 'CH1234567890',
        friendlyName: 'Test Conversation',
        lastMessage: 'Hello, world!',
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
        attributes: {
          phoneNumber: '+19876543210',
          name: 'Test User',
          email: 'testuser@example.com',
          dob: '1990-01-01',
          state: 'CA',
        },
      },
    ])
  ),

  getConversationDetails: jest.fn((sid) =>
    Promise.resolve({
      sid,
      friendlyName: 'Test Conversation',
      attributes: {
        phoneNumber: '+19876543210',
        name: 'Test User',
        email: 'testuser@example.com',
        dob: '1990-01-01',
        state: 'CA',
      },
    })
  ),

  getMessages: jest.fn((sid, params) =>
    Promise.resolve([
      // Return a list of mock messages
      {
        sid: 'IM1234567890',
        author: '+1234567890',
        body: 'Hello, this is a test message.',
        dateCreated: new Date().toISOString(),
      },
    ])
  ),

  sendMessage: jest.fn((sid, message) =>
    Promise.resolve({
      sid: 'IM0987654321',
      author: '+1234567890',
      body: message,
      dateCreated: new Date().toISOString(),
    })
  ),

  deleteConversation: jest.fn((sid) =>
    Promise.resolve({ success: true })
  ),

  markMessagesAsRead: jest.fn((sid) =>
    Promise.resolve({ success: true })
  ),

  startConversation: jest.fn((data) =>
    Promise.resolve({
      sid: 'CH0987654321',
      existing: false,
    })
  ),

  searchConversations: jest.fn((query) => Promise.resolve([])),

  getCallParams: jest.fn((sid) =>
    Promise.resolve({
      To: '+19876543210',
      From: '+1234567890',
    })
  ),

  createVideoRoom: jest.fn((data) =>
    Promise.resolve({
      link: '/video-room/test-room',
      roomName: 'test-room',
    })
  ),
};