# 🔍 Debug YouTube Analytics - Step by Step

If your YouTube video has views on YouTube but they're not showing on your platform, follow these steps:

---

## Step 1: Check Video ID is Stored

1. Go to **Supabase Dashboard** → **Table Editor** → **content** table
2. Find your published YouTube video
3. Check the **`social_post_id`** field
4. It should contain a YouTube video ID (like `dQw4w9WgXcQ`)

**Expected**: A string like `abc123xyz` (11 characters, YouTube video ID format)

**If empty or null**: The video wasn't published correctly. Re-publish it.

---

## Step 2: Check Supabase Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **fetch-analytics** → **Logs**
2. Click **"Refresh Analytics"** in your app for the YouTube video
3. Watch the logs in real-time

**Look for these log messages:**

### ✅ Success Logs:
- `📹 Fetching YouTube analytics for video ID: [VIDEO_ID]`
- `📡 Making YouTube API request:`
- `📈 YouTube analytics parsed successfully:`
- `✅ Analytics fetched:`
- `✅ Analytics saved to database:`

### ❌ Error Logs:
- `❌ YouTube access token error:` → Token issue
- `❌ YouTube analytics HTTP error:` → API call failed
- `❌ YouTube API returned no items:` → Video not found
- `❌ YouTube analytics error:` → General error

---

## Step 3: Check OAuth Scopes

**CRITICAL**: Your OAuth token MUST have `youtube.readonly` scope!

1. Go to: **https://myaccount.google.com/permissions**
2. Find your app (ContentFlow or whatever you named it)
3. Check if it has **"View your YouTube account"** permission

**If it doesn't have this permission:**

1. **Revoke access** for your app
2. Go to **Step 4** in `PERMANENT_TOKENS_BABY_STEPS.md`
3. Use this URL (with BOTH scopes):
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/oauth/callback&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload%20https://www.googleapis.com/auth/youtube.readonly&access_type=offline&prompt=consent
   ```
4. Get a new refresh token
5. Update `YOUTUBE_REFRESH_TOKEN` in Supabase Secrets

---

## Step 4: Test the API Manually

You can test if the YouTube API is working:

### Option A: Using Browser Console

1. Get a fresh access token (see `getYouTubeAccessToken` function in code)
2. Open browser console
3. Run:
   ```javascript
   fetch(`https://www.googleapis.com/youtube/v3/videos?id=YOUR_VIDEO_ID&part=statistics`, {
     headers: {
       "Authorization": "Bearer YOUR_ACCESS_TOKEN"
     }
   })
   .then(r => r.json())
   .then(console.log)
   ```

### Option B: Using curl

```bash
curl "https://www.googleapis.com/youtube/v3/videos?id=YOUR_VIDEO_ID&part=statistics" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "items": [{
    "statistics": {
      "viewCount": "123",
      "likeCount": "5",
      "commentCount": "2"
    }
  }]
}
```

**If you get an error:**
- **401/403**: Token doesn't have `youtube.readonly` scope → Re-authorize
- **404**: Video ID is wrong → Check the video ID
- **400**: Invalid request → Check video ID format

---

## Step 5: Verify Database Update

1. Go to **Supabase Dashboard** → **Table Editor** → **content** table
2. Find your YouTube video
3. Check these fields:
   - `likes_count` - Should show likes
   - `comments_count` - Should show comments
   - `reach_count` - Should show views (for YouTube)

**If these are all 0 or null:**
- The analytics fetch might have failed
- Check Supabase logs for errors
- Try clicking "Refresh Analytics" again

---

## Step 6: Check Frontend Display

1. Go to your **Analytics Page** in the app
2. Find your YouTube video
3. Check if it shows:
   - Views (should be in the "Reach" column for YouTube)
   - Likes
   - Comments

**If it shows 0 for everything:**
- The analytics might not have been fetched yet
- Click the **"Refresh"** button on that video
- Check if an error toast appears

---

## Common Issues & Fixes

### Issue 1: "Video not found" Error

**Cause**: Video ID is wrong or video was deleted

**Fix**:
1. Go to your YouTube channel
2. Find the video
3. Copy the video ID from URL: `youtube.com/watch?v=VIDEO_ID`
4. Update `social_post_id` in database with correct ID
5. Refresh analytics

### Issue 2: "Access denied" or "Invalid token" Error

**Cause**: OAuth token doesn't have `youtube.readonly` scope

**Fix**:
1. Re-authorize with correct scopes (see Step 3)
2. Update `YOUTUBE_REFRESH_TOKEN` in Supabase Secrets
3. Refresh analytics

### Issue 3: Analytics show 0 but video has views

**Cause**: 
- Analytics fetch failed silently
- Token doesn't have right scopes
- Video ID is wrong

**Fix**:
1. Check Supabase logs for errors
2. Verify OAuth scopes
3. Verify video ID is correct
4. Try manual API test (Step 4)

### Issue 4: "YouTube credentials not configured"

**Cause**: Missing secrets in Supabase

**Fix**:
1. Go to **Supabase Dashboard** → **Settings** → **Edge Functions** → **Secrets**
2. Add:
   - `YOUTUBE_CLIENT_ID`
   - `YOUTUBE_CLIENT_SECRET`
   - `YOUTUBE_REFRESH_TOKEN`
3. Refresh analytics

---

## Quick Diagnostic Checklist

- [ ] Video ID is stored in `social_post_id` field
- [ ] Video exists on YouTube and has views
- [ ] OAuth token has `youtube.readonly` scope
- [ ] YouTube credentials are in Supabase Secrets
- [ ] Supabase logs show successful API call
- [ ] Database fields (`likes_count`, `comments_count`, `reach_count`) are updated
- [ ] Frontend shows the analytics

---

## Still Not Working?

1. **Check Supabase Logs** - Look for specific error messages
2. **Test API Manually** - Use Step 4 to verify API works
3. **Verify Video ID** - Make sure it matches YouTube URL
4. **Re-authorize** - Get new token with correct scopes
5. **Check Database** - Verify data is actually saved

---

**Last Updated**: 2024-01-26
