import { useMemo, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BACKGROUND_MUSIC_CATEGORIES,
  backgroundMusicPreviewUrl,
  formatTrackDuration,
  loadBackgroundMusicCatalog,
  type BackgroundMusicTrack,
} from '@/lib/backgroundMusicCatalog';
import { Music2, Pause, Play, X } from 'lucide-react';

interface BackgroundMusicSectionProps {
  selectedTrackId: string | null;
  onSelectedTrackIdChange: (trackId: string | null) => void;
  disabled?: boolean;
}

export function BackgroundMusicSection({
  selectedTrackId,
  onSelectedTrackIdChange,
  disabled = false,
}: BackgroundMusicSectionProps) {
  const catalog = useMemo(() => loadBackgroundMusicCatalog(), []);
  const [category, setCategory] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((track) => {
      if (category !== 'All' && track.category !== category) return false;
      if (!q) return true;
      const haystack = [track.title, track.category, ...track.tags].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [catalog, category, query]);

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  const togglePreview = (track: BackgroundMusicTrack) => {
    if (playingId === track.id) {
      stopPreview();
      return;
    }
    stopPreview();
    const url = backgroundMusicPreviewUrl(track);
    if (!url) return;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    void audio.play().then(() => setPlayingId(track.id)).catch(() => setPlayingId(null));
  };

  const selectedTrack = selectedTrackId
    ? catalog.find((t) => t.id === selectedTrackId)
    : undefined;

  return (
    <div className="space-y-3 p-4 bg-secondary/40 rounded-lg border border-border">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 text-primary" />
          <Label className="text-base font-semibold">Background music</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Pick a track and click Apply to bake it into the video (replaces the clip&apos;s original audio).
          Use Preview to listen before applying; the player above updates after Apply.
        </p>
      </div>

      {selectedTrack && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>
            Selected: <span className="font-medium">{selectedTrack.title}</span>
            <Badge variant="outline" className="ml-2 text-xs">{selectedTrack.category}</Badge>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onSelectedTrackIdChange(null)}
          >
            <X className="w-4 h-4 mr-1" />
            None
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="Search by title or mood…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          className="bg-background"
        />
        <Select value={category} onValueChange={setCategory} disabled={disabled}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {BACKGROUND_MUSIC_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border">
        {filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No tracks match your filters.</p>
        ) : (
          filtered.map((track) => {
            const isSelected = selectedTrackId === track.id;
            return (
              <div
                key={track.id}
                className={`flex items-center gap-2 p-2 text-sm ${isSelected ? 'bg-primary/10' : ''}`}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={disabled}
                  onClick={() => togglePreview(track)}
                >
                  {playingId === track.id ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{track.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {track.category} · {formatTrackDuration(track.durationSeconds)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isSelected ? 'secondary' : 'default'}
                  disabled={disabled}
                  onClick={() => onSelectedTrackIdChange(track.id)}
                >
                  {isSelected ? 'Selected' : 'Select'}
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
