ALTER TABLE public.content
  ADD COLUMN IF NOT EXISTS background_music_track_id TEXT,
  ADD COLUMN IF NOT EXISTS background_music_volume NUMERIC NOT NULL DEFAULT 1.0;

COMMENT ON COLUMN public.content.background_music_track_id IS 'Catalog id for baked-in background music; NULL = no music';
COMMENT ON COLUMN public.content.background_music_volume IS 'Gain 0–1 applied to background music when baking';
