/**
 * Vercel build: validate env and map API_PROXY_ORIGIN → VITE_API_URL for the client bundle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isVercel = process.env.VERCEL === '1';
if (!isVercel) {
  process.exit(0);
}

const missing = [];

if (!String(process.env.VITE_SUPABASE_URL || '').trim()) {
  missing.push('VITE_SUPABASE_URL');
}
if (!String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()) {
  missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
}

let apiOrigin = String(process.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const proxyOrigin = String(process.env.API_PROXY_ORIGIN || '').trim().replace(/\/+$/, '');

if (!apiOrigin && !proxyOrigin) {
  missing.push('API_PROXY_ORIGIN (Render URL, e.g. https://your-service.onrender.com)');
}

if (missing.length > 0) {
  console.error('\n[Vercel] Missing or invalid environment variables:\n');
  for (const name of missing) {
    console.error(`  • ${name}`);
  }
  console.error('\nUse type **Config** (not Secret) for VITE_SUPABASE_*.');
  console.error('Set **API_PROXY_ORIGIN** (Secret or Config). See frontend/DEPLOY.md\n');
  process.exit(1);
}

if (!apiOrigin && proxyOrigin) {
  apiOrigin = proxyOrigin;
  process.env.VITE_API_URL = proxyOrigin;

  const here = path.dirname(fileURLToPath(import.meta.url));
  const envFile = path.resolve(here, '../.env.production.local');
  const lines = [`VITE_API_URL=${proxyOrigin}`, ''];
  fs.writeFileSync(envFile, lines.join('\n'), 'utf8');
  console.log(`[Vercel] Client API base: ${proxyOrigin} (from API_PROXY_ORIGIN)`);
} else if (apiOrigin && proxyOrigin && apiOrigin !== proxyOrigin) {
  console.warn(
    '[Vercel] VITE_API_URL and API_PROXY_ORIGIN differ; using VITE_API_URL for the client bundle.',
  );
}

console.log('[Vercel] Environment check passed.');
