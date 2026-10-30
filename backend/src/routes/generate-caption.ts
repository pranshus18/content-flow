import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { generateCaption } from '../services/generate-caption.js';

export const generateCaptionRouter = Router();

generateCaptionRouter.post('/', asyncHandler(async (req, res) => {
  const result = await generateCaption({
    userDescription: typeof req.body?.userDescription === 'string' ? req.body.userDescription : undefined,
    title: typeof req.body?.title === 'string' ? req.body.title : undefined,
    platform: typeof req.body?.platform === 'string' ? req.body.platform : undefined,
    mediaType: typeof req.body?.mediaType === 'string' ? req.body.mediaType : undefined,
  });
  res.status(result.success ? 200 : 500).json(result);
}));
