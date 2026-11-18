import { ErrorRequestHandler, RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: 'Invalid JSON request body' });
    return;
  }

  console.error('Unhandled backend error:', error instanceof Error ? error.message : error);
  res.status(500).json({ error: 'Internal server error' });
};
