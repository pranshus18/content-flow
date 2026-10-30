import sharp from 'sharp';
import { getServiceClient } from '../lib/supabase.js';
import { logger, trimUrl } from '../lib/logger.js';
import { enhanceMediaUntilComplete } from './enhance-media.js';

export interface PreprocessInput {
  mediaUrl?: string;
  contentId?: string;
  mediaType?: string;
  platform?: string;
}

const MEDIA_BUCKET = 'content-media';

const platformVideoSpecs: Record<string, {
  width: number;
  height: number;
  maxLength: number;
  maxFileSize: number;
  bitrate: number;
}> = {
  instagram: { width: 1080, height: 1080, maxLength: 60, maxFileSize: 100, bitrate: 3500 },
  facebook: { width: 1080, height: 1080, maxLength: 240, maxFileSize: 1000, bitrate: 4000 },
  youtube: { width: 1920, height: 1080, maxLength: 900, maxFileSize: 2000, bitrate: 8000 },
  twitter: { width: 1280, height: 720, maxLength: 140, maxFileSize: 512, bitrate: 5000 },
  linkedin: { width: 1280, height: 720, maxLength: 600, maxFileSize: 200, bitrate: 4000 },
};

const platformDimensions: Record<string, { width: number; height: number }> = {
  instagram: { width: 1080, height: 1080 },
  facebook: { width: 1080, height: 1080 },
  youtube: { width: 1280, height: 720 },
  twitter: { width: 1200, height: 675 },
  linkedin: { width: 1200, height: 627 },
};

function isVideoMedia(mediaUrl: string, mediaType?: string) {
  return (
    mediaType === 'video' ||
    mediaUrl.includes('.mp4') ||
    mediaUrl.includes('.mov') ||
    mediaUrl.includes('.webm') ||
    mediaUrl.includes('video')
  );
}

async function resolvePlatform(provided: string | undefined, contentId?: string): Promise<string> {
  if (provided) return provided;
  if (!contentId) return 'instagram';
  try {
    const { data } = await getServiceClient()
      .from('content')
      .select('platform')
      .eq('id', contentId)
      .single();
    return data?.platform || 'instagram';
  } catch (error) {
    logger.error('preprocess-media', 'Error fetching platform from database', error);
    return 'instagram';
  }
}

async function uploadProcessedFile(
  bytes: Buffer,
  contentId: string | undefined,
  folder: string,
  contentType: string,
  extension: string,
) {
  const filePath = `${folder}/${contentId || 'media'}-${Date.now()}.${extension}`;
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(filePath, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Failed to store processed file: ${error.message}`);
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
  if (!data.publicUrl) throw new Error('Failed to create public URL for processed file');
  return data.publicUrl;
}

async function persistPreprocessResult(
  contentId: string | undefined,
  result: {
    preprocessingStatus?: string;
    enhancedMediaUrl?: string;
    originalMediaUrl?: string;
    watermarkApplied?: boolean;
  },
) {
  if (!contentId) return;

  try {
    const supabase = getServiceClient();
    const { data: existing, error: findError } = await supabase
      .from('content')
      .select('status, scheduled_date')
      .eq('id', contentId)
      .maybeSingle();

    if (findError) throw findError;
    if (!existing) return;

    const status = result.preprocessingStatus || 'failed';
    const patch: Record<string, unknown> = {
      preprocessing_status: status,
    };

    if (status === 'completed') {
      if (result.enhancedMediaUrl) {
        patch.enhanced_media_url = result.enhancedMediaUrl;
        patch.media_url = result.enhancedMediaUrl;
      }
      if (result.originalMediaUrl) {
        patch.original_media_url = result.originalMediaUrl;
      }
      patch.template_frames_applied = false;
      patch.template_source_url = null;
      if (existing.status !== 'approved' && existing.status !== 'published') {
        patch.status = existing.scheduled_date ? 'scheduled' : 'pending';
      }
    }

    const { error: updateError } = await supabase.from('content').update(patch).eq('id', contentId);
    if (updateError) throw updateError;
    logger.info('preprocess-media', `Persisted preprocess ${status} for ${contentId}`);
  } catch (error) {
    logger.error('preprocess-media', `Failed to persist preprocess result for ${contentId}`, error);
  }
}

async function prepareImageForPlatform(imageBytes: Buffer, platform: string) {
  const dimensions = platformDimensions[platform] || platformDimensions.instagram;
  return sharp(imageBytes)
    .rotate()
    .resize(dimensions.width, dimensions.height, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
    })
    .normalize()
    .modulate({ brightness: 1.05, saturation: 1.12 })
    .sharpen({ sigma: 1.1, m1: 1.0, m2: 0.6 })
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function autoEnhance(
  mediaUrl: string,
  contentId: string | undefined,
  mediaType: 'image' | 'video',
) {
  try {
    const result = await enhanceMediaUntilComplete({
      mediaUrl,
      contentId,
      mediaType,
      scale: 2,
      faceEnhance: true,
      videoResolution: 'FHD',
      localOnly: true,
    });
    if (result.success && (result.enhancedMediaUrl || result.enhancedImageUrl)) {
      return {
        url: (result.enhancedMediaUrl || result.enhancedImageUrl) as string,
        model: result.model,
        provider: result.provider,
      };
    }
    logger.warn('preprocess-media', 'Quality pass did not return a file', result.error || result.status);
  } catch (error) {
    logger.warn('preprocess-media', 'Quality pass failed, keeping prepared media', error);
  }
  return null;
}

export async function preprocessMedia(input: PreprocessInput) {
  const { contentId } = input;
  const platform = await resolvePlatform(input.platform, contentId);

  logger.info('preprocess-media', 'Preparing media for social posting', {
    contentId,
    mediaType: input.mediaType,
    platform,
    mediaUrl: trimUrl(input.mediaUrl),
  });

  try {
    const result = await runPreprocess(input, platform);
    await persistPreprocessResult(contentId, result);
    return result;
  } catch (error) {
    await persistPreprocessResult(contentId, { preprocessingStatus: 'failed' });
    throw error;
  }
}

async function runPreprocess(input: PreprocessInput, platform: string) {
  const { mediaUrl, contentId, mediaType } = input;

  if (!mediaUrl) {
    return {
      error: 'mediaUrl is required',
      preprocessingStatus: 'failed',
      note: 'Pass a public media URL to preprocess.',
    };
  }

  if (isVideoMedia(mediaUrl, mediaType)) {
    const videoSpecs = platformVideoSpecs[platform] || platformVideoSpecs.instagram;
    const enhanced = await autoEnhance(mediaUrl, contentId, 'video');
    const finalUrl = enhanced?.url || mediaUrl;
    const processingNote = enhanced
      ? `Video quality improved for ${platform.toUpperCase()} (${videoSpecs.width}x${videoSpecs.height}). No logos or extras were added.`
      : `Video kept for ${platform.toUpperCase()} (${videoSpecs.width}x${videoSpecs.height}). No logos or extras were added.`;

    logger.info('preprocess-media', `Video ready for ${platform}`, {
      enhanced: Boolean(enhanced),
      model: enhanced?.model,
    });

    return {
      enhancedMediaUrl: finalUrl,
      originalMediaUrl: mediaUrl,
      preprocessingStatus: 'completed',
      success: true,
      enhanced: Boolean(enhanced),
      model: enhanced?.model,
      watermarkApplied: false,
      note: processingNote,
      videoSpecs,
      processed: true,
    };
  }

  const imageResponse = await fetch(mediaUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
  }

  const originalBytes = Buffer.from(await imageResponse.arrayBuffer());
  const preparedBytes = await prepareImageForPlatform(originalBytes, platform);
  const preparedUrl = await uploadProcessedFile(preparedBytes, contentId, 'processed', 'image/jpeg', 'jpg');

  logger.info('preprocess-media', `Image cropped and sharpened for ${platform}`, {
    bytes: preparedBytes.length,
    preparedUrl: trimUrl(preparedUrl),
  });

  const dimensions = platformDimensions[platform] || platformDimensions.instagram;
  const note = [
    `Image prepared for ${platform.toUpperCase()} at ${dimensions.width}x${dimensions.height}.`,
    'Local sharpening applied. No logos or extras were added.',
  ].join(' ');

  return {
    enhancedMediaUrl: preparedUrl,
    originalMediaUrl: mediaUrl,
    preprocessingStatus: 'completed',
    success: true,
    enhanced: false,
    watermarkApplied: false,
    note,
    processed: true,
  };
}
