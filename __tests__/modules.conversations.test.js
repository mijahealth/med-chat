// __tests__/modules.conversations.test.js

jest.mock('../modules/logger');

const logger = require('../modules/logger');
const client = require('../twilioClient');
const conversationsModule = require('../modules/conversations');

describe('Conversations Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default environment variable
    process.env.TWILIO_PHONE_NUMBER = '+12136983410';
  });

  describe('isMessageRead', () => {
    it('should return true if message.attributes.read is truthy', () => {
      const message = {
        attributes: JSON.stringify({ read: true }),
      };
      expect(conversationsModule.isMessageRead(message)).toBe(true);
    });

    it('should return false if message.attributes.read is falsy', () => {
      const message = {
        attributes: JSON.stringify({ read: false }),
      };
      expect(conversationsModule.isMessageRead(message)).toBe(false);
    });

    it('should return false if message.attributes is undefined', () => {
      const message = {};
      expect(conversationsModule.isMessageRead(message)).toBe(false);
    });

    it('should throw SyntaxError if message.attributes contains invalid JSON', () => {
      const message = {
        attributes: 'invalid json',
      };
      expect(() => conversationsModule.isMessageRead(message)).toThrow(SyntaxError);
    });
    it('should return false for messages with empty attributes', () => {
      const message = { attributes: '{}' };
      expect(conversationsModule.isMessageRead(message)).toBe(false);
    });

    it('should return false for messages with undefined attributes', () => {
      const message = {};
      expect(conversationsModule.isMessageRead(message)).toBe(false);
    });
  });

  describe('fetchConversation', () => {
    const sid = 'C1234567890';

    it('should fetch a conversation successfully', async () => {
      const mockConversation = { sid, friendlyName: 'Test Conversation' };
      const mockFetch = jest.fn().mockResolvedValue(mockConversation);
      client.conversations.v1.conversations.mockImplementation(() => ({
        fetch: mockFetch,
      }));

      const result = await conversationsModule.fetchConversation(sid);

      expect(client.conversations.v1.conversations).toHaveBeenCalledWith(sid);
      expect(mockFetch).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(`Fetched conversation: ${sid}`);
      expect(result).toBe(mockConversation);
    });

    it('should log and throw an error if fetching fails', async () => {
      const mockError = new Error('Fetch failed');
      const mockFetch = jest.fn().mockRejectedValue(mockError);
      client.conversations.v1.conversations.mockImplementation(() => ({
        fetch: mockFetch,
      }));

      await expect(conversationsModule.fetchConversation(sid)).rejects.toThrow('Fetch failed');

      expect(client.conversations.v1.conversations).toHaveBeenCalledWith(sid);
      expect(mockFetch).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Error fetching conversation', { sid, error: mockError });
    });
  });

  describe('createConversation', () => {
    const friendlyName = 'New Conversation';
    const attributes = { phoneNumber: '+3333333333' };
    const mockConversation = { sid: 'CH123', friendlyName };

    it('should create a conversation successfully', async () => {
      const mockCreate = jest.fn().mockResolvedValue(mockConversation);
      client.conversations.v1.conversations.create = mockCreate;

      const result = await conversationsModule.createConversation(friendlyName, attributes);

      expect(client.conversations.v1.conversations.create).toHaveBeenCalledWith({
        friendlyName,
        attributes: JSON.stringify(attributes),
      });
      expect(logger.info).toHaveBeenCalledWith(`Created conversation: ${mockConversation.sid}`);
      expect(result).toBe(mockConversation);
    });

    it('should log and throw an error if creation fails', async () => {
      const mockError = new Error('Creation failed');
      const mockCreate = jest.fn().mockRejectedValue(mockError);
      client.conversations.v1.conversations.create = mockCreate;

      await expect(conversationsModule.createConversation(friendlyName, attributes)).rejects.toThrow('Creation failed');

      expect(client.conversations.v1.conversations.create).toHaveBeenCalledWith({
        friendlyName,
        attributes: JSON.stringify(attributes),
      });
      expect(logger.error).toHaveBeenCalledWith('Error creating conversation', {
        friendlyName,
        attributes,
        error: mockError,
      });
    });

    it('should create a conversation without attributes', async () => {
      const mockConv = { sid: 'CH124', friendlyName: 'No Attributes' };
      const mockCreate = jest.fn().mockResolvedValue(mockConv);
      client.conversations.v1.conversations.create = mockCreate;

      const result = await conversationsModule.createConversation('No Attributes');

      expect(client.conversations.v1.conversations.create).toHaveBeenCalledWith({
        friendlyName: 'No Attributes',
        attributes: JSON.stringify({}),
      });
      expect(logger.info).toHaveBeenCalledWith(`Created conversation: ${mockConv.sid}`);
      expect(result).toBe(mockConv);
    });
  });

  describe('deleteConversation', () => {
    const sid = 'C1234567890';

    it('should delete a conversation successfully', async () => {
      const mockRemove = jest.fn().mockResolvedValue();
      client.conversations.v1.conversations.mockImplementation(() => ({
        remove: mockRemove,
      }));

      await conversationsModule.deleteConversation(sid);

      expect(client.conversations.v1.conversations).toHaveBeenCalledWith(sid);
      expect(mockRemove).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(`Deleted conversation: ${sid}`);
    });

    it('should log and throw an error if deletion fails', async () => {
      const mockError = new Error('Deletion failed');
      const mockRemove = jest.fn().mockRejectedValue(mockError);
      client.conversations.v1.conversations.mockImplementation(() => ({
        remove: mockRemove,
      }));

      await expect(conversationsModule.deleteConversation(sid)).rejects.toThrow('Deletion failed');

      expect(client.conversations.v1.conversations).toHaveBeenCalledWith(sid);
      expect(mockRemove).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Error deleting conversation', { sid, error: mockError });
    });
  });

  describe('addMessage', () => {
    const conversationSid = 'C1234567890';
    const messageBody = 'Test message';
    const author = '+12136983410';
    const mockMessage = { sid: 'M123', body: messageBody, author };

    it('should add a message to a conversation successfully', async () => {
      const mockCreate = jest.fn().mockResolvedValue(mockMessage);
      client.conversations.v1.conversations.mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      const result = await conversationsModule.addMessage(conversationSid, messageBody, author);

      expect(client.conversations.v1.conversations).toHaveBeenCalledWith(conversationSid);
      expect(client.conversations.v1.conversations(conversationSid).messages.create).toHaveBeenCalledWith({
        body: messageBody,
        author,
      });
      expect(logger.info).toHaveBeenCalledWith(
        `Added message to conversation ${conversationSid}: ${mockMessage.sid}`,
      );
      expect(result).toBe(mockMessage);
    });

    it('should log and throw an error if adding message fails', async () => {
      const mockError = new Error('Add message failed');
      const mockCreate = jest.fn().mockRejectedValue(mockError);
      client.conversations.v1.conversations.mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      await expect(conversationsModule.addMessage(conversationSid, messageBody, author)).rejects.toThrow('Add message failed');

      expect(client.conversations.v1.conversations).toHaveBeenCalledWith(conversationSid);
      expect(client.conversations.v1.conversations(conversationSid).messages.create).toHaveBeenCalledWith({
        body: messageBody,
        author,
      });
      expect(logger.error).toHaveBeenCalledWith('Error adding message to conversation', {
        conversationSid,
        message: messageBody,
        author,
        error: mockError,
      });
    });
  });

  describe('listMessages', () => {
    const conversationSid = 'C1234567890';
    const options = { limit: 10, order: 'asc' };
    const mockMessages = [
      { sid: 'M1', body: 'Hello' },
      { sid: 'M2', body: 'Hi' },
    ];

    it('should list messages in a conversation successfully', async () => {
      const mockList = jest.fn().mockResolvedValue(mockMessages);
      client.conversations.v1.conversations.mockImplementation(() => ({
        messages: {
          list: mockList,
        },
      }));

      const result = await conversationsModule.listMessages(conversationSid, options);

      expect(client.conversations.v1.conversations).toHaveBeenCalledWith(conversationSid);
      expect(client.conversations.v1.conversations(conversationSid).messages.list).toHaveBeenCalledWith(options);
      expect(logger.info).toHaveBeenCalledWith(
        `Fetched ${mockMessages.length} messages from conversation ${conversationSid}`,
      );
      expect(result).toBe(mockMessages);
    });

    it('should log and throw an error if listing messages fails', async () => {
      const mockError = new Error('List messages failed');
      const mockList = jest.fn().mockRejectedValue(mockError);
      client.conversations.v1.conversations.
      mockImplementation(() => ({
        messages: {
          list: mockList,
        },
      }));

      await expect(conversationsModule.listMessages(conversationSid, options)).rejects.toThrow('List messages failed');

      expect(client.conversations.v1.conversations).toHaveBeenCalledWith(conversationSid);
      expect(client.conversations.v1.conversations(conversationSid).messages.list).toHaveBeenCalledWith(options);
      expect(logger.error).toHaveBeenCalledWith('Error listing messages', { conversationSid, options, error: mockError });
    });

    it('should list messages with default options if none provided', async () => {
      const mockList = jest.fn().mockResolvedValue(mockMessages);
      client.conversations.v1.conversations.mockImplementation(() => ({
        messages: {
          list: mockList,
        },
      }));

      const result = await conversationsModule.listMessages(conversationSid);

      expect(client.conversations.v1.conversations(conversationSid).messages.list).toHaveBeenCalledWith({});
      expect(result).toBe(mockMessages);
    });

    it('should handle empty message list', async () => {
      const conversationSid = 'C1234567890';
      const mockList = jest.fn().mockResolvedValue([]);
      client.conversations.v1.conversations.mockImplementation(() => ({
        messages: {
          list: mockList,
        },
      }));

      const result = await conversationsModule.listMessages(conversationSid);

      expect(result).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith(
        'Fetched 0 messages from conversation C1234567890'
      );
    });
  });

  describe('getConversationByPhoneNumber', () => {
    const phoneNumber = '+4444444444';
    const mockConversations = [
      { sid: 'C1', attributes: '{"phoneNumber":"+1111111111"}' },
      { sid: 'C2', attributes: '{"phoneNumber":"+4444444444"}' },
      { sid: 'C3', attributes: '{"phoneNumber":"+5555555555"}' },
    ];

    it('should return the conversation matching the phone number', async () => {
      client.conversations.v1.conversations.list.mockResolvedValue(mockConversations);

      const result = await conversationsModule.getConversationByPhoneNumber(phoneNumber);

      expect(client.conversations.v1.conversations.list).toHaveBeenCalledWith({ limit: 1000 });
      expect(logger.info).toHaveBeenCalledWith(
        `Found conversation C2 for phone number ${phoneNumber}`,
      );
      expect(result).toBe(mockConversations[1]);
    });

    it('should return null if no conversation matches the phone number', async () => {
      client.conversations.v1.conversations.list.mockResolvedValue(mockConversations);

      const result = await conversationsModule.getConversationByPhoneNumber('+9999999999');

      expect(client.conversations.v1.conversations.list).toHaveBeenCalledWith({ limit: 1000 });
      expect(logger.info).toHaveBeenCalledWith('No conversation found for phone number +9999999999');
      expect(result).toBeNull();
    });

    it('should log and throw an error if listing conversations fails', async () => {
      const mockError = new Error('List conversations failed');
      client.conversations.v1.conversations.list.mockRejectedValue(mockError);

      await expect(conversationsModule.getConversationByPhoneNumber(phoneNumber)).rejects.toThrow('List conversations failed');

      expect(client.conversations.v1.conversations.list).toHaveBeenCalledWith({ limit: 1000 });
      expect(logger.error).toHaveBeenCalledWith('Error fetching conversation by phone number', {
        phoneNumber,
        error: mockError,
      });
    });
    it('should return null when no conversations exist', async () => {
      const phoneNumber = '+4444444444';
      client.conversations.v1.conversations.list.mockResolvedValue([]);

      const result = await conversationsModule.getConversationByPhoneNumber(phoneNumber);

      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalledWith('No conversation found for phone number +4444444444');
    });
  });

  describe('listConversations', () => {
    it('should list conversations with details', async () => {
      const mockConversations = [
        { sid: 'C1', friendlyName: 'Conv1', attributes: '{}' },
        { sid: 'C2', friendlyName: 'Conv2', attributes: '{"phoneNumber":"+1234567890"}' },
      ];
      const mockMessages = [
        { body: 'Hello', dateCreated: new Date(), author: '+9876543210' },
      ];
      client.conversations.v1.conversations.list.mockResolvedValue(mockConversations);
      client.conversations.v1.conversations().messages.list.mockResolvedValue(mockMessages);

      const result = await conversationsModule.listConversations();

      expect(client.conversations.v1.conversations.list).toHaveBeenCalled();
      expect(client.conversations.v1.conversations().messages.list).toHaveBeenCalledTimes(4); // 2 calls per conversation
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('lastMessage', 'Hello');
      expect(result[0]).toHaveProperty('unreadCount', 1);
      expect(logger.info).toHaveBeenCalledWith('Fetched 2 conversations');
    });

    it('should handle errors when listing conversations', async () => {
      const mockError = new Error('Listing failed');
      client.conversations.v1.conversations.list.mockRejectedValue(mockError);

      await expect(conversationsModule.listConversations()).rejects.toThrow('Listing failed');
      expect(logger.error).toHaveBeenCalledWith('Error listing conversations', { error: mockError });
    });
  });

  describe('markMessagesAsRead', () => {
    const conversationSid = 'C1234567890';
    let mockUpdate;
    let mockList;

    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();

      // Mock the update function for messages
      mockUpdate = jest.fn().mockResolvedValue({});

      // Mock the list function to return sample messages
      mockList = jest.fn().mockResolvedValue([
        { sid: 'M1', author: '+1234567890', attributes: '{}' },
        { sid: 'M2', author: process.env.TWILIO_PHONE_NUMBER, attributes: '{}' },
        { sid: 'M3', author: '+1234567890', attributes: '{"read":true}' },
      ]);

      // Mock the messages function that returns an object with list and messages methods
      const messagesMock = {
        list: mockList,
        messages: jest.fn().mockImplementation((messageSid) => ({
          update: mockUpdate,
        })),
      };

      // Mock the conversations method to return an object with messages
      const conversationsMock = {
        messages: messagesMock,
      };

      // Mock the conversations method in the Twilio client
      client.conversations.v1.conversations = jest.fn().mockReturnValue(conversationsMock);
    });
    
    it('should handle errors when marking messages as read', async () => {
      const mockError = new Error('Update failed');

      // Redefine the conversations method to make list throw an error
      client.conversations.v1.conversations.mockImplementation(() => ({
        messages: {
          list: jest.fn().mockRejectedValue(mockError),
          messages: jest.fn().mockImplementation((messageSid) => ({
            update: jest.fn(),
          })),
        },
      }));

      await expect(conversationsModule.markMessagesAsRead(conversationSid)).rejects.toThrow('Update failed');
      expect(logger.error).toHaveBeenCalledWith('Error marking messages as read', { conversationSid, error: mockError });
    });

    it('should not update messages that are already read', async () => {
      mockList.mockResolvedValue([
        { sid: 'M1', author: '+1234567890', attributes: '{"read":true}' },
        { sid: 'M2', author: '+1234567890', attributes: '{"read":true}' },
      ]);

      await conversationsModule.markMessagesAsRead(conversationSid);

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'All unread messages marked as read in conversation C1234567890'
      );
    });
  });

  describe('addParticipant', () => {
    const conversationSid = 'C1234567890';
    const phoneNumber = '+1234567890';

    it('should add a participant to the conversation', async () => {
      const mockParticipant = { sid: 'PA1' };
      const mockCreate = jest.fn().mockResolvedValue(mockParticipant);
      
      client.conversations.v1.conversations = jest.fn().mockReturnValue({
        participants: {
          create: mockCreate,
        },
      });

      const result = await conversationsModule.addParticipant(conversationSid, phoneNumber);

      expect(mockCreate).toHaveBeenCalledWith({
        'messagingBinding.address': phoneNumber,
        'messagingBinding.proxyAddress': process.env.TWILIO_PHONE_NUMBER,
        'messagingBinding.type': 'sms',
      });
      expect(result).toBe(mockParticipant);
      expect(logger.info).toHaveBeenCalledWith(`Added participant ${phoneNumber} to conversation ${conversationSid}`);
    });

    it('should handle errors when adding a participant', async () => {
      const mockError = new Error('Add participant failed');
      const mockCreate = jest.fn().mockRejectedValue(mockError);
      
      client.conversations.v1.conversations = jest.fn().mockReturnValue({
        participants: {
          create: mockCreate,
        },
      });

      await expect(conversationsModule.addParticipant(conversationSid, phoneNumber)).rejects.toThrow('Add participant failed');
      expect(logger.error).toHaveBeenCalledWith('Error adding participant to conversation', {
        conversationSid,
        phoneNumber,
        error: mockError,
      });
    });
  });
});