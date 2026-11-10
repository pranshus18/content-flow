import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import type { TimelinePipLayer } from './editor-timeline.js';
import { downloadUrlToFile } from './media-fetch.js';
import { prepareTimelineClipFromFile, probeVideo, runFfmpeg } from './video-tools.js';

async function preparePipClip(
  layer: TimelinePipLayer,
  workDir: string,
  index: number,
  canvas: { width: number; height: number; fps: number },
): Promise<string> {
  const ext = layer.kind === 'video' ? 'mp4' : 'jpg';
  const sourcePath = path.join(workDir, `pip-source-${index}.${ext}`);
  await downloadUrlToFile(layer.sourceUrl, sourcePath, 'PiP layer');
  const pipW = Math.round((canvas.width * (layer.widthPercent ?? 35)) / 100);
  const pipH = Math.round(pipW * 0.5625);
  const preparedPath = path.join(workDir, `pip-prepared-${index}.mp4`);
  await prepareTimelineClipFromFile(
    sourcePath,
    preparedPath,
    {
      kind: layer.kind,
      durationSeconds: layer.durationSeconds,
      trimIn: layer.trimIn,
      trimOut: layer.trimOut,
    },
    { width: pipW, height: pipH, fps: canvas.fps, withAudio: false },
  );
  return preparedPath;
}

export async function burnTimelinePipLayers(
  inputPath: string,
  outputPath: string,
  options: { width: number; height: number; fps: number; withAudio: boolean },
  layers: TimelinePipLayer[],
  workDir: string,
): Promise<void> {
  if (!layers.length) {
    await copyFile(inputPath, outputPath);
    return;
  }

  let current = inputPath;
  for (const [index, layer] of layers.entries()) {
    const pipPath = await preparePipClip(layer, workDir, index, options);
    const probe = await probeVideo(pipPath);
    const pipW = probe.width;
    const pipH = probe.height;
    const x = Math.round((options.width * layer.x) / 100 - pipW / 2);
    const y = Math.round((options.height * layer.y) / 100 - pipH / 2);
    const end = layer.startSeconds + layer.durationSeconds;
    const op = layer.opacity != null ? Math.min(1, Math.max(0.05, layer.opacity)) : 1;
    const stepOut = path.join(workDir, `pip-merge-${index}.mp4`);
    const enable = `between(t,${layer.startSeconds.toFixed(3)},${end.toFixed(3)})`;
    const audioMap = options.withAudio ? ['-map', '0:a?'] : ['-an'];
    await runFfmpeg([
      '-y',
      '-i',
      current,
      '-i',
      pipPath,
      '-filter_complex',
      `[1:v]format=rgba,colorchannelmixer=aa=${op.toFixed(3)}[fg];[0:v][fg]overlay=${Math.max(0, x)}:${Math.max(0, y)}:enable='${enable.replace(/,/g, '\\,')}'[vout]`,
      '-map',
      '[vout]',
      ...audioMap,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      ...(options.withAudio ? ['-c:a', 'aac'] : []),
      '-movflags',
      '+faststart',
      stepOut,
    ]);
    current = stepOut;
  }
  await copyFile(current, outputPath);
}
