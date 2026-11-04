-- Shared admin media library (logos, template frames, documents)
CREATE TABLE IF NOT EXISTS public.admin_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('platform_logo', 'vendor_logo', 'template_frame', 'document', 'other')),
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_assets_category_created_at_idx
  ON public.admin_assets (category, created_at DESC);

ALTER TABLE public.admin_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin assets"
ON public.admin_assets FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert admin assets"
ON public.admin_assets FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update admin assets"
ON public.admin_assets FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete admin assets"
ON public.admin_assets FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

COMMENT ON TABLE public.admin_assets IS 'Shared library of logos, frames, and documents for admin content editing';
