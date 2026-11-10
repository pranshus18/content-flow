/**
 * Studio Editor API — every call here hits the Express backend (not Supabase-only UI).
 * Routes are mounted in backend/src/index.ts under /api/render-timeline and /api/editor-ai.
 */
import { invokeBackend } from '@/lib/backend';
import type { ContentItem } from '@/hooks/useContent';
import type { EditorTimeline } from '@/lib/editorTimeline';

export async function renderEditorTimeline(body: {
  timeline: EditorTimeline;
  exportMode: 'render_only' | 'new_draft' | 'replace';
  title?: string;
  description?: string;
  contentId?: string;
}) {
  return invokeBackend<{
    success: boolean;
    mediaUrl: string;
    durationSeconds: number;
    content: ContentItem | null;
  }>('render-timeline', body, { timeoutMs: 12 * 60 * 1000 });
}

export async function saveContentEditorTimeline(contentId: string, timeline: EditorTimeline) {
  return invokeBackend(`content/${contentId}`, {
    editor_timeline: timeline,
    editor_timeline_updated_at: new Date().toISOString(),
  }, { method: 'PATCH' });
}

export async function autoAssembleEditorClips(
  clips: Array<{ sourceUrl: string; kind: string; durationSeconds: number; label?: string }>,
) {
  return invokeBackend<{ clips: EditorTimeline['clips']; joints: EditorTimeline['joints'] }>(
    'editor-ai/auto-assemble',
    { clips },
  );
}
