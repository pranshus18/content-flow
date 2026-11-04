import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { deleteAdminAssetRecord } from '../services/admin-assets.js';

export const adminAssetsRouter = Router();

adminAssetsRouter.delete('/:id', asyncHandler(async (req: AuthedRequest, res) => {
  const result = await deleteAdminAssetRecord(String(req.params.id || ''));
  res.json({ success: true, ...result });
}));
