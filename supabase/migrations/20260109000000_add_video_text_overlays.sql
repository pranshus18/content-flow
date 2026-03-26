-- Add video text overlays column to content table
-- This stores JSON array of text overlays with timing information
ALTER TABLE public.content
ADD COLUMN IF NOT EXISTS video_text_overlays JSONB DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.content.video_text_overlays IS 'JSON array of text overlays: [{"text": "Hello", "repeatEverySeconds": 5, "showForSeconds": 2, "position": "center", "style": {...}}]';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_content_video_text_overlays ON public.content USING GIN (video_text_overlays);
