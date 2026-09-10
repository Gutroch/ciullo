const crypto = require('crypto');
const logger = require('../utils/logger');

function requestId(req, res, next) {
  req.id = req.get('X-Request-Id') || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.code === 'EBADCSRFTOKEN' || err.message === 'invalid csrf token' ? 403 : (err.status || 500);
  logger.error({ err, requestId: req.id, method: req.method, path: req.originalUrl }, 'request failed');

  res.status(status).render('error', {
    user: req.session?.user || null,
    message: status === 403 ? 'Richiesta rifiutata: token CSRF mancante o scaduto.' : 'Si è verificato un errore interno del server.',
    requestId: req.id
  });
}

module.exports = { requestId, errorHandler };
