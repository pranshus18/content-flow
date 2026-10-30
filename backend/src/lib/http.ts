import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function httpError(status: number, message: string) {
  return new HttpError(status, message);
}

export function errorMessage(error: unknown, fallback = 'An unexpected error occurred') {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
