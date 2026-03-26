-- Add watermark and website link fields to content table for video branding
ALTER TABLE public.content
ADD COLUMN IF NOT EXISTS watermark_logo_url TEXT,
ADD COLUMN IF NOT EXISTS watermark_website_url TEXT,
ADD COLUMN IF NOT EXISTS watermark_position TEXT DEFAULT 'bottom-right';

-- Add comments for clarity
COMMENT ON COLUMN public.content.watermark_logo_url IS 'URL to company logo image for video watermark overlay';
COMMENT ON COLUMN public.content.watermark_website_url IS 'Company website URL to display as clickable link during video playback';
COMMENT ON COLUMN public.content.watermark_position IS 'Position of watermark on video: top-left, top-right, bottom-left, bottom-right';
