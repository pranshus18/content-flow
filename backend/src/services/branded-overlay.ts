import sharp from 'sharp';
import { logger } from '../lib/logger.js';

export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-center';

export type BrandingOverlayRow = {
  company_logo_url?: string | null;
  vendor_logo_url?: string | null;
  company_name?: string | null;
  executor_name?: string | null;
  company_website_url?: string | null;
  company_phone?: string | null;
  cta_text?: string | null;
  follow_cta_enabled?: boolean | null;
  follow_cta_text?: string | null;
  follow_cta_start_seconds?: number | string | null;
  follow_cta_duration?: number | string | null;
  watermark_enabled?: boolean | null;
  watermark_position?: string | null;
};

export type PreparedOverlay = {
  kind: 'platform' | 'vendor' | 'cta';
  bytes: Buffer;
  width: number;
  height: number;
  x: number;
  y: number;
  enable?: { start: number; end: number };
};

function even(value: number) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function isTrueBlack(r: number, g: number, b: number) {
  return r <= 8 && g <= 8 && b <= 8;
}

async function cropLetterbox(bytes: Buffer) {
  const { data, info } = await sharp(bytes)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixel = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    return isTrueBlack(data[i], data[i + 1], data[i + 2]);
  };
  const rowBlack = (y: number) => {
    let dark = 0;
    for (let x = 0; x < width; x += 1) {
      if (pixel(x, y)) dark += 1;
    }
    return dark / width >= 0.99;
  };
  const colBlack = (x: number) => {
    let dark = 0;
    for (let y = 0; y < height; y += 1) {
      if (pixel(x, y)) dark += 1;
    }
    return dark / height >= 0.99;
  };

  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;
  const maxTrimY = Math.floor(height * 0.35);
  const maxTrimX = Math.floor(width * 0.35);

  while (top < maxTrimY && rowBlack(top)) top += 1;
  while (bottom > height - 1 - maxTrimY && rowBlack(bottom)) bottom -= 1;
  while (left < maxTrimX && colBlack(left)) left += 1;
  while (right > width - 1 - maxTrimX && colBlack(right)) right -= 1;

  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  if (cropW < 80 || cropH < 80) return bytes;
  if (cropW >= width * 0.96 && cropH >= height * 0.96) return bytes;

  return sharp(bytes)
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toBuffer();
}

async function sampleBackground(bytes: Buffer) {
  const { data, info } = await sharp(bytes)
    .resize(48, 48, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const take = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  };
  for (let x = 0; x < width; x += 1) {
    take(x, 0);
    take(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    take(0, y);
    take(width - 1, y);
  }
  return {
    r: Math.round(r / Math.max(1, count)),
    g: Math.round(g / Math.max(1, count)),
    b: Math.round(b / Math.max(1, count)),
  };
}

export async function normalizeFrameToSize(
  bytes: Buffer,
  width: number,
  height: number,
  plate?: Buffer | null,
) {
  const canvasW = even(width);
  const canvasH = even(height);
  const flattened = await sharp(bytes)
    .rotate()
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .png()
    .toBuffer();
  const cropped = await cropLetterbox(flattened);
  const croppedMeta = await sharp(cropped).metadata();
  const srcW = croppedMeta.width || canvasW;
  const srcH = croppedMeta.height || canvasH;
  const sameAspect = Math.abs(srcW / srcH - canvasW / canvasH) / (canvasW / canvasH) <= 0.04;
  const innerW = sameAspect ? canvasW : even(Math.round(canvasW * 0.92));
  const innerH = sameAspect ? canvasH : even(Math.round(canvasH * 0.92));
  const card = await sharp(cropped)
    .ensureAlpha()
    .resize(innerW, innerH, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  const base = plate
    ? await sharp(plate)
      .rotate()
      .resize(canvasW, canvasH, { fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer()
    : await sharp({
      create: {
        width: canvasW,
        height: canvasH,
        channels: 3,
        background: await sampleBackground(cropped),
      },
    })
      .png()
      .toBuffer();

  return sharp(base)
    .composite([{
      input: card,
      left: Math.round((canvasW - innerW) / 2),
      top: Math.round((canvasH - innerH) / 2),
    }])
    .png()
    .toBuffer();
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function asPosition(value?: string | null): OverlayPosition {
  switch (value) {
    case 'top-left':
    case 'top-right':
    case 'bottom-left':
    case 'bottom-right':
    case 'bottom-center':
      return value;
    default:
      return 'bottom-right';
  }
}

function oppositePosition(position: OverlayPosition): OverlayPosition {
  switch (position) {
    case 'top-left':
      return 'top-right';
    case 'top-right':
      return 'top-left';
    case 'bottom-left':
      return 'bottom-right';
    case 'bottom-center':
      return 'top-right';
    case 'bottom-right':
    default:
      return 'bottom-left';
  }
}

function coordsFor(
  position: OverlayPosition,
  canvasW: number,
  canvasH: number,
  overlayW: number,
  overlayH: number,
  margin: number,
) {
  const xRight = canvasW - overlayW - margin;
  const yBottom = canvasH - overlayH - margin;
  const xCenter = Math.round((canvasW - overlayW) / 2);
  switch (position) {
    case 'top-left':
      return { x: margin, y: margin };
    case 'top-right':
      return { x: xRight, y: margin };
    case 'bottom-left':
      return { x: margin, y: yBottom };
    case 'bottom-center':
      return { x: xCenter, y: yBottom };
    case 'bottom-right':
    default:
      return { x: xRight, y: yBottom };
  }
}

function clampPos(x: number, y: number, overlayW: number, overlayH: number, canvasW: number, canvasH: number) {
  return {
    x: Math.max(0, Math.min(Math.round(x), Math.max(0, canvasW - overlayW))),
    y: Math.max(0, Math.min(Math.round(y), Math.max(0, canvasH - overlayH))),
  };
}

export async function loadImageBuffer(url?: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    logger.warn('branded-overlay', 'Failed to download branding image', error);
    return null;
  }
}

async function renderLogoBadge(logoBytes: Buffer, maxW: number, maxH: number) {
  const innerW = even(Math.max(24, maxW - 20));
  const innerH = even(Math.max(24, maxH - 20));
  const fitted = await sharp(logoBytes)
    .rotate()
    .resize({ width: innerW, height: innerH, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const meta = await sharp(fitted).metadata();
  const width = even((meta.width || innerW) + 20);
  const height = even((meta.height || innerH) + 20);
  const radius = Math.round(Math.min(width, height) * 0.18);
  const background = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="${radius}" fill="rgba(7,20,39,0.62)"/>
    </svg>
  `);
  const bytes = await sharp(background)
    .composite([{ input: fitted, gravity: 'centre' }])
    .png()
    .toBuffer();
  return { bytes, width, height };
}

async function renderCtaBanner(text: string, subtitle: string | null, canvasWidth: number) {
  const title = text.trim() || 'Follow us';
  const font = Math.max(22, Math.round(canvasWidth * 0.034));
  const subFont = Math.max(14, Math.round(font * 0.58));
  const padX = Math.round(font * 1.35);
  const padY = Math.round(font * 0.62);
  const titleW = Math.round(title.length * font * 0.56);
  const subW = subtitle ? Math.round(subtitle.length * subFont * 0.52) : 0;
  const width = even(Math.min(canvasWidth * 0.78, Math.max(canvasWidth * 0.3, Math.max(titleW, subW) + padX * 2)));
  const height = even(padY * 2 + font + (subtitle ? subFont + 8 : 0));
  const radius = Math.round(height / 2);
  const subtitleBlock = subtitle
    ? `<text x="50%" y="${padY + font + subFont}" fill="#dbe4f0" font-size="${subFont}" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${escapeXml(subtitle)}</text>`
    : '';
  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="${radius}" fill="rgba(7,20,39,0.78)" stroke="#c9a227" stroke-width="3"/>
      <text x="50%" y="${padY + font * 0.78}" fill="#ffffff" font-size="${font}" font-family="Arial, Helvetica, sans-serif" font-weight="700" text-anchor="middle">${escapeXml(title)}</text>
      ${subtitleBlock}
    </svg>
  `);
  const bytes = await sharp(svg).png().toBuffer();
  return { bytes, width, height };
}

export function followCtaWindow(duration: number, branding: BrandingOverlayRow | null) {
  if (!branding || branding.follow_cta_enabled === false) return null;
  if (!Number.isFinite(duration) || duration < 1.6) return null;

  const hold = Math.min(12, Math.max(1.5, Number(branding.follow_cta_duration) || 4));
  const rawStart = branding.follow_cta_start_seconds;
  const requested = rawStart === null || rawStart === undefined || String(rawStart).trim() === ''
    ? Number.NaN
    : Number(rawStart);
  let start = Number.isFinite(requested) ? requested : duration * 0.55;
  start = Math.max(0, Math.min(start, Math.max(0, duration - 1.2)));
  const end = Math.min(duration - 0.05, start + Math.min(hold, Math.max(1.2, duration - start)));
  if (end - start < 0.8) return null;
  return { start, end };
}

export function followCtaCopy(branding: BrandingOverlayRow | null) {
  return branding?.follow_cta_text?.trim() || 'Follow us';
}

export function imageCtaCopy(branding: BrandingOverlayRow | null) {
  return branding?.follow_cta_text?.trim() || branding?.cta_text?.trim() || 'Follow us';
}

function imageCtaSubtitle(branding: BrandingOverlayRow | null) {
  const phone = branding?.company_phone?.trim();
  if (phone) return phone;
  const website = (branding?.company_website_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return website || null;
}

export function shouldApplyVideoOverlays(branding: BrandingOverlayRow | null) {
  if (!branding) return false;
  const platformLogo = branding.watermark_enabled !== false && Boolean(branding.company_logo_url);
  const vendorLogo = Boolean(branding.vendor_logo_url);
  const followCta = branding.follow_cta_enabled === true;
  return platformLogo || vendorLogo || followCta;
}

export function hasLogoOverlays(branding: BrandingOverlayRow | null) {
  if (!branding) return false;
  return (branding.watermark_enabled !== false && Boolean(branding.company_logo_url))
    || Boolean(branding.vendor_logo_url);
}

export async function compositeLogoOverlays(
  imageBytes: Buffer,
  branding: BrandingOverlayRow | null,
  width: number,
  height: number,
) {
  const overlays = await prepareVideoOverlays({
    branding: branding ? { ...branding, follow_cta_enabled: false } : null,
    width,
    height,
    duration: 10,
  });
  if (!overlays.length) return imageBytes;

  return sharp(imageBytes)
    .composite(overlays.map((overlay) => ({
      input: overlay.bytes,
      left: overlay.x,
      top: overlay.y,
    })))
    .png()
    .toBuffer();
}

export async function applyLogoOverlaysToImage(
  imageBytes: Buffer,
  branding: BrandingOverlayRow | null,
  width?: number,
  height?: number,
  plate?: Buffer | null,
) {
  const meta = await sharp(imageBytes).rotate().metadata();
  const canvasW = even(width || meta.width || 1080);
  const canvasH = even(height || meta.height || 1080);
  const fitted = await normalizeFrameToSize(imageBytes, canvasW, canvasH, plate);
  return compositeLogoOverlays(fitted, branding, canvasW, canvasH);
}

export async function prepareVideoOverlays(input: {
  branding: BrandingOverlayRow | null;
  width: number;
  height: number;
  duration: number;
}): Promise<PreparedOverlay[]> {
  const { branding, width, height, duration } = input;
  if (!branding) return [];

  const margin = Math.max(16, Math.round(Math.min(width, height) * 0.035));
  const logoMaxW = even(width * 0.16);
  const logoMaxH = even(height * 0.14);
  const overlays: PreparedOverlay[] = [];
  const platformPosition = asPosition(branding.watermark_position);
  const vendorPosition = oppositePosition(platformPosition);

  if (branding.watermark_enabled !== false && branding.company_logo_url) {
    const logoBytes = await loadImageBuffer(branding.company_logo_url);
    if (logoBytes) {
      const badge = await renderLogoBadge(logoBytes, logoMaxW, logoMaxH);
      const raw = coordsFor(platformPosition, width, height, badge.width, badge.height, margin);
      const pos = clampPos(raw.x, raw.y, badge.width, badge.height, width, height);
      overlays.push({ kind: 'platform', bytes: badge.bytes, width: badge.width, height: badge.height, ...pos });
    }
  }

  if (branding.vendor_logo_url) {
    const logoBytes = await loadImageBuffer(branding.vendor_logo_url);
    if (logoBytes) {
      const badge = await renderLogoBadge(logoBytes, logoMaxW, logoMaxH);
      const raw = coordsFor(vendorPosition, width, height, badge.width, badge.height, margin);
      const pos = clampPos(raw.x, raw.y, badge.width, badge.height, width, height);
      overlays.push({ kind: 'vendor', bytes: badge.bytes, width: badge.width, height: badge.height, ...pos });
    }
  }

  const window = followCtaWindow(duration, branding);
  if (window) {
    const banner = await renderCtaBanner(followCtaCopy(branding), null, width);
    const logosAtBottom = platformPosition.startsWith('bottom') || vendorPosition.startsWith('bottom');
    const tallestLogo = overlays.reduce((max, overlay) => Math.max(max, overlay.height), 0);
    const y = logosAtBottom
      ? height - banner.height - tallestLogo - margin * 2
      : height - banner.height - margin;
    const pos = clampPos(Math.round((width - banner.width) / 2), y, banner.width, banner.height, width, height);
    overlays.push({
      kind: 'cta',
      bytes: banner.bytes,
      width: banner.width,
      height: banner.height,
      ...pos,
      enable: window,
    });
  }

  return overlays;
}

export async function applyImageBranding(imageBytes: Buffer, branding: BrandingOverlayRow | null) {
  if (!branding) return { bytes: imageBytes, applied: false };

  const meta = await sharp(imageBytes).metadata();
  const width = meta.width || 1080;
  const height = meta.height || 1080;
  const overlays = await prepareVideoOverlays({
    branding: {
      ...branding,
      follow_cta_enabled: branding.follow_cta_enabled !== false || Boolean(branding.cta_text),
      follow_cta_start_seconds: 0,
      follow_cta_duration: 10,
    },
    width,
    height,
    duration: 10,
  });

  if (overlays.length === 0) return { bytes: imageBytes, applied: false };

  const ctaOverlay = overlays.find((overlay) => overlay.kind === 'cta');
  if (ctaOverlay) {
    const subtitle = imageCtaSubtitle(branding);
    const banner = await renderCtaBanner(imageCtaCopy(branding), subtitle, width);
    const pos = clampPos(
      Math.round((width - banner.width) / 2),
      height - banner.height - Math.max(16, Math.round(height * 0.04)),
      banner.width,
      banner.height,
      width,
      height,
    );
    ctaOverlay.bytes = banner.bytes;
    ctaOverlay.width = banner.width;
    ctaOverlay.height = banner.height;
    ctaOverlay.x = pos.x;
    ctaOverlay.y = pos.y;
  }

  const bytes = await sharp(imageBytes)
    .composite(overlays.map((overlay) => ({
      input: overlay.bytes,
      left: overlay.x,
      top: overlay.y,
    })))
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();

  return { bytes, applied: true };
}
