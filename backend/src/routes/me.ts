import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { getUserRole, syncUserRole } from '../lib/roles.js';

function readProfileField(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

export const meRouter = Router();

meRouter.get('/role', asyncHandler(async (req: AuthedRequest, res) => {
  const role = await getUserRole(req.user!.id);
  res.json({ role, isAdmin: role === 'admin' });
}));

meRouter.post('/sync-role', asyncHandler(async (req: AuthedRequest, res) => {
  const result = await syncUserRole(req.user!.id, req.user!.email, {
    firstName: readProfileField(req.body?.first_name) || req.user?.firstName,
    lastName: readProfileField(req.body?.last_name) || req.user?.lastName,
    phone: readProfileField(req.body?.phone) || req.user?.phone || null,
  });
  res.json(result);
}));
