import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../lib/env.js';
import { httpError } from '../lib/http.js';
import { logger } from '../lib/logger.js';
import { getServiceClient } from '../lib/supabase.js';
import { withTempDir, probeDurationSeconds, runFfmpeg } from '../lib/video-tools.js';
import { defaultKenBurnsForSlideIndex } from '../lib/editor-timeline.js';

const MEDIA_BUCKET = 'content-media';

const GEMINI_TTS_VOICE_MAP: Record<string, string> = {
  nova: 'Kore',
  alloy: 'Charon',
  echo: 'Fenrir',
  fable: 'Aoede',
  onyx: 'Puck',
  shimmer: 'Leda',
};

function geminiTtsVoiceName(voice: string): string {
  const raw = (voice || 'nova').trim();
  const lower = raw.toLowerCase();
  if (GEMINI_TTS_VOICE_MAP[lower]) return GEMINI_TTS_VOICE_MAP[lower];
  const known = ['Kore', 'Charon', 'Fenrir', 'Aoede', 'Puck', 'Leda'];
  const hit = known.find((v) => v.toLowerCase() === lower);
  return hit || 'Kore';
}

function geminiTtsModelCandidates(): string[] {
  const preferred = env.geminiTtsModel || 'gemini-2.5-flash-preview-tts';
  return [...new Set([preferred, 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'])];
}

async function synthesizeSpeechWithGemini(
  userId: string,
  text: string,
  voice: string,
): Promise<{ audioUrl: string; durationSeconds: number }> {
  if (!env.geminiApiKey) {
    throw httpError(400, 'GEMINI_API_KEY is required for Gemini text-to-speech.');
  }
  const trimmed = text.trim().slice(0, 4096);
  if (!trimmed) throw httpError(400, 'Text is required');

  const voiceName = geminiTtsVoiceName(voice);
  const prompt = `Say the following in a clear, natural voice:\n\n${trimmed}`;

  let lastError = 'Gemini TTS failed';
  let audioBytes: Buffer | null = null;

  for (const model of geminiTtsModelCandidates()) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
            },
          }),
        },
      );
      const data = (await response.json()) as {
        error?: { message?: string };
        candidates?: Array<{
          content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
        }>;
      };
      if (!response.ok) {
        lastError = data.error?.message || `Gemini TTS HTTP ${response.status}`;
        logger.warn('editor-ai', 'Gemini TTS model failed', { model, error: lastError });
        continue;
      }
      const inline = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const b64 = inline?.data;
      if (!b64) {
        lastError = 'Gemini TTS returned no audio data';
        continue;
      }
      audioBytes = Buffer.from(b64, 'base64');
      logger.info('editor-ai', 'Gemini TTS succeeded', { model, voiceName, mime: inline?.mimeType });
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Gemini TTS error';
      logger.warn('editor-ai', 'Gemini TTS attempt failed', { model, error: lastError });
    }
  }

  if (!audioBytes?.length) {
    throw httpError(502, lastError);
  }

  return withTempDir(async (dir) => {
    const wavPath = path.join(dir, 'tts.wav');
    const mp3Path = path.join(dir, 'tts.mp3');
    await writeFile(wavPath, audioBytes!);
    try {
      await runFfmpeg(['-y', '-i', wavPath, '-ac', '2', '-ar', '44100', '-b:a', '192k', mp3Path]);
    } catch {
      await writeFile(mp3Path, audioBytes!);
    }
    const outBytes = await import('node:fs/promises').then((fs) => fs.readFile(mp3Path));
    const durationSeconds = await probeDurationSeconds(mp3Path).catch(() => trimmed.length * 0.06);
    const filePath = `processed/${userId}/tts-gemini-${Date.now()}.mp3`;
    const supabase = getServiceClient();
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(filePath, outBytes, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    if (error) throw httpError(500, error.message);
    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
    if (!data.publicUrl) throw httpError(500, 'Failed to store TTS audio');
    return { audioUrl: data.publicUrl, durationSeconds: durationSeconds || 3 };
  });
}

async function synthesizeSpeechWithOpenAI(
  userId: string,
  text: string,
  voice: string,
): Promise<{ audioUrl: string; durationSeconds: number }> {
  if (!env.openaiApiKey) {
    throw httpError(400, 'OPENAI_API_KEY is required for OpenAI text-to-speech.');
  }
  const trimmed = text.trim();
  if (!trimmed) throw httpError(400, 'Text is required');

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice: voice || 'nova',
      input: trimmed.slice(0, 4096),
      response_format: 'mp3',
    }),
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw httpError(502, err.error?.message || 'TTS failed');
  }
  const bytes = Buffer.from(await response.arrayBuffer());

  return withTempDir(async (dir) => {
    const mp3Path = path.join(dir, 'tts.mp3');
    await writeFile(mp3Path, bytes);
    const durationSeconds = await probeDurationSeconds(mp3Path).catch(() => trimmed.length * 0.06);
    const filePath = `processed/${userId}/tts-${Date.now()}.mp3`;
    const supabase = getServiceClient();
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(filePath, bytes, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    if (error) throw httpError(500, error.message);
    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
    if (!data.publicUrl) throw httpError(500, 'Failed to store TTS audio');
    return { audioUrl: data.publicUrl, durationSeconds: durationSeconds || 3 };
  });
}

export async function synthesizeSpeechToUrl(
  userId: string,
  text: string,
  voice: string,
): Promise<{ audioUrl: string; durationSeconds: number }> {
  const trimmed = text.trim();
  if (!trimmed) throw httpError(400, 'Text is required');

  if (env.geminiApiKey) {
    const result = await synthesizeSpeechWithGemini(userId, trimmed, voice);
    logger.info('editor-ai', 'Synthesized TTS clip (Gemini)', { userId, chars: trimmed.length });
    return result;
  }
  if (env.openaiApiKey) {
    const result = await synthesizeSpeechWithOpenAI(userId, trimmed, voice);
    logger.info('editor-ai', 'Synthesized TTS clip (OpenAI)', { userId, chars: trimmed.length });
    return result;
  }
  throw httpError(
    400,
    'Add GEMINI_API_KEY (recommended) or OPENAI_API_KEY to backend/.env for text-to-speech.',
  );
}

export type AutoAssembleClip = {
  sourceUrl: string;
  kind: 'image' | 'video';
  durationSeconds?: number;
  label?: string;
};

export function autoAssembleTimeline(clips: AutoAssembleClip[]) {
  if (!clips.length) throw httpError(400, 'At least one clip is required');
  const normalized = clips.map((c, i) => ({
    id: `auto-${i}-${Date.now()}`,
    kind: c.kind,
    sourceUrl: c.sourceUrl,
    label: c.label || `Clip ${i + 1}`,
    durationSeconds: c.kind === 'image' ? (c.durationSeconds ?? 3) : undefined,
    trimIn: c.kind === 'video' ? 0 : undefined,
    ...(c.kind === 'image' ? { kenBurns: defaultKenBurnsForSlideIndex(i) } : {}),
  }));
  const joints = [];
  for (let i = 0; i < normalized.length - 1; i += 1) {
    joints.push({ transition: 'fade' as const, durationSeconds: 0.45 });
  }
  return { clips: normalized, joints };
}
