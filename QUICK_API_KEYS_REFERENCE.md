# Quick API Keys Reference Card

## 🎯 Where to Get Each Key

### 🐦 Twitter (4 keys)

**Website**: https://developer.twitter.com/en/portal/dashboard

**Steps**:
1. Create Developer Account → Apply
2. Create App → Get API Keys
3. Keys and Tokens tab:
   - `TWITTER_CONSUMER_KEY` = API Key
   - `TWITTER_CONSUMER_SECRET` = API Key Secret
   - `TWITTER_ACCESS_TOKEN` = Access Token (click Generate)
   - `TWITTER_ACCESS_TOKEN_SECRET` = Access Token Secret
4. Settings → App permissions → **Read and Write**
5. Settings → OAuth 1.0a → Enable

**Time**: 30-60 minutes

---

### 📘 Facebook (1 key)

**Website**: https://developers.facebook.com/

**Steps**:
1. Create App → Business type
2. Add Facebook Login product
3. Go to: https://developers.facebook.com/tools/explorer/
4. Select your app → Generate Access Token
5. Permissions: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`
6. Get Page Access Token: `GET /me/accounts`
7. Exchange for long-lived: `GET /oauth/access_token` with `grant_type=fb_exchange_token`
8. Copy `access_token` → This is `FACEBOOK_ACCESS_TOKEN`

**Time**: 30-45 minutes

---

### 📷 Instagram (1 key)

**Website**: Your Facebook Page

**Steps**:
1. Go to Facebook Page → Settings → Instagram
2. Connect Instagram Business/Creator account
3. Use same token as `FACEBOOK_ACCESS_TOKEN`
4. `INSTAGRAM_ACCESS_TOKEN` = `FACEBOOK_ACCESS_TOKEN` (usually)

**Optional**: If fails, get Instagram Business Account ID:
- Graph API Explorer: `GET /me/accounts` → `instagram_business_account.id`
- Add as `INSTAGRAM_ACCOUNT_ID` (optional secret)

**Time**: 10-15 minutes

---

### 💼 LinkedIn (1 key)

**Website**: https://www.linkedin.com/developers/

**Steps**:
1. Create App
2. Products → Request "Share on LinkedIn"
3. Auth → Add redirect URLs
4. Auth → Select scopes: `w_member_social`, `r_liteprofile`
5. Go to: https://www.linkedin.com/developers/tools/oauth
6. Select app → Request token → Authorize
7. Copy Access Token → This is `LINKEDIN_ACCESS_TOKEN`

**Time**: 20-30 minutes

---

## 📋 Quick Checklist

### Twitter ✅
- [ ] Developer account created
- [ ] App created
- [ ] API Key & Secret copied
- [ ] Access Token & Secret generated
- [ ] Read and Write permissions set
- [ ] OAuth 1.0a enabled

### Facebook ✅
- [ ] App created
- [ ] Facebook Login added
- [ ] User Access Token obtained
- [ ] Page Access Token obtained
- [ ] Long-lived token generated

### Instagram ✅
- [ ] Instagram Business/Creator account
- [ ] Connected to Facebook Page
- [ ] Access Token verified (same as Facebook)

### LinkedIn ✅
- [ ] App created
- [ ] "Share on LinkedIn" product approved
- [ ] OAuth scopes configured
- [ ] Access Token generated

---

## 🔑 Keys Summary

| Key Name | Where to Find | Time |
|----------|---------------|------|
| `TWITTER_CONSUMER_KEY` | Twitter App → Keys and Tokens | 30-60 min |
| `TWITTER_CONSUMER_SECRET` | Twitter App → Keys and Tokens | Same |
| `TWITTER_ACCESS_TOKEN` | Twitter App → Generate | Same |
| `TWITTER_ACCESS_TOKEN_SECRET` | Twitter App → Generate | Same |
| `FACEBOOK_ACCESS_TOKEN` | Graph API Explorer → Exchange token | 30-45 min |
| `INSTAGRAM_ACCESS_TOKEN` | Same as Facebook (usually) | 10-15 min |
| `LINKEDIN_ACCESS_TOKEN` | LinkedIn OAuth Test Tool | 20-30 min |

**Total Time**: 2-3 hours

---

## 🚀 After Getting Keys

1. **Add to Supabase Secrets**:
   - Dashboard → Settings → Edge Functions → Secrets
   - Add each key one by one

2. **Deploy Function**:
   ```bash
   supabase functions deploy publish-social
   ```

3. **Test**:
   - Create content → Publish → Check logs

---

## 📚 Detailed Guides

- **Full step-by-step**: See `STEP_BY_STEP_API_KEYS.md`
- **Complete guide**: See `COMPLETE_API_KEYS_GUIDE.md`
- **How to add to Supabase**: See `HOW_TO_ADD_API_KEYS.md`

---

**Start with Twitter** → Then Facebook → Then Instagram → Then LinkedIn

Good luck! 🎉
