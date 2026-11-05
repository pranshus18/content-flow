/**
 * On Vercel install: refresh vercel.json proxy rewrite from API_PROXY_ORIGIN.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const origin = String(process.env.API_PROXY_ORIGIN || '').trim().replace(/\/+$/, '');

const rewrites = [];

if (process.env.VERCEL === '1' && origin) {
  rewrites.push({
    source: '/health',
    destination: `${origin}/health`,
  });
  rewrites.push({
    source: '/api/(.*)',
    destination: `${origin}/api/$1`,
  });
  console.log(`[vercel-config] /health + /api/* → ${origin}`);
} else if (process.env.VERCEL === '1') {
  console.warn('[vercel-config] API_PROXY_ORIGIN missing — add it in Vercel env vars.');
}

rewrites.push({
  source: '/((?!api(?:/|$)).*)',
  destination: '/index.html',
});

const config = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  installCommand: 'node scripts/generate-vercel-config.mjs && npm install',
  rewrites,
};

fs.writeFileSync(path.join(root, 'vercel.json'), `${JSON.stringify(config, null, 2)}\n`);
