import type { CSSProperties } from 'react';
import type { TimelineTextOverlay } from '@/lib/editorTimeline';

export function overlayHexColor(value: string | undefined, fallback: string): string {
  const raw = (value ?? '').replace(/^#/, '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw}`;
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const expanded = raw
      .split('')
      .map((c) => c + c)
      .join('');
    return `#${expanded}`;
  }
  return fallback;
}

export function textOverlayPreviewStyle(o: TimelineTextOverlay): CSSProperties {
  const opacity = o.opacity != null && o.opacity < 0.999 ? o.opacity : 1;
  const strokeW =
    o.strokeWidth && o.strokeWidth > 0
      ? Math.max(1, o.strokeWidth * 0.35)
      : o.strokeColor
        ? 1
        : 0;

  return {
    fontSize: Math.max(12, (o.fontSize ?? 42) * 0.35),
    color: overlayHexColor(o.textColor, '#ffffff'),
    opacity,
    WebkitTextStroke:
      strokeW > 0
        ? `${strokeW}px ${overlayHexColor(o.strokeColor, '#000000')}`
        : undefined,
    textShadow: o.shadow ? '0 2px 10px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.8)' : undefined,
    backgroundColor: o.showBackground !== false ? 'rgba(0,0,0,0.45)' : undefined,
    borderRadius: o.showBackground !== false ? 6 : undefined,
    padding: o.showBackground !== false ? '4px 12px' : undefined,
  };
}

export function textOverlayVisibleAt(o: TimelineTextOverlay, playheadSeconds: number): boolean {
  return (
    playheadSeconds >= o.startSeconds &&
    playheadSeconds < o.startSeconds + o.durationSeconds
  );
}
