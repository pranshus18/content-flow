import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger.js';

export type RequestWithId = Request & { requestId: string };

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string | undefined) || randomUUID();
  (req as RequestWithId).requestId = id;
  res.setHeader('x-request-id', id);

  const started = Date.now();
  res.on('finish', () => {
    if (req.originalUrl === '/health') return;
    logger.info(
      'http',
      `${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started}ms)`,
      { requestId: id },
    );
  });

  next();
}
