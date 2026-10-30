import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from '../lib/env.js';
import { logger, trimUrl } from '../lib/logger.js';
import { getServiceClient } from '../lib/supabase.js';
import {
  chunkEntireVideo,
  concatVideos,
  cutVideo,
  enhanceVideoQuality,
  muxOriginalAudio,
  probeDurationSeconds,
  probeVideo,
  withTempDir,
} from '../lib/video-tools.js';
import { applyTemplateFrames } from './apply-template-frames.js';

const REPLICATE_API = 'https://api.replicate.com/v1';
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
const REPLICATE_IMAGE_MODEL = 'nightmareai/real-esrgan';
const REPLICATE_VIDEO_MODEL = 'lucataco/real-esrgan-video';
const DEFAULT_IMAGE_MODELS = [
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-image',
  'gemini-2.5-flash-image',
];
const DEFAULT_VIDEO_MODELS = [
  'gemini-omni-1.1-flash',
  'gemini-omni-1.1',
];

const IMAGE_ENHANCE_PROMPT = `Sharpen this image to crisp 2K quality.
Remove blur, softness, noise, and compression artifacts.
Increase fine detail, clarity, and natural color.
Keep the exact same subject, faces, text, logos, layout, and composition.
Do not add objects, filters, captions, logos, text, watermarks, or crop the scene.
Return only the restored photograph.`;

const STILL_ENHANCE_PROMPT = `Restore this intro/outro frame to sharp 2K quality.
Remove blur and compression. Keep every logo, word, color, and layout exactly the same.
Do not redesign, restyle, animate, or add anything.
Return only the sharpened frame.`;

const VIDEO_ENHANCE_PROMPT = `Sharpen this video and restore it to crisp 1080p. Remove blur and compression. Keep everything else the same.`;

type MediaType = 'image' | 'video';
type VideoResolution = 'FHD' | '2k' | '4k';

export interface EnhanceRequest {
  mediaUrl?: string;
  imageUrl?: string;
  mediaType?: MediaType;
  contentId?: string;
  predictionId?: string;
  scale?: number;
  faceEnhance?: boolean;
  videoResolution?: VideoResolution;
  keepTemplateFrames?: boolean;
  localOnly?: boolean;
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | string;
  output?: string | string[] | null;
  error?: string | null;
}

export interface EnhanceResult {
  status?: string;
  success?: boolean;
  error?: string;
  predictionId?: string;
  provider?: string;
  model?: string;
  enhancedMediaUrl?: string;
  enhancedImageUrl?: string;
  httpStatus?: number;
}

function detectMediaType(url: string, fallback?: MediaType): MediaType {
  if (fallback === 'image' || fallback === 'video') return fallback;
  const lower = url.toLowerCase();
  const videoHints = ['.mp4', '.mov', '.webm', '.avi', '.mkv', 'video'];
  return videoHints.some((hint) => lower.includes(hint)) ? 'video' : 'image';
}

function outputUrl(output: ReplicatePrediction['output']): string | null {
  if (!output) return null;
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  return null;
}

function guessMimeType(url: string, headerType?: string | null): string {
  if (headerType && headerType.startsWith('image/')) return headerType;
  const lower = url.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function fileExtension(contentType: string, mediaType: MediaType): string {
  if (mediaType === 'video') return 'mp4';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpg';
}

function base64ToBuffer(b64: string): Buffer {
  const cleaned = b64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  return Buffer.from(cleaned, 'base64');
}

async function storeEnhancedBytes(
  bytes: Buffer,
  contentId: string | undefined,
  mediaType: MediaType,
  contentType: string,
): Promise<string> {
  const ext = fileExtension(contentType, mediaType);
  const filePath = `enhanced/${contentId || 'media'}-${Date.now()}.${ext}`;
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from('content-media').upload(filePath, bytes, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to store enhanced file: ${error.message}`);
  }

  const { data } = supabase.storage.from('content-media').getPublicUrl(filePath);
  if (!data.publicUrl) {
    throw new Error('Failed to create public URL for enhanced file');
  }
  return data.publicUrl;
}

async function storeEnhancedFile(
  fileUrl: string,
  contentId: string | undefined,
  mediaType: MediaType,
): Promise<string> {
  const downloaded = await fetch(fileUrl);
  if (!downloaded.ok) {
    throw new Error(`Failed to download enhanced file (${downloaded.status})`);
  }

  const bytes = Buffer.from(await downloaded.arrayBuffer());
  const contentType =
    downloaded.headers.get('content-type') ||
    (mediaType === 'video' ? 'video/mp4' : guessMimeType(fileUrl));
  try {
    return await storeEnhancedBytes(bytes, contentId, mediaType, contentType);
  } catch (error) {
    logger.error('enhance-media', 'Storage upload failed, using model output URL', error);
    return fileUrl;
  }
}

function extractGeminiImage(data: Record<string, unknown>): { bytes: Buffer; mimeType: string } | null {
  const interaction = (data.interaction as Record<string, unknown> | undefined) || data;
  const outputImage = (interaction.output_image || data.output_image) as
    | { data?: string; mime_type?: string }
    | undefined;
  if (outputImage?.data) {
    return {
      bytes: base64ToBuffer(outputImage.data),
      mimeType: outputImage.mime_type || 'image/png',
    };
  }

  const outputs = (data.output || interaction.output) as Array<Record<string, unknown>> | undefined;
  const imageOutput = outputs?.find((part) => part?.type === 'image' && typeof part.data === 'string');
  if (imageOutput?.data) {
    return {
      bytes: base64ToBuffer(String(imageOutput.data)),
      mimeType: String(imageOutput.mime_type || 'image/png'),
    };
  }

  const parts =
    ((data.candidates as Array<Record<string, unknown>> | undefined)?.[0]?.content as
      | { parts?: Array<Record<string, unknown>> }
      | undefined)?.parts || [];
  for (const part of parts) {
    const inline = (part.inlineData || part.inline_data) as
      | { data?: string; mimeType?: string; mime_type?: string }
      | undefined;
    if (inline?.data) {
      return {
        bytes: base64ToBuffer(inline.data),
        mimeType: inline.mimeType || inline.mime_type || 'image/png',
      };
    }
  }

  return null;
}

function extractGeminiVideo(data: Record<string, unknown>): { bytes: Buffer; mimeType: string; uri?: string } | null {
  const interaction = (data.interaction as Record<string, unknown> | undefined) || data;
  const outputVideo = (interaction.output_video || data.output_video) as
    | { data?: string; mime_type?: string; uri?: string }
    | undefined;
  if (outputVideo?.data) {
    return {
      bytes: Buffer.from(outputVideo.data, 'base64'),
      mimeType: outputVideo.mime_type || 'video/mp4',
      uri: outputVideo.uri,
    };
  }
  if (outputVideo?.uri) {
    return { bytes: Buffer.alloc(0), mimeType: outputVideo.mime_type || 'video/mp4', uri: outputVideo.uri };
  }

  const walk = (node: unknown): { bytes: Buffer; mimeType: string; uri?: string } | null => {
    if (!node || typeof node !== 'object') return null;
    const part = node as Record<string, unknown>;
    if ((part.type === 'video' || part.mime_type === 'video/mp4') && typeof part.data === 'string') {
      return { bytes: Buffer.from(part.data, 'base64'), mimeType: String(part.mime_type || 'video/mp4'), uri: typeof part.uri === 'string' ? part.uri : undefined };
    }
    if ((part.type === 'video' || part.mime_type === 'video/mp4') && typeof part.uri === 'string') {
      return { bytes: Buffer.alloc(0), mimeType: String(part.mime_type || 'video/mp4'), uri: part.uri };
    }
    for (const value of Object.values(part)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = walk(item);
          if (found) return found;
        }
      } else if (value && typeof value === 'object') {
        const found = walk(value);
        if (found) return found;
      }
    }
    return null;
  };

  return walk(data);
}

function geminiImageModels(): string[] {
  const preferred = env.geminiImageModel || DEFAULT_IMAGE_MODELS[0];
  return [...new Set([preferred, ...DEFAULT_IMAGE_MODELS])];
}

function geminiVideoModels(): string[] {
  const preferred = env.geminiVideoModel || DEFAULT_VIDEO_MODELS[0];
  return [...new Set([preferred, ...DEFAULT_VIDEO_MODELS])];
}

function videoAspectRatio(width: number, height: number): '16:9' | '9:16' | undefined {
  const ratio = width / Math.max(1, height);
  if (ratio >= 1.3) return '16:9';
  if (ratio <= 0.8) return '9:16';
  return undefined;
}

function videoResolutionLabel(value?: VideoResolution): '720p' | '1080p' | '4k' {
  if (value === '4k') return '4k';
  return '1080p';
}

async function loadContentForEnhance(contentId: string) {
  const { data, error } = await getServiceClient()
    .from('content')
    .select('media_url, enhanced_media_url, original_media_url, template_source_url, template_frames_applied, media_type, intro_frame_url, outro_frame_url, intro_frame_duration, outro_frame_duration')
    .eq('id', contentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function resolveEnhanceSource(body: EnhanceRequest): Promise<{
  mediaUrl: string;
  mediaType: MediaType;
  rewrapIntroOutro: boolean;
}> {
  const requested = body.mediaUrl || body.imageUrl;
  if (!body.contentId) {
    if (!requested) {
      throw Object.assign(new Error('mediaUrl is required'), { httpStatus: 400 });
    }
    return {
      mediaUrl: requested,
      mediaType: detectMediaType(requested, body.mediaType),
      rewrapIntroOutro: false,
    };
  }

  const content = await loadContentForEnhance(body.contentId);
  const framed = Boolean(content?.template_frames_applied);
  const unwrapped = content?.template_source_url || null;
  const currentUrl = content?.enhanced_media_url || content?.media_url || requested || null;
  const mediaUrl = (framed && unwrapped) ? unwrapped : currentUrl;
  if (!mediaUrl) {
    throw Object.assign(new Error('mediaUrl is required'), { httpStatus: 400 });
  }

  if (!content?.original_media_url && currentUrl) {
    await getServiceClient()
      .from('content')
      .update({ original_media_url: currentUrl })
      .eq('id', body.contentId);
  }

  const rewrapIntroOutro = Boolean(content?.intro_frame_url || content?.outro_frame_url)
    && !(framed && !unwrapped);

  logger.info('enhance-media', 'Enhancing current video/image quality', {
    contentId: body.contentId,
    mediaUrl: trimUrl(mediaUrl),
    rewrapIntroOutro,
    fromUnwrappedClip: Boolean(framed && unwrapped),
  });

  return {
    mediaUrl,
    mediaType: detectMediaType(mediaUrl, body.mediaType || (content?.media_type === 'image' ? 'image' : 'video')),
    rewrapIntroOutro,
  };
}

async function persistEnhanceResult(
  contentId: string | undefined,
  enhancedUrl: string,
  extra: Record<string, unknown> = {},
) {
  if (!contentId) return;
  try {
    const { error } = await getServiceClient()
      .from('content')
      .update({
        enhanced_media_url: enhancedUrl,
        media_url: enhancedUrl,
        ...extra,
      })
      .eq('id', contentId);
    if (error) throw error;
  } catch (error) {
    logger.error('enhance-media', `Failed to persist enhanced media for ${contentId}`, error);
  }
}

async function uploadGeminiFile(apiKey: string, bytes: Buffer, mimeType: string, displayName: string) {
  const start = await fetch(`${GEMINI_API.replace('/v1beta', '')}/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });

  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!start.ok || !uploadUrl) {
    const data = await start.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Gemini file upload start failed (${start.status})`);
  }

  const finish = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(bytes.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: new Uint8Array(bytes),
  });
  const uploaded = await finish.json();
  if (!finish.ok) {
    throw new Error(uploaded?.error?.message || `Gemini file upload failed (${finish.status})`);
  }

  let file = uploaded.file || uploaded;
  for (let attempt = 0; attempt < 24; attempt++) {
    const state = String(file.state || '').toUpperCase();
    if (state === 'ACTIVE' || state === 'SUCCEEDED') return file;
    if (state === 'FAILED') throw new Error('Gemini failed to process the uploaded video');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const name = String(file.name || '').replace(/^models\//, '');
    const poll = await fetch(`${GEMINI_API}/${name}?key=${apiKey}`);
    const polled = await poll.json();
    if (!poll.ok) throw new Error(polled?.error?.message || 'Failed to poll Gemini file status');
    file = polled;
  }
  throw new Error('Timed out waiting for Gemini to process the uploaded video');
}

async function downloadGeminiFile(apiKey: string, uri: string): Promise<Buffer> {
  const fileId = uri.split('/').pop();
  const downloadUrl = uri.includes('http')
    ? `${uri}${uri.includes('?') ? '&' : '?'}alt=media&key=${apiKey}`
    : `${GEMINI_API}/files/${fileId}:download?key=${apiKey}`;
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    const fallback = await fetch(`${GEMINI_API}/files/${fileId}?alt=media&key=${apiKey}`);
    if (!fallback.ok) {
      throw new Error(`Failed to download Gemini video (${response.status})`);
    }
    return Buffer.from(await fallback.arrayBuffer());
  }
  return Buffer.from(await response.arrayBuffer());
}

async function enhanceImageWithInteractions(
  apiKey: string,
  model: string,
  mimeType: string,
  base64Image: string,
  prompt = IMAGE_ENHANCE_PROMPT,
): Promise<{ bytes: Buffer; mimeType: string; model: string }> {
  const response = await fetch(`${GEMINI_API}/interactions`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        { type: 'text', text: prompt },
        { type: 'image', mime_type: mimeType, data: base64Image },
      ],
      response_format: {
        type: 'image',
        mime_type: 'image/jpeg',
        image_size: '2K',
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Gemini ${model} failed (${response.status})`);
  }

  const image = extractGeminiImage(data);
  if (!image) {
    throw new Error(`Gemini ${model} did not return an enhanced image`);
  }
  return { ...image, model };
}

async function enhanceImageWithGenerateContent(
  apiKey: string,
  model: string,
  mimeType: string,
  base64Image: string,
  prompt = IMAGE_ENHANCE_PROMPT,
): Promise<{ bytes: Buffer; mimeType: string; model: string }> {
  const response = await fetch(`${GEMINI_API}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
      }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini ${model} failed (${response.status})`);
  }

  const image = extractGeminiImage(data);
  if (!image) {
    throw new Error(`Gemini ${model} did not return an enhanced image`);
  }
  return { ...image, model };
}

async function enhanceImageWithGemini(apiKey: string, mediaUrl: string, prompt = IMAGE_ENHANCE_PROMPT) {
  const imageResponse = await fetch(mediaUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download source image (${imageResponse.status})`);
  }

  const mimeType = guessMimeType(mediaUrl, imageResponse.headers.get('content-type'));
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  const base64Image = bytes.toString('base64');

  const errors: string[] = [];
  for (const model of geminiImageModels()) {
    const apis = model === 'gemini-2.5-flash-image'
      ? [enhanceImageWithGenerateContent, enhanceImageWithInteractions]
      : [enhanceImageWithInteractions, enhanceImageWithGenerateContent];

    for (const api of apis) {
      try {
        logger.info('enhance-media', `Trying Gemini image model ${model} via ${api.name}`);
        return await api(apiKey, model, mimeType, base64Image, prompt);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('enhance-media', `Gemini image model ${model} failed via ${api.name}`, message);
        errors.push(`${model}/${api.name}: ${message}`);
      }
    }
  }

  throw new Error(`Gemini image enhancement failed. ${errors.join(' | ')}`);
}

async function enhanceVideoClipWithGemini(
  apiKey: string,
  bytes: Buffer,
  mimeType: string,
  resolution?: VideoResolution,
  aspectRatio?: '16:9' | '9:16',
) {
  const uploaded = await uploadGeminiFile(apiKey, bytes, mimeType, `enhance-${Date.now()}.mp4`);
  if (!uploaded?.uri) {
    throw new Error('Gemini file upload did not return a video URI');
  }

  const input = [
    { type: 'video', uri: uploaded.uri },
    { type: 'text', text: VIDEO_ENHANCE_PROMPT },
  ];
  const responseFormat: Record<string, unknown> = {
    type: 'video',
    resolution: videoResolutionLabel(resolution),
    delivery: 'uri',
  };
  if (aspectRatio) responseFormat.aspect_ratio = aspectRatio;

  const errors: string[] = [];
  for (const model of geminiVideoModels()) {
    logger.info('enhance-media', `Enhancing video clip with ${model}`, {
      bytes: bytes.length,
      mimeType,
      resolution: videoResolutionLabel(resolution),
      aspectRatio,
    });
    try {
      const response = await fetch(`${GEMINI_API}/interactions`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input,
          response_format: responseFormat,
          generation_config: {
            video_config: { task: 'edit' },
          },
          background: false,
          store: false,
          stream: false,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || data?.message || `Gemini ${model} failed (${response.status})`);
      }
      const video = extractGeminiVideo(data);
      if (!video) {
        throw new Error(`Gemini ${model} did not return an enhanced video`);
      }
      const outputBytes = video.uri && video.bytes.length === 0
        ? await downloadGeminiFile(apiKey, video.uri)
        : video.bytes;
      if (!outputBytes.length) {
        throw new Error(`Gemini ${model} returned an empty video`);
      }
      return { bytes: outputBytes, mimeType: video.mimeType || 'video/mp4', model };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('enhance-media', `Gemini video model ${model} failed`, message);
      errors.push(`${model}: ${message}`);
    }
  }

  throw new Error(`Gemini video enhancement failed. ${errors.join(' | ')}`);
}

async function enhanceVideoWithGemini(apiKey: string, mediaUrl: string, resolution?: VideoResolution) {
  const videoResponse = await fetch(mediaUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download source video (${videoResponse.status})`);
  }

  const mimeType = videoResponse.headers.get('content-type') || 'video/mp4';
  const sourceBytes = Buffer.from(await videoResponse.arrayBuffer());

  return withTempDir(async (dir) => {
    const sourcePath = path.join(dir, 'source.mp4');
    await writeFile(sourcePath, sourceBytes);
    const probe = await probeVideo(sourcePath);
    const duration = probe.duration || await probeDurationSeconds(sourcePath);
    const ranges = chunkEntireVideo(duration);
    const aspectRatio = videoAspectRatio(probe.width, probe.height);
    let usedModel = geminiVideoModels()[0];

    logger.info('enhance-media', `Gemini restoring full video (${duration.toFixed(1)}s) in ${ranges.length} clip(s)`, {
      duration,
      clips: ranges.length,
      width: probe.width,
      height: probe.height,
      aspectRatio,
    });

    const enhancedPaths: string[] = [];
    for (const [index, range] of ranges.entries()) {
      const clipPath = path.join(dir, `clip-${index}.mp4`);
      const geminiPath = path.join(dir, `gemini-${index}.mp4`);
      const enhancedPath = path.join(dir, `enhanced-${index}.mp4`);
      await cutVideo(sourcePath, clipPath, range.start, range.duration);
      const clipBytes = await readFile(clipPath);
      const enhanced = await enhanceVideoClipWithGemini(apiKey, clipBytes, mimeType, resolution, aspectRatio);
      usedModel = enhanced.model;
      await writeFile(geminiPath, enhanced.bytes);
      if (probe.hasAudio) {
        try {
          await muxOriginalAudio(geminiPath, clipPath, enhancedPath);
          enhancedPaths.push(enhancedPath);
        } catch (error) {
          logger.warn('enhance-media', 'Could not mux original audio onto Gemini clip', error);
          enhancedPaths.push(geminiPath);
        }
      } else {
        enhancedPaths.push(geminiPath);
      }
    }

    const outputPath = path.join(dir, 'enhanced.mp4');
    if (enhancedPaths.length === 1) {
      return { bytes: await readFile(enhancedPaths[0]), mimeType: 'video/mp4', model: usedModel };
    }

    await concatVideos(enhancedPaths, outputPath, probe.hasAudio);
    return { bytes: await readFile(outputPath), mimeType: 'video/mp4', model: usedModel };
  });
}

async function enhanceStillFromUrl(url: string, contentId: string, label: string) {
  if (!env.geminiApiKey) return url;
  try {
    logger.info('enhance-media', `Sharpening ${label} frame with Gemini`, { url: trimUrl(url) });
    const enhanced = await enhanceImageWithGemini(env.geminiApiKey, url, STILL_ENHANCE_PROMPT);
    const sharpened = await sharp(enhanced.bytes)
      .rotate()
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
      .sharpen({ sigma: 1.05, m1: 1.0, m2: 0.35 })
      .png()
      .toBuffer();
    return await storeEnhancedBytes(sharpened, contentId, 'image', 'image/png');
  } catch (error) {
    logger.warn('enhance-media', `Gemini ${label} frame restore failed, keeping current frame`, error);
    return url;
  }
}

async function finishVideoWithIntroOutro(contentId: string | undefined, enhancedMainUrl: string) {
  if (!contentId) return enhancedMainUrl;
  const content = await loadContentForEnhance(contentId);
  const introUrl = content?.intro_frame_url
    ? await enhanceStillFromUrl(content.intro_frame_url, contentId, 'intro')
    : null;
  const outroUrl = content?.outro_frame_url
    ? await enhanceStillFromUrl(content.outro_frame_url, contentId, 'outro')
    : null;

  await persistEnhanceResult(contentId, enhancedMainUrl, {
    template_source_url: enhancedMainUrl,
    template_frames_applied: false,
    ...(introUrl ? { intro_frame_url: introUrl } : {}),
    ...(outroUrl ? { outro_frame_url: outroUrl } : {}),
  });

  if (!introUrl && !outroUrl) return enhancedMainUrl;

  logger.info('enhance-media', 'Rebuilding intro and outro onto the sharpened main clip', {
    contentId,
    intro: Boolean(introUrl),
    outro: Boolean(outroUrl),
  });
  const wrapped = await applyTemplateFrames({
    contentId,
    introFrameUrl: introUrl,
    outroFrameUrl: outroUrl,
    introDuration: content?.intro_frame_duration,
    outroDuration: content?.outro_frame_duration,
    sourceUrl: enhancedMainUrl,
  });
  return wrapped.mediaUrl || enhancedMainUrl;
}

async function createPrediction(
  token: string,
  model: string,
  input: Record<string, unknown>,
  waitSeconds = 0,
): Promise<ReplicatePrediction> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (waitSeconds > 0) {
    headers.Prefer = `wait=${waitSeconds}`;
  }

  const response = await fetch(`${REPLICATE_API}/models/${model}/predictions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.detail || data?.error || `Replicate error (${response.status})`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  return data as ReplicatePrediction;
}

async function getPrediction(token: string, predictionId: string): Promise<ReplicatePrediction> {
  const response = await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.detail || data?.error || `Failed to read prediction (${response.status})`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  return data as ReplicatePrediction;
}

async function enhanceWithReplicate(
  token: string,
  body: EnhanceRequest,
  mediaUrl: string | undefined,
): Promise<EnhanceResult> {
  let prediction: ReplicatePrediction;

  if (body.predictionId) {
    prediction = await getPrediction(token, body.predictionId);
  } else {
    if (!mediaUrl) {
      return { error: 'mediaUrl is required', httpStatus: 400 };
    }

    const mediaType = detectMediaType(mediaUrl, body.mediaType);
    const input = mediaType === 'video'
      ? {
          video_path: mediaUrl,
          resolution: body.videoResolution || 'FHD',
          model: 'RealESRGAN_x4plus',
        }
      : {
          image: mediaUrl,
          scale: Math.min(Math.max(body.scale ?? 2, 2), 4),
          face_enhance: body.faceEnhance !== false,
        };

    logger.info('enhance-media', 'Creating Replicate prediction', { mediaType, model: mediaType === 'video' ? REPLICATE_VIDEO_MODEL : REPLICATE_IMAGE_MODEL });
    prediction = await createPrediction(
      token,
      mediaType === 'video' ? REPLICATE_VIDEO_MODEL : REPLICATE_IMAGE_MODEL,
      input,
      mediaType === 'video' ? 0 : 55,
    );
  }

  if (prediction.status === 'failed' || prediction.status === 'canceled') {
    return {
      status: 'failed',
      predictionId: prediction.id,
      error: prediction.error || 'Quality enhancement failed',
      httpStatus: 500,
    };
  }

  if (prediction.status !== 'succeeded') {
    return {
      status: 'processing',
      predictionId: prediction.id,
      provider: 'replicate',
      model: body.mediaType === 'video' ? REPLICATE_VIDEO_MODEL : REPLICATE_IMAGE_MODEL,
    };
  }

  const enhancedUrl = outputUrl(prediction.output);
  if (!enhancedUrl) {
    return {
      status: 'failed',
      predictionId: prediction.id,
      error: 'Model finished but did not return a file',
      httpStatus: 500,
    };
  }

  const resolvedType = detectMediaType(enhancedUrl, body.mediaType);
  const storedUrl = await storeEnhancedFile(enhancedUrl, body.contentId, resolvedType);
  await persistEnhanceResult(body.contentId, storedUrl);
  const usedModel = resolvedType === 'video' ? REPLICATE_VIDEO_MODEL : REPLICATE_IMAGE_MODEL;

  return {
    status: 'completed',
    success: true,
    enhancedMediaUrl: storedUrl,
    enhancedImageUrl: storedUrl,
    provider: 'replicate',
    model: usedModel,
  };
}

async function enhanceVideoLocally(mediaUrl: string) {
  const videoResponse = await fetch(mediaUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download source video (${videoResponse.status})`);
  }
  const sourceBytes = Buffer.from(await videoResponse.arrayBuffer());
  return withTempDir(async (dir) => {
    const sourcePath = path.join(dir, 'source.mp4');
    const outputPath = path.join(dir, 'enhanced.mp4');
    await writeFile(sourcePath, sourceBytes);
    await enhanceVideoQuality(sourcePath, outputPath);
    return {
      bytes: await readFile(outputPath),
      mimeType: 'video/mp4',
      model: 'ffmpeg-sharpen',
    };
  });
}

async function enhanceImageLocally(mediaUrl: string) {
  const imageResponse = await fetch(mediaUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download source image (${imageResponse.status})`);
  }
  const sourceBytes = Buffer.from(await imageResponse.arrayBuffer());
  const bytes = await sharp(sourceBytes)
    .rotate()
    .normalize()
    .modulate({ brightness: 1.04, saturation: 1.08 })
    .sharpen({ sigma: 1.15, m1: 1.0, m2: 0.5 })
    .jpeg({ quality: 93, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
  return { bytes, mimeType: 'image/jpeg', model: 'local-sharpen' };
}

async function persistFinalVideo(
  contentId: string | undefined,
  storedUrl: string,
  rewrapIntroOutro: boolean,
  provider: string,
  model: string,
): Promise<EnhanceResult> {
  const finalUrl = rewrapIntroOutro
    ? await finishVideoWithIntroOutro(contentId, storedUrl)
    : storedUrl;
  if (!rewrapIntroOutro) {
    await persistEnhanceResult(contentId, finalUrl);
  }
  return {
    status: 'completed',
    success: true,
    enhancedMediaUrl: finalUrl,
    enhancedImageUrl: finalUrl,
    provider,
    model,
  };
}

export async function enhanceMedia(body: EnhanceRequest): Promise<EnhanceResult> {
  const replicateToken = env.replicateApiToken;
  const geminiKey = env.geminiApiKey;

  if (body.predictionId) {
    if (!replicateToken) {
      return { error: 'No running enhancement job to resume', httpStatus: 400 };
    }
    return enhanceWithReplicate(replicateToken, body, body.mediaUrl || body.imageUrl);
  }

  let mediaUrl: string;
  let mediaType: MediaType;
  let rewrapIntroOutro = false;
  try {
    const resolved = await resolveEnhanceSource(body);
    mediaUrl = resolved.mediaUrl;
    mediaType = resolved.mediaType;
    rewrapIntroOutro = resolved.rewrapIntroOutro;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'mediaUrl is required';
    const httpStatus = error && typeof error === 'object' && 'httpStatus' in error
      ? Number((error as { httpStatus?: number }).httpStatus) || 400
      : 400;
    return { error: message, httpStatus };
  }

  const request = { ...body, mediaUrl, mediaType, keepTemplateFrames: false };

  logger.info('enhance-media', 'Quality restore request', {
    mediaUrl: trimUrl(mediaUrl),
    mediaType,
    contentId: body.contentId,
    localOnly: Boolean(body.localOnly),
    hasGemini: Boolean(geminiKey),
    hasReplicate: Boolean(replicateToken),
    rewrapIntroOutro,
  });

  if (mediaType === 'video') {
    if (!body.localOnly && geminiKey) {
      try {
        const enhanced = await enhanceVideoWithGemini(geminiKey, mediaUrl, body.videoResolution || 'FHD');
        const storedUrl = await storeEnhancedBytes(enhanced.bytes, body.contentId, 'video', enhanced.mimeType);
        return await persistFinalVideo(body.contentId, storedUrl, rewrapIntroOutro, 'gemini', enhanced.model);
      } catch (error) {
        logger.warn('enhance-media', 'Gemini video restore failed, trying fallback', error);
      }
    }

    if (!body.localOnly && replicateToken) {
      try {
        const result = await enhanceWithReplicate(replicateToken, request, mediaUrl);
        if (result.success && result.enhancedMediaUrl) {
          const finalUrl = rewrapIntroOutro
            ? await finishVideoWithIntroOutro(body.contentId, result.enhancedMediaUrl)
            : result.enhancedMediaUrl;
          return { ...result, enhancedMediaUrl: finalUrl, enhancedImageUrl: finalUrl };
        }
        if (result.status === 'processing') return result;
      } catch (error) {
        logger.warn('enhance-media', 'Replicate video upscale failed, using local sharpening', error);
      }
    }

    const enhanced = await enhanceVideoLocally(mediaUrl);
    const storedUrl = await storeEnhancedBytes(enhanced.bytes, body.contentId, 'video', enhanced.mimeType);
    return await persistFinalVideo(body.contentId, storedUrl, rewrapIntroOutro, 'ffmpeg', enhanced.model);
  }

  if (!body.localOnly && geminiKey) {
    try {
      const enhanced = await enhanceImageWithGemini(geminiKey, mediaUrl);
      const storedUrl = await storeEnhancedBytes(enhanced.bytes, body.contentId, 'image', enhanced.mimeType);
      await persistEnhanceResult(body.contentId, storedUrl);
      return {
        status: 'completed',
        success: true,
        enhancedMediaUrl: storedUrl,
        enhancedImageUrl: storedUrl,
        provider: 'gemini',
        model: enhanced.model,
      };
    } catch (error) {
      logger.warn('enhance-media', 'Gemini photo restore failed, trying fallback', error);
    }
  }

  if (!body.localOnly && replicateToken) {
    try {
      return await enhanceWithReplicate(replicateToken, request, mediaUrl);
    } catch (error) {
      logger.warn('enhance-media', 'Replicate photo upscale failed, using local sharpening', error);
    }
  }

  const enhanced = await enhanceImageLocally(mediaUrl);
  const storedUrl = await storeEnhancedBytes(enhanced.bytes, body.contentId, 'image', enhanced.mimeType);
  await persistEnhanceResult(body.contentId, storedUrl);
  return {
    status: 'completed',
    success: true,
    enhancedMediaUrl: storedUrl,
    enhancedImageUrl: storedUrl,
    provider: 'sharp',
    model: enhanced.model,
  };
}

export async function enhanceMediaUntilComplete(
  body: EnhanceRequest,
  maxWaitMs = 180000,
): Promise<EnhanceResult> {
  let result = await enhanceMedia(body);
  const started = Date.now();

  while (result.status === 'processing' && result.predictionId && Date.now() - started < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    result = await enhanceMedia({ ...body, predictionId: result.predictionId });
  }

  return result;
}
