// public/js/__mocks__/conversations.js

export const appendMessage = jest.fn();
export const incrementUnreadCount = jest.fn();
export const moveConversationToTop = jest.fn();
export const updateConversationPreview = jest.fn();
export const loadConversations = jest.fn(() => Promise.resolve());
export const handleNewConversation = jest.fn();
export const handleUpdateConversation = jest.fn();
export const removeConversationFromUI = jest.fn();
export const updateLatestMessagePreview = jest.fn();
export const fetchConversation = jest.fn();
export const listConversations = jest.fn();
export const createConversation = jest.fn();
export const deleteConversation = jest.fn();
export const addMessage = jest.fn();
export const listMessages = jest.fn();
export const markMessagesAsRead = jest.fn();