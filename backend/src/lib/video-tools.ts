import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import sharp from 'sharp';
import { logger } from './logger.js';

const GEMINI_MAX_SOURCE_SECONDS = 9.5;
export const VIDEO_ENHANCE_MAX_SECONDS = 30;

function bin(tool: 'ffmpeg' | 'ffprobe'): string {
  if (tool === 'ffmpeg') {
    if (!ffmpegPath) throw new Error('ffmpeg-static is missing. Run npm install in backend/.');
    return ffmpegPath;
  }
  const probePath = typeof ffprobeStatic === 'string' ? ffprobeStatic : ffprobeStatic?.path;
  if (!probePath) throw new Error('ffprobe-static is missing. Run npm install in backend/.');
  return probePath;
}

function run(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout || stderr);
        return;
      }
      reject(new Error(`${path.basename(command)} failed (${code}): ${stderr.slice(-800)}`));
    });
  });
}

export function runFfmpeg(args: string[]): Promise<void> {
  return run(bin('ffmpeg'), args).then(() => undefined);
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'content-flow-video-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function probeDurationSeconds(filePath: string): Promise<number> {
  const output = await run(bin('ffprobe'), [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const duration = Number.parseFloat(output.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Could not read video duration');
  }
  return duration;
}

export async function cutVideo(inputPath: string, outputPath: string, start: number, duration: number) {
  await run(bin('ffmpeg'), [
    '-y',
    '-ss', start.toFixed(3),
    '-i', inputPath,
    '-t', duration.toFixed(3),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '16',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

export async function muxOriginalAudio(videoPath: string, audioSourcePath: string, outputPath: string) {
  await run(bin('ffmpeg'), [
    '-y',
    '-i',
    videoPath,
    '-i',
    audioSourcePath,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-ar',
    '44100',
    '-ac',
    '2',
    '-b:a',
    '192k',
    '-shortest',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

export async function concatVideos(chunkPaths: string[], outputPath: string, withAudio = true) {
  const listPath = `${outputPath}.txt`;
  const list = chunkPaths.map((chunk) => `file '${chunk.replace(/'/g, "'\\''")}'`).join('\n');
  await writeFile(listPath, list, 'utf8');
  const args = [
    '-y',
    '-fflags', '+genpts',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
  ];
  if (withAudio) args.push('-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '192k');
  else args.push('-an');
  args.push('-movflags', '+faststart', outputPath);
  await run(bin('ffmpeg'), args);
}

export function chunkRanges(duration: number, maxEnhanceSeconds = VIDEO_ENHANCE_MAX_SECONDS) {
  const enhanceDuration = Math.min(duration, maxEnhanceSeconds);
  const ranges: Array<{ start: number; duration: number }> = [];
  let start = 0;
  while (start < enhanceDuration - 0.05) {
    const remaining = enhanceDuration - start;
    const length = Math.min(GEMINI_MAX_SOURCE_SECONDS, remaining);
    ranges.push({ start, duration: length });
    start += length;
  }
  return { ranges, remainderStart: enhanceDuration < duration ? enhanceDuration : null, duration };
}

export function chunkEntireVideo(duration: number, maxClipSeconds = GEMINI_MAX_SOURCE_SECONDS) {
  const ranges: Array<{ start: number; duration: number }> = [];
  let start = 0;
  const total = Math.max(0, duration);
  while (start < total - 0.05) {
    const length = Math.min(maxClipSeconds, total - start);
    ranges.push({ start, duration: length });
    start += length;
  }
  if (ranges.length === 0 && total > 0) {
    ranges.push({ start: 0, duration: total });
  }
  return ranges;
}

export type VideoProbe = {
  width: number;
  height: number;
  fps: number;
  duration: number;
  hasAudio: boolean;
};

function parseFrameRate(value?: string) {
  if (!value) return 30;
  if (value.includes('/')) {
    const [num, den] = value.split('/').map(Number);
    if (num > 0 && den > 0) return Math.min(60, Math.max(24, Math.round(num / den)));
  }
  const fps = Number.parseFloat(value);
  return Number.isFinite(fps) && fps > 0 ? Math.min(60, Math.max(24, Math.round(fps))) : 30;
}

function streamRotation(video: Record<string, unknown>) {
  const tags = (video.tags || {}) as Record<string, unknown>;
  const sides = (video.side_data_list || []) as Array<Record<string, unknown>>;
  const fromSide = Number(sides.find((item) => item.rotation != null)?.rotation);
  const fromTag = Number(tags.rotate);
  const value = Number.isFinite(fromSide) ? fromSide : fromTag;
  return Number.isFinite(value) ? value : 0;
}

function evenProbeSize(value: number) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

export async function probeVideo(filePath: string): Promise<VideoProbe> {
  const output = await run(bin('ffprobe'), [
    '-v', 'error',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    filePath,
  ]);
  const parsed = JSON.parse(output) as {
    streams?: Array<Record<string, unknown>>;
    format?: { duration?: string };
  };
  const streams = parsed.streams || [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  const codedWidth = Number(video?.width);
  const codedHeight = Number(video?.height);
  const duration = Number.parseFloat(String(parsed.format?.duration || '0'));
  if (!video || !Number.isFinite(codedWidth) || !Number.isFinite(codedHeight) || codedWidth <= 0 || codedHeight <= 0) {
    throw new Error('Could not read video dimensions');
  }
  const turned = Math.abs(streamRotation(video)) % 180 === 90;
  const width = turned ? codedHeight : codedWidth;
  const height = turned ? codedWidth : codedHeight;
  return {
    width: evenProbeSize(width),
    height: evenProbeSize(height),
    fps: parseFrameRate(typeof video.r_frame_rate === 'string' ? video.r_frame_rate : undefined),
    duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
    hasAudio: Boolean(audio),
  };
}

async function fileHasBytes(filePath: string) {
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size > 32;
  } catch {
    return false;
  }
}

async function tryExtractFrame(args: string[], outputPath: string) {
  try {
    await run(bin('ffmpeg'), args);
    return fileHasBytes(outputPath);
  } catch {
    return false;
  }
}

function pngFrameArgs(inputPath: string, outputPath: string, extra: string[]) {
  return ['-y', ...extra, '-i', inputPath, '-frames:v', '1', '-an', '-c:v', 'png', '-update', '1', outputPath];
}

export async function extractVideoFrame(inputPath: string, outputPath: string, atSeconds: number) {
  const time = Math.max(0, atSeconds);
  const attempts = [
    pngFrameArgs(inputPath, outputPath, ['-ss', time.toFixed(3)]),
    pngFrameArgs(inputPath, outputPath, []),
    ['-y', '-i', inputPath, '-ss', time.toFixed(3), '-frames:v', '1', '-an', '-c:v', 'png', '-update', '1', outputPath],
  ];
  for (const args of attempts) {
    if (await tryExtractFrame(args, outputPath)) return;
  }
  throw new Error(`Could not extract a frame from ${path.basename(inputPath)}`);
}

async function frameFingerprint(imagePath: string): Promise<Uint8Array> {
  const { data } = await sharp(imagePath)
    .resize(64, 36, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

function fingerprintDiff(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let sum = 0;
  for (let i = 0; i < len; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum / (len * 255);
}

async function frameDetailScore(imagePath: string): Promise<number> {
  const stats = await sharp(imagePath).stats();
  const channel = stats.channels[0];
  return channel?.stdev ?? 0;
}

/** Stable slide boundaries (includes 0 and duration). Crossfades become a cut midpoint. */
export async function detectSlideshowSegmentBoundaries(
  inputPath: string,
  options?: { sampleStepSeconds?: number; transitionDiffThreshold?: number },
): Promise<number[]> {
  const probe = await probeVideo(inputPath);
  const duration = Math.max(0, probe.duration);
  if (duration <= 0.35) return [0, duration];

  const step = options?.sampleStepSeconds ?? 0.15;
  const threshold = options?.transitionDiffThreshold ?? 0.032;

  return withTempDir(async (dir) => {
    const samples: Array<{ t: number; fp: Uint8Array }> = [];
    for (let t = 0; t <= duration + 0.001; t += step) {
      const at = Math.min(Math.max(0, t), Math.max(0, duration - 0.04));
      const framePath = path.join(dir, `sample-${Math.round(at * 1000)}.png`);
      await extractVideoFrame(inputPath, framePath, at);
      const fp = await frameFingerprint(framePath);
      samples.push({ t: at, fp });
    }

    if (samples.length < 2) return [0, duration];

    const transitionMidpoints: number[] = [];
    let inRun = false;
    let runStart = 0;
    for (let i = 1; i < samples.length; i += 1) {
      const diff = fingerprintDiff(samples[i - 1].fp, samples[i].fp);
      const isTransition = diff > threshold;
      if (isTransition && !inRun) {
        inRun = true;
        runStart = samples[i - 1].t;
      } else if (!isTransition && inRun) {
        inRun = false;
        transitionMidpoints.push((runStart + samples[i].t) / 2);
      }
    }
    if (inRun) {
      transitionMidpoints.push((runStart + duration) / 2);
    }

    const boundaries = [0, ...transitionMidpoints, duration].sort((a, b) => a - b);
    const merged: number[] = [];
    for (const t of boundaries) {
      const clamped = Math.min(duration, Math.max(0, t));
      if (!merged.length || clamped - merged[merged.length - 1] > 0.35) {
        merged.push(clamped);
      }
    }
    if (merged[merged.length - 1] < duration - 0.02) merged.push(duration);
    else merged[merged.length - 1] = duration;
    return merged;
  });
}

export function isMultiSegmentSlideshow(boundaries: number[], duration: number): boolean {
  if (duration <= 0 || duration > 180 || boundaries.length < 3) return false;
  let longSegments = 0;
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    if (boundaries[i + 1] - boundaries[i] >= 0.65) longSegments += 1;
  }
  return longSegments >= 2 && boundaries.length - 1 <= 16;
}

/** Pick the most detailed frame inside [startSeconds, endSeconds). */
export async function extractSharpestFrameInRange(
  inputPath: string,
  outputPath: string,
  startSeconds: number,
  endSeconds: number,
) {
  const start = Math.max(0, startSeconds);
  const end = Math.max(start + 0.05, endSeconds);
  const span = end - start;
  const candidates = [
    start + span * 0.2,
    start + span * 0.5,
    start + span * 0.8,
  ];
  return withTempDir(async (dir) => {
    let bestPath = '';
    let bestScore = -1;
    for (const [index, at] of candidates.entries()) {
      const framePath = path.join(dir, `cand-${index}.png`);
      await extractVideoFrame(inputPath, framePath, at);
      const score = await frameDetailScore(framePath);
      if (score > bestScore) {
        bestScore = score;
        bestPath = framePath;
      }
    }
    if (!bestPath) throw new Error('Could not pick a frame in range');
    await copyFile(bestPath, outputPath);
  });
}

export async function extractLastVideoFrame(inputPath: string, outputPath: string) {
  const probe = await probeVideo(inputPath);
  const nearEnd = Math.max(0, (probe.duration || 0) - 0.25);
  const attempts = [
    pngFrameArgs(inputPath, outputPath, ['-sseof', '-0.2']),
    pngFrameArgs(inputPath, outputPath, ['-sseof', '-0.6']),
    ['-y', '-i', inputPath, '-ss', nearEnd.toFixed(3), '-frames:v', '1', '-an', '-c:v', 'png', '-update', '1', outputPath],
    pngFrameArgs(inputPath, outputPath, ['-ss', '0']),
  ];
  for (const args of attempts) {
    if (await tryExtractFrame(args, outputPath)) return;
  }
  throw new Error(`Could not extract the last frame from ${path.basename(inputPath)}`);
}

export async function stillToVideo(
  imagePath: string,
  outputPath: string,
  options: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    withSilentAudio: boolean;
    kenBurns?: boolean;
    fadeIn?: number;
    fadeOut?: number;
  },
) {
  const fadeIn = Math.max(0, options.fadeIn ?? 0);
  const fadeOut = Math.max(0, options.fadeOut ?? 0);
  const fadeOutStart = Math.max(0, options.duration - fadeOut);
  const vf = [
    `scale=${options.width}:${options.height}:flags=lanczos`,
    `fps=${options.fps}`,
    fadeIn > 0 ? `fade=t=in:st=0:d=${fadeIn.toFixed(3)}` : '',
    fadeOut > 0 ? `fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut.toFixed(3)}` : '',
    'setsar=1',
    'format=yuv420p',
  ].filter(Boolean).join(',');

  const args = [
    '-y',
    '-loop', '1',
    '-framerate', String(options.fps),
    '-t', options.duration.toFixed(3),
    '-i', imagePath,
  ];
  if (options.withSilentAudio) {
    args.push(
      '-f', 'lavfi',
      '-t', options.duration.toFixed(3),
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    );
  }
  args.push(
    '-vf', vf,
    '-r', String(options.fps),
    '-t', options.duration.toFixed(3),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
  );
  if (options.withSilentAudio) {
    args.push('-c:a', 'aac', '-ar', '44100', '-ac', '2', '-t', options.duration.toFixed(3));
  } else {
    args.push('-an');
  }
  args.push('-movflags', '+faststart', outputPath);
  await run(bin('ffmpeg'), args);
}

function fillFrameFilter(width: number, height: number, fps: number) {
  return `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height},fps=${fps},setsar=1,format=yuv420p`;
}

/** Blurred fill + sharp centered photo — consistent frame across mixed aspect ratios. */
function slideshowImageFrameFilter(
  width: number,
  height: number,
  fps: number,
  kenBurns?: { zoomFrom: number; zoomTo: number; frames: number },
): string {
  const w = width;
  const h = height;
  const bgChain = `[bgsrc]scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},gblur=sigma=20:steps=2[bg]`;
  const fgChain = `[fgsrc]scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos[fg]`;
  const stack = `[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1[stack]`;

  if (kenBurns) {
    const zf = kenBurns.zoomFrom;
    const zt = kenBurns.zoomTo;
    const frames = kenBurns.frames;
    return `[0:v]split=2[bgsrc][fgsrc];${bgChain};${fgChain};${stack};[stack]zoompan=z='${zf}+(${zt}-${zf})*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${w}x${h}:fps=${fps},format=yuv420p`;
  }

  return `[0:v]split=2[bgsrc][fgsrc];${bgChain};${fgChain};${stack};[stack]fps=${fps},setsar=1,format=yuv420p`;
}

function simpleImageFrameFilter(
  width: number,
  height: number,
  fps: number,
  kenBurns?: { zoomFrom: number; zoomTo: number; frames: number },
): string {
  const w = width;
  const h = height;
  const base = fillFrameFilter(w, h, fps);
  if (!kenBurns) return base;
  const zf = kenBurns.zoomFrom;
  const zt = kenBurns.zoomTo;
  const frames = kenBurns.frames;
  const cover = `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}`;
  return `${cover},zoompan=z='${zf}+(${zt}-${zf})*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${w}x${h}:fps=${fps},format=yuv420p`;
}

function encodeArgs(options: { fps: number; withAudio: boolean }) {
  const args = [
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-r', String(options.fps),
  ];
  if (options.withAudio) args.push('-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '192k');
  else args.push('-an');
  args.push('-movflags', '+faststart');
  return args;
}

export async function concatExact(
  clips: Array<{ path: string; duration: number }>,
  outputPath: string,
  options: { width: number; height: number; fps: number; withAudio: boolean },
) {
  if (clips.length === 0) {
    throw new Error('No clips to concat');
  }

  const prepared: string[] = [];
  for (const [index, clip] of clips.entries()) {
    const exactPath = `${clip.path.replace(/\.mp4$/i, '')}-exact-${index}.mp4`;
    const vf = fillFrameFilter(options.width, options.height, options.fps);
    const args = [
      '-y',
      '-i',
      clip.path,
      '-vf',
      vf,
      '-r',
      String(options.fps),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
    ];
    if (options.withAudio) {
      args.push('-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '192k');
    } else {
      args.push('-an');
    }
    args.push('-movflags', '+faststart', exactPath);
    await run(bin('ffmpeg'), args);
    prepared.push(exactPath);
  }

  if (prepared.length === 1) {
    await run(bin('ffmpeg'), [
      '-y',
      '-i',
      prepared[0],
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
    return;
  }

  await concatVideos(prepared, outputPath, options.withAudio);
}

function continuityFade(durations: number[]) {
  const shortest = Math.min(...durations.filter((value) => value > 0));
  if (!Number.isFinite(shortest) || shortest <= 0) return 0.4;
  return Math.min(0.4, Math.max(0.28, shortest * 0.08));
}

function layerOpacityValue(opacity: number | undefined): number | undefined {
  if (opacity == null || !Number.isFinite(opacity) || opacity >= 0.999) return undefined;
  return Math.min(1, Math.max(0.05, opacity));
}

async function matchClipFormat(
  inputPath: string,
  outputPath: string,
  options: { width: number; height: number; fps: number; withAudio: boolean },
  layerOpacity?: number,
) {
  const op = layerOpacityValue(layerOpacity);
  const { width, height, fps } = options;
  const args = ['-y', '-i', inputPath, '-r', String(fps), '-vsync', 'cfr'];

  if (op != null) {
    const scalePad = `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0,fps=${fps},setsar=1,format=rgba,colorchannelmixer=aa=${op.toFixed(4)}`;
    const graph = `[0:v]${scalePad}[fg];color=c=black:s=${width}x${height}:r=${fps}[bg];[bg][fg]overlay=0:0:shortest=1:format=auto,format=yuv420p[vout]`;
    args.push('-filter_complex', graph, '-map', '[vout]');
  } else {
    args.push('-vf', fillFrameFilter(width, height, fps));
  }

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
  );
  if (options.withAudio) {
    args.push('-map', '0:a?', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '192k');
  } else {
    args.push('-an');
  }
  args.push('-movflags', '+faststart', outputPath);
  await run(bin('ffmpeg'), args);
  return probeVideo(outputPath);
}

export async function blendContinuity(
  clips: Array<{ path: string; duration?: number }>,
  outputPath: string,
  options: { width: number; height: number; fps: number; withAudio: boolean },
) {
  if (clips.length === 0) throw new Error('No clips to blend');
  if (clips.length === 1) {
    await matchClipFormat(clips[0].path, outputPath, options);
    return;
  }

  const prepared: Array<{ path: string; duration: number }> = [];
  for (const [index, clip] of clips.entries()) {
    const livePath = `${clip.path.replace(/\.mp4$/i, '')}-live-${index}.mp4`;
    const probed = await matchClipFormat(clip.path, livePath, options);
    prepared.push({
      path: livePath,
      duration: probed.duration > 0.05 ? probed.duration : clip.duration || 1,
    });
  }

  const fade = Math.min(
    0.65,
    continuityFade(prepared.map((clip) => clip.duration)),
    ...prepared.map((clip) => Math.max(0.35, clip.duration * 0.2)),
  );
  const args = ['-y'];
  for (const file of prepared) args.push('-i', file.path);

  const videoChain: string[] = [];
  const joinFades: number[] = [];
  let lastVideo = '0:v';
  let timeline = prepared[0].duration;
  prepared.slice(1).forEach((clip, index) => {
    const safeFade = Math.min(fade, Math.max(0.2, timeline * 0.3), Math.max(0.2, clip.duration * 0.3));
    const offset = Math.max(0.05, timeline - safeFade - 0.12);
    const next = index === prepared.length - 2 ? 'vout' : `vx${index}`;
    joinFades.push(safeFade);
    videoChain.push(
      `[${lastVideo}][${index + 1}:v]xfade=transition=fade:duration=${safeFade.toFixed(3)}:offset=${offset.toFixed(3)}[${next}]`,
    );
    lastVideo = next;
    timeline += clip.duration - safeFade;
  });

  if (options.withAudio) {
    const audioChain: string[] = [];
    let lastAudio = '0:a';
    prepared.slice(1).forEach((_clip, index) => {
      const next = index === prepared.length - 2 ? 'aout' : `ax${index}`;
      audioChain.push(`[${lastAudio}][${index + 1}:a]acrossfade=d=${joinFades[index].toFixed(3)}:c1=tri:c2=tri[${next}]`);
      lastAudio = next;
    });
    args.push('-filter_complex', [...videoChain, ...audioChain].join(';'), '-map', '[vout]', '-map', '[aout]');
  } else {
    args.push('-filter_complex', videoChain.join(';'), '-map', '[vout]');
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-r', String(options.fps),
  );
  if (options.withAudio) args.push('-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '192k');
  else args.push('-an');
  args.push('-movflags', '+faststart', outputPath);
  await run(bin('ffmpeg'), args);
}

async function encodeFilledClip(
  inputPath: string,
  outputPath: string,
  options: { width: number; height: number; fps: number; withAudio: boolean; duration?: number; extraVf?: string },
) {
  const vf = options.extraVf
    ? `${options.extraVf},${fillFrameFilter(options.width, options.height, options.fps)}`
    : fillFrameFilter(options.width, options.height, options.fps);
  const args = ['-y', '-i', inputPath];
  if (options.duration && options.duration > 0) args.push('-t', options.duration.toFixed(3));
  args.push('-vf', vf, ...encodeArgs({ fps: options.fps, withAudio: options.withAudio }), outputPath);
  await run(bin('ffmpeg'), args);
}

async function muxSilentAudio(videoPath: string, outputPath: string, duration: number) {
  await run(bin('ffmpeg'), [
    '-y',
    '-i', videoPath,
    '-f', 'lavfi',
    '-t', Math.max(0.2, duration).toFixed(3),
    '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-ar', '44100',
    '-ac', '2',
    '-b:a', '192k',
    '-t',
    Math.max(0.2, duration).toFixed(3),
    '-movflags', '+faststart',
    outputPath,
  ]);
}

async function fadeClipAudio(
  inputPath: string,
  outputPath: string,
  options: { fadeIn: number; fadeOut: number; fps: number },
) {
  const probe = await probeVideo(inputPath);
  const filters: string[] = [];
  if (options.fadeIn > 0) filters.push(`afade=t=in:st=0:d=${options.fadeIn.toFixed(3)}`);
  if (options.fadeOut > 0 && probe.duration > options.fadeOut + 0.05) {
    filters.push(`afade=t=out:st=${Math.max(0, probe.duration - options.fadeOut).toFixed(3)}:d=${options.fadeOut.toFixed(3)}`);
  }
  const args = ['-y', '-i', inputPath, '-c:v', 'copy'];
  if (probe.hasAudio && filters.length > 0) {
    args.push('-af', filters.join(','), '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '192k');
  } else if (probe.hasAudio) {
    args.push('-c:a', 'copy');
  } else {
    args.push('-an');
  }
  args.push('-movflags', '+faststart', outputPath);
  await run(bin('ffmpeg'), args);
}

async function fadeGraphicOverEnd(
  videoPath: string,
  imagePath: string,
  outputPath: string,
  options: {
    width: number;
    height: number;
    fps: number;
    withAudio: boolean;
    start: number;
    fadeIn: number;
  },
) {
  const probe = await probeVideo(videoPath);
  const duration = probe.duration > 0.05 ? probe.duration : 1;
  const overlay = [
    `scale=${options.width}:${options.height}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${options.width}:${options.height}`,
    `fps=${options.fps}`,
    'format=rgba',
    `fade=t=in:st=${Math.max(0, options.start).toFixed(3)}:d=${Math.max(0.12, options.fadeIn).toFixed(3)}:alpha=1`,
  ].join(',');
  const args = [
    '-y',
    '-i',
    videoPath,
    '-loop',
    '1',
    '-t',
    duration.toFixed(3),
    '-framerate',
    String(options.fps),
    '-i',
    imagePath,
    '-filter_complex',
    `[0:v]${fillFrameFilter(options.width, options.height, options.fps)}[base];[1:v]${overlay}[card];[base][card]overlay=0:0:shortest=1,format=yuv420p[vout]`,
    '-map',
    '[vout]',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(options.fps),
  ];
  if (options.withAudio && probe.hasAudio) {
    args.push('-map', '0:a', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '192k');
  } else {
    args.push('-an');
  }
  args.push('-movflags', '+faststart', outputPath);
  await run(bin('ffmpeg'), args);
}

async function overlayFullFrame(
  videoPath: string,
  imagePath: string,
  outputPath: string,
  options: {
    width: number;
    height: number;
    fps: number;
    opacity: number;
    fadeIn: number;
    fadeOut: number;
    start?: number;
    withAudio: boolean;
  },
) {
  const probe = await probeVideo(videoPath);
  const duration = probe.duration > 0.05 ? probe.duration : 1;
  const start = Math.max(0, options.start ?? 0);
  const fadeOutStart = Math.max(start, duration - Math.max(0, options.fadeOut));
  const overlayFilters = [
    `scale=${options.width}:${options.height}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${options.width}:${options.height}`,
    'format=rgba',
    `colorchannelmixer=aa=${Math.max(0.15, Math.min(1, options.opacity)).toFixed(3)}`,
  ];
  if (options.fadeIn > 0) overlayFilters.push(`fade=t=in:st=${start.toFixed(3)}:d=${options.fadeIn.toFixed(3)}:alpha=1`);
  if (options.fadeOut > 0) overlayFilters.push(`fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${options.fadeOut.toFixed(3)}:alpha=1`);
  const enable = start > 0.02 ? `:enable='gte(t\\,${start.toFixed(3)})'` : '';
  const args = [
    '-y',
    '-i',
    videoPath,
    '-loop',
    '1',
    '-i',
    imagePath,
    '-filter_complex',
    `[0:v]${fillFrameFilter(options.width, options.height, options.fps)}[base];[1:v]${overlayFilters.join(',')}[card];[base][card]overlay=0:0:shortest=1:format=auto${enable},format=yuv420p[vout]`,
    '-map',
    '[vout]',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '16',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(options.fps),
  ];
  if (options.withAudio && probe.hasAudio) {
    args.push('-map', '0:a', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '192k');
  } else {
    args.push('-an');
  }
  args.push('-movflags', '+faststart', outputPath);
  await run(bin('ffmpeg'), args);
}

async function continueLastShot(
  framePath: string,
  outputPath: string,
  options: { duration: number; width: number; height: number; fps: number },
) {
  const frames = Math.max(1, Math.round(options.duration * options.fps));
  const zoom = `zoompan=z='min(1.0+0.00028*on,1.045)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${options.width}x${options.height}:fps=${options.fps}`;
  await run(bin('ffmpeg'), [
    '-y',
    '-loop',
    '1',
    '-framerate',
    String(options.fps),
    '-t',
    options.duration.toFixed(3),
    '-i',
    framePath,
    '-vf',
    `scale=${evenDimension(options.width * 2)}:${evenDimension(options.height * 2)}:flags=lanczos,${zoom},setsar=1,format=yuv420p`,
    '-frames:v',
    String(frames),
    '-t',
    options.duration.toFixed(3),
    ...encodeArgs({ fps: options.fps, withAudio: false }),
    outputPath,
  ]);
}

async function clipFromStill(
  imagePath: string,
  outputPath: string,
  options: { duration: number; width: number; height: number; fps: number; withAudio: boolean; fadeIn?: number },
) {
  const rawPath = `${outputPath.replace(/\.mp4$/i, '')}-motion.mp4`;
  await stillToVideo(imagePath, rawPath, {
    duration: options.duration,
    width: options.width,
    height: options.height,
    fps: options.fps,
    withSilentAudio: false,
    kenBurns: false,
    fadeIn: options.fadeIn ?? 0,
    fadeOut: 0,
  });
  if (options.withAudio) {
    await muxSilentAudio(rawPath, outputPath, options.duration);
    return;
  }
  await run(bin('ffmpeg'), ['-y', '-i', rawPath, '-c', 'copy', '-movflags', '+faststart', outputPath]);
}

export async function wrapNativeIntroOutro(
  sourcePath: string,
  outputPath: string,
  options: {
    width: number;
    height: number;
    fps: number;
    withAudio: boolean;
    introImagePath?: string | null;
    outroImagePath?: string | null;
    introDuration: number;
    outroDuration: number;
  },
) {
  const dir = path.dirname(outputPath);
  const source = await probeVideo(sourcePath);
  const clips: Array<{ path: string; duration: number }> = [];
  const hasIntro = Boolean(options.introImagePath) && options.introDuration >= 0.4;
  const hasOutro = Boolean(options.outroImagePath) && options.outroDuration >= 0.4;

  try {
    if (hasIntro && options.introImagePath) {
      const introFinal = path.join(dir, 'intro-final.mp4');
      await clipFromStill(options.introImagePath, introFinal, {
        duration: options.introDuration,
        width: options.width,
        height: options.height,
        fps: options.fps,
        withAudio: options.withAudio,
        fadeIn: 0,
      });
      const introProbe = await probeVideo(introFinal);
      clips.push({ path: introFinal, duration: introProbe.duration > 0.4 ? introProbe.duration : options.introDuration });
    }

    let middlePath = sourcePath;
    const sourceDuration = (await probeVideo(middlePath)).duration || source.duration || 1;
    if (options.withAudio) {
      const middleProbe = await probeVideo(middlePath);
      if (!middleProbe.hasAudio) {
        const silentMiddle = path.join(dir, 'middle-silent.mp4');
        await muxSilentAudio(middlePath, silentMiddle, middleProbe.duration || sourceDuration);
        middlePath = silentMiddle;
      }
      const middleFaded = path.join(dir, 'middle-audio.mp4');
      await fadeClipAudio(middlePath, middleFaded, {
        fadeIn: hasIntro ? 0.15 : 0,
        fadeOut: hasOutro ? 0.2 : 0,
        fps: options.fps,
      });
      middlePath = middleFaded;
    }
    const middleDuration = (await probeVideo(middlePath)).duration || sourceDuration;
    clips.push({ path: middlePath, duration: middleDuration });

    if (hasOutro && options.outroImagePath) {
      const outroFinal = path.join(dir, 'outro-final.mp4');
      await clipFromStill(options.outroImagePath, outroFinal, {
        duration: options.outroDuration,
        width: options.width,
        height: options.height,
        fps: options.fps,
        withAudio: options.withAudio,
        fadeIn: 0,
      });
      const outroProbe = await probeVideo(outroFinal);
      if (outroProbe.duration < options.outroDuration * 0.7) {
        throw new Error(`Outro clip is only ${outroProbe.duration.toFixed(2)}s, expected ${options.outroDuration}s`);
      }
      clips.push({ path: outroFinal, duration: outroProbe.duration > 0.4 ? outroProbe.duration : options.outroDuration });
    }

    if (clips.length === 1) {
      await run(bin('ffmpeg'), ['-y', '-i', clips[0].path, '-c', 'copy', '-movflags', '+faststart', outputPath]);
      return;
    }

    const addedBudget =
      (hasIntro ? Math.max(0.4, options.introDuration * 0.45) : 0)
      + (hasOutro ? Math.max(0.4, options.outroDuration * 0.45) : 0);

    // Prefer soft blend for a native feel; if it short-changes duration, hard-concat so Apply never fails.
    let usedBlend = false;
    try {
      await blendContinuity(clips, outputPath, {
        width: options.width,
        height: options.height,
        fps: options.fps,
        withAudio: options.withAudio,
      });
      usedBlend = true;
      const blended = await probeVideo(outputPath);
      if (blended.duration + 0.05 < middleDuration + addedBudget) {
        throw new Error(
          `Soft blend too short (${blended.duration.toFixed(1)}s < ${(middleDuration + addedBudget).toFixed(1)}s)`,
        );
      }
    } catch (blendError) {
      const detail = blendError instanceof Error ? blendError.message : String(blendError);
      console.warn(`[video-tools] Soft blend unavailable (${detail}); using exact concat so intro/outro still apply`);
      await concatExact(clips, outputPath, {
        width: options.width,
        height: options.height,
        fps: options.fps,
        withAudio: options.withAudio,
      });
      usedBlend = false;
    }

    const framed = await probeVideo(outputPath);
    // Prove intro/outro added time vs the middle clip alone — do not use brittle hard-concat math after xfade.
    const minLanded = middleDuration + addedBudget - (usedBlend ? 0.35 : 0.15);
    if ((hasIntro || hasOutro) && framed.duration + 0.05 < minLanded) {
      throw new Error(
        `Intro/outro did not land in the video (got ${framed.duration.toFixed(1)}s, middle was ${middleDuration.toFixed(1)}s)`,
      );
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Intro/outro wrap failed: ${detail}`);
  }
}

export async function transcodeForConcat(
  inputPath: string,
  outputPath: string,
  options: { width: number; height: number; fps: number; withAudio: boolean },
) {
  await transcodeWithOverlays(inputPath, outputPath, options, []);
}

export type FfmpegOverlay = {
  path: string;
  x: number;
  y: number;
  enable?: string;
  /** 0–1 overlay layer opacity */
  opacity?: number;
};

export async function transcodeWithOverlays(
  inputPath: string,
  outputPath: string,
  options: { width: number; height: number; fps: number; withAudio: boolean },
  overlays: FfmpegOverlay[],
) {
  const args = ['-y', '-i', inputPath];
  for (const overlay of overlays) {
    args.push('-i', overlay.path);
  }

  const scale = fillFrameFilter(options.width, options.height, options.fps);

  if (overlays.length === 0) {
    args.push('-vf', scale, '-r', String(options.fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p');
  } else {
    const filters = [`[0:v]${scale}[base]`];
    let last = 'base';
    overlays.forEach((overlay, index) => {
      const src = `ov${index}`;
      const next = index === overlays.length - 1 ? 'vpre' : `v${index}`;
      const enable = overlay.enable ? `:enable='${overlay.enable.replace(/,/g, '\\,')}'` : '';
      const op = overlay.opacity != null && overlay.opacity < 0.999
        ? `,colorchannelmixer=aa=${Math.max(0.05, Math.min(1, overlay.opacity)).toFixed(3)}`
        : '';
      filters.push(`[${index + 1}:v]format=rgba${op}[${src}]`);
      filters.push(`[${last}][${src}]overlay=${Math.round(overlay.x)}:${Math.round(overlay.y)}:eof_action=repeat${enable}[${next}]`);
      last = next;
    });
    filters.push('[vpre]format=yuv420p[vout]');
    args.push(
      '-filter_complex',
      filters.join(';'),
      '-map',
      '[vout]',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(options.fps),
    );
    if (options.withAudio) args.push('-map', '0:a');
  }

  if (options.withAudio) {
    args.push('-c:a', 'aac', '-ar', '44100', '-ac', '2');
  } else {
    args.push('-an');
  }
  args.push('-movflags', '+faststart', outputPath);
  await run(bin('ffmpeg'), args);
}

function evenDimension(value: number) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export async function enhanceVideoQuality(inputPath: string, outputPath: string) {
  const probe = await probeVideo(inputPath);
  const filters: string[] = [];
  if (probe.height < 1080) {
    const scale = 1080 / probe.height;
    filters.push(`scale=${evenDimension(probe.width * scale)}:${evenDimension(1080)}:flags=lanczos`);
  }
  filters.push(
    'hqdn3d=1.2:1.2:4:4',
    'unsharp=5:5:1.2:5:5:0.25',
    'eq=contrast=1.08:saturation=1.08:brightness=0.012',
    'format=yuv420p',
  );
  const args = [
    '-y',
    '-i',
    inputPath,
    '-vf',
    filters.join(','),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '16',
    '-pix_fmt',
    'yuv420p',
  ];
  if (probe.hasAudio) {
    args.push('-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '192k');
  } else {
    args.push('-an');
  }
  args.push('-movflags', '+faststart', outputPath);
  await run(bin('ffmpeg'), args);
}

export type TimelineFormatOptions = {
  width: number;
  height: number;
  fps: number;
  withAudio: boolean;
};

export type PreparedTimelineClip = {
  path: string;
  duration: number;
};

type ClipEffectsInput = {
  kind: 'image' | 'video';
  speed?: number;
  reverse?: boolean;
  flipHorizontal?: boolean;
  rotation?: 0 | 90 | 180 | 270;
  volume?: number;
  filter?: string;
  adjustments?: { brightness?: number; contrast?: number; saturation?: number };
  videoEffect?: string;
  chromaKey?: { enabled: boolean; color?: string; similarity?: number; blend?: number };
  cropZoom?: number;
  opacity?: number;
  crop?: { x: number; y: number; w: number; h: number };
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  clipDuration?: number;
  frame?: { width: number; height: number };
};

function filterPresetChain(preset: string | undefined): string | null {
  switch (preset) {
    case 'vivid':
      return 'eq=saturation=1.35:contrast=1.08';
    case 'warm':
      return 'colorbalance=rs=0.12:gs=0.05:bs=-0.1';
    case 'cool':
      return 'colorbalance=rs=-0.08:gs=0.02:bs=0.12';
    case 'vintage':
      return 'eq=contrast=1.08:brightness=0.04:saturation=0.72';
    case 'bw':
      return 'hue=s=0';
    default:
      return null;
  }
}

function adjustmentEq(adjustments: ClipEffectsInput['adjustments']): string | null {
  if (!adjustments) return null;
  const parts: string[] = [];
  if (adjustments.brightness) parts.push(`brightness=${(adjustments.brightness / 200).toFixed(3)}`);
  if (adjustments.contrast) parts.push(`contrast=${(1 + adjustments.contrast / 100).toFixed(3)}`);
  if (adjustments.saturation) parts.push(`saturation=${(1 + adjustments.saturation / 100).toFixed(3)}`);
  return parts.length ? `eq=${parts.join(':')}` : null;
}

function buildAudioTempoChain(speed: number): string {
  const filters: string[] = [];
  let remaining = speed;
  while (remaining > 2.0001) {
    filters.push('atempo=2.0');
    remaining /= 2;
  }
  while (remaining < 0.5001) {
    filters.push('atempo=0.5');
    remaining *= 2;
  }
  if (Math.abs(remaining - 1) > 0.001) {
    filters.push(`atempo=${remaining.toFixed(4)}`);
  }
  return filters.join(',');
}

function clipNeedsTransform(clip: ClipEffectsInput): boolean {
  const speed = clip.speed && clip.speed !== 1 ? clip.speed : 1;
  if (speed !== 1 && clip.kind === 'video') return true;
  if (clip.reverse) return true;
  if (clip.flipHorizontal) return true;
  if (clip.rotation) return true;
  if (clip.filter && clip.filter !== 'none') return true;
  if (clip.adjustments && adjustmentEq(clip.adjustments)) return true;
  if (clip.kind === 'video' && clip.volume != null && clip.volume !== 1) return true;
  if (clip.videoEffect) return true;
  if (clip.chromaKey?.enabled) return true;
  if (clip.cropZoom && clip.cropZoom > 1.001) return true;
  if (clip.opacity != null && clip.opacity < 0.999) return true;
  if (clip.crop) return true;
  if (clip.fadeInSeconds && clip.fadeInSeconds > 0.05) return true;
  if (clip.fadeOutSeconds && clip.fadeOutSeconds > 0.05) return true;
  return false;
}

function videoEffectChain(effect: string | undefined): string | null {
  switch (effect) {
    case 'blur':
      return 'gblur=sigma=4';
    case 'vignette':
      return 'vignette=angle=PI/4';
    case 'sharpen':
      return 'unsharp=5:5:1.0:5:5:0.0';
    case 'grain':
      return 'noise=alls=10:allf=t+u';
    default:
      return null;
  }
}

function buildClipVideoFilters(clip: ClipEffectsInput): string[] {
  const filters: string[] = [];
  if (clip.crop) {
    const { x, y, w, h } = clip.crop;
    filters.push(`crop=iw*${w.toFixed(4)}:ih*${h.toFixed(4)}:iw*${x.toFixed(4)}:ih*${y.toFixed(4)}`);
  }
  if (clip.flipHorizontal) filters.push('hflip');
  if (clip.rotation === 90) filters.push('transpose=1');
  else if (clip.rotation === 180) filters.push('hflip,vflip');
  else if (clip.rotation === 270) filters.push('transpose=2');
  const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
  if (clip.kind === 'video' && speed !== 1) {
    filters.push(`setpts=${(1 / speed).toFixed(5)}*PTS`);
  }
  if (clip.reverse) filters.push('reverse');
  const eq = adjustmentEq(clip.adjustments);
  if (eq) filters.push(eq);
  const preset = filterPresetChain(clip.filter);
  if (preset) filters.push(preset);
  const fx = videoEffectChain(clip.videoEffect);
  if (fx) filters.push(fx);
  if (clip.chromaKey?.enabled) {
    const hex = (clip.chromaKey.color || '00ff00').replace(/^#/, '');
    const sim = clip.chromaKey.similarity ?? 0.15;
    const blend = clip.chromaKey.blend ?? 0.08;
    filters.push(`colorkey=0x${hex}:${sim.toFixed(3)}:${blend.toFixed(3)}`);
  }
  if (clip.cropZoom && clip.cropZoom > 1.001 && clip.frame) {
    const { width, height } = clip.frame;
    const z = clip.cropZoom.toFixed(4);
    filters.push(
      `scale=ceil(iw*${z}/2)*2:ceil(ih*${z}/2)*2,crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2`,
    );
  }
  const dur = clip.clipDuration ?? 0;
  if (dur > 0 && clip.fadeInSeconds && clip.fadeInSeconds > 0.05) {
    const d = Math.min(clip.fadeInSeconds, dur / 2).toFixed(3);
    filters.push(`fade=t=in:st=0:d=${d}`);
  }
  if (dur > 0 && clip.fadeOutSeconds && clip.fadeOutSeconds > 0.05) {
    const d = Math.min(clip.fadeOutSeconds, dur / 2).toFixed(3);
    const st = Math.max(0, dur - Number(d)).toFixed(3);
    filters.push(`fade=t=out:st=${st}:d=${d}`);
  }
  return filters;
}

async function applyClipTransformations(
  inputPath: string,
  outputPath: string,
  clip: ClipEffectsInput,
  options: { withAudio: boolean },
): Promise<number> {
  const videoFilters = buildClipVideoFilters(clip);
  const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
  const audioFilters: string[] = [];
  if (options.withAudio && clip.kind === 'video') {
    if (clip.reverse) audioFilters.push('areverse');
    if (speed !== 1) {
      const tempo = buildAudioTempoChain(speed);
      if (tempo) audioFilters.push(tempo);
    }
    if (clip.volume != null && clip.volume !== 1) {
      audioFilters.push(`volume=${Math.min(1, Math.max(0, clip.volume)).toFixed(3)}`);
    }
  }

  if (videoFilters.length === 0 && audioFilters.length === 0) {
    await run(bin('ffmpeg'), ['-y', '-i', inputPath, '-c', 'copy', '-movflags', '+faststart', outputPath]);
    const probed = await probeVideo(outputPath);
    return probed.duration;
  }

  const args = ['-y', '-i', inputPath];
  if (videoFilters.length && audioFilters.length) {
    args.push(
      '-filter_complex',
      `[0:v]${videoFilters.join(',')}[vout];[0:a]${audioFilters.join(',')}[aout]`,
      '-map',
      '[vout]',
      '-map',
      '[aout]',
    );
  } else if (videoFilters.length) {
    args.push('-vf', videoFilters.join(','));
    if (options.withAudio) {
      args.push('-map', '0:v:0', '-map', '0:a?');
    }
  } else {
    args.push('-af', audioFilters.join(','), '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy');
  }

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
  );
  if (options.withAudio) {
    args.push('-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '192k');
  } else {
    args.push('-an');
  }
  args.push('-movflags', '+faststart', outputPath);
  await run(bin('ffmpeg'), args);
  const probed = await probeVideo(outputPath);
  return probed.duration > 0 ? probed.duration : 0;
}

async function encodeImageTimelineClip(
  imagePath: string,
  outputPath: string,
  options: TimelineFormatOptions & {
    duration: number;
    kenBurns?: { zoomFrom?: number; zoomTo?: number };
  },
) {
  const rawPath = `${outputPath.replace(/\.mp4$/i, '')}-raw.mp4`;
  const frames = Math.max(2, Math.round(options.duration * options.fps));
  const w = options.width;
  const h = options.height;
  const kenBurns = options.kenBurns
    ? {
        zoomFrom: options.kenBurns.zoomFrom ?? 1,
        zoomTo: options.kenBurns.zoomTo ?? 1.08,
        frames,
      }
    : undefined;
  const encodeTail = [
    '-r',
    String(options.fps),
    '-t',
    options.duration.toFixed(3),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-an',
    '-movflags',
    '+faststart',
    rawPath,
  ];
  const inputHead = [
    '-y',
    '-loop',
    '1',
    '-framerate',
    String(options.fps),
    '-t',
    options.duration.toFixed(3),
    '-i',
    imagePath,
  ];

  try {
    const filterComplex = slideshowImageFrameFilter(w, h, options.fps, kenBurns);
    await run(bin('ffmpeg'), [
      ...inputHead,
      '-filter_complex',
      `${filterComplex}[vout]`,
      '-map',
      '[vout]',
      ...encodeTail,
    ]);
  } catch (slideshowError: unknown) {
    logger.warn('video-tools', 'Slideshow frame filter failed; using simple cover/zoom', slideshowError);
    const vf = simpleImageFrameFilter(w, h, options.fps, kenBurns);
    await run(bin('ffmpeg'), [...inputHead, '-vf', vf, ...encodeTail]);
  }
  if (options.withAudio) {
    await muxSilentAudio(rawPath, outputPath, options.duration);
  } else {
    await run(bin('ffmpeg'), ['-y', '-i', rawPath, '-c', 'copy', '-movflags', '+faststart', outputPath]);
  }
  const probed = await probeVideo(outputPath);
  return probed.duration > 0 ? probed.duration : options.duration;
}

export async function prepareTimelineClipFromFile(
  inputPath: string,
  outputPath: string,
  clip: {
    kind: 'image' | 'video';
    durationSeconds?: number;
    trimIn?: number;
    trimOut?: number;
    speed?: number;
    reverse?: boolean;
    flipHorizontal?: boolean;
    rotation?: 0 | 90 | 180 | 270;
    volume?: number;
    filter?: string;
    adjustments?: { brightness?: number; contrast?: number; saturation?: number };
    videoEffect?: string;
    chromaKey?: { enabled: boolean; color?: string; similarity?: number; blend?: number };
    kenBurns?: { enabled: boolean; zoomFrom?: number; zoomTo?: number };
    cropZoom?: number;
    opacity?: number;
    crop?: { x: number; y: number; w: number; h: number };
    fadeInSeconds?: number;
    fadeOutSeconds?: number;
  },
  format: TimelineFormatOptions,
): Promise<number> {
  const base = path.dirname(outputPath);
  const stem = outputPath.replace(/\.mp4$/i, '');
  const buildEffects = (clipDuration: number): ClipEffectsInput => ({
    kind: clip.kind,
    speed: clip.speed,
    reverse: clip.reverse,
    flipHorizontal: clip.flipHorizontal,
    rotation: clip.rotation,
    volume: clip.volume,
    filter: clip.filter,
    adjustments: clip.adjustments,
    videoEffect: clip.videoEffect,
    chromaKey: clip.chromaKey,
    cropZoom: clip.cropZoom,
    opacity: clip.opacity,
    crop: clip.crop,
    fadeInSeconds: clip.fadeInSeconds,
    fadeOutSeconds: clip.fadeOutSeconds,
    clipDuration,
    frame: { width: format.width, height: format.height },
  });

  if (clip.kind === 'image') {
    const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
    let duration = clip.durationSeconds && clip.durationSeconds > 0 ? clip.durationSeconds : 3;
    duration = duration / speed;
    const rawPath = `${stem}-raw.mp4`;
    const kenBurns =
      clip.kenBurns && clip.kenBurns.enabled !== false
        ? { zoomFrom: clip.kenBurns.zoomFrom, zoomTo: clip.kenBurns.zoomTo }
        : undefined;
    await encodeImageTimelineClip(inputPath, rawPath, { ...format, duration, kenBurns });
    let workingPath = rawPath;
    const effectsInput = buildEffects(duration);
    if (clipNeedsTransform(effectsInput)) {
      const fxPath = `${stem}-fx.mp4`;
      await applyClipTransformations(rawPath, fxPath, effectsInput, { withAudio: format.withAudio });
      workingPath = fxPath;
    }
    await matchClipFormat(workingPath, outputPath, format, clip.opacity);
    const matched = await probeVideo(outputPath);
    return matched.duration > 0.05 ? matched.duration : duration;
  }

  const probe = await probeVideo(inputPath);
  const trimIn = Math.max(0, clip.trimIn ?? 0);
  const trimOut = clip.trimOut != null && clip.trimOut > trimIn ? clip.trimOut : probe.duration;
  const segmentDuration = Math.max(0.1, trimOut - trimIn);
  const trimmedPath = path.join(base, `${path.basename(stem)}-trim.mp4`);
  await cutVideo(inputPath, trimmedPath, trimIn, segmentDuration);
  let workingPath = trimmedPath;
  const effectsInput = buildEffects(segmentDuration);
  if (clipNeedsTransform(effectsInput)) {
    const fxPath = path.join(base, `${path.basename(stem)}-fx.mp4`);
    await applyClipTransformations(trimmedPath, fxPath, effectsInput, { withAudio: format.withAudio });
    workingPath = fxPath;
  }
  await matchClipFormat(workingPath, outputPath, format, clip.opacity);
  const matched = await probeVideo(outputPath);
  return matched.duration > 0.05 ? matched.duration : segmentDuration;
}

export async function mixTimelineExtraAudio(
  videoPath: string,
  outputPath: string,
  tracks: Array<{ path: string; startSeconds: number; volume?: number }>,
) {
  if (!tracks.length) {
    await run(bin('ffmpeg'), ['-y', '-i', videoPath, '-c', 'copy', '-movflags', '+faststart', outputPath]);
    return;
  }
  const probe = await probeVideo(videoPath);
  const duration = probe.duration;
  const args = ['-y', '-i', videoPath];
  for (const track of tracks) {
    args.push('-i', track.path);
  }
  const filters: string[] = [];
  const mixInputs: string[] = [];
  if (probe.hasAudio) {
    filters.push('[0:a]volume=1[a0]');
    mixInputs.push('[a0]');
  }
  tracks.forEach((track, index) => {
    const vol = track.volume != null ? Math.min(1, Math.max(0, track.volume)) : 1;
    const delayMs = Math.max(0, Math.round(track.startSeconds * 1000));
    filters.push(
      `[${index + 1}:a]atrim=0:${duration.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs},volume=${vol.toFixed(3)}[a${index + 1}]`,
    );
    mixInputs.push(`[a${index + 1}]`);
  });
  if (mixInputs.length === 0) {
    await run(bin('ffmpeg'), ['-y', '-i', videoPath, '-c', 'copy', '-movflags', '+faststart', outputPath]);
    return;
  }
  filters.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=2[aout]`);
  args.push('-filter_complex', filters.join(';'), '-map', '0:v:0', '-map', '[aout]');
  args.push(
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-ar',
    '44100',
    '-ac',
    '2',
    '-b:a',
    '192k',
    '-t',
    duration.toFixed(3),
    '-movflags',
    '+faststart',
    outputPath,
  );
  await run(bin('ffmpeg'), args);
}

async function normalizeClipForBlend(
  clip: PreparedTimelineClip,
  outputPath: string,
  format: TimelineFormatOptions,
  workDir: string,
  index: number,
): Promise<PreparedTimelineClip> {
  let inputPath = clip.path;
  const initialProbe = await probeVideo(inputPath);
  const targetDuration =
    initialProbe.duration > 0.05 ? initialProbe.duration : clip.duration;

  if (format.withAudio && !initialProbe.hasAudio) {
    const silentPath = path.join(workDir, `blend-silent-${index}.mp4`);
    await muxSilentAudio(inputPath, silentPath, targetDuration || 3);
    inputPath = silentPath;
  }

  const probed = await matchClipFormat(inputPath, outputPath, format);
  const duration = probed.duration > 0.05 ? probed.duration : clip.duration;
  return { path: outputPath, duration: Math.max(0.12, duration) };
}

async function xfadeTwoPreparedClips(
  left: PreparedTimelineClip,
  right: PreparedTimelineClip,
  outputPath: string,
  options: TimelineFormatOptions & { transition: string; fadeSeconds: number },
) {
  const workDir = path.dirname(outputPath);
  const leftNorm = await normalizeClipForBlend(
    left,
    path.join(workDir, `xfade-left-${path.basename(outputPath)}`),
    options,
    workDir,
    0,
  );
  const rightNorm = await normalizeClipForBlend(
    right,
    path.join(workDir, `xfade-right-${path.basename(outputPath)}`),
    options,
    workDir,
    1,
  );

  const fade = Math.min(
    options.fadeSeconds,
    Math.max(0.12, leftNorm.duration * 0.48),
    Math.max(0.12, rightNorm.duration * 0.48),
  );
  const offset = Math.max(0.01, leftNorm.duration - fade);
  const transitionName = options.transition || 'fade';
  const filter = `[0:v][1:v]xfade=transition=${transitionName}:duration=${fade.toFixed(3)}:offset=${offset.toFixed(3)}[vout]`;
  const args = ['-y', '-i', leftNorm.path, '-i', rightNorm.path];
  const leftProbe = await probeVideo(leftNorm.path);
  const rightProbe = await probeVideo(rightNorm.path);
  const canCrossfadeAudio = options.withAudio && leftProbe.hasAudio && rightProbe.hasAudio;
  if (canCrossfadeAudio) {
    const audioFilter = `[0:a][1:a]acrossfade=d=${fade.toFixed(3)}:c1=tri:c2=tri[aout]`;
    args.push('-filter_complex', `${filter};${audioFilter}`, '-map', '[vout]', '-map', '[aout]');
  } else {
    args.push('-filter_complex', filter, '-map', '[vout]');
    if (options.withAudio && leftProbe.hasAudio) {
      args.push('-map', '0:a?');
    } else if (options.withAudio && rightProbe.hasAudio) {
      args.push('-map', '1:a?');
    }
  }
  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(options.fps),
  );
  if (options.withAudio && (canCrossfadeAudio || leftProbe.hasAudio || rightProbe.hasAudio)) {
    args.push('-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '192k');
  } else {
    args.push('-an');
  }
  args.push('-movflags', '+faststart', outputPath);
  await run(bin('ffmpeg'), args);
  const probed = await probeVideo(outputPath);
  return probed.duration > 0 ? probed.duration : leftNorm.duration + rightNorm.duration - fade;
}

/** One filter_complex xfade chain — reliable for image slideshows (same canvas/fps). */
async function xfadeChainAllClips(
  clips: PreparedTimelineClip[],
  joints: Array<{ transition: string; durationSeconds: number }>,
  outputPath: string,
  format: TimelineFormatOptions,
): Promise<number> {
  const args = ['-y'];
  for (const clip of clips) args.push('-i', clip.path);

  const videoFilters: string[] = [];
  const fadeDurations: number[] = [];
  let lastV = '0:v';
  let timelineSec = clips[0].duration;

  for (let i = 1; i < clips.length; i += 1) {
    const joint = joints[i - 1] || { transition: 'none', durationSeconds: 0 };
    const fade = Math.min(
      joint.durationSeconds,
      Math.max(0.12, timelineSec * 0.48),
      Math.max(0.12, clips[i].duration * 0.48),
    );
    fadeDurations.push(fade);
    const offset = Math.max(0.01, timelineSec - fade);
    const tr =
      joint.transition && joint.transition !== 'none' && joint.transition !== ''
        ? joint.transition
        : 'fade';
    const outV = i === clips.length - 1 ? 'vout' : `vxf${i}`;
    videoFilters.push(
      `[${lastV}][${i}:v]xfade=transition=${tr}:duration=${fade.toFixed(3)}:offset=${offset.toFixed(3)}[${outV}]`,
    );
    lastV = outV;
    timelineSec += clips[i].duration - fade;
  }

  const probes = await Promise.all(clips.map((c) => probeVideo(c.path)));
  const canCrossfadeAudio = format.withAudio && probes.every((p) => p.hasAudio);

  if (canCrossfadeAudio) {
    const audioFilters: string[] = [];
    let lastA = '0:a';
    for (let i = 1; i < clips.length; i += 1) {
      const fade = fadeDurations[i - 1] ?? 0.5;
      const outA = i === clips.length - 1 ? 'aout' : `axf${i}`;
      audioFilters.push(
        `[${lastA}][${i}:a]acrossfade=d=${fade.toFixed(3)}:c1=tri:c2=tri[${outA}]`,
      );
      lastA = outA;
    }
    args.push(
      '-filter_complex',
      `${videoFilters.join(';')};${audioFilters.join(';')}`,
      '-map',
      '[vout]',
      '-map',
      '[aout]',
    );
  } else {
    args.push('-filter_complex', videoFilters.join(';'), '-map', '[vout]');
  }

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(format.fps),
  );
  if (canCrossfadeAudio) {
    args.push('-c:a', 'aac', '-ar', '44100', '-ac', '2', '-b:a', '192k');
  } else {
    args.push('-an');
  }
  args.push('-movflags', '+faststart', outputPath);
  await run(bin('ffmpeg'), args);
  const finalProbe = await probeVideo(outputPath);
  return finalProbe.duration > 0 ? finalProbe.duration : timelineSec;
}

function jointUsesTransition(joint: { transition: string; durationSeconds: number }) {
  return joint.transition !== 'none' && joint.transition !== '' && joint.durationSeconds > 0;
}

export async function blendClipsWithTransitions(
  prepared: PreparedTimelineClip[],
  joints: Array<{ transition: string; durationSeconds: number }>,
  outputPath: string,
  format: TimelineFormatOptions,
): Promise<number> {
  if (prepared.length === 0) throw new Error('No clips to blend');
  if (prepared.length === 1) {
    await run(bin('ffmpeg'), ['-y', '-i', prepared[0].path, '-c', 'copy', '-movflags', '+faststart', outputPath]);
    return prepared[0].duration;
  }

  const dir = path.dirname(outputPath);
  const normalized: PreparedTimelineClip[] = [];
  for (let i = 0; i < prepared.length; i += 1) {
    normalized.push(
      await normalizeClipForBlend(
        prepared[i],
        path.join(dir, `blend-norm-${i}.mp4`),
        format,
        dir,
        i,
      ),
    );
  }

  const hasAnyTransition = joints.some(jointUsesTransition);
  if (!hasAnyTransition) {
    await concatExact(normalized, outputPath, format);
    const probed = await probeVideo(outputPath);
    return probed.duration > 0 ? probed.duration : normalized.reduce((s, c) => s + c.duration, 0);
  }

  const allTransitions =
    joints.length >= normalized.length - 1 &&
    joints.slice(0, normalized.length - 1).every(jointUsesTransition);

  if (allTransitions && normalized.length <= 16) {
    try {
      return await xfadeChainAllClips(normalized, joints, outputPath, format);
    } catch (error: unknown) {
      logger.warn('video-tools', 'Multi-clip xfade chain failed; falling back to pairwise merge', error);
    }
  }

  let acc: PreparedTimelineClip = { ...normalized[0] };
  for (let i = 1; i < normalized.length; i += 1) {
    const joint = joints[i - 1] || { transition: 'none', durationSeconds: 0 };
    const next = normalized[i];
    const stepOut = path.join(dir, `timeline-merge-${i}.mp4`);
    if (jointUsesTransition(joint)) {
      const duration = await xfadeTwoPreparedClips(acc, next, stepOut, {
        ...format,
        transition: joint.transition,
        fadeSeconds: joint.durationSeconds,
      });
      acc = { path: stepOut, duration };
    } else {
      await concatExact([acc, next], stepOut, format);
      const probed = await probeVideo(stepOut);
      acc = {
        path: stepOut,
        duration: probed.duration > 0 ? probed.duration : acc.duration + next.duration,
      };
    }
  }

  await run(bin('ffmpeg'), ['-y', '-i', acc.path, '-c', 'copy', '-movflags', '+faststart', outputPath]);
  const finalProbe = await probeVideo(outputPath);
  return finalProbe.duration > 0 ? finalProbe.duration : acc.duration;
}

export async function mixVideoAudioWithMusic(
  videoPath: string,
  musicPath: string,
  outputPath: string,
  options: { volume?: number; fadeOutSeconds?: number } = {},
) {
  const probe = await probeVideo(videoPath);
  const duration = probe.duration;
  if (!duration || duration <= 0) {
    throw new Error('Could not determine video duration for background music mix');
  }
  const volume = typeof options.volume === 'number' && Number.isFinite(options.volume)
    ? Math.min(1, Math.max(0, options.volume))
    : 1;
  const fadeOut = Math.min(options.fadeOutSeconds ?? 1, duration / 2);
  const fadeStart = Math.max(0, duration - fadeOut);

  const musicChain = [
    `aloop=loop=-1:size=2e+09`,
    `atrim=0:${duration.toFixed(3)}`,
    'asetpts=PTS-STARTPTS',
    `volume=${volume.toFixed(3)}`,
  ];
  if (fadeOut > 0.05) {
    musicChain.push(`afade=t=out:st=${fadeStart.toFixed(3)}:d=${fadeOut.toFixed(3)}`);
  }

  await run(bin('ffmpeg'), [
    '-y',
    '-i',
    videoPath,
    '-i',
    musicPath,
    '-filter_complex',
    `[0:a]volume=1[a0];[1:a]${musicChain.join(',')}[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
    '-map',
    '0:v:0',
    '-map',
    '[aout]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-ar',
    '44100',
    '-ac',
    '2',
    '-b:a',
    '192k',
    '-t',
    duration.toFixed(3),
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

export async function replaceVideoAudioWithMusic(
  videoPath: string,
  musicPath: string,
  outputPath: string,
  options: { volume?: number; fadeOutSeconds?: number } = {},
) {
  const probe = await probeVideo(videoPath);
  const duration = probe.duration;
  if (!duration || duration <= 0) {
    throw new Error('Could not determine video duration for background music');
  }
  const volume = typeof options.volume === 'number' && Number.isFinite(options.volume)
    ? Math.min(1, Math.max(0, options.volume))
    : 1;
  const fadeOut = Math.min(options.fadeOutSeconds ?? 1, duration / 2);
  const fadeStart = Math.max(0, duration - fadeOut);

  const audioFilters = [
    `aloop=loop=-1:size=2e+09`,
    `atrim=0:${duration.toFixed(3)}`,
    'asetpts=PTS-STARTPTS',
    `volume=${volume.toFixed(3)}`,
  ];
  if (fadeOut > 0.05) {
    audioFilters.push(`afade=t=out:st=${fadeStart.toFixed(3)}:d=${fadeOut.toFixed(3)}`);
  }

  await run(bin('ffmpeg'), [
    '-y',
    '-i',
    videoPath,
    '-i',
    musicPath,
    '-filter_complex',
    `[1:a]${audioFilters.join(',')}[aout]`,
    '-map',
    '0:v:0',
    '-map',
    '[aout]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-ar',
    '44100',
    '-ac',
    '2',
    '-b:a',
    '192k',
    '-t',
    duration.toFixed(3),
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}
