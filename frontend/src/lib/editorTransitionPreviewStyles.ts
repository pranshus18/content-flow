import type { CSSProperties } from 'react';
import type { TimelineTransition } from '@/lib/editorTimeline';

function ease(p: number) {
  return p * p * (3 - 2 * p);
}

function clampP(progress: number, linear = false) {
  const t = Math.max(0, Math.min(1, progress));
  return linear ? t : ease(t);
}

/** Approximate FFmpeg xfade in the browser (export may differ slightly). */
export function transitionPreviewLayerStyle(
  transition: TimelineTransition,
  progress: number,
  layer: 'from' | 'to',
): CSSProperties {
  const crossfadeLinear =
    transition === 'fade' || transition === 'dissolve' || transition === 'fadefast' || transition === 'fadeslow';
  const p = clampP(progress, crossfadeLinear);

  switch (transition) {
    case 'fade':
    case 'dissolve':
    case 'fadefast':
    case 'fadeslow':
      return { opacity: layer === 'from' ? 1 - p : p };
    case 'fadeblack':
    case 'fadewhite':
      if (layer === 'from') return { opacity: p < 0.5 ? 1 - p * 2 : 0 };
      return { opacity: p > 0.5 ? (p - 0.5) * 2 : 0 };
    case 'wipeleft':
      return layer === 'from'
        ? { clipPath: `inset(0 0 0 ${p * 100}%)` }
        : { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` };
    case 'wiperight':
      return layer === 'from'
        ? { clipPath: `inset(0 ${p * 100}% 0 0)` }
        : { clipPath: `inset(0 0 0 ${(1 - p) * 100}%)` };
    case 'wipeup':
      return layer === 'from'
        ? { clipPath: `inset(${p * 100}% 0 0 0)` }
        : { clipPath: `inset(0 0 ${(1 - p) * 100}% 0)` };
    case 'wipedown':
      return layer === 'from'
        ? { clipPath: `inset(0 0 ${p * 100}% 0)` }
        : { clipPath: `inset(${(1 - p) * 100}% 0 0 0)` };
    case 'slideleft':
      return layer === 'from'
        ? { transform: `translateX(${-p * 100}%)` }
        : { transform: `translateX(${(1 - p) * 100}%)` };
    case 'slideright':
      return layer === 'from'
        ? { transform: `translateX(${p * 100}%)` }
        : { transform: `translateX(${-(1 - p) * 100}%)` };
    case 'slideup':
      return layer === 'from'
        ? { transform: `translateY(${-p * 100}%)` }
        : { transform: `translateY(${(1 - p) * 100}%)` };
    case 'slidedown':
      return layer === 'from'
        ? { transform: `translateY(${p * 100}%)` }
        : { transform: `translateY(${-(1 - p) * 100}%)` };
    case 'smoothleft':
      return layer === 'from'
        ? { transform: `translateX(${-p * 40}%)`, opacity: 1 - p * 0.35 }
        : { transform: `translateX(${(1 - p) * 15}%)`, opacity: 0.65 + p * 0.35 };
    case 'smoothright':
      return layer === 'from'
        ? { transform: `translateX(${p * 40}%)`, opacity: 1 - p * 0.35 }
        : { transform: `translateX(${-(1 - p) * 15}%)`, opacity: 0.65 + p * 0.35 };
    case 'smoothup':
      return layer === 'from'
        ? { transform: `translateY(${-p * 40}%)`, opacity: 1 - p * 0.35 }
        : { transform: `translateY(${(1 - p) * 15}%)`, opacity: 0.65 + p * 0.35 };
    case 'smoothdown':
      return layer === 'from'
        ? { transform: `translateY(${p * 40}%)`, opacity: 1 - p * 0.35 }
        : { transform: `translateY(${-(1 - p) * 15}%)`, opacity: 0.65 + p * 0.35 };
    case 'circleopen':
      return layer === 'from'
        ? { opacity: 1 - p }
        : { clipPath: `circle(${Math.max(0.5, p * 75)}% at 50% 50%)`, opacity: 1 };
    case 'circleclose':
      return layer === 'from'
        ? { clipPath: `circle(${(1 - p) * 75}% at 50% 50%)`, opacity: 1 }
        : { opacity: p };
    case 'radial':
      return layer === 'from'
        ? { transform: `scale(${1 + p * 0.08})`, opacity: 1 - p }
        : { transform: `scale(${0.92 + p * 0.08})`, opacity: p };
    case 'zoomin':
      return layer === 'from'
        ? { transform: `scale(${1 + p * 0.35})`, opacity: 1 - p }
        : { transform: `scale(${0.65 + p * 0.35})`, opacity: p };
    case 'coverleft':
      return layer === 'from'
        ? { transform: `translateX(${-p * 30}%)`, opacity: 1 - p * 0.5 }
        : { transform: `translateX(${(1 - p) * 100}%)`, opacity: 1 };
    case 'coverright':
      return layer === 'from'
        ? { transform: `translateX(${p * 30}%)`, opacity: 1 - p * 0.5 }
        : { transform: `translateX(${-(1 - p) * 100}%)`, opacity: 1 };
    case 'revealleft':
      return layer === 'from'
        ? { clipPath: `inset(0 ${p * 100}% 0 0)` }
        : { transform: `translateX(${-p * 20}%)`, opacity: p };
    case 'revealright':
      return layer === 'from'
        ? { clipPath: `inset(0 0 0 ${p * 100}%)` }
        : { transform: `translateX(${p * 20}%)`, opacity: p };
    case 'diagtl':
      return layer === 'from'
        ? { clipPath: `polygon(0 0, ${100 - p * 100}% 0, 0 ${100 - p * 100}%)` }
        : { clipPath: `polygon(100% 100%, ${p * 100}% 100%, 100% ${p * 100}%)` };
    case 'diagtr':
      return layer === 'from'
        ? { clipPath: `polygon(100% 0, 100% ${100 - p * 100}%, ${p * 100}% 0)` }
        : { clipPath: `polygon(0 100%, 0 ${p * 100}%, ${100 - p * 100}% 100%)` };
    case 'distance':
      return layer === 'from'
        ? { transform: `scale(${1 + p * 0.2})`, filter: `blur(${p * 3}px)`, opacity: 1 - p }
        : { transform: `scale(${0.85 + p * 0.15})`, opacity: p };
    case 'hblur':
      return layer === 'from'
        ? { filter: `blur(${p * 6}px)`, opacity: 1 - p }
        : { filter: `blur(${(1 - p) * 6}px)`, opacity: p };
    case 'horzopen':
      return layer === 'from'
        ? { clipPath: `inset(0 ${50 - p * 50}% 0 ${50 - p * 50}%)` }
        : { clipPath: `inset(0 ${50 - p * 50}% 0 ${50 - p * 50}%)`, opacity: p };
    case 'vertopen':
      return layer === 'from'
        ? { clipPath: `inset(${50 - p * 50}% 0 ${50 - p * 50}% 0)` }
        : { clipPath: `inset(${50 - p * 50}% 0 ${50 - p * 50}% 0)`, opacity: p };
    case 'squeezeh':
      return layer === 'from'
        ? { transform: `scaleX(${1 - p * 0.85})`, opacity: 1 - p }
        : { transform: `scaleX(${0.15 + p * 0.85})`, opacity: p };
    case 'squeezew':
      return layer === 'from'
        ? { transform: `scaleY(${1 - p * 0.85})`, opacity: 1 - p }
        : { transform: `scaleY(${0.15 + p * 0.85})`, opacity: p };
    default:
      return { opacity: layer === 'from' ? 1 - p : p };
  }
}

export function transitionPreviewBackdropStyle(
  transition: TimelineTransition,
  progress: number,
): CSSProperties | null {
  const p = Math.max(0, Math.min(1, progress));
  if (transition === 'fadeblack') {
    const peak = p < 0.5 ? p * 2 : (1 - p) * 2;
    return { backgroundColor: `rgba(0,0,0,${peak})` };
  }
  if (transition === 'fadewhite') {
    const peak = p < 0.5 ? p * 2 : (1 - p) * 2;
    return { backgroundColor: `rgba(255,255,255,${peak * 0.95})` };
  }
  return null;
}

/** Grouped for UI pickers (slideshow + clip transitions). */
export const EDITOR_TRANSITION_GROUPS: Array<{
  label: string;
  transitions: TimelineTransition[];
}> = [
  {
    label: 'Classic',
    transitions: ['fade', 'fadefast', 'fadeslow', 'dissolve', 'fadeblack', 'fadewhite'],
  },
  {
    label: 'Wipe & slide',
    transitions: [
      'wipeleft',
      'wiperight',
      'wipeup',
      'wipedown',
      'slideleft',
      'slideright',
      'slideup',
      'slidedown',
      'diagtl',
      'diagtr',
    ],
  },
  {
    label: 'Smooth push',
    transitions: ['smoothleft', 'smoothright', 'smoothup', 'smoothdown'],
  },
  {
    label: 'Cinematic',
    transitions: [
      'circleopen',
      'circleclose',
      'radial',
      'zoomin',
      'coverleft',
      'coverright',
      'revealleft',
      'revealright',
      'distance',
      'hblur',
    ],
  },
  {
    label: 'Stylized',
    transitions: ['horzopen', 'vertopen', 'squeezeh', 'squeezew'],
  },
];
