// routes/conversations.js

const express = require('express');
const router = express.Router();
const { param, query, body, validationResult } = require('express-validator');
const logger = require('../modules/logger');
const conversations = require('../modules/conversations');
const { isMessageRead } = conversations; // Ensure this is correctly imported
const { getBroadcast } = require('../modules/broadcast');

const conversationSidValidation = [
  param('sid')
    .isString()
    .withMessage('Conversation SID must be a string')
    .matches(/^CH[0-9a-fA-F]{32}$/)
    .withMessage('Invalid Conversation SID format'),
];

// Define HTTP status code constants
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_OK = 200;
const TWILIO_ERROR_NOT_FOUND = 20404;

/**
 * @route   GET /conversations
 * @desc    List all conversations with their latest messages and unread counts
 * @access  Public (Adjust as needed for your application)
 */
router.get('/', async (req, res, next) => {
  try {
    logger.info('Fetching all conversations');
    const conversationList = await conversations.listConversations();

    const formattedConversations = conversationList.map((conv) => {
      const attributes = conv.attributes || {};
      return {
        sid: conv.sid,
        friendlyName: conv.friendlyName,
        phoneNumber: attributes.phoneNumber || '',
        email: attributes.email || '',
        name: attributes.name || '',
        lastMessage: conv.lastMessage || 'No messages yet',
        lastMessageTime: conv.lastMessageTime || null,
        // Implement logic to calculate unread messages if applicable
        unreadCount: conv.unreadCount || 0,
      };
    });

    res.json(formattedConversations);
  } catch (error) {
    logger.error('Error fetching all conversations', { error });
    next(error);
  }
});

/**
 * @route   GET /conversations/:sid
 * @desc    Fetch details of a specific conversation by SID
 * @access  Public
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
    // Validate Inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors on fetching conversation details', {
        errors: errors.array(),
      });
      return res.status(HTTP_STATUS_BAD_REQUEST).json({ errors: errors.array() });
    }

    const { sid } = req.params;

    try {
      logger.info(`Fetching conversation with SID: ${sid}`);
      const conversation = await conversations.fetchConversation(sid);
      if (!conversation) {
        logger.warn(`Conversation not found: ${sid}`);
        return res
          .status(HTTP_STATUS_NOT_FOUND)
          .json({ error: `Conversation ${sid} not found.` });
      }

      // Fetch the latest message
      const messages = await conversations.listMessages(sid, {
        limit: 1,
        order: 'desc',
      });
      const [lastMessage] = messages; // Updated to use array destructuring

      // Fetch all messages to calculate unread count
      const allMessages = await conversations.listMessages(sid, {
        limit: 1000,
        order: 'asc',
      });
      const unreadCount = allMessages.filter(
        (msg) =>
          msg.author !== process.env.TWILIO_PHONE_NUMBER && !isMessageRead(msg),
      ).length;

      logger.info(
        `Fetched ${allMessages.length} messages from conversation ${sid}`,
      );

      let attributes = {};
      try {
        attributes = JSON.parse(conversation.attributes || '{}');
      } catch (parseError) {
        logger.error('Error parsing conversation attributes', {
          sid,
          error: parseError,
        });
        // Decide how to handle this case. For now, proceed with empty attributes.
      }

      res.json({
        sid: conversation.sid,
        friendlyName: conversation.friendlyName,
        attributes,
        lastMessage: lastMessage ? lastMessage.body : 'No messages yet',
        lastMessageTime: lastMessage ? lastMessage.dateCreated : null,
        unreadCount,
      });
    } catch (error) {
      logger.error('Error fetching conversation details', { sid, error });
      if (error.code === TWILIO_ERROR_NOT_FOUND) {
        // Twilio Not Found Error Code
        res.status(HTTP_STATUS_NOT_FOUND).json({ error: `Conversation ${sid} not found.` });
      } else {
        next(error); // Pass to error handler
      }
    }
  },
);

/**
 * @route   GET /conversations/:sid/messages
 * @desc    List messages in a specific conversation
 * @access  Public (Adjust as needed for your application)
 */
router.get(
  '/:sid/messages',
  [
    param('sid')
      .isString()
      .withMessage('Conversation SID must be a string')
      .notEmpty()
      .withMessage('Conversation SID cannot be empty'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 }) // Set max limit to 1000
      .withMessage('Limit must be an integer between 1 and 1000'),
    query('order')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Order must be either "asc" or "desc"'),
  ],
  async (req, res, next) => {
    // Validate Inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors on listing messages', {
        errors: errors.array(),
      });
      return res.status(HTTP_STATUS_BAD_REQUEST).json({ errors: errors.array() });
    }

    const { sid } = req.params;
    const { limit = '1000', order = 'asc' } = req.query;
    const limitNumber = parseInt(limit, 10);

    try {
      logger.info(`Listing messages for conversation SID: ${sid}`, {
        limit: limitNumber,
        order,
      });
      const messages = await conversations.listMessages(sid, {
        limit: limitNumber,
        order,
      });

      const formattedMessages = messages.map((msg) => ({
        sid: msg.sid,
        body: msg.body,
        author: msg.author,
        dateCreated: msg.dateCreated,
      }));

      res.json(formattedMessages);
    } catch (error) {
      logger.error('Error listing messages', { sid, error });
      if (error.code === TWILIO_ERROR_NOT_FOUND) {
        // Twilio error code for Not Found
        res.status(HTTP_STATUS_NOT_FOUND).json({ error: `Conversation ${sid} not found.` });
      } else {
        next(error);
      }
    }
  },
);

/**
 * @route   POST /conversations/:sid/messages
 * @desc    Add a message to a specific conversation
 * @access  Public (Adjust as needed for your application)
 */
router.post(
  '/:sid/messages',
  [
    param('sid')
      .isString()
      .withMessage('Conversation SID must be a string')
      .notEmpty()
      .withMessage('Conversation SID cannot be empty'),
    body('message')
      .isString()
      .withMessage('Message must be a string')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Message cannot be empty'),
    body('author')
      .optional()
      .isString()
      .withMessage('Author must be a string')
      .trim(),
  ],
  async (req, res, next) => {
    // Validate Inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors on adding message', {
        errors: errors.array(),
      });
      return res.status(HTTP_STATUS_BAD_REQUEST).json({ errors: errors.array() });
    }

    const { sid } = req.params;
    const { message, author } = req.body;

    try {
      logger.info(`Adding message to conversation ${sid}`, { message, author });
      const newMessage = await conversations.addMessage(
        sid,
        message,
        author || process.env.TWILIO_PHONE_NUMBER,
      );

      // Optionally, broadcast the new message via WebSockets
      if (getBroadcast) {
        const broadcast = getBroadcast();
        if (broadcast) {
          broadcast({
            type: 'newMessage',
            conversationSid: sid,
            author: author || process.env.TWILIO_PHONE_NUMBER,
            body: message,
            dateCreated: newMessage.dateCreated,
          });
        }
      }

      res.status(HTTP_STATUS_CREATED).json(newMessage);
    } catch (error) {
      logger.error('Error adding message to conversation', {
        sid,
        message,
        author,
        error,
      });
      if (error.code === TWILIO_ERROR_NOT_FOUND) {
        // Twilio error code for Not Found
        res.status(HTTP_STATUS_NOT_FOUND).json({ error: `Conversation ${sid} not found.` });
      } else {
        next(error);
      }
    }
  },
);

/**
 * @route   DELETE /conversations/:sid
 * @desc    Delete a specific conversation by SID
 * @access  Public (Adjust as needed for your application)
 */
router.delete(
  '/:sid',
  [
    param('sid')
      .isString()
      .withMessage('Conversation SID must be a string')
      .notEmpty()
      .withMessage('Conversation SID cannot be empty'),
    body('confirmToken')
      .optional()
      .isString()
      .withMessage('Confirm token must be a string')
      .equals('CONFIRM_DELETE')
      .withMessage('Invalid confirm token'),
  ],
  async (req, res, next) => {
    // Validate Inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors on deleting conversation', {
        errors: errors.array(),
      });
      return res.status(HTTP_STATUS_BAD_REQUEST).json({ errors: errors.array() });
    }

    const { sid } = req.params;
    const { confirmToken } = req.body;

    // Optional: Require a confirmation token for deletion
    if (confirmToken !== 'CONFIRM_DELETE') {
      return res
        .status(HTTP_STATUS_BAD_REQUEST)
        .json({ error: 'Invalid or missing confirmation token.' });
    }

    try {
      logger.info(`Deleting conversation with SID: ${sid}`);
      await conversations.deleteConversation(sid);

      // Optionally, broadcast the deletion via WebSockets
      if (getBroadcast) {
        const broadcast = getBroadcast();
        if (broadcast) {
          broadcast({
            type: 'deleteConversation',
            conversationSid: sid,
          });
        }
      }

      res.json({ message: `Conversation ${sid} deleted successfully.` });
    } catch (error) {
      logger.error('Error deleting conversation', { sid, error });
      if (error.code === TWILIO_ERROR_NOT_FOUND) {
        // Twilio error code for Not Found
        res.status(HTTP_STATUS_NOT_FOUND).json({ error: `Conversation ${sid} not found.` });
      } else {
        next(error);
      }
    }
  },
);

/**
 * @route   POST /conversations/:sid/mark-read
 * @desc    Mark all messages in a conversation as read
 * @access  Public (Adjust as needed for your application)
 */
router.post(
  '/:sid/mark-read',
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
      return res.status(HTTP_STATUS_BAD_REQUEST).json({ errors: errors.array() });
    }

    try {
      const { sid } = req.params;
      await conversations.markMessagesAsRead(sid);
      res.status(HTTP_STATUS_OK).json({ message: 'Messages marked as read' });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;