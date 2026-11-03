import catalogJson from '../../../shared/background-music-catalog.json';

export interface BackgroundMusicTrack {
  id: string;
  title: string;
  category: string;
  tags: string[];
  durationSeconds: number;
  storagePath: string;
}

export const BACKGROUND_MUSIC_CATEGORIES = [
  'All',
  'Upbeat',
  'Corporate',
  'Chill',
  'Cinematic',
  'Acoustic',
  'Electronic',
] as const;

export function loadBackgroundMusicCatalog(): BackgroundMusicTrack[] {
  const tracks = (catalogJson as { tracks?: BackgroundMusicTrack[] }).tracks;
  return Array.isArray(tracks) ? tracks : [];
}

export function getBackgroundMusicTrack(id: string): BackgroundMusicTrack | undefined {
  return loadBackgroundMusicCatalog().find((track) => track.id === id);
}

export function backgroundMusicPreviewUrl(track: BackgroundMusicTrack): string {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) return '';
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/content-media/${track.storagePath}`;
}

export function formatTrackDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
