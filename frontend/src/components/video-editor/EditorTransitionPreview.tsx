import { useEffect, useRef } from 'react';
import type { EditorTimeline, TimelineClip, TimelineTransition } from '@/lib/editorTimeline';
import {
  clipPreviewMediaStyle,
  clipPreviewWrapperClass,
  clipPreviewWrapperStyle,
} from '@/lib/editorClipPreview';
import { SlideshowFrameImage } from '@/components/video-editor/SlideshowFrameImage';
import {
  transitionPreviewBackdropStyle,
  transitionPreviewLayerStyle,
} from '@/lib/editorTransitionPreviewStyles';
import { cn } from '@/lib/utils';

type VideoMeta = { duration: number; width: number; height: number };

type Props = {
  fromClip: TimelineClip;
  toClip: TimelineClip;
  fromIndex: number;
  toIndex: number;
  fromKenBurnsProgress01: number;
  toKenBurnsProgress01: number;
  transition: TimelineTransition;
  progress: number;
  videoMeta: Record<string, VideoMeta>;
  className?: string;
  timeline: EditorTimeline;
  videoClipDurations?: Record<string, number>;
};

function ClipLayer({
  clip,
  role,
  transition,
  progress,
  videoMeta,
  slideIndex,
  kenBurnsProgress01,
  timeline,
  videoClipDurations,
}: {
  clip: TimelineClip;
  role: 'from' | 'to';
  transition: TimelineTransition;
  progress: number;
  videoMeta: Record<string, VideoMeta>;
  slideIndex: number;
  kenBurnsProgress01: number;
  timeline: EditorTimeline;
  videoClipDurations?: Record<string, number>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const transitionStyle = transitionPreviewLayerStyle(transition, progress, role);
  const wrapperStyle = clipPreviewWrapperStyle(clip, transitionStyle);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || clip.kind !== 'video') return;
    const meta = videoMeta[clip.id];
    const trimIn = clip.trimIn ?? 0;
    const trimOut = clip.trimOut ?? meta?.duration ?? trimIn + 1;
    const seek = role === 'from' ? Math.max(trimIn, trimOut - 0.08) : trimIn;
    const apply = () => {
      if (el.readyState >= 1) el.currentTime = seek;
    };
    apply();
    el.addEventListener('loadeddata', apply);
    return () => el.removeEventListener('loadeddata', apply);
  }, [clip, role, videoMeta]);

  return (
    <div
      className={cn(
        clipPreviewWrapperClass(clip),
        'absolute inset-0 flex items-center justify-center will-change-transform',
      )}
      style={wrapperStyle}
    >
      {clip.kind === 'image' ? (
        <SlideshowFrameImage
          clip={clip}
          slideIndex={slideIndex}
          timeline={timeline}
          videoClipDurations={videoClipDurations}
          kenBurnsProgress01={kenBurnsProgress01}
        />
      ) : (
        <video
          ref={videoRef}
          src={clip.sourceUrl}
          className="w-full h-full object-cover"
          style={clipPreviewMediaStyle(clip, { kenBurnsProgress01, slideIndex })}
          muted
          playsInline
          preload="metadata"
        />
      )}
    </div>
  );
}

export function EditorTransitionPreview({
  fromClip,
  toClip,
  fromIndex,
  toIndex,
  fromKenBurnsProgress01,
  toKenBurnsProgress01,
  transition,
  progress,
  videoMeta,
  timeline,
  videoClipDurations,
  className,
}: Props) {
  const backdrop = transitionPreviewBackdropStyle(transition, progress);

  return (
    <div className={cn('absolute inset-0 z-30 overflow-hidden', className)}>
      {backdrop && <div className="absolute inset-0 pointer-events-none" style={backdrop} />}
      <ClipLayer
        clip={fromClip}
        role="from"
        transition={transition}
        progress={progress}
        videoMeta={videoMeta}
        slideIndex={fromIndex}
        kenBurnsProgress01={fromKenBurnsProgress01}
        timeline={timeline}
        videoClipDurations={videoClipDurations}
      />
      <ClipLayer
        clip={toClip}
        role="to"
        transition={transition}
        progress={progress}
        videoMeta={videoMeta}
        slideIndex={toIndex}
        kenBurnsProgress01={toKenBurnsProgress01}
        timeline={timeline}
        videoClipDurations={videoClipDurations}
      />
    </div>
  );
}
