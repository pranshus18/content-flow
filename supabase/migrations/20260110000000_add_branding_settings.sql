-- Create branding_settings table for global company branding
CREATE TABLE IF NOT EXISTS public.branding_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_logo_url TEXT,
  company_website_url TEXT,
  watermark_enabled BOOLEAN NOT NULL DEFAULT true,
  watermark_position TEXT DEFAULT 'bottom-right',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins can manage branding settings
CREATE POLICY "Admins can view branding settings"
ON public.branding_settings
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert branding settings"
ON public.branding_settings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update branding settings"
ON public.branding_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete branding settings"
ON public.branding_settings
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Create trigger to update updated_at
CREATE TRIGGER update_branding_settings_updated_at
BEFORE UPDATE ON public.branding_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.branding_settings IS 'Global branding settings for automatic watermarking on all videos';
COMMENT ON COLUMN public.branding_settings.company_logo_url IS 'URL to company logo image that will be automatically added to all videos';
COMMENT ON COLUMN public.branding_settings.company_website_url IS 'Company website URL for watermark';
COMMENT ON COLUMN public.branding_settings.watermark_enabled IS 'Whether automatic watermarking is enabled';
COMMENT ON COLUMN public.branding_settings.watermark_position IS 'Position of watermark: top-left, top-right, bottom-left, bottom-right';
