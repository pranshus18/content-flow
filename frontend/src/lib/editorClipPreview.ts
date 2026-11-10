import type { CSSProperties } from 'react';
import {
  kenBurnsZoomAtProgress,
  resolveImageKenBurns,
  type ResolveImageKenBurnsContext,
  type TimelineClip,
} from '@/lib/editorTimeline';

/** 0–1 effective opacity for preview compositing (1 = fully opaque). */
export function clipPreviewOpacity(clip: TimelineClip | undefined): number {
  if (!clip?.opacity || clip.opacity >= 0.999) return 1;
  return Math.min(1, Math.max(0.05, clip.opacity));
}

/** Color / transform only — apply opacity on the wrapper via clipPreviewWrapperStyle. */
export function clipPreviewMediaStyle(
  clip: TimelineClip,
  options?: {
    kenBurnsProgress01?: number;
    slideIndex?: number;
    kenBurnsContext?: ResolveImageKenBurnsContext;
  },
): CSSProperties {
  const filters: string[] = [];
  const adj = clip.adjustments;

  if (adj?.brightness) {
    filters.push(`brightness(${1 + adj.brightness / 200})`);
  }
  if (adj?.contrast) {
    filters.push(`contrast(${1 + adj.contrast / 100})`);
  }
  if (adj?.saturation) {
    filters.push(`saturate(${1 + adj.saturation / 100})`);
  }

  switch (clip.filter) {
    case 'vivid':
      filters.push('saturate(1.35) contrast(1.08)');
      break;
    case 'warm':
      filters.push('sepia(0.25) saturate(1.15) hue-rotate(-8deg)');
      break;
    case 'cool':
      filters.push('saturate(1.05) hue-rotate(12deg) brightness(1.02)');
      break;
    case 'vintage':
      filters.push('sepia(0.35) contrast(1.08) brightness(1.04) saturate(0.72)');
      break;
    case 'bw':
      filters.push('grayscale(1) contrast(1.05)');
      break;
    default:
      break;
  }

  switch (clip.videoEffect) {
    case 'blur':
      filters.push('blur(4px)');
      break;
    case 'sharpen':
      filters.push('contrast(1.12) saturate(1.05)');
      break;
    case 'grain':
      filters.push('contrast(1.05) brightness(0.98)');
      break;
    case 'vignette':
      break;
    default:
      break;
  }

  const transforms: string[] = [];
  if (clip.flipHorizontal) transforms.push('scaleX(-1)');
  if (clip.rotation) transforms.push(`rotate(${clip.rotation}deg)`);

  const zoom = clip.cropZoom ?? 1;
  if (zoom > 1.001) transforms.push(`scale(${zoom})`);

  const kb =
    options?.kenBurnsProgress01 != null
      ? resolveImageKenBurns(clip, options.slideIndex ?? 0, options.kenBurnsContext)
      : undefined;
  if (kb && options?.kenBurnsProgress01 != null) {
    transforms.push(`scale(${kenBurnsZoomAtProgress(kb, options.kenBurnsProgress01)})`);
  }

  const style: CSSProperties = {
    filter: filters.length ? filters.join(' ') : undefined,
    transform: transforms.length ? transforms.join(' ') : undefined,
    transformOrigin: 'center center',
  };

  if (clip.crop) {
    const { x, y, w, h } = clip.crop;
    style.clipPath = `inset(${y * 100}% ${(1 - x - w) * 100}% ${(1 - y - h) * 100}% ${x * 100}%)`;
  }

  return style;
}

/** Wrapper opacity + optional transition layer styles (opacities multiply). */
export function clipPreviewWrapperStyle(
  clip: TimelineClip,
  transitionLayerStyle?: CSSProperties,
): CSSProperties {
  const clipOp = clipPreviewOpacity(clip);
  const merged: CSSProperties = transitionLayerStyle ? { ...transitionLayerStyle } : {};

  const transitionOp =
    merged.opacity != null && typeof merged.opacity === 'number' ? merged.opacity : 1;
  const effective = clipOp * transitionOp;

  if (effective < 0.999) {
    merged.opacity = effective;
  } else {
    delete merged.opacity;
  }

  return merged;
}

export function clipPreviewWrapperClass(clip: TimelineClip): string {
  return 'relative max-w-full max-h-full flex items-center justify-center overflow-hidden';
}

export function clipActiveEffectLabels(clip: TimelineClip): string[] {
  const labels: string[] = [];
  if (clip.filter && clip.filter !== 'none') labels.push(`Filter: ${clip.filter}`);
  if (clip.adjustments?.brightness) labels.push(`Brightness ${clip.adjustments.brightness}`);
  if (clip.adjustments?.contrast) labels.push(`Contrast ${clip.adjustments.contrast}`);
  if (clip.adjustments?.saturation) labels.push(`Saturation ${clip.adjustments.saturation}`);
  if (clip.videoEffect) labels.push(clip.videoEffect);
  if (clip.chromaKey?.enabled) labels.push('Chroma key');
  if (clip.kenBurns?.enabled) labels.push('Ken Burns');
  if (clip.cropZoom && clip.cropZoom > 1.001) labels.push(`Zoom ${clip.cropZoom.toFixed(2)}×`);
  if (clip.crop) labels.push('Crop');
  if (clip.opacity != null && clip.opacity < 0.999) labels.push(`Opacity ${Math.round(clip.opacity * 100)}%`);
  if (clip.fadeInSeconds) labels.push(`Fade in ${clip.fadeInSeconds}s`);
  if (clip.fadeOutSeconds) labels.push(`Fade out ${clip.fadeOutSeconds}s`);
  return labels;
}
