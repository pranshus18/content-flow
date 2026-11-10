import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { assertContentAccess } from '../lib/content-access.js';
import { renderAndExportTimeline } from '../services/render-timeline.js';

export const renderTimelineRouter = Router();

function readExportMode(value: unknown): 'render_only' | 'new_draft' | 'replace' {
  if (value === 'new_draft' || value === 'replace' || value === 'render_only') return value;
  return 'render_only';
}

renderTimelineRouter.post('/', asyncHandler(async (req: AuthedRequest, res) => {
  req.setTimeout(10 * 60 * 1000);
  res.setTimeout(10 * 60 * 1000);

  const exportMode = readExportMode(req.body?.exportMode);
  let contentId: string | undefined;
  if (req.body?.contentId) {
    contentId = await assertContentAccess(req.user!.id, req.body.contentId);
  }
  if (exportMode === 'replace' && !contentId) {
    res.status(400).json({ success: false, error: 'contentId is required for replace export' });
    return;
  }

  const result = await renderAndExportTimeline({
    userId: req.user!.id,
    timeline: req.body?.timeline,
    exportMode,
    title: typeof req.body?.title === 'string' ? req.body.title : undefined,
    description: typeof req.body?.description === 'string' ? req.body.description : undefined,
    contentId,
  });

  res.json(result);
}));
