# Quick Setup Guide - Before Adding API Keys

## 🎯 Simple Answer

**You don't need to change any code!** All fixes are done. ✅

**You just need to:**
1. Deploy the function
2. Add API keys to **Supabase Secrets** (NOT `.env` file)

---

## ⚠️ Important: Two Different Places for Keys

### 1. `.env` File (Frontend Only)
**What goes here:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

**Purpose**: Used by your React/Vite frontend app

---

### 2. Supabase Secrets (Backend/Edge Functions)
**What goes here:**
- `TWITTER_CONSUMER_KEY`
- `TWITTER_CONSUMER_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_TOKEN_SECRET`
- `FACEBOOK_ACCESS_TOKEN`
- `INSTAGRAM_ACCESS_TOKEN`
- `LINKEDIN_ACCESS_TOKEN`
- `INSTAGRAM_ACCOUNT_ID` (optional)

**Purpose**: Used by `publish-social` Edge Function

**Where**: Supabase Dashboard → Settings → Edge Functions → Secrets

**⚠️ Edge Functions CANNOT read from `.env` files!**

---

## ✅ What to Do Before Adding Keys

### Step 1: Deploy the Function
```bash
supabase functions deploy publish-social
```

**Verify**: Go to Supabase Dashboard → Edge Functions → Should see `publish-social`

---

### Step 2: Check Frontend `.env` File
Make sure you have (in project root `.env` file):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

**Get these from**: Supabase Dashboard → Settings → API

---

### Step 3: Verify Database & Storage
- ✅ Database tables exist (content, publishing_settings)
- ✅ Storage bucket `content-media` exists and is public

---

### Step 4: Get API Keys Ready
Obtain all 7 API keys from:
- Twitter (4 keys)
- Facebook (1 key)
- Instagram (1 key)
- LinkedIn (1 key)

See `COMPLETE_API_KEYS_GUIDE.md` for how to get them.

---

### Step 5: Add Keys to Supabase Secrets
**NOT to `.env` file!**

Go to: **Supabase Dashboard → Settings → Edge Functions → Secrets**

Add all 7 keys there.

See `HOW_TO_ADD_API_KEYS.md` for detailed instructions.

---

## 📋 Quick Checklist

**Before adding API keys:**

- [ ] Function deployed: `supabase functions deploy publish-social`
- [ ] `.env` file has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] Database tables exist
- [ ] Storage bucket exists
- [ ] Have all 7 API keys ready

**Then:**

- [ ] Add keys to **Supabase Secrets** (Dashboard)
- [ ] Wait 30 seconds
- [ ] Test publishing

---

## 🚀 Quick Commands

```bash
# 1. Deploy function
supabase functions deploy publish-social

# 2. Verify deployment
# Check Dashboard → Edge Functions

# 3. Add secrets (via Dashboard or CLI)
supabase secrets set TWITTER_CONSUMER_KEY=your-key-here
# ... repeat for all keys

# 4. Test
# Create content → Click "Publish Now" → Check logs
```

---

## ❓ FAQ

**Q: Do I need to change code?**
A: No! All code is already fixed. ✅

**Q: Can I put API keys in `.env`?**
A: No! Edge Functions need Supabase Secrets, not `.env` files.

**Q: What goes in `.env` then?**
A: Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (for frontend)

**Q: Where do publishing API keys go?**
A: Supabase Dashboard → Settings → Edge Functions → Secrets

---

## 📚 More Details

- **Full checklist**: See `PRE_API_KEYS_CHECKLIST.md`
- **How to add keys**: See `HOW_TO_ADD_API_KEYS.md`
- **How to get keys**: See `COMPLETE_API_KEYS_GUIDE.md`
- **What was fixed**: See `CODE_FIXES_SUMMARY.md`

---

## ✅ Summary

1. ✅ **Code is fixed** - No changes needed
2. ✅ **Deploy function** - `supabase functions deploy publish-social`
3. ✅ **Add keys to Supabase Secrets** - NOT `.env` file
4. ✅ **Test** - Create content and publish

**That's it!** 🎉
