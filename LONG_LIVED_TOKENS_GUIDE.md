# 🔄 Convert Refresh Tokens to Long-Lived Tokens - Complete Guide

This guide will help you convert your Instagram and Facebook refresh tokens to long-lived tokens so you don't have to refresh them repeatedly.

---

## 📋 Understanding Token Types

### Facebook/Instagram Token Lifecycle:
1. **Short-lived Token** → Expires in 1-2 hours
2. **Long-lived Token** → Expires in 60 days (can be refreshed)
3. **Page Access Token** → Can be permanent if obtained from long-lived user token

### Important Notes:
- ⚠️ Facebook/Instagram tokens **always expire** (unlike YouTube refresh tokens)
- ✅ Long-lived tokens last **60 days** instead of 1-2 hours
- ✅ You can **refresh long-lived tokens** before they expire
- ✅ **Page Access Tokens** are more stable and can last longer

---

## 🎯 PART 1: Convert Facebook Refresh Token to Long-Lived Token

### Prerequisites:
- ✅ Your Facebook App ID: `875964825144424`
- ✅ Your Facebook App Secret: `b30833d4b100675e3197c3e987ea4de2`
- ✅ Your current Facebook refresh token (short-lived access token)

---

### STEP 1: Get Your Current Token

1. Go to **Graph API Explorer**: https://developers.facebook.com/tools/explorer/
2. Select your **Facebook App** (top right dropdown)
3. Click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page**
5. **Copy the access token** that appears
   - This is your current token (may be short-lived or already long-lived)

---

### STEP 2: Check Token Expiration

Let's check if your token is already long-lived or needs to be exchanged:

1. In Graph API Explorer, with your token selected
2. In the search box, type:
   ```
   debug_token?input_token={YOUR_ACCESS_TOKEN}
   ```
   - Replace `{YOUR_ACCESS_TOKEN}` with your actual token
3. Click **Submit**
4. Look at the response:
   - **`expires_at`**: If it shows `0`, the token **never expires** ✅
   - **`expires_at`**: If it shows a timestamp, check if it's more than 30 days away
   - **`expires_at`**: If it's less than 30 days, you need to refresh it

**What to look for:**
```json
{
  "data": {
    "expires_at": 1735689600,  // Unix timestamp
    "is_valid": true,
    "app_id": "875964825144424"
  }
}
```

---

### STEP 3: Exchange for Long-Lived Token

If your token expires soon or is short-lived, exchange it:

#### ⭐ Method A: Using Browser Tool (EASIEST - No Parameters Needed!)

**If you can't add parameters in Graph API Explorer, use this instead:**

1. **Open**: `token-checker.html` in your browser
   - Just double-click the file or drag it into your browser
2. **Paste** your current token in the "Exchange for Long-Lived Token" section
3. **Click** "Exchange for Long-Lived Token" button
4. **Copy** the new token that appears
5. **Done!** No parameters to add manually

**OR use the URL builder:**

1. **Open**: `build-token-exchange-url.html` in your browser
2. **Paste** your current token
3. **Click** "Build Exchange URL"
4. **Copy** the generated URL
5. **Paste** it in a new browser tab and press Enter
6. **Copy** the `access_token` from the JSON response

---

#### Method B: Using Graph API Explorer (If You Can Add Parameters)

**⚠️ If you can't find where to add parameters, use Method A instead!**

1. Go to **Graph API Explorer**: https://developers.facebook.com/tools/explorer/
2. Select your **Facebook App** (top right dropdown)
3. Make sure your **Page Access Token** is selected in the Access Token field
4. Change the **method** from `GET` to `POST` (top left) - **THIS IS CRITICAL!**
5. In the search box, type:
   ```
   oauth/access_token
   ```
6. **Look for parameter fields below the query box:**
   - You might see "Add a Parameter" button - Click it
   - OR you might see "Query Parameters" or "POST Parameters" section
   - OR you might see a table with "Name" and "Value" columns
7. **Add each parameter:**
   - **Name**: `grant_type` → **Value**: `fb_exchange_token`
   - **Name**: `client_id` → **Value**: `875964825144424`
   - **Name**: `client_secret` → **Value**: `b30833d4b100675e3197c3e987ea4de2`
   - **Name**: `fb_exchange_token` → **Value**: `{YOUR_CURRENT_TOKEN}`
8. Click **Submit**
9. **Copy the new `access_token`** from the response

**📖 Can't find parameters?** See `GRAPH_API_EXPLORER_STEP_BY_STEP.md` for detailed visual guide.

**Expected Response:**
```json
{
  "access_token": "EAAMcr3Q9DGgBQpfH4HsBEOKZA1VsO9pKrWZBZCEfNHq7OhTF51MIxSR7RdtxinNP8sNA8ZCvrSZB8HCAX3icGi91D0qQg1HfHWiY9NcBZAK4YxfiepPt3T5fFHIFdGeTQd2nKJlQFGqXH9gItpJCj2iIiPDJjCmOqY4VULytgDHjiRwfVnigDihOw7QpieChc4H0Kx",
  "token_type": "bearer",
  "expires_in": 5183558
}
```

**Note**: `expires_in` is in seconds. 5183558 seconds = ~60 days ✅

---

#### Method C: Using Direct URL (No Parameters Interface Needed)

**Build the URL manually and paste in browser:**

1. Build this URL (replace `YOUR_CURRENT_TOKEN` with your actual token):
   ```
   https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=875964825144424&client_secret=b30833d4b100675e3197c3e987ea4de2&fb_exchange_token=YOUR_CURRENT_TOKEN
   ```
2. **Open** a new browser tab
3. **Paste** the complete URL
4. **Press** Enter
5. You'll see JSON response with your new token
6. **Copy** the `access_token` value

**💡 Tip:** Use `build-token-exchange-url.html` to build this URL automatically!

---

#### Method D: Using cURL (Command Line)

If you prefer using command line:

```bash
curl -X POST "https://graph.facebook.com/v24.0/oauth/access_token" \
  -d "grant_type=fb_exchange_token" \
  -d "client_id=875964825144424" \
  -d "client_secret=b30833d4b100675e3197c3e987ea4de2" \
  -d "fb_exchange_token={YOUR_CURRENT_TOKEN}"
```

Replace `{YOUR_CURRENT_TOKEN}` with your actual token.

---

### STEP 4: Update Supabase Secrets

1. Go to your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Click **Settings** (gear icon, left sidebar)
4. Click **Edge Functions** (under Project Settings)
5. Scroll to **Secrets**
6. Find **FACEBOOK_ACCESS_TOKEN**
7. Click **Update** (or **Add secret** if it doesn't exist)
8. Paste your **new long-lived token** from Step 3
9. Click **Save**

✅ **Done!** Your Facebook token is now long-lived and will last 60 days.

---

## 📷 PART 2: Convert Instagram Refresh Token to Long-Lived Token

### Important Note:
Instagram uses the **same token as Facebook**! If you've already done Part 1, you might be done.

However, let's verify and ensure Instagram permissions are included:

---

### STEP 1: Verify Instagram Token

1. Go to **Graph API Explorer**: https://developers.facebook.com/tools/explorer/
2. Select your **Facebook App**
3. Use your **long-lived Facebook token** (from Part 1, Step 3)
4. In the search box, type:
   ```
   me/accounts?fields=instagram_business_account
   ```
5. Click **Submit**

**Expected Response:**
```json
{
  "data": [
    {
      "id": "981529221708901",
      "instagram_business_account": {
        "id": "17841479735947096",
        "username": "your_instagram_username"
      }
    }
  ]
}
```

**If you see this**: ✅ Your token works for Instagram! Go to Step 2.

**If you see an error**: Your token might not have Instagram permissions. See Step 1B.

---

### STEP 1B: Get Token with Instagram Permissions (If Needed)

If your token doesn't work for Instagram:

1. In Graph API Explorer, click **Get Token** → **Get User Access Token**
2. In the popup, **check these permissions**:
   - ✅ `pages_show_list`
   - ✅ `pages_manage_posts`
   - ✅ `pages_read_engagement`
   - ✅ `instagram_basic` (if available)
   - ✅ `instagram_content_publish` (if available - **THIS IS KEY!**)
   - ✅ `business_management`
3. Click **Generate Access Token**
4. Click **Get Token** → **Get Page Access Token**
5. Select your **Facebook Page**
6. Copy the **Page Access Token**
7. **Exchange it for long-lived** (follow Part 1, Step 3)

---

### STEP 2: Test Instagram Access

1. In Graph API Explorer, use your long-lived token
2. Get your Instagram Account ID (from Step 1, or use: `17841479735947096`)
3. In the search box, type:
   ```
   {INSTAGRAM_ACCOUNT_ID}?fields=id,username
   ```
   - Replace `{INSTAGRAM_ACCOUNT_ID}` with your Instagram Account ID
4. Click **Submit**

**Expected Response:**
```json
{
  "id": "17841479735947096",
  "username": "your_instagram_username"
}
```

**If you see this**: ✅ Your token works for Instagram!

---

### STEP 3: Update Supabase Secrets

1. Go to your **Supabase Dashboard**
2. Click **Settings** → **Edge Functions** → **Secrets**
3. Find **INSTAGRAM_ACCESS_TOKEN**
4. Click **Update**
5. Paste your **long-lived token** (same as FACEBOOK_ACCESS_TOKEN)
6. Click **Save**

✅ **Done!** Your Instagram token is now long-lived.

---

## 🔄 PART 3: Refresh Long-Lived Tokens Before Expiration

Even long-lived tokens expire after 60 days. Here's how to refresh them **before** they expire:

---

### STEP 1: Check Token Expiration Date

**Option A: Using Graph API Explorer**

1. Go to **Graph API Explorer**
2. Use your current token
3. Query:
   ```
   debug_token?input_token={YOUR_TOKEN}
   ```
4. Look at `expires_at` field
5. Convert Unix timestamp to date:
   - Use: https://www.epochconverter.com/
   - Or calculate: `new Date(expires_at * 1000)`

**Option B: Using cURL**

```bash
curl "https://graph.facebook.com/v24.0/debug_token?input_token={YOUR_TOKEN}&access_token={YOUR_TOKEN}"
```

---

### STEP 2: Set Reminder

**Recommended**: Set a reminder **7 days before** expiration:
- If token expires on: **March 1, 2025**
- Set reminder for: **February 22, 2025**

---

### STEP 3: Refresh Token (Before Expiration)

When your reminder goes off (or when token has < 7 days left):

1. Follow **Part 1, Step 3** (Exchange for Long-Lived Token)
2. Use your **current long-lived token** as the `fb_exchange_token`
3. Get the new long-lived token
4. Update **Supabase Secrets**:
   - Update `FACEBOOK_ACCESS_TOKEN`
   - Update `INSTAGRAM_ACCESS_TOKEN` (same token)

✅ **Done!** Your tokens are refreshed for another 60 days.

---

## 🎯 PART 4: Automated Token Refresh (Advanced)

For even better automation, you can set up automatic token refresh. Here are the options:

### Option A: Manual Reminder System

1. Use a calendar app (Google Calendar, Outlook, etc.)
2. Set recurring reminder every **53 days** (7 days before 60-day expiration)
3. When reminder goes off, follow Part 3, Step 3

### Option B: Supabase Edge Function (Recommended)

Create an edge function that automatically refreshes tokens. This requires:
- A scheduled function (cron job)
- Token expiration checking logic
- Automatic token refresh and secret update

**Would you like me to create this automated solution?**

---

## ✅ Quick Reference Checklist

### Initial Setup (Do Once):
- [ ] Get current Facebook Page Access Token
- [ ] Exchange for long-lived token (Part 1, Step 3)
- [ ] Update `FACEBOOK_ACCESS_TOKEN` in Supabase Secrets
- [ ] Verify Instagram access works
- [ ] Update `INSTAGRAM_ACCESS_TOKEN` in Supabase Secrets
- [ ] Check token expiration date
- [ ] Set reminder for 7 days before expiration

### Maintenance (Every ~53 Days):
- [ ] Check token expiration
- [ ] Exchange current token for new long-lived token
- [ ] Update both tokens in Supabase Secrets
- [ ] Set next reminder

---

## 🔧 Troubleshooting

### Problem: "Token has expired"
**Solution**: Get a new short-lived token first:
1. Go to Graph API Explorer
2. Get Token → Get Page Access Token
3. Then exchange it for long-lived (Part 1, Step 3)

### Problem: "Invalid OAuth access token"
**Solution**: 
- Token might be revoked
- Get a fresh token from Graph API Explorer
- Make sure you're using the correct App ID and Secret

### Problem: "Token doesn't work for Instagram"
**Solution**:
- Make sure Instagram is connected to your Facebook Page
- Get token with Instagram permissions (Part 2, Step 1B)
- Verify Instagram Business Account ID is correct

### Problem: "Token expires too quickly"
**Solution**:
- Make sure you're exchanging for long-lived token (not using short-lived)
- Check that you're using `fb_exchange_token` grant type
- Verify App ID and Secret are correct

---

## 📝 Important Notes

1. **Token Expiration**: Even long-lived tokens expire after 60 days
2. **Same Token**: Facebook and Instagram can use the same token
3. **Page Tokens**: Page Access Tokens are more stable than User Access Tokens
4. **Refresh Before Expiry**: Always refresh tokens **before** they expire
5. **App Credentials**: Keep your App ID and Secret secure

---

## 🎉 Summary

**What you've accomplished:**
- ✅ Converted short-lived tokens to long-lived (60 days)
- ✅ Set up process to refresh tokens before expiration
- ✅ Updated Supabase Secrets with long-lived tokens

**Next Steps:**
- Set a reminder for 53 days from now
- When reminder goes off, refresh tokens using Part 3
- Consider setting up automated refresh (Part 4, Option B)

**You're all set!** Your tokens will now last 60 days instead of 1-2 hours, and you have a clear process to refresh them.

---

## 📞 Need Help?

If you encounter any issues:
1. Check the Troubleshooting section above
2. Verify your App ID and Secret are correct
3. Make sure you're using the latest token from Graph API Explorer
4. Check that Instagram is properly connected to your Facebook Page
