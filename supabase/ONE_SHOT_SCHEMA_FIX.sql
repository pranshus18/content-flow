-- Run this once in Supabase → SQL Editor.
-- Safe to re-run: every change uses IF NOT EXISTS / IF NOT EXISTS defaults.

-- Template frames on content
ALTER TABLE public.content
  ADD COLUMN IF NOT EXISTS intro_frame_url TEXT,
  ADD COLUMN IF NOT EXISTS outro_frame_url TEXT,
  ADD COLUMN IF NOT EXISTS intro_frame_duration INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS outro_frame_duration INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS template_source_url TEXT,
  ADD COLUMN IF NOT EXISTS template_frames_applied BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vendor_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS vendor_logo_position TEXT DEFAULT 'bottom-left';

-- Branding settings for templates, vendor logo, follow CTA, positions
ALTER TABLE public.branding_settings
  ADD COLUMN IF NOT EXISTS intro_card_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS intro_card_duration INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS intro_frame_url TEXT,
  ADD COLUMN IF NOT EXISTS outro_frame_url TEXT,
  ADD COLUMN IF NOT EXISTS company_tagline TEXT,
  ADD COLUMN IF NOT EXISTS intro_headline TEXT,
  ADD COLUMN IF NOT EXISTS intro_features TEXT,
  ADD COLUMN IF NOT EXISTS executor_name TEXT,
  ADD COLUMN IF NOT EXISTS cta_text TEXT DEFAULT 'Enquire now',
  ADD COLUMN IF NOT EXISTS vendor_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS vendor_logo_position TEXT DEFAULT 'bottom-left',
  ADD COLUMN IF NOT EXISTS follow_cta_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS follow_cta_text TEXT DEFAULT 'Follow us',
  ADD COLUMN IF NOT EXISTS follow_cta_start_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS follow_cta_duration INTEGER NOT NULL DEFAULT 4;

-- Helpful comments (ignore errors if comment already exists conceptually; these are fine to re-run)
COMMENT ON COLUMN public.content.intro_frame_url IS 'Still image shown as a title card before the raw video';
COMMENT ON COLUMN public.content.outro_frame_url IS 'Still image shown as an end card after the raw video';
COMMENT ON COLUMN public.content.template_source_url IS 'Video used as the middle clip when wrapping intro/outro frames';
COMMENT ON COLUMN public.content.vendor_logo_url IS 'Vendor logo for this content only. Not inherited from other videos.';
COMMENT ON COLUMN public.content.vendor_logo_position IS 'Per-content vendor logo corner; independent of watermark_position';
COMMENT ON COLUMN public.branding_settings.intro_frame_url IS 'Default intro template frame for videos';
COMMENT ON COLUMN public.branding_settings.outro_frame_url IS 'Default outro template frame for videos';
COMMENT ON COLUMN public.branding_settings.company_tagline IS 'Small line under the logo on the intro template';
COMMENT ON COLUMN public.branding_settings.intro_headline IS 'Large headline on the intro template';
COMMENT ON COLUMN public.branding_settings.intro_features IS 'Up to four feature labels, one per line, shown on the intro template';
COMMENT ON COLUMN public.branding_settings.executor_name IS 'Partner shown as Executed by on intro and outro cards';
COMMENT ON COLUMN public.branding_settings.cta_text IS 'Call-to-action on the end card, e.g. Enquire now';
COMMENT ON COLUMN public.branding_settings.vendor_logo_url IS 'Partner / vendor logo on videos, images, intro, and outro';
COMMENT ON COLUMN public.branding_settings.vendor_logo_position IS 'Corner for vendor logo: top-left, top-right, bottom-left, bottom-right';
COMMENT ON COLUMN public.branding_settings.follow_cta_enabled IS 'Whether to bake a follow CTA into videos at a specific time, and onto images';
COMMENT ON COLUMN public.branding_settings.follow_cta_text IS 'Follow CTA copy, e.g. Follow us';
COMMENT ON COLUMN public.branding_settings.follow_cta_start_seconds IS 'Seconds into the main clip when the follow CTA appears. NULL = mid-video';
COMMENT ON COLUMN public.branding_settings.follow_cta_duration IS 'How long the follow CTA stays on screen, in seconds';
