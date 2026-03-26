## Facebook Code Integration – Baby Steps Guide

You've successfully posted to Facebook using Graph API Explorer! 🎉  
Now let's connect this to your app code so you can publish directly from your platform.

---

### What You'll Achieve

After finishing this guide:
- Your app will be able to post to Facebook automatically
- When you click "Publish" in your admin dashboard, it will post to your Facebook Page
- No more manual copying/pasting!

---

### STEP 1 – Save Your Facebook Credentials

You need **two things** from your Graph API Explorer test:
1. **Page ID**: `981529221708901` (you already have this!)
2. **Page Access Token**: The long token starting with `EAA...` (you already have this!)

👉 **Important**: Your Page token from Graph API Explorer is **temporary** (expires in about 1 hour).  
For now, we'll use it to test. Later, we'll make it permanent.

**Action**: Copy both values somewhere safe (like a text file):
- `PAGE_ID = 981529221708901`
- `PAGE_ACCESS_TOKEN = EAAUktfit6a0BQlzGt2QFF9uijAQFXuJdu091nWvwRZCRlnWoZCvgcP8kyrLVoJ7YZBkbtDvkNZBnTp1ZAZBIahv1qfkwUq3cMRhxxfS0dudXncxdeLVhJ5AzLNcheFYr0PVZBPS2T3HvZCerN7u1FtudHJEZCzNrURh0NpgyA8LOS9HeX1zvBj1Cx0SoAYsOckcSUKzmym6dy5rwKjV6eFHN9fEFiCbkzRPDKDTB8BmKwX4sZD`

✅ **Done when**: You have both values copied.

---

### STEP 2 – Add Credentials to Supabase Secrets

Your app uses **Supabase Edge Functions** to publish. We need to store your Facebook credentials securely.

1. Go to your **Supabase Dashboard**: `https://app.supabase.com`
2. Select your project
3. Left sidebar → **Project Settings** (gear icon at bottom)
4. Click **Edge Functions** → **Secrets**
5. Click **Add new secret**
6. Add these **two secrets**:

   **Secret 1:**
   - **Name**: `FACEBOOK_PAGE_ID`
   - **Value**: `981529221708901`
   - Click **Save**

   **Secret 2:**
   - **Name**: `FACEBOOK_ACCESS_TOKEN`
   - **Value**: Paste your Page Access Token (the long `EAA...` string)
   - Click **Save**

✅ **Done when**: You see both secrets listed in your Supabase Secrets page.

---

### STEP 3 – Update the Facebook Publishing Code

Your app already has Facebook publishing code, but it needs a small fix to use your **Page ID** instead of `/me/`.

**File to edit**: `supabase/functions/publish-social/index.ts`

**What to change**: The `publishToFacebook` function (around line 142)

**Current code** (line 170):
```typescript
const photoResponse = await fetch(`https://graph.facebook.com/v18.0/me/photos`, {
```

**Change to**:
```typescript
const pageId = Deno.env.get("FACEBOOK_PAGE_ID");
const photoResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
```

**And also change** (line 195):
```typescript
const response = await fetch(`https://graph.facebook.com/v18.0/me/feed`, {
```

**Change to**:
```typescript
const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
```

**Also update** (line 584):
```typescript
const facebookAccessToken = Deno.env.get("FACEBOOK_ACCESS_TOKEN");
```

**And add** (right after line 584):
```typescript
const facebookPageId = Deno.env.get("FACEBOOK_PAGE_ID");
```

**Then update** (line 601):
```typescript
result = await publishToFacebook(content, facebookAccessToken);
```

**Change to**:
```typescript
result = await publishToFacebook(content, facebookAccessToken, facebookPageId);
```

**And update the function signature** (line 142):
```typescript
async function publishToFacebook(content: any, accessToken: string): Promise<PublishResult> {
```

**Change to**:
```typescript
async function publishToFacebook(content: any, accessToken: string, pageId?: string): Promise<PublishResult> {
```

✅ **Done when**: You've made all these changes and saved the file.

---

### STEP 4 – Deploy the Updated Function

After editing the code, you need to **deploy** it to Supabase.

1. Open your **terminal** in your project folder
2. Run this command:
   ```bash
   supabase functions deploy publish-social
   ```

✅ **Done when**: You see "Function deployed successfully" message.

---

### STEP 5 – Test It!

Now let's test if it works:

1. Go to your app's **Admin Dashboard**
2. Find a piece of content that has:
   - ✅ Status: **"approved"** (green badge)
   - ✅ **Admin description** (caption) filled in
   - ✅ Platform set to **"facebook"**
3. Click the **"Publish Now"** button
4. Wait a few seconds...
5. Check your **Facebook Page** – you should see the post! 🎉

✅ **Done when**: You see your post appear on your Facebook Page!

---

### Troubleshooting

**Problem**: "Facebook API key not configured"
- **Fix**: Go back to **STEP 2** and make sure both secrets are saved correctly in Supabase

**Problem**: "Invalid OAuth" or "Permission denied"
- **Fix**: Your Page token expired. Go back to Graph API Explorer, get a new Page token, and update `FACEBOOK_ACCESS_TOKEN` in Supabase Secrets

**Problem**: Post doesn't appear on Facebook
- **Fix**: Check the browser console (F12) for error messages. Make sure:
  - Content has `admin_description` filled in
  - Platform is set to `facebook`
  - Content status is `approved`

---

### What's Next?

Once this works:
- ✅ You can publish to Facebook from your app!
- 🔄 Later, we'll make the token **permanent** (so it doesn't expire)
- 🔄 Then we can add **Instagram**, **Twitter**, **LinkedIn** one by one

---

### Quick Reference

**Your Facebook Page Details:**
- Page ID: `981529221708901`
- Page Name: "Test Page"

**Supabase Secrets Needed:**
- `FACEBOOK_PAGE_ID` = `981529221708901`
- `FACEBOOK_ACCESS_TOKEN` = (your Page token from Graph API Explorer)

**API Endpoint Used:**
- `POST https://graph.facebook.com/v18.0/{PAGE_ID}/feed`
- `POST https://graph.facebook.com/v18.0/{PAGE_ID}/photos` (for images)

---

**When you're done with all steps and your test post appears on Facebook, tell the AI assistant:**
> "I finished FACEBOOK_CODE_INTEGRATION_BABY_STEPS.md and my post appeared on Facebook! What's next?"
