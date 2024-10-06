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

  test('getConversationDetails should fetch details of a specific conversation', async () => {
    const mockConversationDetails = { sid: 'conv1', name: 'Test Conversation' };
    axios.get.mockResolvedValue({ data: mockConversationDetails });
  
    const conversationDetails = await api.getConversationDetails('conv1');
  
    expect(axios.get).toHaveBeenCalledWith('/conversations/conv1');
    expect(conversationDetails).toEqual(mockConversationDetails);
  });
  
  test('getMessages should fetch messages for a specific conversation', async () => {
    const mockMessages = [{ sid: 'msg1', body: 'Hello' }, { sid: 'msg2', body: 'Hi' }];
    axios.get.mockResolvedValue({ data: mockMessages });
  
    const messages = await api.getMessages('conv1');
  
    expect(axios.get).toHaveBeenCalledWith('/conversations/conv1/messages', { params: {} });
    expect(messages).toEqual(mockMessages);
  });
  
  test('markMessagesAsRead should mark all messages in a conversation as read', async () => {
    const mockResponse = { success: true };
    axios.post.mockResolvedValue({ data: mockResponse });
  
    const response = await api.markMessagesAsRead('conv1');
  
    expect(axios.post).toHaveBeenCalledWith('/conversations/conv1/mark-read');
    expect(response).toEqual(mockResponse);
  });
  
  test('startConversation should start a new conversation', async () => {
    const mockConversation = { sid: 'conv1', name: 'New Conversation' };
    const newConversationData = { name: 'New Conversation', participants: ['user1', 'user2'] };
    axios.post.mockResolvedValue({ data: mockConversation });
  
    const conversation = await api.startConversation(newConversationData);
  
    expect(axios.post).toHaveBeenCalledWith('/start-conversation', newConversationData);
    expect(conversation).toEqual(mockConversation);
  });
  
  test('searchConversations should search for conversations based on a query', async () => {
    const mockConversations = [{ sid: 'conv1', name: 'Test Conversation' }];
    axios.get.mockResolvedValue({ data: mockConversations });
  
    const conversations = await api.searchConversations('Test');
  
    expect(axios.get).toHaveBeenCalledWith('/search', { params: { query: 'Test' } });
    expect(conversations).toEqual(mockConversations);
  });
  
  test('getCallParams should fetch call parameters for a specific conversation', async () => {
    const mockCallParams = { sid: 'conv1', token: 'callToken123' };
    axios.get.mockResolvedValue({ data: mockCallParams });
  
    const callParams = await api.getCallParams('conv1');
  
    expect(axios.get).toHaveBeenCalledWith('/call-params/conv1');
    expect(callParams).toEqual(mockCallParams);
  });
  
  test('createVideoRoom should create a new video chat room', async () => {
    const mockVideoRoom = { sid: 'room1', uniqueName: 'TestRoom' };
    const videoRoomData = { uniqueName: 'TestRoom' };
    axios.post.mockResolvedValue({ data: mockVideoRoom });
  
    const videoRoom = await api.createVideoRoom(videoRoomData);
  
    expect(axios.post).toHaveBeenCalledWith('/create-room', videoRoomData);
    expect(videoRoom).toEqual(mockVideoRoom);
  });
});