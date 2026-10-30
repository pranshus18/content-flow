import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { assertContentAccess } from '../lib/content-access.js';
import { preprocessMedia } from '../services/preprocess-media.js';

export const preprocessMediaRouter = Router();

preprocessMediaRouter.post('/', asyncHandler(async (req: AuthedRequest, res) => {
  const contentId = await assertContentAccess(req.user!.id, req.body?.contentId);
  const result = await preprocessMedia({
    mediaUrl: typeof req.body?.mediaUrl === 'string' ? req.body.mediaUrl : undefined,
    contentId,
    mediaType: typeof req.body?.mediaType === 'string' ? req.body.mediaType : undefined,
    platform: typeof req.body?.platform === 'string' ? req.body.platform : undefined,
  });
  if (result.preprocessingStatus === 'failed') {
    res.status(500).json(result);
    return;
  }
  res.json(result);
}));
