#!/usr/bin/env node
/**
 * Downloads royalty-free demo tracks into frontend/public/music-library/.
 * Sources: Incompetech (Kevin MacLeod) — meditation/nature/ambient catalog, CC BY 4.0 (royalty-free commercial use).
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'frontend/public/music-library');
const catalogPath = path.join(root, 'shared/background-music-catalog.json');

async function download(rawUrl, dest) {
  const url = rawUrl.includes(' ') ? rawUrl.replace(/ /g, '%20') : rawUrl;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

async function main() {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const tracks = catalog.tracks || [];
  await mkdir(outDir, { recursive: true });

  let ok = 0;
  for (const track of tracks) {
    if (!track.bundledFile || !track.sourceDownloadUrl) {
      console.warn(`Skip ${track.id}: missing bundledFile or sourceDownloadUrl`);
      continue;
    }
    const dest = path.join(outDir, track.bundledFile);
    try {
      const bytes = await download(track.sourceDownloadUrl, dest);
      console.log(`OK ${track.bundledFile} (${Math.round(bytes / 1024)} KB) ← ${track.library || 'source'}`);
      ok += 1;
    } catch (error) {
      console.error(`FAIL ${track.id}:`, error.message);
    }
  }
  console.log(`\nDownloaded ${ok}/${tracks.length} tracks to frontend/public/music-library/`);
  if (ok === 0) process.exit(1);
}

main();
