## How to Enable Instagram - Alternative Methods

If you don't see "Products" in your Facebook App, try these methods:

---

### METHOD 1 – Through App Dashboard (Settings)

1. Go to `https://developers.facebook.com/apps/875964825144424`
2. In the **left sidebar**, look for:
   - **Settings** → **Basic**
   - OR **App Review** → **Permissions and Features**
   - OR just look for any menu item that says "Instagram"
3. If you see **Settings** → **Basic**:
   - Scroll down to find **"Add Platform"** or **"Platforms"** section
   - Look for Instagram option
4. If you see **App Review**:
   - Click **Permissions and Features**
   - Look for Instagram-related permissions

---

### METHOD 2 – Direct URL to Instagram Setup

Try going directly to Instagram setup:

1. Go to: `https://developers.facebook.com/apps/875964825144424/instagram-basic-display/`
   - This should open Instagram Basic Display setup
2. OR try: `https://developers.facebook.com/apps/875964825144424/instagram-graph-api/`
   - This should open Instagram Graph API setup
3. If either URL works, follow the setup steps

---

### METHOD 3 – Through App Dashboard Menu

1. Go to `https://developers.facebook.com/apps/875964825144424`
2. Look at the **top menu bar** (not sidebar)
   - You might see tabs like: **Dashboard**, **Settings**, **Tools**, etc.
3. Click on **Dashboard** (if you're not already there)
4. Look for a section that says:
   - **"Add a Product"**
   - **"Get Started"**
   - **"Quick Start"**
   - Or a **"+"** button
5. Click it and look for Instagram

---

### METHOD 4 – Check App Type

Your app might need to be a specific type:

1. Go to `https://developers.facebook.com/apps/875964825144424`
2. Click **Settings** → **Basic** (in left sidebar)
3. Look at **"App Type"** or **"Category"**
4. If it says something like "Consumer" or "Other", you might need to:
   - Change it to **"Business"** type
   - Or add **"Business"** as an additional type

---

### METHOD 5 – Use Graph API Explorer to Check Current Permissions

Let's first check what your app currently has:

1. Go to `https://developers.facebook.com/tools/explorer/`
2. Select your app (top right)
3. Click **Get Token** → **Get User Access Token**
4. In the popup, look at the list of available permissions
5. Do you see any Instagram permissions listed?
   - If YES → Your app might already have Instagram, but token needs permissions
   - If NO → Instagram Product is definitely not enabled

---

### METHOD 6 – Create New App with Instagram (Last Resort)

If nothing works, you might need to create a new app:

1. Go to `https://developers.facebook.com/apps/`
2. Click **Create App**
3. Choose **"Business"** as the app type
4. Fill in app details
5. During setup, you should see Instagram as an option
6. Enable Instagram during app creation
7. Then migrate your existing tokens to the new app

**⚠️ Warning:** This means you'll need to:
- Get new access tokens
- Update all Supabase Secrets
- Reconnect Facebook Page

---

### METHOD 7 – Check Business Settings (Alternative)

Sometimes Instagram is managed through Business Settings:

1. Go to `https://business.facebook.com/`
2. Click **Settings** (gear icon, bottom left)
3. Click **Business Settings** (if available)
4. Look for **"Instagram Accounts"** or **"Connected Accounts"**
5. See if you can add Instagram there

---

## What to Check First

Before trying all methods, let's verify:

1. **What do you see in your App Dashboard?**
   - Take a screenshot or describe the left sidebar menu items
   - What tabs/menu items are visible?

2. **What's your App Type?**
   - Go to Settings → Basic
   - What does it say under "Category" or "App Type"?

3. **Can you access Graph API Explorer?**
   - Go to `https://developers.facebook.com/tools/explorer/`
   - Select your app
   - What permissions are available when you click "Get Token"?

---

## Quick Test: Try Direct URL

**Try this URL directly:**
```
https://developers.facebook.com/apps/875964825144424/instagram-graph-api/
```

If this opens a page, you're in the right place! Follow the setup steps there.

If it says "Page not found" or redirects, then Instagram Product is not available for your app type.

---

## Most Likely Solution

Based on Facebook's current interface, try this:

1. Go to your App Dashboard
2. Look for a **"+"** button or **"Add"** button (usually at the top or in a prominent place)
3. OR look for **"Quick Start"** section on the Dashboard
4. Instagram might be listed as one of the quick start options

**Can you tell me:**
- What menu items do you see in the left sidebar of your App Dashboard?
- What's the main content area showing? (Dashboard, Settings, etc.)

This will help me give you more specific instructions!
