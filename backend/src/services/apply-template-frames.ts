import { copyFile, readFile, writeFile } from 'node:fs/promises';
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
  replaceVideoAudioWithMusic,
  type FfmpegOverlay,
} from '../lib/video-tools.js';
import {
  clampMusicVolume,
  getBackgroundMusicTrack,
  resolveBackgroundMusicSource,
} from '../lib/music-catalog.js';
import {
  applyLogoOverlaysToImage,
  asPosition,
  compositeLogoOverlays,
  hasIntroOutroCardLogos,
  hasLogoOverlays,
  normalizeFrameToSize,
  overlayEnableExpression,
  platformLogoOnMainVideo,
  prepareVideoOverlays,
  shouldApplyVideoOverlays,
  vendorLogoOnMainVideo,
  type BrandingOverlayRow,
} from './branded-overlay.js';
import {
  frameFitsVideo,
  generateTemplateFrame,
  orientationOf,
  originalVideoUrl,
} from './generate-template-frame.js';

function isVideoContent(content: {
  media_type?: string | null;
  media_url?: string | null;
  original_media_url?: string | null;
  enhanced_media_url?: string | null;
}) {
  if (content.media_type === 'video') return true;
  if (content.media_type === 'image') return false;
  const url = content.original_media_url || content.media_url || content.enhanced_media_url || '';
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

function originalImageUrl(content: {
  original_media_url?: string | null;
  template_source_url?: string | null;
  media_url?: string | null;
  enhanced_media_url?: string | null;
  template_frames_applied?: boolean | null;
}) {
  return originalVideoUrl(content);
}

const MEDIA_BUCKET = 'content-media';

export interface ApplyTemplateFramesInput {
  contentId: string;
  introFrameUrl?: string | null;
  outroFrameUrl?: string | null;
  introDuration?: number;
  outroDuration?: number;
  stylePrompt?: string | null;
  introPrompt?: string | null;
  outroPrompt?: string | null;
  branding?: BrandingOverlayRow | null;
  sourceUrl?: string | null;
  backgroundMusicTrackId?: string | null;
  backgroundMusicVolume?: number | null;
}

/** System-generated frames live under templates/intro|outro; user uploads use {userId}/templates/... */
function isSystemTemplateUrl(url: string | null | undefined) {
  if (!url) return false;
  return /\/templates\/(intro|outro)\//i.test(url);
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

async function materializeMusicTrack(trackId: string, destPath: string) {
  const source = resolveBackgroundMusicSource(trackId);
  if (source.kind === 'file') {
    await copyFile(source.path, destPath);
    return;
  }
  await downloadToFile(source.url, destPath);
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

async function uploadBrandedImage(bytes: Buffer, contentId: string) {
  const filePath = `branded-images/${contentId}-${Date.now()}.png`;
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(filePath, bytes, {
    contentType: 'image/png',
    upsert: false,
  });
  if (error) throw new Error(`Failed to store branded image: ${error.message}`);
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
  if (!data.publicUrl) throw new Error('Failed to create public URL for branded image');
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
  /** Prefer regenerating system AI/procedural frames when logos will be corner-composited. */
  forceRegenerateSystemFrames?: boolean;
}) {
  if (input.existingUrl) {
    const isCustomUpload = !isSystemTemplateUrl(input.existingUrl);
    const shouldTryReuse = isCustomUpload || !input.forceRegenerateSystemFrames;
    if (shouldTryReuse) {
      try {
        const response = await fetch(input.existingUrl);
        if (response.ok) {
          const bytes = Buffer.from(await response.arrayBuffer());
          if (await frameMatchesVideo(bytes, input.width, input.height)) {
            logger.info('apply-template-frames', `Reusing existing ${input.position} frame`, {
              contentId: input.contentId,
              customUpload: isCustomUpload,
            });
            // Custom uploads may need native logo composite; system AI frames already include logos.
            return {
              url: input.existingUrl,
              bytes,
              logosIntegrated: !isCustomUpload && hasLogoOverlays(input.branding),
            };
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
    } else {
      logger.info('apply-template-frames', `Regenerating system ${input.position} frame so corner logos stay clean`, {
        contentId: input.contentId,
      });
    }
  }

  const stylePrompt = input.prompt?.trim() || undefined;
  const wantsAi = Boolean(stylePrompt) || hasLogoOverlays(input.branding);
  try {
    const generated = await generateTemplateFrame({
      position: input.position,
      contentId: input.contentId,
      title: input.title || undefined,
      platform: input.platform || undefined,
      prompt: stylePrompt,
      stylePrompt,
      useAi: wantsAi,
      saveTo: 'none',
      branding: input.branding,
      omitEmbeddedLogos: true,
    });
    const response = await fetch(generated.frameUrl);
    if (!response.ok) throw new Error(`Failed to download generated ${input.position} frame`);
    return {
      url: generated.frameUrl,
      bytes: Buffer.from(await response.arrayBuffer()),
      logosIntegrated: Boolean(generated.logosIntegrated),
    };
  } catch (error) {
    logger.warn('apply-template-frames', `AI ${input.position} regenerate failed, using branding frame`, error);
    const generated = await generateTemplateFrame({
      position: input.position,
      contentId: input.contentId,
      title: input.title || undefined,
      platform: input.platform || undefined,
      prompt: stylePrompt,
      stylePrompt,
      useAi: false,
      saveTo: 'none',
      branding: input.branding,
      omitEmbeddedLogos: true,
    });
    const response = await fetch(generated.frameUrl);
    if (!response.ok) throw new Error(`Failed to download ${input.position} frame`);
    return {
      url: generated.frameUrl,
      bytes: Buffer.from(await response.arrayBuffer()),
      logosIntegrated: false,
    };
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
  let providedIntro = input.introFrameUrl || content.intro_frame_url || null;
  let providedOutro = input.outroFrameUrl || content.outro_frame_url || null;
  const hasAnyFramePrompt = Boolean(
    (input.stylePrompt || input.introPrompt || input.outroPrompt || '').trim(),
  );
  // Never inherit corner positions from global branding_settings — only this request / content row.
  const brandingSettings = { ...(branding || {}) } as Record<string, unknown>;
  delete brandingSettings.watermark_position;
  delete brandingSettings.vendor_logo_position;

  const platformPosition = asPosition(
    input.branding?.watermark_position ?? content.watermark_position,
    'bottom-right',
  );
  const vendorPosition = asPosition(
    input.branding?.vendor_logo_position ?? content.vendor_logo_position,
    'bottom-left',
  );

  const brandingRow = {
    ...(brandingSettings as BrandingOverlayRow),
    ...(input.branding || {}),
    company_logo_url: input.branding
      ? (input.branding.company_logo_url || null)
      : (content.watermark_logo_url || null),
    vendor_logo_url: input.branding
      ? (input.branding.vendor_logo_url || null)
      : (content.vendor_logo_url || null),
    company_website_url: input.branding
      ? (input.branding.company_website_url || null)
      : (content.watermark_website_url || null),
    watermark_position: platformPosition,
    vendor_logo_position: vendorPosition,
    watermark_enabled: true,
    platform_logo_throughout: input.branding?.platform_logo_throughout
      ?? (content.platform_logo_throughout as boolean | null | undefined)
      ?? true,
    vendor_logo_throughout: input.branding?.vendor_logo_throughout
      ?? (content.vendor_logo_throughout as boolean | null | undefined)
      ?? false,
  } as BrandingOverlayRow;

  logger.info('apply-template-frames', 'Resolved logo corners for this content', {
    contentId: input.contentId,
    platformPosition,
    vendorPosition,
    fromRequest: {
      platform: input.branding?.watermark_position ?? null,
      vendor: input.branding?.vendor_logo_position ?? null,
    },
    fromContent: {
      platform: content.watermark_position ?? null,
      vendor: content.vendor_logo_position ?? null,
    },
  });

  const resolvedMusicTrackId = input.backgroundMusicTrackId !== undefined
    ? (typeof input.backgroundMusicTrackId === 'string' && input.backgroundMusicTrackId.trim()
      ? input.backgroundMusicTrackId.trim()
      : null)
    : ((content.background_music_track_id as string | null | undefined) ?? null);
  const musicVolume = clampMusicVolume(
    input.backgroundMusicVolume ?? content.background_music_volume ?? 1,
  );
  if (resolvedMusicTrackId && !getBackgroundMusicTrack(resolvedMusicTrackId)) {
    throw httpError(400, `Unknown background music track: ${resolvedMusicTrackId}`);
  }
  const hasBackgroundMusic = Boolean(resolvedMusicTrackId);
  const musicTouched = input.backgroundMusicTrackId !== undefined
    || input.backgroundMusicVolume !== undefined;
  const hadMusic = Boolean(content.background_music_track_id);
  const clearingMusic = musicTouched && !resolvedMusicTrackId && hadMusic;
  const musicPatch = musicTouched
    ? {
        background_music_track_id: resolvedMusicTrackId,
        background_music_volume: musicVolume,
      }
    : {};

  const overlayEnabled = shouldApplyVideoOverlays(brandingRow);
  // One Apply click: logos + intro + outro together whenever branding is present.
  const wantsBrandPackage = Boolean(
    providedIntro
    || providedOutro
    || hasAnyFramePrompt
    || hasLogoOverlays(brandingRow)
    || brandingRow.follow_cta_enabled,
  );
  const introEnabled = wantsBrandPackage;
  const outroEnabled = wantsBrandPackage;
  const needsBrandingBake = introEnabled || outroEnabled || overlayEnabled;
  const shouldProcessVideo = needsBrandingBake || hasBackgroundMusic || clearingMusic;
  const brandingPatch = {
    watermark_logo_url: brandingRow.company_logo_url || null,
    vendor_logo_url: brandingRow.vendor_logo_url || null,
    watermark_website_url: brandingRow.company_website_url || content.watermark_website_url || null,
    watermark_position: platformPosition,
    vendor_logo_position: vendorPosition,
    platform_logo_throughout: brandingRow.platform_logo_throughout !== false,
    vendor_logo_throughout: brandingRow.vendor_logo_throughout === true,
  };

  if (!isVideoContent(content)) {
    const sourceUrl = originalImageUrl(content);
    if (!sourceUrl) throw httpError(400, 'This content has no original image to brand.');

    logger.info('apply-template-frames', 'Baking logos onto image at chosen positions', {
      contentId: input.contentId,
      sourceUrl: trimUrl(sourceUrl),
      platformPosition: brandingPatch.watermark_position,
      vendorPosition: brandingPatch.vendor_logo_position,
    });

    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`Failed to download image (${response.status})`);
    const sourceBytes = Buffer.from(await response.arrayBuffer());
    const brandedBytes = await applyLogoOverlaysToImage(sourceBytes, brandingRow);
    const finalUrl = await uploadBrandedImage(brandedBytes, input.contentId);

    const { data: updatedImage, error: imageUpdateError } = await supabase
      .from('content')
      .update({
        media_url: finalUrl,
        enhanced_media_url: finalUrl,
        original_media_url: content.original_media_url || sourceUrl,
        template_source_url: sourceUrl,
        template_frames_applied: true,
        preprocessing_status: 'completed',
        ...brandingPatch,
      } as never)
      .eq('id', input.contentId)
      .select()
      .single();
    if (imageUpdateError) throw new Error(imageUpdateError.message || 'Failed to save branded image');

    return {
      success: true,
      mediaUrl: finalUrl,
      content: updatedImage,
    };
  }

  const originalUrl = originalVideoUrl({
    original_media_url: content.original_media_url,
    template_source_url: content.template_source_url,
    media_url: content.media_url,
    enhanced_media_url: content.enhanced_media_url,
    template_frames_applied: content.template_frames_applied,
  });
  if (!originalUrl) throw httpError(400, 'This content has no original video to wrap.');

  if (!shouldProcessVideo) {
    logger.info('apply-template-frames', 'No branding or music changes to bake; leaving media unchanged', {
      contentId: input.contentId,
    });
    const { data: updatedOnly, error: updateOnlyError } = await supabase
      .from('content')
      .update({ ...brandingPatch, ...musicPatch } as never)
      .eq('id', input.contentId)
      .select()
      .single();
    if (updateOnlyError) throw new Error(updateOnlyError.message || 'Failed to save content fields');
    return { success: true, skipped: true, content: updatedOnly };
  }

  const introDuration = clampDuration(
    input.introDuration ?? content.intro_frame_duration ?? branding?.intro_card_duration,
    3,
  );
  const outroDuration = clampDuration(
    input.outroDuration ?? content.outro_frame_duration ?? branding?.end_card_duration,
    5,
  );
  const introPrompt = (input.introPrompt || input.stylePrompt || '').trim() || null;
  const outroPrompt = (input.outroPrompt || input.stylePrompt || '').trim() || null;

  // Fill only missing frames, each with its own prompt — never overwrite a frame the user kept.
  if (wantsBrandPackage && (!providedIntro || !providedOutro)) {
    const jobs: Array<Promise<void>> = [];
    if (!providedIntro) {
      jobs.push((async () => {
        try {
          const generated = await generateTemplateFrame({
            position: 'intro',
            contentId: input.contentId,
            stylePrompt: introPrompt || undefined,
            prompt: introPrompt || undefined,
            useAi: Boolean(introPrompt) || hasLogoOverlays(brandingRow),
            platform: content.platform || undefined,
            title: content.title || undefined,
            saveTo: 'none',
            branding: brandingRow,
            omitEmbeddedLogos: true,
          });
          providedIntro = generated.frameUrl;
        } catch (error) {
          logger.warn('apply-template-frames', 'Auto intro generate failed; will fall back per-frame', error);
        }
      })());
    }
    if (!providedOutro) {
      jobs.push((async () => {
        try {
          const generated = await generateTemplateFrame({
            position: 'outro',
            contentId: input.contentId,
            stylePrompt: outroPrompt || undefined,
            prompt: outroPrompt || undefined,
            useAi: Boolean(outroPrompt) || hasLogoOverlays(brandingRow),
            platform: content.platform || undefined,
            title: content.title || undefined,
            saveTo: 'none',
            branding: brandingRow,
            omitEmbeddedLogos: true,
          });
          providedOutro = generated.frameUrl;
        } catch (error) {
          logger.warn('apply-template-frames', 'Auto outro generate failed; will fall back per-frame', error);
        }
      })());
    }
    if (jobs.length) {
      logger.info('apply-template-frames', 'Auto-generating only missing intro/outro frames', {
        contentId: input.contentId,
        missingIntro: !providedIntro,
        missingOutro: !providedOutro,
      });
      await Promise.all(jobs);
    }
  }

  logger.info('apply-template-frames', 'Baking intro + outro into the original video', {
    contentId: input.contentId,
    originalUrl: trimUrl(originalUrl),
    introEnabled,
    outroEnabled,
    overlayEnabled,
    platformLogoThroughout: platformLogoOnMainVideo(brandingRow),
    vendorLogoThroughout: vendorLogoOnMainVideo(brandingRow),
    logosOnIntroOutroCards: hasIntroOutroCardLogos(brandingRow),
    introDuration,
    outroDuration,
    hasIntroPrompt: Boolean(introPrompt),
    hasOutroPrompt: Boolean(outroPrompt),
  });

  let introFrameUrl = providedIntro;
  let outroFrameUrl = providedOutro;

  const framedUrl = await withTempDir(async (dir) => {
    const originalPath = path.join(dir, `original.${extensionFromUrl(originalUrl, 'mp4')}`);
    await downloadToFile(originalUrl, originalPath);

    if (!needsBrandingBake && (hasBackgroundMusic || clearingMusic)) {
      if (hasBackgroundMusic && resolvedMusicTrackId) {
        const musicPath = path.join(dir, 'music.mp3');
        await materializeMusicTrack(resolvedMusicTrackId, musicPath);
        const musicOnlyPath = path.join(dir, 'music-only.mp4');
        await replaceVideoAudioWithMusic(originalPath, musicPath, musicOnlyPath, { volume: musicVolume });
        logger.info('apply-template-frames', 'Applied background music only', {
          contentId: input.contentId,
          trackId: resolvedMusicTrackId,
        });
        return uploadVideo(await readFile(musicOnlyPath), input.contentId);
      }
      logger.info('apply-template-frames', 'Removed background music; restoring original clip audio', {
        contentId: input.contentId,
      });
      return uploadVideo(await readFile(originalPath), input.contentId);
    }

    const probe = await probeVideo(originalPath);
    const sourcePath = originalPath;
    const introPlate = await extractPlate(originalPath, dir, 'intro');
    const outroPlate = await extractPlate(originalPath, dir, 'outro');
    const scenePlates: Buffer[] = [];
    if (platformLogoOnMainVideo(brandingRow) || vendorLogoOnMainVideo(brandingRow)) {
      if (introPlate) scenePlates.push(introPlate);
      const midPlatePath = path.join(dir, 'mid-plate.png');
      try {
        const midTime = Math.max(0.12, probe.duration * 0.45);
        await extractVideoFrame(originalPath, midPlatePath, midTime);
        scenePlates.push(await readFile(midPlatePath));
      } catch (error) {
        logger.warn('apply-template-frames', 'Could not extract mid-video plate for logo grading', error);
      }
      if (outroPlate) scenePlates.push(outroPlate);
      if (!scenePlates.length && introPlate) scenePlates.push(introPlate);
    }

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
          scenePlate: scenePlates.length ? scenePlates : introPlate,
          includePlatformLogo: platformLogoOnMainVideo(brandingRow),
          includeVendorLogo: vendorLogoOnMainVideo(brandingRow),
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
        enable: overlay.enable ? overlayEnableExpression(overlay.enable) : undefined,
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

    const shouldIntro = introEnabled;
    const shouldOutro = outroEnabled;
    let introImagePath: string | null = null;
    let outroImagePath: string | null = null;

    if (shouldIntro) {
      // Reuse the frames the user just generated — do not discard them on Apply.
      const intro = await frameForVideo({
        position: 'intro',
        contentId: input.contentId,
        title: content.title,
        platform: content.platform,
        existingUrl: providedIntro,
        prompt: introPrompt,
        width: probe.width,
        height: probe.height,
        branding: brandingRow,
        forceRegenerateSystemFrames: false,
      });
      introFrameUrl = intro.url;
      let introBytes = await fitGraphic(intro.bytes, probe.width, probe.height, introPlate);
      if (hasIntroOutroCardLogos(brandingRow) && !intro.logosIntegrated) {
        introBytes = await compositeLogoOverlays(introBytes, brandingRow, probe.width, probe.height, 'intro_outro');
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
        prompt: outroPrompt,
        width: probe.width,
        height: probe.height,
        branding: brandingRow,
        forceRegenerateSystemFrames: false,
      });
      outroFrameUrl = outro.url;
      let outroBytes = await fitGraphic(outro.bytes, probe.width, probe.height, outroPlate);
      if (hasIntroOutroCardLogos(brandingRow) && !outro.logosIntegrated) {
        outroBytes = await compositeLogoOverlays(outroBytes, brandingRow, probe.width, probe.height, 'intro_outro');
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
    const hardExpected =
      (shouldIntro ? introDuration : 0)
      + (middleProbe.duration || probe.duration)
      + (shouldOutro ? outroDuration : 0);
    logger.info('apply-template-frames', 'Framed video duration', {
      contentId: input.contentId,
      duration: framedProbe.duration,
      hardConcatExpected: hardExpected,
      // Soft xfade shortens joins vs hard concat.
      softBlendExpectedApprox: hardExpected - ((shouldIntro ? 1 : 0) + (shouldOutro ? 1 : 0)) * 0.5,
      outroIncluded: shouldOutro,
    });

    let finalPath = outputPath;
    if (hasBackgroundMusic && resolvedMusicTrackId) {
      const musicPath = path.join(dir, 'music.mp3');
      await materializeMusicTrack(resolvedMusicTrackId, musicPath);
      const withMusicPath = path.join(dir, 'framed-with-music.mp4');
      await replaceVideoAudioWithMusic(finalPath, musicPath, withMusicPath, { volume: musicVolume });
      finalPath = withMusicPath;
      logger.info('apply-template-frames', 'Replaced video audio with background music', {
        contentId: input.contentId,
        trackId: resolvedMusicTrackId,
      });
    }

    return uploadVideo(await readFile(finalPath), input.contentId);
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
      // Keep the unframed source stable across re-applies so editing never re-wraps a branded file.
      original_media_url: content.original_media_url || content.template_source_url || originalUrl,
      template_source_url: content.template_source_url || content.original_media_url || originalUrl,
      template_frames_applied: true,
      preprocessing_status: 'completed',
      ...brandingPatch,
      background_music_track_id: resolvedMusicTrackId,
      background_music_volume: musicVolume,
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
