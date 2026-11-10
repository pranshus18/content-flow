import type { EditorTimeline, TimelineClip } from '@/lib/editorTimeline';
import {
  clampSeamlessImageBlendSeconds,
  DEFAULT_IMAGE_CLIP_SECONDS,
  effectiveTimelineJoint,
} from '@/lib/editorTimeline';

export function clipSegmentSeconds(
  clip: TimelineClip,
  fullVideoDuration?: number,
): number {
  let segment = 0;
  if (clip.kind === 'image') {
    segment = clip.durationSeconds ?? DEFAULT_IMAGE_CLIP_SECONDS;
  } else if (fullVideoDuration != null && Number.isFinite(fullVideoDuration)) {
    const trimIn = clip.trimIn ?? 0;
    const trimOut = clip.trimOut ?? fullVideoDuration;
    segment = Math.max(0.1, trimOut - trimIn);
  } else {
    segment = 5;
  }
  const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
  return segment / speed;
}

/** Timeline time (seconds) where clip `clipIndex` begins. */
export function clipTimelineStartSeconds(
  timeline: EditorTimeline,
  clipIndex: number,
  videoDurations?: Record<string, number>,
): number {
  let cursor = 0;
  for (let i = 0; i < clipIndex; i += 1) {
    const clip = timeline.clips[i];
    const full = videoDurations?.[clip.id];
    cursor += clipSegmentSeconds(clip, full);
    const left = timeline.clips[i];
    const right = timeline.clips[i + 1];
    const blend = clampSeamlessImageBlendSeconds(timeline.seamlessImageBlendSeconds);
    const { durationSeconds: overlap } = effectiveTimelineJoint(timeline.joints[i], left, right, blend);
    if (overlap > 0) cursor -= overlap;
  }
  return Math.max(0, cursor);
}

export function roundTimelineSeconds(seconds: number, digits = 2): number {
  const p = 10 ** digits;
  return Math.round(seconds * p) / p;
}

export type TimelineClipAtTime = {
  index: number;
  clipStart: number;
  clipEnd: number;
};

/** Which video/image clip is active at global timeline time `seconds`. */
/** 0–1 position within clip `clipIndex` at global timeline time (for Ken Burns preview). */
export function clipLocalProgress01(
  timeline: EditorTimeline,
  clipIndex: number,
  playheadSeconds: number,
  videoDurations?: Record<string, number>,
): number {
  const clip = timeline.clips[clipIndex];
  if (!clip) return 0;
  const start = clipTimelineStartSeconds(timeline, clipIndex, videoDurations);
  const seg = clipSegmentSeconds(clip, videoDurations?.[clip.id]);
  if (seg <= 0) return 0;
  return Math.max(0, Math.min(1, (playheadSeconds - start) / seg));
}

export function findClipAtTimelineSeconds(
  timeline: EditorTimeline,
  seconds: number,
  videoDurations?: Record<string, number>,
): TimelineClipAtTime | null {
  if (!timeline.clips.length) return null;
  const t = Math.max(0, seconds);
  for (let i = 0; i < timeline.clips.length; i += 1) {
    const clipStart = clipTimelineStartSeconds(timeline, i, videoDurations);
    const clip = timeline.clips[i];
    const dur = clipSegmentSeconds(clip, videoDurations?.[clip.id]);
    const clipEnd = clipStart + dur;
    const isLast = i === timeline.clips.length - 1;
    if (t >= clipStart && (t < clipEnd || (isLast && t <= clipEnd + 0.001))) {
      return { index: i, clipStart, clipEnd };
    }
  }
  return null;
}
