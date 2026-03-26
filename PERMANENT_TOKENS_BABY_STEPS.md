# 🔑 How to Get Permanent Refresh Tokens - Baby Steps Guide

This guide will help you get **permanent refresh tokens** for Facebook, Instagram, and YouTube so your app can post automatically without tokens expiring.

**Time needed**: 30-60 minutes per platform

---

## 📘 PART 1: Facebook & Instagram (They Share the Same Token!)

Facebook and Instagram use the **same access token** because Instagram is owned by Facebook. Once you set up Facebook, Instagram works automatically!

### ✅ What You'll Get:
- **Facebook Page Access Token** (long-lived, 60 days)
- **Instagram Access Token** (same as Facebook token)
- **Facebook Page ID** (optional, but helpful)

---

### STEP 1: Create a Facebook Page (If You Don't Have One)

1. Go to **Facebook.com** and log in
2. On the left sidebar, click **"Pages"**
3. Click **"Create new Page"**
4. Fill in:
   - **Page name**: Your business name (e.g., "My Business")
   - **Category**: Choose "Business" or "Product/Service"
   - **Description**: Brief description (optional)
5. Click **"Create Page"**
6. Complete any additional setup steps

✅ **Check**: You should see your new Page in the Pages list

---

### STEP 2: Create a Facebook Developer App

1. Go to: **https://developers.facebook.com/**
2. Log in with your Facebook account (same one that owns the Page)
3. If asked to become a developer:
   - Click **"Get Started"**
   - Accept terms and complete registration
4. Click **"My Apps"** (top right)
5. Click **"Create App"**
6. Choose **"Business"** as app type
7. Fill in:
   - **App name**: "ContentFlow" (or any name you like)
   - **App contact email**: Your email address
8. Click **"Create App"**
9. Complete any security checks (like captcha)

✅ **Check**: You should see your app dashboard

---

### STEP 3: Add Facebook Login Product

1. In your app dashboard, find **"Add Products"** section
2. Find **"Facebook Login"** and click **"Set Up"**
3. Choose **"Web"** as platform
4. Enter **Site URL**: `http://localhost:3000` (or your actual website URL)
5. Click **"Save"**

✅ **Check**: "Facebook Login" should appear in your Products list

---

### STEP 4: Configure App Settings

1. In your app dashboard, click **"Settings"** → **"Basic"** (left sidebar)
2. Scroll down and fill in:
   - **App Domains**: Your domain (e.g., `yourdomain.com`) or leave blank for testing
   - **Privacy Policy URL**: You can use a placeholder like `https://yourdomain.com/privacy`
   - **Terms of Service URL**: You can use a placeholder like `https://yourdomain.com/terms`
3. Click **"Save Changes"**

✅ **Check**: Settings are saved

---

### STEP 5: Get Your App ID and App Secret

1. Still in **Settings → Basic**
2. You'll see:
   - **App ID**: A long number (like `1234567890123456`) - **Copy this!**
   - **App Secret**: Click **"Show"** button - **Copy this too!**

👉 **Important**: Save these somewhere safe:
- `FACEBOOK_APP_ID = ...`
- `FACEBOOK_APP_SECRET = ...`

✅ **Check**: You have both App ID and App Secret copied

---

### STEP 6: Open Graph API Explorer

1. Go to: **https://developers.facebook.com/tools/explorer/**
2. At the top right, there's a dropdown - select **your app** (the one you just created)
3. You should see a page with:
   - A search box (for API queries)
   - An "Access Token" field
   - A "Get Token" button

✅ **Check**: Graph API Explorer is open with your app selected

---

### STEP 7: Get User Access Token (Short-Lived)

1. In Graph API Explorer, click **"Get Token"** dropdown
2. Select **"Get User Access Token"**
3. A popup will open asking for permissions
4. **Check these boxes**:
   - ✅ `pages_show_list` (to see your Pages)
   - ✅ `pages_manage_posts` (to post to Pages)
   - ✅ `pages_read_engagement` (to read analytics)
5. Click **"Generate Access Token"**
6. Log in with Facebook if asked
7. Click **"Continue"** to allow permissions

✅ **Check**: The Access Token field now has a long string (starts with `EAA...`)

👉 **Note**: This token expires in 1-2 hours, but we'll exchange it for a long-lived one next!

---

### STEP 8: Get Your Page Access Token

1. In Graph API Explorer, in the search box, type:
   ```
   /me/accounts
   ```
2. Make sure the method is **GET** (should be by default)
3. Click **"Submit"** button
4. You'll see a JSON response with your Pages
5. Find your Page in the list (look for the name you created)
6. In that Page object, you'll see:
   - `"id": "1234567890"` → This is your **Page ID** - **Copy this!**
   - `"access_token": "EAA..."` → This is your **Page Access Token** - **Copy this!**

👉 **Save both**:
- `FACEBOOK_PAGE_ID = ...`
- `FACEBOOK_PAGE_ACCESS_TOKEN = ...` (the short-lived one)

✅ **Check**: You have your Page ID and Page Access Token

---

### STEP 9: Exchange for Long-Lived Token (60 Days) - MULTIPLE METHODS

Now we'll convert the short-lived token into a long-lived one that lasts 60 days. If Graph API Explorer doesn't work, use one of the methods below.

---

#### **METHOD 1: Using Browser URL (EASIEST - Recommended!)**

This method works directly in your browser - no tools needed!

1. Open a **new browser tab**
2. Copy this URL and paste it in the address bar:
   ```
   https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_PAGE_ACCESS_TOKEN
   ```
3. **Replace these parts**:
   - `YOUR_APP_ID` → Your App ID (from Step 5)
   - `YOUR_APP_SECRET` → Your App Secret (from Step 5)
   - `YOUR_PAGE_ACCESS_TOKEN` → Your Page Access Token (from Step 8)

4. **Example** (don't use this exact one, use your own values):
   ```
   https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=1234567890123456&client_secret=abc123def456&fb_exchange_token=EAAUktfit6a0BO...
   ```

5. Press **Enter** to go to the URL
6. You'll see a response like:
   ```json
   {
     "access_token": "EAA...",
     "token_type": "bearer",
     "expires_in": 5183944
   }
   ```
7. **Copy the `access_token`** - this is your **long-lived token** (60 days)!

✅ **This is the easiest method!**

---

#### **METHOD 2: Using Graph API Explorer (If UI Has Changed)**

If the "Add Parameter" button isn't visible, try this:

1. In Graph API Explorer, in the search box, type the **full URL with parameters**:
   ```
   /oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_PAGE_ACCESS_TOKEN
   ```
   Replace the placeholders with your actual values

2. Make sure method is **GET**
3. Click **"Submit"**
4. Copy the `access_token` from the response

---

#### **METHOD 3: Using Online Tool (If Browser Method Doesn't Work)**

1. Go to: **https://reqbin.com/** (or any API testing tool)
2. Set method to **GET**
3. Enter URL:
   ```
   https://graph.facebook.com/oauth/access_token
   ```
4. Click **"Params"** or **"Query String"** tab
5. Add these parameters:
   - `grant_type` = `fb_exchange_token`
   - `client_id` = Your App ID
   - `client_secret` = Your App Secret
   - `fb_exchange_token` = Your Page Access Token
6. Click **"Send"** or **"Submit"**
7. Copy the `access_token` from the response

---

#### **METHOD 4: Using Command Line (curl)**

If you're comfortable with command line:

1. Open **Terminal** (Mac) or **Command Prompt** (Windows)
2. Run this command (replace the values):
   ```bash
   curl "https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_PAGE_ACCESS_TOKEN"
   ```
3. Copy the `access_token` from the response

---

👉 **Save this**:
- `FACEBOOK_ACCESS_TOKEN = ...` (the long-lived one)

✅ **Check**: You have a long-lived access token (60 days)

---

### STEP 9B: Get Token That Lasts 100+ Days (Optional - Better Method!)

**Important**: Facebook's standard long-lived tokens expire in 60 days. However, **Page Access Tokens** can last much longer (or indefinitely) if you use them correctly!

#### **Why Page Tokens Are Better:**

- Page Access Tokens from `/me/accounts` don't expire as long as:
  - You don't revoke permissions
  - The Page admin doesn't change
  - You refresh them before they expire (if they do expire)

#### **How to Get a Long-Lasting Page Token:**

1. Go to Graph API Explorer: **https://developers.facebook.com/tools/explorer/**
2. Select your app
3. Get a **User Access Token** with these permissions:
   - `pages_manage_posts`
   - `pages_show_list`
   - `pages_read_engagement`
4. In the search box, type:
   ```
   /me/accounts?fields=access_token,name,id
   ```
5. Click **"Submit"**
6. Find your Page in the response
7. **Copy the `access_token`** for your Page
8. This token can last **indefinitely** if you:
   - Keep the permissions active
   - Don't revoke access
   - Refresh it every 60 days (just in case)

#### **To Make It Last 100+ Days:**

**Option A: Use the Page Token Directly (Recommended)**
- The Page Access Token from Step 8 can work for months
- Just use it directly - no need to exchange it
- Add it to Supabase Secrets as `FACEBOOK_ACCESS_TOKEN`

**Option B: Exchange for Long-Lived, Then Refresh Before Expiry**
- Get long-lived token (60 days) using Step 9
- Set a calendar reminder for **55 days** from now
- Before it expires, repeat Step 8 to get a fresh Page token
- This way you can keep it going indefinitely

**Option C: Use Facebook Business Manager (Most Permanent)**
- If you have Facebook Business Manager:
  1. Go to **Business Settings** → **System Users**
  2. Create a System User
  3. Assign it to your Page with `pages_manage_posts` permission
  4. Generate a token for the System User
  5. This token can last **indefinitely** (until you revoke it)

👉 **For simplicity, I recommend Option A** - just use the Page Access Token directly from Step 8. It should work for months without issues!

---

### STEP 10: Add to Supabase Secrets

1. Go to your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Click **"Settings"** (gear icon, left sidebar)
4. Click **"Edge Functions"** (under Project Settings)
5. Scroll down to **"Secrets"** section
6. Click **"Add new secret"** or **"New secret"**

**Add Secret 1: FACEBOOK_ACCESS_TOKEN**
- **Name**: `FACEBOOK_ACCESS_TOKEN`
- **Value**: Paste your **long-lived token** (from Step 9)
- Click **"Add secret"**

**Add Secret 2: FACEBOOK_PAGE_ID** (Optional but recommended)
- **Name**: `FACEBOOK_PAGE_ID`
- **Value**: Paste your **Page ID** (from Step 8)
- Click **"Add secret"**

**Add Secret 3: INSTAGRAM_ACCESS_TOKEN**
- **Name**: `INSTAGRAM_ACCESS_TOKEN`
- **Value**: Paste the **same long-lived token** (same as Facebook!)
- Click **"Add secret"**

**Add Secret 4: INSTAGRAM_ACCOUNT_ID** (Optional - only if Instagram posting fails)
- **Name**: `INSTAGRAM_ACCOUNT_ID`
- **Value**: See Step 11 below to get this
- Click **"Add secret"**

✅ **Check**: All secrets are added in Supabase

---

### STEP 11: Get Instagram Business Account ID (Optional)

Only do this if Instagram posting fails with "Invalid user" error.

1. Go to: **https://developers.facebook.com/tools/explorer/**
2. Select your app
3. Use your **Page Access Token** in the Access Token field
4. In the search box, type:
   ```
   /{PAGE_ID}?fields=instagram_business_account
   ```
   Replace `{PAGE_ID}` with your actual Page ID
5. Click **"Submit"**
6. You'll see:
   ```json
   {
     "instagram_business_account": {
       "id": "17841405309211844"
     }
   }
   ```
7. **Copy the `id`** number - this is your Instagram Business Account ID

👉 **Note**: Your Instagram account must be a **Business Account** and connected to your Facebook Page. If you don't see `instagram_business_account`, you need to:
- Convert Instagram to Business Account
- Connect it to your Facebook Page

---

### ✅ Facebook & Instagram Complete!

You now have:
- ✅ Long-lived Facebook Page Access Token (60 days, or longer if using Page token directly)
- ✅ Instagram Access Token (same as Facebook)
- ✅ Tokens added to Supabase Secrets

**Important Token Expiration:**
- **Standard long-lived tokens**: Expire in 60 days
- **Page Access Tokens**: Can last 100+ days or indefinitely if:
  - You use the Page token directly (from Step 8)
  - You don't revoke permissions
  - You refresh before expiration if needed

**To keep tokens working for 100+ days:**
- Use the Page Access Token directly from Step 8 (recommended)
- OR set a reminder to refresh every 55 days
- OR use Facebook Business Manager System User tokens (most permanent)

---

## 🎥 PART 2: YouTube (OAuth 2.0 with Refresh Token) - PERMANENT SETUP!

**IMPORTANT**: YouTube uses a **refresh token** that is **PERMANENT** and **NEVER EXPIRES** (unless you revoke it). This is the BEST option - you set it up ONCE and never need to do it again!

### ✅ What You'll Get:
- **YouTube Client ID** (permanent - save it once)
- **YouTube Client Secret** (permanent - save it once)
- **YouTube Refresh Token** (PERMANENT - never expires!)

### 🔑 How It Works:
1. You get a **refresh token** (permanent, never expires)
2. Your application **automatically** uses the refresh token to get new access tokens (which expire in 1 hour)
3. You **never need to manually refresh** - the app does it automatically
4. You **only set it up once** - then it works forever!

👉 **This is better than Facebook/Instagram** because you don't need to refresh every 60 days!

---

### 📝 Quick Summary (Read This First!)

**What you're doing:**
1. Create OAuth credentials (Client ID & Secret) - **permanent, save once**
2. Get a refresh token - **PERMANENT, never expires**
3. Add all 3 to Supabase Secrets - **done once, works forever**

**Why it's permanent:**
- The refresh token **never expires** (unlike Facebook's 60-day tokens)
- Your app **automatically** uses it to get access tokens (which expire in 1 hour)
- You **never need to manually refresh** - it's all automatic
- **Set it up once, forget about it!**

---

### STEP 1: Go to Google Cloud Console

1. Go to: **https://console.cloud.google.com/**
2. Log in with your Google account (the one you want to post YouTube videos to)
3. If you don't have a project:
   - Click **"Select a project"** (top bar)
   - Click **"New Project"**
   - Enter project name: "ContentFlow" (or any name)
   - Click **"Create"**
   - Wait a few seconds, then select your new project

✅ **Check**: You're in Google Cloud Console with a project selected

---

### STEP 2: Enable YouTube Data API v3

1. In Google Cloud Console, click the **☰ menu** (top left)
2. Go to **"APIs & Services"** → **"Library"**
3. In the search box, type: **"YouTube Data API v3"**
4. Click on **"YouTube Data API v3"**
5. Click **"Enable"** button
6. Wait for it to enable (usually instant)

✅ **Check**: YouTube Data API v3 is enabled (you'll see "API enabled" message)

---

### STEP 3: Create OAuth 2.0 Credentials

1. Still in Google Cloud Console, go to **"APIs & Services"** → **"Credentials"** (left sidebar)
2. Click **"+ CREATE CREDENTIALS"** (top of page)
3. Select **"OAuth client ID"**
4. If asked to configure OAuth consent screen:
   - Click **"Configure Consent Screen"**
   - Choose **"External"** (unless you have a Google Workspace account)
   - Click **"Create"**
   - Fill in:
     - **App name**: "ContentFlow" (or any name)
     - **User support email**: Your email
     - **Developer contact email**: Your email
   - Click **"Save and Continue"**
   - On "Scopes" page, click **"Save and Continue"** (no need to add scopes here)
   - On "Test users" page, click **"Save and Continue"**
   - On "Summary" page, click **"Back to Dashboard"**
5. Now click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"** again
6. Select **"Web application"** as application type
7. Fill in:
   - **Name**: "ContentFlow Web Client" (or any name)
   - **Authorized JavaScript origins**: 
     - Click **"+ ADD URI"**
     - Enter: `http://localhost:3000` (or your app URL)
   - **Authorized redirect URIs**:
     - Click **"+ ADD URI"**
     - Enter: `http://localhost:3000/oauth/callback` (or your callback URL)
8. Click **"Create"**
9. A popup will show:
   - **Your Client ID**: A long string - **Copy this!**
   - **Your Client Secret**: A long string - **Copy this!**

👉 **Save both**:
- `YOUTUBE_CLIENT_ID = ...`
- `YOUTUBE_CLIENT_SECRET = ...`

✅ **Check**: You have Client ID and Client Secret copied

---

### STEP 4: Get Authorization Code

Now we need to get an authorization code that we'll exchange for a refresh token.

1. Open a new browser tab
2. Go to this URL (replace `YOUR_CLIENT_ID` with your actual Client ID):
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/oauth/callback&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload%20https://www.googleapis.com/auth/youtube.readonly&access_type=offline&prompt=consent
   ```
   
   **⚠️ CRITICAL**: Notice the scope includes BOTH:
   - `youtube.upload` (to upload videos)
   - `youtube.readonly` (to read analytics/statistics)
   
   These are separated by a space (`%20` in the URL).
   
   **If you only have `youtube.upload` scope:**
   - ✅ You CAN upload videos (this is why uploads work!)
   - ❌ You CANNOT read analytics (this is why analytics don't work!)
   - **Solution**: Re-authorize with BOTH scopes using the URL above
   
   **After re-authorization, you'll have both:**
   - ✅ Upload videos (still works!)
   - ✅ Read analytics (now works!)
3. You'll be asked to log in with Google
4. You'll see a permission screen - click **"Allow"**
5. You'll be redirected to `http://localhost:3000/oauth/callback?code=...`
6. **Look at the URL** - you'll see `code=...` in it
7. **Copy the entire code value** (it's a long string after `code=`)

👉 **Example**: If the URL is:
```
http://localhost:3000/oauth/callback?code=4/0Aean...xyz
```
Then your code is: `4/0Aean...xyz`

👉 **Save this**:
- `YOUTUBE_AUTHORIZATION_CODE = ...`

✅ **Check**: You have the authorization code copied

---

### STEP 5: Exchange Code for Refresh Token

Now we'll exchange the authorization code for a refresh token.

1. Open a tool like **Postman**, **curl**, or use an online tool like **https://reqbin.com/**
2. Make a **POST** request to:
   ```
   https://oauth2.googleapis.com/token
   ```
3. Set **Content-Type** header to: `application/x-www-form-urlencoded`
4. Send this data in the body:
   ```
   client_id=YOUR_CLIENT_ID
   client_secret=YOUR_CLIENT_SECRET
   code=YOUR_AUTHORIZATION_CODE
   grant_type=authorization_code
   redirect_uri=http://localhost:3000/oauth/callback
   ```
   Replace:
   - `YOUR_CLIENT_ID` with your Client ID
   - `YOUR_CLIENT_SECRET` with your Client Secret
   - `YOUR_AUTHORIZATION_CODE` with the code from Step 4

**Using curl (command line):**
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_AUTHORIZATION_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://localhost:3000/oauth/callback"
```

**Using online tool (easier):**
1. Go to: **https://reqbin.com/**
2. Set method to **POST**
3. URL: `https://oauth2.googleapis.com/token`
4. Click **"Headers"** tab, add:
   - Key: `Content-Type`
   - Value: `application/x-www-form-urlencoded`
5. Click **"Body"** tab, select **"x-www-form-urlencoded"**
6. Add these fields:
   - `client_id`: Your Client ID
   - `client_secret`: Your Client Secret
   - `code`: Your authorization code
   - `grant_type`: `authorization_code`
   - `redirect_uri`: `http://localhost:3000/oauth/callback`
7. Click **"Send"**

5. You'll get a response like:
   ```json
   {
     "access_token": "ya29...",
     "expires_in": 3599,
     "refresh_token": "1//0g...",
     "scope": "https://www.googleapis.com/auth/youtube.upload",
     "token_type": "Bearer"
   }
   ```
6. **Copy the `refresh_token`** - this is your **permanent refresh token**!

👉 **Save this**:
- `YOUTUBE_REFRESH_TOKEN = ...`

✅ **Check**: You have the refresh token copied

---

### STEP 6: Add to Supabase Secrets

1. Go to your **Supabase Dashboard**
2. Go to **Settings** → **Edge Functions** → **Secrets**
3. Click **"Add new secret"**

**Add Secret 1: YOUTUBE_CLIENT_ID**
- **Name**: `YOUTUBE_CLIENT_ID`
- **Value**: Your Client ID (from Step 3)
- Click **"Add secret"**

**Add Secret 2: YOUTUBE_CLIENT_SECRET**
- **Name**: `YOUTUBE_CLIENT_SECRET`
- **Value**: Your Client Secret (from Step 3)
- Click **"Add secret"**

**Add Secret 3: YOUTUBE_REFRESH_TOKEN**
- **Name**: `YOUTUBE_REFRESH_TOKEN`
- **Value**: Your refresh token (from Step 5)
- Click **"Add secret"**

✅ **Check**: All three YouTube secrets are added

---

### ✅ YouTube Complete! 🎉

You now have:
- ✅ YouTube Client ID (permanent - save it once)
- ✅ YouTube Client Secret (permanent - save it once)
- ✅ YouTube Refresh Token (**PERMANENT - NEVER EXPIRES!**)

### 🔄 How Your Application Uses It:

**You don't need to do anything else!** Your application will:

1. **Automatically use the refresh token** to get new access tokens when needed
2. **Access tokens expire in 1 hour**, but the app automatically refreshes them using your permanent refresh token
3. **You never need to manually refresh** - it all happens automatically in the background
4. **The refresh token never expires** - you set it up once and it works forever!

### ⚠️ Important Notes:

- ✅ **Refresh token is PERMANENT** - it never expires unless you revoke it
- ✅ **No manual refresh needed** - your app handles it automatically
- ✅ **Set it up once** - then forget about it!
- ⚠️ **Only expires if**: You revoke access in your Google account settings
- ⚠️ **If revoked**: You'll need to repeat Steps 4-5 to get a new refresh token

### 🎯 You're Done!

**That's it!** You've set up YouTube permanently. The refresh token will work forever, and your application will automatically handle getting new access tokens when needed. **You never need to touch it again!**

---

## 📋 Final Checklist

### Facebook & Instagram:
- [ ] Facebook Page created
- [ ] Facebook Developer App created
- [ ] Long-lived Page Access Token obtained (60 days)
- [ ] `FACEBOOK_ACCESS_TOKEN` added to Supabase Secrets
- [ ] `INSTAGRAM_ACCESS_TOKEN` added to Supabase Secrets (same as Facebook)
- [ ] `FACEBOOK_PAGE_ID` added to Supabase Secrets (optional)
- [ ] `INSTAGRAM_ACCOUNT_ID` added to Supabase Secrets (optional, only if needed)

### YouTube:
- [ ] Google Cloud project created
- [ ] YouTube Data API v3 enabled
- [ ] OAuth 2.0 credentials created (Client ID & Secret)
- [ ] Authorization code obtained
- [ ] Refresh token obtained (permanent)
- [ ] `YOUTUBE_CLIENT_ID` added to Supabase Secrets
- [ ] `YOUTUBE_CLIENT_SECRET` added to Supabase Secrets
- [ ] `YOUTUBE_REFRESH_TOKEN` added to Supabase Secrets

---

## 🔄 Token Refresh Reminders

### Facebook/Instagram (Every 60 Days):
- Your tokens expire in 60 days
- Before expiration, repeat **Steps 7-9** from the Facebook section
- Update `FACEBOOK_ACCESS_TOKEN` and `INSTAGRAM_ACCESS_TOKEN` in Supabase Secrets

### YouTube (PERMANENT - Set Once, Works Forever!):
- ✅ Your refresh token is **PERMANENT** and **NEVER EXPIRES**
- ✅ **No manual refresh needed** - your application automatically uses it to get access tokens
- ✅ **Set it up once** - then it works forever!
- ⚠️ **Only expires if**: You revoke access in Google account settings
- ⚠️ **If revoked**: Repeat **Steps 4-5** from the YouTube section to get a new one

---

## 🆘 Troubleshooting

### Facebook: "Token expired"
- **Fix**: Repeat Steps 7-9 to get a new long-lived token
- **Tip**: Set a calendar reminder for 55 days from now

### Instagram: "Invalid user"
- **Fix**: Add `INSTAGRAM_ACCOUNT_ID` to Supabase Secrets (see Step 11)
- **Check**: Make sure Instagram is a Business Account connected to Facebook Page

### YouTube: "Invalid grant"
- **Fix**: The authorization code expires quickly - get a new one (Step 4)
- **Check**: Make sure you used `prompt=consent` in the authorization URL

### YouTube: "Access denied"
- **Fix**: Make sure you clicked "Allow" on the permission screen
- **Check**: Make sure redirect URI matches exactly in both places

---

## 🎉 You're Done!

Your app can now post to Facebook, Instagram, and YouTube automatically!

**Next Steps:**
1. Test posting from your app
2. Check Supabase Edge Functions logs if something doesn't work
3. Set a reminder to refresh Facebook tokens in 55 days (YouTube doesn't need this - it's permanent!)

**Need help?** Check the logs in:
- Supabase Dashboard → Edge Functions → `publish-social` → Logs
