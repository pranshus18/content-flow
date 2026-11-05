/**
 * Vercel build: validate env. API calls use same-origin /api (Edge proxy), not cross-origin Render.
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

const proxyOrigin = String(process.env.API_PROXY_ORIGIN || '').trim().replace(/\/+$/, '');
const directApi = String(process.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

if (!proxyOrigin && !directApi) {
  missing.push('API_PROXY_ORIGIN (Render URL, e.g. https://your-service.onrender.com)');
}

if (missing.length > 0) {
  console.error('\n[Vercel] Missing environment variables:\n');
  for (const name of missing) {
    console.error(`  • ${name}`);
  }
  console.error('\nSee frontend/DEPLOY.md\n');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(here, '../.env.production.local');

if (proxyOrigin) {
  // Same-origin /api → Vercel Edge proxy (api/[...path].ts). Do not bake Render URL into the bundle.
  fs.writeFileSync(
    envFile,
    '# Proxied on Vercel — leave VITE_API_URL empty\nVITE_API_URL=\n',
    'utf8',
  );
  console.log(`[Vercel] API proxy target: ${proxyOrigin} (browser uses /api on this domain)`);
} else if (directApi) {
  fs.writeFileSync(envFile, `VITE_API_URL=${directApi}\n`, 'utf8');
  console.warn('[Vercel] Direct API mode — ensure FRONTEND_ORIGIN on Render matches this Vercel URL (CORS).');
}

if (directApi && proxyOrigin && directApi !== proxyOrigin) {
  console.warn('[Vercel] Both VITE_API_URL and API_PROXY_ORIGIN are set; proxy mode clears VITE_API_URL.');
}

console.log('[Vercel] Environment check passed.');
