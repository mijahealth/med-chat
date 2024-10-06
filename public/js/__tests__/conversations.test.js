// Import necessary modules and functions
import { loadConversations, handleNewConversation, handleUpdateConversation } from '../conversations';
import { api } from '../api';
import { renderConversations, moveConversationToTop } from '../ui';
import { currentConversation, state } from '../state';

// Mock modules to prevent actual API calls and DOM manipulations
jest.mock('../api');
jest.mock('../ui', () => ({
  renderConversations: jest.fn(),
  moveConversationToTop: jest.fn(),
}));

describe('Conversations Module', () => {
  // Setup before each test to ensure consistent test environments
  beforeEach(() => {
    jest.clearAllMocks();
    state.conversations = []; // Ensure conversations are always initialized
    state.conversationsLoaded = false;
    currentConversation.sid = null;
  });

  afterEach(() => {
    // Additional cleanup if necessary
  });

  it('loadConversations should fetch and render conversations', async () => {
    const mockConversations = [
      { sid: 'conv1', lastMessage: 'Hello', lastMessageTime: '2023-10-01T10:00:00Z' },
      { sid: 'conv2', lastMessage: 'Hi', lastMessageTime: '2023-10-02T12:00:00Z' },
    ];

    // Mocking the API response
    api.getConversations.mockResolvedValue(mockConversations);
    
    await loadConversations();

    // Assertions to validate expected behavior
    expect(api.getConversations).toHaveBeenCalledTimes(1);
    expect(renderConversations).toHaveBeenCalledWith(mockConversations);
    expect(state.conversationsLoaded).toBe(true);
    expect(state.conversations).toEqual(mockConversations);  // Ensure the state matches expected conversations
  });

  it('handleNewConversation should add a new conversation if it does not exist', () => {
    const newConversation = { sid: 'conv3', lastMessage: 'New message' };
    
    // Act
    handleNewConversation(newConversation);

    // Assertions to validate new conversation is added
    expect(state.conversations.length).toBe(1);
    expect(state.conversations[0]).toEqual(newConversation);
  });

  it('handleNewConversation should update existing conversation if it exists', () => {
    // Initial conversation state setup
    state.conversations = [{ sid: 'conv1', lastMessage: 'Old Message' }];

    const updatedConversation = { sid: 'conv1', lastMessage: 'Updated Message' };
    
    // Act
    handleNewConversation(updatedConversation);

    // Assertions to validate conversation was updated and not duplicated
    expect(state.conversations.length).toBe(1);
    expect(state.conversations[0].lastMessage).toBe('Updated Message');
    expect(renderConversations).toHaveBeenCalledWith(state.conversations, true);
  });

  it('handleUpdateConversation should update an existing conversation', () => {
    // Initial conversation state setup
    state.conversations = [{ sid: 'conv1', lastMessage: 'Old Message' }];

    const updatedConversation = { sid: 'conv1', lastMessage: 'Updated Message' };
    
    // Act
    handleUpdateConversation(updatedConversation);

    // Assertions to validate conversation was updated and render was called
    expect(state.conversations[0].lastMessage).toBe('Updated Message');
    expect(renderConversations).toHaveBeenCalledWith(state.conversations);
  });
});