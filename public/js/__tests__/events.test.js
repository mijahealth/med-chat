// public/js/__tests__/events.test.js
import { setupEventListeners } from '../events';
import { api } from '../api';
import { selectConversation } from '../events';
import { currentConversation, state } from '../state';
import { fireEvent, screen, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom/extend-expect';

jest.mock('../api');
jest.mock('../conversations.js');
jest.mock('../ui.js');

describe('Events Module', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="new-conversation-btn">New Conversation</button>
      <div id="new-conversation-modal" class="modal" style="display: none;">
        <form id="new-conversation-form">
          <input name="phoneNumber" data-validate="phone" />
          <input name="name" data-validate="name" />
          <input name="email" data-validate="email" />
          <input name="dob" data-validate="dob" />
          <input name="state" data-validate="state" />
          <textarea name="message" data-validate="message"></textarea>
          <button type="submit">Start Conversation</button>
        </form>
      </div>
      <input id="search-input" />
      <button id="send-message-btn">Send</button>
      <input id="new-message" />
      <div id="conversations"></div>
    `;
    setupEventListeners();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('clicking new-conversation-btn opens the modal', () => {
    const newConversationBtn = screen.getByText('New Conversation');
    fireEvent.click(newConversationBtn);
    expect(document.getElementById('new-conversation-modal').style.display).toBe('flex');
  });

  test('submitting new conversation form with valid data', async () => {
    const mockResponse = { sid: 'conv1', existing: false };
    api.startConversation.mockResolvedValue(mockResponse);
    api.getConversations.mockResolvedValue([{ sid: 'conv1' }]);
    // Mock renderConversations and selectConversation
    const {renderConversations} = require('../conversations');
    const selectConversationMock = require('../events').selectConversation;
    
    document.getElementById('new-conversation-form').innerHTML = `
      <input name="phoneNumber" value="+1234567890" />
      <input name="name" value="John Doe" />
      <input name="email" value="john@example.com" />
      <input name="dob" value="1990-01-01" />
      <input name="state" value="California" />
      <textarea name="message">Hello!</textarea>
      <button type="submit">Start Conversation</button>
    `;

    const form = screen.getByText('Start Conversation').closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(api.startConversation).toHaveBeenCalledWith({
        phoneNumber: '+1234567890',
        name: 'John Doe',
        email: 'john@example.com',
        dob: '1990-01-01',
        state: 'California',
        message: 'Hello!',
      });
      expect(renderConversations).toHaveBeenCalled();
      expect(selectConversationMock).toHaveBeenCalledWith('conv1');
      expect(document.getElementById('new-conversation-modal').style.display).toBe('none');
    });
  });

  // Add more tests for validation, error handling, search functionality, etc.
});