/**
 * Fail Vercel builds early when Supabase client env is missing (avoids blank UI).
 */
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

const hasDirectApi = String(process.env.VITE_API_URL || '').trim();
const hasProxy = String(process.env.API_PROXY_ORIGIN || '').trim();
if (!hasDirectApi && !hasProxy) {
  missing.push('API_PROXY_ORIGIN (recommended — server-only, no VITE_ prefix)');
}

if (missing.length > 0) {
  console.error('\n[Vercel] Missing or invalid environment variables:\n');
  for (const name of missing) {
    console.error(`  • ${name}`);
  }
  console.error('\nUse type **Config** (not Secret) for VITE_SUPABASE_*.');
  console.error('Do not add VITE_API_URL as Secret — use API_PROXY_ORIGIN instead.');
  console.error('See frontend/DEPLOY.md\n');
  process.exit(1);
}

if (hasDirectApi && hasProxy) {
  console.warn(
    '[Vercel] Both VITE_API_URL and API_PROXY_ORIGIN are set. Prefer API_PROXY_ORIGIN only; leave VITE_API_URL empty on Vercel.',
  );
}

console.log('[Vercel] Environment check passed.');
