// twilioClient.js

require('dotenv').config();
const twilio = require('twilio');
const logger = require('./modules/logger');

// Initialize Twilio Client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

// Log initialization success
logger.info('Twilio client initialized');

// Export the client for use in other modules
module.exports = client;
