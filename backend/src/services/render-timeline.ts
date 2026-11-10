import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { getServiceClient } from '../lib/supabase.js';
import { httpError } from '../lib/http.js';
import { logger } from '../lib/logger.js';
import {
  blendClipsWithTransitions,
  mixTimelineExtraAudio,
  mixVideoAudioWithMusic,
  prepareTimelineClipFromFile,
  probeVideo,
  replaceVideoAudioWithMusic,
  withTempDir,
} from '../lib/video-tools.js';
import { burnTimelineTextOverlays } from '../lib/timeline-text-overlays.js';
import { burnTimelineStickers } from '../lib/timeline-stickers.js';
import { burnTimelinePipLayers } from '../lib/timeline-pip-layers.js';
import { synthesizeSpeechToUrl } from './editor-ai.js';
import {
  clampMusicVolume,
  isValidBackgroundMusicTrackId,
  resolveBackgroundMusicSourceAsync,
} from '../lib/music-catalog.js';
import { createContent, updateContent } from './app-api.js';
import { preprocessMedia } from './preprocess-media.js';
import { downloadUrlToFile } from '../lib/media-fetch.js';
import { parseEditorTimeline } from '../lib/parse-editor-timeline.js';
import {
  capTransitionDurationForClips,
  clampSeamlessImageBlendSeconds,
  effectiveTimelineJoint,
  resolveImageKenBurns,
  transitionToFfmpeg,
  validateTimelineAgainstClipDurations,
} from '../lib/editor-timeline.js';

const MEDIA_BUCKET = 'content-media';

function extensionFromUrl(url: string, fallback: string) {
  const pathPart = url.split('?')[0] || '';
  const ext = pathPart.split('.').pop()?.toLowerCase();
  if (ext === 'jpeg') return 'jpg';
  if (ext && ['png', 'jpg', 'webp', 'gif', 'mp4', 'mov', 'webm'].includes(ext)) return ext;
  return fallback;
}

async function materializeMusicTrack(trackId: string, destPath: string) {
  const source = await resolveBackgroundMusicSourceAsync(trackId);
  if (source.kind === 'file') {
    await copyFile(source.path, destPath);
    return;
  }
  await downloadUrlToFile(source.url, destPath, 'background music');
}

async function uploadRenderedVideo(bytes: Buffer, userId: string, label: string) {
  const filePath = `processed/${userId}/timeline-${label}-${Date.now()}.mp4`;
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(filePath, bytes, {
    contentType: 'video/mp4',
    upsert: true,
  });
  if (error) throw httpError(500, `Failed to store rendered video: ${error.message}`);
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
  if (!data.publicUrl) throw httpError(500, 'Failed to create public URL for rendered video');
  return data.publicUrl;
}

export type RenderTimelineExportInput = {
  userId: string;
  timeline: unknown;
  exportMode: 'render_only' | 'new_draft' | 'replace';
  title?: string;
  description?: string;
  contentId?: string;
};

export async function renderAndExportTimeline(input: RenderTimelineExportInput) {
  const rendered = await withTempDir(async (dir) => {
    const timeline = parseEditorTimeline(input.timeline);
    const withMusic = Boolean(timeline.backgroundMusicTrackId);
    const hasVideoClip = timeline.clips.some((clip) => clip.kind === 'video');
    const hasVoiceover = Boolean(timeline.voiceoverClips?.length || timeline.ttsClips?.length);
    const format = {
      width: timeline.width,
      height: timeline.height,
      fps: timeline.fps,
      withAudio: withMusic || hasVideoClip || hasVoiceover,
    };

    if (timeline.backgroundMusicTrackId) {
      const valid = await isValidBackgroundMusicTrackId(timeline.backgroundMusicTrackId);
      if (!valid) {
        throw httpError(400, `Unknown background music track: ${timeline.backgroundMusicTrackId}`);
      }
    }

    const prepared: Array<{ path: string; duration: number }> = [];
    const durationList: number[] = [];

    for (const [index, clip] of timeline.clips.entries()) {
      const ext = extensionFromUrl(clip.sourceUrl, clip.kind === 'image' ? 'jpg' : 'mp4');
      const sourcePath = path.join(dir, `source-${index}.${ext}`);
      await downloadUrlToFile(clip.sourceUrl, sourcePath, `clip ${index + 1}`);
      const outPath = path.join(dir, `clip-${index}.mp4`);
      const duration = await prepareTimelineClipFromFile(
        sourcePath,
        outPath,
        {
          kind: clip.kind,
          durationSeconds: clip.durationSeconds,
          trimIn: clip.trimIn,
          trimOut: clip.trimOut,
          speed: clip.speed,
          reverse: clip.reverse,
          flipHorizontal: clip.flipHorizontal,
          rotation: clip.rotation,
          volume: clip.volume,
          filter: clip.filter,
          adjustments: clip.adjustments,
          videoEffect: clip.videoEffect,
          chromaKey: clip.chromaKey,
          kenBurns: (() => {
            const videoDurations = new Map(
              timeline.clips.slice(0, index).map((c, i) => [c.id, durationList[i]] as const),
            );
            const kb = resolveImageKenBurns(clip, index, { timeline, videoDurations });
            return kb ? { enabled: true as const, zoomFrom: kb.zoomFrom, zoomTo: kb.zoomTo } : undefined;
          })(),
          cropZoom: clip.cropZoom,
          opacity: clip.opacity,
          crop: clip.crop,
          fadeInSeconds: clip.fadeInSeconds,
          fadeOutSeconds: clip.fadeOutSeconds,
        },
        format,
      );
      prepared.push({ path: outPath, duration });
      durationList.push(duration);
    }

    validateTimelineAgainstClipDurations(timeline, durationList);

    const seamlessBlend = clampSeamlessImageBlendSeconds(timeline.seamlessImageBlendSeconds);
    const joints = timeline.joints.map((joint, i) => {
      const effective = effectiveTimelineJoint(
        joint,
        timeline.clips[i],
        timeline.clips[i + 1],
        seamlessBlend,
      );
      const ffmpegTransition = transitionToFfmpeg(effective.transition);
      const durationSeconds = capTransitionDurationForClips(
        effective.durationSeconds,
        durationList[i],
        durationList[i + 1],
      );
      return {
        transition: ffmpegTransition ?? 'none',
        durationSeconds,
      };
    });

    logger.info('render-timeline', 'Blending clips with transitions', {
      clipCount: prepared.length,
      joints: joints.map((j, i) => ({
        gap: i + 1,
        transition: j.transition,
        durationSeconds: j.durationSeconds,
      })),
    });

    const composedPath = path.join(dir, 'composed.mp4');
    await blendClipsWithTransitions(prepared, joints, composedPath, format);

    let finalPath = composedPath;
    if (timeline.pipLayers?.length) {
      const withPipPath = path.join(dir, 'with-pip.mp4');
      await burnTimelinePipLayers(finalPath, withPipPath, format, timeline.pipLayers, dir);
      finalPath = withPipPath;
    }
    if (timeline.textOverlays?.length) {
      const withTextPath = path.join(dir, 'with-text.mp4');
      await burnTimelineTextOverlays(finalPath, withTextPath, format, timeline.textOverlays, dir);
      finalPath = withTextPath;
    }
    if (timeline.stickerOverlays?.length) {
      const withStickersPath = path.join(dir, 'with-stickers.mp4');
      await burnTimelineStickers(finalPath, withStickersPath, format, timeline.stickerOverlays, dir);
      finalPath = withStickersPath;
    }

    const extraAudioTracks: Array<{ path: string; startSeconds: number; volume?: number }> = [];
    if (timeline.voiceoverClips?.length) {
      for (const [i, vo] of timeline.voiceoverClips.entries()) {
        const voPath = path.join(dir, `voiceover-${i}.mp3`);
        await downloadUrlToFile(vo.sourceUrl, voPath, 'voiceover');
        extraAudioTracks.push({
          path: voPath,
          startSeconds: vo.startSeconds,
          volume: vo.volume,
        });
      }
    }
    if (timeline.ttsClips?.length) {
      for (const [i, tts] of timeline.ttsClips.entries()) {
        let audioUrl = tts.generatedAudioUrl;
        if (!audioUrl) {
          const synthesized = await synthesizeSpeechToUrl(input.userId, tts.text, tts.voice || 'nova');
          audioUrl = synthesized.audioUrl;
        }
        const ttsPath = path.join(dir, `tts-${i}.mp3`);
        await downloadUrlToFile(audioUrl, ttsPath, 'TTS audio');
        extraAudioTracks.push({ path: ttsPath, startSeconds: tts.startSeconds, volume: 1 });
      }
    }
    if (extraAudioTracks.length) {
      const withVoPath = path.join(dir, 'with-voiceovers.mp4');
      await mixTimelineExtraAudio(finalPath, withVoPath, extraAudioTracks);
      finalPath = withVoPath;
    }

    if (timeline.backgroundMusicTrackId) {
      const musicPath = path.join(dir, 'music.mp3');
      await materializeMusicTrack(timeline.backgroundMusicTrackId, musicPath);
      const withMusicPath = path.join(dir, 'with-music.mp4');
      const musicOpts = { volume: clampMusicVolume(timeline.backgroundMusicVolume ?? 1) };
      const composedProbe = await probeVideo(finalPath);
      const mixOriginal = timeline.mixOriginalAudioWithMusic !== false && composedProbe.hasAudio;
      if (mixOriginal) {
        await mixVideoAudioWithMusic(finalPath, musicPath, withMusicPath, musicOpts);
      } else {
        await replaceVideoAudioWithMusic(finalPath, musicPath, withMusicPath, musicOpts);
      }
      finalPath = withMusicPath;
    }

    const finalProbe = await probeVideo(finalPath);
    const durationSeconds = finalProbe.duration > 0 ? finalProbe.duration : 0;
    const bytes = await readFile(finalPath);
    return { bytes, durationSeconds, timeline };
  });

  const mediaUrl = await uploadRenderedVideo(rendered.bytes, input.userId, 'export');

  logger.info('render-timeline', 'Rendered timeline video', {
    userId: input.userId,
    durationSeconds: rendered.durationSeconds,
    clipCount: rendered.timeline.clips.length,
    exportMode: input.exportMode,
  });

  if (input.exportMode === 'render_only') {
    return {
      success: true,
      mediaUrl,
      durationSeconds: rendered.durationSeconds,
      content: null,
    };
  }

  if (input.exportMode === 'new_draft') {
    const title = (input.title || '').trim() || `Edited video ${new Date().toLocaleDateString()}`;
    const content = await createContent(input.userId, {
      title,
      description: input.description || null,
      platform: rendered.timeline.platform,
      media_url: mediaUrl,
      media_type: 'video',
      editor_timeline: rendered.timeline,
      editor_timeline_updated_at: new Date().toISOString(),
    });
    return {
      success: true,
      mediaUrl,
      durationSeconds: rendered.durationSeconds,
      content,
    };
  }

  if (input.exportMode === 'replace') {
    if (!input.contentId) {
      throw httpError(400, 'contentId is required when replacing existing content media');
    }
    const supabase = getServiceClient();
    const { data: existing, error: readError } = await supabase
      .from('content')
      .select('id, media_url, original_media_url, template_source_url')
      .eq('id', input.contentId)
      .single();
    if (readError || !existing) {
      throw httpError(404, 'Content not found');
    }

    const priorUrl = (existing.media_url as string | null) || null;
    const original =
      (existing.original_media_url as string | null) ||
      (existing.template_source_url as string | null) ||
      priorUrl;

    const content = await updateContent(input.userId, input.contentId, {
      media_url: mediaUrl,
      media_type: 'video',
      enhanced_media_url: mediaUrl,
      original_media_url: original,
      template_frames_applied: false,
      template_source_url: priorUrl || original,
      editor_timeline: rendered.timeline,
      editor_timeline_updated_at: new Date().toISOString(),
      preprocessing_status: 'pending',
    });

    void preprocessMedia({
      mediaUrl,
      contentId: input.contentId,
      mediaType: 'video',
      platform: rendered.timeline.platform,
    }).catch((err) => {
      logger.error('render-timeline', `Background preprocess failed for ${input.contentId}`, err);
    });

    return {
      success: true,
      mediaUrl,
      durationSeconds: rendered.durationSeconds,
      content,
    };
  }

  throw httpError(400, 'Invalid exportMode');
}
