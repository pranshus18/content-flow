import type { EditorTimeline } from '@/lib/editorTimeline';
import {
  textOverlayPreviewStyle,
  textOverlayVisibleAt,
} from '@/lib/editorTextOverlayPreview';
import { cn } from '@/lib/utils';

type Props = {
  timeline: EditorTimeline;
  playheadSeconds: number;
  className?: string;
};

function textPositionClass(position?: string) {
  switch (position) {
    case 'top':
      return 'top-[10%]';
    case 'center':
      return 'top-1/2 -translate-y-1/2';
    default:
      return 'bottom-[12%]';
  }
}

export function EditorPreviewOverlays({ timeline, playheadSeconds, className }: Props) {
  const texts = (timeline.textOverlays ?? []).filter((o) =>
    textOverlayVisibleAt(o, playheadSeconds),
  );
  const stickers = (timeline.stickerOverlays ?? []).filter(
    (s) =>
      playheadSeconds >= s.startSeconds &&
      playheadSeconds < s.startSeconds + s.durationSeconds,
  );

  if (!texts.length && !stickers.length) return null;

  return (
    <div className={cn('absolute inset-0 pointer-events-none z-20', className)}>
      {texts.map((o) => (
        <div
          key={o.id}
          className={cn(
            'absolute left-1/2 -translate-x-1/2 text-center max-w-[92%] font-semibold leading-snug',
            textPositionClass(o.position),
          )}
          style={textOverlayPreviewStyle(o)}
        >
          {o.text}
        </div>
      ))}
      {stickers.map((s) => (
        <span
          key={s.id}
          className="absolute leading-none select-none"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            transform: `translate(-50%, -50%) scale(${(s.scale ?? 1) * 0.9}) rotate(${s.rotation ?? 0}deg)`,
            opacity: s.opacity ?? 1,
            fontSize: '2.25rem',
          }}
        >
          {s.emoji}
        </span>
      ))}
    </div>
  );
}
