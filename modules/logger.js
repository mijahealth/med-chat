// modules/logger.js
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info', // Adjust log level as needed (e.g., 'debug', 'error')
  format: format.combine(
    format.timestamp(),
    format.printf(
      ({ timestamp, level, message, ...meta }) =>
        `${timestamp} [${level.toUpperCase()}]: ${message} ${
          Object.keys(meta).length ? JSON.stringify(meta) : ''
        }`,
    ),
  ),
  transports: [
    new transports.Console(),
    // You can add file transports or other transports as needed
  ],
});

module.exports = logger;
