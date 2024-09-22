// utils/validation.js
const { body, param } = require('express-validator');

// Define reusable validation chains

const validatePhoneNumber = body('phoneNumber')
  .matches(/^\+\d{10,15}$/)
  .withMessage('Invalid phone number format');

const validateMessage = body('message')
  .isString()
  .trim()
  .isLength({ min: 1 })
  .withMessage('Message content cannot be empty');

const validateName = body('name').optional().isString().trim().withMessage('Invalid name');

const validateEmail = body('email')
  .optional()
  .isEmail()
  .withMessage('Invalid email format');

const validateDOB = body('dob')
  .optional()
  .isISO8601()
  .withMessage('Invalid date of birth format');

const validateState = body('state')
  .optional()
  .isString()
  .trim()
  .withMessage('Invalid state');

module.exports = {
  validatePhoneNumber,
  validateMessage,
  validateName,
  validateEmail,
  validateDOB,
  validateState,
};