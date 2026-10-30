import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../lib/env.js';
import { logger, trimUrl } from '../lib/logger.js';
import { getServiceClient } from '../lib/supabase.js';
import { getYouTubeAccessToken } from '../lib/youtube.js';

const FUNCTION_VERSION = 'publish-social@local-backend';

export interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
  version?: string;
}

const RATE_LIMITS = {
  facebook: {
    maxPostsPerHourPerUser: 10,
    maxPostsPerHourApp: 50,
    maxPostsPerDayPerUser: 5,
    maxPostsPerDayPerPage: 3,
    minMinutesBetweenPosts: 5,
  },
  instagram: {
    maxPostsPerHourPerUser: 2,
    maxPostsPerHourApp: 20,
    maxPostsPerDayPerUser: 3,
    maxPostsPerDayPerAccount: 2,
    minMinutesBetweenPosts: 30,
  },
  youtube: {
    maxPostsPerHourPerUser: 5,
    maxPostsPerHourApp: 30,
    maxPostsPerDayPerUser: 10,
    minMinutesBetweenPosts: 60,
  },
};

async function checkRateLimits(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  pageId?: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = RATE_LIMITS[platform as keyof typeof RATE_LIMITS];
  if (!limits) return { allowed: true };

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const { count: hourlyUserPosts } = await supabase
      .from('content')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('status', 'published')
      .gte('published_at', oneHourAgo.toISOString());

    if (hourlyUserPosts && hourlyUserPosts >= limits.maxPostsPerHourPerUser) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: You have posted ${hourlyUserPosts} times in the last hour. Maximum allowed: ${limits.maxPostsPerHourPerUser} posts per hour. Please wait before posting again.`,
      };
    }

    const { count: hourlyAppPosts } = await supabase
      .from('content')
      .select('*', { count: 'exact', head: true })
      .eq('platform', platform)
      .eq('status', 'published')
      .gte('published_at', oneHourAgo.toISOString());

    if (hourlyAppPosts && hourlyAppPosts >= limits.maxPostsPerHourApp) {
      return {
        allowed: false,
        reason: `App-wide rate limit exceeded: ${hourlyAppPosts} posts in the last hour. Maximum allowed: ${limits.maxPostsPerHourApp} posts per hour. Please wait before posting again.`,
      };
    }

    const { count: dailyUserPosts } = await supabase
      .from('content')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('status', 'published')
      .gte('published_at', oneDayAgo.toISOString());

    if (dailyUserPosts && dailyUserPosts >= limits.maxPostsPerDayPerUser) {
      return {
        allowed: false,
        reason: `Daily limit exceeded: You have posted ${dailyUserPosts} times today. Maximum allowed: ${limits.maxPostsPerDayPerUser} posts per day. Please try again tomorrow.`,
      };
    }

    const { data: lastPost } = await supabase
      .from('content')
      .select('published_at')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(1)
      .single();

    if (lastPost?.published_at) {
      const lastPostTime = new Date(lastPost.published_at);
      const timeSinceLastPost = (now.getTime() - lastPostTime.getTime()) / (1000 * 60);
      if (timeSinceLastPost < limits.minMinutesBetweenPosts) {
        const waitMinutes = Math.ceil(limits.minMinutesBetweenPosts - timeSinceLastPost);
        return {
          allowed: false,
          reason: `Please wait ${waitMinutes} more minute(s) before posting again. Minimum time between posts: ${limits.minMinutesBetweenPosts} minutes.`,
        };
      }
    }

    if ((platform === 'facebook' || platform === 'instagram') && pageId) {
      const pageLimitKey = platform === 'facebook' ? 'maxPostsPerDayPerPage' : 'maxPostsPerDayPerAccount';
      const pageLimit = limits[pageLimitKey as keyof typeof limits] as number | undefined;
      if (pageLimit) {
        const { count: dailyPagePosts } = await supabase
          .from('content')
          .select('*', { count: 'exact', head: true })
          .eq('platform', platform)
          .eq('status', 'published')
          .gte('published_at', oneDayAgo.toISOString());

        if (dailyPagePosts && dailyPagePosts >= pageLimit) {
          return {
            allowed: false,
            reason: `Daily limit exceeded for ${platform}: ${dailyPagePosts} posts today. Maximum allowed: ${pageLimit} posts per day per ${platform === 'facebook' ? 'Page' : 'Account'}. Please try again tomorrow.`,
          };
        }
      }
    }

    return { allowed: true };
  } catch (error) {
    logger.error('publish-social', 'Error checking rate limits', error);
    return { allowed: true };
  }
}

async function appendBrandingToDescription(
  supabase: SupabaseClient,
  originalDescription: string,
  platform: string,
): Promise<string> {
  try {
    const { data: brandingSettings, error } = await supabase
      .from('branding_settings')
      .select('company_logo_url, company_website_url')
      .maybeSingle();

    if (error || !brandingSettings) {
      return originalDescription;
    }

    const logoUrl = brandingSettings.company_logo_url;
    const websiteUrl = brandingSettings.company_website_url;
    if (!logoUrl && !websiteUrl) return originalDescription;

    let brandingFooter = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    if (platform === 'youtube') {
      if (logoUrl) brandingFooter += `\n![Logo](${logoUrl})\n`;
      if (websiteUrl) brandingFooter += `\n🌐 **Visit our website:** ${websiteUrl}\n`;
    } else if (platform === 'instagram' || platform === 'facebook') {
      if (logoUrl) brandingFooter += `\n📸 Logo: ${logoUrl}\n`;
      if (websiteUrl) brandingFooter += `\n🌐 Visit us: ${websiteUrl}\n`;
    } else {
      if (logoUrl) brandingFooter += `\nLogo: ${logoUrl}\n`;
      if (websiteUrl) brandingFooter += `\n🌐 Visit our website: ${websiteUrl}\n`;
    }
    brandingFooter += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    return originalDescription + brandingFooter;
  } catch (error) {
    logger.error('publish-social', 'Error appending branding', error);
    return originalDescription;
  }
}

async function publishToYouTube(content: Record<string, any>, supabase: SupabaseClient): Promise<PublishResult> {
  try {
    logger.info('publish-social', 'Publishing to YouTube');
    const accessTokenRes = await getYouTubeAccessToken();
    if ('error' in accessTokenRes) {
      return { platform: 'youtube', success: false, error: accessTokenRes.error };
    }

    const mediaUrl = content.enhanced_media_url || content.media_url;
    if (!mediaUrl) {
      return { platform: 'youtube', success: false, error: 'Media URL is required for YouTube uploads' };
    }

    const isVideo =
      content.media_type === 'video' ||
      mediaUrl.includes('.mp4') ||
      mediaUrl.includes('.mov') ||
      mediaUrl.includes('.webm');
    if (!isVideo) {
      return { platform: 'youtube', success: false, error: 'YouTube uploads require a video file (mp4/mov/webm).' };
    }

    const videoRes = await fetch(mediaUrl);
    if (!videoRes.ok) {
      const t = await videoRes.text().catch(() => '');
      return {
        platform: 'youtube',
        success: false,
        error: `Failed to fetch video from media URL (HTTP ${videoRes.status}). Ensure the URL is publicly accessible via HTTPS. ${t}`.trim(),
      };
    }

    const videoBytes = Buffer.from(await videoRes.arrayBuffer());
    const title = String(content.title || 'Untitled').slice(0, 100);
    const originalDescription = String(content.admin_description || content.title || '');
    const description = await appendBrandingToDescription(supabase, originalDescription, 'youtube');
    const privacyStatus = (env.youtubeDefaultPrivacyStatus || 'unlisted') as 'private' | 'public' | 'unlisted';

    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessTokenRes.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(videoBytes.length),
          'X-Upload-Content-Type': 'application/octet-stream',
        },
        body: JSON.stringify({
          snippet: { title, description },
          status: { privacyStatus },
        }),
      },
    );

    const initText = await initRes.text().catch(() => '');
    if (!initRes.ok) {
      return {
        platform: 'youtube',
        success: false,
        error: `YouTube upload init failed (HTTP ${initRes.status}): ${initText}`,
      };
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      return {
        platform: 'youtube',
        success: false,
        error: 'YouTube upload init did not return an upload URL (missing Location header).',
      };
    }

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessTokenRes.accessToken}`,
        'Content-Length': String(videoBytes.length),
        'Content-Type': 'application/octet-stream',
      },
      body: videoBytes,
    });

    const uploadText = await uploadRes.text().catch(() => '');
    if (!uploadRes.ok) {
      logger.error('publish-social', 'YouTube upload failed', {
        status: uploadRes.status,
        response: uploadText.substring(0, 500),
      });
      return {
        platform: 'youtube',
        success: false,
        error: `YouTube upload failed (HTTP ${uploadRes.status}): ${uploadText.substring(0, 200)}`,
      };
    }

    let uploadJson: any = null;
    try {
      uploadJson = JSON.parse(uploadText);
    } catch {
      const idMatch = uploadText.match(/"id"\s*:\s*"([^"]+)"/);
      if (idMatch?.[1]) {
        return { platform: 'youtube', success: true, postId: idMatch[1] };
      }
      return {
        platform: 'youtube',
        success: false,
        error: 'YouTube upload succeeded but could not extract video ID from response. Please check your YouTube channel manually.',
      };
    }

    const videoId = uploadJson?.id || uploadJson?.snippet?.resourceId?.videoId || uploadJson?.videoId;
    if (!videoId) {
      return {
        platform: 'youtube',
        success: false,
        error: 'YouTube upload succeeded but video ID was not found in the response. Please check your YouTube channel manually.',
      };
    }

    logger.info('publish-social', 'YouTube video published', { videoId, title: uploadJson?.snippet?.title });
    return { platform: 'youtube', success: true, postId: videoId };
  } catch (error: any) {
    logger.error('publish-social', 'YouTube publish error', error);
    return { platform: 'youtube', success: false, error: error?.message || String(error) };
  }
}

async function publishToFacebook(
  content: Record<string, any>,
  accessToken: string,
  supabase: SupabaseClient,
  pageId?: string,
): Promise<PublishResult> {
  try {
    logger.info('publish-social', 'Publishing to Facebook');
    const endpointId = pageId || 'me';
    const originalMessage = content.admin_description || content.title;
    const message = await appendBrandingToDescription(supabase, originalMessage, 'facebook');
    const mediaUrl = content.enhanced_media_url || content.media_url;
    const isVideo =
      content.media_type === 'video' ||
      mediaUrl?.includes('.mp4') ||
      mediaUrl?.includes('.mov') ||
      mediaUrl?.includes('.webm');

    if (mediaUrl && isVideo) {
      try {
        const body = new URLSearchParams();
        body.set('file_url', mediaUrl);
        body.set('description', message);
        body.set('access_token', accessToken);

        const videoResponse = await fetch(`https://graph.facebook.com/v18.0/${endpointId}/videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });

        const videoText = await videoResponse.text();
        if (videoResponse.ok) {
          const videoData = JSON.parse(videoText);
          if (videoData?.id) {
            return { platform: 'facebook', success: true, postId: videoData.id };
          }
        } else {
          logger.warn('publish-social', 'Facebook /videos upload failed, falling back to /feed', videoText);
        }
      } catch (videoError) {
        logger.warn('publish-social', 'Facebook /videos upload error, falling back to /feed', videoError);
      }
    }

    if (mediaUrl && !isVideo) {
      try {
        const photoResponse = await fetch(`https://graph.facebook.com/v18.0/${endpointId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: mediaUrl, message, access_token: accessToken }),
        });

        if (photoResponse.ok) {
          const photoData = await photoResponse.json();
          const actualPostId = photoData.post_id || photoData.id;
          return { platform: 'facebook', success: true, postId: actualPostId };
        }
        logger.info('publish-social', 'Photo upload failed, falling back to feed endpoint');
      } catch (photoError) {
        logger.info('publish-social', 'Photo upload error, falling back to feed', photoError);
      }
    }

    const response = await fetch(`https://graph.facebook.com/v18.0/${endpointId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        ...(mediaUrl ? { link: mediaUrl } : {}),
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      let errorCode: number | null = null;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorText;
        errorCode = errorJson.error?.code || errorJson.error?.error_subcode || null;
      } catch {
        // keep text
      }

      if (errorCode === 4 || errorCode === 17 || errorCode === 613 || errorMessage.includes('rate limit')) {
        throw new Error(`RATE_LIMIT_EXCEEDED: ${errorMessage}`);
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return { platform: 'facebook', success: true, postId: data.id };
  } catch (error: any) {
    logger.error('publish-social', 'Facebook publish error', error);
    const errorMsg = error.message || String(error);
    if (errorMsg.includes('RATE_LIMIT_EXCEEDED') || errorMsg.includes('rate limit')) {
      return {
        platform: 'facebook',
        success: false,
        error: 'Facebook rate limit exceeded. Please wait at least 1 hour before posting again.',
      };
    }
    if (errorMsg.includes('Invalid OAuth')) {
      return { platform: 'facebook', success: false, error: 'Facebook access token is invalid or expired. Update FACEBOOK_ACCESS_TOKEN in backend/.env.' };
    }
    if (errorMsg.includes('permission')) {
      return { platform: 'facebook', success: false, error: "Missing Facebook permissions. Please ensure your app has 'pages_manage_posts' permission." };
    }
    return { platform: 'facebook', success: false, error: errorMsg };
  }
}

async function publishToInstagram(
  content: Record<string, any>,
  accessToken: string,
  supabase: SupabaseClient,
  instagramAccountId?: string,
): Promise<PublishResult> {
  try {
    logger.info('publish-social', 'Publishing to Instagram');
    const originalCaption = content.admin_description || content.title;
    const caption = await appendBrandingToDescription(supabase, originalCaption, 'instagram');
    const mediaUrl = content.enhanced_media_url || content.media_url;

    if (!mediaUrl) {
      return { platform: 'instagram', success: false, error: 'Media URL is required for Instagram posts' };
    }

    try {
      const mediaCheck = await fetch(mediaUrl, { method: 'HEAD' });
      if (!mediaCheck.ok) {
        return {
          platform: 'instagram',
          success: false,
          error: `Media URL is not accessible (HTTP ${mediaCheck.status}). Ensure the URL is publicly accessible via HTTPS.`,
        };
      }
    } catch {
      return {
        platform: 'instagram',
        success: false,
        error: 'Media URL is not accessible. Ensure the URL is publicly accessible via HTTPS.',
      };
    }

    const accountEndpoint = instagramAccountId || 'me';
    const containerResponse = await fetch(`https://graph.facebook.com/v18.0/${accountEndpoint}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: mediaUrl,
        caption,
        access_token: accessToken,
      }),
    });

    if (!containerResponse.ok) {
      const errorText = await containerResponse.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorText;
        const errorCode = errorJson.error?.code || errorJson.error?.error_subcode || null;
        logger.error('publish-social', 'Instagram create container error', {
          status: containerResponse.status,
          error: errorJson.error,
          accountEndpoint,
        });
        if (errorCode === 4 || errorCode === 17 || errorCode === 613 || errorMessage.includes('rate limit')) {
          throw new Error(`RATE_LIMIT_EXCEEDED: ${errorMessage}`);
        }
        if (errorMessage.includes('Invalid user') && accountEndpoint === 'me') {
          errorMessage += ' Try setting INSTAGRAM_ACCOUNT_ID in backend/.env.';
        }
      } catch (e: any) {
        if (e.message?.includes('RATE_LIMIT_EXCEEDED')) throw e;
      }
      throw new Error(errorMessage);
    }

    const containerData = await containerResponse.json();
    if (!containerData.id) {
      throw new Error('Failed to create media container. Instagram API did not return container ID.');
    }

    const publishResponse = await fetch(`https://graph.facebook.com/v18.0/${accountEndpoint}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: accessToken,
      }),
    });

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorText;
        logger.error('publish-social', 'Instagram publish error', errorJson.error);
      } catch {
        logger.error('publish-social', 'Instagram publish non-JSON error', errorText);
      }
      throw new Error(errorMessage);
    }

    const publishData = await publishResponse.json();
    return { platform: 'instagram', success: true, postId: publishData.id };
  } catch (error: any) {
    logger.error('publish-social', 'Instagram publish error', error);
    const errorMsg = error.message || String(error);
    if (errorMsg.includes('RATE_LIMIT_EXCEEDED') || errorMsg.includes('rate limit')) {
      return {
        platform: 'instagram',
        success: false,
        error: 'Instagram rate limit exceeded. Please wait at least 1 hour before posting again.',
      };
    }
    if (errorMsg.includes('Invalid OAuth') || errorMsg.includes('(#200)')) {
      return { platform: 'instagram', success: false, error: 'Instagram access token is invalid or expired. Update INSTAGRAM_ACCESS_TOKEN in backend/.env.' };
    }
    if (errorMsg.includes('permission') || errorMsg.includes('(#10)')) {
      return { platform: 'instagram', success: false, error: `Missing Instagram permissions. Error: ${errorMsg}` };
    }
    if (errorMsg.includes('Invalid user') || errorMsg.includes('(#100)')) {
      return { platform: 'instagram', success: false, error: 'Invalid Instagram account. Set INSTAGRAM_ACCOUNT_ID in backend/.env.' };
    }
    return { platform: 'instagram', success: false, error: errorMsg };
  }
}

export async function publishContentToSocial(input: {
  contentId?: string;
  platform?: string;
}): Promise<PublishResult> {
  const { contentId, platform } = input;

  if (!contentId) {
    return { platform: platform || 'unknown', success: false, error: 'contentId is required', version: FUNCTION_VERSION };
  }

  logger.info('publish-social', 'Publishing request', { contentId, platform: platform || 'auto' });

  const supabase = getServiceClient();
  const { data: content, error: contentError } = await supabase
    .from('content')
    .select('*')
    .eq('id', contentId)
    .single();

  if (contentError || !content) {
    return {
      platform: platform || 'unknown',
      success: false,
      error: contentError ? `Content not found: ${contentError.message}` : 'Content not found',
      version: FUNCTION_VERSION,
    };
  }

  logger.info('publish-social', 'Content found', {
    title: content.title,
    platform: content.platform,
    status: content.status,
    mediaUrl: trimUrl(content.enhanced_media_url || content.media_url),
  });

  if (!content.admin_description || !String(content.admin_description).trim()) {
    return {
      platform: content.platform || platform || 'unknown',
      success: false,
      error: "Admin description (post caption) is required. Please edit the content and add a caption before publishing. You can write it manually or use 'Generate with AI'.",
      version: FUNCTION_VERSION,
    };
  }

  const targetPlatform = platform || content.platform || 'instagram';
  const rateLimitCheck = await checkRateLimits(
    supabase,
    content.user_id,
    targetPlatform,
    targetPlatform === 'facebook' ? env.facebookPageId : undefined,
  );

  if (!rateLimitCheck.allowed) {
    logger.warn('publish-social', `Rate limit check failed: ${rateLimitCheck.reason}`);
    return {
      platform: targetPlatform,
      success: false,
      error: rateLimitCheck.reason || 'Rate limit exceeded. Please wait before posting again.',
      version: FUNCTION_VERSION,
    };
  }

  let result: PublishResult;
  switch (targetPlatform) {
    case 'twitter':
      result = { platform: 'twitter', success: false, error: 'Publishing to Twitter is disabled for this workspace.' };
      break;
    case 'linkedin':
      result = { platform: 'linkedin', success: false, error: 'Publishing to LinkedIn is disabled for this workspace.' };
      break;
    case 'facebook':
      result = env.facebookAccessToken
        ? await publishToFacebook(content, env.facebookAccessToken, supabase, env.facebookPageId || undefined)
        : { platform: 'facebook', success: false, error: 'Facebook API key not configured. Add FACEBOOK_ACCESS_TOKEN to backend/.env.' };
      break;
    case 'instagram':
      result = env.instagramAccessToken
        ? await publishToInstagram(content, env.instagramAccessToken, supabase, env.instagramAccountId || undefined)
        : { platform: 'instagram', success: false, error: 'Instagram API key not configured. Add INSTAGRAM_ACCESS_TOKEN to backend/.env.' };
      break;
    case 'youtube':
      result = await publishToYouTube(content, supabase);
      break;
    default:
      result = {
        platform: targetPlatform,
        success: false,
        error: `Unsupported platform: ${targetPlatform}. Supported platforms: facebook, instagram, youtube`,
      };
  }

  if (result.success) {
    logger.info('publish-social', `Publishing successful, postId=${result.postId}`);
    const { error: updateError } = await supabase
      .from('content')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        social_post_id: result.postId,
      })
      .eq('id', contentId);

    if (updateError) {
      logger.error('publish-social', 'Published but failed to update database', updateError);
      result.error = `Published successfully but failed to update database: ${updateError.message}`;
    }
  } else {
    logger.error('publish-social', `Publishing failed: ${result.error || 'Unknown error'}`);
  }

  return { ...result, version: FUNCTION_VERSION };
}
