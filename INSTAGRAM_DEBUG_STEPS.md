## Instagram Error Debugging - Find the Real Error

The error "Missing Instagram permissions" is a generic message. We need to see the **actual error** from Instagram API.

---

### STEP 1 – Check Supabase Logs (Most Important!)

This will show you the **real error** from Instagram API:

1. Go to `https://app.supabase.com`
2. Select your project
3. Click **Edge Functions** (left sidebar)
4. Click **Logs** tab
5. In the dropdown at the top, select **`publish-social`**
6. **Now go back to your app** and try to publish to Instagram again
7. **Immediately come back** to the logs
8. Look for the **newest log entries** (at the top)

**What to look for:**
- Look for lines that say `Instagram publish error:` or `Error:`
- Copy the **exact error message** you see

**Example of what you might see:**
```
Instagram publish error: Error: (#200) Requires either a valid user access token or an app access token
```

or

```
Instagram publish error: Error: (#10) Application does not have permission for this action
```

or

```
Instagram publish error: Error: (#100) Invalid user ID
```

**👉 Copy the exact error message and share it with me!**

---

### STEP 2 – Test Instagram Connection in Graph API Explorer

While checking logs, also test the connection:

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App**
3. Click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page**
5. Test 1: Type `981529221708901?fields=instagram_business_account` and click Submit
   - **Expected**: `{"instagram_business_account": {"id": "17841479735947096"}}`
   - **If error**: Instagram is not connected to your Page
6. Test 2: Type `17841479735947096?fields=id,username` and click Submit
   - **Expected**: `{"id": "17841479735947096", "username": "your_username"}`
   - **If error**: Token doesn't have Instagram permissions

---

### STEP 3 – Common Errors and Fixes

Based on what you find in the logs:

#### Error: "(#200) Requires either a valid user access token or an app access token"
**Meaning**: The token is invalid or expired
**Fix**: 
- Get a new Page Access Token in Graph API Explorer
- Exchange it for a long-lived token
- Update `INSTAGRAM_ACCESS_TOKEN` in Supabase Secrets

#### Error: "(#10) Application does not have permission for this action"
**Meaning**: Facebook App doesn't have Instagram permissions
**Fix**:
1. Go to `https://developers.facebook.com/apps/875964825144424`
2. Click **Products** (left sidebar)
3. Find **Instagram** → Click **Set Up** if not already configured
4. Make sure **Instagram Graph API** is enabled

#### Error: "(#100) Invalid user ID"
**Meaning**: Instagram Account ID is wrong
**Fix**:
- Verify your Instagram Account ID is `17841479735947096`
- Update `INSTAGRAM_ACCOUNT_ID` in Supabase Secrets

#### Error: "(#2207001) Invalid parameter"
**Meaning**: Media URL is not accessible or invalid
**Fix**:
- Make sure media URL is publicly accessible (HTTPS)
- Test the URL in a browser - it should open directly

#### Error: "(#2207007) Missing required parameter"
**Meaning**: Missing caption or media URL
**Fix**:
- Make sure content has `admin_description` filled in
- Make sure content has `media_url` or `enhanced_media_url`

---

### STEP 4 – Verify Facebook App Has Instagram Product

1. Go to `https://developers.facebook.com/apps/875964825144424`
2. In left sidebar, click **Products**
3. Look for **Instagram** in the list
4. If you see it:
   - Click it
   - Make sure it says "Configured" or "Active"
5. If you DON'T see it:
   - Click **Add Product** (or **+** button)
   - Find **Instagram**
   - Click **Set Up**
   - Enable **Instagram Graph API**
   - Save

---

### STEP 5 – Get Token with Instagram Permissions

If your token doesn't have Instagram permissions:

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
6. Copy the token
7. Exchange for long-lived token (see `GET_LONG_LIVED_TOKEN.md`)
8. Update Supabase Secrets

---

### STEP 6 – Quick Test After Fixes

After making changes:

1. Update Supabase Secrets with new token (if you got one)
2. Wait 30 seconds for secrets to propagate
3. Try publishing again
4. Check logs again for new error (if any)

---

## 🎯 Action Items

**Right now, do this:**

1. ✅ **Check Supabase Logs** (STEP 1) - This is the most important!
2. ✅ **Copy the exact error message** from logs
3. ✅ **Share it with me** so I can give you the exact fix

The logs will tell us exactly what's wrong!

---

## Quick Checklist

- [ ] Checked Supabase Dashboard → Edge Functions → Logs → `publish-social`
- [ ] Tried publishing to Instagram
- [ ] Found the actual error message in logs
- [ ] Copied the exact error
- [ ] Tested Instagram connection in Graph API Explorer
- [ ] Verified Facebook App has Instagram Product enabled

**Start with STEP 1 - check the logs first!**
