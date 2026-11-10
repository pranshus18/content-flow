ALTER TABLE public.content
  ADD COLUMN IF NOT EXISTS editor_timeline JSONB,
  ADD COLUMN IF NOT EXISTS editor_timeline_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.content.editor_timeline IS 'Saved admin video editor timeline (clips, transitions, platform)';
COMMENT ON COLUMN public.content.editor_timeline_updated_at IS 'When editor_timeline was last saved';
