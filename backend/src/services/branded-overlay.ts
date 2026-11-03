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
  follow_cta_repeat_seconds?: number | string | null;
  /** When true, platform logo is burned on the main video clip (not only intro/outro). */
  platform_logo_throughout?: boolean | null;
  /** When true, vendor logo is burned on the main video clip (not only intro/outro). */
  vendor_logo_throughout?: boolean | null;
  watermark_enabled?: boolean | null;
  watermark_position?: string | null;
  vendor_logo_position?: string | null;
};

export type OverlayEnableWindow = {
  start: number;
  end: number;
  /** When set (> hold), CTA reappears every N seconds from `start`. */
  repeatEvery?: number | null;
};

export type PreparedOverlay = {
  kind: 'platform' | 'vendor' | 'cta';
  bytes: Buffer;
  width: number;
  height: number;
  x: number;
  y: number;
  enable?: OverlayEnableWindow;
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
  _plate?: Buffer | null,
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
  const sameAspect = Math.abs(srcW / srcH - canvasW / canvasH) / (canvasW / canvasH) <= 0.08;
  // Full-bleed: fill when aspect matches, cover when it doesn't — no floating 92% card on a plate.
  return sharp(cropped)
    .resize(canvasW, canvasH, {
      fit: sameAspect ? 'fill' : 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
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

export function asPosition(value?: string | null, fallback: OverlayPosition = 'bottom-right'): OverlayPosition {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
  switch (normalized) {
    case 'top-left':
    case 'top-right':
    case 'bottom-left':
    case 'bottom-right':
    case 'bottom-center':
      return normalized;
    default:
      return fallback;
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

/** If the logo sits on an opaque black card, turn near-black into transparency so it blends into footage. */
async function knockOutLogoCardBackground(logoBytes: Buffer) {
  const { data, info } = await sharp(logoBytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels < 4 || width < 4 || height < 4) return logoBytes;

  const isNearBlack = (i: number) => data[i] <= 28 && data[i + 1] <= 28 && data[i + 2] <= 28;
  let edgeDark = 0;
  let edgeCount = 0;
  const sampleEdge = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    edgeCount += 1;
    if (isNearBlack(i)) edgeDark += 1;
  };
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 24))) {
    sampleEdge(x, 0);
    sampleEdge(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += Math.max(1, Math.floor(height / 24))) {
    sampleEdge(0, y);
    sampleEdge(width - 1, y);
  }
  // Only strip when the asset looks like a black card / sticker plate.
  if (edgeCount === 0 || edgeDark / edgeCount < 0.45) return logoBytes;

  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += channels) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (r <= 28 && g <= 28 && b <= 28) {
      out[i + 3] = 0;
    } else if (r <= 48 && g <= 48 && b <= 48) {
      // Soften near-black fringe so edges don't leave a hard box.
      out[i + 3] = Math.round(out[i + 3] * ((Math.max(r, g, b) - 28) / 20));
    }
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/** Average relative luminance 0–1 for a full image or a region. */
async function sampleLuminance(
  imageBytes: Buffer,
  region?: { left: number; top: number; width: number; height: number },
) {
  try {
    let pipeline = sharp(imageBytes).rotate();
    if (region) {
      const meta = await sharp(imageBytes).rotate().metadata();
      const maxW = meta.width || region.width;
      const maxH = meta.height || region.height;
      const left = Math.max(0, Math.min(region.left, maxW - 1));
      const top = Math.max(0, Math.min(region.top, maxH - 1));
      const width = Math.max(1, Math.min(region.width, maxW - left));
      const height = Math.max(1, Math.min(region.height, maxH - top));
      pipeline = pipeline.extract({ left, top, width, height });
    }
    const { data, info } = await pipeline
      .resize(48, 48, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sum = 0;
    const pixels = info.width * info.height;
    for (let i = 0; i < data.length; i += info.channels) {
      sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    }
    return sum / Math.max(1, pixels);
  } catch {
    return 0.45;
  }
}

/** Luminance of opaque logo pixels only. */
async function logoContentLuminance(logoBytes: Buffer) {
  const { data, info } = await sharp(logoBytes)
    .ensureAlpha()
    .resize(64, 64, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 40) continue;
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    count += 1;
  }
  return count ? sum / count : 0.5;
}

async function tintedHaloFromAlpha(
  logoBytes: Buffer,
  rgba: { r: number; g: number; b: number; a: number },
  blur: number,
) {
  const { data, info } = await sharp(logoBytes)
    .ensureAlpha()
    .extractChannel('alpha')
    .blur(blur)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, p = 0; i < data.length; i += 1, p += 4) {
    out[p] = rgba.r;
    out[p + 1] = rgba.g;
    out[p + 2] = rgba.b;
    out[p + 3] = Math.round((data[i] / 255) * rgba.a * 255);
  }
  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * Auto-adapt logo to the local scene color/brightness so it stays readable
 * on light, dark, or colorful footage without looking like a sticker plate.
 */
async function renderLogoBadge(
  logoBytes: Buffer,
  maxW: number,
  maxH: number,
  sceneLuma = 0.45,
) {
  const cleaned = await knockOutLogoCardBackground(logoBytes);
  let fitted = await sharp(cleaned)
    .rotate()
    .resize({
      width: even(Math.max(24, maxW)),
      height: even(Math.max(24, maxH)),
      fit: 'inside',
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  const logoLuma = await logoContentLuminance(fitted);
  const contrast = Math.abs(logoLuma - sceneLuma);
  const sceneIsDark = sceneLuma < 0.42;
  const sceneIsLight = sceneLuma > 0.58;

  // Push logo brightness away from the background when contrast is weak.
  if (contrast < 0.22) {
    if (sceneIsDark) {
      fitted = await sharp(fitted).modulate({ brightness: 1.28, saturation: 1.05 }).png().toBuffer();
    } else if (sceneIsLight) {
      fitted = await sharp(fitted).modulate({ brightness: 0.78, saturation: 1.08 }).png().toBuffer();
    } else if (logoLuma > sceneLuma) {
      fitted = await sharp(fitted).modulate({ brightness: 1.12 }).png().toBuffer();
    } else {
      fitted = await sharp(fitted).modulate({ brightness: 0.88 }).png().toBuffer();
    }
  } else if (sceneIsDark && logoLuma < 0.35) {
    fitted = await sharp(fitted).modulate({ brightness: 1.18 }).png().toBuffer();
  } else if (sceneIsLight && logoLuma > 0.7) {
    fitted = await sharp(fitted).modulate({ brightness: 0.85 }).png().toBuffer();
  }

  // Soft dual halo (light + dark) keeps marks readable on any color without a hard box.
  const lightHaloStrength = sceneIsDark ? 0.42 : sceneIsLight ? 0.16 : 0.26;
  const darkHaloStrength = sceneIsLight ? 0.4 : sceneIsDark ? 0.16 : 0.24;
  const lightHalo = await tintedHaloFromAlpha(
    fitted,
    { r: 255, g: 255, b: 255, a: lightHaloStrength },
    2.4,
  );
  const darkHalo = await tintedHaloFromAlpha(
    fitted,
    { r: 0, g: 0, b: 0, a: darkHaloStrength },
    2.8,
  );

  const faded = await sharp(fitted)
    .composite([{
      input: Buffer.from([255, 255, 255, Math.round(255 * 0.92)]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: 'dest-in',
    }])
    .png()
    .toBuffer();

  const meta = await sharp(faded).metadata();
  const logoW = meta.width || maxW;
  const logoH = meta.height || maxH;
  const pad = 10;
  const width = even(logoW + pad * 2);
  const height = even(logoH + pad * 2);

  const bytes = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: darkHalo, left: pad + 1, top: pad + 2 },
      { input: lightHalo, left: pad - 1, top: pad - 1 },
      { input: faded, left: pad, top: pad },
    ])
    .png()
    .toBuffer();

  logger.info('branded-overlay', 'Adaptive logo grade', {
    sceneLuma: Number(sceneLuma.toFixed(3)),
    logoLuma: Number(logoLuma.toFixed(3)),
    contrast: Number(contrast.toFixed(3)),
    sceneIsDark,
    sceneIsLight,
  });

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

export function followCtaWindow(
  duration: number,
  branding: BrandingOverlayRow | null,
): OverlayEnableWindow | null {
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

  const rawRepeat = branding.follow_cta_repeat_seconds;
  const repeatRequested = rawRepeat === null || rawRepeat === undefined || String(rawRepeat).trim() === ''
    ? Number.NaN
    : Number(rawRepeat);
  const holdLen = end - start;
  // Interval must leave a gap after each appearance; otherwise treat as one-shot.
  const repeatEvery = Number.isFinite(repeatRequested) && repeatRequested > holdLen + 0.25
    ? repeatRequested
    : null;

  return { start, end, repeatEvery };
}

/** Build an ffmpeg overlay `enable` expression for a CTA window (one-shot or repeating). */
export function overlayEnableExpression(window: OverlayEnableWindow): string {
  const start = window.start.toFixed(3);
  const end = window.end.toFixed(3);
  const hold = Math.max(0.8, window.end - window.start);
  if (window.repeatEvery && window.repeatEvery > hold + 0.25) {
    const interval = window.repeatEvery.toFixed(3);
    const holdFixed = hold.toFixed(3);
    return `gte(t,${start})*lt(mod(t-${start},${interval}),${holdFixed})`;
  }
  return `between(t,${start},${end})`;
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

export function platformLogoOnMainVideo(branding: BrandingOverlayRow | null) {
  if (!branding || branding.watermark_enabled === false || !branding.company_logo_url) return false;
  return branding.platform_logo_throughout === true;
}

export function vendorLogoOnMainVideo(branding: BrandingOverlayRow | null) {
  if (!branding || !branding.vendor_logo_url) return false;
  return branding.vendor_logo_throughout === true;
}

export function platformLogoOnIntroOutro(branding: BrandingOverlayRow | null) {
  if (!branding || branding.watermark_enabled === false || !branding.company_logo_url) return false;
  return branding.platform_logo_throughout !== true;
}

export function vendorLogoOnIntroOutro(branding: BrandingOverlayRow | null) {
  if (!branding || !branding.vendor_logo_url) return false;
  return branding.vendor_logo_throughout !== true;
}

export function hasThroughoutVideoLogos(branding: BrandingOverlayRow | null) {
  return platformLogoOnMainVideo(branding) || vendorLogoOnMainVideo(branding);
}

export function hasIntroOutroCardLogos(branding: BrandingOverlayRow | null) {
  return platformLogoOnIntroOutro(branding) || vendorLogoOnIntroOutro(branding);
}

/** Mid-video ffmpeg overlays: follow CTA and/or logos marked "throughout video". */
export function shouldApplyVideoOverlays(branding: BrandingOverlayRow | null) {
  if (!branding) return false;
  return branding.follow_cta_enabled === true || hasThroughoutVideoLogos(branding);
}

export function hasLogoOverlays(branding: BrandingOverlayRow | null) {
  if (!branding) return false;
  return (branding.watermark_enabled !== false && Boolean(branding.company_logo_url))
    || Boolean(branding.vendor_logo_url);
}

async function sceneLumaForCorner(
  scenePlate: Buffer | Buffer[] | null | undefined,
  position: OverlayPosition,
  canvasW: number,
  canvasH: number,
  estimateW: number,
  estimateH: number,
  margin: number,
) {
  if (!scenePlate) return 0.45;
  const plates = Array.isArray(scenePlate) ? scenePlate : [scenePlate];
  if (!plates.length) return 0.45;
  const raw = coordsFor(position, canvasW, canvasH, estimateW, estimateH, margin);
  const region = {
    left: Math.max(0, raw.x - 4),
    top: Math.max(0, raw.y - 4),
    width: Math.min(canvasW, estimateW + 8),
    height: Math.min(canvasH, estimateH + 8),
  };
  const samples = await Promise.all(plates.map((plate) => sampleLuminance(plate, region)));
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

export async function compositeLogoOverlays(
  imageBytes: Buffer,
  branding: BrandingOverlayRow | null,
  width: number,
  height: number,
  /** intro_outro = respect per-logo video scope; image = always composite both logos when set. */
  mode: 'intro_outro' | 'image' = 'intro_outro',
) {
  const includePlatformLogo = mode === 'image'
    ? Boolean(branding && branding.watermark_enabled !== false && branding.company_logo_url)
    : platformLogoOnIntroOutro(branding);
  const includeVendorLogo = mode === 'image'
    ? Boolean(branding?.vendor_logo_url)
    : vendorLogoOnIntroOutro(branding);
  const overlays = await prepareVideoOverlays({
    branding: branding ? { ...branding, follow_cta_enabled: false } : null,
    width,
    height,
    duration: 10,
    scenePlate: imageBytes,
    includePlatformLogo,
    includeVendorLogo,
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
  return compositeLogoOverlays(fitted, branding, canvasW, canvasH, 'image');
}

export async function prepareVideoOverlays(input: {
  branding: BrandingOverlayRow | null;
  width: number;
  height: number;
  duration: number;
  /** One or more frames from the real video/image used to auto-grade logos to local color. */
  scenePlate?: Buffer | Buffer[] | null;
  /** When false, skip all corner logos. Default true. */
  includeLogos?: boolean;
  /** Override platform logo on this pass (defaults to includeLogos). */
  includePlatformLogo?: boolean;
  /** Override vendor logo on this pass (defaults to includeLogos). */
  includeVendorLogo?: boolean;
}): Promise<PreparedOverlay[]> {
  const {
    branding,
    width,
    height,
    duration,
    scenePlate,
    includeLogos = true,
    includePlatformLogo = includeLogos,
    includeVendorLogo = includeLogos,
  } = input;
  if (!branding) return [];

  const margin = Math.max(16, Math.round(Math.min(width, height) * 0.035));
  const logoMaxW = even(width * 0.16);
  const logoMaxH = even(height * 0.14);
  const overlays: PreparedOverlay[] = [];
  const platformPosition = asPosition(branding.watermark_position, 'bottom-right');
  const vendorPosition = asPosition(branding.vendor_logo_position, 'bottom-left');
  const gap = Math.max(10, Math.round(margin * 0.6));
  let platformBox: { x: number; y: number; width: number; height: number } | null = null;

  const placeLogos = includePlatformLogo || includeVendorLogo;
  if (placeLogos) {
    logger.info('branded-overlay', 'Placing logos at selected corners', {
      canvas: `${width}x${height}`,
      platformPosition,
      vendorPosition,
      rawPlatform: branding.watermark_position,
      rawVendor: branding.vendor_logo_position,
      hasPlatformLogo: Boolean(branding.company_logo_url),
      hasVendorLogo: Boolean(branding.vendor_logo_url),
      adaptiveScene: Boolean(scenePlate),
    });

    if (includePlatformLogo && branding.watermark_enabled !== false && branding.company_logo_url) {
      const logoBytes = await loadImageBuffer(branding.company_logo_url);
      if (logoBytes) {
        const sceneLuma = await sceneLumaForCorner(
          scenePlate,
          platformPosition,
          width,
          height,
          logoMaxW,
          logoMaxH,
          margin,
        );
        const badge = await renderLogoBadge(logoBytes, logoMaxW, logoMaxH, sceneLuma);
        const raw = coordsFor(platformPosition, width, height, badge.width, badge.height, margin);
        const pos = clampPos(raw.x, raw.y, badge.width, badge.height, width, height);
        platformBox = { ...pos, width: badge.width, height: badge.height };
        logger.info('branded-overlay', 'Platform logo coordinates', {
          position: platformPosition,
          x: pos.x,
          y: pos.y,
          width: badge.width,
          height: badge.height,
          sceneLuma: Number(sceneLuma.toFixed(3)),
        });
        overlays.push({ kind: 'platform', bytes: badge.bytes, width: badge.width, height: badge.height, ...pos });
      }
    }

    if (includeVendorLogo && branding.vendor_logo_url) {
      const logoBytes = await loadImageBuffer(branding.vendor_logo_url);
      if (logoBytes) {
        let estimateY = 0;
        if (platformBox && vendorPosition === platformPosition) {
          const stackDown = vendorPosition.startsWith('top');
          estimateY = stackDown ? platformBox.height + gap : -(logoMaxH + gap);
        }
        const sceneLuma = await sceneLumaForCorner(
          scenePlate,
          vendorPosition,
          width,
          height,
          logoMaxW,
          logoMaxH + Math.abs(estimateY),
          margin,
        );
        const badge = await renderLogoBadge(logoBytes, logoMaxW, logoMaxH, sceneLuma);
        let raw = coordsFor(vendorPosition, width, height, badge.width, badge.height, margin);
        // If both logos share a corner, stack the vendor logo so they stay readable.
        if (platformBox && vendorPosition === platformPosition) {
          const stackDown = vendorPosition.startsWith('top');
          raw = {
            x: platformBox.x,
            y: stackDown
              ? platformBox.y + platformBox.height + gap
              : platformBox.y - badge.height - gap,
          };
        }
        const pos = clampPos(raw.x, raw.y, badge.width, badge.height, width, height);
        logger.info('branded-overlay', 'Vendor logo coordinates', {
          position: vendorPosition,
          x: pos.x,
          y: pos.y,
          width: badge.width,
          height: badge.height,
          sceneLuma: Number(sceneLuma.toFixed(3)),
        });
        overlays.push({ kind: 'vendor', bytes: badge.bytes, width: badge.width, height: badge.height, ...pos });
      }
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
    scenePlate: imageBytes,
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
