import { env } from './env.js';
import { logger } from './logger.js';

export async function getYouTubeAccessToken(): Promise<{ accessToken: string } | { error: string }> {
  const clientId = env.youtubeClientId;
  const clientSecret = env.youtubeClientSecret;
  const refreshToken = env.youtubeRefreshToken;

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      error:
        'YouTube credentials not configured. Add YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN to backend/.env.',
    };
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      logger.error('youtube', `Token refresh failed (${tokenRes.status})`, tokenText.slice(0, 400));
      return { error: `Failed to refresh YouTube access token: ${tokenText}` };
    }

    const tokenJson = JSON.parse(tokenText) as { access_token?: string };
    if (!tokenJson.access_token) {
      return { error: 'Failed to refresh YouTube access token: missing access_token in response.' };
    }

    return { accessToken: tokenJson.access_token };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('youtube', 'Token refresh exception', message);
    return { error: message };
  }
}
