const pino = require('pino');

module.exports = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', 'password', 'passwordHash', 'token', 'SESSION_SECRET'],
    censor: '[REDACTED]'
  }
});
