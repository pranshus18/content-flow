## Facebook Posting – Baby Steps Guide

This guide is **only for Facebook**, and it uses **very simple steps**.  
Follow them **one by one**. Do not skip ahead.

---

### STEP 0 – What you will achieve

After you finish this file, you will:

- Have a **Facebook Page** just for testing.
- Have a **special secret key** (Page access token).
- Be able to make a **test post** to your Page using Meta’s tool (no code).

Later, we can plug this into your app code. For now, we focus on **just getting a post to appear**.

---

### STEP 1 – Create (or check) your Facebook Page

You **cannot** post via API to your **personal profile**.  
You **must** have a **Page**.

1. Open Facebook in your browser.
2. On the left sidebar, click **Pages**.
3. Click **Create new Page**.
4. Fill in:
   - **Page name**: anything (for example: `My Test Page`).
   - **Category**: choose something simple (for example: `Product/Service`).
   - **Description**: you can type anything or leave simple text.
5. Click **Create Page** (or similar button) and finish any extra steps.

✅ When this step is done:
- You see your new Page in the **Pages** section.
- You can open it and see an empty timeline (or a few default hints).

---

### STEP 2 – Create your Meta Developer account

You need a **developer account** to use Facebook’s Graph API tools.

1. Go to `https://developers.facebook.com/` in your browser.
2. Log in with the **same Facebook account** that owns your Page.
3. If it asks you to become a developer:
   - Click **Get Started**.
   - Accept terms and follow the simple steps.
4. After that, at the top right, click **My Apps → Create App**.
5. Choose **None** or **Business** (both are okay for testing).
6. Enter an **App name** (for example: `Content Flow Test App`).
7. Click through the steps until the app is created and you see an **App Dashboard**.

✅ When this step is done:
- You can see your app listed when you click **My Apps**.

---

### STEP 3 – Open Graph API Explorer

We will now use Meta’s own tool to make a post. No code yet.

1. Go to `https://developers.facebook.com/tools/explorer/`.
2. At the top, there is a dropdown with the app name.
   - Make sure your **new app** (like `Content Flow Test App`) is selected.

✅ When this step is done:
- You see the **Graph API Explorer** page with:
  - A URL box (like `/me?fields=id,name`),
  - A **Submit** button,
  - And an **Access Token** field.

---

### STEP 4 – Get a User Access Token

1. In Graph API Explorer, click the **Get Token** dropdown.
2. Choose **Get User Access Token**.
3. A window/pop-up opens asking for permissions.
4. In that popup, make sure these are selected:
   - `pages_show_list`
   - `pages_manage_posts`
5. Click **Get Access Token**.
6. Log in with your Facebook account if asked, and **allow** the permissions.

✅ When this step is done:
- The Access Token field in the Explorer is filled with a long string.
- This is your **user access token** (temporary, but enough for testing).

---

### STEP 5 – Find your Page ID and Page Access Token

First, we will see which Pages you manage.

1. In the **Request URL** box, type:
   - `/me/accounts`
2. Make sure the **HTTP method** is `GET`.
3. Click **Submit**.
4. In the result (JSON), look for your test Page name (e.g. `"name": "My Test Page"`).
5. Under that object, you will see:
   - `"id": "1234567890"` → this is your **Page ID**.
   - `"access_token": "EAA..."` → this is your **Page access token**.

👉 Very important:
- **Page ID**: the numeric/string ID like `1234567890`.
- **Page access token**: the long string starting with `EAA...`.

You may want to **copy both** somewhere safe temporarily (for example, a local notes file):

- `PAGE_ID = ...`
- `PAGE_ACCESS_TOKEN = ...`

✅ When this step is done:
- You know **your Page ID**.
- You have **your Page access token**.

---

### STEP 6 – Make a simple text post to the Page

Now we will make your **first API-driven post**.

1. In Graph API Explorer:
   - In the **Request URL** box, type:
     - `/{PAGE_ID}/feed`
     - Replace `{PAGE_ID}` with the actual ID.  
       Example: `/1234567890/feed`
2. Change the **HTTP method** to `POST`.
3. Below the URL box, click **Add a Parameter**.
   - Name: `message`
   - Value: `Hello from my test app!`
4. In the **Access Token** field:
   - Paste your **Page access token** (if it is not already there).
5. Click **Submit**.

If everything is correct:
- The response will show something like:

```json
{
  "id": "1234567890_0987654321"
}
```

Now open Facebook and go to your **Page** timeline:
- You should see a new post: **“Hello from my test app!”**

✅ When this step is done:
- You have successfully posted to your Page using the **Facebook Graph API**.

---

### STEP 7 – (Optional) Post an image instead of just text

If you want to try posting an image:

1. Upload an image somewhere that has a **public URL** (for example, on your own hosting or a temporary image host).
2. Take the **direct image URL**, like:
   - `https://example.com/my-test-image.jpg`
3. In Graph API Explorer:
   - Request URL: `/{PAGE_ID}/photos`
   - Method: `POST`
4. Add parameters:
   - `url` = your image URL (`https://example.com/my-test-image.jpg`)
   - `message` = `Photo post from my test app!`
5. Use the **Page access token** in the Access Token field.
6. Click **Submit**.

Check your Page:
- You should see a **photo post** with your message.

---

### STEP 8 – Next: connect this to your code

Once you are **comfortable with the steps above** and you:

- Created a test Page,
- Used Graph API Explorer,
- Made at least **one text post** successfully,

then you are ready for the next file:

- A **small code example** (for Node/TypeScript) that does the same:
  - Inputs: `PAGE_ID`, `PAGE_ACCESS_TOKEN`, `message`
  - Output: a new Facebook post.

When you’re done with this guide and it all works, tell the AI assistant:

> “I finished the steps in `FACEBOOK_SETUP_BABY_STEPS.md` and my test post is showing on my Page. Give me the next baby-steps file to connect this to my code.”

We will then:
- Create a second guide file for your **backend code**, step by step.

