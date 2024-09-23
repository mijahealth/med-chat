/* eslint-env node */

// routes/callParams.js
const express = require('express');
const router = express.Router();
const { param, validationResult } = require('express-validator');
const logger = require('../modules/logger');
const conversations = require('../modules/conversations');

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
      logger.warn('Validation errors on fetching call parameters', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { sid } = req.params;

    try {
      const conversation = await conversations.fetchConversation(sid);
      const attributes = JSON.parse(conversation.attributes || '{}');
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      const toNumber = attributes.phoneNumber;

      if (!toNumber) {
        logger.warn('No phone number associated with conversation', { sid });
        return res.status(400).json({ error: 'No phone number associated with this conversation.' });
      }

      res.json({ From: fromNumber, To: toNumber });
    } catch (error) {
      logger.error('Error fetching call parameters', { sid, error });
      if (error.code === 20404) {
        res.status(404).json({ error: `Conversation ${sid} not found.` });
      } else {
        next(error);
      }
    }
  }
);

module.exports = router;