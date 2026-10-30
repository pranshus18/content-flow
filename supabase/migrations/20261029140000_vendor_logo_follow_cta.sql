-- Platform vs vendor logos, plus a follow CTA that is baked into media at a chosen time.

ALTER TABLE public.branding_settings
  ADD COLUMN IF NOT EXISTS vendor_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS follow_cta_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS follow_cta_text TEXT DEFAULT 'Follow us',
  ADD COLUMN IF NOT EXISTS follow_cta_start_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS follow_cta_duration INTEGER NOT NULL DEFAULT 4;

COMMENT ON COLUMN public.branding_settings.vendor_logo_url IS 'Partner / vendor logo shown opposite the platform logo on videos, images, intro, and outro';
COMMENT ON COLUMN public.branding_settings.follow_cta_enabled IS 'Whether to bake a follow CTA into videos at a specific time, and onto images';
COMMENT ON COLUMN public.branding_settings.follow_cta_text IS 'Follow CTA copy, e.g. Follow us';
COMMENT ON COLUMN public.branding_settings.follow_cta_start_seconds IS 'Seconds into the main clip when the follow CTA appears. NULL = automatically around mid-video';
COMMENT ON COLUMN public.branding_settings.follow_cta_duration IS 'How long the follow CTA stays on screen, in seconds';
