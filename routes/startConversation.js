// routes/startConversation.js

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const logger = require('../modules/logger');
const conversations = require('../modules/conversations');
const smsServiceFactory = require('../modules/smsService');
const broadcastModule = require('../modules/broadcast');

// Remove the top-level initialization of smsService and sendSMS
// const smsService = smsServiceFactory(broadcastModule.getBroadcast());
// const { sendSMS } = smsService;

// Helper function to log latest message
async function logLatestMessage(conversationSid, context) {
  try {
    const messages = await conversations.listMessages(conversationSid, {
      limit: 1,
      order: 'desc',
    });
    if (messages.length > 0) {
      const [latestMessage] = messages;
      logger.info(`Latest message ${context}`, {
        conversationSid,
        messageSid: latestMessage.sid,
        author: latestMessage.author,
        body: latestMessage.body,
        dateCreated: latestMessage.dateCreated,
      });
    } else {
      logger.info(`No messages found ${context}`, { conversationSid });
    }
  } catch (error) {
    logger.error(`Error fetching latest message ${context}`, {
      conversationSid,
      error: error.message,
    });
  }
}

const HTTP_BAD_REQUEST = 400;

router.post(
  '/',
  [
    body('phoneNumber')
      .matches(/^\+\d{10,15}$/)
      .withMessage('Invalid phone number format'),
    body('message')
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage('Message content cannot be empty'),
    body('name').optional().isString().trim(),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('dob').optional().isISO8601().withMessage('Invalid date format'),
    body('state').optional().isString().trim().withMessage('Invalid state'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors on starting conversation', {
        errors: errors.array(),
      });
      return res.status(HTTP_BAD_REQUEST).json({ errors: errors.array() });
    }

    try {
      const { phoneNumber, message, name, email, dob, state } = req.body;

      logger.info('Starting new conversation', {
        phoneNumber,
        name,
        email,
        dob,
        state,
      });

      const attributes = { email, name, phoneNumber, dob, state };
      const friendlyName = name || `Conversation with ${phoneNumber}`;

      const conversation = await conversations.createConversation(
        friendlyName,
        attributes
      );
      logger.info('New conversation created', {
        sid: conversation.sid,
        friendlyName,
      });

      // Log latest message after conversation creation
      await logLatestMessage(conversation.sid, 'After conversation creation');

      await conversations.addParticipant(conversation.sid, phoneNumber);
      logger.info('Participant added to new conversation', {
        sid: conversation.sid,
        phoneNumber,
      });

      // Log latest message after adding participant
      await logLatestMessage(conversation.sid, 'After adding participant');

      // Initialize smsService and sendSMS here
      const smsService = smsServiceFactory(broadcastModule.getBroadcast());
      const { sendSMS } = smsService;

      const disclaimer =
        '(Note: you may reply STOP to no longer receive messages from us. ' +
        'Msg&Data Rates may apply.)';
      const firstMessage = `${message} ${disclaimer}`;

      logger.info('Sending first SMS for new conversation', {
        sid: conversation.sid,
        phoneNumber,
        message: firstMessage,
      });
      const smsResult = await sendSMS(
        phoneNumber,
        firstMessage,
        conversation.sid,
        process.env.TWILIO_PHONE_NUMBER
      );
      logger.info('First SMS sent for new conversation', {
        sid: conversation.sid,
        phoneNumber,
        messageSid: smsResult.messageSid,
      });

      // Log latest message after sending SMS
      await logLatestMessage(conversation.sid, 'After sending SMS');

      res.json({ sid: conversation.sid, existing: false });

      // Log latest message after sending response
      await logLatestMessage(conversation.sid, 'After sending response');
    } catch (error) {
      logger.error('Error in start conversation route', {
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }
);

module.exports = router;