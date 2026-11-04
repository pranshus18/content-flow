-- Company logo should appear on the main video by default when a logo URL is set.
ALTER TABLE public.content
  ALTER COLUMN platform_logo_throughout SET DEFAULT true;

UPDATE public.content
SET platform_logo_throughout = true
WHERE watermark_logo_url IS NOT NULL
  AND btrim(watermark_logo_url) <> ''
  AND platform_logo_throughout = false;
