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

function statusFromError(err: unknown): number {
  if (err instanceof HttpError) return err.status;
  if (typeof err === 'object' && err && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
    const status = (err as { status: number }).status;
    if (status >= 400 && status < 600) return status;
  }
  const message = errorText(err).toLowerCase();
  if (message.includes('fetch failed') || message.includes('econnreset') || message.includes('etimedout')) {
    return 503;
  }
  return 500;
}

function publicMessage(status: number, raw: string) {
  if (status === 503) {
    return 'Database or auth service is temporarily unavailable. Wait a few seconds and try again.';
  }
  if (status === 504 || status === 502) {
    return 'The API timed out (often Render waking up). Wait about a minute and refresh.';
  }
  if (status >= 500 && raw.length > 200) {
    return 'Something went wrong on the server. Try again; if it persists, check Render logs.';
  }
  return raw;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as Request & { requestId?: string }).requestId;
  const rawMessage = errorText(err) || 'An unexpected error occurred';
  const stack = err instanceof Error ? err.stack : undefined;

  logger.error('error', rawMessage, { requestId, stack });

  if (res.headersSent) return;

  const status = statusFromError(err);
  const message = publicMessage(status, rawMessage);

  res.status(status).json({
    success: false,
    error: message,
    requestId,
  });
}
