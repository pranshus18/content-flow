import { writeFile } from 'node:fs/promises';
import { httpError } from './http.js';

/** Download a public HTTP(S) URL into a local file (timeline clips, voiceovers, etc.). */
export async function downloadUrlToFile(url: string, destPath: string, label = 'media') {
  const response = await fetch(url);
  if (!response.ok) {
    throw httpError(502, `Failed to download ${label} (${response.status})`);
  }
  await writeFile(destPath, Buffer.from(await response.arrayBuffer()));
}
