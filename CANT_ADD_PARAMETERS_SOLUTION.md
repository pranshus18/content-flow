# 🎯 Solution: Can't Add Parameters in Graph API Explorer

**Problem:** You can't find where to add parameters in Graph API Explorer when trying to exchange your token.

**Solution:** Use one of these easier methods instead! ⬇️

---

## ✅ EASIEST SOLUTION: Use the Browser Tool

### Option 1: Token Checker Tool (Recommended)

1. **Open** `token-checker.html` in your browser
   - Double-click the file, or drag it into Chrome/Firefox/Safari
2. **Paste** your current Facebook/Instagram token
3. **Click** "Exchange for Long-Lived Token"
4. **Copy** the new token that appears
5. **Done!** No parameters needed!

---

### Option 2: URL Builder Tool

1. **Open** `build-token-exchange-url.html` in your browser
2. **Paste** your current token
3. **Click** "Build Exchange URL"
4. **Copy** the generated URL
5. **Open** a new browser tab
6. **Paste** the URL and press Enter
7. **Copy** the `access_token` from the JSON response

**That's it!** No need to add parameters manually.

---

## 🔧 Alternative: Build URL Manually

If you prefer to do it yourself:

1. **Get your current token** from Graph API Explorer:
   - Go to: https://developers.facebook.com/tools/explorer/
   - Get Token → Get Page Access Token
   - Copy the token

2. **Build this URL** (replace `YOUR_TOKEN` with your actual token):
   ```
   https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=875964825144424&client_secret=b30833d4b100675e3197c3e987ea4de2&fb_exchange_token=YOUR_TOKEN
   ```

3. **Paste** the complete URL in a new browser tab
4. **Press** Enter
5. **Copy** the `access_token` from the response

---

## 📖 If You Still Want to Use Graph API Explorer

If you really want to use Graph API Explorer, see:
- **`GRAPH_API_EXPLORER_STEP_BY_STEP.md`** - Detailed visual guide showing exactly where to find parameters

**But honestly, the browser tools above are much easier!** 😊

---

## 🎯 Quick Summary

**Best Method:** Use `token-checker.html` - it's the easiest and requires no parameter setup!

**Second Best:** Use `build-token-exchange-url.html` - builds the URL for you

**Manual Method:** Build the URL yourself (instructions above)

**Graph API Explorer:** Only if you really want to (see detailed guide)

---

## ✅ What You'll Get

After using any method above, you'll get:
- A new **long-lived token** (expires in 60 days instead of 1-2 hours)
- Copy it and update your Supabase Secrets
- Set a reminder for 53 days from now to refresh again

---

**That's it!** No more struggling with parameters. Just use the browser tools! 🚀
