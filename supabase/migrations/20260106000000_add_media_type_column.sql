-- Add media_type column to content table
ALTER TABLE public.content
ADD COLUMN IF NOT EXISTS media_type TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.content.media_type IS 'Type of media: image or video';

