import type { EditorTimeline, TimelineClip, TimelineTransition } from '@/lib/editorTimeline';
import { DEFAULT_IMAGE_CLIP_SECONDS } from '@/lib/editorTimeline';
import { clipTimelineStartSeconds } from '@/lib/editorTimelineLayout';

export function clipIndexAtPlayhead(
  timeline: EditorTimeline,
  playheadSeconds: number,
  videoDurations?: Record<string, number>,
): number {
  const at = findClipAtPlayhead(timeline, playheadSeconds, videoDurations);
  return at?.index ?? 0;
}

function findClipAtPlayhead(
  timeline: EditorTimeline,
  seconds: number,
  videoDurations?: Record<string, number>,
) {
  for (let i = 0; i < timeline.clips.length; i += 1) {
    const start = clipTimelineStartSeconds(timeline, i, videoDurations);
    const clip = timeline.clips[i];
    let dur = DEFAULT_IMAGE_CLIP_SECONDS;
    if (clip.kind === 'image') {
      dur = (clip.durationSeconds ?? DEFAULT_IMAGE_CLIP_SECONDS) / (clip.speed ?? 1);
    } else {
      const full = videoDurations?.[clip.id];
      if (full != null) {
        dur =
          Math.max(0.1, (clip.trimOut ?? full) - (clip.trimIn ?? 0)) / (clip.speed ?? 1);
      }
    }
    const end = start + dur;
    const isLast = i === timeline.clips.length - 1;
    if (seconds >= start && (seconds < end || (isLast && seconds <= end + 0.001))) {
      return { index: i, clipStart: start };
    }
  }
  return timeline.clips.length ? { index: 0, clipStart: 0 } : null;
}

export function waitAnimationFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    let left = count;
    const step = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export async function waitForVideoRef(
  getEl: () => HTMLVideoElement | null,
  timeoutMs = 6000,
): Promise<HTMLVideoElement | null> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const el = getEl();
    if (el) return el;
    await waitAnimationFrames(1);
  }
  return getEl();
}

export function playVideoClipSegment(
  el: HTMLVideoElement,
  clip: TimelineClip,
  fullDuration: number | undefined,
  onTime: (timelineSeconds: number) => void,
  clipStartOnTimeline: number,
  shouldContinue: () => boolean,
  /** Leave this many timeline seconds for an outgoing transition overlap. */
  endOverlapTimelineSeconds = 0,
): Promise<void> {
  return new Promise((resolve) => {
    const trimIn = clip.trimIn ?? 0;
    const trimOut = clip.trimOut ?? fullDuration ?? trimIn + 0.1;
    const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
    const overlapSource = Math.max(0, endOverlapTimelineSeconds * speed);
    const playEnd = Math.max(trimIn + 0.05, trimOut - overlapSource);

    const cleanup = () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onEnded);
    };

    const finish = () => {
      cleanup();
      el.pause();
      resolve();
    };

    const onTimeUpdate = () => {
      if (!shouldContinue()) {
        finish();
        return;
      }
      const timelineSec = clipStartOnTimeline + (el.currentTime - trimIn) / speed;
      onTime(timelineSec);
      if (el.currentTime >= playEnd - 0.04) finish();
    };

    const onEnded = () => finish();

    el.currentTime = trimIn;
    onTime(clipStartOnTimeline);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onEnded);
    void el.play().catch(() => finish());
  });
}

export async function holdImageClip(
  durationSeconds: number,
  onTime: (elapsed: number) => void,
  shouldContinue: () => boolean,
): Promise<void> {
  const duration = Math.max(0.1, durationSeconds);
  const start = performance.now();
  while (shouldContinue()) {
    const elapsed = (performance.now() - start) / 1000;
    if (elapsed >= duration) break;
    onTime(elapsed);
    await waitAnimationFrames(1);
  }
}

export async function animateTransitionBlend(
  transition: TimelineTransition,
  durationSeconds: number,
  overlapStartOnTimeline: number,
  onFrame: (progress: number, playheadOnTimeline: number) => void,
  shouldContinue: () => boolean,
): Promise<void> {
  const dur = Math.max(0.08, durationSeconds);
  const t0 = performance.now();
  while (shouldContinue()) {
    const elapsed = (performance.now() - t0) / 1000;
    const progress = Math.min(1, elapsed / dur);
    onFrame(progress, overlapStartOnTimeline + progress * dur);
    if (progress >= 1) break;
    await waitAnimationFrames(1);
  }
  onFrame(1, overlapStartOnTimeline + dur);
}
