import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getServiceClient } from '../lib/supabase.js';
import { logger, trimUrl } from '../lib/logger.js';
import { httpError } from '../lib/http.js';
import {
  extractLastVideoFrame,
  extractVideoFrame,
  probeVideo,
  transcodeWithOverlays,
  withTempDir,
  wrapNativeIntroOutro,
  type FfmpegOverlay,
} from '../lib/video-tools.js';
import {
  compositeLogoOverlays,
  hasLogoOverlays,
  normalizeFrameToSize,
  prepareVideoOverlays,
  shouldApplyVideoOverlays,
  type BrandingOverlayRow,
} from './branded-overlay.js';
import { frameFitsVideo, generateTemplateFrame, orientationOf, originalVideoUrl } from './generate-template-frame.js';

const MEDIA_BUCKET = 'content-media';

export interface ApplyTemplateFramesInput {
  contentId: string;
  introFrameUrl?: string | null;
  outroFrameUrl?: string | null;
  introDuration?: number;
  outroDuration?: number;
  introPrompt?: string | null;
  outroPrompt?: string | null;
  branding?: BrandingOverlayRow | null;
  sourceUrl?: string | null;
}

function clampDuration(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(30, Math.max(0.5, Math.round(parsed * 10) / 10));
}

function evenSize(value: number) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}


function extensionFromUrl(url: string, fallback: string) {
  const pathPart = url.split('?')[0] || '';
  const ext = pathPart.split('.').pop()?.toLowerCase();
  if (ext === 'jpeg') return 'jpg';
  if (ext && ['png', 'jpg', 'webp', 'gif', 'mp4', 'mov', 'webm'].includes(ext)) return ext;
  return fallback;
}

async function downloadToFile(url: string, destPath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download media (${response.status})`);
  }
  await writeFile(destPath, Buffer.from(await response.arrayBuffer()));
}

async function uploadVideo(bytes: Buffer, contentId: string) {
  const filePath = `processed/${contentId}-framed-${Date.now()}.mp4`;
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(filePath, bytes, {
    contentType: 'video/mp4',
    upsert: true,
  });
  if (error) throw new Error(`Failed to store framed video: ${error.message}`);
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
  if (!data.publicUrl) throw new Error('Failed to create public URL for framed video');
  return data.publicUrl;
}

async function fitGraphic(
  imagePathOrBytes: string | Buffer,
  width: number,
  height: number,
  plate?: Buffer | null,
) {
  const raw = typeof imagePathOrBytes === 'string'
    ? await readFile(imagePathOrBytes)
    : imagePathOrBytes;
  return normalizeFrameToSize(raw, evenSize(width), evenSize(height), plate);
}

async function frameMatchesVideo(bytes: Buffer, width: number, height: number) {
  const meta = await sharp(bytes).rotate().metadata();
  return frameFitsVideo(
    { width: meta.width || 0, height: meta.height || 0 },
    { width, height },
  );
}

async function extractPlate(videoPath: string, dir: string, position: 'intro' | 'outro') {
  const platePath = path.join(dir, `${position}-plate.png`);
  try {
    if (position === 'outro') await extractLastVideoFrame(videoPath, platePath);
    else await extractVideoFrame(videoPath, platePath, 0.12);
    return await readFile(platePath);
  } catch (error) {
    logger.warn('apply-template-frames', `Could not extract ${position} plate from the original video`, error);
    return null;
  }
}

async function frameForVideo(input: {
  position: 'intro' | 'outro';
  contentId: string;
  title?: string | null;
  platform?: string | null;
  existingUrl?: string | null;
  prompt?: string | null;
  width: number;
  height: number;
  branding: BrandingOverlayRow;
}) {
  if (input.existingUrl) {
    try {
      const response = await fetch(input.existingUrl);
      if (response.ok) {
        const bytes = Buffer.from(await response.arrayBuffer());
        if (await frameMatchesVideo(bytes, input.width, input.height)) {
          return { url: input.existingUrl, bytes };
        }
        logger.info('apply-template-frames', `${input.position} frame orientation does not match the original video, regenerating with prompt`, {
          contentId: input.contentId,
          video: `${input.width}x${input.height}`,
          hasPrompt: Boolean(input.prompt?.trim()),
        });
      }
    } catch (error) {
      logger.warn('apply-template-frames', `Could not read existing ${input.position} frame`, error);
    }
  }

  try {
    const generated = await generateTemplateFrame({
      position: input.position,
      contentId: input.contentId,
      title: input.title || undefined,
      platform: input.platform || undefined,
      prompt: input.prompt?.trim() || undefined,
      useAi: true,
      saveTo: 'none',
      branding: input.branding,
    });
    const response = await fetch(generated.frameUrl);
    if (!response.ok) throw new Error(`Failed to download generated ${input.position} frame`);
    return { url: generated.frameUrl, bytes: Buffer.from(await response.arrayBuffer()) };
  } catch (error) {
    logger.warn('apply-template-frames', `AI ${input.position} regenerate failed, using branding frame`, error);
    const generated = await generateTemplateFrame({
      position: input.position,
      contentId: input.contentId,
      title: input.title || undefined,
      platform: input.platform || undefined,
      prompt: input.prompt?.trim() || undefined,
      useAi: false,
      saveTo: 'none',
      branding: input.branding,
    });
    const response = await fetch(generated.frameUrl);
    if (!response.ok) throw new Error(`Failed to download ${input.position} frame`);
    return { url: generated.frameUrl, bytes: Buffer.from(await response.arrayBuffer()) };
  }
}

export async function applyTemplateFrames(input: ApplyTemplateFramesInput) {
  const supabase = getServiceClient();
  const { data: content, error } = await supabase
    .from('content')
    .select('*')
    .eq('id', input.contentId)
    .maybeSingle();
  if (error) throw error;
  if (!content) throw httpError(404, 'Content not found');

  const { data: branding } = await supabase
    .from('branding_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  // Use only this content's frames — never pull old global branding intro/outro onto a new video.
  const providedIntro = input.introFrameUrl || content.intro_frame_url || null;
  const providedOutro = input.outroFrameUrl || content.outro_frame_url || null;
  const introEnabled = Boolean(providedIntro);
  const outroEnabled = Boolean(providedOutro);
  const brandingRow = {
    ...((branding || {}) as BrandingOverlayRow),
    company_logo_url: input.branding?.company_logo_url ?? content.watermark_logo_url ?? null,
    vendor_logo_url: input.branding?.vendor_logo_url ?? content.vendor_logo_url ?? null,
    company_website_url: input.branding?.company_website_url ?? content.watermark_website_url ?? null,
    watermark_position: input.branding?.watermark_position || content.watermark_position || 'bottom-right',
  } as BrandingOverlayRow;
  if (input.branding) {
    for (const [key, value] of Object.entries(input.branding)) {
      if (value !== undefined && key !== 'company_logo_url' && key !== 'vendor_logo_url' && key !== 'company_website_url') {
        (brandingRow as Record<string, unknown>)[key] = value;
      }
    }
  }
  const overlayEnabled = shouldApplyVideoOverlays(brandingRow);

  if (!introEnabled && !outroEnabled && !overlayEnabled) {
    logger.info('apply-template-frames', 'Intro, outro, logos, and follow CTA disabled; leaving video unchanged', {
      contentId: input.contentId,
    });
    return { success: true, skipped: true, content };
  }

  const originalUrl = originalVideoUrl({
    original_media_url: content.original_media_url,
    template_source_url: content.template_source_url,
    media_url: content.media_url,
    enhanced_media_url: content.enhanced_media_url,
    template_frames_applied: content.template_frames_applied,
  });
  if (!originalUrl) throw httpError(400, 'This content has no original video to wrap.');

  const introDuration = clampDuration(
    input.introDuration ?? content.intro_frame_duration ?? branding?.intro_card_duration,
    3,
  );
  const outroDuration = clampDuration(
    input.outroDuration ?? content.outro_frame_duration ?? branding?.end_card_duration,
    5,
  );

  logger.info('apply-template-frames', 'Adding intro and outro to the original video', {
    contentId: input.contentId,
    originalUrl: trimUrl(originalUrl),
    introEnabled,
    outroEnabled,
    overlayEnabled,
    introDuration,
    outroDuration,
  });

  let introFrameUrl = providedIntro;
  let outroFrameUrl = providedOutro;

  const framedUrl = await withTempDir(async (dir) => {
    const originalPath = path.join(dir, `original.${extensionFromUrl(originalUrl, 'mp4')}`);
    await downloadToFile(originalUrl, originalPath);
    const probe = await probeVideo(originalPath);
    const sourcePath = originalPath;
    const introPlate = await extractPlate(originalPath, dir, 'intro');
    const outroPlate = await extractPlate(originalPath, dir, 'outro');

    logger.info('apply-template-frames', 'Wrapping frames to the original video canvas', {
      contentId: input.contentId,
      width: probe.width,
      height: probe.height,
      orientation: orientationOf(probe),
    });

    const overlayPlan = overlayEnabled
      ? await prepareVideoOverlays({
          branding: brandingRow,
          width: probe.width,
          height: probe.height,
          duration: probe.duration,
        })
      : [];
    const ffmpegOverlays: FfmpegOverlay[] = [];
    for (const overlay of overlayPlan) {
      const overlayPath = path.join(dir, `${overlay.kind}.png`);
      await writeFile(overlayPath, overlay.bytes);
      ffmpegOverlays.push({
        path: overlayPath,
        x: overlay.x,
        y: overlay.y,
        enable: overlay.enable
          ? `between(t,${overlay.enable.start.toFixed(3)},${overlay.enable.end.toFixed(3)})`
          : undefined,
      });
    }

    const middlePath = path.join(dir, 'middle.mp4');
    await transcodeWithOverlays(
      sourcePath,
      middlePath,
      {
        width: probe.width,
        height: probe.height,
        fps: probe.fps,
        withAudio: probe.hasAudio,
      },
      ffmpegOverlays,
    );
    const middleProbe = await probeVideo(middlePath);

    const shouldIntro = introEnabled && Boolean(providedIntro);
    const shouldOutro = outroEnabled && Boolean(providedOutro);
    let introImagePath: string | null = null;
    let outroImagePath: string | null = null;

    if (shouldIntro) {
      const intro = await frameForVideo({
        position: 'intro',
        contentId: input.contentId,
        title: content.title,
        platform: content.platform,
        existingUrl: providedIntro,
        prompt: input.introPrompt,
        width: probe.width,
        height: probe.height,
        branding: brandingRow,
      });
      introFrameUrl = intro.url;
      let introBytes = await fitGraphic(intro.bytes, probe.width, probe.height, introPlate);
      if (hasLogoOverlays(brandingRow) && !/\/templates\//.test(intro.url)) {
        introBytes = await compositeLogoOverlays(introBytes, brandingRow, probe.width, probe.height);
      }
      introImagePath = path.join(dir, 'intro-card.png');
      await writeFile(introImagePath, introBytes);
    }

    if (shouldOutro) {
      const outro = await frameForVideo({
        position: 'outro',
        contentId: input.contentId,
        title: content.title,
        platform: content.platform,
        existingUrl: providedOutro,
        prompt: input.outroPrompt,
        width: probe.width,
        height: probe.height,
        branding: brandingRow,
      });
      outroFrameUrl = outro.url;
      let outroBytes = await fitGraphic(outro.bytes, probe.width, probe.height, outroPlate);
      if (hasLogoOverlays(brandingRow) && !/\/templates\//.test(outro.url)) {
        outroBytes = await compositeLogoOverlays(outroBytes, brandingRow, probe.width, probe.height);
      }
      outroImagePath = path.join(dir, 'outro-card.png');
      await writeFile(outroImagePath, outroBytes);
    }

    const outputPath = path.join(dir, 'framed.mp4');
    logger.info('apply-template-frames', 'Mixing intro and outro into the same shots as the clip', {
      contentId: input.contentId,
      introDuration: shouldIntro ? introDuration : 0,
      mainDuration: middleProbe.duration,
      outroDuration: shouldOutro ? outroDuration : 0,
    });
    await wrapNativeIntroOutro(middlePath, outputPath, {
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
      withAudio: probe.hasAudio,
      introImagePath,
      outroImagePath,
      introDuration,
      outroDuration,
    });
    const framedProbe = await probeVideo(outputPath);
    logger.info('apply-template-frames', 'Framed video duration', {
      contentId: input.contentId,
      duration: framedProbe.duration,
      expected:
        (shouldIntro ? introDuration : 0)
        + (middleProbe.duration || probe.duration)
        + (shouldOutro ? outroDuration : 0),
      outroIncluded: shouldOutro,
    });
    return uploadVideo(await readFile(outputPath), input.contentId);
  });

  const { data: updated, error: updateError } = await supabase
    .from('content')
    .update({
      media_url: framedUrl,
      enhanced_media_url: framedUrl,
      intro_frame_url: introFrameUrl,
      outro_frame_url: outroFrameUrl,
      intro_frame_duration: introDuration,
      outro_frame_duration: outroDuration,
      original_media_url: content.original_media_url || originalUrl,
      template_source_url: originalUrl,
      template_frames_applied: true,
      preprocessing_status: 'completed',
      watermark_logo_url: brandingRow.company_logo_url || null,
      vendor_logo_url: brandingRow.vendor_logo_url || null,
      watermark_website_url: brandingRow.company_website_url || content.watermark_website_url || null,
      watermark_position: brandingRow.watermark_position || content.watermark_position || 'bottom-right',
    } as never)
    .eq('id', input.contentId)
    .select()
    .single();
  if (updateError) {
    throw new Error(updateError.message || 'Failed to save the framed video');
  }

  logger.info('apply-template-frames', 'Ready-to-post video stored', {
    contentId: input.contentId,
    framedUrl: trimUrl(framedUrl),
  });

  return {
    success: true,
    mediaUrl: framedUrl,
    introFrameUrl,
    outroFrameUrl,
    introDuration,
    outroDuration,
    content: updated,
  };
}
