import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { getBranding, upsertBranding } from '../services/app-api.js';

export const brandingRouter = Router();

brandingRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(await getBranding());
}));

brandingRouter.put('/', asyncHandler(async (req: AuthedRequest, res) => {
  res.json(await upsertBranding(req.user!.id, req.body || {}));
}));
