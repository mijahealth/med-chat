const { createVideoRoom } = require('../modules/video');
const logger = require('../modules/logger');

// Mock the entire twilioClient module
jest.mock('../twilioClient', () => ({
  video: {
    v1: {
      rooms: {
        create: jest.fn(),
      },
    },
  },
}));

jest.mock('../modules/logger');

describe('Video Module', () => {
  describe('createVideoRoom', () => {
    let mockTwilioClient;

    beforeEach(() => {
      // Clear all mocks before each test
      jest.clearAllMocks();
      // Get the mocked twilioClient
      mockTwilioClient = require('../twilioClient');
    });

    it('should create a video room successfully', async () => {
      const mockRoom = {
        sid: 'RM123',
        uniqueName: 'VideoRoom_123456789',
      };

      mockTwilioClient.video.v1.rooms.create.mockResolvedValue(mockRoom);

      const result = await createVideoRoom();

      expect(mockTwilioClient.video.v1.rooms.create).toHaveBeenCalledWith({
        uniqueName: expect.stringMatching(/^VideoRoom_\d+$/),
      });
      expect(logger.info).toHaveBeenCalledWith('Video room created', { roomSid: mockRoom.sid });
      expect(result).toEqual({ sid: mockRoom.sid, name: mockRoom.uniqueName });
    });

    it('should throw an error when room creation fails', async () => {
      const mockError = new Error('Room creation failed');

      mockTwilioClient.video.v1.rooms.create.mockRejectedValue(mockError);

      await expect(createVideoRoom()).rejects.toThrow('Room creation failed');
      expect(logger.error).toHaveBeenCalledWith('Error creating video room', { error: mockError });
    });
  });
});