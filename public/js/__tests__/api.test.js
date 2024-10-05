// public/js/__tests__/api.test.js
import { api } from '../api';
import axios from 'axios';

jest.mock('axios');

describe('API Module', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('getConversations should fetch conversations successfully', async () => {
    const mockConversations = [{ sid: 'conv1' }, { sid: 'conv2' }];
    axios.get.mockResolvedValue({ data: mockConversations });

    const conversations = await api.getConversations();

    expect(axios.get).toHaveBeenCalledWith('/conversations');
    expect(conversations).toEqual(mockConversations);
  });

  test('sendMessage should handle sending a message', async () => {
    const mockMessage = { sid: 'msg1', body: 'Hello' };
    axios.post.mockResolvedValue({ data: mockMessage });

    const message = await api.sendMessage('conv1', 'Hello');

    expect(axios.post).toHaveBeenCalledWith('/conversations/conv1/messages', { message: 'Hello' });
    expect(message).toEqual(mockMessage);
  });

  test('deleteConversation should delete a conversation', async () => {
    const mockResponse = { success: true };
    axios.delete.mockResolvedValue({ data: mockResponse });

    const response = await api.deleteConversation('conv1');

    expect(axios.delete).toHaveBeenCalledWith('/conversations/conv1', {
      data: { confirmToken: 'CONFIRM_DELETE' },
    });
    expect(response).toEqual(mockResponse);
  });

  test('getConfig should fetch configuration', async () => {
    const mockConfig = { TWILIO_PHONE_NUMBER: '+1234567890', NGROK_URL: 'https://example.ngrok.io' };
    axios.get.mockResolvedValue({ data: mockConfig });

    const config = await api.getConfig();

    expect(axios.get).toHaveBeenCalledWith('/config');
    expect(config).toEqual(mockConfig);
  });

  // Add more tests for other API methods...
});