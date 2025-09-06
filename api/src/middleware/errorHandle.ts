import type { RequestHandler, ErrorRequestHandler } from 'express';

export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error('unhandled error', {
    path: req.path,
    method: req.method,
    err,
  });

  if (res.headersSent) return next(err);
};
