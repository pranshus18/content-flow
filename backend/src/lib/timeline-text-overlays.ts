import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { TimelineTextOverlay } from './editor-timeline.js';
import { transcodeWithOverlays, type FfmpegOverlay } from './video-tools.js';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (next.length <= maxChars) current = next;
    else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines.slice(0, 4);
}

async function renderTextOverlayPng(
  overlay: TimelineTextOverlay,
  canvasWidth: number,
): Promise<Buffer> {
  const fontSize = overlay.fontSize ?? 48;
  const padX = 32;
  const lineHeight = Math.round(fontSize * 1.25);
  const maxChars = Math.max(12, Math.floor((canvasWidth - padX * 2) / (fontSize * 0.52)));
  const lines = wrapText(overlay.text, maxChars);
  const blockHeight = padX * 2 + lineHeight * lines.length;
  const op = overlay.opacity != null ? Math.min(1, Math.max(0.05, overlay.opacity)) : 1;
  const showBg = overlay.showBackground !== false;
  const boxAlpha = showBg ? (0.55 * op).toFixed(3) : '0';
  const textAlpha = op.toFixed(3);
  const fill = overlay.textColor ? `#${overlay.textColor.replace(/^#/, '')}` : '#ffffff';
  const stroke = overlay.strokeColor ? `#${overlay.strokeColor.replace(/^#/, '')}` : undefined;
  const strokeWidth = overlay.strokeWidth ?? 0;
  const shadow = overlay.shadow
    ? 'filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.85))"'
    : '';
  const svgLines = lines
    .map((line, index) => {
      const y = padX + fontSize + index * lineHeight;
      const attrs = [
        `x="50%"`,
        `y="${y}"`,
        `fill="${fill}"`,
        `fill-opacity="${textAlpha}"`,
        `font-size="${fontSize}"`,
        `font-family="Arial, Helvetica, sans-serif"`,
        `font-weight="700"`,
        `text-anchor="middle"`,
        shadow,
      ].filter(Boolean);
      if (stroke && strokeWidth > 0) {
        attrs.push(`stroke="${stroke}"`, `stroke-width="${strokeWidth}"`, 'paint-order="stroke fill"');
      }
      return `<text ${attrs.join(' ')}>${escapeXml(line)}</text>`;
    })
    .join('');

  const svg = `<svg width="${canvasWidth}" height="${blockHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="100%" height="100%" rx="12" fill="rgba(0,0,0,${boxAlpha})"/>
    ${svgLines}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function overlayY(
  position: TimelineTextOverlay['position'],
  canvasHeight: number,
  overlayHeight: number,
): number {
  if (position === 'top') return 72;
  if (position === 'bottom') return Math.max(72, canvasHeight - overlayHeight - 72);
  return Math.max(0, Math.round((canvasHeight - overlayHeight) / 2));
}

export async function burnTimelineTextOverlays(
  inputPath: string,
  outputPath: string,
  options: { width: number; height: number; fps: number; withAudio: boolean },
  overlays: TimelineTextOverlay[],
  workDir: string,
): Promise<void> {
  if (!overlays.length) {
    await transcodeWithOverlays(inputPath, outputPath, options, []);
    return;
  }

  const ffmpegOverlays: FfmpegOverlay[] = [];
  for (const [index, overlay] of overlays.entries()) {
    const pngBytes = await renderTextOverlayPng(overlay, options.width);
    const meta = await sharp(pngBytes).metadata();
    const overlayHeight = meta.height ?? 120;
    const pngPath = path.join(workDir, `text-overlay-${index}.png`);
    await writeFile(pngPath, pngBytes);
    const end = overlay.startSeconds + overlay.durationSeconds;
    const defaultY = overlayY(overlay.position, options.height, overlayHeight);
    const x =
      overlay.x != null
        ? Math.round((options.width * overlay.x) / 100 - options.width / 2)
        : 0;
    const y =
      overlay.y != null
        ? Math.round((options.height * overlay.y) / 100 - overlayHeight / 2)
        : defaultY;
    ffmpegOverlays.push({
      path: pngPath,
      x: Math.max(0, x),
      y: Math.max(0, y),
      enable: `between(t,${overlay.startSeconds.toFixed(3)},${end.toFixed(3)})`,
      // Opacity is baked into the PNG (fill-opacity / box alpha); avoid double-applying in FFmpeg.
    });
  }

  await transcodeWithOverlays(inputPath, outputPath, options, ffmpegOverlays);
}
