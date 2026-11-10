import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { assertContentAccess } from '../lib/content-access.js';
import { applyTemplateFrames } from '../services/apply-template-frames.js';

export const applyTemplateFramesRouter = Router();

function asOptionalString(value: unknown) {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

function asOptionalNumber(value: unknown) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function asOptionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

applyTemplateFramesRouter.post('/', asyncHandler(async (req: AuthedRequest, res) => {
  req.setTimeout(10 * 60 * 1000);
  res.setTimeout(10 * 60 * 1000);
  const contentId = await assertContentAccess(req.user!.id, req.body?.contentId);
  const brandingBody = req.body?.branding && typeof req.body.branding === 'object'
    ? req.body.branding as Record<string, unknown>
    : null;
  const result = await applyTemplateFrames({
    contentId,
    introFrameUrl: 'introFrameUrl' in (req.body ?? {}) ? asOptionalString(req.body.introFrameUrl) : undefined,
    outroFrameUrl: 'outroFrameUrl' in (req.body ?? {}) ? asOptionalString(req.body.outroFrameUrl) : undefined,
    introDuration: typeof req.body?.introDuration === 'number' ? req.body.introDuration : undefined,
    outroDuration: typeof req.body?.outroDuration === 'number' ? req.body.outroDuration : undefined,
    stylePrompt: asOptionalString(req.body?.stylePrompt),
    introPrompt: asOptionalString(req.body?.introPrompt),
    outroPrompt: asOptionalString(req.body?.outroPrompt),
    branding: brandingBody
      ? {
          company_logo_url: asOptionalString(brandingBody.company_logo_url),
          vendor_logo_url: asOptionalString(brandingBody.vendor_logo_url),
          company_website_url: asOptionalString(brandingBody.company_website_url),
          watermark_position: asOptionalString(brandingBody.watermark_position),
          vendor_logo_position: asOptionalString(brandingBody.vendor_logo_position),
          follow_cta_enabled: asOptionalBoolean(brandingBody.follow_cta_enabled),
          follow_cta_text: asOptionalString(brandingBody.follow_cta_text),
          follow_cta_start_seconds: asOptionalNumber(brandingBody.follow_cta_start_seconds),
          follow_cta_duration: asOptionalNumber(brandingBody.follow_cta_duration),
          follow_cta_repeat_seconds: asOptionalNumber(brandingBody.follow_cta_repeat_seconds),
          platform_logo_throughout: asOptionalBoolean(brandingBody.platform_logo_throughout),
          vendor_logo_throughout: asOptionalBoolean(brandingBody.vendor_logo_throughout),
          watermark_enabled: true,
        }
      : undefined,
    backgroundMusicTrackId: asOptionalString(req.body?.backgroundMusicTrackId),
    backgroundMusicVolume: asOptionalNumber(req.body?.backgroundMusicVolume),
  });
  res.json(result);
}));
