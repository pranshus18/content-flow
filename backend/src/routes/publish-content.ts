import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { publishContent } from '../services/publish-content.js';

export const publishContentRouter = Router();

publishContentRouter.post('/', asyncHandler(async (req: AuthedRequest, res) => {
  const result = await publishContent(req.body || {}, req.user);
  res.json(result);
}));
