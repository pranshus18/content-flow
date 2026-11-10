export {
  type EditorPlatform,
  type TimelineClip,
  type TimelineClipKind,
  type TimelineClipAdjustments,
  type TimelineFilterPreset,
  type TimelineTextOverlay,
  type TimelineTextPosition,
  type TimelineTextAnimation,
  type TimelineStickerOverlay,
  type TimelineVoiceoverClip,
  type TimelineTtsClip,
  type TimelineTtsVoice,
  type TimelineVideoEffect,
  type TimelineChromaKey,
  type TimelineKenBurns,
  type ResolveImageKenBurnsContext,
  defaultKenBurnsForSlideIndex,
  continuousKenBurnsForSlide,
  continuousKenBurnsZoomAtClipStart,
  resolveImageKenBurns,
  kenBurnsZoomAtProgress,
  effectiveTimelineJoint,
  clampSeamlessImageBlendSeconds,
  DEFAULT_SEAMLESS_IMAGE_BLEND_SECONDS,
  MIN_SEAMLESS_IMAGE_BLEND_SECONDS,
  MAX_SEAMLESS_IMAGE_BLEND_SECONDS,
  SEAMLESS_IMAGE_JOINT_SECONDS,
  type TimelinePipLayer,
  type TimelineClipCrop,
  TIMELINE_VIDEO_EFFECT_LABELS,
  MAX_STICKER_OVERLAYS,
  MAX_VOICEOVER_CLIPS,
  MAX_TTS_CLIPS,
  MAX_PIP_LAYERS,
  EDITOR_TEXT_PRESETS,
  type TimelineJoint,
  type TimelineTransition,
  type EditorTimeline,
  TIMELINE_TRANSITION_LABELS,
  TIMELINE_TRANSITIONS,
  TIMELINE_FILTER_LABELS,
  TIMELINE_FILTER_PRESETS,
  EDITOR_PLATFORM_SPECS,
  DEFAULT_IMAGE_CLIP_SECONDS,
  MIN_JOINT_DURATION,
  MAX_JOINT_DURATION,
  MIN_CLIP_SPEED,
  MAX_CLIP_SPEED,
  MAX_TEXT_OVERLAYS,
  createEmptyTimeline,
  defaultJointsForClipCount,
  estimateTimelineDurationSeconds,
  normalizeEditorTimeline,
  clampLayerOpacity,
} from '../../../shared/editor-timeline';

import type {
  EditorPlatform,
  TimelineClip,
  EditorTimeline,
  TimelineJoint,
  TimelineTextOverlay,
  TimelineStickerOverlay,
  TimelineVoiceoverClip,
  TimelineTtsClip,
  TimelinePipLayer,
} from '../../../shared/editor-timeline';
import {
  createEmptyTimeline,
  defaultJointsForClipCount,
  defaultKenBurnsForSlideIndex,
  EDITOR_PLATFORM_SPECS,
  DEFAULT_IMAGE_CLIP_SECONDS,
  MIN_JOINT_DURATION,
} from '../../../shared/editor-timeline';

const LOCAL_DRAFT_KEY = 'content-flow-editor-draft-v1';

export function loadLocalEditorDraft(): EditorTimeline | null {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EditorTimeline;
  } catch {
    return null;
  }
}

export function saveLocalEditorDraft(timeline: EditorTimeline) {
  localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(timeline));
}

export function clearLocalEditorDraft() {
  localStorage.removeItem(LOCAL_DRAFT_KEY);
}

export function resolveEditorPlatform(
  value: string | null | undefined,
  fallback: EditorPlatform = 'youtube',
): EditorPlatform {
  if (value === 'youtube') return 'youtube';
  // Instagram / Facebook hidden in UI for now — studio uses YouTube (16:9) specs.
  if (value === 'instagram' || value === 'facebook') return 'youtube';
  return fallback;
}

export function setTimelinePlatform(timeline: EditorTimeline, platform: EditorPlatform): EditorTimeline {
  const spec = EDITOR_PLATFORM_SPECS[resolveEditorPlatform(platform)] ?? EDITOR_PLATFORM_SPECS.youtube;
  return {
    ...timeline,
    platform,
    width: spec.width,
    height: spec.height,
    fps: spec.fps,
  };
}

/** Append many clips at once; new gaps use `defaultJoint` (existing joints between older clips are kept). */
export function addClipsBatchToTimeline(
  timeline: EditorTimeline,
  newClips: TimelineClip[],
  defaultJoint: TimelineJoint = { transition: 'fade', durationSeconds: 0.5 },
): EditorTimeline {
  if (!newClips.length) return timeline;
  const clips = [...timeline.clips, ...newClips];
  const joints: TimelineJoint[] = [];
  for (let i = 0; i < clips.length - 1; i += 1) {
    if (i < timeline.joints.length) {
      joints.push(timeline.joints[i]);
    } else {
      joints.push({
        transition: defaultJoint.transition,
        durationSeconds:
          defaultJoint.transition === 'none' ? 0 : defaultJoint.durationSeconds,
      });
    }
  }
  return { ...timeline, clips, joints };
}

export function updateAllJoints(
  timeline: EditorTimeline,
  patch: Partial<TimelineJoint>,
): EditorTimeline {
  return {
    ...timeline,
    joints: timeline.joints.map((j) => {
      const next = { ...j, ...patch };
      if (next.transition === 'none') next.durationSeconds = 0;
      else if (next.durationSeconds <= 0) next.durationSeconds = 0.5;
      return next;
    }),
  };
}

export function addClipToTimeline(timeline: EditorTimeline, clip: TimelineClip): EditorTimeline {
  const clips = [...timeline.clips, clip];
  const joints =
    clips.length <= 1
      ? []
      : [...timeline.joints, { transition: 'fade' as const, durationSeconds: 0.5 }];
  if (joints.length !== clips.length - 1) {
    const merged = defaultJointsForClipCount(clips.length);
    for (let i = 0; i < Math.min(timeline.joints.length, merged.length); i += 1) {
      merged[i] = timeline.joints[i];
    }
    return { ...timeline, clips, joints: merged };
  }
  return { ...timeline, clips, joints };
}

function jointBetweenClipIds(clips: TimelineClip[], joints: TimelineJoint[]): TimelineJoint[] {
  const edgeKey = (a: string, b: string) => `${a}|${b}`;
  const edgeMap = new Map<string, TimelineJoint>();
  for (let i = 0; i < joints.length; i += 1) {
    const left = clips[i];
    const right = clips[i + 1];
    if (left && right) edgeMap.set(edgeKey(left.id, right.id), joints[i]);
  }
  const next: TimelineJoint[] = [];
  for (let i = 0; i < clips.length - 1; i += 1) {
    next.push(
      edgeMap.get(edgeKey(clips[i].id, clips[i + 1].id)) ?? {
        transition: 'fade',
        durationSeconds: 0.5,
      },
    );
  }
  return next;
}

export function removeClipAt(timeline: EditorTimeline, index: number): EditorTimeline {
  const clips = timeline.clips.filter((_, i) => i !== index);
  const joints = [...timeline.joints];
  if (joints.length > 0 && clips.length >= 0) {
    const jointRemoveIndex =
      index >= timeline.clips.length - 1 ? joints.length - 1 : index;
    joints.splice(jointRemoveIndex, 1);
  }
  while (joints.length < Math.max(0, clips.length - 1)) {
    joints.push({ transition: 'fade', durationSeconds: 0.5 });
  }
  return { ...timeline, clips, joints: joints.slice(0, Math.max(0, clips.length - 1)) };
}

export function moveClip(timeline: EditorTimeline, from: number, to: number): EditorTimeline {
  if (from === to || from < 0 || to < 0 || from >= timeline.clips.length || to >= timeline.clips.length) {
    return timeline;
  }
  const clips = [...timeline.clips];
  const [item] = clips.splice(from, 1);
  clips.splice(to, 0, item);
  const joints = jointBetweenClipIds(clips, timeline.joints);
  return { ...timeline, clips, joints };
}

export function updateClipAt(timeline: EditorTimeline, index: number, patch: Partial<TimelineClip>): EditorTimeline {
  const clips = timeline.clips.map((c, i) => (i === index ? { ...c, ...patch } : c));
  return { ...timeline, clips };
}

export function updateJointAt(timeline: EditorTimeline, index: number, patch: Partial<EditorTimeline['joints'][0]>): EditorTimeline {
  const joints = timeline.joints.map((j, i) => {
    if (i !== index) return j;
    const next = { ...j, ...patch };
    if (next.transition === 'none') {
      next.durationSeconds = 0;
    } else if (!Number.isFinite(next.durationSeconds) || next.durationSeconds < MIN_JOINT_DURATION) {
      next.durationSeconds = 0.5;
    }
    return next;
  });
  return { ...timeline, joints };
}

export function clipFromMediaUrl(
  sourceUrl: string,
  kind: 'image' | 'video',
  label?: string,
  imageDurationSeconds?: number,
): TimelineClip {
  return {
    id: crypto.randomUUID(),
    kind,
    sourceUrl,
    label: label || (kind === 'image' ? 'Image' : 'Video'),
    durationSeconds:
      kind === 'image' ? (imageDurationSeconds ?? DEFAULT_IMAGE_CLIP_SECONDS) : undefined,
    trimIn: kind === 'video' ? 0 : undefined,
  };
}

export function imageClipsFromUrls(
  urls: Array<{ url: string; label?: string }>,
  secondsPerSlide: number,
): TimelineClip[] {
  const dur = Math.max(0.3, Math.min(120, secondsPerSlide));
  return urls.map(({ url, label }, index) => ({
    ...clipFromMediaUrl(url, 'image', label || `Slide ${index + 1}`, dur),
    kenBurns: defaultKenBurnsForSlideIndex(index),
  }));
}

export function duplicateClipAt(timeline: EditorTimeline, index: number): EditorTimeline {
  const clip = timeline.clips[index];
  if (!clip) return timeline;
  const copy: TimelineClip = {
    ...clip,
    id: crypto.randomUUID(),
    label: clip.label ? `${clip.label} copy` : 'Clip copy',
  };
  const clips = [...timeline.clips];
  clips.splice(index + 1, 0, copy);
  const joints = [...timeline.joints];
  joints.splice(index + 1, 0, { transition: 'fade', durationSeconds: 0.5 });
  return { ...timeline, clips, joints };
}

export function splitVideoClipAt(
  timeline: EditorTimeline,
  index: number,
  splitAtSeconds: number,
): EditorTimeline {
  const clip = timeline.clips[index];
  if (!clip || clip.kind !== 'video') return timeline;
  const trimIn = clip.trimIn ?? 0;
  const trimOut = clip.trimOut ?? splitAtSeconds + 1;
  if (splitAtSeconds <= trimIn + 0.15 || splitAtSeconds >= trimOut - 0.15) return timeline;
  const first: TimelineClip = { ...clip, trimOut: splitAtSeconds };
  const second: TimelineClip = {
    ...clip,
    id: crypto.randomUUID(),
    label: clip.label ? `${clip.label} (2)` : 'Clip (2)',
    trimIn: splitAtSeconds,
    trimOut,
  };
  const clips = [...timeline.clips];
  clips.splice(index, 1, first, second);
  const joints = [...timeline.joints];
  joints.splice(index + 1, 0, { transition: 'none', durationSeconds: 0 });
  return { ...timeline, clips, joints };
}

export function addTextOverlay(timeline: EditorTimeline, overlay: TimelineTextOverlay): EditorTimeline {
  const list = [...(timeline.textOverlays ?? []), overlay];
  return { ...timeline, textOverlays: list };
}

export function updateTextOverlayAt(
  timeline: EditorTimeline,
  id: string,
  patch: Partial<TimelineTextOverlay>,
): EditorTimeline {
  const list = (timeline.textOverlays ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o));
  return { ...timeline, textOverlays: list };
}

export function removeTextOverlay(timeline: EditorTimeline, id: string): EditorTimeline {
  const list = (timeline.textOverlays ?? []).filter((o) => o.id !== id);
  return { ...timeline, textOverlays: list.length ? list : undefined };
}

export function addStickerOverlay(timeline: EditorTimeline, sticker: TimelineStickerOverlay): EditorTimeline {
  return { ...timeline, stickerOverlays: [...(timeline.stickerOverlays ?? []), sticker] };
}

export function removeStickerOverlay(timeline: EditorTimeline, id: string): EditorTimeline {
  const list = (timeline.stickerOverlays ?? []).filter((s) => s.id !== id);
  return { ...timeline, stickerOverlays: list.length ? list : undefined };
}

export function addVoiceoverClip(timeline: EditorTimeline, clip: TimelineVoiceoverClip): EditorTimeline {
  return { ...timeline, voiceoverClips: [...(timeline.voiceoverClips ?? []), clip] };
}

export function removeVoiceoverClip(timeline: EditorTimeline, id: string): EditorTimeline {
  const list = (timeline.voiceoverClips ?? []).filter((v) => v.id !== id);
  return { ...timeline, voiceoverClips: list.length ? list : undefined };
}

export function addTtsClip(timeline: EditorTimeline, clip: TimelineTtsClip): EditorTimeline {
  return { ...timeline, ttsClips: [...(timeline.ttsClips ?? []), clip] };
}

export function removeTtsClip(timeline: EditorTimeline, id: string): EditorTimeline {
  const list = (timeline.ttsClips ?? []).filter((t) => t.id !== id);
  return { ...timeline, ttsClips: list.length ? list : undefined };
}

export { EDITOR_STICKER_EMOJIS } from '../../../shared/editor-stickers';
export { EDITOR_TEMPLATES, applyEditorTemplate } from '../../../shared/editor-templates';

export function addPipLayer(timeline: EditorTimeline, layer: TimelinePipLayer): EditorTimeline {
  return { ...timeline, pipLayers: [...(timeline.pipLayers ?? []), layer] };
}

export function removePipLayer(timeline: EditorTimeline, id: string): EditorTimeline {
  const list = (timeline.pipLayers ?? []).filter((p) => p.id !== id);
  return { ...timeline, pipLayers: list.length ? list : undefined };
}

export function seedTimelineFromContent(
  platform: EditorPlatform,
  mediaUrl: string | null | undefined,
  mediaType: string | null | undefined,
  savedTimeline?: EditorTimeline | null,
): EditorTimeline {
  if (savedTimeline && savedTimeline.clips?.length) {
    return setTimelinePlatform(
      savedTimeline,
      resolveEditorPlatform(savedTimeline.platform, resolveEditorPlatform(platform)),
    );
  }
  let timeline = createEmptyTimeline(resolveEditorPlatform(platform));
  if (!mediaUrl) return timeline;
  const isVideo =
    mediaType === 'video' ||
    /\.(mp4|mov|webm)(\?|$)/i.test(mediaUrl) ||
    mediaUrl.includes('video');
  timeline = addClipToTimeline(
    timeline,
    clipFromMediaUrl(mediaUrl, isVideo ? 'video' : 'image', 'Source media'),
  );
  return timeline;
}
