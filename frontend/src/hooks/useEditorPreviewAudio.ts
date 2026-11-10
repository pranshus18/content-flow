import { useEffect, useRef, type RefObject } from 'react';
import { invokeBackend } from '@/lib/backend';
import type { EditorTimeline } from '@/lib/editorTimeline';

type Args = {
  timeline: EditorTimeline;
  playheadSeconds: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Total timeline length (seconds) — used to cap / sync background music. */
  estimatedTimelineSeconds: number;
  /**
   * True while the studio timeline preview is running (including image slides where the video element stays paused).
   */
  isTimelinePreviewPlaying: boolean;
};

function absoluteMediaUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  if (url.startsWith('/')) return `${window.location.origin}${url}`;
  return url;
}

/** Play voiceover, TTS, and background music in sync with preview timeline time. */
export function useEditorPreviewAudio({
  timeline,
  playheadSeconds,
  videoRef,
  estimatedTimelineSeconds,
  isTimelinePreviewPlaying,
}: Args) {
  const audioByIdRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const backgroundMusicUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const map = audioByIdRef.current;
    const wanted = new Map<string, string>();

    for (const vo of timeline.voiceoverClips ?? []) {
      wanted.set(`vo:${vo.id}`, vo.sourceUrl);
    }
    for (const tts of timeline.ttsClips ?? []) {
      if (tts.generatedAudioUrl) wanted.set(`tts:${tts.id}`, tts.generatedAudioUrl);
    }

    for (const [key, el] of map.entries()) {
      if (!wanted.has(key)) {
        el.pause();
        map.delete(key);
      }
    }

    for (const [key, url] of wanted.entries()) {
      let el = map.get(key);
      if (!el) {
        el = new Audio(url);
        el.preload = 'auto';
        map.set(key, el);
      } else if (el.src !== url) {
        el.src = url;
      }
    }
  }, [timeline.voiceoverClips, timeline.ttsClips]);

  /** Resolve playable URL for catalog / custom background music (same as export). */
  useEffect(() => {
    const trackId = timeline.backgroundMusicTrackId;
    if (!trackId) {
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.src = '';
      }
      backgroundMusicUrlRef.current = null;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await invokeBackend<{ url: string }>(
          `background-music/preview-url/${encodeURIComponent(trackId)}`,
          undefined,
          { method: 'GET' },
        );
        const raw = data?.url;
        if (cancelled || !raw) return;
        const resolved = absoluteMediaUrl(raw);
        backgroundMusicUrlRef.current = resolved;

        let el = backgroundMusicRef.current;
        if (!el) {
          el = new Audio();
          el.preload = 'auto';
          el.crossOrigin = 'anonymous';
          backgroundMusicRef.current = el;
        }
        if (el.src !== resolved) {
          el.src = resolved;
          el.load();
        }
      } catch {
        if (!cancelled) backgroundMusicUrlRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [timeline.backgroundMusicTrackId]);

  useEffect(() => {
    const video = videoRef.current;
    const map = audioByIdRef.current;
    const globalT = playheadSeconds;
    const videoActivelyPlaying = Boolean(video && !video.paused && !video.ended);
    const isPlaying = isTimelinePreviewPlaying || videoActivelyPlaying;

    const syncClip = (
      key: string,
      startSeconds: number,
      durationSeconds: number,
      volume = 1,
    ) => {
      const el = map.get(key);
      if (!el) return;
      el.volume = Math.max(0, Math.min(1, volume));
      const end = startSeconds + durationSeconds;
      const inRange = globalT >= startSeconds && globalT < end;
      if (isPlaying && inRange) {
        const local = globalT - startSeconds;
        if (Math.abs(el.currentTime - local) > 0.25) el.currentTime = local;
        if (el.paused) void el.play().catch(() => undefined);
      } else {
        if (!el.paused) el.pause();
      }
    };

    for (const vo of timeline.voiceoverClips ?? []) {
      syncClip(`vo:${vo.id}`, vo.startSeconds, vo.durationSeconds, vo.volume ?? 1);
    }
    for (const tts of timeline.ttsClips ?? []) {
      const dur = tts.durationSeconds ?? 4;
      syncClip(`tts:${tts.id}`, tts.startSeconds, dur, 1);
    }

    const musicEl = backgroundMusicRef.current;
    const musicUrl = backgroundMusicUrlRef.current;
    const trackId = timeline.backgroundMusicTrackId;
    if (!trackId || !musicUrl || !musicEl) {
      if (musicEl && !trackId) {
        musicEl.pause();
      }
    } else {
      const vol = Math.max(0, Math.min(1, timeline.backgroundMusicVolume ?? 1));
      musicEl.volume = vol;
      musicEl.loop = true;

      const timelineEnd = Math.max(0.05, estimatedTimelineSeconds);
      const pastEnd = globalT >= timelineEnd - 0.02;

      if (!isPlaying || pastEnd) {
        if (!musicEl.paused) musicEl.pause();
      } else {
        const dur = musicEl.duration;
        if (Number.isFinite(dur) && dur > 0.1) {
          let localT = globalT % dur;
          if (Math.abs(musicEl.currentTime - localT) > 0.35) {
            musicEl.currentTime = localT;
          }
          if (musicEl.paused) void musicEl.play().catch(() => undefined);
        } else {
          void musicEl.play().catch(() => undefined);
        }
      }
    }
  }, [
    playheadSeconds,
    timeline.voiceoverClips,
    timeline.ttsClips,
    timeline.backgroundMusicTrackId,
    timeline.backgroundMusicVolume,
    videoRef,
    estimatedTimelineSeconds,
    isTimelinePreviewPlaying,
  ]);

  useEffect(
    () => () => {
      for (const el of audioByIdRef.current.values()) {
        el.pause();
      }
      audioByIdRef.current.clear();
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.src = '';
      }
      backgroundMusicRef.current = null;
      backgroundMusicUrlRef.current = null;
    },
    [],
  );
}
