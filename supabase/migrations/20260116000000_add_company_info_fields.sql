-- Add company information fields to branding_settings for end card
ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_address TEXT,
ADD COLUMN IF NOT EXISTS company_phone TEXT,
ADD COLUMN IF NOT EXISTS company_email TEXT,
ADD COLUMN IF NOT EXISTS end_card_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS end_card_duration INTEGER NOT NULL DEFAULT 5;

-- Add comments
COMMENT ON COLUMN public.branding_settings.company_name IS 'Company name to display on video end card';
COMMENT ON COLUMN public.branding_settings.company_address IS 'Company address to display on video end card';
COMMENT ON COLUMN public.branding_settings.company_phone IS 'Company phone number to display on video end card';
COMMENT ON COLUMN public.branding_settings.company_email IS 'Company email to display on video end card';
COMMENT ON COLUMN public.branding_settings.end_card_enabled IS 'Whether to show company information end card at the end of videos';
COMMENT ON COLUMN public.branding_settings.end_card_duration IS 'Duration in seconds for the end card (default: 5 seconds)';
