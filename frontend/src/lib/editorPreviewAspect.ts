import type { TimelineClip } from '@/lib/editorTimeline';

export type ClipMediaMeta = { width: number; height: number; duration?: number };

export function isPortraitMedia(width: number, height: number): boolean {
  return height > width * 1.02;
}

export function clipIntrinsicSize(
  clip: TimelineClip | undefined,
  videoMeta: Record<string, ClipMediaMeta>,
  imageMeta: Record<string, { width: number; height: number }>,
): { width: number; height: number } | null {
  if (!clip) return null;
  if (clip.kind === 'video') {
    const m = videoMeta[clip.id];
    if (m?.width && m?.height) return { width: m.width, height: m.height };
  }
  if (clip.kind === 'image') {
    const m = imageMeta[clip.id];
    if (m?.width && m?.height) return { width: m.width, height: m.height };
  }
  return null;
}

/** Human-readable aspect for preview badge */
export function formatPreviewAspectLabel(width: number, height: number): string {
  const r = width / height;
  if (r < 0.58) return '9:16';
  if (r < 0.72) return '4:5';
  if (r < 0.92) return '3:4';
  if (r < 1.08) return '1:1';
  if (r < 1.45) return '4:3';
  if (r < 1.85) return '16:10';
  return '16:9';
}

export type PreviewFrameLayout = {
  aspectRatio: string;
  maxWidth: string;
  /** Preview follows clip (portrait) vs export canvas */
  matchMode: 'clip' | 'export';
  previewAspectLabel: string;
  exportSizeLabel: string;
};

export function resolvePreviewFrameLayout(
  clip: TimelineClip | undefined,
  videoMeta: Record<string, ClipMediaMeta>,
  imageMeta: Record<string, { width: number; height: number }>,
  exportWidth: number,
  exportHeight: number,
  embedded: boolean,
): PreviewFrameLayout {
  const exportSizeLabel = `${exportWidth}×${exportHeight}`;
  const exportAspect = `${exportWidth} / ${exportHeight}`;
  const landscapeMax = embedded ? 'min(100%, 100%)' : 'min(100%, 960px)';
  const squareMax = embedded ? 'min(100%, 100%)' : 'min(100%, 520px)';

  const intrinsic = clipIntrinsicSize(clip, videoMeta, imageMeta);
  if (intrinsic && isPortraitMedia(intrinsic.width, intrinsic.height)) {
    const portraitMax = embedded ? 'min(100%, 380px)' : 'min(100%, 440px)';
    return {
      aspectRatio: `${intrinsic.width} / ${intrinsic.height}`,
      maxWidth: portraitMax,
      matchMode: 'clip',
      previewAspectLabel: formatPreviewAspectLabel(intrinsic.width, intrinsic.height),
      exportSizeLabel,
    };
  }

  const isWideExport = exportWidth > exportHeight;
  return {
    aspectRatio: exportAspect,
    maxWidth: isWideExport ? landscapeMax : squareMax,
    matchMode: 'export',
    previewAspectLabel: exportSizeLabel,
    exportSizeLabel,
  };
}
