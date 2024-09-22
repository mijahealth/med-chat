// modules/logger.js
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info', // Adjust log level as needed (e.g., 'debug', 'warn', 'error')
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta) : ''
      }`;
    })
  ),
  transports: [
    new transports.Console(),
    // Additional transports can be added here (e.g., File, HTTP)
  ],
});

module.exports = logger;