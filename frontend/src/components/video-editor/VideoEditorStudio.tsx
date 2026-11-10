import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { VideoEditorSidePanel, type EditorSideTab } from '@/components/video-editor/VideoEditorSidePanel';
import { VideoEditorMultitrack } from '@/components/video-editor/VideoEditorMultitrack';
import { EditorPreviewOverlays } from '@/components/video-editor/EditorPreviewOverlays';
import { EditorTransitionPreview } from '@/components/video-editor/EditorTransitionPreview';
import { SlideshowFrameImage } from '@/components/video-editor/SlideshowFrameImage';
import { TransitionSelectContent } from '@/components/video-editor/TransitionSelectContent';
import { useEditorPreviewAudio } from '@/hooks/useEditorPreviewAudio';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AssetPickerDialog } from '@/components/AssetPickerDialog';
import { ExportPostDialog } from '@/components/ExportPostDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import type { ContentItem } from '@/hooks/useContent';
import { renderEditorTimeline, saveContentEditorTimeline } from '@/lib/editorBackend';
import { uploadAdminAsset, isImageAsset, type AdminAsset } from '@/lib/adminAssets';
import {
  type EditorTimeline,
  type EditorPlatform,
  type TimelineTransition,
  type TimelineJoint,
  TIMELINE_TRANSITION_LABELS,
  EDITOR_PLATFORM_SPECS,
  DEFAULT_IMAGE_CLIP_SECONDS,
  MIN_JOINT_DURATION,
  MAX_JOINT_DURATION,
  estimateTimelineDurationSeconds,
  addClipToTimeline,
  removeClipAt,
  moveClip,
  updateClipAt,
  updateJointAt,
  updateAllJoints,
  setTimelinePlatform,
  clipFromMediaUrl,
  seedTimelineFromContent,
  saveLocalEditorDraft,
  clearLocalEditorDraft,
  duplicateClipAt,
  splitVideoClipAt,
  resolveEditorPlatform,
  clampSeamlessImageBlendSeconds,
  effectiveTimelineJoint,
} from '@/lib/editorTimeline';
import { getVideoMetadata } from '@/utils/videoProcess';
import { errorMessage } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  clipActiveEffectLabels,
  clipPreviewMediaStyle,
  clipPreviewOpacity,
  clipPreviewWrapperClass,
  clipPreviewWrapperStyle,
} from '@/lib/editorClipPreview';
import {
  clipLocalProgress01,
  clipSegmentSeconds,
  clipTimelineStartSeconds,
  findClipAtTimelineSeconds,
  roundTimelineSeconds,
} from '@/lib/editorTimelineLayout';
import { transitionBlendAtPlayhead } from '@/lib/editorTransitionAtPlayhead';
import { resolvePreviewFrameLayout } from '@/lib/editorPreviewAspect';
import {
  animateTransitionBlend,
  clipIndexAtPlayhead,
  holdImageClip,
  playVideoClipSegment,
  waitAnimationFrames,
  waitForVideoRef,
} from '@/lib/editorTimelinePreview';
import {
  ArrowDown,
  ArrowUp,
  Download,
  Loader2,
  Play,
  Square,
  Redo2,
  Save,
  Send,
  Share2,
  Trash2,
  Undo2,
  Film,
} from 'lucide-react';
import {
  editorCardClass,
  editorCardPadding,
  editorFieldLabelClass,
  editorInputClass,
  editorPanelTitleClass,
  editorPreviewFrameClass,
  editorPreviewStageClass,
  editorEmbeddedShellClass,
  editorMonitorBarClass,
  editorMonitorTitleClass,
  editorSectionTitleClass,
  editorSelectTriggerClass,
  editorShellClass,
  editorToolbarClass,
  formatEditorTimecode,
} from '@/components/video-editor/editorUi';

function isVideoUrl(url: string, mime?: string | null) {
  if (mime?.startsWith('video/')) return true;
  return /\.(mp4|mov|webm)(\?|$)/i.test(url);
}

type VideoMeta = { duration: number; width: number; height: number };

export type VideoEditorStudioProps = {
  contentId?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  initialPlatform?: EditorPlatform;
  savedTimeline?: EditorTimeline | null;
  /** For “replace existing” export picker */
  replaceOptions?: Array<{ id: string; title: string; status: string }>;
  layout?: 'page' | 'embedded';
  /** When embedded inside a fullscreen shell, grow to fill remaining height. */
  fillViewport?: boolean;
  className?: string;
  onSaved?: () => void;
  onExportComplete?: () => void;
  /** Full content row when editing a linked post (enables publish & posting kit). */
  linkedContent?: ContentItem | null;
  captionOverride?: string;
  platformOverride?: string;
  onPublishContent?: (contentId: string) => Promise<void>;
  onContentSynced?: (content: ContentItem) => void;
};

export function VideoEditorStudio({
  contentId = '',
  mediaUrl,
  mediaType,
  initialPlatform = 'youtube',
  savedTimeline,
  replaceOptions = [],
  layout = 'page',
  fillViewport = false,
  className,
  onSaved,
  onExportComplete,
  linkedContent = null,
  captionOverride,
  platformOverride,
  onPublishContent,
  onContentSynced,
}: VideoEditorStudioProps) {
  const embedded = layout === 'embedded';
  const minimalUi = layout === 'page';
  const { toast } = useToast();

  const [platform, setPlatform] = useState<EditorPlatform>(initialPlatform);
  const [timeline, setTimeline] = useState<EditorTimeline>(() =>
    seedTimelineFromContent(initialPlatform, mediaUrl, mediaType, savedTimeline),
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedJointIndex, setSelectedJointIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPostOpen, setExportPostOpen] = useState(false);
  const [openPostingKitAfterRender, setOpenPostingKitAfterRender] = useState(Boolean(contentId));
  const [publishContent, setPublishContent] = useState<ContentItem | null>(linkedContent);
  const [publishingSocial, setPublishingSocial] = useState(false);
  const [exportMode, setExportMode] = useState<'render_only' | 'new_draft' | 'replace'>(
    contentId ? 'replace' : 'new_draft',
  );
  const [exportTitle, setExportTitle] = useState('');
  const [replaceContentId, setReplaceContentId] = useState(contentId);
  const [rendering, setRendering] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [videoMeta, setVideoMeta] = useState<Record<string, VideoMeta>>({});
  const [imageMeta, setImageMeta] = useState<Record<string, { width: number; height: number }>>({});
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [sideTab, setSideTab] = useState<EditorSideTab>('media');
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const playheadSecondsRef = useRef(0);
  const timelinePlayActiveRef = useRef(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const pendingPreviewVideoTimeRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const undoPastRef = useRef<EditorTimeline[]>([]);
  const undoFutureRef = useRef<EditorTimeline[]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  const canUndo = undoPastRef.current.length > 0;
  const canRedo = undoFutureRef.current.length > 0;
  void historyTick;

  const seedKey = `${contentId}:${mediaUrl ?? ''}`;

  useEffect(() => {
    setPlatform(initialPlatform);
    setReplaceContentId(contentId);
    setTimeline(seedTimelineFromContent(initialPlatform, mediaUrl, mediaType, savedTimeline));
    setSelectedIndex(0);
    setSelectedJointIndex(null);
    undoPastRef.current = [];
    undoFutureRef.current = [];
  }, [seedKey, initialPlatform, mediaUrl, mediaType, savedTimeline, contentId]);

  useEffect(() => {
    if (linkedContent) setPublishContent(linkedContent);
  }, [linkedContent]);

  const linkedForPublish = publishContent;
  const publishBlockedProcessing = Boolean(
    linkedForPublish &&
      onPublishContent &&
      (linkedForPublish.status === 'approved' || linkedForPublish.status === 'scheduled') &&
      linkedForPublish.preprocessing_status === 'pending',
  );

  useEffect(() => {
    if (embedded) return;
    const id = window.setTimeout(() => saveLocalEditorDraft(timeline), 500);
    return () => window.clearTimeout(id);
  }, [timeline, embedded]);

  const commitTimeline = useCallback((next: EditorTimeline | ((prev: EditorTimeline) => EditorTimeline)) => {
    setTimeline((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      undoPastRef.current = [...undoPastRef.current, structuredClone(prev)].slice(-40);
      undoFutureRef.current = [];
      setHistoryTick((n) => n + 1);
      return resolved;
    });
  }, []);

  const undoTimeline = useCallback(() => {
    const past = undoPastRef.current;
    if (!past.length) return;
    const previous = past[past.length - 1];
    undoPastRef.current = past.slice(0, -1);
    setTimeline((current) => {
      undoFutureRef.current = [...undoFutureRef.current, structuredClone(current)];
      setHistoryTick((n) => n + 1);
      return previous;
    });
  }, []);

  const redoTimeline = useCallback(() => {
    const future = undoFutureRef.current;
    if (!future.length) return;
    const next = future[future.length - 1];
    undoFutureRef.current = future.slice(0, -1);
    setTimeline((current) => {
      undoPastRef.current = [...undoPastRef.current, structuredClone(current)];
      setHistoryTick((n) => n + 1);
      return next;
    });
  }, []);

  const selectedClip = timeline.clips[selectedIndex];
  const activeJointIndex =
    selectedJointIndex != null && selectedJointIndex < timeline.joints.length
      ? selectedJointIndex
      : selectedIndex < timeline.joints.length
        ? selectedIndex
        : null;
  const activeJoint = activeJointIndex != null ? timeline.joints[activeJointIndex] : null;

  const loadVideoMeta = useCallback(async (clipId: string, url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], 'clip.mp4', { type: blob.type || 'video/mp4' });
      const meta = await getVideoMetadata(file);
      setVideoMeta((prev) => ({
        ...prev,
        [clipId]: { duration: meta.duration, width: meta.width, height: meta.height },
      }));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!selectedClip || selectedClip.kind !== 'video') return;
    if (videoMeta[selectedClip.id]) return;
    void loadVideoMeta(selectedClip.id, selectedClip.sourceUrl);
  }, [selectedClip, videoMeta, loadVideoMeta]);

  useEffect(() => {
    if (!selectedClip || selectedClip.kind !== 'image') return;
    if (imageMeta[selectedClip.id]) return;
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      setImageMeta((prev) => ({
        ...prev,
        [selectedClip.id]: { width: img.naturalWidth, height: img.naturalHeight },
      }));
    };
    img.src = selectedClip.sourceUrl;
  }, [selectedClip, imageMeta]);

  const estimatedDuration = useMemo(() => {
    const map = new Map<string, number>();
    for (const clip of timeline.clips) {
      if (clip.kind === 'video') {
        const meta = videoMeta[clip.id];
        if (meta) {
          const trimIn = clip.trimIn ?? 0;
          const trimOut = clip.trimOut ?? meta.duration;
          map.set(clip.id, Math.max(0.1, trimOut - trimIn));
        }
      }
    }
    return estimateTimelineDurationSeconds(timeline, map);
  }, [timeline, videoMeta]);

  const resolvedPlatform = resolveEditorPlatform(timeline.platform, platform);
  const platformSpec = EDITOR_PLATFORM_SPECS[resolvedPlatform];
  const maxPlatformSeconds = platformSpec.maxLengthSeconds;

  const previewFrame = useMemo(
    () =>
      resolvePreviewFrameLayout(
        selectedClip,
        videoMeta,
        imageMeta,
        platformSpec.width,
        platformSpec.height,
        embedded,
      ),
    [selectedClip, videoMeta, imageMeta, platformSpec.width, platformSpec.height, embedded],
  );

  const videoClipDurations = useMemo(() => {
    const map: Record<string, number> = {};
    for (const clip of timeline.clips) {
      if (clip.kind === 'video' && videoMeta[clip.id]?.duration) {
        map[clip.id] = videoMeta[clip.id].duration;
      }
    }
    return map;
  }, [timeline.clips, videoMeta]);

  const syncPlayhead = useCallback((seconds: number) => {
    const rounded = roundTimelineSeconds(seconds);
    playheadSecondsRef.current = rounded;
    setPlayheadSeconds(rounded);
  }, []);

  const getInsertAtSeconds = useCallback(() => playheadSecondsRef.current, []);

  useEditorPreviewAudio({
    timeline,
    playheadSeconds,
    videoRef: previewVideoRef,
    estimatedTimelineSeconds: Math.max(0.05, estimatedDuration),
    isTimelinePreviewPlaying: previewPlaying,
  });

  const handleMoveTimedItem = useCallback(
    (
      track: 'text' | 'sticker' | 'pip' | 'voice' | 'tts',
      id: string,
      startSeconds: number,
    ) => {
      const start = roundTimelineSeconds(Math.max(0, startSeconds));
      commitTimeline((prev) => {
        switch (track) {
          case 'text':
            return {
              ...prev,
              textOverlays: (prev.textOverlays ?? []).map((o) =>
                o.id === id ? { ...o, startSeconds: start } : o,
              ),
            };
          case 'sticker':
            return {
              ...prev,
              stickerOverlays: (prev.stickerOverlays ?? []).map((o) =>
                o.id === id ? { ...o, startSeconds: start } : o,
              ),
            };
          case 'pip':
            return {
              ...prev,
              pipLayers: (prev.pipLayers ?? []).map((o) =>
                o.id === id ? { ...o, startSeconds: start } : o,
              ),
            };
          case 'voice':
            return {
              ...prev,
              voiceoverClips: (prev.voiceoverClips ?? []).map((o) =>
                o.id === id ? { ...o, startSeconds: start } : o,
              ),
            };
          case 'tts':
            return {
              ...prev,
              ttsClips: (prev.ttsClips ?? []).map((o) =>
                o.id === id ? { ...o, startSeconds: start } : o,
              ),
            };
          default:
            return prev;
        }
      });
    },
    [commitTimeline],
  );

  const handleTimelineSeek = useCallback(
    (seconds: number) => {
      const rounded = roundTimelineSeconds(seconds);
      syncPlayhead(rounded);
      const overlap = transitionBlendAtPlayhead(timeline, rounded, videoClipDurations);
      const clipIndex = overlap?.toIndex ?? findClipAtTimelineSeconds(timeline, rounded, videoClipDurations)?.index;
      if (clipIndex == null) return;
      const clip = timeline.clips[clipIndex];
      setSelectedIndex(clipIndex);
      if (clip.kind === 'video') {
        const trimIn = clip.trimIn ?? 0;
        const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
        const sourceTime = trimIn + (rounded - at.clipStart) * speed;
        pendingPreviewVideoTimeRef.current = sourceTime;
        const el = previewVideoRef.current;
        if (el && el.readyState >= 1) {
          el.currentTime = sourceTime;
          pendingPreviewVideoTimeRef.current = null;
        }
      }
    },
    [timeline, videoClipDurations, syncPlayhead],
  );

  const handlePlatformChange = (value: EditorPlatform) => {
    setPlatform(value);
    commitTimeline((t) => setTimelinePlatform(t, value));
  };

  const handleAssetPicked = (asset: AdminAsset) => {
    const kind = isImageAsset(asset)
      ? 'image'
      : isVideoUrl(asset.file_url, asset.mime_type)
        ? 'video'
        : 'image';
    commitTimeline((t) => addClipToTimeline(t, clipFromMediaUrl(asset.file_url, kind, asset.name)));
    setPickerOpen(false);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith('video/');
        const asset = await uploadAdminAsset(file, { category: 'other', name: file.name });
        const kind = isVideo ? 'video' : 'image';
        commitTimeline((t) =>
          addClipToTimeline(t, clipFromMediaUrl(asset.file_url, kind, asset.name)),
        );
      }
    } catch (error: unknown) {
      toast({ title: 'Upload failed', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!contentId) {
      toast({ title: 'Draft saved locally', description: 'Link this item to save to the database.' });
      return;
    }
    setSavingDraft(true);
    try {
      await saveContentEditorTimeline(contentId, timeline);
      toast({ title: 'Timeline saved', description: 'Studio draft stored on this content item.' });
      onSaved?.();
    } catch (error: unknown) {
      toast({
        title: 'Could not save',
        description: errorMessage(error, 'Apply the editor_timeline migration in Supabase.'),
        variant: 'destructive',
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublishToSocial = async () => {
    const id = linkedForPublish?.id || replaceContentId || contentId;
    if (!id || !onPublishContent) return;
    if (linkedForPublish?.preprocessing_status === 'pending') {
      toast({
        title: 'Video still processing',
        description: 'Wait for platform preprocessing to finish, then publish again.',
        variant: 'destructive',
      });
      return;
    }
    setPublishingSocial(true);
    try {
      await onPublishContent(id);
    } finally {
      setPublishingSocial(false);
    }
  };

  const handleExport = async () => {
    setRendering(true);
    try {
      const targetContentId = exportMode === 'replace' ? replaceContentId : undefined;
      if (targetContentId) {
        await saveContentEditorTimeline(targetContentId, timeline);
      }

      const result = await renderEditorTimeline({
        timeline: {
          ...timeline,
          seamlessImageBlendSeconds: timeline.seamlessImageBlendSeconds,
          backgroundMusicTrackId: timeline.backgroundMusicTrackId ?? null,
          backgroundMusicVolume: timeline.backgroundMusicVolume ?? 1,
          textOverlays: timeline.textOverlays,
          stickerOverlays: timeline.stickerOverlays,
          voiceoverClips: timeline.voiceoverClips,
          ttsClips: timeline.ttsClips,
          pipLayers: timeline.pipLayers,
          mixOriginalAudioWithMusic: timeline.mixOriginalAudioWithMusic,
        },
        exportMode,
        title: exportMode === 'new_draft' ? exportTitle.trim() || `Edited video ${new Date().toLocaleDateString()}` : undefined,
        contentId: targetContentId,
      });

      if (exportMode === 'render_only') {
        toast({
          title: 'Video rendered',
          description: `Download ready (~${Math.ceil(result.durationSeconds)}s).`,
        });
        const link = document.createElement('a');
        link.href = result.mediaUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.download = `edited-video-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        toast({
          title: 'Applied to content',
          description:
            exportMode === 'replace'
              ? `Updated media (~${Math.ceil(result.durationSeconds)}s). Preprocessing may take a minute.`
              : `New draft created (~${Math.ceil(result.durationSeconds)}s).`,
        });
        if (!embedded) clearLocalEditorDraft();
        if (result.content) {
          setPublishContent(result.content);
          onContentSynced?.(result.content);
        }
        onExportComplete?.();
        if (openPostingKitAfterRender && result.content) {
          setExportPostOpen(true);
        }
      }
      setExportOpen(false);
    } catch (error: unknown) {
      toast({
        title: 'Render failed',
        description: errorMessage(error, 'Check clip URLs and transition durations.'),
        variant: 'destructive',
      });
    } finally {
      setRendering(false);
    }
  };

  const stopTimelinePreview = useCallback(() => {
    timelinePlayActiveRef.current = false;
    setPreviewPlaying(false);
    previewVideoRef.current?.pause();
  }, []);

  /** Crossfade overlap at playhead — same while scrubbing or playing preview. */
  const overlapBlendAtPlayhead = useMemo(
    () => transitionBlendAtPlayhead(timeline, playheadSeconds, videoClipDurations),
    [timeline, playheadSeconds, videoClipDurations],
  );

  const activeTransitionBlend = useMemo(() => {
    const blend = overlapBlendAtPlayhead;
    if (!blend) return null;
    const from = timeline.clips[blend.fromIndex];
    const to = timeline.clips[blend.toIndex];
    if (!from || !to) return null;

    return {
      from,
      to,
      fromIndex: blend.fromIndex,
      toIndex: blend.toIndex,
      transition: blend.transition,
      progress: blend.progress,
      fromKenBurnsProgress01: clipLocalProgress01(
        timeline,
        blend.fromIndex,
        playheadSeconds,
        videoClipDurations,
      ),
      toKenBurnsProgress01: clipLocalProgress01(
        timeline,
        blend.toIndex,
        playheadSeconds,
        videoClipDurations,
      ),
    };
  }, [overlapBlendAtPlayhead, timeline, playheadSeconds, videoClipDurations]);

  const runPreview = useCallback(async () => {
    if (!timeline.clips.length) return;
    timelinePlayActiveRef.current = true;
    setPreviewPlaying(true);

    const startIndex = clipIndexAtPlayhead(timeline, playheadSecondsRef.current, videoClipDurations);
    let enteringAfterOverlap = false;

    for (let i = startIndex; i < timeline.clips.length; i += 1) {
      if (!timelinePlayActiveRef.current) break;

      setSelectedIndex(i);
      const blockStart = clipTimelineStartSeconds(timeline, i, videoClipDurations);

      const clip = timeline.clips[i];
      const nextClip = timeline.clips[i + 1];
      const seamlessBlend = clampSeamlessImageBlendSeconds(timeline.seamlessImageBlendSeconds);
      const jointIn =
        i > 0
          ? effectiveTimelineJoint(
              timeline.joints[i - 1],
              timeline.clips[i - 1],
              clip,
              seamlessBlend,
            )
          : null;
      const incomingFade = jointIn?.durationSeconds ?? 0;
      const jointOut = effectiveTimelineJoint(timeline.joints[i], clip, nextClip, seamlessBlend);
      const fadeOut = jointOut.durationSeconds;
      const segDur = clipSegmentSeconds(clip, videoClipDurations[clip.id]);
      const soloEnd = Math.max(0, segDur - fadeOut);

      const skippedIncomingOverlap = enteringAfterOverlap;
      if (enteringAfterOverlap) enteringAfterOverlap = false;

      let clipTimeOffset = 0;
      if (skippedIncomingOverlap) {
        clipTimeOffset = incomingFade;
      } else if (i === startIndex && playheadSecondsRef.current > blockStart + 0.03) {
        clipTimeOffset = Math.min(soloEnd, Math.max(0, playheadSecondsRef.current - blockStart));
        syncPlayhead(blockStart + clipTimeOffset);
      } else {
        syncPlayhead(blockStart);
      }

      const soloHold = soloEnd - clipTimeOffset;

      const tickPlayhead = (localOrElapsed: number) => {
        if (clip.kind === 'image') {
          syncPlayhead(blockStart + clipTimeOffset + localOrElapsed);
        } else {
          syncPlayhead(localOrElapsed);
        }
      };

      if (clip.kind === 'image' && soloHold > 0.03) {
        await holdImageClip(soloHold, tickPlayhead, () => timelinePlayActiveRef.current);
      } else if (clip.kind !== 'image') {
        await waitAnimationFrames(2);
        const el = await waitForVideoRef(() => previewVideoRef.current);
        if (el && timelinePlayActiveRef.current) {
          await playVideoClipSegment(
            el,
            clip,
            videoMeta[clip.id]?.duration,
            tickPlayhead,
            blockStart,
            () => timelinePlayActiveRef.current,
            fadeOut,
          );
        }
      }

      if (!timelinePlayActiveRef.current || !nextClip || fadeOut <= 0) continue;

      const overlapStart = blockStart + segDur - fadeOut;
      if (playheadSecondsRef.current >= overlapStart + fadeOut - 0.03) {
        setSelectedIndex(i + 1);
        enteringAfterOverlap = true;
        continue;
      }

      previewVideoRef.current?.pause();

      await animateTransitionBlend(
        jointOut.transition,
        fadeOut,
        overlapStart,
        (_progress, playhead) => {
          syncPlayhead(playhead);
        },
        () => timelinePlayActiveRef.current,
      );

      setSelectedIndex(i + 1);
      enteringAfterOverlap = true;
    }

    timelinePlayActiveRef.current = false;
    setPreviewPlaying(false);
  }, [timeline, videoClipDurations, videoMeta, syncPlayhead]);

  useEffect(() => () => stopTimelinePreview(), [stopTimelinePreview]);

  return (
    <div
      className={cn(
        editorShellClass,
        embedded && fillViewport
          ? editorEmbeddedShellClass
          : embedded
            ? 'h-[min(72vh,720px)] rounded-xl border border-border/60 ring-1 ring-white/[0.04]'
            : 'min-h-[calc(100vh-8rem)] flex-1 border-0 rounded-none',
        className,
      )}
    >
      <div className={cn(editorToolbarClass, embedded && 'py-2 px-3 gap-2')}>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {!minimalUi && <span className="editor-chip capitalize">{timeline.platform}</span>}
          <span className="editor-chip tabular-nums">
            {formatEditorTimecode(playheadSeconds)} / {formatEditorTimecode(estimatedDuration)}
          </span>
          {!minimalUi && (
            <span className="editor-chip hidden sm:inline-flex">
              {timeline.clips.length} clip{timeline.clips.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 border-border/70 bg-secondary/30"
            disabled={!canUndo}
            onClick={undoTimeline}
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 border-border/70 bg-secondary/30"
            disabled={!canRedo}
            onClick={redoTimeline}
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs border-border/70 bg-secondary/30"
            onClick={() => void handleSaveDraft()}
            disabled={savingDraft}
          >
            {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Save
          </Button>
          {linkedForPublish && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs border-border/70 bg-secondary/30 hidden sm:inline-flex"
              onClick={() => setExportPostOpen(true)}
              disabled={!timeline.clips.length}
              title="Caption, hashtags, and download for manual posting"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              Post kit
            </Button>
          )}
          {onPublishContent && linkedForPublish && (linkedForPublish.status === 'approved' || linkedForPublish.status === 'scheduled') && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs border-border/70 bg-secondary/30 hidden md:inline-flex"
              onClick={() => void handlePublishToSocial()}
              disabled={!timeline.clips.length || publishingSocial || publishBlockedProcessing}
              title={
                publishBlockedProcessing
                  ? 'Wait for video preprocessing after your last render'
                  : 'Post to connected social account'
              }
            >
              {publishingSocial ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Send className="w-3.5 h-3.5 mr-1.5" />
              )}
              {publishingSocial ? 'Publishing…' : 'Publish'}
            </Button>
          )}
          <Button
            size="sm"
            className="h-9 text-xs font-semibold shadow-md shadow-primary/20"
            onClick={() => {
              if (contentId || linkedForPublish) {
                setExportMode('replace');
                setOpenPostingKitAfterRender(true);
              }
              setExportOpen(true);
            }}
            disabled={!timeline.clips.length || rendering}
          >
            {rendering ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-1.5" />
            )}
            {contentId || linkedForPublish ? 'Finish' : 'Export'}
          </Button>
        </div>
      </div>

      {estimatedDuration > maxPlatformSeconds && (
        <p className="text-xs text-destructive px-4 py-2 bg-destructive/10 border-b border-destructive/20 truncate">
          Timeline ~{Math.ceil(estimatedDuration)}s exceeds {timeline.platform} limit (~{maxPlatformSeconds}s).
        </p>
      )}

      <div className="flex flex-1 min-h-0">
        <VideoEditorSidePanel
          compact={embedded}
          activeTab={sideTab}
          onTabChange={setSideTab}
          timeline={timeline}
          platform={platform}
          onPlatformChange={handlePlatformChange}
          onTimelineChange={commitTimeline}
          selectedIndex={selectedIndex}
          selectedClip={selectedClip}
          videoDuration={selectedClip ? videoMeta[selectedClip.id]?.duration : undefined}
          onUploadClick={() => fileRef.current?.click()}
          onAssetsClick={() => setPickerOpen(true)}
          uploading={uploading}
          estimatedDuration={estimatedDuration}
          onSplit={() => {
            const splitAt = selectedClip?.trimIn ?? 0;
            if (splitAt <= 0) return;
            commitTimeline((t) => splitVideoClipAt(t, selectedIndex, splitAt));
          }}
          onDuplicate={() => commitTimeline((t) => duplicateClipAt(t, selectedIndex))}
          playheadSeconds={playheadSeconds}
          getInsertAtSeconds={getInsertAtSeconds}
          minimalChrome={minimalUi}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0 border-l border-border/40">
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div className={cn(editorMonitorBarClass, minimalUi && 'flex justify-end py-1.5')}>
                {!minimalUi && (
                  <span className={embedded ? editorMonitorTitleClass : editorSectionTitleClass}>Preview</span>
                )}
                {!minimalUi && (
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground px-2 py-0.5 rounded-md bg-secondary/30 border border-border/40">
                    {formatEditorTimecode(playheadSeconds)}
                    <span className="text-muted-foreground/50 mx-1">/</span>
                    {formatEditorTimecode(estimatedDuration)}
                  </span>
                )}
                <Button
                  size={minimalUi ? 'icon' : 'sm'}
                  variant={previewPlaying ? 'secondary' : 'default'}
                  className={cn(
                    minimalUi ? 'h-8 w-8' : 'h-8 text-xs gap-1.5 justify-self-end min-w-[6.5rem]',
                  )}
                  disabled={!timeline.clips.length}
                  title={previewPlaying ? 'Stop' : 'Play'}
                  onClick={() => {
                    if (previewPlaying) stopTimelinePreview();
                    else void runPreview();
                  }}
                >
                  {previewPlaying ? (
                    <Square className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {!minimalUi && (previewPlaying ? 'Stop' : 'Play')}
                </Button>
              </div>
              <div className={cn(editorPreviewStageClass, embedded && 'p-3 sm:p-4 min-h-[min(38vh,360px)]')}>
              <div
                className={cn(
                  editorPreviewFrameClass,
                  previewFrame.matchMode === 'clip' && 'ring-primary/25 shadow-[0_24px_64px_-20px_hsl(var(--primary)/0.25)]',
                )}
                style={{
                  aspectRatio: previewFrame.aspectRatio,
                  maxHeight: '100%',
                  width: previewFrame.maxWidth,
                }}
              >
              <div
                className={cn(
                  'absolute inset-0',
                  activeTransitionBlend ||
                    selectedClip?.kind === 'image' ||
                    (selectedClip && clipPreviewOpacity(selectedClip) < 0.999)
                    ? 'bg-black'
                    : 'editor-checkerboard',
                )}
                aria-hidden
              />
              <div className="absolute inset-0">
                {!selectedClip && (
                  <p className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                    No clip
                  </p>
                )}
                {selectedClip?.kind === 'image' && !activeTransitionBlend && (
                  <div
                    className={cn(clipPreviewWrapperClass(selectedClip), 'absolute inset-0')}
                    style={clipPreviewWrapperStyle(selectedClip)}
                  >
                    <SlideshowFrameImage
                      clip={selectedClip}
                      slideIndex={selectedIndex}
                      timeline={timeline}
                      videoClipDurations={videoClipDurations}
                      kenBurnsProgress01={clipLocalProgress01(
                        timeline,
                        selectedIndex,
                        playheadSeconds,
                        videoClipDurations,
                      )}
                      onImageLoad={(width, height) => {
                        setImageMeta((prev) => ({
                          ...prev,
                          [selectedClip.id]: { width, height },
                        }));
                      }}
                    />
                  </div>
                )}
                {selectedClip?.kind === 'video' && !activeTransitionBlend && (
                  <div
                    className={cn(clipPreviewWrapperClass(selectedClip), 'absolute inset-0 flex flex-col')}
                    style={clipPreviewWrapperStyle(selectedClip)}
                  >
                    <video
                      ref={previewVideoRef}
                      key={selectedClip.id}
                      src={selectedClip.sourceUrl}
                      className="w-full flex-1 min-h-0 object-contain"
                      style={clipPreviewMediaStyle(selectedClip)}
                      controls
                      preload="metadata"
                      onLoadedMetadata={(e) => {
                        const el = e.currentTarget;
                        if (el.videoWidth && el.videoHeight) {
                          setVideoMeta((prev) => {
                            const cur = prev[selectedClip.id];
                            if (cur?.width === el.videoWidth && cur?.height === el.videoHeight) return prev;
                            return {
                              ...prev,
                              [selectedClip.id]: {
                                duration: cur?.duration ?? el.duration,
                                width: el.videoWidth,
                                height: el.videoHeight,
                              },
                            };
                          });
                        }
                        const pending = pendingPreviewVideoTimeRef.current;
                        if (pending != null) {
                          el.currentTime = pending;
                          pendingPreviewVideoTimeRef.current = null;
                          return;
                        }
                        const start = selectedClip.trimIn ?? 0;
                        if (start > 0) el.currentTime = start;
                      }}
                      onTimeUpdate={(e) => {
                        const el = e.currentTarget;
                        const meta = videoMeta[selectedClip.id];
                        const end = selectedClip.trimOut ?? meta?.duration;
                        if (end != null && el.currentTime >= end) el.pause();
                        const clipStart = clipTimelineStartSeconds(
                          timeline,
                          selectedIndex,
                          videoClipDurations,
                        );
                        const trimIn = selectedClip.trimIn ?? 0;
                        const speed = selectedClip.speed && selectedClip.speed > 0 ? selectedClip.speed : 1;
                        const timelineSec = clipStart + (el.currentTime - trimIn) / speed;
                        syncPlayhead(timelineSec);
                      }}
                    />
                    {selectedClip.videoEffect === 'vignette' && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ boxShadow: 'inset 0 0 80px 24px rgba(0,0,0,0.65)' }}
                      />
                    )}
                    {selectedClip.chromaKey?.enabled && (
                      <div className="absolute top-2 left-2 text-[9px] bg-emerald-600/90 text-white px-1.5 py-0.5 rounded">
                        Chroma key (on export)
                      </div>
                    )}
                  </div>
                )}
                {selectedClip && clipActiveEffectLabels(selectedClip).length > 0 && (
                  <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 z-10 pointer-events-none">
                    {clipActiveEffectLabels(selectedClip).map((label) => (
                      <span
                        key={label}
                        className="text-[9px] px-1.5 py-0.5 rounded-md bg-black/75 text-primary border border-primary/30 backdrop-blur-sm"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                {activeTransitionBlend && (
                  <EditorTransitionPreview
                    fromClip={activeTransitionBlend.from}
                    toClip={activeTransitionBlend.to}
                    fromIndex={activeTransitionBlend.fromIndex}
                    toIndex={activeTransitionBlend.toIndex}
                    fromKenBurnsProgress01={activeTransitionBlend.fromKenBurnsProgress01}
                    toKenBurnsProgress01={activeTransitionBlend.toKenBurnsProgress01}
                    transition={activeTransitionBlend.transition}
                    progress={activeTransitionBlend.progress}
                    videoMeta={videoMeta}
                    timeline={timeline}
                    videoClipDurations={videoClipDurations}
                  />
                )}
                <EditorPreviewOverlays timeline={timeline} playheadSeconds={playheadSeconds} />
              </div>
              {!minimalUi && (
                <div className="absolute bottom-2 right-2 z-10 pointer-events-none flex flex-col items-end gap-1">
                  {previewFrame.matchMode === 'clip' && (
                    <span className="rounded-md bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground tabular-nums border border-primary/30 shadow-sm">
                      {previewFrame.previewAspectLabel}
                    </span>
                  )}
                  <span className="rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/90 tabular-nums border border-white/10 backdrop-blur-sm">
                    {previewFrame.exportSizeLabel}
                  </span>
                </div>
              )}
              </div>
              </div>
            </div>

            {selectedClip && (
              <aside
                className={cn(
                  'shrink-0 border-l border-border/60 bg-card/25 overflow-y-auto custom-scrollbar',
                  embedded ? 'w-[min(100%,272px)]' : 'w-[300px]',
                )}
              >
                <div className="sticky top-0 z-10 px-4 py-2.5 border-b border-border/50 bg-card/80 backdrop-blur-md">
                  <p className={cn(editorPanelTitleClass, 'truncate')}>{selectedClip.label || 'Clip'}</p>
                </div>
                <div className="p-4 space-y-4">
                <div className={cn(editorCardClass, editorCardPadding, 'space-y-3')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={editorFieldLabelClass}>Clip order</span>
                    <div className="flex gap-0.5 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={selectedIndex === 0}
                        onClick={() => {
                          commitTimeline((t) => moveClip(t, selectedIndex, selectedIndex - 1));
                          setSelectedIndex((i) => Math.max(0, i - 1));
                        }}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={selectedIndex >= timeline.clips.length - 1}
                        onClick={() => {
                          commitTimeline((t) => moveClip(t, selectedIndex, selectedIndex + 1));
                          setSelectedIndex((i) => Math.min(timeline.clips.length - 1, i + 1));
                        }}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-400"
                        onClick={() => {
                          commitTimeline((t) => removeClipAt(t, selectedIndex));
                          setSelectedIndex((i) => Math.max(0, i - 1));
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {selectedClip.kind === 'image' && (
                    <div className="space-y-1.5">
                      <Label className={editorFieldLabelClass}>Duration (seconds)</Label>
                      <Input
                        className={editorInputClass}
                        type="number"
                        min={0.3}
                        max={120}
                        step={0.1}
                        value={selectedClip.durationSeconds ?? DEFAULT_IMAGE_CLIP_SECONDS}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          commitTimeline((t) =>
                            updateClipAt(t, selectedIndex, {
                              durationSeconds: Number.isFinite(val) ? val : DEFAULT_IMAGE_CLIP_SECONDS,
                            }),
                          );
                        }}
                      />
                    </div>
                  )}
                  {selectedClip.kind === 'video' && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className={editorFieldLabelClass}>
                          Trim start {(selectedClip.trimIn ?? 0).toFixed(1)}s
                        </Label>
                        <Slider
                          min={0}
                          max={videoMeta[selectedClip.id]?.duration ?? 60}
                          step={0.1}
                          value={[selectedClip.trimIn ?? 0]}
                          onValueChange={([v]) =>
                            commitTimeline((t) => updateClipAt(t, selectedIndex, { trimIn: v }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className={editorFieldLabelClass}>
                          Trim end {(selectedClip.trimOut ?? videoMeta[selectedClip.id]?.duration ?? 0).toFixed(1)}s
                        </Label>
                        <Slider
                          min={(selectedClip.trimIn ?? 0) + 0.1}
                          max={videoMeta[selectedClip.id]?.duration ?? 60}
                          step={0.1}
                          value={[selectedClip.trimOut ?? videoMeta[selectedClip.id]?.duration ?? 10]}
                          onValueChange={([v]) =>
                            commitTimeline((t) => updateClipAt(t, selectedIndex, { trimOut: v }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {activeJoint && activeJointIndex != null && (
                  <div className={cn(editorCardClass, editorCardPadding, 'space-y-3')}>
                    <p className={editorFieldLabelClass}>Transition</p>
                    <Select
                      value={activeJoint.transition}
                      onValueChange={(v) =>
                        commitTimeline((t) =>
                          updateJointAt(t, activeJointIndex, {
                            transition: v as TimelineTransition,
                            durationSeconds:
                              v === 'none' ? 0 : t.joints[activeJointIndex]?.durationSeconds || 0.5,
                          }),
                        )
                      }
                    >
                      <SelectTrigger className={editorSelectTriggerClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <TransitionSelectContent compact className="max-h-[min(60vh,320px)]" />
                    </Select>
                    {activeJoint.transition !== 'none' && (
                      <div className="space-y-1">
                        <Label className={editorFieldLabelClass}>
                          Length {activeJoint.durationSeconds.toFixed(2)}s
                        </Label>
                        <Slider
                          min={MIN_JOINT_DURATION}
                          max={MAX_JOINT_DURATION}
                          step={0.05}
                          value={[activeJoint.durationSeconds]}
                          onValueChange={([v]) =>
                            startTransition(() =>
                              commitTimeline((t) =>
                                updateJointAt(t, activeJointIndex, { durationSeconds: v }),
                              ),
                            )
                          }
                        />
                      </div>
                    )}
                    {timeline.joints.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-border/70 w-full"
                        onClick={() => {
                          const patch = {
                            transition: activeJoint.transition,
                            durationSeconds: activeJoint.durationSeconds,
                          };
                          startTransition(() => {
                            commitTimeline((t) => updateAllJoints(t, patch));
                          });
                          toast({
                            title: 'Transitions updated',
                            description: `Applied to ${timeline.joints.length} gap(s). Export to preview blends.`,
                          });
                        }}
                      >
                        Apply to all
                      </Button>
                    )}
                  </div>
                )}

                </div>
              </aside>
            )}
          </div>

          <div className="shrink-0 px-3 py-2.5 border-t border-border/60 bg-[hsl(222_47%_5%)] overflow-x-auto">
            <VideoEditorMultitrack
              compactHeader={minimalUi}
              timeline={timeline}
              totalSeconds={estimatedDuration}
              selectedIndex={selectedIndex}
              onSelectClip={(i) => {
                setSelectedJointIndex(null);
                handleTimelineSeek(clipTimelineStartSeconds(timeline, i, videoClipDurations));
              }}
              selectedJointIndex={selectedJointIndex}
              onSelectJoint={(i) => {
                setSelectedJointIndex(i);
                setSelectedIndex(i);
                const start = clipTimelineStartSeconds(timeline, i, videoClipDurations);
                const clip = timeline.clips[i];
                const full = videoClipDurations[clip?.id ?? ''];
                let seg = 5;
                if (clip?.kind === 'image') {
                  seg = (clip.durationSeconds ?? DEFAULT_IMAGE_CLIP_SECONDS) / (clip.speed ?? 1);
                } else if (full != null && clip) {
                  seg =
                    Math.max(0.1, (clip.trimOut ?? full) - (clip.trimIn ?? 0)) / (clip.speed ?? 1);
                }
                handleTimelineSeek(start + seg * 0.5);
              }}
              videoClipDurations={videoClipDurations}
              playheadSeconds={playheadSeconds}
              onSeek={handleTimelineSeek}
              onMoveTimedItem={handleMoveTimedItem}
            />
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />

      <AssetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleAssetPicked}
        imagesOnly={false}
        title="Assets"
      />

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{contentId || linkedForPublish ? 'Finish' : 'Export'}</DialogTitle>
            <DialogDescription className="sr-only">Render timeline video</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>After render</Label>
              <Select value={exportMode} onValueChange={(v) => setExportMode(v as typeof exportMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(contentId || replaceOptions.length > 0) && (
                    <SelectItem value="replace">Update content</SelectItem>
                  )}
                  <SelectItem value="new_draft">New draft</SelectItem>
                  <SelectItem value="render_only">MP4 only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {exportMode === 'replace' && linkedForPublish && replaceOptions.length <= 1 && (
              <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-secondary/20 px-3 py-2">
                <span className="font-medium text-foreground/90">{linkedForPublish.title}</span>
                {' · '}
                {linkedForPublish.status}
              </p>
            )}
            {exportMode === 'new_draft' && (
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={exportTitle} onChange={(e) => setExportTitle(e.target.value)} placeholder={`Edited video ${new Date().toLocaleDateString()}`} />
              </div>
            )}
            {exportMode === 'replace' && replaceOptions.length > 1 && (
              <div className="space-y-2">
                <Label>Content item</Label>
                <Select value={replaceContentId} onValueChange={setReplaceContentId}>
                  <SelectTrigger><SelectValue placeholder="Select content" /></SelectTrigger>
                  <SelectContent>
                    {replaceOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="truncate">{c.title}</span> ({c.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {exportMode !== 'render_only' && (contentId || linkedForPublish) && (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={openPostingKitAfterRender}
                  onCheckedChange={(v) => setOpenPostingKitAfterRender(v === true)}
                />
                <span className="text-xs">Open post kit</span>
              </label>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setExportOpen(false)} disabled={rendering} className="sm:mr-auto">
              Cancel
            </Button>
            <Button onClick={() => void handleExport()} disabled={rendering || !timeline.clips.length}>
              {rendering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Film className="w-4 h-4 mr-2" />}
              {rendering ? 'Rendering…' : 'Render'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExportPostDialog
        open={exportPostOpen}
        onOpenChange={setExportPostOpen}
        content={linkedForPublish}
        captionOverride={captionOverride}
        platformOverride={platformOverride}
      />
    </div>
  );
}
