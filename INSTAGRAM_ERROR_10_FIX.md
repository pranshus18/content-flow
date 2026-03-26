## Fix Error (#10) - Application does not have permission

**Error:** `(#10) Application does not have permission for this action`

**Meaning:** Your Facebook App doesn't have Instagram Product enabled or configured.

---

### STEP 1 – Add Instagram Product to Facebook App

1. Go to `https://developers.facebook.com/apps/875964825144424`
2. In the **left sidebar**, look for **Products**
   - If you see "Products" → Click it
   - If you see "Add Product" → Click it
3. Look for **Instagram** in the list of products
4. If you see **Instagram**:
   - Click on it
   - Make sure it says "Configured" or "Active"
   - If it says "Not Configured" → Click **Set Up**
5. If you DON'T see **Instagram**:
   - Click **Add Product** (or **+** button)
   - Find **Instagram** in the list
   - Click **Set Up** next to it

---

### STEP 2 – Configure Instagram Graph API

After clicking "Set Up" on Instagram:

1. You'll see Instagram settings page
2. Look for **Instagram Graph API** section
3. Make sure it's **enabled** or **active**
4. If there's a toggle, turn it **ON**
5. Look for **Permissions** or **Scopes** section
6. Make sure these permissions are available:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_manage_posts`
7. Click **Save** or **Continue**

---

### STEP 3 – Verify App Mode

**Important:** For testing, your app should be in **Development Mode**:

1. In your Facebook App dashboard, look at the top
2. You should see "Development" or "Live" mode
3. For testing, **Development Mode** is fine
4. If it's in "Live Mode", you might need App Review (skip for now)

---

### STEP 4 – Test Instagram Connection

After enabling Instagram Product:

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App**
3. Click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page**
5. Test: Type `17841479735947096?fields=id,username`
6. Click **Submit**

**Expected Result:**
```json
{
  "id": "17841479735947096",
  "username": "your_instagram_username"
}
```

**If you still see error (#10):**
- Wait 5-10 minutes for changes to propagate
- Try getting a new Page Access Token
- Make sure you selected the correct Facebook App

---

### STEP 5 – Get New Token (If Needed)

If the test still fails:

1. In Graph API Explorer, click **Get Token** → **Get User Access Token**
2. In the popup, check these permissions:
   - ✅ `pages_show_list`
   - ✅ `pages_manage_posts`
   - ✅ `instagram_basic` (should appear now)
   - ✅ `instagram_content_publish` (should appear now)
   - ✅ `business_management`
3. Click **Generate Access Token**
4. Then click **Get Token** → **Get Page Access Token**
5. Select your **Facebook Page**
6. Copy the token
7. Exchange for long-lived token (see `GET_LONG_LIVED_TOKEN.md`)
8. Update `INSTAGRAM_ACCESS_TOKEN` in Supabase Secrets

---

### STEP 6 – Update Supabase Secrets

1. Go to `https://app.supabase.com`
2. **Settings** → **Edge Functions** → **Secrets**
3. Update **INSTAGRAM_ACCESS_TOKEN** with your new token (if you got one)
4. Make sure **INSTAGRAM_ACCOUNT_ID** is set to: `17841479735947096`

---

### STEP 7 – Test Publishing Again

1. Wait 30 seconds for secrets to propagate
2. Go to your Admin Dashboard
3. Try publishing to Instagram again
4. Check logs - error (#10) should be gone!

---

## Quick Checklist

- [ ] Went to Facebook App dashboard
- [ ] Added/Enabled Instagram Product
- [ ] Configured Instagram Graph API
- [ ] Tested Instagram connection in Graph API Explorer
- [ ] Got new token with Instagram permissions (if needed)
- [ ] Updated Supabase Secrets
- [ ] Tried publishing again

---

## If Still Not Working

If you still get error (#10) after enabling Instagram:

1. **Wait 5-10 minutes** - Changes can take time to propagate
2. **Check App Review Status** - If app is in Live mode, you might need App Review
3. **Verify Instagram is connected** - Make sure Instagram Business Account is connected to Facebook Page
4. **Check App Permissions** - Go to App Dashboard → Settings → Basic → Check "App Domains" and "Privacy Policy URL" are set

---

**Start with STEP 1 - Add Instagram Product to your Facebook App!**
