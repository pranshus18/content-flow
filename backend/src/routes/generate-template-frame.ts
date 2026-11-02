import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { assertContentAccess } from '../lib/content-access.js';
import { generateTemplateFrame, generateTemplateFramePair } from '../services/generate-template-frame.js';

export const generateTemplateFrameRouter = Router();

function parseBranding(brandingBody: Record<string, unknown> | null) {
  if (!brandingBody) return undefined;
  return {
    company_logo_url: typeof brandingBody.company_logo_url === 'string' ? brandingBody.company_logo_url : brandingBody.company_logo_url === null ? null : undefined,
    vendor_logo_url: typeof brandingBody.vendor_logo_url === 'string' ? brandingBody.vendor_logo_url : brandingBody.vendor_logo_url === null ? null : undefined,
    company_website_url: typeof brandingBody.company_website_url === 'string' ? brandingBody.company_website_url : brandingBody.company_website_url === null ? null : undefined,
    watermark_position: typeof brandingBody.watermark_position === 'string' ? brandingBody.watermark_position : undefined,
    vendor_logo_position: typeof brandingBody.vendor_logo_position === 'string' ? brandingBody.vendor_logo_position : undefined,
  };
}

generateTemplateFrameRouter.post('/', asyncHandler(async (req: AuthedRequest, res) => {
  req.setTimeout(10 * 60 * 1000);
  res.setTimeout(10 * 60 * 1000);
  const contentId = typeof req.body?.contentId === 'string' && req.body.contentId.trim()
    ? await assertContentAccess(req.user!.id, req.body.contentId)
    : undefined;
  const brandingBody = req.body?.branding && typeof req.body.branding === 'object'
    ? req.body.branding as Record<string, unknown>
    : null;
  const branding = parseBranding(brandingBody);
  const stylePrompt = typeof req.body?.stylePrompt === 'string'
    ? req.body.stylePrompt
    : typeof req.body?.prompt === 'string'
      ? req.body.prompt
      : undefined;
  const pairMode = req.body?.mode === 'pair' || req.body?.generatePair === true;

  if (pairMode) {
    const result = await generateTemplateFramePair({
      contentId,
      stylePrompt,
      prompt: stylePrompt,
      useAi: req.body?.useAi !== false,
      platform: typeof req.body?.platform === 'string' ? req.body.platform : undefined,
      title: typeof req.body?.title === 'string' ? req.body.title : undefined,
      headline: typeof req.body?.headline === 'string' ? req.body.headline : undefined,
      saveTo: req.body?.saveTo === 'content' || req.body?.saveTo === 'branding' ? req.body.saveTo : 'none',
      branding,
    });
    res.json(result);
    return;
  }

  const result = await generateTemplateFrame({
    position: req.body?.position === 'outro' ? 'outro' : 'intro',
    contentId,
    prompt: stylePrompt,
    stylePrompt,
    useAi: req.body?.useAi !== false,
    platform: typeof req.body?.platform === 'string' ? req.body.platform : undefined,
    title: typeof req.body?.title === 'string' ? req.body.title : undefined,
    headline: typeof req.body?.headline === 'string' ? req.body.headline : undefined,
    saveTo: req.body?.saveTo === 'content' || req.body?.saveTo === 'branding' ? req.body.saveTo : 'none',
    branding,
    omitEmbeddedLogos: true,
  });
  res.json(result);
}));
