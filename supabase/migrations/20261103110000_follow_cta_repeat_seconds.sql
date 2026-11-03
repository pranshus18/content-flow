-- Allow follow CTA to reappear every N seconds during the main clip.
ALTER TABLE public.branding_settings
  ADD COLUMN IF NOT EXISTS follow_cta_repeat_seconds NUMERIC;

COMMENT ON COLUMN public.branding_settings.follow_cta_repeat_seconds IS
  'When set, the follow CTA reappears every N seconds (starting at follow_cta_start_seconds). NULL/0 = show once.';
