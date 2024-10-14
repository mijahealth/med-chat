// __mocks__/video.js

const mockVideo = {
    createVideoRoom: jest.fn().mockResolvedValue({ sid: 'RM123', uniqueName: 'VideoRoom_123' })
  };
  
  module.exports = mockVideo;