import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cron from 'node-cron';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { requestId } from './middleware/requestId.js';
import { requireAdminUser, requireAuth, requireCronOrAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import { rateLimit } from './middleware/rateLimit.js';
import { generateCaptionRouter } from './routes/generate-caption.js';
import { preprocessMediaRouter } from './routes/preprocess-media.js';
import { enhanceMediaRouter } from './routes/enhance-media.js';
import { publishSocialRouter } from './routes/publish-social.js';
import { publishContentRouter } from './routes/publish-content.js';
import { fetchAnalyticsRouter } from './routes/fetch-analytics.js';
import { confirmEmailRouter } from './routes/confirm-email.js';
import { contentRouter } from './routes/content.js';
import { meRouter } from './routes/me.js';
import { brandingRouter } from './routes/branding.js';
import { publishingSettingsRouter } from './routes/publishing-settings.js';
import { usersRouter } from './routes/users.js';
import { generateTemplateFrameRouter } from './routes/generate-template-frame.js';
import { applyTemplateFramesRouter } from './routes/apply-template-frames.js';
import { backgroundMusicRouter } from './routes/background-music.js';
import { adminAssetsRouter } from './routes/admin-assets.js';
import { publishContent } from './services/publish-content.js';

const app = express();
app.set('etag', false);

function parseOriginList(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

const allowedOrigins = new Set([
  ...parseOriginList(env.frontendOrigin),
  ...parseOriginList(env.frontendExtraOrigins),
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://[::1]:8080',
]);

function isAllowedCorsOrigin(origin: string): boolean {
  if (allowedOrigins.has(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1|\[::1\]|\d+\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin)) return true;
  if (/^https:\/\/[a-z0-9.-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedCorsOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  allowedHeaders: ['authorization', 'content-type', 'x-client-info', 'apikey', 'x-cron-secret', 'x-request-id'],
}));
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(requestId);

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'content-flow-backend',
    port: env.port,
    supabaseConfigured: Boolean(env.supabaseUrl && env.supabaseServiceRoleKey),
  });
});

app.use(
  '/api/auth/confirm-email',
  rateLimit({ prefix: 'confirm-email', windowMs: 10 * 60 * 1000, max: 8 }),
  confirmEmailRouter,
);
app.use('/api/me', requireAuth, meRouter);
app.use('/api/content', requireAuth, contentRouter);
app.use('/api/branding', requireAuth, brandingRouter);
app.use('/api/publishing-settings', requireAuth, publishingSettingsRouter);
app.use('/api/users', requireAuth, requireAdminUser, usersRouter);
app.use('/api/generate-caption', requireAuth, requireAdminUser, generateCaptionRouter);
app.use('/api/generate-template-frame', requireAuth, requireAdminUser, generateTemplateFrameRouter);
app.use('/api/apply-template-frames', requireAuth, requireAdminUser, applyTemplateFramesRouter);
app.use('/api/background-music', requireAuth, requireAdminUser, backgroundMusicRouter);
app.use('/api/admin-assets', requireAuth, requireAdminUser, adminAssetsRouter);
app.use('/api/preprocess-media', requireAuth, requireAdminUser, preprocessMediaRouter);
app.use('/api/enhance-media', requireAuth, requireAdminUser, enhanceMediaRouter);
app.use('/api/publish-social', requireAuth, requireAdminUser, publishSocialRouter);
app.use('/api/publish-content', requireCronOrAuth, publishContentRouter);
app.use('/api/fetch-analytics', requireAuth, requireAdminUser, fetchAnalyticsRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

const backendRoot = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(backendRoot, '../../frontend/dist');

if (env.serveFrontend && existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      next();
      return;
    }
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
  logger.info('server', `Serving frontend from ${frontendDist}`);
} else if (env.serveFrontend) {
  logger.warn('server', `SERVE_FRONTEND enabled but ${frontendDist} is missing. Run: npm run build --prefix frontend`);
}

app.use(errorHandler);

if (env.supabaseUrl && env.supabaseServiceRoleKey) {
  let publishSweepRunning = false;
  const runPublishSweep = async (reason: string) => {
    if (publishSweepRunning) return;
    publishSweepRunning = true;
    try {
      const result = await publishContent({});
      const published = result.published ?? 0;
      const failed = 'failed' in result ? Number(result.failed) || 0 : 0;
      if (published > 0 || failed > 0) {
        logger.info('cron', `Scheduled publish finished (${reason})`, result);
      }
    } catch (error) {
      logger.error('cron', `Scheduled publish failed (${reason})`, error);
    } finally {
      publishSweepRunning = false;
    }
  };

  cron.schedule('* * * * *', () => {
    void runPublishSweep('minute');
  });
  void runPublishSweep('startup');
  logger.info('cron', 'Scheduled publish check registered (every minute; due posts publish at scheduled_date)');
} else {
  logger.warn('cron', 'Skipping scheduled publish cron until SUPABASE_SERVICE_ROLE_KEY is set.');
}

app.listen(env.port, () => {
  logger.info('server', `Backend listening on http://localhost:${env.port}`);
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    logger.warn('server', 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Copy values into backend/.env.');
  }
  if (!env.supabaseAnonKey) {
    logger.warn('server', 'SUPABASE_ANON_KEY is missing. JWT verification will fail.');
  }
});
