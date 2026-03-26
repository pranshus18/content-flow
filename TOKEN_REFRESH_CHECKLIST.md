# ✅ Token Refresh Checklist

Use this checklist to convert your refresh tokens to long-lived tokens and maintain them.

---

## 🎯 Initial Setup (Do Once)

### Facebook Token Setup
- [ ] **Step 1**: Go to https://developers.facebook.com/tools/explorer/
- [ ] **Step 2**: Select your Facebook App (top right)
- [ ] **Step 3**: Get Token → Get Page Access Token
- [ ] **Step 4**: Select your Facebook Page
- [ ] **Step 5**: Copy the Page Access Token
- [ ] **Step 6**: Change method to `POST`
- [ ] **Step 7**: Enter endpoint: `oauth/access_token`
- [ ] **Step 8**: Add parameters:
  - [ ] `grant_type` = `fb_exchange_token`
  - [ ] `client_id` = `875964825144424`
  - [ ] `client_secret` = `b30833d4b100675e3197c3e987ea4de2`
  - [ ] `fb_exchange_token` = (your Page Access Token from Step 5)
- [ ] **Step 9**: Click Submit
- [ ] **Step 10**: Copy the new `access_token` from response
- [ ] **Step 11**: Go to Supabase Dashboard → Settings → Edge Functions → Secrets
- [ ] **Step 12**: Update `FACEBOOK_ACCESS_TOKEN` with new token
- [ ] **Step 13**: Note the expiration date (should be ~60 days from now)

### Instagram Token Setup
- [ ] **Step 1**: Verify Instagram is connected to your Facebook Page
- [ ] **Step 2**: Test Instagram access with your Facebook token:
  - [ ] Go to Graph API Explorer
  - [ ] Query: `me/accounts?fields=instagram_business_account`
  - [ ] Verify you see Instagram account info
- [ ] **Step 3**: If Instagram doesn't work:
  - [ ] Get Token → Get User Access Token
  - [ ] Check Instagram permissions (`instagram_content_publish`)
  - [ ] Get Page Access Token again
  - [ ] Exchange for long-lived (follow Facebook steps above)
- [ ] **Step 4**: Go to Supabase Dashboard → Settings → Edge Functions → Secrets
- [ ] **Step 5**: Update `INSTAGRAM_ACCESS_TOKEN` with same token as Facebook
- [ ] **Step 6**: Test Instagram posting works

### Set Reminders
- [ ] **Step 1**: Calculate refresh date: (Token expiration date - 7 days)
- [ ] **Step 2**: Set calendar reminder for refresh date
- [ ] **Step 3**: Set reminder title: "Refresh Facebook/Instagram Tokens"

---

## 🔄 Token Refresh (Every ~53 Days)

### Before Token Expires (7 days before)
- [ ] **Step 1**: Check token expiration:
  - [ ] Go to Graph API Explorer
  - [ ] Query: `debug_token?input_token={YOUR_TOKEN}`
  - [ ] Verify token expires in < 7 days
- [ ] **Step 2**: Exchange for new long-lived token:
  - [ ] Follow Facebook Token Setup Steps 6-10 above
  - [ ] Use your current token as `fb_exchange_token`
- [ ] **Step 3**: Update Supabase Secrets:
  - [ ] Update `FACEBOOK_ACCESS_TOKEN`
  - [ ] Update `INSTAGRAM_ACCESS_TOKEN` (same token)
- [ ] **Step 4**: Verify tokens work:
  - [ ] Test Facebook posting
  - [ ] Test Instagram posting
- [ ] **Step 5**: Set next reminder:
  - [ ] Calculate new refresh date (new expiration - 7 days)
  - [ ] Update calendar reminder

---

## 🛠️ Quick Tools

### Check Token Expiration
- [ ] **Option 1**: Use `token-checker.html` in browser
- [ ] **Option 2**: Use Graph API Explorer:
  - [ ] Query: `debug_token?input_token={YOUR_TOKEN}`
- [ ] **Option 3**: Use `check-token-expiration.js` script

### Exchange Token
- [ ] **Option 1**: Use `token-checker.html` in browser (easiest)
- [ ] **Option 2**: Use Graph API Explorer (manual)
- [ ] **Option 3**: Use cURL command (advanced)

---

## 📝 Important Dates

**Current Token Expiration**: _________________ (fill in)

**Next Refresh Date**: _________________ (7 days before expiration)

**Last Refreshed**: _________________ (date)

---

## 🆘 Troubleshooting

### Token Expired
- [ ] Get new short-lived token from Graph API Explorer
- [ ] Exchange it for long-lived token
- [ ] Update Supabase Secrets

### Token Invalid
- [ ] Verify App ID and Secret are correct
- [ ] Check token hasn't been revoked
- [ ] Get fresh token from Graph API Explorer

### Instagram Not Working
- [ ] Verify Instagram is connected to Facebook Page
- [ ] Check token has Instagram permissions
- [ ] Get new token with Instagram permissions

---

## 📚 Reference Documents

- **Full Guide**: `LONG_LIVED_TOKENS_GUIDE.md`
- **Quick Reference**: `TOKEN_REFRESH_QUICK_REFERENCE.md`
- **Token Checker Tool**: `token-checker.html`
- **Token Checker Script**: `check-token-expiration.js`

---

## ✅ Completion Checklist

After completing initial setup:
- [ ] Facebook token is long-lived (60 days)
- [ ] Instagram token is long-lived (60 days)
- [ ] Both tokens updated in Supabase Secrets
- [ ] Tokens tested and working
- [ ] Reminder set for token refresh
- [ ] All documentation saved for future reference

---

**🎉 You're all set!** Your tokens will now last 60 days instead of 1-2 hours.
