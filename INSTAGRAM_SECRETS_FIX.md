## Fix: Wrong Instagram Account ID in Supabase Secrets

**The Problem:** Your `INSTAGRAM_ACCOUNT_ID` in Supabase Secrets is set to your **access token** instead of your **Instagram Account ID**.

**The Error Shows:** The token is being used as an object ID, which is wrong.

---

### STEP 1 – Get Your Instagram Business Account ID

You need the **Instagram Account ID** (a number), not the token.

**Method 1: Using Graph API Explorer**

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App**
3. Click **Get Token** → **Get Page Access Token**
4. Select your **Facebook Page**
5. In the search box, type: `981529221708901?fields=instagram_business_account`
6. Click **Submit**
7. You should see:
   ```json
   {
     "instagram_business_account": {
       "id": "17841479735947096"
     }
   }
   ```
8. Copy the **id** number: `17841479735947096`

**Method 2: You Already Have It**

From your `ints.txt` file, your Instagram Account ID should be: `17841479735947096`

---

### STEP 2 – Update Supabase Secrets

1. Go to `https://app.supabase.com`
2. Select your project
3. **Settings** → **Edge Functions** → **Secrets**
4. Find **INSTAGRAM_ACCOUNT_ID**
5. **Delete the current value** (it's probably your token)
6. **Set it to**: `17841479735947096`
   - This should be **ONLY the number**, nothing else
   - No quotes, no spaces, just: `17841479735947096`
7. Click **Save** or **Update**

---

### STEP 3 – Verify Your Secrets Are Correct

Make sure you have these **three secrets** set correctly:

1. **INSTAGRAM_ACCESS_TOKEN**
   - Value: Your **Facebook Page Access Token** (long string starting with `EAA...`)
   - Example: `EAAMcr3Q9DGgBQoKgl4Mphp6uZA8oO16R0nza922JcUDNed9GLtvLaDgRtqusLW51K7Lm9eWDN8T4BLJIHCNx6W1Dckp1KhZCgTRczQ3s1VoxdUiohAqRsD5vTUOVdXrMDU9ZBoarKOFlXjA0HFbMgZCi2qtEFrKm5aTh02LANq3TfFkT4u5pZAh9M6jE5PpLTLKqDpl6sY95YoiO5KEtLCpxvTwwP3nowGruBi4RSE4hpg4kI9aiODO7Dy6dOFKQQ1CnSCZAVNuVVZBUhqk3nVU`

2. **INSTAGRAM_ACCOUNT_ID**
   - Value: Your **Instagram Business Account ID** (just the number)
   - Example: `17841479735947096`
   - ⚠️ **NOT the token!** Just the number!

3. **FACEBOOK_ACCESS_TOKEN** (optional but recommended)
   - Value: Same as INSTAGRAM_ACCESS_TOKEN (you can use the same token for both)

---

### STEP 4 – Test Publishing Again

1. Wait 30 seconds for secrets to update
2. Go to your Admin Dashboard
3. Try publishing to Instagram again
4. The error should be fixed!

---

## Common Mistakes

❌ **Wrong:**
- `INSTAGRAM_ACCOUNT_ID` = `EAAMcr3Q9DGgBQoKgl4Mphp6uZA8oO16R0nza922JcUDNed9GLtvLaDgRtqusLW51K7Lm9eWDN8T4BLJIHCNx6W1Dckp1KhZCgTRczQ3s1VoxdUiohAqRsD5vTUOVdXrMDU9ZBoarKOFlXjA0HFbMgZCi2qtEFrKm5aTh02LANq3TfFkT4u5pZAh9M6jE5PpLTLKqDpl6sY95YoiO5KEtLCpxvTwwP3nowGruBi4RSE4hpg4kI9aiODO7Dy6dOFKQQ1CnSCZAVNuVVZBUhqk3nVU` (this is a token!)

✅ **Correct:**
- `INSTAGRAM_ACCOUNT_ID` = `17841479735947096` (just the number!)

---

## Quick Checklist

- [ ] Got Instagram Account ID from Graph API Explorer (STEP 1)
- [ ] Updated INSTAGRAM_ACCOUNT_ID in Supabase Secrets to the number only (STEP 2)
- [ ] Verified all three secrets are set correctly (STEP 3)
- [ ] Waited 30 seconds
- [ ] Tried publishing again (STEP 4)

---

**The fix is simple: Make sure `INSTAGRAM_ACCOUNT_ID` is set to `17841479735947096` (the number), NOT your access token!**
