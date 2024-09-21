// modules/video.js
const { sendSMS } = require('./smsService'); // Import the SMS service
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

// Refactored function to send room link to customer using sendSMS
async function sendRoomLinkToCustomer(roomName, customerPhoneNumber, ngrokUrl, conversationSid) {
   try {
     const roomLink = `${ngrokUrl}/video-room/${roomName}`;
     
     // Use the centralized sendSMS function
     await sendSMS(customerPhoneNumber, `Join the video call here: ${roomLink}`, conversationSid, process.env.TWILIO_PHONE_NUMBER);
     
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