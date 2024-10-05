// public/js/__tests__/messages.test.js
import { loadMessages, handleNewMessage } from '../messages';
import { api } from '../api';
import { renderMessages, appendMessage } from '../ui';
import { updateConversationPreview, incrementUnreadCount } from '../conversations';
import { currentConversation, state } from '../state';
import { log } from '../utils';

jest.mock('../api');
jest.mock('../ui');
jest.mock('../conversations');
jest.mock('../utils');

describe('Messages Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="messages"></div>
      <div id="call-status"></div>
    `;
    currentConversation.sid = 'conv1';
  });

  test('loadMessages should fetch and render messages', async () => {
    const mockMessages = [
      { author: '+1234567890', body: 'Hello', dateCreated: '2023-10-05T12:00:00Z' },
      { author: '+0987654321', body: 'Hi there!', dateCreated: '2023-10-05T12:05:00Z' },
    ];
    api.getMessages.mockResolvedValue(mockMessages);
    updateConversationPreview.mockImplementation(() => {});
    renderMessages.mockImplementation(() => {});

    await loadMessages('conv1');

    expect(api.getMessages).toHaveBeenCalledWith('conv1', { limit: 1000, order: 'asc' });
    expect(renderMessages).toHaveBeenCalledWith(mockMessages);
    expect(updateConversationPreview).toHaveBeenCalledWith('conv1', mockMessages[mockMessages.length - 1]);
  });

  test('handleNewMessage should append message and update preview', () => {
    const newMessage = {
      author: '+1234567890',
      conversationSid: 'conv1',
      body: 'New message!',
      dateCreated: '2023-10-05T12:10:00Z',
    };

    handleNewMessage(newMessage);

    expect(appendMessage).toHaveBeenCalledWith(newMessage);
    expect(updateConversationPreview).toHaveBeenCalledWith('conv1', {
      body: 'New message!',
      author: '+1234567890',
      dateCreated: '2023-10-05T12:10:00Z',
    });
    expect(incrementUnreadCount).not.toHaveBeenCalled();
  });

  test('handleNewMessage should increment unread count for messages not from us', () => {
    const newMessage = {
      author: '+0987654321', // Not from our Twilio number
      conversationSid: 'conv1',
      body: 'Incoming message!',
      dateCreated: '2023-10-05T12:15:00Z',
    };

    handleNewMessage(newMessage);

    expect(appendMessage).not.toHaveBeenCalled();
    expect(updateConversationPreview).toHaveBeenCalledWith('conv1', {
      body: 'Incoming message!',
      author: '+0987654321',
      dateCreated: '2023-10-05T12:15:00Z',
    });
    expect(incrementUnreadCount).toHaveBeenCalledWith('conv1');
  });

  // Add more tests as needed...
});