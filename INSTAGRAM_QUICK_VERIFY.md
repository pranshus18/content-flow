## Instagram Quick Verification Steps

Your Instagram is already a Business Account ✅. Now let's verify the connection and fix permissions.

---

### STEP 1 – Verify Instagram is Connected to Facebook Page

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App** (top right dropdown)
3. Click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page** (Page ID: `981529221708901`)
5. In the search box, type: `981529221708901?fields=instagram_business_account`
6. Click **Submit**

**What you should see:**
```json
{
  "instagram_business_account": {
    "id": "17841479735947096"
  }
}
```

**If you see this**: ✅ Instagram is connected! Go to STEP 2.

**If you see an error or empty result**: ❌ Instagram is NOT connected. Go to STEP 1B.

---

### STEP 1B – Connect Instagram to Facebook Page (If Not Connected)

1. In your **Instagram app**, go to your **profile**
2. Tap **☰ menu** (three lines, top right)
3. Tap **Settings and privacy**
4. Tap **Account type and tools**
5. Tap **Page** (under "Business tools")
6. If you see "No Facebook Page connected":
   - Tap **Connect to Facebook Page**
   - Select your Facebook Page
   - Grant permissions
7. If you see your Page listed, make sure it's the correct one (Page ID: `981529221708901`)

Then go back to **STEP 1** and verify again.

---

### STEP 2 – Check Facebook App Has Instagram Product

1. Go to `https://developers.facebook.com/apps/875964825144424`
2. In the left sidebar, look for **Products**
3. Check if **Instagram** is listed
   - If you see **Instagram** → Click it → Make sure it says "Configured" or "Active"
   - If you DON'T see **Instagram** → Continue to STEP 2B

---

### STEP 2B – Add Instagram Product to Facebook App

1. In your Facebook App dashboard, click **Add Product** (or look for **Products** in left sidebar)
2. Find **Instagram** in the list
3. Click **Set Up** next to Instagram
4. You'll see Instagram Graph API settings
5. Make sure **Instagram Graph API** is enabled
6. Save the settings

✅ **Done when**: You see "Instagram" in your Products list.

---

### STEP 3 – Test Instagram API Access

Let's test if your token can access Instagram:

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App**
3. Click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page**
5. In the search box, type: `17841479735947096?fields=id,username`
   - This is your Instagram Account ID
6. Click **Submit**

**Expected Result:**
```json
{
  "id": "17841479735947096",
  "username": "your_instagram_username"
}
```

**If you see this**: ✅ Token works! Go to STEP 4.

**If you see an error**: The token doesn't have Instagram permissions. Go to STEP 3B.

---

### STEP 3B – Get New Token with Instagram Permissions

1. In Graph API Explorer, click **Get Token** → **Get User Access Token**
2. In the popup, check these permissions:
   - ✅ `pages_show_list`
   - ✅ `pages_manage_posts`
   - ✅ `instagram_basic` (if available)
   - ✅ `instagram_content_publish` (if available)
   - ✅ `business_management`
3. Click **Generate Access Token**
4. Then click **Get Token** → **Get Page Access Token**
5. Select your **Facebook Page**
6. Copy the **Page Access Token**

**Important**: This token is temporary. Exchange it for a long-lived token.

---

### STEP 4 – Exchange for Long-Lived Token

1. In Graph API Explorer, make sure your **Page Access Token** is selected
2. Change method to **POST**
3. In the search box, type:
   ```
   oauth/access_token
   ```
4. Click **Add a Parameter**:
   - Name: `grant_type` → Value: `fb_exchange_token`
   - Name: `client_id` → Value: `875964825144424`
   - Name: `client_secret` → Value: `b30833d4b100675e3197c3e987ea4de2`
   - Name: `fb_exchange_token` → Value: `{YOUR_PAGE_TOKEN}`
     - Replace `{YOUR_PAGE_TOKEN}` with your Page Access Token
5. Click **Submit**
6. Copy the new **access_token** from the response

---

### STEP 5 – Update Supabase Secrets

1. Go to `https://app.supabase.com`
2. Select your project
3. **Settings** → **Edge Functions** → **Secrets**
4. Update **INSTAGRAM_ACCESS_TOKEN** with your new long-lived token
5. Also update **FACEBOOK_ACCESS_TOKEN** (use the same token for both)
6. Make sure **INSTAGRAM_ACCOUNT_ID** is set to: `17841479735947096`

✅ **Done when**: Both secrets are updated.

---

### STEP 6 – Test Publishing

1. Go to your **Admin Dashboard**
2. Find content with:
   - ✅ Platform: `instagram`
   - ✅ Admin description filled in
   - ✅ Media URL (HTTPS, publicly accessible)
3. Click **Publish Now**
4. Check your Instagram account!

---

### If Still Not Working

Check the actual error in Supabase logs:

1. Go to `https://app.supabase.com`
2. **Edge Functions** → **publish-social** → **Logs**
3. Look for the latest error message
4. Share the error message for more specific help

---

### Quick Checklist

- [ ] Instagram is Business Account ✅ (you confirmed this)
- [ ] Instagram is connected to Facebook Page (Step 1)
- [ ] Facebook App has Instagram Product enabled (Step 2)
- [ ] Access token can access Instagram API (Step 3)
- [ ] Long-lived token is in Supabase Secrets (Step 5)
- [ ] INSTAGRAM_ACCOUNT_ID is `17841479735947096` in Supabase Secrets

---

**Start with STEP 1 - verify the connection first!**
