import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { assertContentAccess } from '../lib/content-access.js';
import { publishContentToSocial } from '../services/publish-social.js';

export const publishSocialRouter = Router();

publishSocialRouter.post('/', asyncHandler(async (req: AuthedRequest, res) => {
  const contentId = await assertContentAccess(req.user!.id, req.body?.contentId);
  const result = await publishContentToSocial({
    contentId,
    platform: typeof req.body?.platform === 'string' ? req.body.platform : undefined,
  });
  res.json(result);
}));
