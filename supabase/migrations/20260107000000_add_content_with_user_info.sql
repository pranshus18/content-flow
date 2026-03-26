-- Create a function to get content with user information for admins
-- This allows admins to see which user submitted each content item
CREATE OR REPLACE FUNCTION public.get_content_with_user_info()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  user_first_name TEXT,
  user_last_name TEXT,
  title TEXT,
  description TEXT,
  admin_description TEXT,
  admin_notes TEXT,
  platform TEXT,
  status TEXT,
  media_url TEXT,
  media_type TEXT,
  original_media_url TEXT,
  enhanced_media_url TEXT,
  scheduled_date TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  preprocessing_status TEXT,
  social_post_id TEXT,
  likes_count INTEGER,
  comments_count INTEGER,
  shares_count INTEGER,
  reach_count INTEGER,
  watermark_logo_url TEXT,
  watermark_website_url TEXT,
  watermark_position TEXT,
  video_text_overlays JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    au.email::TEXT as user_email,
    COALESCE(p.first_name, '')::TEXT as user_first_name,
    COALESCE(p.last_name, '')::TEXT as user_last_name,
    c.title,
    c.description,
    c.admin_description,
    c.admin_notes,
    c.platform,
    c.status,
    c.media_url,
    c.media_type,
    c.original_media_url,
    c.enhanced_media_url,
    c.scheduled_date,
    c.published_at,
    c.preprocessing_status,
    c.social_post_id,
    c.likes_count,
    c.comments_count,
    c.shares_count,
    c.reach_count,
    c.watermark_logo_url,
    c.watermark_website_url,
    c.watermark_position,
    c.video_text_overlays,
    c.created_at,
    c.updated_at
  FROM public.content c
  LEFT JOIN auth.users au ON c.user_id = au.id
  LEFT JOIN public.profiles p ON c.user_id = p.user_id
  ORDER BY c.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users (RLS will handle admin check)
GRANT EXECUTE ON FUNCTION public.get_content_with_user_info() TO authenticated;

