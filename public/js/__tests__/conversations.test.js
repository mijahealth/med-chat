// public/js/__tests__/conversations.test.js
import { loadConversations, handleNewConversation, handleUpdateConversation } from '../conversations';
import { api } from '../api';
import { renderConversations } from '../ui';
import { currentConversation, state } from '../state';

jest.mock('../api');
jest.mock('../ui');

describe('Conversations Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state.conversationsLoaded = false;
    currentConversation.sid = null;
  });

  test('loadConversations should fetch and render conversations', async () => {
    const mockConversations = [
      { sid: 'conv1', lastMessageTime: '2023-10-01T10:00:00Z', lastMessage: 'Hello' },
      { sid: 'conv2', lastMessageTime: '2023-10-02T12:00:00Z', lastMessage: 'Hi' },
    ];
    api.getConversations.mockResolvedValue(mockConversations);

    const conversations = await loadConversations();

    expect(api.getConversations).toHaveBeenCalled();
    expect(mockConversations).toHaveBeenCalledTimes(1);
    expect(renderConversations).toHaveBeenCalledWith(mockConversations);
    expect(state.conversationsLoaded).toBe(true);
    expect(conversations).toEqual(mockConversations);
  });

  test('handleNewConversation should add a new conversation if it does not exist', () => {
    const newConv = { conversationSid: 'conv3', lastMessage: 'Hey there' };
    handleNewConversation(newConv);

    expect(renderConversations).toHaveBeenCalledWith([newConv], true);
  });

  test('handleNewConversation should update existing conversation if it exists', () => {
    document.body.innerHTML = '<div id="conv-conv1"></div>';
    const existingConv = { conversationSid: 'conv1', lastMessage: 'Updated Message' };
    
    handleNewConversation(existingConv);

    expect(api.getMessages).not.toHaveBeenCalled();
    expect(renderConversations).not.toHaveBeenCalled();
    // Additional expectations based on how updateConversationPreview and moveConversationToTop are implemented
  });

  // Add more tests for other functions...
});