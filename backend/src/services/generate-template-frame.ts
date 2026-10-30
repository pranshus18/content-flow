import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from '../lib/env.js';
import { logger, trimUrl } from '../lib/logger.js';
import { getServiceClient } from '../lib/supabase.js';
import { httpError } from '../lib/http.js';
import { extractLastVideoFrame, extractVideoFrame, probeVideo, withTempDir } from '../lib/video-tools.js';
import { applyLogoOverlaysToImage, type BrandingOverlayRow } from './branded-overlay.js';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
const MEDIA_BUCKET = 'content-media';
const DEFAULT_IMAGE_MODELS = [
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-image',
  'gemini-2.5-flash-image',
];

export type TemplatePosition = 'intro' | 'outro';
export type TemplateSaveTo = 'content' | 'branding' | 'none';

export interface GenerateTemplateFrameInput {
  position?: TemplatePosition;
  contentId?: string;
  prompt?: string;
  useAi?: boolean;
  platform?: string;
  title?: string;
  headline?: string;
  saveTo?: TemplateSaveTo;
  branding?: BrandingOverlayRow | null;
}

export type BrandingRow = {
  id?: string;
  company_logo_url?: string | null;
  vendor_logo_url?: string | null;
  company_website_url?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  company_tagline?: string | null;
  intro_headline?: string | null;
  intro_features?: string | null;
  executor_name?: string | null;
  cta_text?: string | null;
  follow_cta_text?: string | null;
};

const platformSizes: Record<string, { width: number; height: number }> = {
  instagram: { width: 1080, height: 1080 },
  facebook: { width: 1080, height: 1080 },
  youtube: { width: 1920, height: 1080 },
};

const videoFallbackSizes: Record<string, { width: number; height: number }> = {
  instagram: { width: 1080, height: 1920 },
  facebook: { width: 1080, height: 1920 },
  youtube: { width: 1920, height: 1080 },
};

function evenDim(value: number) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function canvasForFrame(width: number, height: number, maxEdge = 1920) {
  let w = evenDim(width);
  let h = evenDim(height);
  const edge = Math.max(w, h);
  if (edge > maxEdge) {
    const scale = maxEdge / edge;
    w = evenDim(w * scale);
    h = evenDim(h * scale);
  }
  return { width: w, height: h };
}

export function orientationOf(size: { width: number; height: number }) {
  if (size.height > size.width * 1.05) return 'portrait';
  if (size.width > size.height * 1.05) return 'landscape';
  return 'square';
}

export function originalVideoUrl(content: {
  original_media_url?: string | null;
  template_source_url?: string | null;
  media_url?: string | null;
  enhanced_media_url?: string | null;
  template_frames_applied?: boolean | null;
} | null) {
  if (!content) return null;
  if (content.original_media_url) return content.original_media_url;
  if (content.template_source_url) return content.template_source_url;
  if (!content.template_frames_applied) {
    return content.media_url || content.enhanced_media_url || null;
  }
  return null;
}

export function frameFitsVideo(
  frame: { width: number; height: number },
  video: { width: number; height: number },
) {
  if (frame.width < 8 || frame.height < 8) return false;
  if (orientationOf(frame) !== orientationOf(video)) return false;
  const frameAspect = frame.width / frame.height;
  const videoAspect = video.width / video.height;
  return Math.abs(frameAspect - videoAspect) / videoAspect <= 0.08;
}

function fallbackFrameSize(platform: string, isVideo: boolean) {
  if (isVideo) return videoFallbackSizes[platform] || videoFallbackSizes.youtube;
  return platformSizes[platform] || platformSizes.youtube;
}

function extensionFromUrl(url: string) {
  const ext = (url.split('?')[0] || '').split('.').pop()?.toLowerCase();
  if (ext && ['mp4', 'mov', 'webm', 'm4v'].includes(ext)) return `.${ext}`;
  return '.mp4';
}

export type TemplateVariant = 'intro' | 'enquire' | 'partner';

function geminiImageModels() {
  const preferred = env.geminiImageModel || DEFAULT_IMAGE_MODELS[0];
  return [...new Set([preferred, ...DEFAULT_IMAGE_MODELS])];
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapText(text: string, maxChars: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines) {
      current = '';
      break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function base64ToBuffer(b64: string): Buffer {
  const cleaned = b64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  return Buffer.from(cleaned, 'base64');
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

async function loadBranding(): Promise<BrandingRow | null> {
  const { data, error } = await getServiceClient()
    .from('branding_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadContent(contentId?: string) {
  if (!contentId) return null;
  const { data, error } = await getServiceClient()
    .from('content')
    .select('id, title, description, admin_description, platform, media_url, media_type, enhanced_media_url, original_media_url, template_source_url, template_frames_applied')
    .eq('id', contentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function pickVideoUrl(content: Awaited<ReturnType<typeof loadContent>>) {
  return originalVideoUrl(content);
}

async function inspectSourceVideo(url: string, position: TemplatePosition) {
  return withTempDir(async (dir) => {
    const dest = path.join(dir, `source${extensionFromUrl(url)}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to read source video (${response.status})`);
    await writeFile(dest, Buffer.from(await response.arrayBuffer()));
    const probe = await probeVideo(dest);
    const size = canvasForFrame(probe.width, probe.height);
    const heroPath = path.join(dir, 'hero.png');
    if (position === 'outro') {
      await extractLastVideoFrame(dest, heroPath);
    } else {
      await extractVideoFrame(dest, heroPath, Math.min(0.4, Math.max(0, (probe.duration || 1) * 0.08)));
    }
    return { size, hero: await readFile(heroPath), probe };
  });
}

export async function uploadTemplateFrame(bytes: Buffer, folder: string, contentType: string) {
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const filePath = `${folder}/frame-${Date.now()}.${ext}`;
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(filePath, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Failed to store template frame: ${error.message}`);
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
  if (!data.publicUrl) throw new Error('Failed to create public URL for template frame');
  return data.publicUrl;
}

function parseFeatures(raw?: string | null) {
  if (!raw?.trim()) return [];
  return raw
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

async function loadImageBuffer(url?: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function fitImage(bytes: Buffer, width: number, height: number) {
  return sharp(bytes)
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
}

async function fittedLogo(url: string | null | undefined, maxW: number, maxH: number) {
  const bytes = await loadImageBuffer(url);
  if (!bytes) return null;
  const logo = await sharp(bytes)
    .rotate()
    .resize({ width: Math.round(maxW), height: Math.round(maxH), fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const meta = await sharp(logo).metadata();
  return { bytes: logo, width: meta.width || 0, height: meta.height || 0 };
}

export async function renderTemplateStill(input: {
  position: TemplatePosition;
  width: number;
  height: number;
  title: string;
  headline?: string;
  branding: BrandingRow | null;
  heroImage?: Buffer | null;
  variant?: TemplateVariant;
}) {
  const variant: TemplateVariant = input.variant
    || (input.position === 'intro' ? 'intro' : 'enquire');
  if (variant === 'intro') return renderIntroStill(input);
  if (variant === 'partner') return renderPartnerStill(input);
  return renderEnquireStill(input);
}

async function renderIntroStill(input: {
  width: number;
  height: number;
  title: string;
  headline?: string;
  branding: BrandingRow | null;
  heroImage?: Buffer | null;
}) {
  const { width, height, title, headline, branding, heroImage } = input;
  if (height > width * 1.05) return renderPortraitIntroStill(input);
  const leftW = Math.round(width * 0.42);
  const rightW = width - leftW;
  const company = branding?.company_name?.trim() || '';
  const tagline = branding?.company_tagline?.trim() || '';
  const hasLogo = Boolean(branding?.company_logo_url);
  const displayHeadline = (headline || branding?.intro_headline || title || company || 'Crafted with Care. Designed for Life.').trim();
  const punctLines = displayHeadline.split(/(?<=\.)\s+/).map((line) => line.trim()).filter(Boolean);
  const titleFont = Math.round(leftW * (displayHeadline.length > 28 || punctLines.length > 1 ? 0.085 : 0.1));
  const headlineLines = punctLines.length > 1 && punctLines.length <= 3
    ? punctLines
    : wrapText(
      displayHeadline,
      Math.max(12, Math.floor((leftW - Math.round(leftW * 0.16)) / (titleFont * 0.46))),
      3,
    );
  const features = parseFeatures(branding?.intro_features);
  const executor = branding?.executor_name?.trim() || '';
  const tagFont = Math.round(leftW * 0.032);
  const featureFont = Math.round(leftW * 0.028);
  const pad = Math.round(leftW * 0.08);
  const headlineY = Math.round(height * (hasLogo ? 0.42 : 0.36));
  const headlineBlock = headlineLines
    .map((line, index) => {
      const y = headlineY + index * Math.round(titleFont * 1.15);
      return `<text x="${pad}" y="${y}" fill="#f4f1ea" font-size="${titleFont}" font-family="Georgia, 'Times New Roman', serif" font-weight="700">${escapeXml(line)}</text>`;
    })
    .join('');

  const featureWidth = features.length ? Math.round((leftW - pad * 2) / features.length) : 0;
  const featureY = Math.round(height * 0.72);
  const featureBlock = features
    .map((feature, index) => {
      const x = pad + index * featureWidth + Math.round(featureWidth / 2);
      const words = wrapText(feature, 12, 2);
      const labels = words
        .map((word, line) => `<text x="${x}" y="${featureY + 28 + line * 16}" fill="#dbe4f0" font-size="${featureFont}" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${escapeXml(word)}</text>`)
        .join('');
      return `<circle cx="${x}" cy="${featureY}" r="14" fill="none" stroke="#c9a227" stroke-width="2"/><text x="${x}" y="${featureY + 5}" fill="#c9a227" font-size="14" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">●</text>${labels}`;
    })
    .join('');

  const vendorLogo = await fittedLogo(branding?.vendor_logo_url, leftW * 0.18, height * 0.08);
  const executorTextX = pad + 18 + (vendorLogo ? vendorLogo.width + 14 : 0);
  const executorBlock = executor || vendorLogo
    ? `<rect x="${pad}" y="${height - Math.round(height * 0.16)}" width="${leftW - pad * 2}" height="${Math.round(height * 0.1)}" rx="10" fill="#10233d"/>
       <text x="${executorTextX}" y="${height - Math.round(height * 0.1)}" fill="#c9a227" font-size="${Math.round(leftW * 0.032)}" font-family="Arial, Helvetica, sans-serif">Executed by</text>
       <text x="${executorTextX}" y="${height - Math.round(height * 0.07)}" fill="#ffffff" font-size="${Math.round(leftW * 0.042)}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(executor || 'Vendor')}</text>`
    : '';

  const leftSvg = `
    <svg width="${leftW}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#071427"/>
      ${company && !hasLogo ? `<text x="${pad}" y="${Math.round(height * 0.2)}" fill="#ffffff" font-size="${Math.round(leftW * 0.07)}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(company)}</text>` : ''}
      ${tagline ? `<text x="${pad}" y="${Math.round(height * (hasLogo ? 0.3 : 0.26))}" fill="#9db0c9" font-size="${tagFont}" font-family="Arial, Helvetica, sans-serif">${escapeXml(tagline)}</text>` : ''}
      ${headlineBlock}
      ${featureBlock}
      ${executorBlock}
    </svg>
  `;

  const composites: sharp.OverlayOptions[] = [{ input: Buffer.from(leftSvg), left: 0, top: 0 }];
  if (heroImage) {
    composites.push({ input: await fitImage(heroImage, rightW, height), left: leftW, top: 0 });
  } else {
    const placeholder = Buffer.from(`
      <svg width="${rightW}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1f2937"/>
            <stop offset="100%" stop-color="#4b5563"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero)"/>
      </svg>
    `);
    composites.push({ input: placeholder, left: leftW, top: 0 });
  }

  const platformLogo = await fittedLogo(branding?.company_logo_url, leftW * 0.55, height * 0.16);
  if (platformLogo) {
    composites.push({ input: platformLogo.bytes, left: pad, top: Math.round(height * 0.07) });
  }
  if (vendorLogo) {
    composites.push({
      input: vendorLogo.bytes,
      left: pad + 14,
      top: height - Math.round(height * 0.145) + Math.round((Math.round(height * 0.1) - vendorLogo.height) / 2),
    });
  }

  return sharp({
    create: { width, height, channels: 4, background: { r: 7, g: 20, b: 39, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function renderPortraitIntroStill(input: {
  width: number;
  height: number;
  title: string;
  headline?: string;
  branding: BrandingRow | null;
  heroImage?: Buffer | null;
}) {
  const { width, height, title, headline, branding, heroImage } = input;
  const panelH = Math.round(height * 0.42);
  const heroH = height - panelH;
  const company = branding?.company_name?.trim() || '';
  const tagline = branding?.company_tagline?.trim() || '';
  const hasLogo = Boolean(branding?.company_logo_url);
  const displayHeadline = (headline || branding?.intro_headline || title || company || 'Crafted with Care. Designed for Life.').trim();
  const punctLines = displayHeadline.split(/(?<=\.)\s+/).map((line) => line.trim()).filter(Boolean);
  const titleFont = Math.round(width * (displayHeadline.length > 28 || punctLines.length > 1 ? 0.055 : 0.065));
  const headlineLines = punctLines.length > 1 && punctLines.length <= 3
    ? punctLines
    : wrapText(
      displayHeadline,
      Math.max(12, Math.floor((width - Math.round(width * 0.16)) / (titleFont * 0.46))),
      3,
    );
  const features = parseFeatures(branding?.intro_features);
  const executor = branding?.executor_name?.trim() || '';
  const pad = Math.round(width * 0.07);
  const tagFont = Math.round(width * 0.028);
  const featureFont = Math.round(width * 0.024);
  const headlineY = Math.round(panelH * (hasLogo ? 0.42 : 0.34));
  const headlineBlock = headlineLines
    .map((line, index) => {
      const y = headlineY + index * Math.round(titleFont * 1.15);
      return `<text x="${pad}" y="${y}" fill="#f4f1ea" font-size="${titleFont}" font-family="Georgia, 'Times New Roman', serif" font-weight="700">${escapeXml(line)}</text>`;
    })
    .join('');
  const featureWidth = features.length ? Math.round((width - pad * 2) / features.length) : 0;
  const featureY = Math.round(panelH * 0.72);
  const featureBlock = features
    .map((feature, index) => {
      const x = pad + index * featureWidth + Math.round(featureWidth / 2);
      const words = wrapText(feature, 12, 2);
      const labels = words
        .map((word, line) => `<text x="${x}" y="${featureY + 28 + line * 16}" fill="#dbe4f0" font-size="${featureFont}" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${escapeXml(word)}</text>`)
        .join('');
      return `<circle cx="${x}" cy="${featureY}" r="14" fill="none" stroke="#c9a227" stroke-width="2"/><text x="${x}" y="${featureY + 5}" fill="#c9a227" font-size="14" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">●</text>${labels}`;
    })
    .join('');
  const vendorLogo = await fittedLogo(branding?.vendor_logo_url, width * 0.16, panelH * 0.16);
  const executorTextX = pad + 18 + (vendorLogo ? vendorLogo.width + 14 : 0);
  const executorBlock = executor || vendorLogo
    ? `<rect x="${pad}" y="${panelH - Math.round(panelH * 0.22)}" width="${width - pad * 2}" height="${Math.round(panelH * 0.16)}" rx="10" fill="#10233d"/>
       <text x="${executorTextX}" y="${panelH - Math.round(panelH * 0.14)}" fill="#c9a227" font-size="${Math.round(width * 0.026)}" font-family="Arial, Helvetica, sans-serif">Executed by</text>
       <text x="${executorTextX}" y="${panelH - Math.round(panelH * 0.08)}" fill="#ffffff" font-size="${Math.round(width * 0.034)}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(executor || 'Vendor')}</text>`
    : '';

  const panelSvg = `
    <svg width="${width}" height="${panelH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#071427"/>
      ${company && !hasLogo ? `<text x="${pad}" y="${Math.round(panelH * 0.18)}" fill="#ffffff" font-size="${Math.round(width * 0.05)}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(company)}</text>` : ''}
      ${tagline ? `<text x="${pad}" y="${Math.round(panelH * (hasLogo ? 0.28 : 0.24))}" fill="#9db0c9" font-size="${tagFont}" font-family="Arial, Helvetica, sans-serif">${escapeXml(tagline)}</text>` : ''}
      ${headlineBlock}
      ${featureBlock}
      ${executorBlock}
    </svg>
  `;

  const heroBytes = heroImage
    ? await fitImage(heroImage, width, heroH)
    : Buffer.from(`
      <svg width="${width}" height="${heroH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1f2937"/>
            <stop offset="100%" stop-color="#4b5563"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero)"/>
      </svg>
    `);

  const composites: sharp.OverlayOptions[] = [
    { input: heroBytes, left: 0, top: 0 },
    { input: Buffer.from(panelSvg), left: 0, top: heroH },
  ];
  const platformLogo = await fittedLogo(branding?.company_logo_url, width * 0.42, panelH * 0.18);
  if (platformLogo) {
    composites.push({ input: platformLogo.bytes, left: pad, top: heroH + Math.round(panelH * 0.08) });
  }
  if (vendorLogo) {
    composites.push({
      input: vendorLogo.bytes,
      left: pad + 14,
      top: height - Math.round(panelH * 0.2) + Math.round((Math.round(panelH * 0.16) - vendorLogo.height) / 2),
    });
  }

  return sharp({
    create: { width, height, channels: 4, background: { r: 7, g: 20, b: 39, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function blurredHero(width: number, height: number, heroImage?: Buffer | null) {
  if (heroImage) {
    return sharp(heroImage)
      .rotate()
      .resize(width, height, { fit: 'cover', position: 'centre' })
      .blur(22)
      .modulate({ brightness: 0.55, saturation: 0.85 })
      .png()
      .toBuffer();
  }
  return sharp(Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1c1917"/>
          <stop offset="100%" stop-color="#44403c"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
    </svg>
  `)).png().toBuffer();
}

function pill(x: number, y: number, w: number, h: number, label: string, fontSize: number) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.round(h / 2)}" fill="rgba(20,20,20,0.55)" stroke="rgba(255,255,255,0.35)" stroke-width="3"/>
    <text x="${x + w / 2}" y="${y + Math.round(h * 0.66)}" fill="#ffffff" font-size="${fontSize}" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${escapeXml(label)}</text>`;
}

async function renderEnquireStill(input: {
  width: number;
  height: number;
  branding: BrandingRow | null;
  heroImage?: Buffer | null;
}) {
  const { width, height, branding, heroImage } = input;
  const cta = branding?.cta_text?.trim() || 'Enquire now';
  const phone = branding?.company_phone?.trim() || '';
  const website = (branding?.company_website_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const contact = phone ? `Contact: ${phone}` : website;
  const bg = await blurredHero(width, height, heroImage);
  const portrait = height > width;
  const ctaW = Math.round(width * (portrait ? 0.78 : 0.32));
  const contactW = Math.round(width * Math.min(portrait ? 0.88 : 0.72, (portrait ? 0.62 : 0.28) + contact.length * 0.012));
  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${pill(Math.round((width - ctaW) / 2), Math.round(height * (portrait ? 0.56 : 0.48)), ctaW, Math.round(height * (portrait ? 0.07 : 0.1)), cta, Math.round((portrait ? width : height) * 0.045))}
      ${contact ? pill(Math.round((width - contactW) / 2), Math.round(height * (portrait ? 0.66 : 0.62)), contactW, Math.round(height * (portrait ? 0.08 : 0.12)), contact, Math.round((portrait ? width : height) * 0.038)) : ''}
    </svg>
  `);

  const composites: sharp.OverlayOptions[] = [{ input: overlay, left: 0, top: 0 }];
  const platformLogo = await fittedLogo(branding?.company_logo_url, width * 0.55, height * 0.22);
  const vendorLogo = await fittedLogo(branding?.vendor_logo_url, width * 0.22, height * 0.1);
  if (platformLogo) {
    composites.push({
      input: platformLogo.bytes,
      left: Math.round((width - platformLogo.width) / 2),
      top: Math.round(height * 0.18),
    });
  } else if (branding?.company_name) {
    const name = Buffer.from(`
      <svg width="${width}" height="${Math.round(height * 0.2)}" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="70%" fill="#ffffff" font-size="${Math.round(width * 0.07)}" font-family="Arial, Helvetica, sans-serif" font-weight="700" text-anchor="middle">${escapeXml(branding.company_name)}</text>
      </svg>
    `);
    composites.push({ input: name, left: 0, top: Math.round(height * 0.18) });
  }
  if (vendorLogo) {
    composites.push({
      input: vendorLogo.bytes,
      left: Math.round(width * 0.05),
      top: Math.round(height * 0.05),
    });
  }

  return sharp(bg).composite(composites).png().toBuffer();
}

async function renderPartnerStill(input: {
  width: number;
  height: number;
  branding: BrandingRow | null;
  heroImage?: Buffer | null;
}) {
  const { width, height, branding, heroImage } = input;
  const executor = branding?.executor_name?.trim() || '';
  const company = branding?.company_name?.trim() || '';
  const bg = await blurredHero(width, height, heroImage);
  const vendorLogo = await fittedLogo(branding?.vendor_logo_url, width * 0.38, height * 0.14);
  const platformLogo = await fittedLogo(branding?.company_logo_url, width * 0.42, height * 0.16);
  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="50%" y="${Math.round(height * 0.18)}" fill="#ffffff" font-size="${Math.round(height * 0.045)}" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">Executed by</text>
      ${executor ? `<text x="50%" y="${Math.round(height * 0.26)}" fill="#ffffff" font-size="${Math.round(height * 0.06)}" font-family="Arial, Helvetica, sans-serif" font-weight="700" text-anchor="middle">${escapeXml(executor)}</text>` : ''}
      <text x="50%" y="${Math.round(height * 0.58)}" fill="#ffffff" font-size="${Math.round(height * 0.045)}" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">In Association with</text>
      ${company && !platformLogo ? `<text x="50%" y="${Math.round(height * 0.78)}" fill="#ffffff" font-size="${Math.round(height * 0.07)}" font-family="Arial, Helvetica, sans-serif" font-weight="700" text-anchor="middle">${escapeXml(company)}</text>` : ''}
    </svg>
  `);
  const composites: sharp.OverlayOptions[] = [{ input: overlay, left: 0, top: 0 }];
  if (vendorLogo) {
    composites.push({
      input: vendorLogo.bytes,
      left: Math.round((width - vendorLogo.width) / 2),
      top: Math.round(height * 0.3),
    });
  }
  if (platformLogo) {
    composites.push({
      input: platformLogo.bytes,
      left: Math.round((width - platformLogo.width) / 2),
      top: Math.round(height * 0.64),
    });
  }
  return sharp(bg).composite(composites).png().toBuffer();
}

async function generateWithGemini(prompt: string, references: Buffer[]) {
  if (!env.geminiApiKey) {
    throw httpError(400, 'GEMINI_API_KEY is missing from backend/.env. Add the key and restart the backend.');
  }

  const images = references.filter(Boolean);
  if (!images.length) throw new Error('No reference images available for AI generation');
  const errors: string[] = [];

  for (const model of geminiImageModels()) {
    try {
      logger.info('generate-template-frame', `Trying Gemini image model ${model} via interactions`);
      const response = await fetch(`${GEMINI_API}/interactions`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': env.geminiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: [
            { type: 'text', text: prompt },
            ...images.map((bytes) => ({
              type: 'image',
              mime_type: 'image/png',
              data: bytes.toString('base64'),
            })),
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
      if (image) return { ...image, model };
      throw new Error(`Gemini ${model} did not return an image`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('generate-template-frame', `Gemini interactions ${model} failed`, message);
      errors.push(`${model}/interactions: ${message}`);
    }

    try {
      logger.info('generate-template-frame', `Trying Gemini image model ${model} via generateContent`);
      const response = await fetch(`${GEMINI_API}/models/${model}:generateContent?key=${env.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              ...images.map((bytes) => ({
                inline_data: { mime_type: 'image/png', data: bytes.toString('base64') },
              })),
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
      if (image) return { ...image, model };
      throw new Error(`Gemini ${model} did not return an image`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('generate-template-frame', `Gemini generateContent ${model} failed`, message);
      errors.push(`${model}/generateContent: ${message}`);
    }
  }

  throw new Error(`AI template generation failed. ${errors[0] || 'No image returned.'}`);
}

function brandingLines(title: string, branding: BrandingRow | null, description?: string | null) {
  const company = branding?.company_name?.trim();
  return [
    company ? `Brand / platform: ${company}` : '',
    branding?.company_tagline?.trim() ? `Tagline: ${branding.company_tagline.trim()}` : '',
    branding?.executor_name?.trim() ? `Vendor / executed by: ${branding.executor_name.trim()}` : '',
    `Video title: ${title}`,
    description?.trim() ? `Video context: ${description.trim().slice(0, 240)}` : '',
    branding?.company_website_url ? `Website: ${branding.company_website_url}` : '',
    branding?.company_phone ? `Phone: ${branding.company_phone}` : '',
    branding?.cta_text?.trim() ? `End-card CTA: ${branding.cta_text.trim()}` : '',
    branding?.follow_cta_text?.trim() ? `Follow CTA: ${branding.follow_cta_text.trim()}` : '',
  ].filter(Boolean).join('\n');
}

function buildAiPrompt(
  position: TemplatePosition,
  title: string,
  branding: BrandingRow | null,
  userPrompt?: string,
  description?: string | null,
  size?: { width: number; height: number },
  hasOriginalShot?: boolean,
) {
  const role = position === 'intro' ? 'INTRO card that plays BEFORE the video' : 'OUTRO card that plays AFTER the video';
  const brief = userPrompt?.trim();
  const details = brandingLines(title, branding, description);
  const canvas = size ? `${size.width}x${size.height}` : '1920x1080';
  const orientation = size ? orientationOf(size) : 'landscape';
  const fillRules = `CRITICAL FRAME RULES:
- This video is ${orientation}. Compose for exactly ${canvas} and keep that exact aspect ratio.
- Do not generate a landscape title card for a portrait video, and do not generate a portrait card for a landscape video.
- Keep every word, logo, button, and contact line fully inside the frame. Nothing may be cropped or overflow the edges.
- Leave a safe margin of about 6% on every side so type and logos are not flush against the edge.
- Do not add black bars, letterboxing, pillarboxing, or empty background around a smaller card.
- Do not render a mockup, device frame, rounded floating card, photo-in-a-window, or player UI.
- Do not draw YouTube/Instagram chrome, play buttons, or a small preview sitting on a dark screen.
- This image is the actual video frame, not a picture of a title card.`;
  const originalShotRules = hasOriginalShot
    ? `ORIGINAL VIDEO REFERENCE:
- The first attached photo is a real still from the user's original video. Match its scene, lighting, colors, and subject.
- The ${position} must look like a natural continuation of that footage, not a separate slide or poster.
- Keep the same room / product / people / environment from the original still.
- The second attached image is only a layout/branding guide if present.`
    : `Use the attached branding layout as the visual guide.`;

  if (brief) {
    return `Create one finished social-media ${role} at exactly ${canvas}.
The user's creative brief is the PRIMARY instruction. Follow it closely and interpret it for this ${position}.

USER PROMPT:
${brief}

${originalShotRules}
Include these brand details only where they fit the brief and do not fight the prompt.
Keep any provided platform/vendor logos clearly visible when they are present in the reference.
${details}

${fillRules}
Cinematic lighting, large readable type for mobile.
Do not add extra captions, fake social UI, or watermarks besides the brand logos.
Return only the finished ${position} image.`;
  }

  const fallbackLook = position === 'intro'
    ? 'full-bleed split-screen intro: branded navy panel on the left with platform logo, lifestyle/product photo on the right, vendor mark in the executed-by bar, both panels reaching the frame edges'
    : 'full-bleed end card with platform logo, vendor logo, Enquire now / Follow us, and contact details over a blurred photo that fills the frame';

  return `Create a polished social-media ${role} at exactly ${canvas}.
Look: ${fallbackLook}.
${originalShotRules}
Use the reference images for layout, logos, and wording, then make it cinematic and high-end.
${details}
${fillRules}
No extra captions, no fake social icons, no watermarks besides the brand logos.
Return only the finished title-card image.`;
}

async function persistFrame(saveTo: TemplateSaveTo, position: TemplatePosition, frameUrl: string, contentId?: string) {
  const supabase = getServiceClient();
  const patch = position === 'intro' ? { intro_frame_url: frameUrl } : { outro_frame_url: frameUrl };

  if (saveTo === 'content') {
    if (!contentId) throw httpError(400, 'contentId is required to save this frame on content');
    const { error } = await supabase.from('content').update(patch as never).eq('id', contentId);
    if (error) throw error;
  }

  if (saveTo === 'branding') {
    const existing = await loadBranding();
    if (!existing) {
      const { error } = await supabase.from('branding_settings').insert(patch as never);
      if (error) throw error;
      return;
    }
    if (!existing.id) throw new Error('Branding settings are missing an id');
    const { error } = await supabase
      .from('branding_settings')
      .update(patch as never)
      .eq('id', existing.id);
    if (error) throw error;
  }
}

export async function generateTemplateFrame(input: GenerateTemplateFrameInput) {
  const position: TemplatePosition = input.position === 'outro' ? 'outro' : 'intro';
  const saveTo: TemplateSaveTo = input.saveTo === 'content' || input.saveTo === 'branding' ? input.saveTo : 'none';
  const useAi = input.useAi !== false;
  const content = await loadContent(input.contentId);
  const storedBranding = await loadBranding();
  const branding: BrandingRow | null = {
    ...(storedBranding || {}),
    company_logo_url: input.branding?.company_logo_url || null,
    vendor_logo_url: input.branding?.vendor_logo_url || null,
    company_website_url: input.branding?.company_website_url || null,
  };
  const platform = (input.platform || content?.platform || 'youtube').toLowerCase();
  const isVideo = /video/i.test(content?.media_type || '')
    || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(content?.media_url || content?.enhanced_media_url || content?.original_media_url || '');
  const title = (input.title || content?.title || branding?.company_name || 'Featured video').trim();
  const headline = input.headline?.trim() || branding?.intro_headline || title;

  let size = fallbackFrameSize(platform, isVideo);
  let heroImage: Buffer | null = null;
  const sourceUrl = pickVideoUrl(content);
  if (isVideo && sourceUrl) {
    try {
      const inspected = await inspectSourceVideo(sourceUrl, position);
      size = inspected.size;
      heroImage = inspected.hero;
      logger.info('generate-template-frame', 'Matched frame canvas to source video', {
        contentId: input.contentId,
        width: size.width,
        height: size.height,
        orientation: orientationOf(size),
        sourceDuration: inspected.probe.duration,
      });
    } catch (error) {
      logger.warn('generate-template-frame', 'Could not read source video size, using fallback canvas', error);
    }
  }

  logger.info('generate-template-frame', `Generating ${position} template`, {
    contentId: input.contentId,
    platform,
    useAi,
    saveTo,
    width: size.width,
    height: size.height,
    orientation: orientationOf(size),
    title: title.slice(0, 80),
    hasUserPrompt: Boolean(input.prompt?.trim()),
  });

  const brandedBytes = await renderTemplateStill({
    position,
    width: size.width,
    height: size.height,
    title,
    headline,
    branding,
    heroImage,
    variant: position === 'intro' ? 'intro' : 'enquire',
  });

  let frameBytes = brandedBytes;
  let contentType = 'image/png';
  let provider = 'branding-template';
  let model: string | undefined;

  if (useAi) {
    const prompt = buildAiPrompt(
      position,
      title,
      branding,
      input.prompt,
      content?.description,
      size,
      Boolean(heroImage),
    );
    const references = heroImage ? [heroImage, brandedBytes] : [brandedBytes];
    const ai = await generateWithGemini(prompt, references);
    frameBytes = ai.bytes;
    contentType = ai.mimeType.startsWith('image/') ? ai.mimeType : 'image/png';
    provider = 'gemini';
    model = ai.model;
  }

  const overlayBranding: BrandingOverlayRow = {
    company_logo_url: input.branding?.company_logo_url || null,
    vendor_logo_url: input.branding?.vendor_logo_url || null,
    company_website_url: input.branding?.company_website_url || null,
    watermark_position: input.branding?.watermark_position || 'bottom-right',
    watermark_enabled: true,
    follow_cta_enabled: false,
  };
  frameBytes = await applyLogoOverlaysToImage(
    frameBytes,
    overlayBranding,
    size.width,
    size.height,
    heroImage,
  );
  contentType = 'image/png';

  const frameUrl = await uploadTemplateFrame(frameBytes, `templates/${position}`, contentType);
  await persistFrame(saveTo, position, frameUrl, input.contentId);

  logger.info('generate-template-frame', `${position} frame ready`, {
    frameUrl: trimUrl(frameUrl),
    provider,
    model,
  });

  return {
    success: true,
    position,
    frameUrl,
    provider,
    model,
    usedAi: useAi,
  };
}
