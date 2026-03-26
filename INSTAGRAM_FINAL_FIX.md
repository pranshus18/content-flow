## Instagram Final Fix - App Has Connection, Need API Permissions

Good news: Instagram and Facebook Page are connected! ✅
Bad news: Your Facebook App still needs Instagram API permissions.

---

### STEP 1 – Test Current Connection

Let's verify the connection works:

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App** (top right dropdown)
3. Click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page**
5. Test 1: Type `981529221708901?fields=instagram_business_account`
6. Click **Submit**

**Expected:** You should see:
```json
{
  "instagram_business_account": {
    "id": "17841479735947096"
  }
}
```

**If this works:** ✅ Connection is good! Go to STEP 2.

**If this fails:** The connection might not be complete. Go to STEP 1B.

---

### STEP 1B – Verify Instagram is Connected to Page

1. Go back to `https://business.facebook.com/`
2. **Settings** → **Instagram Accounts**
3. Click on your Instagram account
4. Check **"Connected Assets"** or **"Connected Pages"**
5. Make sure your Facebook Page (`981529221708901`) is listed
6. If not, click **"Connect"** or **"Add"** and connect your Page

---

### STEP 2 – Check Available Permissions in Graph API Explorer

The app might already have Instagram, but we need to check:

1. In Graph API Explorer, click **Get Token** → **Get User Access Token**
2. In the popup, look at the list of available permissions
3. Scroll through and check if you see:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_manage_posts`
   - `pages_show_list`

**What you see:**
- ✅ **If you see Instagram permissions:** Your app has Instagram! You just need a token with these permissions. Go to STEP 3.
- ❌ **If you DON'T see Instagram permissions:** Your app doesn't have Instagram Product. Go to STEP 4.

---

### STEP 3 – Get Token with Instagram Permissions (If Available)

If you saw Instagram permissions in STEP 2:

1. In the **Get User Access Token** popup:
   - ✅ Check `pages_show_list`
   - ✅ Check `pages_manage_posts`
   - ✅ Check `instagram_basic` (if available)
   - ✅ Check `instagram_content_publish` (if available)
   - ✅ Check `business_management`
2. Click **Generate Access Token**
3. Then click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page**
5. Copy the **Page Access Token**
6. Exchange for long-lived token (see `GET_LONG_LIVED_TOKEN.md`)
7. Update `INSTAGRAM_ACCESS_TOKEN` in Supabase Secrets
8. Try publishing again!

---

### STEP 4 – Enable Instagram in App (If Permissions Not Available)

If you didn't see Instagram permissions, we need to enable Instagram in your app.

**Method A: Through App Dashboard**

1. Go to `https://developers.facebook.com/apps/875964825144424`
2. Look at the **main Dashboard page** (not sidebar)
3. Look for:
   - A **"+"** button (usually top right)
   - **"Add Platform"** button
   - **"Quick Start"** section with product cards
   - **"Tools"** menu item
4. If you see any of these, click and look for Instagram

**Method B: Check App Settings**

1. Go to **Settings** → **Basic** (left sidebar)
2. Scroll down to **"App Domains"** or **"Platforms"** section
3. Look for Instagram option
4. If you see it, enable it

**Method C: Use Direct URL (Try This First!)**

Try these URLs directly:

1. `https://developers.facebook.com/apps/875964825144424/instagram-graph-api/`
2. `https://developers.facebook.com/apps/875964825144424/instagram-basic-display/`
3. `https://developers.facebook.com/apps/875964825144424/settings/advanced/`

If any of these open, you're in the right place!

**Method D: Check App Review**

1. Go to **App Review** → **Permissions and Features** (left sidebar)
2. Look for Instagram-related permissions
3. If you see them but they're "Not Approved", that's okay for testing
4. For Development mode, you can use them without approval

---

### STEP 5 – Alternative: Use Instagram Basic Display API

If Instagram Graph API isn't available, you might need to use Basic Display:

1. Go to `https://developers.facebook.com/apps/875964825144424/instagram-basic-display/`
2. If this page opens, follow the setup
3. This is a different API but might work for your use case

**Note:** Basic Display API has limitations compared to Graph API.

---

### STEP 6 – Check App Mode

Make sure your app is in **Development Mode** (not Live):

1. Go to App Dashboard
2. Look at the top - it should say **"Development"** or **"Live"**
3. For testing, **Development Mode** is fine
4. If it's Live, you might need App Review (skip for now)

---

### STEP 7 – Test After Changes

After enabling Instagram or getting new token:

1. Test in Graph API Explorer:
   - Type: `17841479735947096?fields=id,username`
   - Should return your Instagram info
2. Update Supabase Secrets with new token
3. Try publishing from your app
4. Check logs - error (#10) should be gone!

---

## Quick Action Plan

**Right now, do this:**

1. ✅ **Test connection** (STEP 1) - Verify Instagram is connected to Page
2. ✅ **Check permissions** (STEP 2) - See if Instagram permissions are available
3. ✅ **If permissions exist:** Get new token (STEP 3)
4. ✅ **If permissions DON'T exist:** Try Method C direct URLs (STEP 4)

---

## Most Likely Solution

Since Instagram is connected in Business Settings, try this:

1. Go to Graph API Explorer
2. Get **User Access Token** (not Page token)
3. Check if `instagram_basic` or `instagram_content_publish` appear in the permissions list
4. If they appear, select them and generate token
5. Then get Page Access Token (it should inherit Instagram permissions)
6. Use that token in Supabase

**Try STEP 2 first - check if Instagram permissions are available in Graph API Explorer!**
