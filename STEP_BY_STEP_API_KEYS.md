# Step-by-Step Guide: Get All 7 API Keys

## 📋 Quick Overview

You need **7 API keys** total:
- **Twitter**: 4 keys
- **Facebook**: 1 key
- **Instagram**: 1 key (usually same as Facebook)
- **LinkedIn**: 1 key

**Estimated Time**: 2-3 hours (depending on platform approvals)

---

## 🐦 PART 1: Twitter API Keys (4 keys)

### Step 1: Create Twitter Developer Account

1. Go to: https://developer.twitter.com/en/portal/dashboard
2. Click **"Sign up"** or **"Apply"**
3. Fill out the application:
   - **Use case**: Select "Making bots" or "Exploring the API"
   - **App description**: "Content publishing automation tool"
   - Accept terms and submit
4. Wait for approval (usually instant, but can take a few hours)

### Step 2: Create Twitter App

1. Once approved, go to: https://developer.twitter.com/en/portal/dashboard
2. Click **"Create App"** or **"Create Project"**
3. Fill in:
   - **App name**: "ContentFlow Publishing" (or any name)
   - **App environment**: Select "Development" or "Production"
4. Click **"Create"**

### Step 3: Get Consumer Key & Secret

1. In your app dashboard, go to **"Keys and Tokens"** tab
2. You'll see:
   - **API Key** → This is your `TWITTER_CONSUMER_KEY`
   - **API Key Secret** → This is your `TWITTER_CONSUMER_SECRET`
3. Click **"Show"** to reveal secrets
4. **Copy both immediately** (you can't see them again!)

### Step 4: Generate Access Token

1. Scroll down to **"Access Token and Secret"** section
2. Click **"Generate"** button
3. Copy:
   - **Access Token** → This is your `TWITTER_ACCESS_TOKEN`
   - **Access Token Secret** → This is your `TWITTER_ACCESS_TOKEN_SECRET`

### Step 5: Set App Permissions

1. Go to **"Settings"** tab
2. Under **"App permissions"**, select:
   - ✅ **Read and Write** (required for posting)
3. Click **"Save"**

### Step 6: Enable OAuth 1.0a

1. In **"Settings"** tab
2. Under **"User authentication settings"**:
   - Enable **OAuth 1.0a**
   - Set **Callback URL**: `http://localhost:3000` (or your app URL)
   - Set **Website URL**: Your app URL
3. Click **"Save"**

### Step 7: Request Elevated Access

1. Go to: https://developer.twitter.com/en/portal/dashboard
2. Click on your app
3. Go to **"Settings"** → **"User authentication settings"**
4. Click **"Set up"** or **"Edit"**
5. Request **Elevated access** (free tier allows posting)

### ✅ Twitter Keys Summary

You now have:
- ✅ `TWITTER_CONSUMER_KEY` = API Key
- ✅ `TWITTER_CONSUMER_SECRET` = API Key Secret
- ✅ `TWITTER_ACCESS_TOKEN` = Access Token
- ✅ `TWITTER_ACCESS_TOKEN_SECRET` = Access Token Secret

---

## 📘 PART 2: Facebook Access Token (1 key)

### Step 1: Create Facebook App

1. Go to: https://developers.facebook.com/
2. Click **"My Apps"** → **"Create App"**
3. Select **"Business"** as app type
4. Fill in:
   - **App name**: "ContentFlow" (or any name)
   - **App contact email**: Your email
5. Click **"Create App"**

### Step 2: Add Facebook Login Product

1. In your app dashboard, find **"Add Products"**
2. Click **"Set Up"** on **"Facebook Login"**
3. Select **"Web"** platform
4. Enter **Site URL**: `http://localhost:3000` (or your app URL)
5. Click **"Save"**

### Step 3: Configure App Settings

1. Go to **"Settings"** → **"Basic"**
2. Add:
   - **App Domains**: Your domain (e.g., `yourdomain.com`)
   - **Privacy Policy URL**: Your privacy policy URL (can be a placeholder)
   - **Terms of Service URL**: Your terms URL (can be a placeholder)
3. Click **"Save Changes"**

### Step 4: Get User Access Token

1. Go to: https://developers.facebook.com/tools/explorer/
2. Select your app from the dropdown (top right)
3. Click **"Generate Access Token"**
4. Select permissions:
   - ✅ `pages_manage_posts`
   - ✅ `pages_read_engagement`
   - ✅ `pages_show_list`
5. Click **"Generate Access Token"**
6. **Copy the token** (this is a **short-lived token**, expires in 1-2 hours)

### Step 5: Get Page Access Token

1. In Graph API Explorer, use this query:
   ```
   GET /me/accounts
   ```
2. Click **"Submit"**
3. This returns your pages with their access tokens
4. **Copy the Page Access Token** for the page you want to post to
   - Look for `access_token` in the response
   - This is the token for your Facebook Page

### Step 6: Exchange for Long-Lived Token

1. In Graph API Explorer, use this query:
   ```
   GET /oauth/access_token
   ```
2. Add these parameters:
   - `grant_type`: `fb_exchange_token`
   - `client_id`: Your App ID (from Settings → Basic)
   - `client_secret`: Your App Secret (from Settings → Basic → Show)
   - `fb_exchange_token`: Your Page Access Token (from Step 5)
3. Click **"Submit"**
4. **Copy the `access_token`** from response
   - This is your **long-lived token** (expires in 60 days)
   - This is your `FACEBOOK_ACCESS_TOKEN`

### ✅ Facebook Key Summary

You now have:
- ✅ `FACEBOOK_ACCESS_TOKEN` = Long-lived Page Access Token

**Note**: This token expires in 60 days. You'll need to refresh it before expiration.

---

## 📷 PART 3: Instagram Access Token (1 key)

### Step 1: Connect Instagram to Facebook Page

1. Go to your **Facebook Page** (not your personal profile)
2. Click **"Settings"** → **"Instagram"**
3. Click **"Connect Account"**
4. Log in with your **Instagram Business** or **Creator** account
   - ⚠️ **Important**: Must be Business or Creator account, NOT personal
5. Authorize the connection

### Step 2: Verify Instagram Access Token

1. The Instagram Access Token is usually the **same as your Facebook Page Access Token**
2. Test it in Graph API Explorer:
   ```
   GET /me/accounts
   ```
3. Find your page and note the `access_token`
4. This token should work for both Facebook and Instagram

### Step 3: Get Instagram Business Account ID (Optional)

1. In Graph API Explorer:
   ```
   GET /me/accounts
   ```
2. Find your page and note the **Page ID**
3. Then get Instagram account:
   ```
   GET /{PAGE_ID}?fields=instagram_business_account
   ```
4. Copy the **Instagram Business Account ID** (optional, only if `/me/` doesn't work)

### ✅ Instagram Key Summary

You now have:
- ✅ `INSTAGRAM_ACCESS_TOKEN` = Usually same as Facebook Page Access Token

**Note**: If Instagram publishing fails with "Invalid user", you may need to add `INSTAGRAM_ACCOUNT_ID` (from Step 3 above).

---

## 💼 PART 4: LinkedIn Access Token (1 key)

### Step 1: Create LinkedIn App

1. Go to: https://www.linkedin.com/developers/
2. Sign in with your LinkedIn account
3. Click **"Create app"**
4. Fill in:
   - **App name**: "ContentFlow" (or any name)
   - **LinkedIn Page**: Select your company page (or create one)
   - **Privacy policy URL**: Your privacy policy URL
   - **App logo**: Upload a logo (optional)
5. Accept terms and click **"Create app"**

### Step 2: Request API Products

1. In your app dashboard, go to **"Products"** tab
2. Request access to:
   - ✅ **Share on LinkedIn** (required for posting)
   - ✅ **Sign In with LinkedIn** (optional)
3. Click **"Request"** and wait for approval (usually instant)

### Step 3: Configure Auth Settings

1. Go to **"Auth"** tab
2. Add **Redirect URLs**:
   - `http://localhost:3000` (for development)
   - `https://yourdomain.com` (for production)
3. Under **OAuth 2.0 scopes**, select:
   - ✅ `w_member_social` (Write posts on user's behalf)
   - ✅ `r_liteprofile` (Read basic profile)
4. Click **"Update"**

### Step 4: Get Client ID and Secret

1. In **"Auth"** tab, you'll see:
   - **Client ID** → Copy this
   - **Client Secret** → Click **"Show"** and copy

### Step 5: Generate Access Token

**Option A: Using LinkedIn OAuth Test Tool (Easiest)**

1. Go to: https://www.linkedin.com/developers/tools/oauth
2. Select your app
3. Select scopes: `w_member_social`, `r_liteprofile`
4. Click **"Request token"**
5. Authorize the app
6. **Copy the Access Token**
   - This is your `LINKEDIN_ACCESS_TOKEN`

**Option B: Using OAuth 2.0 Flow (For Production)**

1. Build OAuth flow in your app
2. User authorizes → Get authorization code
3. Exchange code for access token:
   ```
   POST https://www.linkedin.com/oauth/v2/accessToken
   Content-Type: application/x-www-form-urlencoded
   
   grant_type=authorization_code&
   code={AUTHORIZATION_CODE}&
   redirect_uri={REDIRECT_URI}&
   client_id={CLIENT_ID}&
   client_secret={CLIENT_SECRET}
   ```

### Step 6: Verify Token Works

Test the token:
```
GET https://api.linkedin.com/v2/userinfo
Headers:
  Authorization: Bearer {ACCESS_TOKEN}
```

If successful, you'll see your profile info.

### ✅ LinkedIn Key Summary

You now have:
- ✅ `LINKEDIN_ACCESS_TOKEN` = Access Token from OAuth Test Tool or OAuth flow

**Note**: This token expires in 60 days. You'll need to refresh it before expiration.

---

## 📝 Final Checklist

### All 7 Keys Ready:

- [ ] `TWITTER_CONSUMER_KEY` - From Twitter App → Keys and Tokens → API Key
- [ ] `TWITTER_CONSUMER_SECRET` - From Twitter App → Keys and Tokens → API Key Secret
- [ ] `TWITTER_ACCESS_TOKEN` - From Twitter App → Keys and Tokens → Access Token
- [ ] `TWITTER_ACCESS_TOKEN_SECRET` - From Twitter App → Keys and Tokens → Access Token Secret
- [ ] `FACEBOOK_ACCESS_TOKEN` - Long-lived Page Access Token (from Graph API Explorer)
- [ ] `INSTAGRAM_ACCESS_TOKEN` - Usually same as Facebook Page Access Token
- [ ] `LINKEDIN_ACCESS_TOKEN` - From LinkedIn OAuth Test Tool

### Optional (only if needed):

- [ ] `INSTAGRAM_ACCOUNT_ID` - Only if Instagram publishing fails with "Invalid user"

---

## 🚀 Next Steps

Once you have all keys:

1. **Add to Supabase Secrets**:
   - Go to: Supabase Dashboard → Settings → Edge Functions → Secrets
   - Add each key one by one
   - See `HOW_TO_ADD_API_KEYS.md` for details

2. **Deploy Function**:
   ```bash
   supabase functions deploy publish-social
   ```

3. **Test Publishing**:
   - Create content with admin_description
   - Click "Publish Now"
   - Check logs

---

## 🆘 Troubleshooting

### Twitter: "Forbidden" or "403"
- ✅ Ensure OAuth 1.0a is enabled
- ✅ Check app has "Read and Write" permissions
- ✅ Verify Elevated access is granted

### Facebook/Instagram: "Invalid OAuth access token"
- ✅ Regenerate Page Access Token
- ✅ Check token is long-lived (60 days)
- ✅ Verify Page is connected to Instagram account

### LinkedIn: "Insufficient permissions"
- ✅ Request `w_member_social` scope
- ✅ Check app products are approved
- ✅ Verify token has correct scopes

### Instagram: "Invalid user"
- ✅ Add `INSTAGRAM_ACCOUNT_ID` to Supabase Secrets
- ✅ Get it from: Graph API Explorer → `GET /me/accounts` → `instagram_business_account.id`

---

## 📚 Additional Resources

- **Twitter API Docs**: https://developer.twitter.com/en/docs
- **Facebook Graph API**: https://developers.facebook.com/docs/graph-api
- **Instagram API**: https://developers.facebook.com/docs/instagram-api
- **LinkedIn API**: https://learn.microsoft.com/en-us/linkedin/

---

**Good luck!** 🎉 Take your time with each platform - some approvals can take a few hours.
