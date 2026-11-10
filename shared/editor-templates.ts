import type { EditorPlatform, EditorTimeline } from './editor-timeline';
import { createEmptyTimeline, defaultJointsForClipCount } from './editor-timeline';

export type EditorTemplateDef = {
  id: string;
  label: string;
  description: string;
  platform: EditorPlatform;
  /** Seed clips are placeholders — user replaces URLs after apply. */
  seedClipCount: number;
  defaultImageSeconds: number;
  transition: 'fade' | 'dissolve' | 'none';
  suggestMusic: boolean;
};

export const EDITOR_TEMPLATES: EditorTemplateDef[] = [
  {
    id: 'ig-quick-cuts',
    label: 'Instagram quick cuts',
    description: 'Fast 3–5 clips with crossfades (~15s feel).',
    platform: 'instagram',
    seedClipCount: 3,
    defaultImageSeconds: 2.5,
    transition: 'fade',
    suggestMusic: true,
  },
  {
    id: 'story-text',
    label: 'Story + captions',
    description: 'Single hero clip; add text overlays in the Text tab.',
    platform: 'instagram',
    seedClipCount: 1,
    defaultImageSeconds: 5,
    transition: 'none',
    suggestMusic: false,
  },
  {
    id: 'youtube-intro',
    label: 'YouTube widescreen',
    description: '16:9 canvas with dissolve between segments.',
    platform: 'youtube',
    seedClipCount: 4,
    defaultImageSeconds: 4,
    transition: 'dissolve',
    suggestMusic: true,
  },
  {
    id: 'facebook-carousel',
    label: 'Facebook carousel',
    description: 'Multiple images as a short slideshow.',
    platform: 'facebook',
    seedClipCount: 5,
    defaultImageSeconds: 3,
    transition: 'fade',
    suggestMusic: true,
  },
];

/** Apply template structure to an existing timeline (keeps clips if present, else empty slots). */
export function applyEditorTemplate(
  timeline: EditorTimeline,
  templateId: string,
  placeholderUrl?: string,
): EditorTimeline {
  const tpl = EDITOR_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return timeline;
  let next = createEmptyTimeline(tpl.platform);
  next = { ...next, width: timeline.width, height: timeline.height };

  const url = placeholderUrl || timeline.clips[0]?.sourceUrl;
  if (!url) {
    return { ...timeline, platform: tpl.platform, joints: [] };
  }

  const clips = [];
  for (let i = 0; i < tpl.seedClipCount; i += 1) {
    const existing = timeline.clips[i];
    clips.push({
      id: existing?.id || `clip-${i}-${Date.now()}`,
      kind: existing?.kind || ('image' as const),
      sourceUrl: existing?.sourceUrl || url,
      label: existing?.label || `Scene ${i + 1}`,
      durationSeconds:
        existing?.kind === 'video' ? undefined : (existing?.durationSeconds ?? tpl.defaultImageSeconds),
      trimIn: existing?.trimIn,
      trimOut: existing?.trimOut,
    });
  }
  const joints = defaultJointsForClipCount(clips.length).map((j) => ({
    ...j,
    transition: tpl.transition,
    durationSeconds: tpl.transition === 'none' ? 0 : 0.45,
  }));

  return {
    ...timeline,
    platform: tpl.platform,
    clips,
    joints,
    backgroundMusicTrackId: tpl.suggestMusic ? timeline.backgroundMusicTrackId : timeline.backgroundMusicTrackId,
  };
}
