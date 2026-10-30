import type { NextFunction, Request, Response } from 'express';
import { env } from '../lib/env.js';
import { getAnonClient } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { requireAdmin } from '../lib/roles.js';

export type AuthedUser = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

export type AuthedRequest = Request & {
  user?: AuthedUser;
  requestId?: string;
};

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

function cronSecretFrom(req: Request): string | null {
  const token = bearerToken(req);
  const header = req.headers['x-cron-secret'];
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (env.cronSecret && (token === env.cronSecret || headerValue === env.cronSecret)) {
    return env.cronSecret;
  }
  return null;
}

async function attachUserFromJwt(req: AuthedRequest, token: string) {
  const { data, error } = await getAnonClient().auth.getUser(token);
  if (error || !data.user) {
    logger.warn('auth', 'JWT rejected', { requestId: req.requestId, message: error?.message });
    return false;
  }

  const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
  req.user = {
    id: data.user.id,
    email: data.user.email,
    firstName: typeof meta.first_name === 'string' ? meta.first_name : undefined,
    lastName: typeof meta.last_name === 'string' ? meta.last_name : undefined,
    phone: typeof meta.phone === 'string' ? meta.phone : undefined,
  };
  return true;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, error: 'Missing authorization token. Sign in and try again.' });
    }

    if (env.cronSecret && token === env.cronSecret) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token. Please sign in again.' });
    }

    const ok = await attachUserFromJwt(req, token);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token. Please sign in again.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireCronOrAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (cronSecretFrom(req)) {
      req.user = { id: 'cron' };
      return next();
    }

    return requireAuth(req, res, next);
  } catch (error) {
    next(error);
  }
}

export async function requireAdminUser(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Missing authorization token. Sign in and try again.' });
    }
    await requireAdmin(req.user.id);
    next();
  } catch (error) {
    next(error);
  }
}
