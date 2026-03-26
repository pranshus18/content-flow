## Enable Instagram Permissions - App Review Method

Your Instagram is connected ✅, but your App needs Instagram permissions. Here's how to enable them:

---

### STEP 1 – Check Current Permissions

First, let's see what permissions your app currently has:

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App** (top right dropdown)
3. Click **Get Token** → **Get User Access Token**
4. In the popup, look at the list of permissions
5. **Do you see any of these?**
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_comments`
   - `instagram_manage_insights`

**If you see them**: ✅ Permissions exist, you just need a token with them (go to STEP 3)

**If you DON'T see them**: ❌ Need to request permissions (go to STEP 2)

---

### STEP 2 – Request Instagram Permissions via App Review

If Instagram permissions are not listed, you need to request them:

1. Go to `https://developers.facebook.com/apps/875964825144424`
2. In the left sidebar, click **App Review** → **Permissions and Features**
3. Look for these permissions in the list:
   - **`instagram_basic`** - Basic Instagram access
   - **`instagram_content_publish`** - Publish to Instagram (this is what you need!)
   - **`pages_read_engagement`** - Read Page engagement
   - **`pages_manage_posts`** - Manage Page posts

4. For each permission you need:
   - Click **Request** or **Add** button next to it
   - Fill in the required information:
     - **Use Case**: "Posting content to Instagram Business Account"
     - **Instructions**: "User wants to publish images/videos to their Instagram Business Account connected to their Facebook Page"
   - Submit the request

**Note**: For Development Mode apps, some permissions might be available immediately without review.

---

### STEP 3 – Check App Review Status

1. Go to **App Review** → **Permissions and Features**
2. Look for Instagram permissions you requested
3. Check their status:
   - **✅ Approved** - Ready to use!
   - **⏳ In Review** - Wait for approval
   - **❌ Not Requested** - Go back to STEP 2

---

### STEP 4 – For Development Mode (Testing)

If your app is in **Development Mode**:

1. Go to **App Review** → **Permissions and Features**
2. Some permissions might show as **"Available for Testing"**
3. These can be used immediately without review
4. Look for `instagram_content_publish` - if it says "Available for Testing", you can use it!

---

### STEP 5 – Get Token with Instagram Permissions

Once permissions are available:

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App**
3. Click **Get Token** → **Get User Access Token**
4. In the popup, **check these permissions**:
   - ✅ `pages_show_list`
   - ✅ `pages_manage_posts`
   - ✅ `instagram_basic` (if available)
   - ✅ `instagram_content_publish` (if available - THIS IS KEY!)
   - ✅ `business_management`
5. Click **Generate Access Token**
6. **Important**: You'll see a warning about permissions - click **Continue** or **Allow**
7. Then click **Get Token** → **Get Page Access Token**
8. Select your **Facebook Page**
9. Copy the **Page Access Token**

---

### STEP 6 – Exchange for Long-Lived Token

1. In Graph API Explorer, make sure your **Page Access Token** is selected
2. Change method to **POST**
3. In the search box, type: `oauth/access_token`
4. Add these parameters:
   - `grant_type` = `fb_exchange_token`
   - `client_id` = `875964825144424`
   - `client_secret` = `b30833d4b100675e3197c3e987ea4de2`
   - `fb_exchange_token` = `{YOUR_PAGE_TOKEN}` (paste your Page Access Token)
5. Click **Submit**
6. Copy the new **access_token** from the response

---

### STEP 7 – Test Instagram Access

Before updating Supabase, test if the token works:

1. In Graph API Explorer, use your new long-lived token
2. Type: `17841479735947096?fields=id,username`
3. Click **Submit**

**Expected**: You should see your Instagram account info

**If error**: The token still doesn't have permissions - go back to STEP 5

---

### STEP 8 – Update Supabase Secrets

1. Go to `https://app.supabase.com`
2. **Settings** → **Edge Functions** → **Secrets**
3. Update **INSTAGRAM_ACCESS_TOKEN** with your new long-lived token
4. Also update **FACEBOOK_ACCESS_TOKEN** (use the same token)
5. Make sure **INSTAGRAM_ACCOUNT_ID** = `17841479735947096`

---

### STEP 9 – Test Publishing

1. Wait 30 seconds for secrets to propagate
2. Go to your Admin Dashboard
3. Try publishing to Instagram
4. Check logs - error (#10) should be gone!

---

## Quick Checklist

- [ ] Checked Graph API Explorer for Instagram permissions (STEP 1)
- [ ] Requested Instagram permissions in App Review (STEP 2)
- [ ] Got new token with Instagram permissions (STEP 5)
- [ ] Exchanged for long-lived token (STEP 6)
- [ ] Tested Instagram access (STEP 7)
- [ ] Updated Supabase Secrets (STEP 8)
- [ ] Tried publishing again (STEP 9)

---

## Most Important Step

**Start with STEP 1** - Check if Instagram permissions are available in Graph API Explorer. If they are, you just need a new token. If not, you need to request them through App Review.

**Tell me what you see in STEP 1!**
