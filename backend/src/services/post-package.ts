import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { getServiceClient } from '../lib/supabase.js';
import { httpError } from '../lib/http.js';
import { env } from '../lib/env.js';

const PLATFORM_SPECS: Record<string, {
  titleMax: number;
  captionMax: number;
  width: number;
  height: number;
  aspect: string;
  notes: string[];
}> = {
  instagram: {
    titleMax: 0,
    captionMax: 2200,
    width: 1080,
    height: 1080,
    aspect: '1:1 feed, 9:16 Reels',
    notes: [
      'Upload the downloaded video or image in the Instagram app.',
      'Paste the caption below. Hashtags travel with the caption.',
      'Feed posts work best at 1080×1080. Reels work best at 1080×1920.',
    ],
  },
  facebook: {
    titleMax: 0,
    captionMax: 63206,
    width: 1280,
    height: 720,
    aspect: '16:9 or 1:1',
    notes: [
      'Upload the downloaded file to your Facebook Page or profile.',
      'Paste the caption as the post description.',
      'Videos work well at 1280×720 or 1080×1080.',
    ],
  },
  youtube: {
    titleMax: 100,
    captionMax: 5000,
    width: 1920,
    height: 1080,
    aspect: '16:9',
    notes: [
      'Upload the downloaded video in YouTube Studio.',
      'Use the title field for the video title and the caption as the description.',
      'Recommended size is 1920×1080.',
    ],
  },
};

export type PostPackage = {
  contentId: string;
  title: string;
  platform: string;
  mediaType: 'video' | 'image';
  mediaUrl: string | null;
  caption: string;
  captionWithoutBranding: string;
  hashtags: string[];
  websiteUrl: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  originalDescription: string | null;
  adminNotes: string | null;
  downloadFileName: string;
  characterCounts: { title: number; caption: number };
  platformLimits: { titleMax: number; captionMax: number };
  recommendedSize: { width: number; height: number; aspect: string };
  youtubePrivacy: string | null;
  postingNotes: string[];
  processing: boolean;
  ready: { hasMedia: boolean; hasCaption: boolean };
};

function isVideo(mediaType: string | null, url: string | null) {
  if (mediaType === 'video') return true;
  if (!url) return false;
  return /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(url) || url.toLowerCase().includes('video');
}

function slugTitle(title: string) {
  const slug = String(title || 'content')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'content';
}

function extensionFrom(url: string | null, mediaType: string | null, contentType?: string | null) {
  const fromUrl = String(url || '').split('?')[0].split('.').pop()?.toLowerCase() || '';
  if (fromUrl && /^[a-z0-9]{2,5}$/.test(fromUrl)) return fromUrl;
  const type = String(contentType || '').toLowerCase();
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('webm')) return 'webm';
  if (type.includes('quicktime') || type.includes('mov')) return 'mov';
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  return isVideo(mediaType, url) ? 'mp4' : 'jpg';
}

function extractHashtags(text: string) {
  const matches = String(text || '').match(/#[A-Za-z0-9_]+/g) || [];
  return [...new Set(matches)];
}

function brandingFooter(
  platform: string,
  logoUrl?: string | null,
  websiteUrl?: string | null,
) {
  if (!logoUrl && !websiteUrl) return '';
  let footer = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  if (platform === 'youtube') {
    if (logoUrl) footer += `\n![Logo](${logoUrl})\n`;
    if (websiteUrl) footer += `\n🌐 **Visit our website:** ${websiteUrl}\n`;
  } else if (platform === 'instagram' || platform === 'facebook') {
    if (logoUrl) footer += `\n📸 Logo: ${logoUrl}\n`;
    if (websiteUrl) footer += `\n🌐 Visit us: ${websiteUrl}\n`;
  } else {
    if (logoUrl) footer += `\nLogo: ${logoUrl}\n`;
    if (websiteUrl) footer += `\n🌐 Visit our website: ${websiteUrl}\n`;
  }
  footer += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  return footer;
}

export function downloadFileName(title: string, platform: string, ext: string) {
  return `${platform || 'post'}-${slugTitle(title)}.${ext}`;
}

export async function buildPostPackage(contentId: string, overrides?: {
  caption?: string;
  platform?: string;
}): Promise<PostPackage> {
  const supabase = getServiceClient();
  const { data: content, error } = await supabase
    .from('content')
    .select('*')
    .eq('id', contentId)
    .maybeSingle();
  if (error) throw error;
  if (!content) throw httpError(404, 'Content not found');

  const { data: branding } = await supabase
    .from('branding_settings')
    .select('company_logo_url, company_website_url, company_name')
    .maybeSingle();

  const platform = String(overrides?.platform || content.platform || 'instagram').toLowerCase();
  const mediaUrl = content.enhanced_media_url || content.media_url || null;
  const mediaType = isVideo(content.media_type, mediaUrl) ? 'video' : 'image';
  const captionWithoutBranding = String(
    overrides?.caption ?? content.admin_description ?? '',
  ).trim();
  const websiteUrl = branding?.company_website_url || content.watermark_website_url || null;
  const logoUrl = branding?.company_logo_url || content.watermark_logo_url || null;
  const caption = captionWithoutBranding
    ? captionWithoutBranding + brandingFooter(platform, logoUrl, websiteUrl)
    : '';
  const specs = PLATFORM_SPECS[platform] || PLATFORM_SPECS.instagram;
  const ext = extensionFrom(mediaUrl, content.media_type);

  return {
    contentId,
    title: String(content.title || 'Untitled'),
    platform,
    mediaType,
    mediaUrl,
    caption,
    captionWithoutBranding,
    hashtags: extractHashtags(caption),
    websiteUrl,
    companyName: branding?.company_name || null,
    companyLogoUrl: logoUrl,
    originalDescription: content.description || null,
    adminNotes: content.admin_notes || null,
    downloadFileName: downloadFileName(content.title || 'content', platform, ext),
    characterCounts: {
      title: String(content.title || '').length,
      caption: caption.length,
    },
    platformLimits: {
      titleMax: specs.titleMax,
      captionMax: specs.captionMax,
    },
    recommendedSize: {
      width: specs.width,
      height: specs.height,
      aspect: specs.aspect,
    },
    youtubePrivacy: platform === 'youtube' ? (env.youtubeDefaultPrivacyStatus || 'unlisted') : null,
    postingNotes: specs.notes,
    processing: content.preprocessing_status === 'pending',
    ready: {
      hasMedia: Boolean(mediaUrl),
      hasCaption: Boolean(captionWithoutBranding),
    },
  };
}

export function formatPostDetailsText(pkg: PostPackage) {
  const lines = [
    `Platform: ${pkg.platform}`,
    `Title: ${pkg.title}`,
    pkg.mediaType === 'video' ? 'Type: Video' : 'Type: Image',
    `Recommended size: ${pkg.recommendedSize.width}x${pkg.recommendedSize.height} (${pkg.recommendedSize.aspect})`,
    pkg.websiteUrl ? `Website: ${pkg.websiteUrl}` : '',
    pkg.companyName ? `Company: ${pkg.companyName}` : '',
    pkg.youtubePrivacy ? `YouTube privacy: ${pkg.youtubePrivacy}` : '',
    pkg.hashtags.length ? `Hashtags: ${pkg.hashtags.join(' ')}` : '',
    '',
    'Caption to paste:',
    pkg.caption || '(no caption yet)',
    '',
    'How to post:',
    ...pkg.postingNotes.map((note) => `- ${note}`),
  ];
  return lines.filter((line) => line !== '').join('\n');
}

export async function streamContentMedia(contentId: string, res: Response) {
  const pkg = await buildPostPackage(contentId);
  if (!pkg.mediaUrl) throw httpError(400, 'This content has no media to download yet.');
  if (pkg.processing) throw httpError(409, 'Media is still processing. Try again in a moment.');

  const upstream = await fetch(pkg.mediaUrl);
  if (!upstream.ok) {
    throw httpError(502, `Could not fetch the finished media (HTTP ${upstream.status}).`);
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const ext = extensionFrom(pkg.mediaUrl, pkg.mediaType, contentType);
  const fileName = downloadFileName(pkg.title, pkg.platform, ext);
  const length = upstream.headers.get('content-length');

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  if (length) res.setHeader('Content-Length', length);
  res.setHeader('Cache-Control', 'no-store');

  if (!upstream.body) {
    res.send(Buffer.from(await upstream.arrayBuffer()));
    return;
  }

  const nodeStream = Readable.fromWeb(upstream.body as NodeReadableStream);
  try {
    await pipeline(nodeStream, res);
  } catch (error) {
    if (res.headersSent) return;
    throw error;
  }
}
