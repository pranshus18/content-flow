import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../.env') });

function read(name: string, fallback = ''): string {
  const value = (process.env[name] ?? fallback).trim();
  if (!value || /^your_.+_here$/i.test(value)) return '';
  return value;
}

const nodeEnv = read('NODE_ENV', 'development');

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(read('PORT', '8081')),
  /** Comma-separated browser origins allowed for CORS (e.g. Vercel app URL). */
  frontendOrigin: read('FRONTEND_ORIGIN', 'http://localhost:8080'),
  /** Optional extra origins, comma-separated (preview URLs, staging). */
  frontendExtraOrigins: read('FRONTEND_EXTRA_ORIGINS', ''),
  /** Opt-in: serve frontend/dist from Express (single-host Render). Off when frontend is on Vercel. */
  serveFrontend: read('SERVE_FRONTEND', '') === 'true',
  supabaseUrl: read('SUPABASE_URL'),
  supabaseAnonKey: read('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: read('SUPABASE_SERVICE_ROLE_KEY'),
  cronSecret: read('CRON_SECRET'),
  geminiApiKey: read('GEMINI_API_KEY'),
  geminiImageModel: read('GEMINI_IMAGE_MODEL', 'gemini-nano-banana-2.1'),
  geminiVideoModel: read('GEMINI_VIDEO_MODEL', 'gemini-omni-1.1-flash'),
  geminiTextModel: read('GEMINI_TEXT_MODEL', 'gemini-3.8-flash'),
  openRouterApiKey: read('OPENROUTER_API_KEY'),
  openaiApiKey: read('OPENAI_API_KEY'),
  replicateApiToken: read('REPLICATE_API_TOKEN'),
  facebookAccessToken: read('FACEBOOK_ACCESS_TOKEN'),
  facebookPageId: read('FACEBOOK_PAGE_ID'),
  instagramAccessToken: read('INSTAGRAM_ACCESS_TOKEN'),
  instagramAccountId: read('INSTAGRAM_ACCOUNT_ID'),
  youtubeClientId: read('YOUTUBE_CLIENT_ID'),
  youtubeClientSecret: read('YOUTUBE_CLIENT_SECRET'),
  youtubeRefreshToken: read('YOUTUBE_REFRESH_TOKEN'),
  youtubeDefaultPrivacyStatus: read('YOUTUBE_DEFAULT_PRIVACY_STATUS', 'unlisted'),
};

export function requireSupabaseConfig() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env (copy from Supabase Dashboard → Settings → API).',
    );
  }
}
