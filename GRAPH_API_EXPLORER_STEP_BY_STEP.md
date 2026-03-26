# 📘 Graph API Explorer - Step-by-Step Parameter Guide

This guide shows you exactly how to add parameters in Graph API Explorer to exchange your token for a long-lived token.

---

## 🎯 Method 1: Using Graph API Explorer (Visual Guide)

### STEP 1: Open Graph API Explorer
1. Go to: https://developers.facebook.com/tools/explorer/
2. Make sure you're logged in to Facebook
3. In the top right, select your **Facebook App** from the dropdown
   - If you don't see it, click the dropdown and select your app

### STEP 2: Get Your Current Token
1. Click the **"Get Token"** button (top right, next to the app selector)
2. Select **"Get Page Access Token"** from the dropdown
3. Select your **Facebook Page** from the list
4. **Copy the token** that appears in the "Access Token" field
   - This is your current token (you'll use it in the next step)

### STEP 3: Change Method to POST
1. Look at the top left of the Graph API Explorer
2. You'll see a dropdown that says **"GET"** (or shows a GET icon)
3. **Click on it** and change it to **"POST"**
   - This is CRITICAL - the exchange endpoint requires POST method

### STEP 4: Enter the Endpoint
1. In the search/query box (where it might say "me" or be empty)
2. Type exactly:
   ```
   oauth/access_token
   ```
3. Don't add any slashes or version numbers - just `oauth/access_token`

### STEP 5: Add Parameters (THIS IS THE KEY PART!)

The Graph API Explorer has different interfaces. Here are ALL the ways to add parameters:

#### Option A: Parameter Fields (Most Common)
1. Look **below** the query box
2. You should see a section that says **"Query Parameters"** or **"POST Parameters"**
3. You might see:
   - A button that says **"Add a Parameter"** or **"+"** - Click it
   - OR individual fields labeled "Name" and "Value"
   - OR a table with "Parameter" and "Value" columns

4. **Add each parameter one by one:**

   **Parameter 1:**
   - Name/Parameter: `grant_type`
   - Value: `fb_exchange_token`
   - Click "Add" or press Enter

   **Parameter 2:**
   - Name/Parameter: `client_id`
   - Value: `875964825144424`
   - Click "Add" or press Enter

   **Parameter 3:**
   - Name/Parameter: `client_secret`
   - Value: `b30833d4b100675e3197c3e987ea4de2`
   - Click "Add" or press Enter

   **Parameter 4:**
   - Name/Parameter: `fb_exchange_token`
   - Value: `{YOUR_CURRENT_TOKEN}` (paste the token you copied in Step 2)
   - Click "Add" or press Enter

#### Option B: If You See a "Parameters" Tab
1. Look for tabs near the top: "Query", "Parameters", "Headers", etc.
2. Click on **"Parameters"** tab
3. You'll see fields to add parameters
4. Add each parameter as described in Option A

#### Option C: If You See a "Body" Section
1. Some versions show a "Body" section
2. Look for **"Form Data"** or **"x-www-form-urlencoded"**
3. Add parameters there in key-value pairs

### STEP 6: Submit the Request
1. Once all 4 parameters are added, look for:
   - A **"Submit"** button (usually blue)
   - OR a **"Send"** button
   - OR a play/arrow icon (▶️)
2. Click it!

### STEP 7: Get Your Long-Lived Token
1. You'll see a response in JSON format
2. Look for `"access_token"` in the response
3. **Copy that entire token** (it's very long)
4. This is your long-lived token (expires in 60 days)

---

## 🎯 Method 2: Using the URL Directly (If Parameters Don't Work)

If you can't add parameters in the interface, you can build the URL manually:

### STEP 1: Build the URL
1. Your URL should look like this (all in one line):
   ```
   https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=875964825144424&client_secret=b30833d4b100675e3197c3e987ea4de2&fb_exchange_token=YOUR_CURRENT_TOKEN_HERE
   ```
2. Replace `YOUR_CURRENT_TOKEN_HERE` with your actual token from Step 2

### STEP 2: Use the URL
**Option A: In Graph API Explorer**
1. Paste the complete URL in the query box
2. Make sure method is set to **POST**
3. Click Submit

**Option B: In Browser (Easier)**
1. Open a new browser tab
2. Paste the complete URL
3. Press Enter
4. You'll see the JSON response
5. Copy the `access_token` from the response

**Option C: Using cURL (Command Line)**
```bash
curl -X POST "https://graph.facebook.com/v24.0/oauth/access_token" \
  -d "grant_type=fb_exchange_token" \
  -d "client_id=875964825144424" \
  -d "client_secret=b30833d4b100675e3197c3e987ea4de2" \
  -d "fb_exchange_token=YOUR_CURRENT_TOKEN_HERE"
```

---

## 🎯 Method 3: Use the Browser Tool (EASIEST!)

Instead of struggling with Graph API Explorer, use the tool I created:

1. **Open**: `token-checker.html` in your browser
   - Just double-click the file, or drag it into your browser
2. **Paste** your current token in the "Exchange for Long-Lived Token" section
3. **Click** "Exchange for Long-Lived Token"
4. **Copy** the new token that appears
5. **Done!** No parameters to add manually

---

## 🔍 Troubleshooting: Can't Find Parameters Section

### Problem: "I don't see any parameter fields"
**Solution:**
1. Make sure you changed method to **POST** (Step 3)
2. Some versions only show parameter fields when method is POST
3. Try refreshing the page
4. Try a different browser (Chrome, Firefox, Safari)

### Problem: "I see the fields but can't add parameters"
**Solution:**
1. Make sure you're typing in the correct fields
2. Some interfaces require you to click "Add" or press Enter after each parameter
3. Try clicking outside the field after typing

### Problem: "The parameters disappear when I click Submit"
**Solution:**
1. This is normal - parameters are sent with the request
2. Check the response - it should contain your new token
3. If you see an error, check that all 4 parameters are correct

### Problem: "I get an error when submitting"
**Common Errors:**
- **"Invalid OAuth access token"**: Your current token might be expired. Get a new one first.
- **"Invalid client_id"**: Double-check the App ID is `875964825144424`
- **"Invalid client_secret"**: Double-check the App Secret is correct
- **"Missing parameter"**: Make sure all 4 parameters are added

---

## 📸 Visual Guide (What to Look For)

### What the Interface Should Look Like:

```
┌─────────────────────────────────────────────────┐
│  [GET ▼]  oauth/access_token              [Submit] │
├─────────────────────────────────────────────────┤
│  POST Parameters:                               │
│  ┌─────────────┬────────────────────────────┐  │
│  │ Name        │ Value                      │  │
│  ├─────────────┼────────────────────────────┤  │
│  │ grant_type  │ fb_exchange_token          │  │
│  │ client_id   │ 875964825144424            │  │
│  │ client_secret│ b30833d4b100675e3197c3... │  │
│  │ fb_exchange_token│ EAAUktfit6a0BO...    │  │
│  └─────────────┴────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### If You See This Instead:

```
┌─────────────────────────────────────────────────┐
│  [GET ▼]  oauth/access_token              [Submit] │
├─────────────────────────────────────────────────┤
│  [Add a Parameter] [+ button]                   │
└─────────────────────────────────────────────────┘
```

**Click the "Add a Parameter" button or the "+" button** to add each parameter.

---

## ✅ Quick Checklist

Before submitting, make sure:
- [ ] Method is set to **POST** (not GET)
- [ ] Endpoint is: `oauth/access_token`
- [ ] All 4 parameters are added:
  - [ ] `grant_type` = `fb_exchange_token`
  - [ ] `client_id` = `875964825144424`
  - [ ] `client_secret` = `b30833d4b100675e3197c3e987ea4de2`
  - [ ] `fb_exchange_token` = Your current token
- [ ] You clicked Submit/Send

---

## 🚀 Recommended: Use the Browser Tool Instead

**Honestly, the easiest way is to use `token-checker.html`:**

1. Open `token-checker.html` in your browser
2. Paste your token
3. Click the button
4. Done!

No parameters to add, no confusion, just works! 🎉

---

## 📞 Still Stuck?

If you're still having trouble:
1. **Try Method 2** (build the URL manually) - it's more reliable
2. **Use Method 3** (browser tool) - it's the easiest
3. **Take a screenshot** of what you see and I can help you find the right place

The key is: **Make sure method is POST**, then look for parameter fields below the query box!
