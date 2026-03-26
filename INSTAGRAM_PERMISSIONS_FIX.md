## Instagram Permissions Fix – Step by Step

You're getting "Missing Instagram permissions" error. Let's fix this step by step.

---

### STEP 1 – Verify Instagram Account is Connected to Facebook Page

First, let's verify your Instagram account is actually connected to your Facebook Page.

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App** (top right dropdown)
3. Click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page** (Page ID: `981529221708901`)
5. In the search box, type: `981529221708901?fields=instagram_business_account`
6. Click **Submit**

**Expected Result:**
```json
{
  "instagram_business_account": {
    "id": "17841479735947096"
  }
}
```

**If you see this**: ✅ Your Instagram is connected! Go to STEP 2.

**If you see an error or empty result**: ❌ Your Instagram is NOT connected. Go to STEP 1B.

---

### STEP 1B – Connect Instagram to Facebook Page (If Not Connected)

If Step 1 didn't show your Instagram account:

1. Open **Instagram app** on your phone
2. Go to your **profile**
3. Tap **☰ menu** → **Settings and privacy**
4. Tap **Account type and tools**
5. Make sure it says **"Business Account"**
6. Tap **Page** (under "Business tools")
7. Make sure your Facebook Page (`981529221708901`) is selected
8. If not, tap **Connect to Facebook Page** and select your Page

Then go back to **STEP 1** and verify again.

---

### STEP 2 – Check Facebook App Permissions

Your Facebook App needs Instagram permissions. Let's check:

1. Go to `https://developers.facebook.com/apps/`
2. Click on your app (App ID: `875964825144424`)
3. In the left sidebar, click **Products** (or **Add Product**)
4. Look for **Instagram** in the list
5. If you see **Instagram** → Click it → Make sure it's **configured**
6. If you DON'T see **Instagram** → Click **Add Product** → Find **Instagram** → Click **Set Up**

**What to check in Instagram Product settings:**
- ✅ **Instagram Basic Display** or **Instagram Graph API** should be enabled
- ✅ **Valid OAuth Redirect URIs** should be set (can be `https://localhost` for testing)

---

### STEP 3 – Verify Access Token Has Instagram Permissions

Let's check if your access token has Instagram permissions:

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App**
3. Click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page**
5. In the search box, type: `debug_token?input_token={YOUR_ACCESS_TOKEN}`
   - Replace `{YOUR_ACCESS_TOKEN}` with your actual token
   - Or use: `me?fields=id,name`
6. Click **Submit**
7. Look at the **scopes** or **permissions** in the response

**What you need:**
- ✅ `pages_manage_posts` (you have this)
- ✅ `instagram_basic` or `instagram_content_publish` (might be missing)

---

### STEP 4 – Get a New Page Access Token with Instagram Permissions

If your token doesn't have Instagram permissions, get a new one:

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App**
3. Click **Get Token** → **Get User Access Token**
4. In the popup, make sure these permissions are checked:
   - ✅ `pages_show_list`
   - ✅ `pages_manage_posts`
   - ✅ `instagram_basic` (if available)
   - ✅ `instagram_content_publish` (if available)
   - ✅ `business_management` (if available)
5. Click **Generate Access Token**
6. Then click **Get Token** → **Get Page Access Token**
7. Select your **Facebook Page**
8. Copy the new **Page Access Token**

**Important**: This token will be temporary. You'll need to exchange it for a long-lived token.

---

### STEP 5 – Exchange for Long-Lived Token (If Needed)

If you got a new token in Step 4, make it long-lived:

1. In Graph API Explorer, make sure you have your **Page Access Token** selected
2. In the search box, type:
   ```
   oauth/access_token?grant_type=fb_exchange_token&client_id=875964825144424&client_secret=b30833d4b100675e3197c3e987ea4de2&fb_exchange_token={YOUR_PAGE_TOKEN}
   ```
   - Replace `{YOUR_PAGE_TOKEN}` with your Page Access Token
3. Change method to **POST**
4. Click **Submit**
5. Copy the new **access_token** from the response

---

### STEP 6 – Update Supabase Secrets

Update your Supabase Secrets with the new token:

1. Go to `https://app.supabase.com`
2. Select your project
3. **Settings** → **Edge Functions** → **Secrets**
4. Update **INSTAGRAM_ACCESS_TOKEN** with your new token
5. Also update **FACEBOOK_ACCESS_TOKEN** (use the same token for both)

---

### STEP 7 – Test Instagram Connection

Test if it works:

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App**
3. Use your **Page Access Token** (the long-lived one)
4. In the search box, type: `17841479735947096?fields=id,username`
   - Replace with your Instagram Account ID
5. Click **Submit**

**If you see your Instagram account info**: ✅ It works! Try publishing again.

**If you see an error**: The token still doesn't have permissions. Go back to STEP 4.

---

### STEP 8 – Test Publishing

Once Step 7 works:

1. Go to your **Admin Dashboard**
2. Find content with:
   - ✅ Platform: `instagram`
   - ✅ Admin description filled in
   - ✅ Media URL (HTTPS, publicly accessible)
3. Click **Publish Now**
4. Check your Instagram account!

---

### Common Issues

**Issue**: "Invalid user" or "Invalid account"
- **Fix**: Make sure `INSTAGRAM_ACCOUNT_ID` in Supabase Secrets matches the ID from Step 1

**Issue**: "Token expired"
- **Fix**: Get a new long-lived token (Step 5) and update Supabase Secrets

**Issue**: "App not approved"
- **Fix**: For testing, your app should work in Development mode. Make sure your app is in Development mode (not Live mode) if you haven't gone through App Review.

---

### Quick Checklist

Before trying again, make sure:

- [ ] Instagram account is **Business Account**
- [ ] Instagram is **connected to Facebook Page** (Step 1)
- [ ] Facebook App has **Instagram Product** enabled (Step 2)
- [ ] Access token has **Instagram permissions** (Step 3)
- [ ] `INSTAGRAM_ACCESS_TOKEN` is updated in Supabase Secrets
- [ ] `INSTAGRAM_ACCOUNT_ID` is `17841479735947096` in Supabase Secrets

---

**After completing all steps, try publishing again!**
