## Instagram Connection – Baby Steps Guide

You've successfully connected Facebook! 🎉  
Now let's connect Instagram **step by step**. Follow each step **one by one**. Do not skip ahead.

---

### STEP 0 – What you will achieve

After finishing this guide, you will:
- Have your **Instagram Business Account** connected to your platform
- Be able to **post images/videos** to Instagram from your platform
- Use the **same Facebook Page** you already set up

**Important**: Instagram requires a **Business Account** (not personal). It must be connected to your Facebook Page.

---

### STEP 1 – Convert Instagram to Business Account

1. Open **Instagram app** on your phone (or go to instagram.com)
2. Go to your **profile** (tap your profile picture)
3. Tap the **☰ menu** (three horizontal lines, top right)
4. Tap **Settings and privacy**
5. Tap **Account type and tools**
6. Tap **Switch to professional account**
7. Choose **Business** (not Creator)
8. Follow the prompts to connect to your **Facebook Page**
   - Select the **same Facebook Page** you used for Facebook posting
   - If you don't see your Page, make sure you're logged into the same Facebook account
9. Complete the setup

✅ **Check**: Your Instagram profile should now show "Business" or have a contact button

---

### STEP 2 – Get your Instagram Business Account ID

You need to find your Instagram Business Account ID (a number like `17841405309211844`).

**Method 1: Using Graph API Explorer (Recommended - Easiest)**

This method works even if your Instagram account isn't added to Business Portfolio yet.

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App** (same one you use for Facebook posting)
3. Click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page** (the one connected to Instagram)
5. In the search box, type: `me/accounts`
6. Click **Submit**
7. Find your Page in the results
8. Copy the **Page ID** (this is your Page ID, not Instagram ID yet)
   - From your `fb_page_details.txt`, your Page ID is: `981529221708901`
9. Now type in search box: `{PAGE_ID}?fields=instagram_business_account`
   - Replace `{PAGE_ID}` with the Page ID you just copied
   - Example: `981529221708901?fields=instagram_business_account`
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

**Method 2: Using Facebook Business Settings (Alternative)**

**Note**: This only works if your Instagram account is already added to your Business Portfolio.

1. Go to `https://business.facebook.com/`
2. Log in with the **same Facebook account** that manages your Page
3. Click **Settings** (gear icon, bottom left)
4. Click **Instagram accounts** (left sidebar)
5. If you see "No Instagram accounts added":
   - Click the **"+ Add"** button
   - Follow the prompts to connect your Instagram Business Account
   - You may need to log in to Instagram and grant permissions
6. Once your Instagram account appears, click on it
7. Look for **Instagram Account ID** - copy this number (it's a long number like `17841405309211844`)

✅ **Save this number** - you'll need it in Step 4

**If Method 2 shows "No Instagram accounts added":**
- Use **Method 1** (Graph API Explorer) instead - it's easier and doesn't require adding to Business Portfolio

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App** (same one you use for Facebook posting)
3. Click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page** (the one connected to Instagram)
5. In the search box, type: `me/accounts`
6. Click **Submit**
7. Find your Page in the results
8. Copy the **Page ID** (this is your Page ID, not Instagram ID yet)
9. Now type in search box: `{PAGE_ID}?fields=instagram_business_account`
   - Replace `{PAGE_ID}` with the Page ID you just copied
   - Example: `981529221708901?fields=instagram_business_account`
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

### STEP 3 – Get your Facebook Page Access Token (for Instagram)

Instagram uses the **same access token** as Facebook (your Page access token).

**Option A: If you already have a long-lived token**

If you already set up a long-lived Facebook Page Access Token (from `GET_LONG_LIVED_TOKEN.md`), you can use the **same token** for Instagram!

✅ **You can skip to Step 4** if you already have `FACEBOOK_ACCESS_TOKEN` in Supabase Secrets

**Option B: Get a new Page Access Token**

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App** (top right dropdown)
3. Click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page** (the one connected to Instagram)
5. Copy the **access_token** that appears
   - It will look like: `EAAUktfit6a0BO...` (very long string)

✅ **Save this token** - you'll use it in Step 4

---

### STEP 4 – Add Instagram credentials to Supabase Secrets

1. Go to your **Supabase Dashboard**: `https://app.supabase.com`
2. Select your project
3. Left sidebar → **Project Settings** (gear icon at bottom)
4. Click **Edge Functions** → **Secrets**
5. Click **Add new secret**

6. Add these **two secrets**:

   **Secret 1: INSTAGRAM_ACCESS_TOKEN**
   - **Name**: `INSTAGRAM_ACCESS_TOKEN`
   - **Value**: Paste your **Facebook Page Access Token** (from Step 3)
     - If you already have `FACEBOOK_ACCESS_TOKEN`, you can use the **same value**
   - Click **Save**

   **Secret 2: INSTAGRAM_ACCOUNT_ID** (Recommended)
   - **Name**: `INSTAGRAM_ACCOUNT_ID`
   - **Value**: Paste your **Instagram Business Account ID** (from Step 2)
     - Example: `17841405309211844`
   - Click **Save**

✅ **Done when**: You see both secrets listed in your Supabase Secrets page.

---

### STEP 5 – Test Instagram posting

Now let's test if it works:

1. Go to your app's **Admin Dashboard**
2. Find or create a piece of content that has:
   - ✅ Status: **"approved"** (green badge)
   - ✅ **Admin description** (caption) filled in
   - ✅ **Platform** set to **"instagram"**
   - ✅ **Media URL** is publicly accessible (HTTPS)
     - Must be an image or video
     - Must be accessible from the internet (not localhost)
3. Click the **"Publish Now"** button
4. Wait a few seconds...
5. Check your **Instagram account** – you should see the post! 🎉

✅ **Done when**: You see your post appear on your Instagram account!

---

### Troubleshooting

**Problem**: "Instagram API key not configured"
- **Fix**: Go back to **STEP 4** and make sure `INSTAGRAM_ACCESS_TOKEN` is saved correctly in Supabase Secrets

**Problem**: "Invalid Instagram account" or "Invalid user"
- **Fix**: Add `INSTAGRAM_ACCOUNT_ID` to Supabase Secrets with your Instagram Business Account ID (from Step 2)

**Problem**: "Missing Instagram permissions"
- **Fix**: Make sure your Instagram account is a **Business Account** and connected to your Facebook Page (Step 1)

**Problem**: "Media URL is not accessible"
- **Fix**: Make sure your media URL is:
  - Publicly accessible (not private)
  - Using HTTPS (not HTTP)
  - The file actually exists at that URL

**Problem**: Post doesn't appear on Instagram
- **Check**: Go to Instagram → Profile → Posts
- **Wait**: Instagram posts can take 10-30 seconds to appear
- **Verify**: Check Supabase Dashboard → Edge Functions → `publish-social` → Logs for errors

---

### Quick Checklist

Before posting to Instagram, make sure:

- [ ] Instagram account is **Business Account** (not personal)
- [ ] Instagram Business Account is **connected to Facebook Page**
- [ ] Facebook Page exists and you're admin
- [ ] `INSTAGRAM_ACCESS_TOKEN` is set in Supabase Secrets (use Facebook Page token)
- [ ] `INSTAGRAM_ACCOUNT_ID` is set in Supabase Secrets (recommended)
- [ ] Post has **platform** set to `instagram`
- [ ] Post has **admin_description** (caption) filled in
- [ ] Media URL is **publicly accessible** via HTTPS

---

### What's Next?

Once Instagram is working:
- ✅ You can post images and videos to Instagram
- ✅ Analytics (likes, comments) will work automatically
- ✅ You can schedule Instagram posts (same as Facebook)

**Need help?** Check the logs in Supabase Dashboard → Edge Functions → `publish-social` → Logs

---

### Quick Reference

**Supabase Secrets Needed:**
- `INSTAGRAM_ACCESS_TOKEN` = (your Facebook Page Access Token - same as Facebook)
- `INSTAGRAM_ACCOUNT_ID` = (your Instagram Business Account ID from Step 2)

**API Endpoint Used:**
- `POST https://graph.facebook.com/v18.0/{INSTAGRAM_ACCOUNT_ID}/media` (create container)
- `POST https://graph.facebook.com/v18.0/{INSTAGRAM_ACCOUNT_ID}/media_publish` (publish)

---

**When you're done with all steps and your test post appears on Instagram, tell the AI assistant:**
> "I finished INSTAGRAM_CONNECTION_BABY_STEPS.md and my post appeared on Instagram! What's next?"
