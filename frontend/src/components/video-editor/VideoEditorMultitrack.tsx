import { useEffect, useMemo, useRef, useState } from 'react';
import { roundTimelineSeconds } from '@/lib/editorTimelineLayout';
import type { EditorTimeline, TimelineClip, TimelineTransition } from '@/lib/editorTimeline';
import {
  DEFAULT_IMAGE_CLIP_SECONDS,
  TIMELINE_TRANSITION_LABELS,
  clampSeamlessImageBlendSeconds,
  effectiveTimelineJoint,
} from '@/lib/editorTimeline';
import { cn } from '@/lib/utils';
import {
  Film,
  Image as ImageIcon,
  Mic2,
  Music2,
  Sticker,
  Type,
  ZoomIn,
  ZoomOut,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  timeline: EditorTimeline;
  totalSeconds: number;
  selectedIndex: number;
  onSelectClip: (index: number) => void;
  /** Trim-aware segment length per video clip id */
  videoClipDurations?: Record<string, number>;
  playheadSeconds?: number;
  onSeek?: (seconds: number) => void;
  onMoveTimedItem?: (
    track: 'text' | 'sticker' | 'pip' | 'voice' | 'tts',
    id: string,
    startSeconds: number,
  ) => void;
  selectedJointIndex?: number | null;
  onSelectJoint?: (index: number) => void;
  /** Hide title and duplicate time readout (toolbar already shows time). */
  compactHeader?: boolean;
};

const MIN_PX_PER_SEC = 28;
const MAX_PX_PER_SEC = 120;
const DEFAULT_PX_PER_SEC = 52;

function clipSegmentSeconds(clip: TimelineClip, fullVideoDuration?: number): number {
  let segment = 0;
  if (clip.kind === 'image') {
    segment = clip.durationSeconds ?? DEFAULT_IMAGE_CLIP_SECONDS;
  } else if (fullVideoDuration != null && Number.isFinite(fullVideoDuration)) {
    const trimIn = clip.trimIn ?? 0;
    const trimOut = clip.trimOut ?? fullVideoDuration;
    segment = Math.max(0.1, trimOut - trimIn);
  } else {
    segment = 5;
  }
  const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
  return segment / speed;
}

function formatRulerTime(seconds: number) {
  const s = roundTimelineSeconds(seconds, 1);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return rem ? `${m}:${String(rem).padStart(2, '0')}` : `${m}:00`;
}

function buildVideoBlocks(
  timeline: EditorTimeline,
  videoClipDurations: Record<string, number> | undefined,
) {
  let cursor = 0;
  return timeline.clips.map((clip, index) => {
    const full = videoClipDurations?.[clip.id];
    const duration = clipSegmentSeconds(clip, full);
    const start = cursor;
    cursor += duration;
    const next = timeline.clips[index + 1];
    const blend = clampSeamlessImageBlendSeconds(timeline.seamlessImageBlendSeconds);
    const { durationSeconds: overlap } = effectiveTimelineJoint(timeline.joints[index], clip, next, blend);
    if (overlap > 0) cursor -= overlap;
    return { clip, index, start, duration };
  });
}

function WaveformBars({ className }: { className?: string }) {
  const heights = useMemo(
    () => Array.from({ length: 48 }, (_, i) => 20 + Math.abs(Math.sin(i * 0.7) * 55 + Math.cos(i * 0.35) * 25)),
    [],
  );
  return (
    <div className={cn('flex items-end gap-px h-full w-full px-1 opacity-90', className)}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 min-w-[2px] max-w-[4px] rounded-sm bg-emerald-400/70"
          style={{ height: `${Math.min(100, h)}%` }}
        />
      ))}
    </div>
  );
}

export function VideoEditorMultitrack({
  timeline,
  totalSeconds,
  selectedIndex,
  onSelectClip,
  videoClipDurations,
  playheadSeconds = 0,
  onSeek,
  onMoveTimedItem,
  selectedJointIndex = null,
  onSelectJoint,
  compactHeader = false,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pxPerSec, setPxPerSec] = useState(DEFAULT_PX_PER_SEC);
  const [dragPreview, setDragPreview] = useState<{ key: string; startSeconds: number } | null>(
    null,
  );

  const total = Math.max(totalSeconds, 1);
  const timelineWidth = Math.max(480, total * pxPerSec);

  const videoBlocks = useMemo(
    () => buildVideoBlocks(timeline, videoClipDurations),
    [timeline, videoClipDurations],
  );

  const rulerTicks = useMemo(() => {
    const step = total <= 15 ? 1 : total <= 45 ? 2 : total <= 120 ? 5 : 10;
    const ticks: number[] = [];
    for (let t = 0; t <= total + 0.01; t += step) ticks.push(t);
    return ticks;
  }, [total]);

  const playheadLeft = (playheadSeconds / total) * timelineWidth;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const laneLeft = 88;
    const x = laneLeft + playheadLeft;
    const margin = 48;
    if (x < el.scrollLeft + margin) {
      el.scrollLeft = Math.max(0, x - margin);
    } else if (x > el.scrollLeft + el.clientWidth - margin) {
      el.scrollLeft = x - el.clientWidth + margin;
    }
  }, [playheadLeft, playheadSeconds]);

  const seekFromClientX = (clientX: number) => {
    if (!onSeek || !scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = clientX - rect.left + scrollRef.current.scrollLeft;
    const laneLeft = 88;
    const xInTimeline = x - laneLeft;
    const sec = roundTimelineSeconds(
      Math.max(0, Math.min(total, (xInTimeline / timelineWidth) * total)),
    );
    onSeek(sec);
  };

  const timedStart = (track: string, id: string, startSeconds: number) => {
    const key = `${track}:${id}`;
    if (dragPreview?.key === key) return dragPreview.startSeconds;
    return startSeconds;
  };

  const dragTimedClip = (
    track: 'text' | 'sticker' | 'pip' | 'voice' | 'tts',
    id: string,
    startSeconds: number,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    onSeek?.(startSeconds);
    if (!onMoveTimedItem) return;
    const key = `${track}:${id}`;
    const originX = e.clientX;
    const originStart = startSeconds;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - originX;
      const dSec = (dx / timelineWidth) * total;
      setDragPreview({ key, startSeconds: Math.max(0, originStart + dSec) });
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const dx = ev.clientX - originX;
      const dSec = (dx / timelineWidth) * total;
      const next = roundTimelineSeconds(Math.max(0, originStart + dSec));
      setDragPreview(null);
      onMoveTimedItem(track, id, next);
      onSeek?.(next);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="rounded-lg border border-border/50 bg-[hsl(222_47%_5%)] overflow-hidden shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)]">
      <div className="flex items-center justify-end gap-2 px-2 py-1.5 border-b border-border/50 bg-card/25">
        <div className="flex items-center gap-1">
          {!compactHeader && (
            <span className="text-[11px] tabular-nums text-muted-foreground mr-1 font-mono">
              {formatRulerTime(playheadSeconds)} / {formatRulerTime(total)}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400"
            onClick={() => setPxPerSec((p) => Math.max(MIN_PX_PER_SEC, p - 12))}
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400"
            onClick={() => setPxPerSec((p) => Math.min(MAX_PX_PER_SEC, p + 12))}
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden custom-scrollbar"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-clip], [data-timed-clip], [data-joint]'))
            return;
          seekFromClientX(e.clientX);
        }}
      >
        <div style={{ width: timelineWidth + 88 }} className="min-h-[220px] relative">
          {/* Time ruler */}
          <div className="flex sticky top-0 z-20 bg-[hsl(222_47%_5%)] border-b border-border/50">
            <div className="w-[88px] shrink-0 border-r border-border/50" />
            <div className="relative h-7 flex-1" style={{ width: timelineWidth }}>
              {rulerTicks.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 h-full border-l border-zinc-700/50"
                  style={{ left: (t / total) * timelineWidth }}
                >
                  <span className="absolute top-0.5 left-1 text-[9px] text-muted-foreground tabular-nums whitespace-nowrap font-mono">
                    {formatRulerTime(t)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Playhead */}
          <div
            className="absolute top-7 bottom-0 w-px z-30 pointer-events-none"
            style={{ left: 88 + playheadLeft }}
          >
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)]" />
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-primary/90 shadow-[0_0_8px_hsl(var(--primary)/0.45)]" />
          </div>

          <TrackLane
            icon={<Film className="w-3.5 h-3.5" />}
            label="Video"
            height={44}
          >
            <div className="relative h-full" style={{ width: timelineWidth }}>
              {videoBlocks.map(({ clip, index, start, duration }) => {
                const left = (start / total) * timelineWidth;
                const width = Math.max(24, (duration / total) * timelineWidth);
                const isSelected = selectedIndex === index;
                const joint = timeline.joints[index];
                const jointLeft = left + width;
                const jointSelected = selectedJointIndex === index;
                const jointLabel =
                  joint && joint.transition !== 'none'
                    ? (TIMELINE_TRANSITION_LABELS[joint.transition as TimelineTransition] ?? joint.transition)
                        .split(' ')[0]
                    : 'Cut';
                return (
                  <div key={clip.id} className="contents">
                  <button
                    type="button"
                    data-clip
                    onClick={() => onSelectClip(index)}
                    style={{ left, width }}
                    className={cn(
                      'absolute top-1 bottom-1 rounded-md overflow-hidden border text-left transition-all',
                      isSelected
                        ? 'border-primary ring-2 ring-primary/35 z-10 shadow-[0_0_20px_-6px_hsl(var(--primary)/0.5)]'
                        : 'border-border/80 hover:border-primary/40',
                    )}
                  >
                    <div
                      className={cn(
                        'absolute inset-0 opacity-90',
                        clip.kind === 'video'
                          ? 'bg-gradient-to-r from-[hsl(222_40%_12%)] via-primary/25 to-[hsl(222_40%_14%)]'
                          : 'bg-gradient-to-r from-secondary/80 to-secondary/50',
                      )}
                    />
                    {clip.kind === 'video' && (
                      <div
                        className="absolute inset-0 opacity-30"
                        style={{
                          backgroundImage:
                            'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.06) 8px, rgba(255,255,255,0.06) 9px)',
                        }}
                      />
                    )}
                    <div className="relative z-[1] flex items-center gap-1 px-1.5 h-full min-w-0">
                      {clip.kind === 'image' ? (
                        <ImageIcon className="w-3 h-3 shrink-0 text-zinc-300" />
                      ) : (
                        <Film className="w-3 h-3 shrink-0 text-primary/90" />
                      )}
                      <span className="text-[10px] font-medium text-white truncate drop-shadow-sm">
                        {clip.label || `Clip ${index + 1}`}
                      </span>
                    </div>
                    {width > 36 && (
                      <span className="absolute bottom-0.5 right-1 text-[8px] tabular-nums text-zinc-400 z-[1]">
                        {duration.toFixed(1)}s
                      </span>
                    )}
                  </button>
                  {index < timeline.joints.length && onSelectJoint && (
                    <button
                      type="button"
                      data-joint
                      title={
                        joint
                          ? `${TIMELINE_TRANSITION_LABELS[joint.transition as TimelineTransition]} · ${joint.durationSeconds}s`
                          : 'Transition'
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectJoint(index);
                      }}
                      style={{ left: jointLeft - 10 }}
                      className={cn(
                        'absolute top-0 bottom-0 z-20 w-5 -translate-x-1/2 flex flex-col items-center justify-center gap-0.5',
                        jointSelected ? 'opacity-100' : 'opacity-80 hover:opacity-100',
                      )}
                    >
                      <div
                        className={cn(
                          'w-px flex-1 min-h-[6px] max-h-[14px] rounded-full',
                          jointSelected ? 'bg-primary' : 'bg-border',
                        )}
                      />
                      <span
                        className={cn(
                          'text-[7px] font-bold uppercase tracking-tighter px-0.5 py-px rounded leading-none whitespace-nowrap max-w-[44px] truncate',
                          jointSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary/80 text-muted-foreground border border-border/70',
                        )}
                      >
                        {jointLabel}
                      </span>
                      <div
                        className={cn(
                          'w-px flex-1 min-h-[6px] max-h-[14px] rounded-full',
                          jointSelected ? 'bg-primary' : 'bg-border',
                        )}
                      />
                    </button>
                  )}
                  </div>
                );
              })}
            </div>
          </TrackLane>

          <TrackLane icon={<Type className="w-3.5 h-3.5" />} label="Text" height={32}>
            <div className="relative h-full" style={{ width: timelineWidth }}>
              {(timeline.textOverlays ?? []).map((t) => (
                <div
                  key={t.id}
                  data-timed-clip
                  role="button"
                  tabIndex={0}
                  className="absolute top-1 bottom-1 rounded border border-sky-500/60 bg-sky-600/35 px-1 flex items-center min-w-[20px] cursor-ew-resize"
                  style={{
                    left: (timedStart('text', t.id, t.startSeconds) / total) * timelineWidth,
                    width: Math.max(20, (t.durationSeconds / total) * timelineWidth),
                  }}
                  title={`${t.text} · ${timedStart('text', t.id, t.startSeconds).toFixed(1)}s`}
                  onMouseDown={(e) => dragTimedClip('text', t.id, t.startSeconds, e)}
                >
                  <span className="text-[9px] text-sky-50 truncate">{t.text}</span>
                </div>
              ))}
            </div>
          </TrackLane>

          <TrackLane icon={<Layers className="w-3.5 h-3.5" />} label="PiP" height={32}>
            <div className="relative h-full" style={{ width: timelineWidth }}>
              {(timeline.pipLayers ?? []).map((p) => (
                <div
                  key={p.id}
                  data-timed-clip
                  className="absolute top-1 bottom-1 rounded border border-violet-500/50 bg-violet-600/30 px-1 flex items-center text-[9px] text-violet-100 cursor-ew-resize"
                  style={{
                    left: (timedStart('pip', p.id, p.startSeconds) / total) * timelineWidth,
                    width: Math.max(18, (p.durationSeconds / total) * timelineWidth),
                  }}
                  title={`PiP · ${timedStart('pip', p.id, p.startSeconds).toFixed(1)}s`}
                  onMouseDown={(e) => dragTimedClip('pip', p.id, p.startSeconds, e)}
                >
                  PiP
                </div>
              ))}
            </div>
          </TrackLane>

          <TrackLane icon={<Sticker className="w-3.5 h-3.5" />} label="Stickers" height={32}>
            <div className="relative h-full" style={{ width: timelineWidth }}>
              {(timeline.stickerOverlays ?? []).map((s) => (
                <div
                  key={s.id}
                  data-timed-clip
                  className="absolute top-1 bottom-1 rounded border border-amber-500/50 bg-amber-600/25 flex items-center justify-center text-base leading-none cursor-ew-resize"
                  style={{
                    left: (timedStart('sticker', s.id, s.startSeconds) / total) * timelineWidth,
                    width: Math.max(18, (s.durationSeconds / total) * timelineWidth),
                  }}
                  title={`${timedStart('sticker', s.id, s.startSeconds).toFixed(1)}s`}
                  onMouseDown={(e) => dragTimedClip('sticker', s.id, s.startSeconds, e)}
                >
                  {s.emoji}
                </div>
              ))}
            </div>
          </TrackLane>

          <TrackLane icon={<Music2 className="w-3.5 h-3.5" />} label="Music" height={34}>
            <div className="relative h-full" style={{ width: timelineWidth }}>
              {timeline.backgroundMusicTrackId && (
                <div
                  className="absolute top-1 bottom-1 left-0 rounded border border-emerald-500/40 bg-emerald-950/50 overflow-hidden"
                  style={{ width: timelineWidth }}
                >
                  <WaveformBars />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-emerald-200/90 font-medium pointer-events-none">
                    Music
                  </span>
                </div>
              )}
            </div>
          </TrackLane>

          <TrackLane icon={<Mic2 className="w-3.5 h-3.5" />} label="Voice" height={32}>
            <div className="relative h-full" style={{ width: timelineWidth }}>
              {(timeline.voiceoverClips ?? []).map((v) => (
                <div
                  key={v.id}
                  data-timed-clip
                  className="absolute top-1 bottom-1 rounded border border-pink-500/50 bg-pink-950/40 overflow-hidden min-w-[16px] cursor-ew-resize"
                  style={{
                    left: (timedStart('voice', v.id, v.startSeconds) / total) * timelineWidth,
                    width: Math.max(16, (v.durationSeconds / total) * timelineWidth),
                  }}
                  title={`${v.label || 'Voice'} · ${timedStart('voice', v.id, v.startSeconds).toFixed(1)}s`}
                  onMouseDown={(e) => dragTimedClip('voice', v.id, v.startSeconds, e)}
                >
                  <WaveformBars className="opacity-60" />
                </div>
              ))}
              {(timeline.ttsClips ?? []).map((t) => (
                <div
                  key={t.id}
                  data-timed-clip
                  className="absolute top-1 bottom-1 rounded border border-fuchsia-500/50 bg-fuchsia-950/40 px-1 flex items-center text-[9px] text-fuchsia-100 min-w-[16px] cursor-ew-resize"
                  style={{
                    left: (timedStart('tts', t.id, t.startSeconds) / total) * timelineWidth,
                    width: Math.max(16, ((t.durationSeconds ?? 4) / total) * timelineWidth),
                  }}
                  title={`TTS · ${timedStart('tts', t.id, t.startSeconds).toFixed(1)}s`}
                  onMouseDown={(e) => dragTimedClip('tts', t.id, t.startSeconds, e)}
                >
                  TTS
                </div>
              ))}
            </div>
          </TrackLane>
        </div>
      </div>
    </div>
  );
}

function TrackLane({
  icon,
  label,
  height,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  height: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex border-b border-border/40 hover:bg-card/20 transition-colors"
      style={{ height }}
    >
      <div className="w-[88px] shrink-0 flex items-center gap-1.5 px-2 border-r border-border/50 bg-card/25 text-muted-foreground">
        <span className="text-primary/70">{icon}</span>
        <span className="text-[10px] font-medium truncate">{label}</span>
      </div>
      <div className="flex-1 relative bg-[hsl(222_47%_6%)] min-w-0">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.35]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent, transparent 47px, rgba(255,255,255,0.04) 47px, rgba(255,255,255,0.04) 48px)',
          }}
        />
        {children}
      </div>
    </div>
  );
}
