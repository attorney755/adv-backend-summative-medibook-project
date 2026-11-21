'use strict';

/**
 * Central error-handling middleware.
 * Catches anything passed to next(err) and returns a consistent JSON shape.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[ErrorHandler]', err);

  const status  = err.status  || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    status:  'error',
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
