import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { assertContentAccess } from '../lib/content-access.js';
import { enhanceMedia } from '../services/enhance-media.js';

export const enhanceMediaRouter = Router();

enhanceMediaRouter.post('/', asyncHandler(async (req: AuthedRequest, res) => {
  req.setTimeout(15 * 60 * 1000);
  res.setTimeout(15 * 60 * 1000);
  const contentId = await assertContentAccess(req.user!.id, req.body?.contentId);
  const mediaType = req.body?.mediaType === 'video' || req.body?.mediaType === 'image'
    ? req.body.mediaType
    : undefined;
  const videoResolution = req.body?.videoResolution === 'FHD'
    || req.body?.videoResolution === '2k'
    || req.body?.videoResolution === '4k'
    ? req.body.videoResolution
    : undefined;

  const result = await enhanceMedia({
    mediaUrl: typeof req.body?.mediaUrl === 'string' ? req.body.mediaUrl : undefined,
    imageUrl: typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : undefined,
    mediaType,
    contentId,
    predictionId: typeof req.body?.predictionId === 'string' ? req.body.predictionId : undefined,
    scale: typeof req.body?.scale === 'number' ? req.body.scale : undefined,
    faceEnhance: typeof req.body?.faceEnhance === 'boolean' ? req.body.faceEnhance : undefined,
    videoResolution,
  });
  const { httpStatus, ...body } = result;
  res.status(httpStatus || 200).json(body);
}));
