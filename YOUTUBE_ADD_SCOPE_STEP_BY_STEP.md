# 📍 Where to Add YouTube Readonly Scope - Step by Step

This guide shows you **exactly where** to do each step. You don't need Google Console for this!

---

## Step 1: Revoke Access (Google Account Settings)

**Where**: Your Google Account permissions page (NOT Google Console)

1. Open your browser
2. Go to: **https://myaccount.google.com/permissions**
3. You'll see a list of apps that have access to your Google account
4. Find your app (it might be named "ContentFlow" or whatever you named it when setting up OAuth)
5. Click **"Remove access"** or **"Revoke"** next to it

**Why**: This removes the old authorization so you can re-authorize with the new scope.

---

## Step 2: Re-authorize with Both Scopes (Browser URL)

**Where**: Your browser (just type the URL in the address bar)

1. Open a **new browser tab**
2. Copy this URL and paste it in the address bar:
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/oauth/callback&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload%20https://www.googleapis.com/auth/youtube.readonly&access_type=offline&prompt=consent
   ```
3. **Replace `YOUR_CLIENT_ID`** with your actual Client ID (from Supabase Secrets → `YOUTUBE_CLIENT_ID`)
4. Press Enter
5. You'll be asked to log in with Google (if not already logged in)
6. You'll see a permission screen asking for:
   - ✅ Upload videos to YouTube
   - ✅ View your YouTube account
7. Click **"Allow"** or **"Continue"**
8. You'll be redirected to: `http://localhost:3000/oauth/callback?code=...`
9. **Copy the code** from the URL (the part after `code=`)

**Example**: If the URL is:
```
http://localhost:3000/oauth/callback?code=4/0Aean...xyz
```
Then your code is: `4/0Aean...xyz`

---

## Step 3: Exchange Code for Refresh Token (Online Tool or Command Line)

**Where**: Use an online tool (easiest) or command line

### Option A: Using Online Tool (Easiest)

1. Go to: **https://reqbin.com/**
2. Set method to **POST**
3. URL: `https://oauth2.googleapis.com/token`
4. Click **"Headers"** tab, add:
   - Key: `Content-Type`
   - Value: `application/x-www-form-urlencoded`
5. Click **"Body"** tab, select **"x-www-form-urlencoded"**
6. Add these fields:
   - `client_id`: Your Client ID (from Supabase Secrets)
   - `client_secret`: Your Client Secret (from Supabase Secrets)
   - `code`: The code you copied from Step 2
   - `grant_type`: `authorization_code`
   - `redirect_uri`: `http://localhost:3000/oauth/callback`
7. Click **"Send"**
8. You'll get a response like:
   ```json
   {
     "access_token": "ya29...",
     "expires_in": 3599,
     "refresh_token": "1//0g...",
     "scope": "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
     "token_type": "Bearer"
   }
   ```
9. **Copy the `refresh_token`** value

### Option B: Using Command Line (Terminal)

If you prefer command line, open Terminal and run:

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_AUTHORIZATION_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://localhost:3000/oauth/callback"
```

Replace:
- `YOUR_CLIENT_ID` with your Client ID
- `YOUR_CLIENT_SECRET` with your Client Secret
- `YOUR_AUTHORIZATION_CODE` with the code from Step 2

You'll get the same JSON response - copy the `refresh_token`.

---

## Step 4: Update Supabase Secrets (Supabase Dashboard)

**Where**: Supabase Dashboard (NOT Google Console)

1. Go to: **https://supabase.com/dashboard**
2. Select your project
3. Click **"Settings"** (gear icon, left sidebar)
4. Click **"Edge Functions"** (under Project Settings)
5. Scroll down to **"Secrets"** section
6. Find **`YOUTUBE_REFRESH_TOKEN`** in the list
7. Click **"Edit"** or the pencil icon
8. Paste your **new refresh token** (from Step 3)
9. Click **"Save"** or **"Update"**

**That's it!** Your token now has both scopes.

---

## Step 5: Test It

1. Go to your app's **Analytics Page**
2. Find your YouTube video
3. Click **"Refresh Analytics"**
4. Views, likes, and comments should now appear!

---

## 📍 Summary: Where Each Step Happens

| Step | Where | URL/Location |
|------|-------|--------------|
| 1. Revoke Access | Google Account Settings | https://myaccount.google.com/permissions |
| 2. Re-authorize | Browser (address bar) | Type the OAuth URL |
| 3. Get Refresh Token | Online Tool or Terminal | https://reqbin.com/ OR Terminal |
| 4. Update Token | Supabase Dashboard | https://supabase.com/dashboard → Settings → Edge Functions → Secrets |
| 5. Test | Your App | Analytics Page → Refresh Analytics |

---

## ❌ You DON'T Need:

- ❌ Google Cloud Console (you already set up OAuth credentials there)
- ❌ Any code changes
- ❌ Any file editing

---

## ✅ You DO Need:

- ✅ Your browser (to revoke and re-authorize)
- ✅ Your Client ID and Client Secret (from Supabase Secrets)
- ✅ An online tool or terminal (to exchange code for token)
- ✅ Supabase Dashboard (to update the refresh token)

---

## 🆘 Troubleshooting

### "Invalid redirect URI" Error
- Make sure the redirect URI in the URL matches exactly: `http://localhost:3000/oauth/callback`
- Check your OAuth credentials in Google Cloud Console → APIs & Services → Credentials → Your OAuth Client → Authorized redirect URIs

### "Invalid client" Error
- Double-check your Client ID is correct
- Make sure you're using the Client ID from Supabase Secrets

### "Code expired" Error
- Authorization codes expire quickly (within minutes)
- Get a fresh code by re-doing Step 2

### Can't Find Your App in Permissions
- Make sure you're logged into the correct Google account
- The app might be listed under a different name

---

**Last Updated**: 2024-01-26
