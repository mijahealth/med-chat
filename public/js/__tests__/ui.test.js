// public/js/__tests__/ui.test.js
import { renderConversations, appendMessage } from '../ui';
import { setupWebSocket } from '../websocket';
import { currentConversation } from '../state';
import '@testing-library/jest-dom/extend-expect';

describe('UI Module', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="conversations"></div>
      <div id="messages"></div>
    `;
  });

  test('renderConversations should display all conversations', () => {
    const mockConversations = [
      { sid: 'conv1', friendlyName: 'John Doe', lastMessage: 'Hello', lastMessageTime: '2023-10-05T10:00:00Z' },
      { sid: 'conv2', friendlyName: 'Jane Smith', lastMessage: 'Hi', lastMessageTime: '2023-10-05T11:00:00Z' },
    ];

    renderConversations(mockConversations);

    const conversationsDiv = document.getElementById('conversations');
    expect(conversationsDiv.children.length).toBe(2);
    expect(conversationsDiv).toHaveTextContent('John Doe');
    expect(conversationsDiv).toHaveTextContent('Hello');
    expect(conversationsDiv).toHaveTextContent('Jane Smith');
    expect(conversationsDiv).toHaveTextContent('Hi');
  });

  test('appendMessage should add a message to the messages container', () => {
    const message = {
      author: '+1234567890',
      body: 'Hello World',
      dateCreated: '2023-10-05T12:00:00Z',
    };

    appendMessage(message);

    const messagesDiv = document.getElementById('messages');
    expect(messagesDiv).toHaveTextContent('Hello World');
    expect(messagesDiv).toHaveTextContent('12:00 PM'); // Depending on locale
  });

  // Add more tests for other UI functions...
});