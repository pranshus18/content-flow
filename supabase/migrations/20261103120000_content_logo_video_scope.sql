-- Per-content: where company / vendor logos appear on video (intro+outro cards vs main clip).
ALTER TABLE public.content
  ADD COLUMN IF NOT EXISTS platform_logo_throughout BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vendor_logo_throughout BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.content.platform_logo_throughout IS
  'When true, platform logo is burned on the main video clip; when false, intro/outro cards only.';
COMMENT ON COLUMN public.content.vendor_logo_throughout IS
  'When true, vendor logo is burned on the main video clip; when false, intro/outro cards only.';
