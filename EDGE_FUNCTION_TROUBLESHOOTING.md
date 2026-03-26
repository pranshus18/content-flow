# Edge Function Troubleshooting Guide

## Error: "Failed to send a request to the Edge Function"

This error occurs when the frontend cannot connect to the Supabase Edge Function. Here's how to diagnose and fix it:

---

## 🔍 Step-by-Step Diagnosis

### 1. **Check if Function is Deployed**

The most common cause is that the function hasn't been deployed to Supabase.

**Check in Supabase Dashboard:**
1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** in the sidebar
3. Look for `generate-caption` in the list
4. If it's not there, you need to deploy it

**Deploy using Supabase CLI:**
```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy generate-caption
```

**Or deploy via Dashboard:**
1. Go to **Edge Functions** → **Create Function**
2. Name it `generate-caption`
3. Copy the code from `supabase/functions/generate-caption/index.ts`
4. Click **Deploy**

---

### 2. **Verify Environment Variables**

Check that your frontend has the correct Supabase credentials:

**Create `.env.local` file in project root:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

**Get these values from:**
- Supabase Dashboard → Settings → API
- Copy the **Project URL** and **anon/public key**

**Restart dev server after adding env vars:**
```bash
npm run dev
```

---

### 3. **Check User Authentication**

Edge Functions require authentication. Make sure you're logged in:

1. Open browser DevTools (F12)
2. Go to **Application** tab → **Local Storage**
3. Look for `sb-<project-id>-auth-token`
4. If it doesn't exist, log in again

**Test authentication:**
```javascript
// In browser console
const { data: { user } } = await supabase.auth.getUser();
console.log('User:', user);
```

---

### 4. **Verify API Keys in Supabase Secrets**

Even if the function is deployed, it needs API keys to work:

**Add secrets in Supabase Dashboard:**
1. Go to **Edge Functions** → **Secrets**
2. Click **Add Secret**
3. Add one of these:
   - `GEMINI_API_KEY` = `your-gemini-key`
   - `OPENROUTER_API_KEY` = `your-openrouter-key`
   - `OPENAI_API_KEY` = `your-openai-key`

**Or using CLI:**
```bash
supabase secrets set GEMINI_API_KEY=your-key-here
```

**Verify secrets:**
```bash
supabase secrets list
```

---

### 5. **Test Function Directly**

Test if the function is accessible:

**Using curl:**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/generate-caption \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userDescription": "Test description",
    "title": "Test Title",
    "platform": "instagram",
    "mediaType": "image"
  }'
```

**Replace:**
- `YOUR_PROJECT` with your Supabase project reference
- `YOUR_ANON_KEY` with your anon/public key

**Expected response:**
- ✅ Success: `{"success": true, "caption": "..."}`
- ❌ Error: Check the error message

---

### 6. **Check Browser Console**

Open browser DevTools (F12) → **Console** tab and look for:

**Common errors:**
- `Function not found` → Function not deployed
- `401 Unauthorized` → Not logged in or invalid token
- `Network error` → CORS or connection issue
- `Failed to fetch` → Function URL incorrect

---

### 7. **Check Supabase Function Logs**

1. Go to Supabase Dashboard → **Edge Functions** → **Logs**
2. Select `generate-caption` function
3. Look for error messages

**Common log errors:**
- `API key not configured` → Add API keys to secrets
- `Title is required` → Frontend not sending required data
- `Network timeout` → API service is down

---

## 🔧 Quick Fixes

### Fix 1: Deploy the Function
```bash
supabase functions deploy generate-caption
```

### Fix 2: Add API Keys
1. Supabase Dashboard → Edge Functions → Secrets
2. Add `GEMINI_API_KEY` or `OPENROUTER_API_KEY`

### Fix 3: Check Environment Variables
```bash
# In project root, create .env.local
echo "VITE_SUPABASE_URL=https://your-project.supabase.co" > .env.local
echo "VITE_SUPABASE_PUBLISHABLE_KEY=your-key" >> .env.local
```

### Fix 4: Re-authenticate
1. Log out
2. Clear browser cache/localStorage
3. Log in again

---

## ✅ Verification Checklist

After fixing, verify:

- [ ] Function appears in Supabase Dashboard → Edge Functions
- [ ] API keys are set in Edge Functions → Secrets
- [ ] `.env.local` file exists with correct values
- [ ] User is logged in (check localStorage)
- [ ] Browser console shows no errors
- [ ] Function logs show successful requests

---

## 🆘 Still Not Working?

If none of the above works:

1. **Check Supabase Project Status:**
   - Go to Dashboard → Settings → General
   - Verify project is active and not paused

2. **Check Network Tab:**
   - DevTools → Network tab
   - Click "Generate with AI"
   - Look for the request to `generate-caption`
   - Check status code and response

3. **Try Different API Key:**
   - If using GEMINI_API_KEY, try OPENROUTER_API_KEY
   - Or vice versa

4. **Check Function Code:**
   - Verify `supabase/functions/generate-caption/index.ts` exists
   - Check for syntax errors

5. **Contact Support:**
   - Supabase Discord: https://discord.supabase.com
   - GitHub Issues: Create an issue with error details

---

## 📝 Common Error Messages

| Error Message | Cause | Solution |
|-------------|-------|----------|
| "Failed to send a request" | Function not deployed or URL incorrect | Deploy function, check env vars |
| "Function not found" | Function name mismatch or not deployed | Deploy function with correct name |
| "401 Unauthorized" | Not logged in | Log in again |
| "API key not configured" | Secrets not set | Add API keys to Edge Functions secrets |
| "Network error" | CORS or connection issue | Check Supabase URL, check internet |

---

**Last Updated:** $(date)

