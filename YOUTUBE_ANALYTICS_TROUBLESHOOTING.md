# 🔧 YouTube Analytics Troubleshooting Guide

If YouTube analytics (views, likes, comments) are not showing up in your platform, follow these steps:

---

## ✅ Quick Checklist

- [ ] Video was published successfully (check `social_post_id` in database)
- [ ] Video ID is stored correctly (should be a string like `abc123xyz`)
- [ ] YouTube credentials are configured in Supabase Secrets
- [ ] OAuth scopes include `youtube.readonly` (required for analytics)
- [ ] Video exists on your YouTube channel
- [ ] Video is accessible (not private or deleted)

---

## 🔍 Step 1: Verify Video ID is Stored

1. Go to your **Supabase Dashboard**
2. Go to **Table Editor** → **content** table
3. Find your published YouTube video
4. Check the **`social_post_id`** field
5. It should contain a YouTube video ID (like `dQw4w9WgXcQ`)

**If `social_post_id` is empty or null:**
- The video upload may have failed
- Re-publish the video
- Check Supabase Edge Functions → `publish-social` → Logs for errors

---

## 🔍 Step 2: Check YouTube Credentials

1. Go to **Supabase Dashboard** → **Settings** → **Edge Functions** → **Secrets**
2. Verify these secrets exist:
   - ✅ `YOUTUBE_CLIENT_ID`
   - ✅ `YOUTUBE_CLIENT_SECRET`
   - ✅ `YOUTUBE_REFRESH_TOKEN`

**If any are missing:**
- Follow the YouTube setup guide in `PERMANENT_TOKENS_BABY_STEPS.md`

---

## 🔍 Step 3: Verify OAuth Scopes

**CRITICAL**: Your OAuth token must have the `youtube.readonly` scope to read analytics!

### Check Your Current Scopes:

1. Go to: **https://myaccount.google.com/permissions**
2. Find your app (ContentFlow or whatever you named it)
3. Check if it has **"View your YouTube account"** permission

**If it doesn't have this permission:**

1. Go back to **Step 4** in `PERMANENT_TOKENS_BABY_STEPS.md`
2. Use this URL (with BOTH scopes):
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/oauth/callback&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload%20https://www.googleapis.com/auth/youtube.readonly&access_type=offline&prompt=consent
   ```
3. Re-authorize and get a new refresh token
4. Update `YOUTUBE_REFRESH_TOKEN` in Supabase Secrets

---

## 🔍 Step 4: Test the API Call Manually

You can test if the YouTube API is working by making a manual request:

1. Get a fresh access token using your refresh token (see `getYouTubeAccessToken` function)
2. Make a test API call:
   ```
   GET https://www.googleapis.com/youtube/v3/videos?id=YOUR_VIDEO_ID&part=statistics
   Authorization: Bearer YOUR_ACCESS_TOKEN
   ```
3. Check the response - you should see `viewCount`, `likeCount`, `commentCount`

**If you get an error:**
- **401/403**: Token doesn't have `youtube.readonly` scope → Re-authorize with correct scopes
- **404**: Video ID is wrong or video doesn't exist → Check the video ID
- **400**: Invalid request → Check the video ID format

---

## 🔍 Step 5: Check Supabase Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **fetch-analytics** → **Logs**
2. Look for errors when fetching YouTube analytics
3. Common errors:
   - `"Video not found"` → Video ID is wrong or video was deleted
   - `"Access denied"` → Token doesn't have `youtube.readonly` scope
   - `"Invalid token"` → Refresh token is invalid or expired

---

## 🔍 Step 6: Verify Video Exists

1. Go to your **YouTube channel**
2. Find the video that was published
3. Check if it has views/likes/comments
4. Copy the video ID from the URL (e.g., `youtube.com/watch?v=VIDEO_ID`)
5. Compare with `social_post_id` in your database

**If video ID doesn't match:**
- The video ID might not have been saved correctly
- Re-publish the video or manually update `social_post_id` in database

---

## 🔧 Common Fixes

### Fix 1: Re-authorize with Correct Scopes

If your token doesn't have `youtube.readonly` scope:

1. Go to: **https://myaccount.google.com/permissions**
2. **Revoke access** for your app
3. Follow **Step 4** in `PERMANENT_TOKENS_BABY_STEPS.md` with this URL:
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/oauth/callback&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload%20https://www.googleapis.com/auth/youtube.readonly&access_type=offline&prompt=consent
   ```
4. Get new refresh token
5. Update `YOUTUBE_REFRESH_TOKEN` in Supabase Secrets

### Fix 2: Manually Update Video ID

If the video ID wasn't saved correctly:

1. Go to **Supabase Dashboard** → **Table Editor** → **content**
2. Find your video content
3. Edit the `social_post_id` field
4. Paste the correct YouTube video ID (from YouTube URL)
5. Save

### Fix 3: Re-fetch Analytics

After fixing credentials or video ID:

1. Go to your **Analytics Page** in the app
2. Click **"Refresh"** button on the video
3. Check if analytics appear

---

## 🐛 Debug Mode

To see detailed logs:

1. Go to **Supabase Dashboard** → **Edge Functions** → **fetch-analytics** → **Logs**
2. Click **"Refresh Analytics"** in your app
3. Watch the logs in real-time
4. Look for:
   - `📊 Fetching YouTube analytics for video:` - Shows the video ID being used
   - `📈 YouTube analytics parsed successfully:` - Shows the fetched data
   - `❌ YouTube analytics error:` - Shows any errors

---

## ✅ Expected Behavior

After fixing, you should see:

1. **Video ID stored** in `social_post_id` field
2. **Analytics appear** when you click "Refresh Analytics"
3. **Views, Likes, Comments** show up correctly
4. **Logs show success** in Supabase Edge Functions

---

## 🆘 Still Not Working?

If you've tried everything above:

1. **Check Supabase Logs** for specific error messages
2. **Test the API manually** using the test call in Step 4
3. **Verify video exists** on YouTube and is accessible
4. **Check OAuth scopes** - make sure `youtube.readonly` is included
5. **Re-authorize** with correct scopes if needed

---

**Last Updated**: 2024-01-26
