import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/http.js';
import { logger } from '../lib/logger.js';

function errorText(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return 'An unexpected error occurred';
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as Request & { requestId?: string }).requestId;
  const message = errorText(err) || 'An unexpected error occurred';
  const stack = err instanceof Error ? err.stack : undefined;

  logger.error('error', message, { requestId, stack });

  if (res.headersSent) return;

  const status = err instanceof HttpError
    ? err.status
    : typeof err === 'object' && err && 'status' in err && typeof (err as { status: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 500;

  res.status(status).json({
    success: false,
    error: message,
    requestId,
  });
}
