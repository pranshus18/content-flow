# 🔄 Token Refresh Quick Reference Card

## 🚀 Quick Steps to Convert to Long-Lived Token

### Facebook/Instagram Token Exchange (60 seconds)

1. **Go to**: https://developers.facebook.com/tools/explorer/
2. **Select**: Your Facebook App
3. **Method**: Change to `POST`
4. **Endpoint**: `oauth/access_token`
5. **Parameters**:
   ```
   grant_type = fb_exchange_token
   client_id = 875964825144424
   client_secret = b30833d4b100675e3197c3e987ea4de2
   fb_exchange_token = {YOUR_CURRENT_TOKEN}
   ```
6. **Click**: Submit
7. **Copy**: New `access_token` from response
8. **Update**: Supabase Secrets → `FACEBOOK_ACCESS_TOKEN` and `INSTAGRAM_ACCESS_TOKEN`

---

## ⏰ Token Expiration Check

### Check if token expires soon:
```
https://developers.facebook.com/tools/explorer/
→ Query: debug_token?input_token={YOUR_TOKEN}
→ Look at: expires_at field
```

### When to refresh:
- ✅ **Refresh when**: Token expires in < 7 days
- ✅ **Set reminder**: Every 53 days (7 days before 60-day expiration)

---

## 📋 Token Types

| Token Type | Duration | When to Use |
|------------|----------|-------------|
| Short-lived | 1-2 hours | Initial setup only |
| Long-lived | 60 days | ✅ **Use this!** |
| Page Token | Can be permanent | Best for production |

---

## 🔑 Your App Credentials

- **App ID**: `875964825144424`
- **App Secret**: `b30833d4b100675e3197c3e987ea4de2`
- **Graph API**: https://developers.facebook.com/tools/explorer/

---

## ✅ Maintenance Checklist

**Every 53 days:**
1. [ ] Check token expiration
2. [ ] Exchange for new long-lived token
3. [ ] Update Supabase Secrets
4. [ ] Set next reminder

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Token expired | Get new token from Graph API Explorer first |
| Invalid token | Verify App ID/Secret are correct |
| Instagram not working | Check Instagram permissions in token |
| Token expires too fast | Make sure you're using `fb_exchange_token` |

---

## 📞 Full Guide

For detailed instructions, see: `LONG_LIVED_TOKENS_GUIDE.md`
