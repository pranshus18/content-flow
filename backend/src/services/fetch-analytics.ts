import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { getServiceClient } from '../lib/supabase.js';
import { getYouTubeAccessToken } from '../lib/youtube.js';

interface AnalyticsData {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
}

async function fetchFacebookAnalytics(postId: string, accessToken: string): Promise<AnalyticsData> {
  try {
  logger.info('fetch-analytics', 'Fetching Facebook analytics', { postId });
  const metricsFields = 'reactions.summary(true).limit(0),likes.summary(true).limit(0),comments.summary(true),shares';

  let response = await fetch(
    `https://graph.facebook.com/v18.0/${postId}?fields=${encodeURIComponent(metricsFields)}&access_token=${encodeURIComponent(accessToken)}`,
  );
  let data = await response.json();

  if (!response.ok) {
    const postIdMatch = postId.match(/_(\d+)$/);
    if (postIdMatch) {
      const altPostId = postIdMatch[1];
      response = await fetch(
        `https://graph.facebook.com/v18.0/${altPostId}?fields=${encodeURIComponent(metricsFields)}&access_token=${encodeURIComponent(accessToken)}`,
      );
      data = await response.json();
    }
  }

  if (!response.ok) {
    logger.error('fetch-analytics', 'Facebook analytics HTTP error', { status: response.status, body: data, postId });
    throw new Error(data?.error?.message || `Facebook analytics HTTP ${response.status}`);
  }

  const likes =
    data?.reactions?.summary?.total_count ??
    data?.likes?.summary?.total_count ??
    data?.likes?.data?.length ??
    0;
  const comments = data?.comments?.summary?.total_count ?? data?.comments?.data?.length ?? 0;
  const shares = data?.shares?.count ?? 0;

  let reach = 0;
  try {
    const insightsResp = await fetch(
      `https://graph.facebook.com/v18.0/${postId}/insights?metric=post_impressions_unique&access_token=${encodeURIComponent(accessToken)}`,
    );
    const insightsData = await insightsResp.json();
    if (insightsResp.ok) {
      const val = insightsData?.data?.[0]?.values?.[0]?.value;
      if (typeof val === 'number') reach = val;
    }
  } catch (insightsError) {
    logger.warn('fetch-analytics', 'Facebook reach insights failed (non-fatal)', insightsError);
  }

  return { likes, comments, shares, reach };
  } catch (error) {
    logger.error('fetch-analytics', 'Facebook analytics error', error);
    return { likes: 0, comments: 0, shares: 0, reach: 0 };
  }
}

async function fetchInstagramAnalytics(postId: string, accessToken: string): Promise<AnalyticsData> {
  try {
  logger.info('fetch-analytics', 'Fetching Instagram analytics', { postId });
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${postId}?fields=${encodeURIComponent('like_count,comments_count')}&access_token=${encodeURIComponent(accessToken)}`,
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Instagram analytics HTTP ${response.status}`);
  }

  let reach = 0;
  try {
    const insightsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${postId}/insights?metric=reach&access_token=${encodeURIComponent(accessToken)}`,
    );
    const insightsData = await insightsResponse.json();
    if (insightsResponse.ok) {
      const val = insightsData?.data?.[0]?.values?.[0]?.value;
      if (typeof val === 'number') reach = val;
    }
  } catch (insightsError) {
    logger.warn('fetch-analytics', 'Instagram reach insights failed (non-fatal)', insightsError);
  }

  return {
    likes: data?.like_count || 0,
    comments: data?.comments_count || 0,
    shares: 0,
    reach,
  };
  } catch (error) {
    logger.error('fetch-analytics', 'Instagram analytics error', error);
    return { likes: 0, comments: 0, shares: 0, reach: 0 };
  }
}

async function fetchYouTubeAnalytics(videoId: string): Promise<AnalyticsData> {
  const cleanVideoId = videoId.trim();
  if (!cleanVideoId) throw new Error('YouTube video ID is required');

  logger.info('fetch-analytics', 'Fetching YouTube analytics', { videoId: cleanVideoId });

  const accessTokenRes = await getYouTubeAccessToken();
  if ('error' in accessTokenRes) {
    throw new Error(accessTokenRes.error);
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(cleanVideoId)}&part=statistics,snippet`,
    {
      headers: {
        Authorization: `Bearer ${accessTokenRes.accessToken}`,
        Accept: 'application/json',
      },
    },
  );

  const responseText = await response.text();
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Invalid response from YouTube API: ${response.status} ${response.statusText}`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      const errorReason = data?.error?.message || '';
      if (errorReason.includes('scope') || errorReason.includes('permission') || errorReason.includes('insufficient')) {
        throw new Error("Your OAuth token is missing the 'youtube.readonly' scope.");
      }
      throw new Error('YouTube access token is invalid or expired. Check YOUTUBE_REFRESH_TOKEN in backend/.env.');
    }
    if (response.status === 404) {
      throw new Error(`YouTube video not found. Video ID: ${cleanVideoId}.`);
    }
    throw new Error(data?.error?.message || `YouTube analytics HTTP ${response.status}`);
  }

  if (!data.items || data.items.length === 0) {
    throw new Error(`Video not found or access denied. Video ID: ${cleanVideoId}.`);
  }

  const statistics = data.items[0]?.statistics || {};
  return {
    likes: parseInt(statistics.likeCount || '0', 10),
    comments: parseInt(statistics.commentCount || '0', 10),
    shares: 0,
    reach: parseInt(statistics.viewCount || '0', 10),
  };
}

export async function fetchAnalytics(contentId?: string) {
  if (!contentId) {
    return { success: false, error: 'contentId is required' };
  }

  const supabase = getServiceClient();
  const { data: content, error: contentError } = await supabase
    .from('content')
    .select('*')
    .eq('id', contentId)
    .single();

  if (contentError || !content) {
    return { success: false, error: 'Content not found' };
  }

  if (!content.social_post_id) {
    return { success: false, error: 'Content not published to social media yet' };
  }

  logger.info('fetch-analytics', 'Fetching analytics', {
    contentId,
    platform: content.platform,
    socialPostId: content.social_post_id,
  });

  let analytics: AnalyticsData = { likes: 0, comments: 0, shares: 0, reach: 0 };

  switch (content.platform) {
    case 'twitter':
      return { success: false, error: 'Fetching Twitter analytics is disabled for this workspace.' };
    case 'linkedin':
      return { success: false, error: 'Fetching LinkedIn analytics is disabled for this workspace.' };
    case 'facebook':
      if (!env.facebookAccessToken) {
        return { success: false, error: 'Facebook access token not configured. Add FACEBOOK_ACCESS_TOKEN to backend/.env.' };
      }
      analytics = await fetchFacebookAnalytics(content.social_post_id, env.facebookAccessToken);
      break;
    case 'instagram':
      if (!env.instagramAccessToken) {
        return { success: false, error: 'Instagram access token not configured. Add INSTAGRAM_ACCESS_TOKEN to backend/.env.' };
      }
      analytics = await fetchInstagramAnalytics(content.social_post_id, env.instagramAccessToken);
      break;
    case 'youtube':
      if (!env.youtubeClientId) {
        return {
          success: false,
          error: 'YouTube credentials not configured. Add YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN to backend/.env.',
        };
      }
      try {
        analytics = await fetchYouTubeAnalytics(content.social_post_id);
      } catch (youtubeError: unknown) {
        const errorMsg = youtubeError instanceof Error ? youtubeError.message : String(youtubeError);
        return {
          success: false,
          error: `Failed to fetch YouTube analytics: ${errorMsg}. Make sure your OAuth token has 'youtube.readonly' scope and the video ID is correct.`,
        };
      }
      break;
    default:
      return { success: false, error: `Unsupported platform: ${content.platform}` };
  }

  const { error: updateError } = await supabase
    .from('content')
    .update({
      likes_count: analytics.likes,
      comments_count: analytics.comments,
      shares_count: analytics.shares,
      reach_count: analytics.reach,
    })
    .eq('id', contentId);

  if (updateError) {
    logger.error('fetch-analytics', 'Failed to update database with analytics', updateError);
  } else {
    logger.info('fetch-analytics', 'Database updated with analytics', { contentId, analytics });
  }

  return {
    success: true,
    analytics,
    platform: content.platform,
    updated: !updateError,
  };
}
