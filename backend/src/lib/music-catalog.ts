import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getServiceClient } from './supabase.js';
import { httpError } from './http.js';
import { env } from './env.js';

export interface BackgroundMusicTrack {
  id: string;
  title: string;
  category: string;
  library?: string;
  tags: string[];
  durationSeconds: number;
  /** Filename under frontend/public/music-library/ */
  bundledFile?: string;
  /** Remote URL used by scripts/download-music-library.mjs */
  sourceDownloadUrl?: string;
  /** Optional Supabase override path */
  storagePath?: string;
}

const MEDIA_BUCKET = 'content-media';

let cachedCatalog: BackgroundMusicTrack[] | null = null;

function repoRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../..');
}

function catalogFilePath() {
  return path.join(repoRoot(), 'shared/background-music-catalog.json');
}

function legacyTrackAliasesPath() {
  return path.join(repoRoot(), 'shared/background-music-legacy-ids.json');
}

let cachedLegacyAliases: Record<string, string> | null = null;

function loadLegacyTrackAliases(): Record<string, string> {
  if (cachedLegacyAliases) return cachedLegacyAliases;
  cachedLegacyAliases = JSON.parse(readFileSync(legacyTrackAliasesPath(), 'utf8')) as Record<string, string>;
  return cachedLegacyAliases;
}

export function bundledMusicPublicDir() {
  return path.join(repoRoot(), 'frontend/public/music-library');
}

export function getBundledMusicAbsolutePath(track: BackgroundMusicTrack): string | null {
  if (!track.bundledFile) return null;
  return path.join(bundledMusicPublicDir(), track.bundledFile);
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

export function resolveBackgroundMusicTrackId(id: string): string {
  return loadLegacyTrackAliases()[id] || id;
}

export function getBackgroundMusicTrack(id: string): BackgroundMusicTrack | undefined {
  const resolved = resolveBackgroundMusicTrackId(id);
  return loadBackgroundMusicCatalog().find((track) => track.id === resolved);
}

export function bundledMusicPreviewPath(track: BackgroundMusicTrack): string | null {
  if (!track.bundledFile) return null;
  return `/music-library/${track.bundledFile}`;
}

export function resolveBackgroundMusicPreviewUrl(trackId: string): string {
  const track = getBackgroundMusicTrack(trackId);
  if (!track) {
    throw httpError(404, `Unknown background music track: ${trackId}`);
  }

  const bundled = getBundledMusicAbsolutePath(track);
  if (bundled && existsSync(bundled)) {
    const relative = bundledMusicPreviewPath(track)!;
    return `${env.frontendOrigin.replace(/\/$/, '')}${relative}`;
  }

  if (track.sourceDownloadUrl) {
    return track.sourceDownloadUrl;
  }

  if (track.storagePath) {
    const supabase = getServiceClient();
    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(track.storagePath);
    if (data.publicUrl) return data.publicUrl;
  }

  throw httpError(
    404,
    `Track "${track.title}" is not on disk. Run: npm run music:download`,
  );
}

/** Local path for FFmpeg, or remote URL to fetch. */
export function resolveBackgroundMusicSource(trackId: string): { kind: 'file'; path: string } | { kind: 'url'; url: string } {
  const track = getBackgroundMusicTrack(trackId);
  if (!track) {
    throw httpError(400, `Unknown background music track: ${trackId}`);
  }

  const bundled = getBundledMusicAbsolutePath(track);
  if (bundled && existsSync(bundled)) {
    return { kind: 'file', path: bundled };
  }

  if (track.sourceDownloadUrl) {
    return { kind: 'url', url: track.sourceDownloadUrl };
  }

  if (track.storagePath) {
    const supabase = getServiceClient();
    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(track.storagePath);
    if (data.publicUrl) return { kind: 'url', url: data.publicUrl };
  }

  throw httpError(
    404,
    `Track audio missing for "${track.title}". Run npm run music:download from the project root.`,
  );
}

/** @deprecated use resolveBackgroundMusicSource */
export function resolveBackgroundMusicPublicUrl(trackId: string): string {
  const source = resolveBackgroundMusicSource(trackId);
  if (source.kind === 'file') {
    return resolveBackgroundMusicPreviewUrl(trackId);
  }
  return source.url;
}

export function clampMusicVolume(value: unknown, fallback = 1): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, Math.round(parsed * 100) / 100));
}
