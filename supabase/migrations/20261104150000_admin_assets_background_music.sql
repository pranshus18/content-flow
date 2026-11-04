-- Allow background music files in the shared admin asset library
ALTER TABLE public.admin_assets DROP CONSTRAINT IF EXISTS admin_assets_category_check;

ALTER TABLE public.admin_assets ADD CONSTRAINT admin_assets_category_check
  CHECK (category IN (
    'platform_logo',
    'vendor_logo',
    'template_frame',
    'document',
    'background_music',
    'other'
  ));
