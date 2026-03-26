# 🔍 Troubleshooting: Not Getting the Authorization Code

If you clicked "Continue" but didn't get the code, here are solutions:

---

## Issue 1: localhost:8080 Not Running

**Problem**: If `http://localhost:8080` isn't running, the redirect will fail.

**Solution**: Use OAuth Playground instead (already in your authorized URIs!)

### Use OAuth Playground (Easiest Method)

1. Go to: **https://developers.google.com/oauthplayground/**
2. In the left panel, find **"YouTube Data API v3"**
3. Check these boxes:
   - ✅ `https://www.googleapis.com/auth/youtube.upload`
   - ✅ `https://www.googleapis.com/auth/youtube.readonly`
4. Click **"Authorize APIs"** button (top right)
5. You'll be asked to log in and grant permissions
6. After authorization, you'll see **"Authorization successful"**
7. Click **"Exchange authorization code for tokens"** button
8. You'll get:
   - Access Token
   - Refresh Token ← **Copy this!**
9. Use this refresh token in Supabase Secrets

**This is the easiest way!** No need to deal with redirect URIs or codes.

---

## Issue 2: Check Browser Address Bar

**Problem**: The redirect might have happened but you didn't notice.

**Solution**: 
1. Check your browser's address bar - it might show `http://localhost:8080?code=...`
2. If you see an error page, check the URL - the code might still be there
3. Copy everything after `code=` in the URL

---

## Issue 3: Check Browser Console/Network Tab

**Problem**: The redirect might have failed silently.

**Solution**:
1. Open browser Developer Tools (F12 or Right-click → Inspect)
2. Go to **"Network"** tab
3. Click "Continue" again on the OAuth screen
4. Look for a request to `localhost:8080` or `oauth2.googleapis.com`
5. Check if there's an error or if the code is in the response

---

## Issue 4: Use Different Redirect URI

**Problem**: Maybe localhost:8080 isn't accessible.

**Solution**: Add a different redirect URI that you can access.

### Option A: Use OAuth Playground (Recommended)

Just use the OAuth Playground method above - it's the easiest!

### Option B: Add a Simple Redirect URI

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Click on your OAuth client
3. Under "Authorized redirect URIs", add:
   - `http://localhost:3000` (or any port you prefer)
4. Save
5. Use that URI in the OAuth URL instead

---

## ✅ Recommended: Use OAuth Playground

**This is the easiest method and doesn't require any redirect URI setup!**

1. Go to: **https://developers.google.com/oauthplayground/**
2. Select YouTube scopes
3. Authorize
4. Get refresh token directly
5. Done!

---

## 🆘 Still Not Working?

Tell me:
1. What happened after you clicked "Continue"?
   - Did it redirect somewhere?
   - Did you see an error?
   - Did nothing happen?
2. What does your browser address bar show?
3. Are you able to access `http://localhost:8080` in your browser?

---

**Last Updated**: 2024-01-26
