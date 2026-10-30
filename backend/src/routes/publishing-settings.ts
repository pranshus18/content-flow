import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { getPublishingSettings, updatePublishingSettings } from '../services/app-api.js';

export const publishingSettingsRouter = Router();

publishingSettingsRouter.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  res.json(await getPublishingSettings(req.user!.id));
}));

publishingSettingsRouter.put('/', asyncHandler(async (req: AuthedRequest, res) => {
  res.json(await updatePublishingSettings(req.user!.id, req.body || {}));
}));
