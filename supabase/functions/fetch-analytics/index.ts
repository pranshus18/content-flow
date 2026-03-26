import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsData {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
}

async function fetchTwitterAnalytics(postId: string, accessToken: string): Promise<AnalyticsData> {
  try {
    const response = await fetch(`https://api.twitter.com/2/tweets/${postId}?tweet.fields=public_metrics`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) throw new Error("Failed to fetch Twitter analytics");

    const data = await response.json();
    const metrics = data.data?.public_metrics;
    
    return {
      likes: metrics?.like_count || 0,
      comments: metrics?.reply_count || 0,
      shares: metrics?.retweet_count || 0,
      reach: metrics?.impression_count || 0,
    };
  } catch (error) {
    console.error("Twitter analytics error:", error);
    return { likes: 0, comments: 0, shares: 0, reach: 0 };
  }
}

async function fetchFacebookAnalytics(postId: string, accessToken: string): Promise<AnalyticsData> {
  try {
    console.log("📊 Fetching Facebook analytics for post:", {
      postId,
      tokenPresent: !!accessToken,
    });

    if (!accessToken) {
      throw new Error("FACEBOOK_ACCESS_TOKEN is not configured in Supabase Secrets");
    }

    // Facebook post IDs can be in different formats:
    // - {page_id}_{post_id} (from /feed endpoint)
    // - {post_id} (from /photos endpoint, using post_id field)
    // - {photo_id} (from /photos endpoint, using id field - this is the photo, not the post)
    
    // First, get reactions/likes, comments, and shares
    // Use reactions.summary for Pages (includes all reaction types)
    const metricsFields = "reactions.summary(true).limit(0),likes.summary(true).limit(0),comments.summary(true),shares";
    
    // Try the post ID as-is first
    let response = await fetch(
      `https://graph.facebook.com/v18.0/${postId}?fields=${encodeURIComponent(
        metricsFields,
      )}&access_token=${encodeURIComponent(accessToken)}`,
    );

    let data = await response.json();

    // If that fails, try alternative formats
    if (!response.ok) {
      console.warn("⚠️ First attempt failed, trying alternative post ID formats:", {
        originalPostId: postId,
        error: data?.error?.message,
      });
      
      // Try 1: If post ID is in format {page_id}_{post_id}, try just the post ID part
      const postIdMatch = postId.match(/_(\d+)$/);
      if (postIdMatch) {
        const altPostId = postIdMatch[1];
        console.log("🔄 Trying alternative format 1 (extracted post ID):", altPostId);
        response = await fetch(
          `https://graph.facebook.com/v18.0/${altPostId}?fields=${encodeURIComponent(
            metricsFields,
          )}&access_token=${encodeURIComponent(accessToken)}`,
        );
        data = await response.json();
        
        if (response.ok) {
          console.log("✅ Alternative format 1 worked!");
        }
      }
      
      // Try 2: If still failing, try getting the post from the photo
      // Sometimes when using /photos endpoint, we get photo_id but need to get the post_id
      if (!response.ok && !postId.includes('_')) {
        console.log("🔄 Trying to get post from photo ID...");
        // First get the photo object to find the post_id
        const photoResponse = await fetch(
          `https://graph.facebook.com/v18.0/${postId}?fields=id&access_token=${encodeURIComponent(accessToken)}`,
        );
        const photoData = await photoResponse.json();
        
        if (photoResponse.ok && photoData.id) {
          // Try to get the post that contains this photo
          // This is a workaround - we'll use the photo ID directly with different fields
          response = await fetch(
            `https://graph.facebook.com/v18.0/${postId}?fields=${encodeURIComponent(
              metricsFields,
            )}&access_token=${encodeURIComponent(accessToken)}`,
          );
          data = await response.json();
        }
      }
    }

    if (!response.ok) {
      console.error("❌ Facebook analytics HTTP error (all attempts failed):", {
        status: response.status,
        statusText: response.statusText,
        body: data,
        postId,
        triedFormats: ['original', 'extracted_post_id', 'photo_lookup'],
      });
      throw new Error(data?.error?.message || `Facebook analytics HTTP ${response.status}`);
    }

    // Facebook may return reactions instead of likes for Pages
    // reactions.summary.total_count includes all reaction types (like, love, wow, etc.)
    const likes =
      data?.reactions?.summary?.total_count ??
      data?.likes?.summary?.total_count ??
      data?.likes?.data?.length ?? // Fallback for some API versions
      0;
    const comments = data?.comments?.summary?.total_count ?? data?.comments?.data?.length ?? 0;
    const shares = data?.shares?.count ?? 0;

    // Try to get reach via insights (may require additional permissions)
    let reach = 0;
    try {
      const insightsResp = await fetch(
        `https://graph.facebook.com/v18.0/${postId}/insights?metric=post_impressions_unique&access_token=${encodeURIComponent(
          accessToken,
        )}`,
      );
      const insightsData = await insightsResp.json();
      if (!insightsResp.ok) {
        console.warn("⚠️ Facebook reach insights error (non-fatal):", {
          status: insightsResp.status,
          statusText: insightsResp.statusText,
          body: insightsData,
        });
      } else {
        const val = insightsData?.data?.[0]?.values?.[0]?.value;
        if (typeof val === "number") {
          reach = val;
        }
      }
    } catch (insightsError) {
      console.warn("⚠️ Facebook reach insights fetch failed (non-fatal):", insightsError);
    }

    console.log("📈 Facebook analytics parsed:", {
      postId,
      likes,
      comments,
      shares,
      reach,
      rawData: {
        reactions: data?.reactions,
        likes: data?.likes,
        comments: data?.comments,
        shares: data?.shares,
      },
    });

    return {
      likes,
      comments,
      shares,
      reach,
    };
  } catch (error) {
    console.error("❌ Facebook analytics error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Full error details:", {
      postId,
      error: errorMessage,
    });
    return { likes: 0, comments: 0, shares: 0, reach: 0 };
  }
}

async function fetchInstagramAnalytics(postId: string, accessToken: string): Promise<AnalyticsData> {
  try {
    console.log("📊 Fetching Instagram analytics for post:", {
      postId,
      tokenPresent: !!accessToken,
    });

    if (!accessToken) {
      throw new Error("INSTAGRAM_ACCESS_TOKEN is not configured in Supabase Secrets");
    }

    // Instagram Graph API - fetch media metrics
    // For Instagram Business accounts, use these fields
    const fields = "like_count,comments_count";
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${postId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}`,
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Instagram analytics HTTP error:", {
        status: response.status,
        statusText: response.statusText,
        body: data,
      });
      throw new Error(data?.error?.message || `Instagram analytics HTTP ${response.status}`);
    }

    const likes = data?.like_count || 0;
    const comments = data?.comments_count || 0;

    // Get insights for reach (requires insights permission)
    let reach = 0;
    try {
      const insightsResponse = await fetch(
        `https://graph.facebook.com/v18.0/${postId}/insights?metric=reach&access_token=${encodeURIComponent(accessToken)}`,
      );
      const insightsData = await insightsResponse.json();
      
      if (!insightsResponse.ok) {
        console.warn("⚠️ Instagram reach insights error (non-fatal):", {
          status: insightsResponse.status,
          statusText: insightsResponse.statusText,
          body: insightsData,
        });
      } else {
        const val = insightsData?.data?.[0]?.values?.[0]?.value;
        if (typeof val === "number") {
          reach = val;
        }
      }
    } catch (insightsError) {
      console.warn("⚠️ Instagram reach insights fetch failed (non-fatal):", insightsError);
    }

    console.log("📈 Instagram analytics parsed:", {
      postId,
      likes,
      comments,
      shares: 0,
      reach,
    });

    return {
      likes,
      comments,
      shares: 0, // Instagram doesn't expose shares
      reach,
    };
  } catch (error) {
    console.error("❌ Instagram analytics error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Full error details:", {
      postId,
      error: errorMessage,
    });
    return { likes: 0, comments: 0, shares: 0, reach: 0 };
  }
}

async function fetchLinkedInAnalytics(postId: string, accessToken: string): Promise<AnalyticsData> {
  try {
    const response = await fetch(`https://api.linkedin.com/v2/socialActions/${postId}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) throw new Error("Failed to fetch LinkedIn analytics");

    const data = await response.json();
    
    return {
      likes: data.likesSummary?.totalLikes || 0,
      comments: data.commentsSummary?.totalFirstLevelComments || 0,
      shares: 0,
      reach: 0,
    };
  } catch (error) {
    console.error("LinkedIn analytics error:", error);
    return { likes: 0, comments: 0, shares: 0, reach: 0 };
  }
}

async function getYouTubeAccessToken(): Promise<{ accessToken: string } | { error: string }> {
  try {
    const clientId = Deno.env.get("YOUTUBE_CLIENT_ID");
    const clientSecret = Deno.env.get("YOUTUBE_CLIENT_SECRET");
    const refreshToken = Deno.env.get("YOUTUBE_REFRESH_TOKEN");

    if (!clientId || !clientSecret || !refreshToken) {
      return {
        error:
          "YouTube credentials not configured. Please add YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN to Supabase Secrets.",
      };
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenText = await tokenResponse.text();
    if (!tokenResponse.ok) {
      return { error: `Failed to refresh YouTube access token: ${tokenText}` };
    }

    const tokenData = JSON.parse(tokenText);
    if (!tokenData.access_token) {
      return { error: "Failed to refresh YouTube access token: missing access_token in response." };
    }

    return { accessToken: tokenData.access_token };
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}

async function fetchYouTubeAnalytics(videoId: string): Promise<AnalyticsData> {
  try {
    console.log("📊 Fetching YouTube analytics for video:", {
      videoId,
      videoIdType: typeof videoId,
      videoIdLength: videoId?.length,
    });

    // Validate video ID
    if (!videoId || videoId.trim() === '') {
      console.error("❌ YouTube video ID is empty or invalid");
      throw new Error("YouTube video ID is required");
    }

    // Clean video ID (remove any extra whitespace or characters)
    const cleanVideoId = videoId.trim();

    const accessTokenRes = await getYouTubeAccessToken();
    if ("error" in accessTokenRes) {
      console.error("❌ YouTube access token error:", accessTokenRes.error);
      throw new Error(accessTokenRes.error);
    }

    // YouTube Data API v3 - get video statistics
    // IMPORTANT: Use Authorization header, not query parameter
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(cleanVideoId)}&part=statistics,snippet`;
    
    console.log("📡 Making YouTube API request:", {
      url: apiUrl.replace(cleanVideoId, '[VIDEO_ID]'), // Don't log full URL with ID
      hasAccessToken: !!accessTokenRes.accessToken,
    });

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessTokenRes.accessToken}`,
        "Accept": "application/json",
      },
    });

    const responseText = await response.text();
    let data: any;
    
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ Failed to parse YouTube API response:", {
        status: response.status,
        statusText: response.statusText,
        responseText: responseText.substring(0, 500), // First 500 chars
      });
      throw new Error(`Invalid response from YouTube API: ${response.status} ${response.statusText}`);
    }

    if (!response.ok) {
      console.error("❌ YouTube analytics HTTP error:", {
        status: response.status,
        statusText: response.statusText,
        error: data?.error,
        fullResponse: data,
      });
      
      // Provide helpful error messages
      if (response.status === 401 || response.status === 403) {
        // Check if it's a scope issue
        const errorReason = data?.error?.message || '';
        if (errorReason.includes('scope') || errorReason.includes('permission') || errorReason.includes('insufficient')) {
          throw new Error("Your OAuth token is missing the 'youtube.readonly' scope. Your token works for uploading videos, but you need to add the 'readonly' scope to fetch analytics. Go to https://myaccount.google.com/permissions, revoke access, then re-authorize with BOTH scopes: youtube.upload AND youtube.readonly. See PERMANENT_TOKENS_BABY_STEPS.md Step 4 for the correct URL.");
        }
        throw new Error("YouTube access token is invalid or expired. Please check your YOUTUBE_REFRESH_TOKEN in Supabase Secrets.");
      }
      if (response.status === 404) {
        throw new Error(`YouTube video not found. Video ID: ${cleanVideoId}. Make sure the video exists and is accessible.`);
      }
      if (data?.error?.message) {
        throw new Error(`YouTube API error: ${data.error.message}`);
      }
      throw new Error(`YouTube analytics HTTP ${response.status}: ${response.statusText}`);
    }

    if (!data.items || data.items.length === 0) {
      console.error("❌ YouTube API returned no items:", {
        videoId: cleanVideoId,
        response: data,
      });
      throw new Error(`Video not found or access denied. Video ID: ${cleanVideoId}. Make sure the video exists and your OAuth token has access to it.`);
    }

    const video = data.items[0];
    const statistics = video?.statistics || {};
    
    // Parse statistics (handle string numbers from API)
    const likes = parseInt(statistics.likeCount || "0", 10);
    const comments = parseInt(statistics.commentCount || "0", 10);
    const views = parseInt(statistics.viewCount || "0", 10);

    // YouTube doesn't have shares in the same way, but we can use view count as a proxy for reach
    // For YouTube, "reach" is better represented by views
    const reach = views;

    console.log("📈 YouTube analytics parsed successfully:", {
      videoId: cleanVideoId,
      videoTitle: video?.snippet?.title || 'Unknown',
      likes,
      comments,
      views,
      reach,
      statistics,
    });

    return {
      likes,
      comments,
      shares: 0, // YouTube doesn't expose share count via API
      reach,
    };
  } catch (error) {
    console.error("❌ YouTube analytics error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Full error details:", {
      videoId,
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });
    // Re-throw the error so the main function can return a proper error message
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let contentId: string;
    try {
      const body = await req.json();
      contentId = body.contentId;
      if (!contentId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "contentId is required" 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid request body. Expected JSON with contentId field." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch content
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Content not found" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!content.social_post_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Content not published to social media yet" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let analytics: AnalyticsData = { likes: 0, comments: 0, shares: 0, reach: 0 };

    // Get API keys from environment
    const twitterAccessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const facebookAccessToken = Deno.env.get("FACEBOOK_ACCESS_TOKEN");
    const instagramAccessToken = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
    const linkedinAccessToken = Deno.env.get("LINKEDIN_ACCESS_TOKEN");
    const youtubeClientId = Deno.env.get("YOUTUBE_CLIENT_ID");

    console.log("🔍 Fetching analytics for content:", {
      contentId,
      platform: content.platform,
      socialPostId: content.social_post_id,
      hasTokens: {
        twitter: !!twitterAccessToken,
        facebook: !!facebookAccessToken,
        instagram: !!instagramAccessToken,
        linkedin: !!linkedinAccessToken,
        youtube: !!youtubeClientId,
      },
    });

    try {
      switch (content.platform) {
        case 'twitter':
          // Explicitly disabled to prevent fetching analytics from Twitter for this workspace
          console.warn("⚠️ Twitter analytics disabled for this workspace");
          return new Response(
            JSON.stringify({
              success: false,
              error: "Fetching Twitter analytics is disabled for this workspace.",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        case 'facebook':
          if (facebookAccessToken) {
            analytics = await fetchFacebookAnalytics(content.social_post_id, facebookAccessToken);
          } else {
            console.warn("⚠️ Facebook access token not configured");
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "Facebook access token not configured. Please add FACEBOOK_ACCESS_TOKEN to Supabase Secrets." 
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          break;
        case 'instagram':
          if (instagramAccessToken) {
            analytics = await fetchInstagramAnalytics(content.social_post_id, instagramAccessToken);
          } else {
            console.warn("⚠️ Instagram access token not configured");
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "Instagram access token not configured. Please add INSTAGRAM_ACCESS_TOKEN to Supabase Secrets." 
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          break;
        case 'linkedin':
          // Explicitly disabled to prevent fetching analytics from LinkedIn for this workspace
          console.warn("⚠️ LinkedIn analytics disabled for this workspace");
          return new Response(
            JSON.stringify({
              success: false,
              error: "Fetching LinkedIn analytics is disabled for this workspace.",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        case 'youtube':
          if (!youtubeClientId) {
            console.warn("⚠️ YouTube credentials not configured");
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "YouTube credentials not configured. Please add YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN to Supabase Secrets." 
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          // Validate that we have a video ID
          if (!content.social_post_id) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "YouTube video ID not found. The video may not have been published successfully, or the video ID was not saved." 
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          console.log("📹 Fetching YouTube analytics for video ID:", content.social_post_id);
          try {
            analytics = await fetchYouTubeAnalytics(content.social_post_id);
            
            // Log the results
            console.log("📊 YouTube analytics fetched successfully:", {
              videoId: content.social_post_id,
              likes: analytics.likes,
              comments: analytics.comments,
              views: analytics.reach,
            });
            
            // Note: Even if all zeros, that's valid (video might be new with no engagement yet)
          } catch (youtubeError: unknown) {
            const errorMsg = youtubeError instanceof Error ? youtubeError.message : String(youtubeError);
            console.error("❌ YouTube analytics fetch failed:", errorMsg);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: `Failed to fetch YouTube analytics: ${errorMsg}. Make sure your OAuth token has 'youtube.readonly' scope and the video ID is correct.` 
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          break;
        default:
          console.warn(`⚠️ Unknown platform: ${content.platform}`);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Unsupported platform: ${content.platform}` 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
      }
    } catch (platformError: unknown) {
      console.error("❌ Error fetching platform analytics:", platformError);
      const errorMessage = platformError instanceof Error ? platformError.message : String(platformError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to fetch ${content.platform} analytics: ${errorMessage}` 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Analytics fetched:", {
      platform: content.platform,
      analytics,
      contentId,
      socialPostId: content.social_post_id,
    });

    // Update content with analytics
    const { data: updateData, error: updateError } = await supabase
      .from('content')
      .update({
        likes_count: analytics.likes,
        comments_count: analytics.comments,
        shares_count: analytics.shares,
        reach_count: analytics.reach,
      })
      .eq('id', contentId)
      .select(); // Select to verify update

    if (updateError) {
      console.error("❌ Failed to update database with analytics:", {
        error: updateError,
        contentId,
        analytics,
      });
      // Still return success with analytics, but log the error
      // The frontend can still update its state
    } else {
      console.log("✅ Database updated successfully with analytics:", {
        contentId,
        updatedRows: updateData?.length || 0,
        savedAnalytics: {
          likes: analytics.likes,
          comments: analytics.comments,
          shares: analytics.shares,
          reach: analytics.reach,
        },
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        analytics,
        platform: content.platform,
        updated: !updateError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("❌ Unhandled error in fetch-analytics function:", error);
    console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    
    // Always return 200 with error in JSON body (like publish-social does)
    // This prevents "non-2xx status code" errors in the frontend
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: message,
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
