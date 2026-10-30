import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { assertContentAccess } from '../lib/content-access.js';
import { fetchAnalytics } from '../services/fetch-analytics.js';

export const fetchAnalyticsRouter = Router();

fetchAnalyticsRouter.post('/', asyncHandler(async (req: AuthedRequest, res) => {
  const contentId = await assertContentAccess(req.user!.id, req.body?.contentId);
  const result = await fetchAnalytics(contentId);
  res.json(result);
}));
