/**
 * @jest-environment jsdom
 */

import { loadMessages, handleNewMessage } from '../messages';
import { api } from '../api';
import { currentConversation, state } from '../state';
import { updateConversationPreview, incrementUnreadCount } from '../conversations';
import { appendMessage, renderMessages, moveConversationToTop } from '../ui';
import { log, playNotificationSound } from '../utils';

jest.mock('../api');
jest.mock('../state');
jest.mock('../conversations');
jest.mock('../ui');
jest.mock('../utils');

describe('Messages Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset state if necessary
    state.TWILIO_PHONE_NUMBER = '+1234567890';
    currentConversation.sid = 'conv1';
  });

  // Tests for loadMessages
  describe('loadMessages', () => {
    const sid = 'conv1';

    it('should fetch and render messages successfully', async () => {
      const mockMessages = [
        { sid: 'msg1', body: 'Hello' },
        { sid: 'msg2', body: 'Hi' },
      ];
      api.getMessages.mockResolvedValue(mockMessages);

      await loadMessages(sid);

      expect(api.getMessages).toHaveBeenCalledWith(sid, { limit: 1000, order: 'asc' });
      expect(renderMessages).toHaveBeenCalledWith(mockMessages);
      expect(updateConversationPreview).toHaveBeenCalledWith(sid, mockMessages[mockMessages.length - 1]);
      expect(log).not.toHaveBeenCalled();
    });

    it('should log a message if the conversation is not found (404)', async () => {
      const error = {
        response: {
          status: 404,
        },
      };
      api.getMessages.mockRejectedValue(error);

      await loadMessages(sid);

      expect(api.getMessages).toHaveBeenCalledWith(sid, { limit: 1000, order: 'asc' });
      expect(renderMessages).not.toHaveBeenCalled();
      expect(updateConversationPreview).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(`Conversation ${sid} was not found, it may have been deleted.`);
    });

    it('should log an error message for other errors', async () => {
      const error = new Error('Network Error');
      api.getMessages.mockRejectedValue(error);

      await loadMessages(sid);

      expect(api.getMessages).toHaveBeenCalledWith(sid, { limit: 1000, order: 'asc' });
      expect(renderMessages).not.toHaveBeenCalled();
      expect(updateConversationPreview).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(`Error fetching messages for conversation ${sid}`, { error });
    });
  });

  // Tests for handleNewMessage
  describe('handleNewMessage', () => {
    const messageData = {
      author: '+1987654321',
      conversationSid: 'conv1',
      body: 'New message from other user',
      // dateCreated is intentionally left out to test its defaulting
    };

    it('should play notification sound if the message is not from the current user', () => {
      handleNewMessage(messageData);

      expect(playNotificationSound).toHaveBeenCalled();
    });

    it('should not play notification sound if the message is from the current user', () => {
      const selfMessageData = { ...messageData, author: state.TWILIO_PHONE_NUMBER };
      handleNewMessage(selfMessageData);

      expect(playNotificationSound).not.toHaveBeenCalled();
    });

    it('should append message if it belongs to the current conversation', () => {
      handleNewMessage(messageData);

      expect(appendMessage).toHaveBeenCalledWith(expect.objectContaining(messageData));
      expect(incrementUnreadCount).not.toHaveBeenCalled();
    });

    it('should increment unread count if the message is for a different conversation and not from the current user', () => {
      const differentConvData = { ...messageData, conversationSid: 'conv2' };
      handleNewMessage(differentConvData);

      expect(appendMessage).not.toHaveBeenCalled();
      expect(incrementUnreadCount).toHaveBeenCalledWith('conv2');
    });

    it('should not increment unread count if the message is for a different conversation but from the current user', () => {
      const differentConvSelfData = {
        ...messageData,
        conversationSid: 'conv2',
        author: state.TWILIO_PHONE_NUMBER,
      };
      handleNewMessage(differentConvSelfData);

      expect(appendMessage).not.toHaveBeenCalled();
      expect(incrementUnreadCount).not.toHaveBeenCalled();
    });

    it('should update conversation preview and move the conversation to top', () => {
      handleNewMessage(messageData);

      expect(updateConversationPreview).toHaveBeenCalledWith('conv1', {
        body: messageData.body,
        author: messageData.author,
        dateCreated: messageData.dateCreated,
      });
      expect(moveConversationToTop).toHaveBeenCalledWith('conv1');
    });
  });
});