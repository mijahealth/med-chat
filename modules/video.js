// modules/video.js
const client = require('../twilioClient');
const logger = require('./logger');

// Function to create a video room
async function createVideoRoom() {
  try {
    const room = await client.video.v1.rooms.create({ uniqueName: `VideoRoom_${Date.now()}` });
    logger.info('Video room created', { roomSid: room.sid });
    return { sid: room.sid, name: room.uniqueName };
  } catch (error) {
    logger.error('Error creating video room', { error });
    throw error;
  }
}

module.exports = {
  createVideoRoom,
};