## Instagram Posting – Baby Steps Guide

This guide will help you connect Instagram to your platform **step by step**.  
Follow each step **one by one**. Do not skip ahead.

---

### STEP 0 – What you will achieve

After finishing this guide, you will:
- Have an **Instagram Business Account** connected to your Facebook Page
- Have the **access token** needed to post to Instagram
- Be able to **post images/videos** to Instagram from your platform

**Important**: Instagram requires a **Business Account** (not personal). It must be connected to a Facebook Page.

---

### STEP 1 – Convert Instagram to Business Account

1. Open **Instagram app** on your phone (or go to instagram.com)
2. Go to your **profile** (tap your profile picture)
3. Tap the **☰ menu** (top right)
4. Tap **Settings and privacy**
5. Tap **Account type and tools**
6. Tap **Switch to professional account**
7. Choose **Business** (not Creator)
8. Follow the prompts to connect to your **Facebook Page**
   - If you don't have a Facebook Page, create one first (see Facebook setup guide)
   - Select your Facebook Page when prompted
9. Complete the setup

✅ **Check**: Your Instagram profile should now show "Business" or have a contact button

---

### STEP 2 – Get your Instagram Business Account ID

You need to find your Instagram Business Account ID (a number like `123456789`).

**Method 1: Using Facebook Business Settings (Easiest)**

1. Go to `https://business.facebook.com/`
2. Log in with the Facebook account that manages your Page
3. Click **Settings** (gear icon, bottom left)
4. Click **Instagram accounts** (left sidebar)
5. You should see your Instagram account listed
6. Click on your Instagram account
7. Look for **Instagram Account ID** - copy this number (it's a long number like `17841405309211844`)

**Method 2: Using Graph API Explorer**

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App** (same one you use for Facebook posting)
3. In the **Get Token** dropdown, select **Get Page Access Token**
4. Select your **Facebook Page**
5. In the search box, type: `me/accounts`
6. Click **Submit**
7. Find your Page in the results
8. Copy the **Page ID** (this is your Page ID, not Instagram ID yet)
9. Now type in search box: `{PAGE_ID}?fields=instagram_business_account`
   - Replace `{PAGE_ID}` with the Page ID you just copied
10. Click **Submit**
11. You'll see something like:
    ```json
    {
      "instagram_business_account": {
        "id": "17841405309211844"
      }
    }
    ```
12. Copy the **id** number - this is your Instagram Business Account ID

✅ **Save this number** - you'll need it in Step 4

---

### STEP 3 – Get your Facebook Page Access Token

Instagram uses the **same access token** as Facebook (your Page access token).

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App** (top right dropdown)
3. Click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page** (the one connected to Instagram)
5. Copy the **access_token** that appears
   - It will look like: `EAAUktfit6a0BO...` (very long string)

✅ **Save this token** - you'll use it in Step 4

---

### STEP 4 – Add tokens to Supabase Secrets

1. Go to your **Supabase Dashboard**: `https://supabase.com/dashboard/project/uzmjedaumxbqkmpvvpnh`
2. Click **Settings** (gear icon, left sidebar)
3. Click **Edge Functions** (under Project Settings)
4. Scroll to **Secrets**
5. Add/Update these secrets:

   **Secret 1: INSTAGRAM_ACCESS_TOKEN**
   - **Name**: `INSTAGRAM_ACCESS_TOKEN`
   - **Value**: Paste your **Facebook Page Access Token** (from Step 3)
   - Click **Add secret** or **Update**

   **Secret 2: INSTAGRAM_ACCOUNT_ID** (Optional but recommended)
   - **Name**: `INSTAGRAM_ACCOUNT_ID`
   - **Value**: Paste your **Instagram Business Account ID** (from Step 2)
   - Click **Add secret** or **Update**

✅ **Check**: Both secrets should be listed in your Secrets section

---

### STEP 5 – Test Instagram posting

1. Go to your **Admin Dashboard** in your app
2. Create or select a **published post** with an image
3. Make sure the post has:
   - ✅ **Platform** set to `instagram`
   - ✅ **Status** is `published` or `approved`
   - ✅ **Media URL** is publicly accessible (HTTPS)
4. Click **Publish** (or republish if already published)
5. Wait a few seconds
6. Check your **Instagram account** - the post should appear!

---

### TROUBLESHOOTING

**Problem**: "Instagram API key not configured"
- **Fix**: Make sure `INSTAGRAM_ACCESS_TOKEN` is set in Supabase Secrets

**Problem**: "Invalid Instagram account" or "Invalid user"
- **Fix**: Add `INSTAGRAM_ACCOUNT_ID` to Supabase Secrets with your Instagram Business Account ID

**Problem**: "Missing Instagram permissions"
- **Fix**: Make sure your Instagram account is a **Business Account** and connected to your Facebook Page

**Problem**: "Media URL is not accessible"
- **Fix**: Make sure your media URL is:
  - Publicly accessible (not private)
  - Using HTTPS (not HTTP)
  - The file actually exists at that URL

**Problem**: Post doesn't appear on Instagram
- **Check**: Go to Instagram → Profile → Posts
- **Wait**: Instagram posts can take 10-30 seconds to appear
- **Verify**: Check Supabase Edge Functions → `publish-social` → Logs for errors

---

### QUICK CHECKLIST

Before posting to Instagram, make sure:

- [ ] Instagram account is **Business Account** (not personal)
- [ ] Instagram Business Account is **connected to Facebook Page**
- [ ] Facebook Page exists and you're admin
- [ ] `INSTAGRAM_ACCESS_TOKEN` is set in Supabase Secrets (use Facebook Page token)
- [ ] `INSTAGRAM_ACCOUNT_ID` is set in Supabase Secrets (optional but recommended)
- [ ] Post has **platform** set to `instagram`
- [ ] Media URL is **publicly accessible** via HTTPS

---

### NEXT STEPS

Once Instagram is working:
- ✅ You can post images and videos to Instagram
- ✅ Analytics (likes, comments) will work automatically
- ✅ You can schedule Instagram posts (same as Facebook)

**Need help?** Check the logs in Supabase Dashboard → Edge Functions → `publish-social` → Logs
