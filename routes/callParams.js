// routes/callParams.js

const express = require('express');
const router = express.Router();
const { param, validationResult } = require('express-validator');
const logger = require('../modules/logger');
const conversations = require('../modules/conversations');

// Define HTTP status code constants
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const TWILIO_ERROR_NOT_FOUND = 20404;

/**
 * GET /call-params/:sid
 * Retrieves call parameters (From and To numbers) for a given conversation SID.
 */
router.get(
  '/:sid',
  [
    param('sid')
      .isString()
      .withMessage('Conversation SID must be a string')
      .notEmpty()
      .withMessage('Conversation SID cannot be empty'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors on fetching call parameters', {
        errors: errors.array(),
      });
      return res.status(HTTP_STATUS_BAD_REQUEST).json({ errors: errors.array() });
    }

    const { sid } = req.params;

    try {
      const conversation = await conversations.fetchConversation(sid);
      const attributes = JSON.parse(conversation.attributes || '{}');
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      const toNumber = attributes.phoneNumber;

      if (!toNumber) {
        logger.warn('No phone number associated with conversation', { sid });
        return res.status(HTTP_STATUS_BAD_REQUEST).json({
          error: 'No phone number associated with this conversation.',
        });
      }

      res.json({ From: fromNumber, To: toNumber });
    } catch (error) {
      logger.error('Error fetching call parameters', { sid, error });
      if (error.code === TWILIO_ERROR_NOT_FOUND) {
        res.status(HTTP_STATUS_NOT_FOUND).json({ error: `Conversation ${sid} not found.` });
      } else {
        next(error);
      }
    }
  },
);

module.exports = router;