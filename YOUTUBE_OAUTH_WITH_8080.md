# ✅ YouTube OAuth with localhost:8080

Since you're using `http://localhost:8080` as your redirect URI, follow these steps:

---

## Step 1: Re-authorize with Both Scopes

1. Open a new browser tab
2. Copy and paste this URL in the address bar (your Client ID is already included):
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=380434473167-hdfp9ni9aes94hj4n0ucojq8n86rerau.apps.googleusercontent.com&redirect_uri=http://localhost:8080&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload%20https://www.googleapis.com/auth/youtube.readonly&access_type=offline&prompt=consent
   ```
3. Press Enter
4. You'll be asked to log in with Google (if not already logged in)
5. You'll see a permission screen asking for:
   - ✅ Upload videos to your YouTube account
   - ✅ View your YouTube account (this is the new one!)
6. Click **"Allow"** or **"Continue"**
7. You'll be redirected to: `http://localhost:8080?code=...`
8. **Copy the code** from the URL (the part after `code=`)

**Example**: If the URL is:
```
http://localhost:8080?code=4/0Aean...xyz
```
Then your code is: `4/0Aean...xyz`

---

## Step 2: Exchange Code for Refresh Token

1. Go to: **https://reqbin.com/**
2. Set method to **POST**
3. URL: `https://oauth2.googleapis.com/token`
4. Click **"Headers"** tab, add:
   - Key: `Content-Type`
   - Value: `application/x-www-form-urlencoded`
5. Click **"Body"** tab, select **"x-www-form-urlencoded"**
6. Add these fields:
   - `client_id`: `380434473167-hdfp9ni9aes94hj4n0ucojq8n86rerau.apps.googleusercontent.com`
   - `client_secret`: Your Client Secret (from Supabase Secrets → `YOUTUBE_CLIENT_SECRET`)
   - `code`: The code you copied from Step 1
   - `grant_type`: `authorization_code`
   - `redirect_uri`: `http://localhost:8080` (important: use 8080, not 3000!)
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

---

## Step 3: Update Supabase Secrets

1. Go to: **https://supabase.com/dashboard**
2. Select your project
3. Click **"Settings"** → **"Edge Functions"** → **"Secrets"**
4. Find **`YOUTUBE_REFRESH_TOKEN`**
5. Click **"Edit"** or the pencil icon
6. Paste your **new refresh token** (from Step 2)
7. Click **"Save"**

---

## Step 4: Verify Permissions

1. Go to: **https://myaccount.google.com/permissions**
2. Find your app (api2)
3. You should now see:
   - ✅ Manage your YouTube videos
   - ✅ Upload videos to your YouTube account
   - ✅ **View your YouTube account** (this is new!)

---

## Step 5: Test Analytics

1. Go to your app's **Analytics Page**
2. Find your YouTube video
3. Click **"Refresh Analytics"**
4. Views, likes, and comments should now appear!

---

## ✅ Summary

- **Redirect URI**: `http://localhost:8080` (already configured ✅)
- **OAuth URL**: Use the one above with `redirect_uri=http://localhost:8080`
- **Exchange Code**: Use `redirect_uri=http://localhost:8080` in the token exchange
- **Result**: Both upload and analytics will work!

---

**Last Updated**: 2024-01-26
