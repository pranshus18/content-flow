import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  isAdminAssetMusicTrackId,
  parseAdminAssetMusicTrackId,
  toAdminAssetMusicTrackId,
  type BackgroundMusicTrack,
} from '@/lib/backgroundMusicCatalog';
import {
  listAdminAssets,
  uploadAdminAsset,
  type AdminAsset,
} from '@/lib/adminAssets';
import { errorMessage } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Music2, Pause, Play, Upload, X, Loader2 } from 'lucide-react';

interface BackgroundMusicSectionProps {
  selectedTrackId: string | null;
  onSelectedTrackIdChange: (trackId: string | null) => void;
  disabled?: boolean;
}

function isLikelyAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;
  return /\.(mp3|mpeg|wav|m4a|aac|ogg|flac|webm)(\?|$)/i.test(file.name);
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
  const [customTracks, setCustomTracks] = useState<AdminAsset[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(true);
  const [uploadingCustom, setUploadingCustom] = useState(false);
  const inlineAudioRef = useRef<HTMLAudioElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadCustomTracks = useCallback(async () => {
    setLoadingCustom(true);
    try {
      const rows = await listAdminAssets('background_music');
      setCustomTracks(rows);
    } catch (error: unknown) {
      toast({
        title: 'Could not load your music',
        description: errorMessage(error, 'Apply the admin_assets migrations in Supabase.'),
        variant: 'destructive',
      });
    } finally {
      setLoadingCustom(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadCustomTracks();
  }, [loadCustomTracks]);

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

  const resolveCatalogPreviewUrl = async (track: BackgroundMusicTrack): Promise<string> => {
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

  const startPreview = (trackKey: string, url: string) => {
    stopPreview();
    setActivePreviewUrl(url);
    setPlayingId(trackKey);
    window.setTimeout(() => {
      void inlineAudioRef.current?.play().catch(() => {
        toast({
          title: 'Tap play on the player',
          description: 'Use the audio controls below if auto-play is blocked.',
        });
      });
    }, 0);
  };

  const toggleCatalogPreview = async (track: BackgroundMusicTrack) => {
    if (playingId === track.id) {
      stopPreview();
      return;
    }
    setLoadingPreviewId(track.id);
    try {
      const url = await resolveCatalogPreviewUrl(track);
      startPreview(track.id, url);
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

  const toggleCustomPreview = (asset: AdminAsset) => {
    const trackKey = toAdminAssetMusicTrackId(asset.id);
    if (playingId === trackKey) {
      stopPreview();
      return;
    }
    startPreview(trackKey, asset.file_url);
  };

  const handleUploadMusic = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!isLikelyAudioFile(file)) {
      toast({
        title: 'Not an audio file',
        description: 'Upload MP3, WAV, M4A, or another common audio format.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingCustom(true);
    try {
      const asset = await uploadAdminAsset(file, { category: 'background_music' });
      setCustomTracks((prev) => [asset, ...prev.filter((a) => a.id !== asset.id)]);
      onSelectedTrackIdChange(toAdminAssetMusicTrackId(asset.id));
      toast({
        title: 'Music uploaded',
        description: 'Your track is selected. Click Apply to video to bake it in.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Upload failed',
        description: errorMessage(error, 'Could not upload this audio file.'),
        variant: 'destructive',
      });
    } finally {
      setUploadingCustom(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  const selectedCatalogTrack = selectedTrackId && !isAdminAssetMusicTrackId(selectedTrackId)
    ? catalog.find((t) => t.id === selectedTrackId)
    : undefined;

  const selectedCustomAsset = useMemo(() => {
    if (!selectedTrackId || !isAdminAssetMusicTrackId(selectedTrackId)) return undefined;
    const assetId = parseAdminAssetMusicTrackId(selectedTrackId);
    if (!assetId) return undefined;
    return customTracks.find((a) => a.id === assetId);
  }, [customTracks, selectedTrackId]);

  const playingTitle = useMemo(() => {
    if (!playingId) return null;
    if (isAdminAssetMusicTrackId(playingId)) {
      const assetId = parseAdminAssetMusicTrackId(playingId);
      return customTracks.find((a) => a.id === assetId)?.name ?? 'Your upload';
    }
    const track = catalog.find((t) => t.id === playingId);
    return track ? `${track.title}${track.library ? ` (${track.library})` : ''}` : null;
  }, [playingId, catalog, customTracks]);

  return (
    <div className="space-y-3 p-4 bg-secondary/40 rounded-lg border border-border min-w-0">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Music2 className="w-4 h-4 text-primary" />
          <Label className="text-base font-semibold">Background music</Label>
          <Badge variant="secondary" className="text-[10px]">Library · CC BY 4.0</Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Pick a royalty-free track below, or upload your own MP3/audio. Preview, select, then Apply to bake into the
          video.
          {catalogMeta.licenseNotice ? ` ${catalogMeta.licenseNotice}` : ''}
        </p>
      </div>

      {activePreviewUrl && playingId && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Now playing: {playingTitle}</p>
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
                description: isAdminAssetMusicTrackId(playingId)
                  ? 'Could not play this upload. Try re-uploading the file.'
                  : 'Run npm run music:download from the project root to cache library tracks locally.',
                variant: 'destructive',
              });
              stopPreview();
            }}
          />
        </div>
      )}

      {(selectedCatalogTrack || selectedCustomAsset) && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm min-w-0">
            <span className="min-w-0 truncate">
              Selected:{' '}
              <span className="font-medium">
                {selectedCatalogTrack?.title ?? selectedCustomAsset?.name}
              </span>
              {selectedCatalogTrack ? (
                <Badge variant="outline" className="ml-2 text-xs">{selectedCatalogTrack.category}</Badge>
              ) : (
                <Badge variant="outline" className="ml-2 text-xs">Your upload</Badge>
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="shrink-0"
              onClick={() => onSelectedTrackIdChange(null)}
            >
              <X className="w-4 h-4 mr-1" />
              None
            </Button>
          </div>
          {selectedCatalogTrack ? (
            <p className="text-[11px] text-muted-foreground leading-snug px-1">
              {backgroundMusicAttributionLine(selectedCatalogTrack)} — paste into your post caption when publishing.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-snug px-1">
              Custom upload — ensure you have rights to use this music when publishing.
            </p>
          )}
        </div>
      )}

      <div className="rounded-md border border-border bg-background/60 p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Your music uploads</p>
            <p className="text-xs text-muted-foreground">Use when nothing in the library fits.</p>
          </div>
          <input
            ref={uploadInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
            className="hidden"
            disabled={disabled || uploadingCustom}
            onChange={(e) => void handleUploadMusic(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploadingCustom}
            className="shrink-0"
            onClick={() => uploadInputRef.current?.click()}
          >
            {uploadingCustom ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload audio
              </>
            )}
          </Button>
        </div>

        {loadingCustom ? (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading your uploads…
          </p>
        ) : customTracks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No uploads yet. MP3 or WAV recommended.</p>
        ) : (
          <div className="max-h-36 overflow-y-auto rounded-md border border-border divide-y divide-border">
            {customTracks.map((asset) => {
              const trackKey = toAdminAssetMusicTrackId(asset.id);
              const isSelected = selectedTrackId === trackKey;
              const isPlaying = playingId === trackKey;
              return (
                <div
                  key={asset.id}
                  className={`flex items-center gap-2 p-2 text-sm min-w-0 ${isSelected ? 'bg-primary/10' : ''}`}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={disabled}
                    onClick={() => toggleCustomPreview(asset)}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </Button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{asset.name}</p>
                    <p className="text-xs text-muted-foreground truncate">Your upload</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? 'secondary' : 'default'}
                    disabled={disabled}
                    className="shrink-0"
                    onClick={() => onSelectedTrackIdChange(trackKey)}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs font-medium text-muted-foreground pt-1">Royalty-free library</p>

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
                className={`flex items-center gap-2 p-2 text-sm min-w-0 ${isSelected ? 'bg-primary/10' : ''}`}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={disabled || isLoading}
                  onClick={() => void toggleCatalogPreview(track)}
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
                  <p className="text-xs text-muted-foreground truncate">
                    {track.category} · {track.library || 'Library'} · {formatTrackDuration(track.durationSeconds)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isSelected ? 'secondary' : 'default'}
                  disabled={disabled}
                  className="shrink-0"
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
