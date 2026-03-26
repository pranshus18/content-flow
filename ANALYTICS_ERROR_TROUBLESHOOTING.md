# 🔍 Analytics Error Troubleshooting Guide

## Error: "Failed to fetch analytics" - "Edge Function returned a non-2xx status code"

This error means the `fetch-analytics` edge function is failing. Here's how to fix it step by step.

---

## ✅ Step 1: Check if Function is Deployed

**The most common issue:** The function might not be deployed.

### Check in Supabase Dashboard:
1. Go to your **Supabase Dashboard**
2. Click **Edge Functions** in the left sidebar
3. Look for `fetch-analytics` in the list
4. **If it's NOT there**, you need to deploy it

### Deploy the Function:

**Option A: Using Supabase CLI (Recommended)**
```bash
# Make sure you're in the project root directory
cd /Users/sahinbegum/Downloads/content-flow-master-main\ 2

# Login to Supabase (if not already)
supabase login

# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy fetch-analytics
```

**Option B: Using Supabase Dashboard**
1. Go to **Edge Functions** → **Create Function**
2. Name it: `fetch-analytics`
3. Copy the code from `supabase/functions/fetch-analytics/index.ts`
4. Click **Deploy**

✅ **Verify**: You should see `fetch-analytics` in your Edge Functions list.

---

## ✅ Step 2: Check Required Secrets

The function needs these secrets in Supabase. **Check each one:**

### Go to: Supabase Dashboard → Settings → Edge Functions → Secrets

**Required Secrets (based on platform):**

#### For Facebook Analytics:
- [ ] `FACEBOOK_ACCESS_TOKEN` - Your long-lived Facebook token

#### For Instagram Analytics:
- [ ] `INSTAGRAM_ACCESS_TOKEN` - Your Instagram token (usually same as Facebook)

#### For YouTube Analytics:
- [ ] `YOUTUBE_CLIENT_ID` - Your YouTube OAuth Client ID
- [ ] `YOUTUBE_CLIENT_SECRET` - Your YouTube OAuth Client Secret
- [ ] `YOUTUBE_REFRESH_TOKEN` - Your YouTube refresh token

#### For Twitter Analytics:
- [ ] `TWITTER_ACCESS_TOKEN` - Your Twitter access token
- [ ] `TWITTER_ACCESS_TOKEN_SECRET` - Your Twitter access token secret
- [ ] `TWITTER_CONSUMER_KEY` - Your Twitter consumer key
- [ ] `TWITTER_CONSUMER_SECRET` - Your Twitter consumer secret

#### For LinkedIn Analytics:
- [ ] `LINKEDIN_ACCESS_TOKEN` - Your LinkedIn access token

**⚠️ Important:** 
- You only need secrets for the platforms you're using
- If you're trying to fetch analytics for Facebook, you MUST have `FACEBOOK_ACCESS_TOKEN`
- If you're trying to fetch analytics for Instagram, you MUST have `INSTAGRAM_ACCESS_TOKEN`

---

## ✅ Step 3: Verify Your Tokens Are Valid

Even if secrets are added, they might be expired or invalid.

### Check Facebook/Instagram Token:
1. Go to: https://developers.facebook.com/tools/explorer/
2. Paste your token in the Access Token field
3. Query: `debug_token?input_token={YOUR_TOKEN}`
4. Check if `is_valid` is `true`
5. Check if `expires_at` is in the future (or `0` for permanent)

**If token is expired:**
- Follow `LONG_LIVED_TOKENS_GUIDE.md` to get a new long-lived token
- Update `FACEBOOK_ACCESS_TOKEN` and `INSTAGRAM_ACCESS_TOKEN` in Supabase Secrets

### Check YouTube Token:
1. Make sure you have all 3 YouTube secrets:
   - `YOUTUBE_CLIENT_ID`
   - `YOUTUBE_CLIENT_SECRET`
   - `YOUTUBE_REFRESH_TOKEN`
2. The refresh token should have `youtube.readonly` scope for analytics

---

## ✅ Step 4: Check Function Logs

The function logs will tell you exactly what's wrong.

### View Logs:
1. Go to **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Select `fetch-analytics` from the dropdown
3. Look for recent error messages

### Common Log Errors:

**Error: "FACEBOOK_ACCESS_TOKEN is not configured"**
- **Fix**: Add `FACEBOOK_ACCESS_TOKEN` to Supabase Secrets

**Error: "Instagram access token not configured"**
- **Fix**: Add `INSTAGRAM_ACCESS_TOKEN` to Supabase Secrets

**Error: "YouTube credentials not configured"**
- **Fix**: Add `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, and `YOUTUBE_REFRESH_TOKEN`

**Error: "Content not published to social media yet"**
- **Fix**: The content needs to have a `social_post_id`. Make sure you've published the content first.

**Error: "Invalid OAuth access token"**
- **Fix**: Your token is expired or invalid. Get a new token and update Supabase Secrets.

**Error: "YouTube access token is invalid or expired"**
- **Fix**: Your YouTube refresh token might be invalid. Regenerate it following `YOUTUBE_TOKEN_REFRESH_FIX.md`

---

## ✅ Step 5: Check Content Has social_post_id

The function can only fetch analytics for content that has been published.

### Verify:
1. Go to your **Admin Dashboard**
2. Find the content you're trying to get analytics for
3. Check if it has a **Status** of "Published"
4. Check if it has a **Post ID** (social_post_id)

**If content is not published:**
- The function will return: "Content not published to social media yet"
- This is expected - you need to publish first before fetching analytics

---

## ✅ Step 6: Test Function Directly

Test if the function works by calling it directly:

### Using Browser Console:
1. Open your app in browser
2. Open DevTools (F12) → **Console** tab
3. Run this (replace `YOUR_CONTENT_ID` with an actual content ID):

```javascript
const { data, error } = await supabase.functions.invoke('fetch-analytics', {
  body: { contentId: 'YOUR_CONTENT_ID' }
});

console.log('Response:', data);
console.log('Error:', error);
```

### Using cURL:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/fetch-analytics \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contentId": "YOUR_CONTENT_ID"}'
```

**Expected Response:**
```json
{
  "success": true,
  "analytics": {
    "likes": 10,
    "comments": 5,
    "shares": 2,
  "reach": 100
  }
}
```

**If you get an error**, check the error message - it will tell you what's missing.

---

## 🔧 Quick Fix Checklist

Go through this checklist in order:

- [ ] **Function is deployed**: Check Supabase Dashboard → Edge Functions → `fetch-analytics` exists
- [ ] **Secrets are added**: Check Supabase Dashboard → Settings → Edge Functions → Secrets
- [ ] **Correct secrets for platform**: 
  - Facebook → `FACEBOOK_ACCESS_TOKEN`
  - Instagram → `INSTAGRAM_ACCESS_TOKEN`
  - YouTube → `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`
- [ ] **Tokens are valid**: Test tokens in Graph API Explorer or check expiration
- [ ] **Content is published**: Content must have `social_post_id` (status = "published")
- [ ] **Check function logs**: Supabase Dashboard → Edge Functions → Logs → `fetch-analytics`

---

## 🎯 Most Common Issues & Solutions

### Issue 1: "Function not found"
**Solution**: Deploy the function (Step 1)

### Issue 2: "Token not configured"
**Solution**: Add the required token to Supabase Secrets (Step 2)

### Issue 3: "Token expired"
**Solution**: Get a new long-lived token and update Supabase Secrets (Step 3)

### Issue 4: "Content not published"
**Solution**: Publish the content first, then fetch analytics

### Issue 5: "Non-2xx status code"
**Solution**: Check function logs to see the actual error (Step 4)

---

## 📞 Still Not Working?

If you've checked everything above and it's still not working:

1. **Check Browser Console** (F12 → Console tab)
   - Look for detailed error messages
   - Copy the full error message

2. **Check Function Logs** (Supabase Dashboard → Edge Functions → Logs)
   - Look for the exact error
   - Copy the error message

3. **Verify Content ID**
   - Make sure the content ID you're using actually exists
   - Make sure it's published (has `social_post_id`)

4. **Test with a Simple Request**
   - Use the test code from Step 6
   - See what error message you get

---

## ✅ Success Indicators

You'll know it's working when:
- ✅ Function appears in Edge Functions list
- ✅ All required secrets are in Supabase Secrets
- ✅ Function logs show successful requests
- ✅ Analytics data appears in your dashboard
- ✅ No error messages in browser console

---

## 📝 Summary

**Most likely causes:**
1. Function not deployed → Deploy it (Step 1)
2. Missing secrets → Add them (Step 2)
3. Invalid/expired tokens → Update them (Step 3)
4. Content not published → Publish first

**Quick fix:**
1. Deploy function: `supabase functions deploy fetch-analytics`
2. Add secrets: Supabase Dashboard → Settings → Edge Functions → Secrets
3. Check logs: Supabase Dashboard → Edge Functions → Logs

That's it! Follow these steps and your analytics should work. 🚀
