// routes/startConversation.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const logger = require('../modules/logger');
const conversations = require('../modules/conversations');
const smsServiceFactory = require('../modules/smsService');

// Import WebSocket setup to get broadcast function
const setupWebSocket = require('../modules/websocket');
const http = require('http'); // Needed to create a dummy server if not available

// Assuming that the main app.js has already set up WebSocket and broadcast
// Here, we need to access the same broadcast function
// One approach is to pass the broadcast function to the routes via middleware or a shared module

// For simplicity, assuming that setupWebSocket is called once in app.js and broadcast is exported
// Alternative approach: Use an event emitter or a shared module to access broadcast

// Here, we'll modify setupWebSocket to export a singleton instance

// Note: Ensure that setupWebSocket is only initialized once in app.js and accessible here

// This requires a shared module to store the broadcast function
const broadcastModule = require('../modules/broadcast');

// Initialize SMS Service with broadcast
const smsService = smsServiceFactory(broadcastModule.broadcast);
const { sendSMS } = smsService;

// Validation Rules
const {
  validatePhoneNumber,
  validateMessage,
  validateName,
  validateEmail,
  validateDOB,
  validateState,
} = require('../utils/validation');

// POST /start-conversation
router.post(
  '/',
  [
    body('phoneNumber').matches(/^\+\d{10,15}$/).withMessage('Invalid phone number format'),
    body('message').isString().trim().isLength({ min: 1 }).withMessage('Message content cannot be empty'),
    body('name').optional().isString().trim(),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('dob').optional().isISO8601().withMessage('Invalid date format'),
    body('state').optional().isString().trim().withMessage('Invalid state'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors on starting conversation', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { phoneNumber, message, name, email, dob, state } = req.body;

      const isZapierRequest =
        req.headers['user-agent'] && req.headers['user-agent'].includes('Zapier');

      logger.info('Starting conversation', { phoneNumber, name, email, dob, state, isZapierRequest });

      const attributes = { email, name, phoneNumber, dob, state };

      let existingConversation = await conversations.getConversationByPhoneNumber(phoneNumber);

      if (existingConversation) {
        logger.info('Existing conversation found', { sid: existingConversation.sid });
        await conversations.updateConversationAttributes(existingConversation.sid, attributes);

        if (isZapierRequest) {
          await sendSMS(phoneNumber, message, existingConversation.sid, process.env.TWILIO_PHONE_NUMBER);
          logger.info('SMS sent to existing conversation via Zapier', { message });
        } else {
          // Broadcast update if not Zapier
          broadcastModule.broadcast({
            type: 'updateConversation',
            conversationSid: existingConversation.sid,
            friendlyName: name || `Conversation with ${phoneNumber}`,
            attributes,
          });
        }

        res.json({ sid: existingConversation.sid, existing: true });
      } else {
        const friendlyName = name || `Conversation with ${phoneNumber}`;
        const conversation = await conversations.createConversation(friendlyName, attributes);

        logger.info('New conversation created', { sid: conversation.sid, friendlyName });

        await conversations.addParticipant(conversation.sid, phoneNumber);

        const disclaimer = '(Note: you may reply STOP to no longer receive messages from us. Msg&Data Rates may apply.)';
        const firstMessage = `${message} ${disclaimer}`;
        await sendSMS(phoneNumber, firstMessage, conversation.sid, process.env.TWILIO_PHONE_NUMBER);

        res.json({ sid: conversation.sid, existing: false });
      }
    } catch (error) {
      logger.error('Error starting new conversation', { error });
      next(error);
    }
  }
);

module.exports = router;