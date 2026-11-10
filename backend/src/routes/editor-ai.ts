import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { autoAssembleTimeline } from '../services/editor-ai.js';

export const editorAiRouter = Router();

editorAiRouter.post('/auto-assemble', asyncHandler(async (req: AuthedRequest, res) => {
  const clips = Array.isArray(req.body?.clips) ? req.body.clips : [];
  const assembled = autoAssembleTimeline(clips);
  res.json({ success: true, ...assembled });
}));
