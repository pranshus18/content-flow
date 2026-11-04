import catalogJson from '../../../shared/background-music-catalog.json';
import legacyTrackIds from '../../../shared/background-music-legacy-ids.json';

export interface BackgroundMusicTrack {
  id: string;
  title: string;
  category: string;
  library?: string;
  tags: string[];
  durationSeconds: number;
  bundledFile?: string;
  sourceDownloadUrl?: string;
  storagePath?: string;
  license?: string;
}

export interface BackgroundMusicCatalogMeta {
  licenseNotice?: string;
  licenseUrl?: string;
  composer?: string;
  composerUrl?: string;
}

export function loadBackgroundMusicCatalogMeta(): BackgroundMusicCatalogMeta {
  const raw = catalogJson as BackgroundMusicCatalogMeta & { tracks?: unknown };
  return {
    licenseNotice: raw.licenseNotice,
    licenseUrl: raw.licenseUrl,
    composer: raw.composer,
    composerUrl: raw.composerUrl,
  };
}

/** Credit line for post descriptions / export packages (CC BY 4.0). */
export function backgroundMusicAttributionLine(track: BackgroundMusicTrack): string {
  const meta = loadBackgroundMusicCatalogMeta();
  const composer = meta.composer || 'Kevin MacLeod';
  const site = meta.composerUrl || 'https://incompetech.com';
  return `Music: "${track.title}" by ${composer} (${site}) — Royalty-free, CC BY 4.0`;
}

export const BACKGROUND_MUSIC_CATEGORIES = [
  'All',
  'Meditation',
  'Nature',
  'Ambient',
  'Calm',
] as const;

const LEGACY_TRACK_ALIASES = legacyTrackIds as Record<string, string>;

export function resolveBackgroundMusicTrackId(id: string): string {
  return LEGACY_TRACK_ALIASES[id] || id;
}

export function loadBackgroundMusicCatalog(): BackgroundMusicTrack[] {
  const tracks = (catalogJson as { tracks?: BackgroundMusicTrack[] }).tracks;
  return Array.isArray(tracks) ? tracks : [];
}

export function getBackgroundMusicTrack(id: string): BackgroundMusicTrack | undefined {
  const resolved = resolveBackgroundMusicTrackId(id);
  return loadBackgroundMusicCatalog().find((track) => track.id === resolved);
}

/** Prefer bundled file from Vite public/, else stream from royalty-free library URL in catalog. */
export function backgroundMusicPreviewUrl(track: BackgroundMusicTrack): string {
  if (track.bundledFile) {
    return `/music-library/${track.bundledFile}`;
  }
  if (track.sourceDownloadUrl) {
    return track.sourceDownloadUrl;
  }
  if (track.storagePath && import.meta.env.VITE_SUPABASE_URL) {
    const base = import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '');
    return `${base}/storage/v1/object/public/content-media/${track.storagePath}`;
  }
  return '';
}

export function backgroundMusicPreviewApiPath(trackId: string): string {
  return `background-music/preview-url/${encodeURIComponent(trackId)}`;
}

export function formatTrackDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
