import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUNCTION_VERSION = "publish-social@2026-01-23-youtube-with-safeguards";

interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
}

// ============================================================================
// RATE LIMITING & SAFEGUARDS CONFIGURATION
// ============================================================================

// Rate limits (conservative - 10-20x below Meta's official limits)
const RATE_LIMITS = {
  facebook: {
    maxPostsPerHourPerUser: 10,        // Meta limit: 200/hour
    maxPostsPerHourApp: 50,             // Meta limit: 4,800/hour
    maxPostsPerDayPerUser: 5,           // Conservative limit
    maxPostsPerDayPerPage: 3,           // Extra safe for Pages
    minMinutesBetweenPosts: 5,          // 5 minutes minimum
  },
  instagram: {
    maxPostsPerHourPerUser: 2,          // Meta limit: 25/hour (much stricter!)
    maxPostsPerHourApp: 20,             // Meta limit: 200/hour
    maxPostsPerDayPerUser: 3,           // Conservative limit
    maxPostsPerDayPerAccount: 2,        // Extra safe for accounts
    minMinutesBetweenPosts: 30,         // 30 minutes minimum (stricter)
  },
  youtube: {
    maxPostsPerHourPerUser: 5,          // YouTube limit: ~50/hour
    maxPostsPerHourApp: 30,             // Conservative
    maxPostsPerDayPerUser: 10,          // Conservative limit
    minMinutesBetweenPosts: 60,        // 1 hour minimum
  },
};

// Helper function to check rate limits
async function checkRateLimits(
  supabase: any,
  userId: string,
  platform: string,
  pageId?: string
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = RATE_LIMITS[platform as keyof typeof RATE_LIMITS];
  if (!limits) return { allowed: true }; // Unknown platform, allow
  
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  try {
    // Check posts in last hour (per user)
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
        reason: `Rate limit exceeded: You have posted ${hourlyUserPosts} times in the last hour. Maximum allowed: ${limits.maxPostsPerHourPerUser} posts per hour. Please wait before posting again.`
      };
    }
    
    // Check posts in last hour (app-wide)
    const { count: hourlyAppPosts } = await supabase
      .from('content')
      .select('*', { count: 'exact', head: true })
      .eq('platform', platform)
      .eq('status', 'published')
      .gte('published_at', oneHourAgo.toISOString());
    
    if (hourlyAppPosts && hourlyAppPosts >= limits.maxPostsPerHourApp) {
      return {
        allowed: false,
        reason: `App-wide rate limit exceeded: ${hourlyAppPosts} posts in the last hour. Maximum allowed: ${limits.maxPostsPerHourApp} posts per hour. Please wait before posting again.`
      };
    }
    
    // Check posts in last day (per user)
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
        reason: `Daily limit exceeded: You have posted ${dailyUserPosts} times today. Maximum allowed: ${limits.maxPostsPerDayPerUser} posts per day. Please try again tomorrow.`
      };
    }
    
    // Check minimum time between posts
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
      const timeSinceLastPost = (now.getTime() - lastPostTime.getTime()) / (1000 * 60); // minutes
      
      if (timeSinceLastPost < limits.minMinutesBetweenPosts) {
        const waitMinutes = Math.ceil(limits.minMinutesBetweenPosts - timeSinceLastPost);
        return {
          allowed: false,
          reason: `Please wait ${waitMinutes} more minute(s) before posting again. Minimum time between posts: ${limits.minMinutesBetweenPosts} minutes.`
        };
      }
    }
    
    // For Facebook/Instagram, check Page/Account specific limits
    if ((platform === 'facebook' || platform === 'instagram') && pageId) {
      const pageLimitKey = platform === 'facebook' ? 'maxPostsPerDayPerPage' : 'maxPostsPerDayPerAccount';
      const pageLimit = limits[pageLimitKey as keyof typeof limits] as number;
      
      if (pageLimit) {
        // This is a simplified check - in production, you'd track by page_id
        // For now, we'll use a conservative approach
        const { count: dailyPagePosts } = await supabase
          .from('content')
          .select('*', { count: 'exact', head: true })
          .eq('platform', platform)
          .eq('status', 'published')
          .gte('published_at', oneDayAgo.toISOString());
        
        if (dailyPagePosts && dailyPagePosts >= pageLimit) {
          return {
            allowed: false,
            reason: `Daily limit exceeded for ${platform}: ${dailyPagePosts} posts today. Maximum allowed: ${pageLimit} posts per day per ${platform === 'facebook' ? 'Page' : 'Account'}. Please try again tomorrow.`
          };
        }
      }
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Error checking rate limits:', error);
    // On error, allow posting but log the issue
    // This prevents blocking legitimate posts due to database issues
    return { allowed: true };
  }
}

// Helper function to get branding settings and append logo/website to description
async function appendBrandingToDescription(
  supabase: any,
  originalDescription: string,
  platform: string
): Promise<string> {
  try {
    // Fetch branding settings
    const { data: brandingSettings, error } = await supabase
      .from('branding_settings')
      .select('company_logo_url, company_website_url')
      .maybeSingle();

    if (error) {
      console.warn('Error fetching branding settings:', error);
      return originalDescription; // Return original if fetch fails
    }

    if (!brandingSettings) {
      console.log('No branding settings found, using original description');
      return originalDescription;
    }

    const logoUrl = brandingSettings.company_logo_url;
    const websiteUrl = brandingSettings.company_website_url;

    // If no logo or website URL, return original description
    if (!logoUrl && !websiteUrl) {
      return originalDescription;
    }

    // Build branding footer based on platform
    let brandingFooter = '';
    
    // Platform-specific formatting
    if (platform === 'youtube') {
      // YouTube supports markdown in descriptions
      brandingFooter = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      if (logoUrl) {
        brandingFooter += `\n![Logo](${logoUrl})\n`;
      }
      if (websiteUrl) {
        brandingFooter += `\n🌐 **Visit our website:** ${websiteUrl}\n`;
      }
      brandingFooter += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    } else if (platform === 'instagram' || platform === 'facebook') {
      // Instagram and Facebook - use emojis and clean formatting
      brandingFooter = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      if (logoUrl) {
        brandingFooter += `\n📸 Logo: ${logoUrl}\n`;
      }
      if (websiteUrl) {
        brandingFooter += `\n🌐 Visit us: ${websiteUrl}\n`;
      }
      brandingFooter += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    } else if (platform === 'twitter') {
      // Twitter - keep it very short due to 280 character limit
      brandingFooter = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      if (websiteUrl) {
        brandingFooter += `🌐 ${websiteUrl}`;
      }
      if (logoUrl && websiteUrl) {
        brandingFooter += ` | 📸 ${logoUrl}`;
      } else if (logoUrl) {
        brandingFooter += `📸 ${logoUrl}`;
      }
      brandingFooter += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    } else {
      // Default format for other platforms (LinkedIn, etc.)
      brandingFooter = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      if (logoUrl) {
        brandingFooter += `\nLogo: ${logoUrl}\n`;
      }
      if (websiteUrl) {
        brandingFooter += `\n🌐 Visit our website: ${websiteUrl}\n`;
      }
      brandingFooter += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    }

    // Append branding to original description
    return originalDescription + brandingFooter;
  } catch (error) {
    console.error('Error appending branding to description:', error);
    return originalDescription; // Return original on error
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
          "YouTube credentials not configured. YouTube uploads require OAuth, not just an API key. Please add YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN to Supabase Secrets.",
      };
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      return { error: `Failed to refresh YouTube access token: ${tokenText}` };
    }

    const tokenJson = JSON.parse(tokenText);
    const accessToken = tokenJson?.access_token as string | undefined;
    if (!accessToken) {
      return { error: "Failed to refresh YouTube access token: missing access_token in response." };
    }

    return { accessToken };
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}

async function publishToYouTube(content: any, supabase: any): Promise<PublishResult> {
  try {
    console.log("Publishing to YouTube...");

    const accessTokenRes = await getYouTubeAccessToken();
    if ("error" in accessTokenRes) {
      return { platform: "youtube", success: false, error: accessTokenRes.error };
    }

    const mediaUrl = content.enhanced_media_url || content.media_url;
    if (!mediaUrl) {
      return { platform: "youtube", success: false, error: "Media URL is required for YouTube uploads" };
    }

    const isVideo =
      content.media_type === "video" ||
      mediaUrl?.includes(".mp4") ||
      mediaUrl?.includes(".mov") ||
      mediaUrl?.includes(".webm");
    if (!isVideo) {
      return { platform: "youtube", success: false, error: "YouTube uploads require a video file (mp4/mov/webm)." };
    }

    // Download the video bytes (YouTube upload requires raw bytes)
    const videoRes = await fetch(mediaUrl);
    if (!videoRes.ok) {
      const t = await videoRes.text().catch(() => "");
      return {
        platform: "youtube",
        success: false,
        error: `Failed to fetch video from media URL (HTTP ${videoRes.status}). Ensure the URL is publicly accessible via HTTPS. ${t}`.trim(),
      };
    }
    const videoBytes = new Uint8Array(await videoRes.arrayBuffer());

    const title = (content.title || "Untitled").toString().slice(0, 100);
    const originalDescription = (content.admin_description || content.title || "").toString();
    const description = await appendBrandingToDescription(supabase, originalDescription, 'youtube');
    const privacyStatus = (Deno.env.get("YOUTUBE_DEFAULT_PRIVACY_STATUS") || "unlisted") as
      | "private"
      | "public"
      | "unlisted";

    // Start resumable upload session
    const initRes = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessTokenRes.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(videoBytes.length),
        "X-Upload-Content-Type": "application/octet-stream",
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
        },
        status: {
          privacyStatus,
        },
      }),
    });

    const initText = await initRes.text().catch(() => "");
    if (!initRes.ok) {
      return {
        platform: "youtube",
        success: false,
        error: `YouTube upload init failed (HTTP ${initRes.status}): ${initText}`,
      };
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) {
      return { platform: "youtube", success: false, error: "YouTube upload init did not return an upload URL (missing Location header)." };
    }

    // Upload bytes
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessTokenRes.accessToken}`,
        "Content-Length": String(videoBytes.length),
        "Content-Type": "application/octet-stream",
      },
      body: videoBytes,
    });

    const uploadText = await uploadRes.text().catch(() => "");
    if (!uploadRes.ok) {
      console.error("❌ YouTube upload failed:", {
        status: uploadRes.status,
        statusText: uploadRes.statusText,
        response: uploadText.substring(0, 500),
      });
      return {
        platform: "youtube",
        success: false,
        error: `YouTube upload failed (HTTP ${uploadRes.status}): ${uploadText.substring(0, 200)}`,
      };
    }

    let uploadJson: any = null;
    try {
      uploadJson = JSON.parse(uploadText);
      console.log("✅ YouTube upload response parsed:", {
        hasId: !!uploadJson?.id,
        id: uploadJson?.id,
        snippet: uploadJson?.snippet?.title || 'No title',
      });
    } catch (parseError) {
      console.error("❌ Failed to parse YouTube upload response:", {
        error: parseError,
        responseText: uploadText.substring(0, 500),
      });
      // Try to extract video ID from response text if it's not JSON
      // Sometimes YouTube returns the ID in a different format
      const idMatch = uploadText.match(/"id"\s*:\s*"([^"]+)"/);
      if (idMatch && idMatch[1]) {
        console.log("✅ Extracted video ID from response text:", idMatch[1]);
        return { platform: "youtube", success: true, postId: idMatch[1] };
      }
      return {
        platform: "youtube",
        success: false,
        error: "YouTube upload succeeded but could not extract video ID from response. Please check your YouTube channel manually.",
      };
    }

    // Extract video ID from response
    // YouTube API can return the ID in different places depending on the response format
    const videoId = uploadJson?.id || 
                   uploadJson?.snippet?.resourceId?.videoId || 
                   uploadJson?.videoId;
    
    if (!videoId) {
      console.error("❌ Video ID not found in YouTube response:", {
        response: uploadJson,
        availableKeys: Object.keys(uploadJson || {}),
      });
      return {
        platform: "youtube",
        success: false,
        error: "YouTube upload succeeded but video ID was not found in the response. Please check your YouTube channel manually.",
      };
    }

    console.log("✅ YouTube video published successfully:", {
      videoId,
      title: uploadJson?.snippet?.title || 'Unknown',
    });

    return { platform: "youtube", success: true, postId: videoId };
  } catch (error: any) {
    console.error("YouTube publish error:", error);
    return { platform: "youtube", success: false, error: error?.message || String(error) };
  }
}

// OAuth 1.0a helper function for Twitter API
async function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): Promise<string> {
  // Sort parameters
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");

  // Create base string
  const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Generate HMAC-SHA1 signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const messageData = encoder.encode(baseString);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  
  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function publishToTwitter(content: any, accessToken: string, accessTokenSecret: string, consumerKey: string, consumerSecret: string, supabase: any): Promise<PublishResult> {
  try {
    // Twitter API v2 implementation with OAuth 1.0a
    console.log("Publishing to Twitter...");
    
    const url = "https://api.twitter.com/2/tweets";
    const method = "POST";
    const originalText = content.admin_description || content.title; // Only use admin_description (admin-written or AI-generated), never user description
    
    // Append branding first
    let tweetText = await appendBrandingToDescription(supabase, originalText, 'twitter');
    
    // Twitter character limit is 280 - truncate if needed
    // Try to preserve branding by truncating the original text part
    if (tweetText.length > 280) {
      // Find where branding starts
      const brandingIndex = tweetText.indexOf('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      if (brandingIndex > 0) {
        const branding = tweetText.substring(brandingIndex);
        const maxMainTextLength = 280 - branding.length - 3; // Leave room for "..."
        const mainText = tweetText.substring(0, brandingIndex);
        tweetText = mainText.substring(0, Math.max(0, maxMainTextLength)) + "..." + branding;
      } else {
        // Fallback: just truncate everything
        tweetText = tweetText.substring(0, 277) + "...";
      }
      console.log("Tweet text truncated to 280 characters");
    }
    
    // Generate OAuth parameters
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: crypto.randomUUID(),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: "1.0",
    };

    // Generate signature (OAuth params only, body params are not included in signature)
    const signature = await generateOAuthSignature(
      method,
      url,
      oauthParams,
      consumerSecret,
      accessTokenSecret
    );
    
    oauthParams["oauth_signature"] = signature;

    // Create Authorization header
    const authHeader = "OAuth " + Object.keys(oauthParams)
      .sort()
      .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
      .join(", ");

    const response = await fetch(url, {
      method: method,
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: tweetText,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.errors?.[0]?.message || errorJson.detail || errorText;
      } catch {
        // Use raw error text if not JSON
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return { platform: 'twitter', success: true, postId: data.data?.id };
  } catch (error: any) {
    console.error("Twitter publish error:", error);
    const errorMsg = error.message || String(error);
    // Provide user-friendly error messages
    if (errorMsg.includes('Unauthorized') || errorMsg.includes('401')) {
      return { platform: 'twitter', success: false, error: "Twitter credentials are invalid. Please verify your API keys in Supabase Secrets." };
    }
    if (errorMsg.includes('Forbidden') || errorMsg.includes('403')) {
      return { platform: 'twitter', success: false, error: "Twitter API access forbidden. Please ensure your app has 'Read and Write' permissions and Elevated access." };
    }
    if (errorMsg.includes('rate limit')) {
      return { platform: 'twitter', success: false, error: "Twitter rate limit exceeded. Please wait and try again later." };
    }
    return { platform: 'twitter', success: false, error: errorMsg };
  }
}

async function publishToFacebook(content: any, accessToken: string, supabase: any, pageId?: string): Promise<PublishResult> {
  try {
    console.log("Publishing to Facebook...");
    
    // Use Page ID if provided, otherwise fallback to /me/ (for user tokens)
    const endpointId = pageId || 'me';
    
    const originalMessage = content.admin_description || content.title; // Only use admin_description (admin-written or AI-generated), never user description
    const message = await appendBrandingToDescription(supabase, originalMessage, 'facebook');
    const mediaUrl = content.enhanced_media_url || content.media_url;
    const isVideo = content.media_type === 'video' || 
                   mediaUrl?.includes('.mp4') || 
                   mediaUrl?.includes('.mov') || 
                   mediaUrl?.includes('.webm');
    
    // Validate media URL is accessible
    if (mediaUrl) {
      try {
        const mediaCheck = await fetch(mediaUrl, { method: 'HEAD' });
        if (!mediaCheck.ok) {
          console.warn(`Media URL not accessible: ${mediaCheck.status}`);
        }
      } catch (mediaError) {
        console.warn("Could not verify media URL accessibility:", mediaError);
      }
    }
    
    // IMPORTANT: For videos, we must upload to the /videos endpoint.
    // Posting a "link" to a video URL via /feed often results in Facebook showing a link preview,
    // and not the actual uploaded video on the page timeline.
    if (mediaUrl && isVideo) {
      try {
        console.log("Uploading video to Facebook /videos endpoint:", {
          endpointId,
          usingEnhancedMediaUrl: !!content.enhanced_media_url,
          mediaUrl: mediaUrl.substring(0, 80),
        });

        // Facebook Graph API expects form-encoded parameters for video upload by URL.
        const body = new URLSearchParams();
        body.set("file_url", mediaUrl);
        body.set("description", message);
        body.set("access_token", accessToken);

        const videoResponse = await fetch(`https://graph.facebook.com/v18.0/${endpointId}/videos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        });

        const videoText = await videoResponse.text();
        if (!videoResponse.ok) {
          console.warn("Facebook /videos upload failed, falling back to /feed:", videoText);
        } else {
          let videoData: any = null;
          try {
            videoData = JSON.parse(videoText);
          } catch {
            // If parsing fails, treat as error so we can fallback
            console.warn("Could not parse /videos response JSON, falling back to /feed:", videoText);
          }

          if (videoData?.id) {
            // For videos, id is the video id. This is enough to consider publishing successful.
            return { platform: "facebook", success: true, postId: videoData.id };
          }
        }
      } catch (videoError) {
        console.warn("Facebook /videos upload error, falling back to /feed:", videoError);
      }
    }

    // For images, use photo upload endpoint (better quality)
    // For videos or no media, use feed endpoint
    if (mediaUrl && !isVideo) {
      try {
        // Try photo upload first (better for images)
        const photoResponse = await fetch(`https://graph.facebook.com/v18.0/${endpointId}/photos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: mediaUrl,
            message,
            access_token: accessToken,
          }),
        });

        if (photoResponse.ok) {
          const photoData = await photoResponse.json();
          // For /photos endpoint, post_id is the actual post ID, id is the photo ID
          // We need the post ID for analytics, so prefer post_id
          const actualPostId = photoData.post_id || photoData.id;
          console.log("📸 Photo uploaded, post ID:", actualPostId, "photo ID:", photoData.id);
          return { platform: 'facebook', success: true, postId: actualPostId };
        } else {
          // Fallback to feed if photo upload fails
          console.log("Photo upload failed, falling back to feed endpoint");
        }
      } catch (photoError) {
        console.log("Photo upload error, falling back to feed endpoint:", photoError);
      }
    }
    
    // Use feed endpoint (works for links, videos, or as fallback)
    const response = await fetch(`https://graph.facebook.com/v18.0/${endpointId}/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
        errorMessage = errorJson.error?.message || errorJson.error?.message || errorText;
        errorCode = errorJson.error?.code || errorJson.error?.error_subcode || null;
      } catch {
        // Use raw error text if not JSON
      }
      
      // Handle rate limit errors specifically
      if (errorCode === 4 || errorCode === 17 || errorCode === 613 || errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
        throw new Error(`RATE_LIMIT_EXCEEDED: ${errorMessage}`);
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return { platform: 'facebook', success: true, postId: data.id };
  } catch (error: any) {
    console.error("Facebook publish error:", error);
    const errorMsg = error.message || String(error);
    
    // Handle rate limit errors
    if (errorMsg.includes('RATE_LIMIT_EXCEEDED') || errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
      return { 
        platform: 'facebook', 
        success: false, 
        error: "Facebook rate limit exceeded. Please wait at least 1 hour before posting again. Our app has safeguards to prevent this, but if you see this error, please contact support." 
      };
    }
    
    // Provide user-friendly error messages
    if (errorMsg.includes('Invalid OAuth')) {
      return { platform: 'facebook', success: false, error: "Facebook access token is invalid or expired. Please update it in Supabase Secrets." };
    }
    if (errorMsg.includes('permission')) {
      return { platform: 'facebook', success: false, error: "Missing Facebook permissions. Please ensure your app has 'pages_manage_posts' permission." };
    }
    return { platform: 'facebook', success: false, error: errorMsg };
  }
}

async function publishToInstagram(content: any, accessToken: string, supabase: any, instagramAccountId?: string): Promise<PublishResult> {
  try {
    console.log("Publishing to Instagram...");
    
    const originalCaption = content.admin_description || content.title; // Only use admin_description (admin-written or AI-generated), never user description
    const caption = await appendBrandingToDescription(supabase, originalCaption, 'instagram');
    const mediaUrl = content.enhanced_media_url || content.media_url;
    
    if (!mediaUrl) {
      return { platform: 'instagram', success: false, error: "Media URL is required for Instagram posts" };
    }
    
    // Validate media URL is accessible
    try {
      const mediaCheck = await fetch(mediaUrl, { method: 'HEAD' });
      if (!mediaCheck.ok) {
        return { platform: 'instagram', success: false, error: `Media URL is not accessible (HTTP ${mediaCheck.status}). Ensure the URL is publicly accessible via HTTPS.` };
      }
    } catch (mediaError) {
      return { platform: 'instagram', success: false, error: "Media URL is not accessible. Ensure the URL is publicly accessible via HTTPS." };
    }
    
    // Determine endpoint - use account ID if provided, otherwise try /me/
    const accountEndpoint = instagramAccountId ? instagramAccountId : 'me';
    
    // Instagram Graph API - Create media container
    const containerResponse = await fetch(`https://graph.facebook.com/v18.0/${accountEndpoint}/media`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: mediaUrl,
        caption,
        access_token: accessToken,
      }),
    });

    if (!containerResponse.ok) {
      const errorText = await containerResponse.text();
      let errorMessage = errorText;
      let errorCode: number | null = null;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.error?.message || errorText;
        errorCode = errorJson.error?.code || errorJson.error?.error_subcode || null;
        
        // Log full error details for debugging
        console.error("Instagram API error (create container):", {
          status: containerResponse.status,
          statusText: containerResponse.statusText,
          error: errorJson.error,
          fullResponse: errorText,
          accountEndpoint,
          hasAccountId: !!instagramAccountId
        });
        
        // Handle rate limit errors
        if (errorCode === 4 || errorCode === 17 || errorCode === 613 || errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
          throw new Error(`RATE_LIMIT_EXCEEDED: ${errorMessage}`);
        }
        
        // If /me/ fails with invalid user, suggest using account ID
        if (errorMessage.includes('Invalid user') && accountEndpoint === 'me') {
          errorMessage += " Try setting INSTAGRAM_ACCOUNT_ID in Supabase Secrets with your Instagram Business Account ID.";
        }
      } catch (e: any) {
        // If we already threw RATE_LIMIT_EXCEEDED, re-throw it
        if (e.message?.includes('RATE_LIMIT_EXCEEDED')) {
          throw e;
        }
        // Use raw error text if not JSON
        console.error("Instagram API error (create container) - non-JSON:", {
          status: containerResponse.status,
          statusText: containerResponse.statusText,
          errorText
        });
      }
      throw new Error(errorMessage);
    }

    const containerData = await containerResponse.json();
    
    if (!containerData.id) {
      throw new Error("Failed to create media container. Instagram API did not return container ID.");
    }
    
    // Publish the container
    const publishResponse = await fetch(`https://graph.facebook.com/v18.0/${accountEndpoint}/media_publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
        errorMessage = errorJson.error?.message || errorJson.error?.message || errorText;
        
        // Log full error details for debugging
        console.error("Instagram API error (publish):", {
          status: publishResponse.status,
          statusText: publishResponse.statusText,
          error: errorJson.error,
          fullResponse: errorText,
          containerId: containerData.id
        });
      } catch {
        // Use raw error text if not JSON
        console.error("Instagram API error (publish) - non-JSON:", {
          status: publishResponse.status,
          statusText: publishResponse.statusText,
          errorText
        });
      }
      throw new Error(errorMessage);
    }

    const publishData = await publishResponse.json();
    return { platform: 'instagram', success: true, postId: publishData.id };
  } catch (error: any) {
    console.error("Instagram publish error:", error);
    console.error("Instagram publish error details:", {
      message: error.message,
      stack: error.stack,
      accountEndpoint: instagramAccountId || 'me',
      hasAccountId: !!instagramAccountId
    });
    const errorMsg = error.message || String(error);
    
    // Handle rate limit errors
    if (errorMsg.includes('RATE_LIMIT_EXCEEDED') || errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
      return { 
        platform: 'instagram', 
        success: false, 
        error: "Instagram rate limit exceeded. Please wait at least 1 hour before posting again. Our app has safeguards to prevent this, but if you see this error, please contact support." 
      };
    }
    
    // Provide user-friendly error messages
    if (errorMsg.includes('Invalid OAuth') || errorMsg.includes('(#200)')) {
      return { platform: 'instagram', success: false, error: "Instagram access token is invalid or expired. Please update it in Supabase Secrets." };
    }
    if (errorMsg.includes('permission') || errorMsg.includes('(#10)')) {
      return { platform: 'instagram', success: false, error: `Missing Instagram permissions. Error: ${errorMsg}. Please ensure your Instagram Business account is connected to your Facebook Page and your Facebook App has Instagram Product enabled.` };
    }
    if (errorMsg.includes('Invalid user') || errorMsg.includes('(#100)')) {
      return { platform: 'instagram', success: false, error: "Invalid Instagram account. Set INSTAGRAM_ACCOUNT_ID in Supabase Secrets with your Instagram Business Account ID." };
    }
    // Return the actual error message so user can see what's wrong
    return { platform: 'instagram', success: false, error: errorMsg };
  }
}

async function publishToLinkedIn(content: any, accessToken: string, supabase: any): Promise<PublishResult> {
  try {
    console.log("Publishing to LinkedIn...");
    
    const originalMessage = content.admin_description || content.title; // Only use admin_description (admin-written or AI-generated), never user description
    const message = await appendBrandingToDescription(supabase, originalMessage, 'linkedin');
    const mediaUrl = content.enhanced_media_url || content.media_url;
    
    // Get user URN first - try v2/userinfo first, fallback to v2/me
    let profile;
    let authorUrn: string;
    
    try {
      const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (profileResponse.ok) {
        profile = await profileResponse.json();
        authorUrn = `urn:li:person:${profile.sub}`;
      } else {
        // Fallback to v2/me endpoint
        const meResponse = await fetch("https://api.linkedin.com/v2/me", {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        });
        
        if (!meResponse.ok) {
          throw new Error("Failed to get LinkedIn profile");
        }
        
        profile = await meResponse.json();
        authorUrn = `urn:li:person:${profile.id}`;
      }
    } catch (profileError) {
      throw new Error("Failed to get LinkedIn profile. Please verify your access token.");
    }
    
    // Build post content
    // LinkedIn media requires uploading media first or using specific URNs
    // For simplicity, we'll post text with media URL in commentary if available
    const postContent: any = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: mediaUrl ? `${message}\n\n${mediaUrl}` : message
          },
          shareMediaCategory: "NONE" // LinkedIn requires media upload API for images, so we include URL in text
        }
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
      }
    };
    
    // Create post
    const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(postContent),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorText;
      } catch {
        // Use raw error text if not JSON
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return { platform: 'linkedin', success: true, postId: data.id };
  } catch (error: any) {
    console.error("LinkedIn publish error:", error);
    const errorMsg = error.message || String(error);
    // Provide user-friendly error messages
    if (errorMsg.includes('Invalid access token') || errorMsg.includes('401')) {
      return { platform: 'linkedin', success: false, error: "LinkedIn access token is invalid or expired. Please update it in Supabase Secrets." };
    }
    if (errorMsg.includes('permission') || errorMsg.includes('insufficient')) {
      return { platform: 'linkedin', success: false, error: "Missing LinkedIn permissions. Please ensure your app has 'w_member_social' scope." };
    }
    return { platform: 'linkedin', success: false, error: errorMsg };
  }
}

serve(async (req) => {
  // Log immediately when handler is called - this should ALWAYS appear
  try {
    console.log('🔵 Handler called - function is receiving request');
    console.log('🔵 Method:', req.method);
    console.log('🔵 URL:', req.url);
  } catch (logError) {
    // Even if logging fails, continue
  }
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('🔵 CORS preflight, returning early');
    return new Response(null, { headers: corsHeaders });
  }

  // Wrap everything in a try-catch to ensure we always return a valid response
  try {
    console.log(`📥 Processing ${req.method} request`);
    
    // Check if request has a body
    const contentType = req.headers.get('content-type');
    console.log('📥 Content-Type:', contentType);
    
    // Parse request body with better error handling
    let requestBody;
    try {
      // Check if body exists
      const bodyText = await req.text();
      console.log('📥 Request body text length:', bodyText.length);
      
      if (!bodyText || bodyText.trim() === '') {
        console.error("Empty request body");
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Request body is empty. Expected JSON with contentId." 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      requestBody = JSON.parse(bodyText);
      console.log('📥 Parsed request body:', { contentId: requestBody?.contentId, platform: requestBody?.platform });
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid request body: ${parseError instanceof Error ? parseError.message : 'Unknown error'}` 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { contentId, platform } = requestBody;

    // Validate contentId
    if (!contentId) {
      console.error("Missing contentId in request");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "contentId is required" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📤 Publishing request received: contentId=${contentId}, platform=${platform || 'auto'}`);

    // Get Supabase credentials (these should be auto-provided by Supabase)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase credentials");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Server configuration error: Missing Supabase credentials" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch content
    console.log(`🔍 Fetching content with ID: ${contentId}`);
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (contentError) {
      console.error("Error fetching content:", contentError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Content not found: ${contentError.message}` 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!content) {
      console.error("Content not found for ID:", contentId);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Content not found" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Content found: title="${content.title}", platform="${content.platform}", status="${content.status}"`);

    // Validate that admin_description exists (required for publishing)
    // admin_description can be manually written by admin or AI-generated (both are considered admin-written)
    if (!content.admin_description || !content.admin_description.trim()) {
      console.warn(`⚠️ Content ${contentId} missing admin_description`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Admin description (post caption) is required. Please edit the content and add a caption before publishing. You can write it manually or use 'Generate with AI'." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminDescPreview = content.admin_description ? content.admin_description.substring(0, 50) : 'N/A';
    console.log(`📝 Content has admin_description: "${adminDescPreview}..."`);

    const targetPlatform = platform || content.platform || 'instagram';
    
    // ============================================================================
    // RATE LIMITING & SAFEGUARDS CHECKS
    // ============================================================================
    
    // Check rate limits
    const rateLimitCheck = await checkRateLimits(
      supabase,
      content.user_id,
      targetPlatform,
      targetPlatform === 'facebook' ? Deno.env.get("FACEBOOK_PAGE_ID") : undefined
    );
    
    if (!rateLimitCheck.allowed) {
      console.warn(`🚫 Rate limit check failed: ${rateLimitCheck.reason}`);
      return new Response(
        JSON.stringify({
          success: false,
          platform: targetPlatform,
          error: rateLimitCheck.reason || 'Rate limit exceeded. Please wait before posting again.'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`✅ Rate limit checks passed for platform: ${targetPlatform}`);
    
    let result: PublishResult = {
      platform: targetPlatform,
      success: false,
      error: 'Unknown error occurred'
    };

    // Get API keys from environment (Supabase Secrets)
    const twitterConsumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
    const twitterConsumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const twitterAccessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const twitterAccessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
    const facebookAccessToken = Deno.env.get("FACEBOOK_ACCESS_TOKEN");
    const facebookPageId = Deno.env.get("FACEBOOK_PAGE_ID");
    const instagramAccessToken = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
    const instagramAccountId = Deno.env.get("INSTAGRAM_ACCOUNT_ID"); // Optional: Instagram Business Account ID
    const linkedinAccessToken = Deno.env.get("LINKEDIN_ACCESS_TOKEN");

    switch (targetPlatform) {
      case 'twitter':
        // Explicitly disabled to prevent publishing to Twitter from this workspace
        result = {
          platform: 'twitter',
          success: false,
          error: "Publishing to Twitter is disabled for this workspace.",
        };
        break;
      case 'facebook':
        if (!facebookAccessToken) {
          result = { platform: 'facebook', success: false, error: "Facebook API key not configured. Please add FACEBOOK_ACCESS_TOKEN to Supabase Secrets." };
        } else {
          result = await publishToFacebook(content, facebookAccessToken, supabase, facebookPageId);
        }
        break;
      case 'instagram':
        if (!instagramAccessToken) {
          result = { platform: 'instagram', success: false, error: "Instagram API key not configured. Please add INSTAGRAM_ACCESS_TOKEN to Supabase Secrets." };
        } else {
          result = await publishToInstagram(content, instagramAccessToken, supabase, instagramAccountId);
        }
        break;
      case 'linkedin':
        // Explicitly disabled to prevent publishing to LinkedIn from this workspace
        result = {
          platform: 'linkedin',
          success: false,
          error: "Publishing to LinkedIn is disabled for this workspace.",
        };
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

    // Ensure result has required fields
    if (!result) {
      console.error("❌ Result is undefined!");
      result = { 
        platform: targetPlatform || 'unknown', 
        success: false, 
        error: "Publishing function returned undefined result" 
      };
    }

    // Update content with result
    if (result.success) {
      console.log(`✅ Publishing successful! Post ID: ${result.postId}`);
      
      try {
        const { error: updateError } = await supabase
          .from('content')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            social_post_id: result.postId,
          })
          .eq('id', contentId);

        if (updateError) {
          console.error("Error updating content status:", updateError);
          // Still return success since publishing worked, just DB update failed
          result.error = `Published successfully but failed to update database: ${updateError.message}`;
        } else {
          console.log(`✅ Database updated successfully for content ${contentId}`);
        }
      } catch (dbError) {
        console.error("Exception updating database:", dbError);
        result.error = `Published successfully but failed to update database: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`;
      }
    } else {
      console.error(`❌ Publishing failed: ${result.error || 'Unknown error'}`);
    }

    // Ensure result is valid before returning
    const finalResult: PublishResult = {
      platform: result?.platform || targetPlatform || 'unknown',
      success: result?.success || false,
      postId: result?.postId,
      error: result?.error
    };

    console.log('📤 Returning result:', { 
      version: FUNCTION_VERSION,
      platform: finalResult.platform, 
      success: finalResult.success, 
      hasPostId: !!finalResult.postId,
      hasError: !!finalResult.error 
    });

    // Always return 200 with the result (success or failure is in the JSON)
    try {
      const responseBody = JSON.stringify({ ...finalResult, version: FUNCTION_VERSION });
      return new Response(
        responseBody,
        { 
          status: 200, // Always return 200, success/failure is in the JSON
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    } catch (jsonError) {
      console.error("Error stringifying response:", jsonError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to format response",
          platform: targetPlatform || 'unknown'
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
  } catch (error: unknown) {
    // Log the full error for debugging
    console.error("❌ Unhandled error in publish-social function:", error);
    console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    
    const message = error instanceof Error ? error.message : String(error) || "An unexpected error occurred";
    
    // Always return 200 with error in JSON body
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: message,
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
