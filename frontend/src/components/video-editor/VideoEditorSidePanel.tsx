import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BackgroundMusicSection } from '@/components/BackgroundMusicSection';
import { VideoEditorToolsPanel } from '@/components/VideoEditorToolsPanel';
import type { EditorPlatform, EditorTimeline, TimelineClip } from '@/lib/editorTimeline';
import {
  ACTIVE_CONTENT_PLATFORMS,
  ACTIVE_CONTENT_PLATFORM_LABELS,
} from '@/lib/platforms';
import {
  EDITOR_PLATFORM_SPECS,
  EDITOR_STICKER_EMOJIS,
  EDITOR_TEMPLATES,
  applyEditorTemplate,
  MAX_STICKER_OVERLAYS,
  MAX_PIP_LAYERS,
  addStickerOverlay,
  addPipLayer,
  addVoiceoverClip,
  removeStickerOverlay,
  removePipLayer,
  removeVoiceoverClip,
  addClipsBatchToTimeline,
  imageClipsFromUrls,
  defaultKenBurnsForSlideIndex,
  TIMELINE_VIDEO_EFFECT_LABELS,
  DEFAULT_IMAGE_CLIP_SECONDS,
  DEFAULT_SEAMLESS_IMAGE_BLEND_SECONDS,
  MIN_SEAMLESS_IMAGE_BLEND_SECONDS,
  MAX_SEAMLESS_IMAGE_BLEND_SECONDS,
  clampLayerOpacity,
  type TimelineTransition,
} from '@/lib/editorTimeline';
import { TransitionSelectContent } from '@/components/video-editor/TransitionSelectContent';
import { uploadAdminAsset } from '@/lib/adminAssets';
import { autoAssembleEditorClips } from '@/lib/editorBackend';
import { errorMessage } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Film,
  Loader2,
  Mic,
  Music2,
  Sticker,
  Type,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  editorCardClass,
  editorCardPadding,
  editorFieldLabelClass,
  editorInputClass,
  editorSelectTriggerClass,
  editorTabButtonClass,
  editorTabRailClass,
} from '@/components/video-editor/editorUi';

export type EditorSideTab = 'media' | 'audio' | 'text' | 'stickers' | 'effects';

const TABS: { id: EditorSideTab; label: string; icon: typeof Film }[] = [
  { id: 'media', label: 'Media', icon: Film },
  { id: 'audio', label: 'Audio', icon: Music2 },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'stickers', label: 'Stickers', icon: Sticker },
  { id: 'effects', label: 'Effects', icon: Wand2 },
];

type Props = {
  activeTab: EditorSideTab;
  onTabChange: (tab: EditorSideTab) => void;
  timeline: EditorTimeline;
  platform: EditorPlatform;
  onPlatformChange: (p: EditorPlatform) => void;
  onTimelineChange: (t: EditorTimeline | ((prev: EditorTimeline) => EditorTimeline)) => void;
  selectedIndex: number;
  selectedClip?: TimelineClip;
  videoDuration?: number;
  onUploadClick: () => void;
  onAssetsClick: () => void;
  uploading: boolean;
  estimatedDuration: number;
  onSplit: () => void;
  onDuplicate: () => void;
  /** Insert audio/text/stickers at this timeline position. */
  playheadSeconds?: number;
  /** Latest playhead (sync ref) — use when adding so position matches last timeline click. */
  getInsertAtSeconds?: () => number;
  /** Narrower panel + truncated labels (Edit dialog embed). */
  compact?: boolean;
  /** Less headings and helper copy (full-page studio). */
  minimalChrome?: boolean;
};

export function VideoEditorSidePanel(props: Props) {
  const { toast } = useToast();
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const slideshowInputRef = useRef<HTMLInputElement>(null);
  const [slideshowSeconds, setSlideshowSeconds] = useState(3);
  const [slideshowTransition, setSlideshowTransition] = useState<TimelineTransition>('fade');
  const [slideshowTransitionDur, setSlideshowTransitionDur] = useState(0.75);
  const [slideshowUploading, setSlideshowUploading] = useState(false);

  const {
    activeTab,
    onTabChange,
    timeline,
    platform,
    onPlatformChange,
    onTimelineChange,
    selectedClip,
    selectedIndex,
    videoDuration,
    onUploadClick,
    onAssetsClick,
    uploading,
    estimatedDuration,
    onSplit,
    onDuplicate,
    playheadSeconds = 0,
    getInsertAtSeconds,
    compact = false,
    minimalChrome = false,
  } = props;

  const insertAtDisplay = Math.max(0, playheadSeconds);
  const resolveInsertAt = () => Math.max(0, getInsertAtSeconds?.() ?? playheadSeconds);

  const handleSlideshowFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!images.length) {
      toast({ title: 'No images selected', variant: 'destructive' });
      return;
    }
    setSlideshowUploading(true);
    try {
      const uploaded: Array<{ url: string; label: string }> = [];
      for (const file of images) {
        const asset = await uploadAdminAsset(file, { category: 'other', name: file.name });
        uploaded.push({ url: asset.file_url, label: file.name.replace(/\.[^.]+$/, '') });
      }
      const clips = imageClipsFromUrls(uploaded, slideshowSeconds);
      const defaultJoint = {
        transition: slideshowTransition,
        durationSeconds: slideshowTransition === 'none' ? 0 : slideshowTransitionDur,
      };
      onTimelineChange((prev) => {
        const next = addClipsBatchToTimeline(prev, clips, defaultJoint);
        return {
          ...next,
          seamlessImageBlendSeconds:
            next.seamlessImageBlendSeconds ?? DEFAULT_SEAMLESS_IMAGE_BLEND_SECONDS,
        };
      });
      toast({
        title: 'Slideshow clips added',
        description: `${clips.length} image(s) · ${slideshowSeconds}s each · export builds the video.`,
      });
    } catch (error: unknown) {
      toast({ title: 'Upload failed', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setSlideshowUploading(false);
      if (slideshowInputRef.current) slideshowInputRef.current.value = '';
    }
  };

  const updateClip = (patch: Partial<TimelineClip>) => {
    if (selectedIndex < 0) return;
    onTimelineChange((prev) => ({
      ...prev,
      clips: prev.clips.map((c, i) => (i === selectedIndex ? { ...c, ...patch } : c)),
    }));
  };

  const startRecording = async () => {
    const recordAt = resolveInsertAt();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voiceover-${Date.now()}.webm`, { type: blob.type });
        try {
          const asset = await uploadAdminAsset(file, { category: 'other', name: file.name });
          onTimelineChange((prev) =>
            addVoiceoverClip(prev, {
              id: crypto.randomUUID(),
              sourceUrl: asset.file_url,
              startSeconds: recordAt,
              durationSeconds: 5,
              label: 'Voiceover',
              volume: 1,
            }),
          );
          toast({ title: 'Voiceover recorded' });
        } catch (error: unknown) {
          toast({ title: 'Upload failed', description: errorMessage(error), variant: 'destructive' });
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast({ title: 'Microphone access denied', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex h-full min-h-0 border-r border-border/70 bg-[hsl(222_47%_5%)] min-w-0">
      <nav className={cn(editorTabRailClass, compact ? 'w-12' : 'w-[3.75rem]')}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => onTabChange(id)}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200',
              editorTabButtonClass(activeTab === id),
            )}
          >
            <Icon className="w-[1.15rem] h-[1.15rem]" />
          </button>
        ))}
      </nav>
      <div
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-w-0 bg-card/10',
          compact ? 'min-w-[268px] max-w-[300px] p-3.5' : 'min-w-[280px] max-w-[340px] p-4',
        )}
      >
        {activeTab === 'media' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-9" onClick={onUploadClick} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload'}
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-9 border-border/70" onClick={onAssetsClick}>
                Assets
              </Button>
            </div>
            <div className={cn(editorCardClass, editorCardPadding, 'space-y-3')}>
              <h3 className="text-xs font-semibold text-foreground">Slideshow</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className={editorFieldLabelClass}>Seconds per slide</Label>
                  <Input
                    type="number"
                    min={0.5}
                    max={30}
                    step={0.5}
                    className={editorInputClass}
                    value={slideshowSeconds}
                    onChange={(e) => setSlideshowSeconds(Number(e.target.value) || DEFAULT_IMAGE_CLIP_SECONDS)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className={editorFieldLabelClass}>Default transition</Label>
                  <Select
                    value={slideshowTransition}
                    onValueChange={(v) => setSlideshowTransition(v as TimelineTransition)}
                  >
                    <SelectTrigger className={cn(editorSelectTriggerClass, 'text-xs')}>
                      <SelectValue />
                    </SelectTrigger>
                    <TransitionSelectContent compact className="max-h-[min(50vh,280px)]" />
                  </Select>
                </div>
              </div>
              {slideshowTransition !== 'none' && (
                <div className="space-y-1">
                  <Label className={editorFieldLabelClass}>
                    Transition length {slideshowTransitionDur.toFixed(1)}s
                  </Label>
                  <Slider
                    min={0.15}
                    max={2}
                    step={0.05}
                    value={[slideshowTransitionDur]}
                    onValueChange={([v]) => setSlideshowTransitionDur(v)}
                  />
                </div>
              )}
              <div className="space-y-1 pt-1 border-t border-border/50">
                <Label className={editorFieldLabelClass}>
                  Smooth photo cuts{' '}
                  {(
                    timeline.seamlessImageBlendSeconds ?? DEFAULT_SEAMLESS_IMAGE_BLEND_SECONDS
                  ).toFixed(2)}
                  s
                </Label>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Controls the soft blend between photos (including Cut). Higher = smoother, less noticeable changes.
                </p>
                <Slider
                  min={MIN_SEAMLESS_IMAGE_BLEND_SECONDS}
                  max={MAX_SEAMLESS_IMAGE_BLEND_SECONDS}
                  step={0.05}
                  value={[
                    timeline.seamlessImageBlendSeconds ?? DEFAULT_SEAMLESS_IMAGE_BLEND_SECONDS,
                  ]}
                  onValueChange={([v]) =>
                    onTimelineChange({
                      ...timeline,
                      seamlessImageBlendSeconds: v,
                    })
                  }
                />
              </div>
              <input
                ref={slideshowInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => void handleSlideshowFiles(e.target.files)}
              />
              <Button
                size="sm"
                className="w-full h-auto min-h-9 py-2.5 px-3 text-xs leading-snug whitespace-normal text-center"
                disabled={slideshowUploading}
                onClick={() => slideshowInputRef.current?.click()}
              >
                {slideshowUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2 shrink-0 inline" />
                ) : null}
                Add slides
              </Button>
            </div>
            <div className={cn(editorCardClass, editorCardPadding, 'space-y-2')}>
              <Label className={editorFieldLabelClass}>Platform</Label>
              <Select value={platform} onValueChange={(v) => onPlatformChange(v as EditorPlatform)}>
                <SelectTrigger className={editorSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVE_CONTENT_PLATFORMS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {ACTIVE_CONTENT_PLATFORM_LABELS[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!minimalChrome && (
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {EDITOR_PLATFORM_SPECS[platform].width}×{EDITOR_PLATFORM_SPECS[platform].height}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className={editorFieldLabelClass}>Templates</Label>
              <div className="flex flex-col gap-2">
                {EDITOR_TEMPLATES.map((tpl) => (
                  <Button
                    key={tpl.id}
                    size="sm"
                    variant="outline"
                    className="justify-start h-auto py-3 px-3 border-border/70 text-left min-w-0 w-full bg-secondary/15 hover:bg-secondary/30"
                    onClick={() => onTimelineChange(applyEditorTemplate(timeline, tpl.id))}
                  >
                    <span className="block text-xs font-medium truncate w-full">{tpl.label}</span>
                  </Button>
                ))}
              </div>
            </div>
            {timeline.clips.length > 1 && (
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() =>
                  void (async () => {
                    try {
                      const result = await autoAssembleEditorClips(
                        timeline.clips.map((c) => ({
                          sourceUrl: c.sourceUrl,
                          kind: c.kind,
                          durationSeconds: c.durationSeconds,
                          label: c.label,
                        })),
                      );
                      onTimelineChange({ ...timeline, clips: result.clips, joints: result.joints });
                      toast({ title: 'Smart assemble', description: 'Clips linked with crossfades.' });
                    } catch (error: unknown) {
                      toast({ title: 'Assemble failed', description: errorMessage(error), variant: 'destructive' });
                    }
                  })()
                }
              >
                Smart assemble
              </Button>
            )}
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-4">
            <BackgroundMusicSection
              selectedTrackId={timeline.backgroundMusicTrackId ?? null}
              onSelectedTrackIdChange={(trackId) =>
                onTimelineChange({
                  ...timeline,
                  backgroundMusicTrackId: trackId,
                  backgroundMusicVolume: timeline.backgroundMusicVolume ?? 1,
                  mixOriginalAudioWithMusic: trackId ? timeline.mixOriginalAudioWithMusic ?? true : timeline.mixOriginalAudioWithMusic,
                })
              }
            />
            {timeline.backgroundMusicTrackId && (
              <div className="space-y-2">
                <Label className="text-zinc-400">Music volume</Label>
                <Slider
                  value={[timeline.backgroundMusicVolume ?? 1]}
                  min={0}
                  max={1}
                  step={0.05}
                  onValueChange={([v]) => onTimelineChange({ ...timeline, backgroundMusicVolume: v })}
                />
              </div>
            )}
            <p className="text-[10px] text-zinc-500">
              Playhead at <span className="text-violet-300 tabular-nums">{insertAtDisplay.toFixed(1)}s</span> — click the timeline first, then add voice here.
            </p>
            <div className="rounded-lg border border-zinc-800 p-3 space-y-2">
              <Label className="text-zinc-300 flex items-center gap-2">
                <Mic className="w-4 h-4" /> Voiceover
              </Label>
              <Button
                size="sm"
                variant={recording ? 'destructive' : 'secondary'}
                className="w-full"
                onClick={() => (recording ? stopRecording() : void startRecording())}
              >
                {recording ? 'Stop recording' : 'Record voiceover'}
              </Button>
              {(timeline.voiceoverClips ?? []).map((v) => (
                <div key={v.id} className="rounded border border-zinc-800 p-2 space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>{v.label || 'Voiceover'}</span>
                    <button type="button" className="text-red-400" onClick={() => onTimelineChange(removeVoiceoverClip(timeline, v.id))}>
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-zinc-600 text-[10px]">Start (s)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        className="h-7 bg-zinc-900 border-zinc-700"
                        value={v.startSeconds}
                        onChange={(e) => {
                          const start = Number(e.target.value) || 0;
                          onTimelineChange({
                            ...timeline,
                            voiceoverClips: (timeline.voiceoverClips ?? []).map((o) =>
                              o.id === v.id ? { ...o, startSeconds: start } : o,
                            ),
                          });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-zinc-600 text-[10px]">Duration (s)</Label>
                      <Input
                        type="number"
                        min={0.2}
                        step={0.1}
                        className="h-7 bg-zinc-900 border-zinc-700"
                        value={v.durationSeconds}
                        onChange={(e) => {
                          const durationSeconds = Number(e.target.value) || 0.2;
                          onTimelineChange({
                            ...timeline,
                            voiceoverClips: (timeline.voiceoverClips ?? []).map((o) =>
                              o.id === v.id ? { ...o, durationSeconds } : o,
                            ),
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="space-y-4">
          <VideoEditorToolsPanel
            timeline={timeline}
            selectedIndex={selectedIndex}
            selectedClip={selectedClip}
            videoDuration={videoDuration}
            onTimelineChange={onTimelineChange}
            onSplit={onSplit}
            onDuplicate={onDuplicate}
            showTabs={['text']}
            playheadSeconds={insertAtDisplay}
            getInsertAtSeconds={getInsertAtSeconds}
            className="w-full"
          />
          </div>
        )}

        {activeTab === 'effects' && (
          <>
            <VideoEditorToolsPanel
              timeline={timeline}
              selectedIndex={selectedIndex}
              selectedClip={selectedClip}
              videoDuration={videoDuration}
              onTimelineChange={onTimelineChange}
              onSplit={onSplit}
              onDuplicate={onDuplicate}
              showTabs={['adjust', 'edit']}
              defaultTab="adjust"
              getInsertAtSeconds={getInsertAtSeconds}
              playheadSeconds={insertAtDisplay}
              className="w-full"
            />

            {selectedClip && (
          <div className="space-y-4 mt-4 pt-4 border-t border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase">Clip effects</h3>
            <div className="space-y-2">
              <Label className="text-zinc-400">Video effect</Label>
              <Select
                value={selectedClip.videoEffect ?? 'none'}
                onValueChange={(v) => updateClip({ videoEffect: v === 'none' ? undefined : (v as keyof typeof TIMELINE_VIDEO_EFFECT_LABELS) })}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="none">None</SelectItem>
                  {Object.entries(TIMELINE_VIDEO_EFFECT_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center justify-between gap-2 text-sm text-zinc-300">
              Green screen (chroma key)
              <Switch
                checked={Boolean(selectedClip.chromaKey?.enabled)}
                onCheckedChange={(checked) =>
                  updateClip({ chromaKey: checked ? { enabled: true, color: '00ff00', similarity: 0.15, blend: 0.08 } : undefined })
                }
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm text-zinc-300">
              Slow zoom (photos)
              <Switch
                checked={selectedClip.kenBurns?.enabled !== false}
                onCheckedChange={(checked) =>
                  updateClip({
                    kenBurns: checked
                      ? defaultKenBurnsForSlideIndex(Math.max(0, selectedIndex))
                      : { enabled: false },
                  })
                }
              />
            </label>
            <div className="space-y-2">
              <Label className="text-zinc-400">Punch-in zoom ({(selectedClip.cropZoom ?? 1).toFixed(2)}×)</Label>
              <Slider
                min={1}
                max={2}
                step={0.02}
                value={[selectedClip.cropZoom ?? 1]}
                onValueChange={([v]) => updateClip({ cropZoom: v <= 1.001 ? undefined : v })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Reframe crop</Label>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-zinc-700"
                  onClick={() => updateClip({ crop: undefined })}
                >
                  Full frame
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-zinc-700"
                  onClick={() => updateClip({ crop: { x: 0.1, y: 0, w: 0.8, h: 1 } })}
                >
                  Center 4:5
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-zinc-700"
                  onClick={() => updateClip({ crop: { x: 0.2, y: 0.05, w: 0.6, h: 0.9 } })}
                >
                  Tight center
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">
                Clip opacity ({Math.round((selectedClip.opacity ?? 1) * 100)}%)
              </Label>
              <Slider
                min={0.05}
                max={1}
                step={0.01}
                value={[selectedClip.opacity ?? 1]}
                onValueChange={([v]) => {
                  const clamped = clampLayerOpacity(v);
                  updateClip({ opacity: clamped });
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-zinc-500 text-xs">Fade in (s)</Label>
                <Input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  className="h-8 bg-zinc-900 border-zinc-700"
                  value={selectedClip.fadeInSeconds ?? ''}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    updateClip({ fadeInSeconds: v > 0 ? v : undefined });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-zinc-500 text-xs">Fade out (s)</Label>
                <Input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  className="h-8 bg-zinc-900 border-zinc-700"
                  value={selectedClip.fadeOutSeconds ?? ''}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    updateClip({ fadeOutSeconds: v > 0 ? v : undefined });
                  }}
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full border-zinc-700"
              disabled={(timeline.pipLayers?.length ?? 0) >= MAX_PIP_LAYERS}
              onClick={() => {
                const at = resolveInsertAt();
                onTimelineChange((prev) =>
                  addPipLayer(prev, {
                    id: crypto.randomUUID(),
                    kind: selectedClip.kind,
                    sourceUrl: selectedClip.sourceUrl,
                    startSeconds: at,
                    durationSeconds: 4,
                    x: 75,
                    y: 25,
                    widthPercent: 32,
                    opacity: 1,
                  }),
                );
              }}
            >
              Add as picture-in-picture
            </Button>
            {(timeline.pipLayers ?? []).map((p) => (
              <div key={p.id} className="text-xs text-zinc-500 flex justify-between">
                <span>PiP · {p.kind}</span>
                <button type="button" className="text-red-400" onClick={() => onTimelineChange(removePipLayer(timeline, p.id))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
            )}
          </>
        )}

        {activeTab === 'stickers' && (
          <div className="space-y-4">
            <div className="grid grid-cols-6 gap-1.5">
              {EDITOR_STICKER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={(timeline.stickerOverlays?.length ?? 0) >= MAX_STICKER_OVERLAYS}
                  className="text-2xl h-10 rounded-xl border border-transparent hover:border-border/60 hover:bg-secondary/50 transition-colors"
                  onClick={() => {
                    const at = resolveInsertAt();
                    onTimelineChange((prev) =>
                      addStickerOverlay(prev, {
                        id: crypto.randomUUID(),
                        emoji,
                        startSeconds: at,
                        durationSeconds: 3,
                        x: 50,
                        y: 40,
                        scale: 1,
                      }),
                    );
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {(timeline.stickerOverlays ?? []).map((s) => (
              <div key={s.id} className={cn(editorCardClass, 'p-3 space-y-2 text-xs')}>
                <div className="flex justify-between items-center">
                  <span className="text-2xl">{s.emoji}</span>
                  <button type="button" className="text-red-400" onClick={() => onTimelineChange(removeStickerOverlay(timeline, s.id))}>
                    Remove
                  </button>
                </div>
                <Label className="text-zinc-500">Start (s)</Label>
                <Input
                  type="number"
                  className="h-8 bg-zinc-900 border-zinc-700"
                  value={s.startSeconds}
                  onChange={(e) => {
                    const list = (timeline.stickerOverlays ?? []).map((o) =>
                      o.id === s.id ? { ...o, startSeconds: Number(e.target.value) || 0 } : o,
                    );
                    onTimelineChange({ ...timeline, stickerOverlays: list });
                  }}
                />
                <Label className="text-zinc-500">Opacity ({Math.round((s.opacity ?? 1) * 100)}%)</Label>
                <Slider
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={[s.opacity ?? 1]}
                  onValueChange={([v]) => {
                    const list = (timeline.stickerOverlays ?? []).map((o) =>
                      o.id === s.id ? { ...o, opacity: clampLayerOpacity(v) } : o,
                    );
                    onTimelineChange({ ...timeline, stickerOverlays: list });
                  }}
                />
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
