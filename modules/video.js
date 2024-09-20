const client = require('../twilioClient'); // Assuming this is where Twilio client is configured

// Function to create a video room
async function createVideoRoom() {
    try {
      const room = await client.video.v1.rooms.create({ uniqueName: 'VideoRoom_' + Date.now() });
      return room;
    } catch (error) {
      console.error('Error creating Twilio video room:', error);
      throw error;
    }
  }
  
  module.exports = {
    createVideoRoom,
    sendRoomLinkToCustomer,
  };

// Function to send SMS with the room link
async function sendRoomLinkToCustomer(roomName, customerPhoneNumber, ngrokUrl) {
  try {
    const roomLink = `${ngrokUrl}/video-room/${roomName}`;

    // Send SMS to the customer with the link to join the video room
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