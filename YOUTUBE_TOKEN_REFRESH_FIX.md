# 🔧 YouTube Token Refresh Error Fix

## Problem: "invalid_grant" - Token has been expired or revoked

Even though you have long-lived tokens and your client ID/secret configured, you're getting this error. Here's why and how to fix it.

## ⚠️ Important: Your Redirect URI

Based on your OAuth configuration, your authorized redirect URI is:
- **`http://localhost:8080`** ✅

Make sure to use this exact URI in all OAuth requests. Do NOT use `http://localhost:3000/oauth/callback` or any other URI.

---

## 🔍 Root Causes

The error `"invalid_grant"` with `"Token has been expired or revoked"` typically happens when:

1. **Client ID/Secret Mismatch** (MOST COMMON)
   - The refresh token was generated with **different** client ID/secret than what's in Supabase Secrets
   - You may have created new OAuth credentials but are using an old refresh token
   - The refresh token is tied to specific OAuth client credentials

2. **Refresh Token Revoked**
   - You revoked access in your Google account settings
   - The token was manually revoked or expired due to security reasons

3. **OAuth App Changed**
   - The OAuth app in Google Cloud Console was deleted or recreated
   - Client credentials were regenerated

4. **Wrong Google Account**
   - The refresh token was generated for a different Google account

---

## ✅ Solution: Regenerate Refresh Token with Matching Credentials

You need to ensure your **Client ID**, **Client Secret**, and **Refresh Token** all match and were generated together.

### Step 1: Verify Your Current Credentials

1. Go to **Supabase Dashboard** → **Settings** → **Edge Functions** → **Secrets**
2. Note down your current values:
   - `YOUTUBE_CLIENT_ID`
   - `YOUTUBE_CLIENT_SECRET`
   - `YOUTUBE_REFRESH_TOKEN`

### Step 2: Check Google Cloud Console

1. Go to **https://console.cloud.google.com/**
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID
5. **Verify** that the Client ID matches what's in Supabase Secrets
6. Click on the Client ID to view details
7. **Verify** that the Client Secret matches (you may need to regenerate it if you don't see it)

### Step 3: Regenerate Refresh Token

**IMPORTANT**: You must use the **SAME** Client ID and Client Secret that are currently in Supabase Secrets!

#### Option A: Using the OAuth URL (Recommended)

1. **Get your Client ID** from Supabase Secrets (`YOUTUBE_CLIENT_ID`)

2. **Build the OAuth URL** with your Client ID:
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:8080&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload%20https://www.googleapis.com/auth/youtube.readonly&access_type=offline&prompt=consent
   ```
   
   Replace `YOUR_CLIENT_ID` with your actual Client ID from Supabase Secrets.
   
   **Note**: This uses `http://localhost:8080` which matches your configured redirect URI. Make sure this matches exactly what's in your Google Cloud Console OAuth settings.

3. **Open the URL** in your browser
4. **Authorize** the app (select your Google account)
5. **Copy the authorization code** from the redirect URL
   - The URL will look like: `http://localhost:8080?code=4/0A...` or `http://localhost:8080/?code=4/0A...`
   - Copy everything after `code=` (stop before any `&` if present)

6. **Exchange code for refresh token** using one of these methods:

   **Method 1: Online Tool (Easiest)**
   - Go to: **https://reqbin.com/curl**
   - Use POST method
   - URL: `https://oauth2.googleapis.com/token`
   - Headers: `Content-Type: application/x-www-form-urlencoded`
   - Body (form-urlencoded):
     ```
     client_id=YOUR_CLIENT_ID
     client_secret=YOUR_CLIENT_SECRET
     code=AUTHORIZATION_CODE
     grant_type=authorization_code
     redirect_uri=http://localhost:8080
     ```
   - Replace:
     - `YOUR_CLIENT_ID` with your Client ID from Supabase Secrets
     - `YOUR_CLIENT_SECRET` with your Client Secret from Supabase Secrets
     - `AUTHORIZATION_CODE` with the code from step 5
   - Click **Send**
   - In the response, find `"refresh_token"` and **copy it**
   
   **Alternative: OAuth Playground** (You have this configured!)
   - Go to: **https://developers.google.com/oauthplayground**
   - Click the gear icon (⚙️) in top right
   - Check "Use your own OAuth credentials"
   - Enter your `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`
   - In the left panel, find "YouTube Data API v3"
   - Select scopes:
     - `https://www.googleapis.com/auth/youtube.upload`
     - `https://www.googleapis.com/auth/youtube.readonly`
   - Click "Authorize APIs"
   - After authorization, click "Exchange authorization code for tokens"
   - Copy the `refresh_token` from the response

   **Method 2: Terminal/Command Line**
   ```bash
   curl -X POST https://oauth2.googleapis.com/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "code=AUTHORIZATION_CODE" \
     -d "grant_type=authorization_code" \
     -d "redirect_uri=http://localhost:8080"
   ```
   - Replace the placeholders with your actual values
   - Look for `"refresh_token"` in the response

### Step 4: Update Supabase Secrets

1. Go to **Supabase Dashboard** → **Settings** → **Edge Functions** → **Secrets**
2. Find `YOUTUBE_REFRESH_TOKEN`
3. **Update** it with your new refresh token from Step 3
4. **Verify** that `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` match what you used to generate the refresh token
5. **Save** all changes

### Step 5: Test

1. Try publishing to YouTube again
2. The error should be resolved
3. If you still get errors, check the Supabase Edge Function logs

---

## 🔍 Alternative: Check if Token Was Revoked

1. Go to: **https://myaccount.google.com/permissions**
2. Find your app (ContentFlow or whatever you named it)
3. Check if it's still authorized
4. If it shows as revoked or you don't see it, you need to regenerate the refresh token (follow Step 3 above)

---

## 🚨 Common Mistakes to Avoid

1. **❌ Using different Client ID/Secret to generate refresh token**
   - Always use the SAME credentials that are in Supabase Secrets

2. **❌ Using an old refresh token with new credentials**
   - Refresh tokens are tied to specific OAuth client credentials
   - If you change credentials, you MUST regenerate the refresh token

3. **❌ Not including `prompt=consent` in OAuth URL**
   - This ensures you get a refresh token (not just an access token)

4. **❌ Using wrong redirect URI**
   - Must match exactly what's configured in Google Cloud Console
   - Must match what you use in the token exchange request
   - Your configured URI is: `http://localhost:8080` (NOT `http://localhost:3000/oauth/callback`)

---

## ✅ Verification Checklist

After fixing, verify:

- [ ] `YOUTUBE_CLIENT_ID` in Supabase Secrets matches Google Cloud Console
- [ ] `YOUTUBE_CLIENT_SECRET` in Supabase Secrets matches Google Cloud Console
- [ ] `YOUTUBE_REFRESH_TOKEN` was generated using the above Client ID/Secret
- [ ] All three values are saved in Supabase Secrets
- [ ] Test publishing works without errors

---

## 🆘 Still Not Working?

If you've followed all steps and still get the error:

1. **Double-check Client ID/Secret match**:
   - Go to Google Cloud Console → Credentials
   - Verify the Client ID matches Supabase Secrets exactly
   - If Client Secret is hidden, you may need to create new credentials

2. **Create Fresh OAuth Credentials**:
   - In Google Cloud Console, create a NEW OAuth 2.0 Client ID
   - Update all three values in Supabase Secrets:
     - `YOUTUBE_CLIENT_ID` (new)
     - `YOUTUBE_CLIENT_SECRET` (new)
     - `YOUTUBE_REFRESH_TOKEN` (regenerate with new credentials)

3. **Check Supabase Logs**:
   - Go to Supabase Dashboard → Edge Functions → `publish-social` → Logs
   - Look for detailed error messages

4. **Test Token Refresh Manually**:
   - Use the same code from `getYouTubeAccessToken()` function
   - Test it with your credentials to see the exact error

---

## 📝 Quick Reference

**The Golden Rule**: Your refresh token MUST be generated using the EXACT same Client ID and Client Secret that are stored in Supabase Secrets. If any of these three values don't match, you'll get `invalid_grant` errors.

**To Fix**: Always regenerate the refresh token using the current Client ID/Secret from Supabase Secrets.
