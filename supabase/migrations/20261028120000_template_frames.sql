-- Intro/outro template frames that wrap raw video before publishing.

ALTER TABLE public.content
  ADD COLUMN IF NOT EXISTS intro_frame_url TEXT,
  ADD COLUMN IF NOT EXISTS outro_frame_url TEXT,
  ADD COLUMN IF NOT EXISTS intro_frame_duration INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS outro_frame_duration INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS template_source_url TEXT,
  ADD COLUMN IF NOT EXISTS template_frames_applied BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.branding_settings
  ADD COLUMN IF NOT EXISTS intro_card_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS intro_card_duration INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS intro_frame_url TEXT,
  ADD COLUMN IF NOT EXISTS outro_frame_url TEXT;

COMMENT ON COLUMN public.content.intro_frame_url IS 'Still image shown as a title card before the raw video';
COMMENT ON COLUMN public.content.outro_frame_url IS 'Still image shown as an end card after the raw video';
COMMENT ON COLUMN public.content.template_source_url IS 'Video used as the middle clip when wrapping intro/outro frames';
COMMENT ON COLUMN public.branding_settings.intro_frame_url IS 'Default intro template frame for videos';
COMMENT ON COLUMN public.branding_settings.outro_frame_url IS 'Default outro template frame for videos';
