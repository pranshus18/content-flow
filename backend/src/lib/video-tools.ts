import { spawn } from 'node:child_process';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

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
  return `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,fps=${fps},setsar=1,format=yuv420p`;
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

async function matchClipFormat(
  inputPath: string,
  outputPath: string,
  options: { width: number; height: number; fps: number; withAudio: boolean },
) {
  const vf = fillFrameFilter(options.width, options.height, options.fps);
  const args = [
    '-y',
    '-i',
    inputPath,
    '-vf',
    vf,
    '-r',
    String(options.fps),
    '-vsync',
    'cfr',
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

    await concatExact(clips, outputPath, {
      width: options.width,
      height: options.height,
      fps: options.fps,
      withAudio: options.withAudio,
    });
    const framed = await probeVideo(outputPath);
    const expected = clips.reduce((sum, clip) => sum + clip.duration, 0);
    if (hasOutro && framed.duration < expected - 1.2) {
      throw new Error(
        `Outro did not land in the video (got ${framed.duration.toFixed(1)}s, expected about ${expected.toFixed(1)}s)`,
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
      filters.push(`[${index + 1}:v]format=rgba[${src}]`);
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
