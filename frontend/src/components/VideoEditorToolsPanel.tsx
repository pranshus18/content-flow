import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EditorTimeline, TimelineClip, TimelineFilterPreset } from '@/lib/editorTimeline';
import {
  TIMELINE_FILTER_LABELS,
  TIMELINE_FILTER_PRESETS,
  MIN_CLIP_SPEED,
  MAX_CLIP_SPEED,
  MAX_TEXT_OVERLAYS,
  EDITOR_TEXT_PRESETS,
  clampLayerOpacity,
  addTextOverlay,
  removeTextOverlay,
  updateTextOverlayAt,
} from '@/lib/editorTimeline';
import { useEffect, useMemo, useState } from 'react';
import { Copy, Scissors, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimelineTextOverlay } from '@/lib/editorTimeline';

type ToolTab = 'edit' | 'adjust' | 'text' | 'audio';

type Props = {
  timeline: EditorTimeline;
  selectedIndex: number;
  selectedClip: TimelineClip | undefined;
  videoDuration: number | undefined;
  onTimelineChange: (next: EditorTimeline | ((prev: EditorTimeline) => EditorTimeline)) => void;
  onSplit: () => void;
  onDuplicate: () => void;
  /** When set, only show these tool tabs (studio side panel). */
  showTabs?: ToolTab[];
  defaultTab?: ToolTab;
  playheadSeconds?: number;
  getInsertAtSeconds?: () => number;
  className?: string;
};

function TextOverlayEditorForm({
  overlay,
  playheadSeconds,
  onChange,
}: {
  overlay: TimelineTextOverlay;
  playheadSeconds: number;
  onChange: (patch: Partial<TimelineTextOverlay>) => void;
}) {
  const visibleEnd = overlay.startSeconds + overlay.durationSeconds;
  const visibleNow =
    playheadSeconds >= overlay.startSeconds && playheadSeconds < visibleEnd;

  return (
    <div className="space-y-3 pt-1">
      <p
        className={cn(
          'text-[10px] tabular-nums rounded px-2 py-1 border',
          visibleNow
            ? 'text-primary border-primary/30 bg-primary/10'
            : 'text-muted-foreground border-border/60 bg-secondary/20',
        )}
      >
        {visibleNow ? 'Visible' : 'Hidden'} · {overlay.startSeconds.toFixed(1)}–{visibleEnd.toFixed(1)}s
      </p>
      <div className="space-y-1">
        <Label className="text-xs">Caption text</Label>
        <Input value={overlay.text} onChange={(e) => onChange({ text: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Start (s)</Label>
          <Input
            type="number"
            min={0}
            step={0.1}
            value={overlay.startSeconds}
            onChange={(e) => onChange({ startSeconds: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Duration (s)</Label>
          <Input
            type="number"
            min={0.2}
            step={0.1}
            value={overlay.durationSeconds}
            onChange={(e) => onChange({ durationSeconds: Number(e.target.value) || 0.2 })}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Position</Label>
        <Select
          value={overlay.position ?? 'bottom'}
          onValueChange={(v) => onChange({ position: v as 'top' | 'center' | 'bottom' })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Top</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="bottom">Bottom</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Text color (#hex)</Label>
          <Input
            className="h-9 font-mono text-xs"
            placeholder="ffffff"
            value={overlay.textColor ?? ''}
            onChange={(e) => onChange({ textColor: e.target.value.replace(/^#/, '') || undefined })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Stroke</Label>
          <Input
            className="h-9 font-mono text-xs"
            placeholder="000000"
            value={overlay.strokeColor ?? ''}
            onChange={(e) => onChange({ strokeColor: e.target.value.replace(/^#/, '') || undefined })}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Stroke width (px)</Label>
        <Input
          type="number"
          min={0}
          max={12}
          step={0.5}
          className="h-9 w-full max-w-[120px]"
          value={overlay.strokeWidth ?? 0}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange({ strokeWidth: Number.isFinite(v) && v > 0 ? v : undefined });
          }}
        />
      </div>
      <div className="space-y-2 rounded-lg border border-border/50 bg-secondary/15 p-3">
        <label className="flex items-center justify-between gap-3 text-xs">
          <span>Drop shadow</span>
          <Switch
            checked={Boolean(overlay.shadow)}
            onCheckedChange={(checked) => onChange({ shadow: checked ? true : undefined })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-xs">
          <span>Caption background box</span>
          <Switch
            checked={overlay.showBackground !== false}
            onCheckedChange={(checked) => onChange({ showBackground: checked })}
          />
        </label>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Layer opacity</Label>
          <span className="text-xs font-mono tabular-nums text-muted-foreground">
            {Math.round((overlay.opacity ?? 1) * 100)}%
          </span>
        </div>
        <Slider
          key={`text-opacity-${overlay.id}`}
          min={0.05}
          max={1}
          step={0.01}
          value={[overlay.opacity ?? 1]}
          onValueChange={([v]) => onChange({ opacity: clampLayerOpacity(v) })}
          className="py-1"
        />
      </div>
    </div>
  );
}

export function VideoEditorToolsPanel({
  timeline,
  selectedIndex,
  selectedClip,
  videoDuration,
  onTimelineChange,
  onSplit,
  onDuplicate,
  showTabs,
  defaultTab: defaultTabProp,
  playheadSeconds = 0,
  getInsertAtSeconds,
  className,
}: Props) {
  const resolveInsertAt = () => Math.max(0, getInsertAtSeconds?.() ?? playheadSeconds);
  const visibleTabs: ToolTab[] = showTabs?.length ? showTabs : ['edit', 'adjust', 'text', 'audio'];
  const defaultTab =
    defaultTabProp && visibleTabs.includes(defaultTabProp) ? defaultTabProp : visibleTabs[0];
  const updateClip = (patch: Partial<TimelineClip>) => {
    if (selectedIndex < 0) return;
    onTimelineChange((prev) => ({
      ...prev,
      clips: prev.clips.map((c, i) => (i === selectedIndex ? { ...c, ...patch } : c)),
    }));
  };

  const adj = selectedClip?.adjustments ?? {};

  const textOverlays = useMemo(() => timeline.textOverlays ?? [], [timeline.textOverlays]);
  const overlayAtPlayhead = useMemo(
    () =>
      textOverlays.find(
        (o) =>
          playheadSeconds >= o.startSeconds &&
          playheadSeconds < o.startSeconds + o.durationSeconds,
      ),
    [textOverlays, playheadSeconds],
  );
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  useEffect(() => {
    if (!textOverlays.length) {
      setSelectedTextId(null);
      return;
    }
    if (selectedTextId && textOverlays.some((o) => o.id === selectedTextId)) return;
    setSelectedTextId(overlayAtPlayhead?.id ?? textOverlays[0]?.id ?? null);
  }, [textOverlays, selectedTextId, overlayAtPlayhead?.id]);

  const activeTextOverlay = textOverlays.find((o) => o.id === selectedTextId);

  return (
    <Tabs defaultValue={defaultTab} className={className ?? 'w-full'}>
      {visibleTabs.length > 1 && (
        <TabsList className="flex flex-wrap h-auto gap-1 bg-secondary/40 p-1 rounded-lg border border-border/50">
          {visibleTabs.includes('edit') && <TabsTrigger value="edit">Edit</TabsTrigger>}
          {visibleTabs.includes('adjust') && <TabsTrigger value="adjust">Adjust</TabsTrigger>}
          {visibleTabs.includes('text') && <TabsTrigger value="text">Text</TabsTrigger>}
          {visibleTabs.includes('audio') && <TabsTrigger value="audio">Audio</TabsTrigger>}
        </TabsList>
      )}

      {visibleTabs.includes('edit') && (
      <TabsContent value="edit" className="space-y-4 mt-4">
        {!selectedClip && (
          <p className="text-sm text-muted-foreground">Select a clip on the timeline.</p>
        )}
        {selectedClip && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onDuplicate}>
                <Copy className="w-4 h-4 mr-1" />
                Duplicate
              </Button>
              {selectedClip.kind === 'video' && (
                <Button size="sm" variant="outline" onClick={onSplit} disabled={!videoDuration}>
                  <Scissors className="w-4 h-4 mr-1" />
                  Split at trim start
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label>Speed ({(selectedClip.speed ?? 1).toFixed(2)}×)</Label>
              <Slider
                min={MIN_CLIP_SPEED}
                max={MAX_CLIP_SPEED}
                step={0.05}
                value={[selectedClip.speed ?? 1]}
                onValueChange={([v]) => updateClip({ speed: v === 1 ? undefined : v })}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={Boolean(selectedClip.reverse)}
                  onCheckedChange={(checked) => updateClip({ reverse: checked || undefined })}
                />
                Reverse
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={Boolean(selectedClip.flipHorizontal)}
                  onCheckedChange={(checked) => updateClip({ flipHorizontal: checked || undefined })}
                />
                Mirror
              </label>
            </div>
            <div className="space-y-2">
              <Label>Rotate</Label>
              <Select
                value={String(selectedClip.rotation ?? 0)}
                onValueChange={(v) => {
                  const rot = Number(v) as 0 | 90 | 180 | 270;
                  updateClip({ rotation: rot === 0 ? undefined : rot });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0°</SelectItem>
                  <SelectItem value="90">90°</SelectItem>
                  <SelectItem value="180">180°</SelectItem>
                  <SelectItem value="270">270°</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </TabsContent>
      )}

      {visibleTabs.includes('adjust') && (
      <TabsContent value="adjust" className="space-y-4 mt-4">
        {!selectedClip && (
          <p className="text-sm text-muted-foreground">Select a clip to adjust color and filters.</p>
        )}
        {selectedClip && (
          <>
            <div className="space-y-2">
              <Label>Filter preset</Label>
              <Select
                value={selectedClip.filter ?? 'none'}
                onValueChange={(v) =>
                  updateClip({ filter: v === 'none' ? undefined : (v as TimelineFilterPreset) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {TIMELINE_FILTER_PRESETS.filter((p) => p !== 'none').map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {TIMELINE_FILTER_LABELS[preset]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(['brightness', 'contrast', 'saturation'] as const).map((key) => (
              <div key={key} className="space-y-2">
                <Label className="capitalize">
                  {key} ({adj[key] ?? 0})
                </Label>
                <Slider
                  min={-100}
                  max={100}
                  step={1}
                  value={[adj[key] ?? 0]}
                  onValueChange={([v]) => {
                    const next = { ...adj, [key]: v === 0 ? undefined : v };
                    const empty = !next.brightness && !next.contrast && !next.saturation;
                    updateClip({ adjustments: empty ? undefined : next });
                  }}
                />
              </div>
            ))}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label>Clip opacity ({Math.round((selectedClip.opacity ?? 1) * 100)}%)</Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Blends the whole clip over black — matches export after letterboxing.
              </p>
              <Slider
                min={0.05}
                max={1}
                step={0.01}
                value={[selectedClip.opacity ?? 1]}
                onValueChange={([v]) => {
                  updateClip({ opacity: clampLayerOpacity(v) });
                }}
              />
            </div>
          </>
        )}
      </TabsContent>
      )}

      {visibleTabs.includes('text') && (
      <TabsContent value="text" className="space-y-4 mt-4">
        <p className="text-xs text-muted-foreground">
          Titles and captions are burned into the export (CapCut-style). For auto-transcription, use your
          content caption field when publishing.
        </p>
        <div className="flex flex-wrap gap-1">
          {EDITOR_TEXT_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant="secondary"
              className="text-xs h-8"
              disabled={(timeline.textOverlays?.length ?? 0) >= MAX_TEXT_OVERLAYS}
              onClick={() => {
                const at = resolveInsertAt();
                const id = crypto.randomUUID();
                onTimelineChange((prev) =>
                  addTextOverlay(prev, {
                    id,
                    text: 'Your text here',
                    startSeconds: at,
                    durationSeconds: 3,
                    position: 'bottom',
                    fontSize: 48,
                    textColor: preset.textColor,
                    strokeColor: 'strokeColor' in preset ? preset.strokeColor : undefined,
                    strokeWidth: 'strokeWidth' in preset ? preset.strokeWidth : undefined,
                    shadow: 'shadow' in preset ? preset.shadow : undefined,
                    showBackground: preset.showBackground,
                  }),
                );
                setSelectedTextId(id);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={(timeline.textOverlays?.length ?? 0) >= MAX_TEXT_OVERLAYS}
          onClick={() => {
            const at = resolveInsertAt();
            const id = crypto.randomUUID();
            onTimelineChange((prev) =>
              addTextOverlay(prev, {
                id,
                text: 'Your text here',
                startSeconds: at,
                durationSeconds: 3,
                position: 'bottom',
                fontSize: 48,
              }),
            );
            setSelectedTextId(id);
          }}
        >
          Add blank text layer
        </Button>

        {textOverlays.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              {textOverlays.length} text layer{textOverlays.length === 1 ? '' : 's'} on the timeline.
              Select one to edit — scrub the playhead or click a row.
            </p>
            <ul className="space-y-1 max-h-[140px] overflow-y-auto custom-scrollbar pr-0.5">
              {textOverlays.map((overlay, index) => {
                const selected = overlay.id === selectedTextId;
                const atPlayhead =
                  overlayAtPlayhead?.id === overlay.id;
                return (
                  <li key={overlay.id}>
                    <div
                      className={cn(
                        'flex items-center gap-1 rounded-lg border transition-colors',
                        selected ? 'border-primary/50 bg-primary/10' : 'border-border/60 bg-secondary/20',
                      )}
                    >
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left px-2.5 py-2 text-xs"
                        onClick={() => setSelectedTextId(overlay.id)}
                      >
                        <span className="font-mono text-muted-foreground tabular-nums">
                          {overlay.startSeconds.toFixed(1)}s
                        </span>
                        <span className="mx-1.5 text-muted-foreground/50">·</span>
                        <span className="truncate text-foreground">
                          {overlay.text.trim() || `Layer ${index + 1}`}
                        </span>
                        {atPlayhead && (
                          <span className="ml-1.5 text-[10px] text-primary font-medium">@ playhead</span>
                        )}
                      </button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          onTimelineChange((prev) => removeTextOverlay(prev, overlay.id));
                          if (selectedTextId === overlay.id) setSelectedTextId(null);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {activeTextOverlay && (
          <div className="rounded-xl border border-border/70 bg-card/30 p-3">
            <Label className="text-xs font-medium text-foreground">Edit selected layer</Label>
            <TextOverlayEditorForm
              key={activeTextOverlay.id}
              overlay={activeTextOverlay}
              playheadSeconds={playheadSeconds}
              onChange={(patch) =>
                onTimelineChange((prev) =>
                  updateTextOverlayAt(prev, activeTextOverlay.id, patch),
                )
              }
            />
          </div>
        )}

        {!textOverlays.length && (
          <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/60 p-4 text-center">
            No text yet. Use a preset above or add text from the Text tab.
          </p>
        )}
      </TabsContent>
      )}

      {visibleTabs.includes('audio') && (
      <TabsContent value="audio" className="space-y-4 mt-4">
        {selectedClip?.kind === 'video' && (
          <div className="space-y-2">
            <Label>Clip volume ({Math.round((selectedClip.volume ?? 1) * 100)}%)</Label>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[selectedClip.volume ?? 1]}
              onValueChange={([v]) => updateClip({ volume: v === 1 ? undefined : v })}
            />
          </div>
        )}
        {timeline.backgroundMusicTrackId && (
          <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Mix voiceover with music</p>
              <p className="text-xs text-muted-foreground">
                Keep original clip audio and layer background music underneath (CapCut-style).
              </p>
            </div>
            <Switch
              checked={timeline.mixOriginalAudioWithMusic !== false}
              onCheckedChange={(checked) =>
                onTimelineChange({ ...timeline, mixOriginalAudioWithMusic: checked })
              }
            />
          </label>
        )}
        {!selectedClip && !timeline.backgroundMusicTrackId && (
          <p className="text-sm text-muted-foreground">
            Add video clips for source audio, or pick background music below.
          </p>
        )}
      </TabsContent>
      )}
    </Tabs>
  );
}
