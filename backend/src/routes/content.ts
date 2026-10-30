import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { assertContentAccess } from '../lib/content-access.js';
import { createContent, deleteContent, listContent, updateContent } from '../services/app-api.js';
import { buildPostPackage, streamContentMedia } from '../services/post-package.js';

export const contentRouter = Router();

contentRouter.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  const userId = req.query.user_id ? String(req.query.user_id) : undefined;
  const rows = await listContent(req.user!.id, userId);
  res.json(rows);
}));

contentRouter.get('/:id/post-package', asyncHandler(async (req: AuthedRequest, res) => {
  const id = await assertContentAccess(req.user!.id, req.params.id);
  const pkg = await buildPostPackage(id);
  res.json(pkg);
}));

contentRouter.post('/:id/post-package', asyncHandler(async (req: AuthedRequest, res) => {
  const id = await assertContentAccess(req.user!.id, req.params.id);
  const pkg = await buildPostPackage(id, {
    caption: typeof req.body?.caption === 'string' ? req.body.caption : undefined,
    platform: typeof req.body?.platform === 'string' ? req.body.platform : undefined,
  });
  res.json(pkg);
}));

contentRouter.get('/:id/download', asyncHandler(async (req: AuthedRequest, res) => {
  const id = await assertContentAccess(req.user!.id, req.params.id);
  req.setTimeout(10 * 60 * 1000);
  res.setTimeout(10 * 60 * 1000);
  await streamContentMedia(id, res);
}));

contentRouter.post('/', asyncHandler(async (req: AuthedRequest, res) => {
  const row = await createContent(req.user!.id, req.body || {});
  res.json(row);
}));

contentRouter.patch('/:id', asyncHandler(async (req: AuthedRequest, res) => {
  const row = await updateContent(req.user!.id, req.params.id, req.body || {});
  res.json(row);
}));

contentRouter.delete('/:id', asyncHandler(async (req: AuthedRequest, res) => {
  await deleteContent(req.user!.id, req.params.id);
  res.json({ success: true });
}));
