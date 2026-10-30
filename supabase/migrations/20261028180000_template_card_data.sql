-- Extra branding copy used on the intro template and end-of-video data cards.

ALTER TABLE public.branding_settings
  ADD COLUMN IF NOT EXISTS company_tagline TEXT,
  ADD COLUMN IF NOT EXISTS intro_headline TEXT,
  ADD COLUMN IF NOT EXISTS intro_features TEXT,
  ADD COLUMN IF NOT EXISTS executor_name TEXT,
  ADD COLUMN IF NOT EXISTS cta_text TEXT DEFAULT 'Enquire now';

COMMENT ON COLUMN public.branding_settings.company_tagline IS 'Small line under the logo on the intro template';
COMMENT ON COLUMN public.branding_settings.intro_headline IS 'Large headline on the intro template, e.g. Crafted with Care. Designed for Life.';
COMMENT ON COLUMN public.branding_settings.intro_features IS 'Up to four feature labels, one per line, shown on the intro template';
COMMENT ON COLUMN public.branding_settings.executor_name IS 'Partner shown as Executed by on intro and outro cards';
COMMENT ON COLUMN public.branding_settings.cta_text IS 'Call-to-action on the end card, e.g. Enquire now';
