import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { TimelineStickerOverlay } from './editor-timeline.js';
import { transcodeWithOverlays, type FfmpegOverlay } from './video-tools.js';

async function renderEmojiStickerPng(emoji: string, size: number, rotation = 0): Promise<Buffer> {
  const fontSize = Math.round(size);
  const svg = `<svg width="${fontSize * 2}" height="${fontSize * 2}" xmlns="http://www.w3.org/2000/svg">
    <text x="50%" y="55%" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </svg>`;
  let img = sharp(Buffer.from(svg)).png();
  if (rotation) {
    img = img.rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  }
  return img.toBuffer();
}

export async function burnTimelineStickers(
  inputPath: string,
  outputPath: string,
  options: { width: number; height: number; fps: number; withAudio: boolean },
  stickers: TimelineStickerOverlay[],
  workDir: string,
): Promise<void> {
  if (!stickers.length) {
    await transcodeWithOverlays(inputPath, outputPath, options, []);
    return;
  }

  const ffmpegOverlays: FfmpegOverlay[] = [];
  for (const [index, sticker] of stickers.entries()) {
    const scale = sticker.scale ?? 1;
    const baseSize = Math.round(Math.min(options.width, options.height) * 0.14 * scale);
    const pngBytes = await renderEmojiStickerPng(sticker.emoji, baseSize, sticker.rotation ?? 0);
    const meta = await sharp(pngBytes).metadata();
    const w = meta.width ?? baseSize;
    const h = meta.height ?? baseSize;
    const x = Math.round((options.width * sticker.x) / 100 - w / 2);
    const y = Math.round((options.height * sticker.y) / 100 - h / 2);
    const pngPath = path.join(workDir, `sticker-${index}.png`);
    await writeFile(pngPath, pngBytes);
    const end = sticker.startSeconds + sticker.durationSeconds;
    ffmpegOverlays.push({
      path: pngPath,
      x: Math.max(0, x),
      y: Math.max(0, y),
      enable: `between(t,${sticker.startSeconds.toFixed(3)},${end.toFixed(3)})`,
      opacity: sticker.opacity,
    });
  }

  await transcodeWithOverlays(inputPath, outputPath, options, ffmpegOverlays);
}
