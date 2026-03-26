-- CREATE STORAGE BUCKET FOR LOGO UPLOADS
-- Run this in Supabase SQL Editor

-- Step 1: Create the content-media bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-media',
  'content-media',
  true,
  52428800, -- 50MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create storage policies for the bucket
-- Drop existing policies first
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload branding files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage branding files" ON storage.objects;

-- Policy: Anyone can view media (public bucket)
CREATE POLICY "Anyone can view media"
ON storage.objects FOR SELECT
USING (bucket_id = 'content-media');

-- Policy: Authenticated users can upload to their own folder
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'content-media' 
  AND (
    -- Users can upload to their own user_id folder
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Admins can upload to branding folder
    (storage.foldername(name))[1] = 'branding'
    AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::public.app_role
    )
  )
);

-- Policy: Users can update their own files
CREATE POLICY "Users can update their own media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'content-media' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    ((storage.foldername(name))[1] = 'branding'
    AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::public.app_role
    ))
  )
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'content-media' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    ((storage.foldername(name))[1] = 'branding'
    AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::public.app_role
    ))
  )
);

-- Step 3: Verify bucket was created
SELECT 
  id,
  name,
  public,
  file_size_limit,
  created_at
FROM storage.buckets
WHERE id = 'content-media';
