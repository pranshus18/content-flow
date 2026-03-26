# 🔄 Long-Lived Token Setup - Complete Package

This package contains everything you need to convert your Instagram and Facebook refresh tokens to long-lived tokens and maintain them automatically.

---

## 📦 What's Included

### 📚 Documentation
1. **`LONG_LIVED_TOKENS_GUIDE.md`** - Complete step-by-step guide with detailed instructions
2. **`TOKEN_REFRESH_QUICK_REFERENCE.md`** - Quick reference card for fast lookups
3. **`TOKEN_REFRESH_CHECKLIST.md`** - Printable checklist to follow along

### 🛠️ Tools
4. **`token-checker.html`** - Browser-based tool to check expiration and exchange tokens
5. **`check-token-expiration.js`** - JavaScript script for token checking (Node.js or browser)

---

## 🚀 Quick Start

### For First-Time Setup:
1. **Read**: `LONG_LIVED_TOKENS_GUIDE.md` (Part 1 & 2)
2. **Follow**: `TOKEN_REFRESH_CHECKLIST.md` (Initial Setup section)
3. **Use**: `token-checker.html` to check and exchange tokens

### For Regular Maintenance:
1. **Check**: `TOKEN_REFRESH_QUICK_REFERENCE.md` for quick steps
2. **Use**: `token-checker.html` to check expiration
3. **Follow**: `TOKEN_REFRESH_CHECKLIST.md` (Token Refresh section)

---

## 🎯 What You'll Accomplish

✅ Convert short-lived tokens (1-2 hours) → Long-lived tokens (60 days)  
✅ Set up process to refresh tokens before expiration  
✅ Update Supabase Secrets with long-lived tokens  
✅ Never have to manually refresh tokens every few hours again  

---

## 📋 Step-by-Step Process

### Step 1: Convert Your Current Tokens
1. Open `token-checker.html` in your browser
2. Paste your current Facebook/Instagram token
3. Click "Exchange for Long-Lived Token"
4. Copy the new token
5. Update Supabase Secrets

### Step 2: Set Reminders
1. Check when your new token expires
2. Set a calendar reminder for 7 days before expiration
3. When reminder goes off, repeat Step 1

### Step 3: Maintain Tokens
- Every ~53 days, refresh your tokens
- Use the checklist to ensure you don't miss anything

---

## 🔑 Your App Credentials

These are already configured in the tools:
- **App ID**: `875964825144424`
- **App Secret**: `b30833d4b100675e3197c3e987ea4de2`

---

## 🛠️ Using the Tools

### Browser Tool (Easiest)
1. Open `token-checker.html` in any modern browser
2. Paste your token
3. Click buttons to check or exchange
4. Copy results

### Command Line Tool
1. Open `check-token-expiration.js`
2. Replace `YOUR_TOKEN` with your actual token
3. Run: `node check-token-expiration.js`

### Graph API Explorer (Manual)
1. Go to: https://developers.facebook.com/tools/explorer/
2. Follow instructions in `LONG_LIVED_TOKENS_GUIDE.md`

---

## ⏰ Token Lifecycle

```
Short-lived Token (1-2 hours)
    ↓ Exchange
Long-lived Token (60 days)
    ↓ Refresh before expiry
New Long-lived Token (60 days)
    ↓ Repeat
```

**Key Point**: Even long-lived tokens expire, but they last 60 days instead of 1-2 hours!

---

## 📅 Maintenance Schedule

- **Initial Setup**: Do once (takes ~10 minutes)
- **Token Refresh**: Every 53 days (takes ~5 minutes)
- **Check Expiration**: Use `token-checker.html` anytime

---

## 🆘 Need Help?

1. **Check**: `LONG_LIVED_TOKENS_GUIDE.md` → Troubleshooting section
2. **Verify**: Your App ID and Secret are correct
3. **Test**: Use `token-checker.html` to diagnose issues
4. **Review**: Make sure you're following the checklist

---

## 📝 Important Notes

1. **Token Expiration**: Long-lived tokens expire after 60 days (not permanent)
2. **Same Token**: Facebook and Instagram can use the same token
3. **Refresh Before Expiry**: Always refresh tokens 7 days before expiration
4. **Security**: Keep your App Secret secure and never share it

---

## ✅ Success Criteria

You'll know you're done when:
- ✅ Facebook token expires in ~60 days (not 1-2 hours)
- ✅ Instagram token expires in ~60 days (not 1-2 hours)
- ✅ Both tokens updated in Supabase Secrets
- ✅ Reminder set for token refresh
- ✅ You can post to both platforms successfully

---

## 🎉 Next Steps

1. **Now**: Follow `TOKEN_REFRESH_CHECKLIST.md` to convert your tokens
2. **Today**: Set a calendar reminder for 53 days from now
3. **In 53 days**: Refresh tokens using the checklist
4. **Repeat**: Every 53 days

---

**You're all set!** Follow the checklist and you'll never have to manually refresh tokens every few hours again. 🚀
