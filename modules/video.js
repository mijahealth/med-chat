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

// Function to send room link to customer via SMS
async function sendRoomLinkToCustomer(roomName, customerPhoneNumber, ngrokUrl, conversationSid, sendSMS) {
  try {
    const roomLink = `${ngrokUrl}/video-room/${roomName}`;
    await sendSMS(
      customerPhoneNumber,
      `Join the video call here: ${roomLink}`,
      conversationSid,
      process.env.TWILIO_PHONE_NUMBER
    );
    logger.info('Video room link sent via SMS', { customerPhoneNumber, roomLink, conversationSid });
    return roomLink;
  } catch (error) {
    logger.error('Error sending video room link via SMS', { error });
    throw error;
  }
}

module.exports = {
  createVideoRoom,
  sendRoomLinkToCustomer,
};