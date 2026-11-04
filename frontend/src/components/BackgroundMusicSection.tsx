import { useEffect, useMemo, useRef, useState } from 'react';
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
  loadBackgroundMusicCatalogMeta,
  backgroundMusicAttributionLine,
  type BackgroundMusicTrack,
} from '@/lib/backgroundMusicCatalog';
import { errorMessage } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Music2, Pause, Play, X, Loader2 } from 'lucide-react';

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
  const catalogMeta = useMemo(() => loadBackgroundMusicCatalogMeta(), []);
  const [category, setCategory] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const inlineAudioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((track) => {
      if (category !== 'All' && track.category !== category) return false;
      if (!q) return true;
      const haystack = [track.title, track.category, track.library || '', ...track.tags].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [catalog, category, query]);

  const stopPreview = () => {
    if (inlineAudioRef.current) {
      inlineAudioRef.current.pause();
    }
    setPlayingId(null);
    setActivePreviewUrl(null);
  };

  useEffect(() => () => stopPreview(), []);

  const resolvePreviewUrl = async (track: BackgroundMusicTrack): Promise<string> => {
    const local = backgroundMusicPreviewUrl(track);
    if (!local) {
      throw new Error('No preview URL configured for this track.');
    }
    if (local.startsWith('/')) {
      const head = await fetch(local, { method: 'HEAD' });
      if (head.ok) return local;
    }
    if (track.sourceDownloadUrl) {
      return track.sourceDownloadUrl;
    }
    return local;
  };

  const togglePreview = async (track: BackgroundMusicTrack) => {
    if (playingId === track.id) {
      stopPreview();
      return;
    }
    stopPreview();
    setLoadingPreviewId(track.id);
    try {
      const url = await resolvePreviewUrl(track);
      setActivePreviewUrl(url);
      setPlayingId(track.id);
      window.setTimeout(() => {
        void inlineAudioRef.current?.play().catch(() => {
          toast({
            title: 'Tap play on the player',
            description: 'Use the audio controls below if auto-play is blocked.',
          });
        });
      }, 0);
    } catch (error: unknown) {
      toast({
        title: 'Preview unavailable',
        description: errorMessage(error, 'Could not load this track.'),
        variant: 'destructive',
      });
    } finally {
      setLoadingPreviewId(null);
    }
  };

  const selectedTrack = selectedTrackId
    ? catalog.find((t) => t.id === selectedTrackId)
    : undefined;

  const playingTrack = playingId ? catalog.find((t) => t.id === playingId) : undefined;

  return (
    <div className="space-y-3 p-4 bg-secondary/40 rounded-lg border border-border">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 text-primary" />
          <Label className="text-base font-semibold">Background music</Label>
          <Badge variant="secondary" className="text-[10px]">Royalty-free · CC BY 4.0</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Natural meditation-style beds only — calm, ambient, and nature-friendly. Preview, select, then Apply to bake into the video.
          {catalogMeta.licenseNotice ? ` ${catalogMeta.licenseNotice}` : ''}
        </p>
      </div>

      {activePreviewUrl && playingId && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Now playing: {playingTrack?.title}
            {playingTrack?.library ? ` (${playingTrack.library})` : ''}
          </p>
          <audio
            ref={inlineAudioRef}
            key={activePreviewUrl}
            controls
            autoPlay
            className="w-full"
            src={activePreviewUrl}
            crossOrigin="anonymous"
            onEnded={() => {
              setPlayingId(null);
              setActivePreviewUrl(null);
            }}
            onError={() => {
              toast({
                title: 'Preview failed',
                description: 'Run npm run music:download from the project root to cache tracks locally.',
                variant: 'destructive',
              });
              stopPreview();
            }}
          />
        </div>
      )}

      {selectedTrack && (
        <div className="space-y-2">
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
        <p className="text-[11px] text-muted-foreground leading-snug px-1">
          {backgroundMusicAttributionLine(selectedTrack)} — paste into your post caption when publishing.
        </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="Search meditation, nature, ambient…"
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
            const isLoading = loadingPreviewId === track.id;
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
                  disabled={disabled || isLoading}
                  onClick={() => void togglePreview(track)}
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : playingId === track.id ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{track.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {track.category} · {track.library || 'Library'} · {formatTrackDuration(track.durationSeconds)}
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
