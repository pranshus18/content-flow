-- Create a function to get user information with email for admins
-- This function allows admins to see user emails from auth.users
CREATE OR REPLACE FUNCTION public.get_users_with_content()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  content_count BIGINT
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
    c.user_id,
    au.email::TEXT,
    COALESCE(p.first_name, '')::TEXT,
    COALESCE(p.last_name, '')::TEXT,
    COUNT(c.id)::BIGINT as content_count
  FROM public.content c
  LEFT JOIN auth.users au ON c.user_id = au.id
  LEFT JOIN public.profiles p ON c.user_id = p.user_id
  GROUP BY c.user_id, au.email, p.first_name, p.last_name
  ORDER BY COUNT(c.id) DESC, au.email;
END;
$$;

-- Grant execute permission to authenticated users (RLS will handle admin check)
GRANT EXECUTE ON FUNCTION public.get_users_with_content() TO authenticated;

