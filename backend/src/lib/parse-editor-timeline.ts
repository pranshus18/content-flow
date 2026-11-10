import { normalizeEditorTimeline, type EditorTimeline } from './editor-timeline.js';
import { httpError } from './http.js';

/** Normalize timeline JSON from API requests; invalid input → HTTP 400 (not 500). */
export function parseEditorTimeline(raw: unknown): EditorTimeline {
  try {
    return normalizeEditorTimeline(raw);
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'Invalid editor timeline';
    throw httpError(400, message);
  }
}
