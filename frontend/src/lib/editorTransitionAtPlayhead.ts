import type { EditorTimeline, TimelineTransition } from '@/lib/editorTimeline';
import { clampSeamlessImageBlendSeconds, effectiveTimelineJoint } from '@/lib/editorTimeline';
import {
  clipSegmentSeconds,
  clipTimelineStartSeconds,
} from '@/lib/editorTimelineLayout';

export type TransitionBlendAtPlayhead = {
  fromIndex: number;
  toIndex: number;
  progress: number;
  transition: TimelineTransition;
};

/** When the playhead is in a crossfade overlap between two clips. */
export function transitionBlendAtPlayhead(
  timeline: EditorTimeline,
  playheadSeconds: number,
  videoDurations?: Record<string, number>,
): TransitionBlendAtPlayhead | null {
  const t = Math.max(0, playheadSeconds);
  for (let i = 0; i < timeline.joints.length; i += 1) {
    const joint = timeline.joints[i];
    const clip = timeline.clips[i];
    const next = timeline.clips[i + 1];
    if (!clip || !next) continue;

    const blend = clampSeamlessImageBlendSeconds(timeline.seamlessImageBlendSeconds);
    const { transition, durationSeconds: fade } = effectiveTimelineJoint(joint, clip, next, blend);
    if (fade <= 0) continue;

    const start = clipTimelineStartSeconds(timeline, i, videoDurations);
    const seg = clipSegmentSeconds(clip, videoDurations?.[clip.id]);
    const overlapStart = start + seg - fade;
    const overlapEnd = start + seg;

    if (t >= overlapStart - 0.02 && t <= overlapEnd + 0.02) {
      const progress = Math.max(0, Math.min(1, (t - overlapStart) / fade));
      return {
        fromIndex: i,
        toIndex: i + 1,
        progress,
        transition,
      };
    }
  }
  return null;
}
