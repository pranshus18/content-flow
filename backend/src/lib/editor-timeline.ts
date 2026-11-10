/** Keep in sync with ../../../shared/editor-timeline.ts (canonical for frontend). */

export type EditorPlatform = 'instagram' | 'facebook' | 'youtube';

export type TimelineClipKind = 'image' | 'video';

export type TimelineFilterPreset = 'none' | 'vivid' | 'warm' | 'cool' | 'vintage' | 'bw';

export const TIMELINE_FILTER_LABELS: Record<TimelineFilterPreset, string> = {
  none: 'None',
  vivid: 'Vivid',
  warm: 'Warm',
  cool: 'Cool',
  vintage: 'Vintage',
  bw: 'Black & white',
};

export const TIMELINE_FILTER_PRESETS: TimelineFilterPreset[] = Object.keys(
  TIMELINE_FILTER_LABELS,
) as TimelineFilterPreset[];

export type TimelineTextPosition = 'top' | 'center' | 'bottom';

export interface TimelineClipAdjustments {
  brightness?: number;
  contrast?: number;
  saturation?: number;
}

export type TimelineTextAnimation = 'none' | 'fadeIn' | 'popIn' | 'slideUp';

export interface TimelineTextOverlay {
  id: string;
  text: string;
  startSeconds: number;
  durationSeconds: number;
  position?: TimelineTextPosition;
  fontSize?: number;
  animation?: TimelineTextAnimation;
  /** Layer opacity 0–1 (default 1). */
  opacity?: number;
  /** Hex without # */
  textColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadow?: boolean;
  showBackground?: boolean;
  /** Override preset position (0–100). */
  x?: number;
  y?: number;
}

/** Picture-in-picture or floating overlay on top of the composed timeline. */
export interface TimelinePipLayer {
  id: string;
  kind: TimelineClipKind;
  sourceUrl: string;
  startSeconds: number;
  durationSeconds: number;
  x: number;
  y: number;
  /** Width as % of canvas (10–100). */
  widthPercent?: number;
  opacity?: number;
  trimIn?: number;
  trimOut?: number;
  borderRadius?: number;
}

export interface TimelineClipCrop {
  /** Normalized 0–1 */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TimelineVideoEffect = 'blur' | 'vignette' | 'sharpen' | 'grain';

export const TIMELINE_VIDEO_EFFECT_LABELS: Record<TimelineVideoEffect, string> = {
  blur: 'Blur',
  vignette: 'Vignette',
  sharpen: 'Sharpen',
  grain: 'Film grain',
};

export interface TimelineChromaKey {
  enabled: boolean;
  /** Hex color without #, default green screen 00ff00 */
  color?: string;
  similarity?: number;
  blend?: number;
}

export interface TimelineKenBurns {
  enabled: boolean;
  zoomFrom?: number;
  zoomTo?: number;
}

const KEN_BURNS_STEP = 0.012;
const KEN_BURNS_MAX = 1.08;

/** Linear zoom progress (matches FFmpeg zoompan). `progress01` is 0 at clip start, 1 at end. */
export function kenBurnsZoomAtProgress(kb: TimelineKenBurns, progress01: number): number {
  const zf = kb.zoomFrom ?? 1;
  const zt = kb.zoomTo ?? 1.1;
  const t = Math.max(0, Math.min(1, progress01));
  return zf + (zt - zf) * t;
}

/** Auto-blend between photos (preview + export). */
export const DEFAULT_SEAMLESS_IMAGE_BLEND_SECONDS = 0.55;
export const MIN_SEAMLESS_IMAGE_BLEND_SECONDS = 0.35;
export const MAX_SEAMLESS_IMAGE_BLEND_SECONDS = 0.85;

function naturalImageCrossfadeSeconds(
  joint: TimelineJoint | undefined,
  seamlessImageBlendSeconds: number,
): number {
  const blend = clampSeamlessImageBlendSeconds(seamlessImageBlendSeconds);
  if (!joint || joint.transition === 'none') return blend;
  const userDur =
    joint.durationSeconds > 0 ? joint.durationSeconds : DEFAULT_SEAMLESS_IMAGE_BLEND_SECONDS;
  return Math.max(blend, userDur);
}

/** @deprecated Use DEFAULT_SEAMLESS_IMAGE_BLEND_SECONDS */
export const SEAMLESS_IMAGE_JOINT_SECONDS = DEFAULT_SEAMLESS_IMAGE_BLEND_SECONDS;

export function clampSeamlessImageBlendSeconds(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SEAMLESS_IMAGE_BLEND_SECONDS;
  return Math.min(
    MAX_SEAMLESS_IMAGE_BLEND_SECONDS,
    Math.max(MIN_SEAMLESS_IMAGE_BLEND_SECONDS, Math.round(parsed * 100) / 100),
  );
}

/** FFmpeg xfade limit (~45% of shorter clip). Export/preview clamp to this. */
export function capTransitionDurationForClips(
  durationSeconds: number,
  leftClipDuration: number,
  rightClipDuration: number,
): number {
  if (durationSeconds <= 0) return 0;
  const maxJoint = Math.min(leftClipDuration, rightClipDuration) * 0.45;
  return Math.min(durationSeconds, Math.max(0.12, maxJoint));
}

/**
 * Playback/export joint. Photo→photo always uses a soft crossfade (never a visible cut/wipe)
 * so slideshows read as one continuous video.
 */
export function effectiveTimelineJoint(
  joint: TimelineJoint | undefined,
  left: Pick<TimelineClip, 'kind'> | undefined,
  right: Pick<TimelineClip, 'kind'> | undefined,
  seamlessImageBlendSeconds: number = DEFAULT_SEAMLESS_IMAGE_BLEND_SECONDS,
): { transition: TimelineTransition; durationSeconds: number } {
  if (!joint || !left || !right) {
    return { transition: 'none', durationSeconds: 0 };
  }
  if (left.kind === 'image' && right.kind === 'image') {
    return {
      transition: 'fade',
      durationSeconds: naturalImageCrossfadeSeconds(joint, seamlessImageBlendSeconds),
    };
  }
  if (joint.transition === 'none' || joint.durationSeconds <= 0) {
    return { transition: 'none', durationSeconds: 0 };
  }
  return { transition: joint.transition, durationSeconds: joint.durationSeconds };
}

export interface TimelineStickerOverlay {
  id: string;
  emoji: string;
  startSeconds: number;
  durationSeconds: number;
  /** 0–100, horizontal position */
  x: number;
  /** 0–100, vertical position */
  y: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
}

export interface TimelineVoiceoverClip {
  id: string;
  sourceUrl: string;
  startSeconds: number;
  durationSeconds: number;
  trimIn?: number;
  volume?: number;
  label?: string;
}

export type TimelineTtsVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface TimelineTtsClip {
  id: string;
  text: string;
  voice?: TimelineTtsVoice;
  startSeconds: number;
  /** Known after synthesis; used for timeline UI width. */
  durationSeconds?: number;
  /** Populated at render time after synthesis. */
  generatedAudioUrl?: string;
}

export type TimelineTransition =
  | 'none'
  | 'fade'
  | 'fadeblack'
  | 'fadewhite'
  | 'fadefast'
  | 'fadeslow'
  | 'dissolve'
  | 'wipeleft'
  | 'wiperight'
  | 'wipeup'
  | 'wipedown'
  | 'slideleft'
  | 'slideright'
  | 'slideup'
  | 'slidedown'
  | 'smoothleft'
  | 'smoothright'
  | 'smoothup'
  | 'smoothdown'
  | 'circleopen'
  | 'circleclose'
  | 'radial'
  | 'zoomin'
  | 'coverleft'
  | 'coverright'
  | 'revealleft'
  | 'revealright'
  | 'diagtl'
  | 'diagtr'
  | 'distance'
  | 'hblur'
  | 'horzopen'
  | 'vertopen'
  | 'squeezeh'
  | 'squeezew';

export const TIMELINE_TRANSITION_LABELS: Record<TimelineTransition, string> = {
  none: 'Cut (no transition)',
  fade: 'Crossfade',
  fadeblack: 'Fade through black',
  fadewhite: 'Fade through white',
  fadefast: 'Quick fade',
  fadeslow: 'Cinematic slow fade',
  dissolve: 'Film dissolve',
  wipeleft: 'Wipe left',
  wiperight: 'Wipe right',
  wipeup: 'Wipe up',
  wipedown: 'Wipe down',
  slideleft: 'Slide left',
  slideright: 'Slide right',
  slideup: 'Slide up',
  slidedown: 'Slide down',
  smoothleft: 'Smooth push left',
  smoothright: 'Smooth push right',
  smoothup: 'Smooth push up',
  smoothdown: 'Smooth push down',
  circleopen: 'Circle open',
  circleclose: 'Circle close',
  radial: 'Radial spotlight',
  zoomin: 'Zoom in',
  coverleft: 'Cover left',
  coverright: 'Cover right',
  revealleft: 'Reveal left',
  revealright: 'Reveal right',
  diagtl: 'Diagonal wipe ↖',
  diagtr: 'Diagonal wipe ↗',
  distance: 'Distance warp',
  hblur: 'Motion blur blend',
  horzopen: 'Horizontal blinds open',
  vertopen: 'Vertical blinds open',
  squeezeh: 'Squeeze horizontal',
  squeezew: 'Squeeze vertical',
};

/** Maps editor transition ids to FFmpeg `xfade` transition names. */
const FFMPEG_XFADE_TRANSITION: Partial<Record<TimelineTransition, string>> = {
  none: undefined,
  fade: 'fade',
  fadeblack: 'fadeblack',
  fadewhite: 'fadewhite',
  fadefast: 'fadefast',
  fadeslow: 'fadeslow',
  dissolve: 'fadegrays',
  wipeleft: 'wipeleft',
  wiperight: 'wiperight',
  wipeup: 'wipeup',
  wipedown: 'wipedown',
  slideleft: 'slideleft',
  slideright: 'slideright',
  slideup: 'slideup',
  slidedown: 'slidedown',
  smoothleft: 'smoothleft',
  smoothright: 'smoothright',
  smoothup: 'smoothup',
  smoothdown: 'smoothdown',
  circleopen: 'circleopen',
  circleclose: 'circleclose',
  radial: 'radial',
  zoomin: 'zoomin',
  coverleft: 'coverleft',
  coverright: 'coverright',
  revealleft: 'revealleft',
  revealright: 'revealright',
  diagtl: 'diagtl',
  diagtr: 'diagtr',
  distance: 'distance',
  hblur: 'hblur',
  horzopen: 'horzopen',
  vertopen: 'vertopen',
  squeezeh: 'squeezeh',
  squeezew: 'squeezew',
};

/** FFmpeg xfade transition name (null = hard cut). */
export function transitionToFfmpeg(transition: TimelineTransition): string | null {
  if (transition === 'none') return null;
  return FFMPEG_XFADE_TRANSITION[transition] ?? 'fade';
}

export const TIMELINE_TRANSITIONS: TimelineTransition[] = Object.keys(
  TIMELINE_TRANSITION_LABELS,
) as TimelineTransition[];

export interface TimelineClip {
  id: string;
  kind: TimelineClipKind;
  sourceUrl: string;
  assetId?: string;
  label?: string;
  /** Required for image clips (seconds on timeline). */
  durationSeconds?: number;
  /** Video trim in (seconds from start). */
  trimIn?: number;
  /** Video trim out (seconds from start); omit = use full length. */
  trimOut?: number;
  /** Playback speed multiplier (0.25–4). */
  speed?: number;
  reverse?: boolean;
  flipHorizontal?: boolean;
  rotation?: 0 | 90 | 180 | 270;
  /** Clip audio level for video clips (0–1). */
  volume?: number;
  filter?: TimelineFilterPreset;
  adjustments?: TimelineClipAdjustments;
  videoEffect?: TimelineVideoEffect;
  chromaKey?: TimelineChromaKey;
  kenBurns?: TimelineKenBurns;
  /** Scale crop 1–2 (CapCut-style punch-in). */
  cropZoom?: number;
  /** Whole-clip opacity 0–1 (default 1). */
  opacity?: number;
  crop?: TimelineClipCrop;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
}

export interface TimelineJoint {
  transition: TimelineTransition;
  durationSeconds: number;
}

export interface EditorTimeline {
  version: 1;
  platform: EditorPlatform;
  width: number;
  height: number;
  fps: number;
  clips: TimelineClip[];
  joints: TimelineJoint[];
  backgroundMusicTrackId?: string | null;
  backgroundMusicVolume?: number;
  /** Burned-in captions/titles on export. */
  textOverlays?: TimelineTextOverlay[];
  /** When true, keep clip audio and mix background music underneath. */
  mixOriginalAudioWithMusic?: boolean;
  stickerOverlays?: TimelineStickerOverlay[];
  voiceoverClips?: TimelineVoiceoverClip[];
  ttsClips?: TimelineTtsClip[];
  pipLayers?: TimelinePipLayer[];
  /** Brief dissolve for photo→photo joints set to Cut (see clampSeamlessImageBlendSeconds). */
  seamlessImageBlendSeconds?: number;
}

export const EDITOR_PLATFORM_SPECS: Record<
  EditorPlatform,
  { width: number; height: number; maxLengthSeconds: number; fps: number }
> = {
  instagram: { width: 1080, height: 1080, maxLengthSeconds: 60, fps: 30 },
  facebook: { width: 1080, height: 1080, maxLengthSeconds: 240, fps: 30 },
  youtube: { width: 1920, height: 1080, maxLengthSeconds: 900, fps: 30 },
};

export const DEFAULT_IMAGE_CLIP_SECONDS = 3;

/** Zoom change per second of slide duration so a ~3s slide matches legacy ~0.012/step feel. */
const KEN_BURNS_RAMP_PER_SECOND = KEN_BURNS_STEP / DEFAULT_IMAGE_CLIP_SECONDS;

type KenBurnsDurationSource = Record<string, number> | Map<string, number> | undefined;

function clipSecondsForKenBurns(
  clip: Pick<TimelineClip, 'kind' | 'id' | 'durationSeconds' | 'speed' | 'trimIn' | 'trimOut'>,
  videoDurations?: KenBurnsDurationSource,
): number {
  if (clip.kind === 'image') {
    const segment = clip.durationSeconds ?? DEFAULT_IMAGE_CLIP_SECONDS;
    const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
    return segment / speed;
  }
  const full =
    videoDurations instanceof Map ? videoDurations.get(clip.id) : videoDurations?.[clip.id];
  if (full != null && Number.isFinite(full)) {
    const trimIn = clip.trimIn ?? 0;
    const trimOut = clip.trimOut ?? full;
    const segment = Math.max(0.1, trimOut - trimIn);
    const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
    return segment / speed;
  }
  return 5;
}

/**
 * Zoom level at the **start** of clip `slideIndex` when Ken Burns runs continuously
 * across consecutive image clips (no jump at crossfades).
 */
export function continuousKenBurnsZoomAtClipStart(
  timeline: Pick<EditorTimeline, 'clips'>,
  slideIndex: number,
  videoDurations?: KenBurnsDurationSource,
): number {
  const clips = timeline.clips;
  if (slideIndex <= 0 || !clips.length) return 1;
  let z = 1;
  for (let i = 0; i < slideIndex; i += 1) {
    const c = clips[i];
    if (!c || c.kind !== 'image' || c.kenBurns?.enabled === false) {
      z = 1;
      continue;
    }
    const seg = clipSecondsForKenBurns(c, videoDurations);
    z = Math.min(KEN_BURNS_MAX, z + seg * KEN_BURNS_RAMP_PER_SECOND);
  }
  return z;
}

/** One clip segment: zoom from cumulative start to cumulative end (matches FFmpeg zoompan). */
export function continuousKenBurnsForSlide(
  timeline: Pick<EditorTimeline, 'clips'>,
  slideIndex: number,
  clip: Pick<
    TimelineClip,
    'kind' | 'kenBurns' | 'id' | 'durationSeconds' | 'speed' | 'trimIn' | 'trimOut'
  >,
  videoDurations?: KenBurnsDurationSource,
): TimelineKenBurns {
  const zStart = continuousKenBurnsZoomAtClipStart(timeline, slideIndex, videoDurations);
  const seg = clipSecondsForKenBurns(clip, videoDurations);
  const zEnd = Math.min(KEN_BURNS_MAX, zStart + seg * KEN_BURNS_RAMP_PER_SECOND);
  return {
    enabled: true,
    zoomFrom: zStart,
    zoomTo: zEnd > zStart + 0.001 ? zEnd : Math.min(KEN_BURNS_MAX, zStart + KEN_BURNS_STEP),
  };
}

/** Continuous slow zoom across slides so cuts/crossfades do not “pop” scale. */
export function defaultKenBurnsForSlideIndex(index: number): TimelineKenBurns {
  const zoomFrom = Math.min(KEN_BURNS_MAX, 1 + Math.max(0, index) * KEN_BURNS_STEP);
  let zoomTo = Math.min(KEN_BURNS_MAX, 1 + (index + 1) * KEN_BURNS_STEP);
  if (zoomTo <= zoomFrom + 0.005) {
    zoomTo = Math.min(KEN_BURNS_MAX, zoomFrom + KEN_BURNS_STEP);
  }
  return { enabled: true, zoomFrom, zoomTo };
}

export type ResolveImageKenBurnsContext = {
  timeline: Pick<EditorTimeline, 'clips'>;
  videoDurations?: KenBurnsDurationSource;
};

/** Ken Burns for export/preview: explicit clip setting, otherwise gentle default motion. */
export function resolveImageKenBurns(
  clip: Pick<
    TimelineClip,
    'kind' | 'kenBurns' | 'id' | 'durationSeconds' | 'speed' | 'trimIn' | 'trimOut'
  >,
  slideIndex: number,
  context?: ResolveImageKenBurnsContext,
): TimelineKenBurns | undefined {
  if (clip.kind !== 'image') return undefined;
  if (clip.kenBurns && clip.kenBurns.enabled === false) return undefined;

  const hasCustomZoom =
    clip.kenBurns?.enabled === true &&
    (clip.kenBurns.zoomFrom != null || clip.kenBurns.zoomTo != null);

  if (hasCustomZoom) {
    return {
      enabled: true,
      zoomFrom: clip.kenBurns!.zoomFrom ?? 1,
      zoomTo: clip.kenBurns!.zoomTo ?? 1.1,
    };
  }

  if (context?.timeline?.clips?.length) {
    return continuousKenBurnsForSlide(context.timeline, slideIndex, clip, context.videoDurations);
  }

  return defaultKenBurnsForSlideIndex(slideIndex);
}

export const MIN_JOINT_DURATION = 0.15;
export const MAX_JOINT_DURATION = 2;
export const MAX_CLIPS = 40;
export const MIN_CLIP_SPEED = 0.25;
export const MAX_CLIP_SPEED = 4;
export const MAX_TEXT_OVERLAYS = 40;
export const MAX_STICKER_OVERLAYS = 30;
export const MAX_VOICEOVER_CLIPS = 10;
export const MAX_TTS_CLIPS = 10;
export const MAX_PIP_LAYERS = 8;

export const EDITOR_TEXT_PRESETS = [
  { id: 'classic', label: 'Classic white', textColor: 'ffffff', showBackground: true },
  { id: 'bold-yellow', label: 'Bold yellow', textColor: 'fde047', strokeColor: '000000', strokeWidth: 2, showBackground: false },
  { id: 'minimal', label: 'Minimal', textColor: 'ffffff', showBackground: false, shadow: true },
  { id: 'brand', label: 'Brand pink', textColor: 'f472b6', strokeColor: 'ffffff', strokeWidth: 1, showBackground: true },
] as const;

export function clampLayerOpacity(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n >= 0.999) return undefined;
  return Math.min(1, Math.max(0, n));
}

function clampClipSpeed(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 1) return undefined;
  return Math.min(MAX_CLIP_SPEED, Math.max(MIN_CLIP_SPEED, n));
}

function normalizeClipAdjustments(raw: unknown): TimelineClipAdjustments | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const a = raw as Record<string, unknown>;
  const clamp = (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return undefined;
    return Math.min(100, Math.max(-100, Math.round(n)));
  };
  const brightness = clamp(a.brightness);
  const contrast = clamp(a.contrast);
  const saturation = clamp(a.saturation);
  if (brightness == null && contrast == null && saturation == null) return undefined;
  return { brightness, contrast, saturation };
}

function normalizeTextOverlay(raw: unknown, index: number): TimelineTextOverlay {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Text overlay ${index + 1} is invalid`);
  }
  const o = raw as Record<string, unknown>;
  const text = typeof o.text === 'string' ? o.text.trim() : '';
  if (!text) throw new Error(`Text overlay ${index + 1}: text is required`);
  const startSeconds = Number(o.startSeconds);
  const durationSeconds = Number(o.durationSeconds);
  if (!Number.isFinite(startSeconds) || startSeconds < 0) {
    throw new Error(`Text overlay ${index + 1}: startSeconds must be >= 0`);
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0.2 || durationSeconds > 120) {
    throw new Error(`Text overlay ${index + 1}: duration must be between 0.2s and 120s`);
  }
  const position = o.position as TimelineTextPosition;
  const pos: TimelineTextPosition =
    position === 'top' || position === 'bottom' ? position : 'center';
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `text-${index}`;
  const fontSizeRaw = o.fontSize != null ? Number(o.fontSize) : 48;
  const fontSize = Number.isFinite(fontSizeRaw)
    ? Math.min(120, Math.max(18, Math.round(fontSizeRaw)))
    : 48;
  const anim = o.animation as TimelineTextAnimation;
  const animation: TimelineTextAnimation | undefined =
    anim === 'fadeIn' || anim === 'popIn' || anim === 'slideUp' ? anim : undefined;
  const opacity = clampLayerOpacity(o.opacity);
  const hex = (v: unknown) => {
    const s = typeof v === 'string' ? v.replace(/^#/, '').trim() : '';
    return /^[0-9a-fA-F]{6}$/.test(s) ? s : undefined;
  };
  const overlay: TimelineTextOverlay = {
    id,
    text,
    startSeconds,
    durationSeconds,
    position: pos,
    fontSize,
    animation,
    opacity,
  };
  const textColor = hex(o.textColor);
  if (textColor) overlay.textColor = textColor;
  const strokeColor = hex(o.strokeColor);
  if (strokeColor) overlay.strokeColor = strokeColor;
  if (o.strokeWidth != null) {
    const sw = Number(o.strokeWidth);
    if (Number.isFinite(sw) && sw > 0) overlay.strokeWidth = Math.min(8, sw);
  }
  if (o.shadow === true) overlay.shadow = true;
  if (o.showBackground === false) overlay.showBackground = false;
  else if (o.showBackground === true) overlay.showBackground = true;
  if (o.x != null) {
    const x = Number(o.x);
    if (Number.isFinite(x)) overlay.x = Math.min(100, Math.max(0, x));
  }
  if (o.y != null) {
    const y = Number(o.y);
    if (Number.isFinite(y)) overlay.y = Math.min(100, Math.max(0, y));
  }
  return overlay;
}

function normalizeClipCrop(raw: unknown): TimelineClipCrop | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Record<string, unknown>;
  const x = Number(c.x);
  const y = Number(c.y);
  const w = Number(c.w);
  const h = Number(c.h);
  if (![x, y, w, h].every(Number.isFinite)) return undefined;
  if (w <= 0.05 || h <= 0.05) return undefined;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    w: Math.min(1, Math.max(0.05, w)),
    h: Math.min(1, Math.max(0.05, h)),
  };
}

function normalizePipLayer(raw: unknown, index: number): TimelinePipLayer {
  if (!raw || typeof raw !== 'object') throw new Error(`PiP layer ${index + 1} is invalid`);
  const p = raw as Record<string, unknown>;
  const kind = p.kind;
  if (kind !== 'image' && kind !== 'video') throw new Error(`PiP layer ${index + 1}: invalid kind`);
  const sourceUrl = typeof p.sourceUrl === 'string' ? p.sourceUrl.trim() : '';
  if (!sourceUrl.startsWith('http')) throw new Error(`PiP layer ${index + 1}: sourceUrl required`);
  const startSeconds = Number(p.startSeconds);
  const durationSeconds = Number(p.durationSeconds);
  if (!Number.isFinite(startSeconds) || startSeconds < 0) {
    throw new Error(`PiP layer ${index + 1}: invalid start`);
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0.2) {
    throw new Error(`PiP layer ${index + 1}: invalid duration`);
  }
  const id = typeof p.id === 'string' && p.id.trim() ? p.id.trim() : `pip-${index}`;
  const x = Number(p.x);
  const y = Number(p.y);
  const layer: TimelinePipLayer = {
    id,
    kind,
    sourceUrl,
    startSeconds,
    durationSeconds,
    x: Number.isFinite(x) ? Math.min(100, Math.max(0, x)) : 50,
    y: Number.isFinite(y) ? Math.min(100, Math.max(0, y)) : 50,
  };
  if (p.widthPercent != null) {
    layer.widthPercent = Math.min(100, Math.max(10, Number(p.widthPercent)));
  }
  layer.opacity = clampLayerOpacity(p.opacity);
  if (p.trimIn != null) layer.trimIn = Math.max(0, Number(p.trimIn));
  if (p.trimOut != null) layer.trimOut = Number(p.trimOut);
  if (p.borderRadius != null) layer.borderRadius = Math.min(48, Math.max(0, Number(p.borderRadius)));
  return layer;
}

function normalizeChromaKey(raw: unknown): TimelineChromaKey | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Record<string, unknown>;
  if (c.enabled !== true) return undefined;
  const color = typeof c.color === 'string' ? c.color.replace(/^#/, '').trim() : '00ff00';
  const similarity = c.similarity != null ? Number(c.similarity) : 0.15;
  const blend = c.blend != null ? Number(c.blend) : 0.08;
  return {
    enabled: true,
    color: /^[0-9a-fA-F]{6}$/.test(color) ? color : '00ff00',
    similarity: Math.min(1, Math.max(0.01, similarity)),
    blend: Math.min(1, Math.max(0, blend)),
  };
}

function normalizeKenBurns(raw: unknown): TimelineKenBurns | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const k = raw as Record<string, unknown>;
  if (k.enabled === false) return { enabled: false };
  if (k.enabled !== true) return undefined;
  const zoomFrom = k.zoomFrom != null ? Number(k.zoomFrom) : 1;
  const zoomTo = k.zoomTo != null ? Number(k.zoomTo) : 1.12;
  return {
    enabled: true,
    zoomFrom: Math.min(2, Math.max(1, zoomFrom)),
    zoomTo: Math.min(2, Math.max(1, zoomTo)),
  };
}

function normalizeSticker(raw: unknown, index: number): TimelineStickerOverlay {
  if (!raw || typeof raw !== 'object') throw new Error(`Sticker ${index + 1} is invalid`);
  const s = raw as Record<string, unknown>;
  const emoji = typeof s.emoji === 'string' ? s.emoji.trim() : '';
  if (!emoji) throw new Error(`Sticker ${index + 1}: emoji is required`);
  const startSeconds = Number(s.startSeconds);
  const durationSeconds = Number(s.durationSeconds);
  if (!Number.isFinite(startSeconds) || startSeconds < 0) {
    throw new Error(`Sticker ${index + 1}: invalid start`);
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0.2) {
    throw new Error(`Sticker ${index + 1}: invalid duration`);
  }
  const x = Number(s.x);
  const y = Number(s.y);
  const id = typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `sticker-${index}`;
  const scale = s.scale != null ? Math.min(3, Math.max(0.3, Number(s.scale))) : undefined;
  const rotation = s.rotation != null ? Number(s.rotation) : undefined;
  return {
    id,
    emoji,
    startSeconds,
    durationSeconds,
    x: Number.isFinite(x) ? Math.min(100, Math.max(0, x)) : 50,
    y: Number.isFinite(y) ? Math.min(100, Math.max(0, y)) : 50,
    scale,
    rotation: Number.isFinite(rotation) ? rotation : undefined,
    opacity: clampLayerOpacity(s.opacity),
  };
}

function normalizeVoiceover(raw: unknown, index: number): TimelineVoiceoverClip {
  if (!raw || typeof raw !== 'object') throw new Error(`Voiceover ${index + 1} is invalid`);
  const v = raw as Record<string, unknown>;
  const sourceUrl = typeof v.sourceUrl === 'string' ? v.sourceUrl.trim() : '';
  if (!sourceUrl.startsWith('http')) throw new Error(`Voiceover ${index + 1}: sourceUrl required`);
  const startSeconds = Number(v.startSeconds);
  const durationSeconds = Number(v.durationSeconds);
  if (!Number.isFinite(startSeconds) || startSeconds < 0) {
    throw new Error(`Voiceover ${index + 1}: invalid start`);
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0.2) {
    throw new Error(`Voiceover ${index + 1}: invalid duration`);
  }
  const id = typeof v.id === 'string' && v.id.trim() ? v.id.trim() : `vo-${index}`;
  const clip: TimelineVoiceoverClip = { id, sourceUrl, startSeconds, durationSeconds };
  if (typeof v.label === 'string' && v.label.trim()) clip.label = v.label.trim();
  if (v.trimIn != null) clip.trimIn = Math.max(0, Number(v.trimIn));
  if (v.volume != null) clip.volume = Math.min(1, Math.max(0, Number(v.volume)));
  return clip;
}

function normalizeTtsClip(raw: unknown, index: number): TimelineTtsClip {
  if (!raw || typeof raw !== 'object') throw new Error(`TTS ${index + 1} is invalid`);
  const t = raw as Record<string, unknown>;
  const text = typeof t.text === 'string' ? t.text.trim() : '';
  if (!text) throw new Error(`TTS ${index + 1}: text required`);
  const startSeconds = Number(t.startSeconds);
  if (!Number.isFinite(startSeconds) || startSeconds < 0) {
    throw new Error(`TTS ${index + 1}: invalid start`);
  }
  const id = typeof t.id === 'string' && t.id.trim() ? t.id.trim() : `tts-${index}`;
  const voice = t.voice as TimelineTtsVoice;
  const allowed: TimelineTtsVoice[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  const clip: TimelineTtsClip = {
    id,
    text,
    startSeconds,
    voice: allowed.includes(voice) ? voice : 'nova',
  };
  if (typeof t.generatedAudioUrl === 'string' && t.generatedAudioUrl.startsWith('http')) {
    clip.generatedAudioUrl = t.generatedAudioUrl;
  }
  const dur = Number(t.durationSeconds);
  if (Number.isFinite(dur) && dur > 0) {
    clip.durationSeconds = dur;
  }
  return clip;
}

export function defaultJointsForClipCount(count: number): TimelineJoint[] {
  const joints: TimelineJoint[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    joints.push({ transition: 'fade', durationSeconds: 0.65 });
  }
  return joints;
}

export function normalizeEditorTimeline(raw: unknown): EditorTimeline {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Timeline must be an object');
  }
  const input = raw as Record<string, unknown>;
  const platform = input.platform as EditorPlatform;
  if (!EDITOR_PLATFORM_SPECS[platform]) {
    throw new Error('platform must be instagram, facebook, or youtube');
  }
  const spec = EDITOR_PLATFORM_SPECS[platform];
  const clipsRaw = input.clips;
  if (!Array.isArray(clipsRaw) || clipsRaw.length === 0) {
    throw new Error('At least one clip is required');
  }
  if (clipsRaw.length > MAX_CLIPS) {
    throw new Error(`At most ${MAX_CLIPS} clips are allowed`);
  }

  const clips: TimelineClip[] = clipsRaw.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Clip ${index + 1} is invalid`);
    }
    const c = item as Record<string, unknown>;
    const kind = c.kind;
    if (kind !== 'image' && kind !== 'video') {
      throw new Error(`Clip ${index + 1}: kind must be image or video`);
    }
    const sourceUrl = typeof c.sourceUrl === 'string' ? c.sourceUrl.trim() : '';
    if (!sourceUrl.startsWith('http')) {
      throw new Error(`Clip ${index + 1}: sourceUrl must be a public URL`);
    }
    const id = typeof c.id === 'string' && c.id.trim() ? c.id.trim() : `clip-${index}`;
    const clip: TimelineClip = { id, kind, sourceUrl };
    if (typeof c.assetId === 'string' && c.assetId.trim()) clip.assetId = c.assetId.trim();
    if (typeof c.label === 'string' && c.label.trim()) clip.label = c.label.trim();

    if (kind === 'image') {
      const duration = Number(c.durationSeconds);
      if (!Number.isFinite(duration) || duration < 0.3 || duration > 120) {
        throw new Error(`Clip ${index + 1}: image duration must be between 0.3s and 120s`);
      }
      clip.durationSeconds = duration;
    } else {
      const trimIn = c.trimIn != null ? Number(c.trimIn) : 0;
      if (!Number.isFinite(trimIn) || trimIn < 0) {
        throw new Error(`Clip ${index + 1}: trimIn must be >= 0`);
      }
      clip.trimIn = trimIn;
      if (c.trimOut != null) {
        const trimOut = Number(c.trimOut);
        if (!Number.isFinite(trimOut) || trimOut <= trimIn) {
          throw new Error(`Clip ${index + 1}: trimOut must be greater than trimIn`);
        }
        clip.trimOut = trimOut;
      }
    }

    const speed = clampClipSpeed(c.speed);
    if (speed != null) clip.speed = speed;
    if (c.reverse === true) clip.reverse = true;
    if (c.flipHorizontal === true) clip.flipHorizontal = true;
    const rot = Number(c.rotation);
    if (rot === 90 || rot === 180 || rot === 270) clip.rotation = rot;
    if (c.volume != null) {
      const vol = Number(c.volume);
      if (Number.isFinite(vol)) clip.volume = Math.min(1, Math.max(0, vol));
    }
    const filter = c.filter as TimelineFilterPreset;
    if (filter && TIMELINE_FILTER_PRESETS.includes(filter) && filter !== 'none') {
      clip.filter = filter;
    }
    const adjustments = normalizeClipAdjustments(c.adjustments);
    if (adjustments) clip.adjustments = adjustments;

    const effect = c.videoEffect as TimelineVideoEffect;
    if (effect && TIMELINE_VIDEO_EFFECT_LABELS[effect]) clip.videoEffect = effect;
    const chromaKey = normalizeChromaKey(c.chromaKey);
    if (chromaKey) clip.chromaKey = chromaKey;
    const kenBurns = normalizeKenBurns(c.kenBurns);
    if (kenBurns) clip.kenBurns = kenBurns;
    if (c.cropZoom != null) {
      const z = Number(c.cropZoom);
      if (Number.isFinite(z) && z > 1.001) clip.cropZoom = Math.min(2, z);
    }
    const clipOpacity = clampLayerOpacity(c.opacity);
    if (clipOpacity != null) clip.opacity = clipOpacity;
    const crop = normalizeClipCrop(c.crop);
    if (crop) clip.crop = crop;
    if (c.fadeInSeconds != null) {
      const fi = Number(c.fadeInSeconds);
      if (Number.isFinite(fi) && fi > 0.05) clip.fadeInSeconds = Math.min(2, fi);
    }
    if (c.fadeOutSeconds != null) {
      const fo = Number(c.fadeOutSeconds);
      if (Number.isFinite(fo) && fo > 0.05) clip.fadeOutSeconds = Math.min(2, fo);
    }

    return clip;
  });

  const expectedJoints = clips.length - 1;
  let joints: TimelineJoint[] = [];
  if (expectedJoints > 0) {
    const jointsRaw = input.joints;
    if (!Array.isArray(jointsRaw)) {
      joints = defaultJointsForClipCount(clips.length);
    } else {
      if (jointsRaw.length !== expectedJoints) {
        throw new Error(`Expected ${expectedJoints} transition(s) between clips`);
      }
      joints = jointsRaw.map((item, index) => {
        if (!item || typeof item !== 'object') {
          throw new Error(`Transition ${index + 1} is invalid`);
        }
        const j = item as Record<string, unknown>;
        const transition = j.transition as TimelineTransition;
        if (!TIMELINE_TRANSITIONS.includes(transition)) {
          throw new Error(`Transition ${index + 1}: unknown transition type`);
        }
        const durationSeconds = Number(j.durationSeconds);
        if (transition !== 'none') {
          if (!Number.isFinite(durationSeconds) || durationSeconds < MIN_JOINT_DURATION || durationSeconds > MAX_JOINT_DURATION) {
            throw new Error(
              `Transition ${index + 1}: duration must be between ${MIN_JOINT_DURATION}s and ${MAX_JOINT_DURATION}s`,
            );
          }
        }
        return {
          transition,
          durationSeconds: transition === 'none' ? 0 : durationSeconds,
        };
      });
    }
  }

  const width = Number(input.width) || spec.width;
  const height = Number(input.height) || spec.height;
  const fps = Number(input.fps) || spec.fps;

  const timeline: EditorTimeline = {
    version: 1,
    platform,
    width,
    height,
    fps,
    clips,
    joints,
  };

  if (input.backgroundMusicTrackId === null) {
    timeline.backgroundMusicTrackId = null;
  } else if (typeof input.backgroundMusicTrackId === 'string' && input.backgroundMusicTrackId.trim()) {
    timeline.backgroundMusicTrackId = input.backgroundMusicTrackId.trim();
  }
  if (input.backgroundMusicVolume != null) {
    const vol = Number(input.backgroundMusicVolume);
    if (Number.isFinite(vol)) {
      timeline.backgroundMusicVolume = Math.min(1, Math.max(0, vol));
    }
  }

  if (Array.isArray(input.textOverlays) && input.textOverlays.length > 0) {
    if (input.textOverlays.length > MAX_TEXT_OVERLAYS) {
      throw new Error(`At most ${MAX_TEXT_OVERLAYS} text overlays are allowed`);
    }
    timeline.textOverlays = input.textOverlays.map((item, index) => normalizeTextOverlay(item, index));
  }

  if (input.mixOriginalAudioWithMusic === false) {
    timeline.mixOriginalAudioWithMusic = false;
  } else if (timeline.backgroundMusicTrackId) {
    timeline.mixOriginalAudioWithMusic = true;
  }

  if (Array.isArray(input.stickerOverlays) && input.stickerOverlays.length > 0) {
    if (input.stickerOverlays.length > MAX_STICKER_OVERLAYS) {
      throw new Error(`At most ${MAX_STICKER_OVERLAYS} stickers allowed`);
    }
    timeline.stickerOverlays = input.stickerOverlays.map((item, index) => normalizeSticker(item, index));
  }

  if (Array.isArray(input.voiceoverClips) && input.voiceoverClips.length > 0) {
    if (input.voiceoverClips.length > MAX_VOICEOVER_CLIPS) {
      throw new Error(`At most ${MAX_VOICEOVER_CLIPS} voiceover clips allowed`);
    }
    timeline.voiceoverClips = input.voiceoverClips.map((item, index) => normalizeVoiceover(item, index));
  }

  if (Array.isArray(input.ttsClips) && input.ttsClips.length > 0) {
    if (input.ttsClips.length > MAX_TTS_CLIPS) {
      throw new Error(`At most ${MAX_TTS_CLIPS} TTS clips allowed`);
    }
    timeline.ttsClips = input.ttsClips.map((item, index) => normalizeTtsClip(item, index));
  }

  if (Array.isArray(input.pipLayers) && input.pipLayers.length > 0) {
    if (input.pipLayers.length > MAX_PIP_LAYERS) {
      throw new Error(`At most ${MAX_PIP_LAYERS} PiP layers allowed`);
    }
    timeline.pipLayers = input.pipLayers.map((item, index) => normalizePipLayer(item, index));
  }

  if (input.seamlessImageBlendSeconds != null) {
    timeline.seamlessImageBlendSeconds = clampSeamlessImageBlendSeconds(input.seamlessImageBlendSeconds);
  }

  return timeline;
}

/** Rough output length for UI warnings (ignores transition overlap). */
function clipSegmentSeconds(
  clip: TimelineClip,
  videoDurations?: Map<string, number>,
): number {
  let segment = 0;
  if (clip.kind === 'image') {
    segment = clip.durationSeconds ?? DEFAULT_IMAGE_CLIP_SECONDS;
  } else {
    const full = videoDurations?.get(clip.id);
    if (full != null && Number.isFinite(full)) {
      const trimIn = clip.trimIn ?? 0;
      const trimOut = clip.trimOut ?? full;
      segment = Math.max(0.1, trimOut - trimIn);
    } else {
      segment = 5;
    }
  }
  const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
  return segment / speed;
}

export function estimateTimelineDurationSeconds(timeline: EditorTimeline, videoDurations?: Map<string, number>): number {
  let total = 0;
  for (const clip of timeline.clips) {
    total += clipSegmentSeconds(clip, videoDurations);
  }
  for (let i = 0; i < timeline.joints.length; i += 1) {
    const joint = timeline.joints[i];
    const left = timeline.clips[i];
    const right = timeline.clips[i + 1];
    const blend = clampSeamlessImageBlendSeconds(timeline.seamlessImageBlendSeconds);
    const { durationSeconds } = effectiveTimelineJoint(joint, left, right, blend);
    if (durationSeconds > 0) total -= durationSeconds;
  }
  return Math.max(0.1, total);
}

export function validateTimelineAgainstClipDurations(
  timeline: EditorTimeline,
  clipDurations: number[],
): void {
  if (clipDurations.length !== timeline.clips.length) {
    throw new Error('Internal error: clip duration count mismatch');
  }
  const maxLen = EDITOR_PLATFORM_SPECS[timeline.platform].maxLengthSeconds;
  const estimated = estimateTimelineDurationSeconds(
    timeline,
    new Map(timeline.clips.map((c, i) => [c.id, clipDurations[i]])),
  );
  if (estimated > maxLen + 0.5) {
    throw new Error(
      `Timeline is about ${Math.ceil(estimated)}s but ${timeline.platform} allows ~${maxLen}s. Shorten clips or trims.`,
    );
  }

  for (let i = 0; i < timeline.joints.length; i += 1) {
    const joint = timeline.joints[i];
    const leftClip = timeline.clips[i];
    const rightClip = timeline.clips[i + 1];
    const blend = clampSeamlessImageBlendSeconds(timeline.seamlessImageBlendSeconds);
    const effective = effectiveTimelineJoint(joint, leftClip, rightClip, blend);
    if (effective.durationSeconds <= 0) continue;
    const left = clipDurations[i];
    const right = clipDurations[i + 1];
    const capped = capTransitionDurationForClips(effective.durationSeconds, left, right);
    if (capped < 0.1) {
      throw new Error(
        `Transition ${i + 1}: clips are too short for a crossfade. Use longer slides or fewer photos.`,
      );
    }
  }
}

export function createEmptyTimeline(platform: EditorPlatform = 'youtube'): EditorTimeline {
  const spec = EDITOR_PLATFORM_SPECS[platform];
  return {
    version: 1,
    platform,
    width: spec.width,
    height: spec.height,
    fps: spec.fps,
    clips: [],
    joints: [],
  };
}
