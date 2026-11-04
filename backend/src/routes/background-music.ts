import { createReadStream, existsSync } from 'node:fs';
import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { httpError } from '../lib/http.js';
import { getServiceClient } from '../lib/supabase.js';
import {
  bundledMusicPreviewPath,
  getBackgroundMusicTrack,
  getBundledMusicAbsolutePath,
  isAdminAssetMusicTrackId,
  loadBackgroundMusicCatalog,
  parseAdminAssetMusicId,
  resolveBackgroundMusicPreviewUrl,
} from '../lib/music-catalog.js';

export const backgroundMusicRouter = Router();

backgroundMusicRouter.get('/tracks', asyncHandler(async (_req: AuthedRequest, res) => {
  res.json({ tracks: loadBackgroundMusicCatalog() });
}));

backgroundMusicRouter.get('/preview-url/:trackId', asyncHandler(async (req: AuthedRequest, res) => {
  const trackId = String(req.params.trackId || '').trim();

  if (isAdminAssetMusicTrackId(trackId)) {
    const assetId = parseAdminAssetMusicId(trackId);
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('admin_assets')
      .select('file_url, name')
      .eq('id', assetId)
      .maybeSingle();
    if (error || !data?.file_url) {
      throw httpError(404, 'Custom music file not found');
    }
    res.json({
      url: data.file_url,
      title: data.name,
      library: 'Your upload',
      bundled: false,
      custom: true,
    });
    return;
  }

  const track = getBackgroundMusicTrack(trackId);
  if (!track) {
    throw httpError(404, `Unknown background music track: ${trackId}`);
  }

  const bundled = getBundledMusicAbsolutePath(track);
  if (bundled && existsSync(bundled)) {
    const relative = bundledMusicPreviewPath(track);
    res.json({
      url: relative,
      title: track.title,
      library: track.library,
      bundled: true,
    });
    return;
  }

  const url = resolveBackgroundMusicPreviewUrl(trackId);
  res.json({ url, title: track.title, library: track.library, bundled: false });
}));

backgroundMusicRouter.get('/stream/:trackId', asyncHandler(async (req: AuthedRequest, res) => {
  const trackId = String(req.params.trackId || '').trim();
  const track = getBackgroundMusicTrack(trackId);
  if (!track) {
    throw httpError(404, `Unknown background music track: ${trackId}`);
  }
  const filePath = getBundledMusicAbsolutePath(track);
  if (!filePath || !existsSync(filePath)) {
    throw httpError(404, `Track not on disk. Run npm run music:download — ${track.bundledFile || trackId}`);
  }
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  createReadStream(filePath).pipe(res);
}));
