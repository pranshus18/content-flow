-- Independent placement for platform vs vendor logos (no longer forced opposite).
ALTER TABLE public.branding_settings
  ADD COLUMN IF NOT EXISTS vendor_logo_position TEXT DEFAULT 'bottom-left';

ALTER TABLE public.content
  ADD COLUMN IF NOT EXISTS vendor_logo_position TEXT DEFAULT 'bottom-left';

COMMENT ON COLUMN public.branding_settings.vendor_logo_position IS 'Corner for vendor logo: top-left, top-right, bottom-left, bottom-right';
COMMENT ON COLUMN public.content.vendor_logo_position IS 'Per-content vendor logo corner; independent of watermark_position';
