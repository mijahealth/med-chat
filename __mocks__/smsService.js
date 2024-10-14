const jest = require('jest-mock');

module.exports = {
  sendSMS: jest.fn(() =>
    Promise.resolve({ messageSid: 'SM123', success: true })
  ),
};