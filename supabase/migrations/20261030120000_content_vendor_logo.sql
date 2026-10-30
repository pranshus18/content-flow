ALTER TABLE public.content
  ADD COLUMN IF NOT EXISTS vendor_logo_url TEXT;

COMMENT ON COLUMN public.content.vendor_logo_url IS 'Vendor logo for this content only. Not inherited from other videos.';
