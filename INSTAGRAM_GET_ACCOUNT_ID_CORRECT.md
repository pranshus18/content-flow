## Get Instagram Account ID - Correct Method

You're using a **Page Access Token**, so `me` refers to the **Page**, not the User. That's why `me/accounts` doesn't work.

---

### Correct Query for Page Access Token

Since you have a Page Access Token, use one of these:

**Method 1: Using Page ID directly**
```
GET https://graph.facebook.com/v24.0/981529221708901?fields=instagram_business_account
```

**Method 2: Using `me` (which is the Page when using Page Token)**
```
GET https://graph.facebook.com/v24.0/me?fields=instagram_business_account
```

---

### Step-by-Step in Graph API Explorer

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your **Facebook App**
3. Make sure your **Page Access Token** is selected (in the Access Token field)
4. In the search box, type: `981529221708901?fields=instagram_business_account`
   - OR type: `me?fields=instagram_business_account`
5. Make sure method is **GET**
6. Click **Submit**

**Expected Response:**
```json
{
  "instagram_business_account": {
    "id": "17841479735947096"
  }
}
```

---

### Why `me/accounts` Doesn't Work

- **User Access Token** → `me` = User → `me/accounts` = User's Pages ✅
- **Page Access Token** → `me` = Page → `me/accounts` = ❌ (Pages don't have accounts)

Since you're using a **Page Access Token**, you need to query the Page directly, not use `me/accounts`.

---

### Verify Your Instagram Account ID

Once you get the response, your Instagram Account ID is: `17841479735947096`

Make sure this is set in Supabase Secrets as `INSTAGRAM_ACCOUNT_ID`.

---

### Test Instagram Access

After getting the Account ID, test if you can access Instagram:

1. In Graph API Explorer, use your Page Access Token
2. Type: `17841479735947096?fields=id,username`
3. Click **Submit**

**Expected Response:**
```json
{
  "id": "17841479735947096",
  "username": "your_instagram_username"
}
```

If this works, you're all set! ✅

---

## Quick Fix

**Instead of:**
```
me/accounts  ❌
```

**Use:**
```
981529221708901?fields=instagram_business_account  ✅
```

OR

```
me?fields=instagram_business_account  ✅
```

Both will work with your Page Access Token!
