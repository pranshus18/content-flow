import type { CSSProperties } from 'react';
import {
  kenBurnsZoomAtProgress,
  resolveImageKenBurns,
  type EditorTimeline,
  type ResolveImageKenBurnsContext,
  type TimelineClip,
} from '@/lib/editorTimeline';
import { clipPreviewMediaStyle, clipPreviewWrapperStyle } from '@/lib/editorClipPreview';
import { cn } from '@/lib/utils';

type Props = {
  clip: TimelineClip;
  slideIndex: number;
  kenBurnsProgress01?: number;
  timeline?: EditorTimeline;
  videoClipDurations?: Record<string, number>;
  className?: string;
  mediaClassName?: string;
  onImageLoad?: (naturalWidth: number, naturalHeight: number) => void;
};

/** Matches export: blurred cover fill + sharp contain — same frame for every aspect ratio. */
export function SlideshowFrameImage({
  clip,
  slideIndex,
  kenBurnsProgress01,
  timeline,
  videoClipDurations,
  className,
  mediaClassName,
  onImageLoad,
}: Props) {
  const kenBurnsContext: ResolveImageKenBurnsContext | undefined = timeline
    ? { timeline, videoDurations: videoClipDurations }
    : undefined;
  const foregroundStyle: CSSProperties = clipPreviewMediaStyle(clip);
  const kb =
    kenBurnsProgress01 != null ? resolveImageKenBurns(clip, slideIndex, kenBurnsContext) : undefined;
  const rootStyle: CSSProperties = {
    ...(kb && kenBurnsProgress01 != null
      ? {
          transform: `scale(${kenBurnsZoomAtProgress(kb, kenBurnsProgress01)})`,
          transformOrigin: 'center center',
        }
      : {}),
  };

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)} style={rootStyle}>
      <img
        src={clip.sourceUrl}
        alt=""
        aria-hidden
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl brightness-[0.85] saturate-[1.08] pointer-events-none select-none"
      />
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center z-[1]',
          clipPreviewWrapperStyle(clip),
        )}
      >
        <img
          src={clip.sourceUrl}
          alt=""
          decoding="async"
          className={cn('max-w-full max-h-full w-full h-full object-contain', mediaClassName)}
          style={foregroundStyle}
          onLoad={(e) => {
            const el = e.currentTarget;
            if (el.naturalWidth && el.naturalHeight) {
              onImageLoad?.(el.naturalWidth, el.naturalHeight);
            }
          }}
        />
      </div>
    </div>
  );
}
