// public/js/__mocks__/ui.js

// If ui.js is used as a dependency in other modules and needs to be mocked,
// you can define mock implementations here. Otherwise, you can omit this file.

export const renderMessages = jest.fn();
export const updateConversationPreview = jest.fn();
export const appendMessage = jest.fn();
export const moveConversationToTop = jest.fn();
export const showNoConversationSelected = jest.fn();
export const renderConversations = jest.fn();
export const showMessageInput = jest.fn();
export const updateConversationHeader = jest.fn();
export const initializeApp = jest.fn(() => Promise.resolve());