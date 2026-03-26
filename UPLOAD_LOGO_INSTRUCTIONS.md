# How to Upload Your Logo

## Method 1: Through the App (Easiest)

1. Make sure you're logged in as **admin**
2. Go to **Settings** page
3. Scroll down to **"Media Branding & Watermark"** section
4. Click the **"Upload"** button next to "Company Logo (for watermark)"
5. Select your logo file (PNG, JPG, etc.)
6. The logo will automatically upload to the `content-media/branding/` folder
7. The logo URL will be saved automatically

## Method 2: Through Supabase Dashboard

1. Go to **Supabase Dashboard** → **Storage**
2. Click on the **`content-media`** bucket
3. Create a folder called **`branding`** (if it doesn't exist)
4. Click **"Upload file"** in the `branding` folder
5. Upload your logo file
6. Right-click the uploaded file → **"Copy URL"** or **"Get public URL"**
7. Go back to your app → **Settings** → **Media Branding & Watermark**
8. Paste the URL in the "Logo URL" field
9. Click save

## Method 3: Direct SQL (Advanced)

If you have the logo file as base64 or a URL, you can insert it directly:

```sql
-- First, make sure you have the logo URL
-- Then update branding settings:
UPDATE public.branding_settings
SET company_logo_url = 'https://your-logo-url-here.com/logo.png'
WHERE id = (SELECT id FROM public.branding_settings LIMIT 1);

-- Or insert if it doesn't exist:
INSERT INTO public.branding_settings (company_logo_url, watermark_enabled)
VALUES ('https://your-logo-url-here.com/logo.png', true)
ON CONFLICT DO NOTHING;
```

## Recommended Logo Specifications

- **Format**: PNG with transparent background (best for watermarks)
- **Size**: 200x200px to 500x500px (will be resized automatically)
- **File size**: Under 1MB
- **Aspect ratio**: Square (1:1) works best

## After Uploading

Once uploaded, the logo will:
- ✅ Appear as a watermark on all videos
- ✅ Show at the end of videos for 5 seconds
- ✅ Be automatically applied to all future video uploads
