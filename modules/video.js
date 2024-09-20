const client = require('../twilioClient'); // Assuming this is where Twilio client is configured

// Function to create a video room
async function createVideoRoom() {
    try {
      const room = await client.video.v1.rooms.create({ uniqueName: `VideoRoom_${Date.now()}` });
      return {
        sid: room.sid,
        name: room.uniqueName
      };
    } catch (error) {
      console.error('Error creating Twilio video room:', error);
      throw error;
    }
  }
  
  async function sendRoomLinkToCustomer(roomName, customerPhoneNumber, ngrokUrl) {
    try {
      const roomLink = `${ngrokUrl}/video-room/${roomName}`;
      await client.messages.create({
        body: `Join the video call here: ${roomLink}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: customerPhoneNumber,
      });
      return roomLink;
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

module.exports = {
  createVideoRoom,
  sendRoomLinkToCustomer,
};