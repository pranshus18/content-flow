import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getServiceClient } from './supabase.js';
import { httpError } from './http.js';

export interface BackgroundMusicTrack {
  id: string;
  title: string;
  category: string;
  tags: string[];
  durationSeconds: number;
  storagePath: string;
}

const MEDIA_BUCKET = 'content-media';

let cachedCatalog: BackgroundMusicTrack[] | null = null;

function catalogFilePath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../shared/background-music-catalog.json');
}

export function loadBackgroundMusicCatalog(): BackgroundMusicTrack[] {
  if (cachedCatalog) return cachedCatalog;
  const raw = readFileSync(catalogFilePath(), 'utf8');
  const parsed = JSON.parse(raw) as { tracks?: BackgroundMusicTrack[] };
  if (!Array.isArray(parsed.tracks)) {
    throw new Error('Invalid background music catalog: missing tracks array');
  }
  cachedCatalog = parsed.tracks;
  return cachedCatalog;
}

export function getBackgroundMusicTrack(id: string): BackgroundMusicTrack | undefined {
  return loadBackgroundMusicCatalog().find((track) => track.id === id);
}

export function resolveBackgroundMusicPublicUrl(trackId: string): string {
  const track = getBackgroundMusicTrack(trackId);
  if (!track) {
    throw httpError(400, `Unknown background music track: ${trackId}`);
  }
  const supabase = getServiceClient();
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(track.storagePath);
  if (!data.publicUrl) {
    throw new Error(`Could not resolve public URL for track ${trackId}`);
  }
  return data.publicUrl;
}

export function clampMusicVolume(value: unknown, fallback = 1): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, Math.round(parsed * 100) / 100));
}
