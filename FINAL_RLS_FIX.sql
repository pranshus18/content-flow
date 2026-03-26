-- FINAL FIX: Use Security Definer Function for RLS
-- This is the most reliable approach - run this in Supabase SQL Editor

-- Step 1: Create a simple security definer function to check admin role
-- This bypasses RLS and is more reliable than using has_role in policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'::public.app_role
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Step 2: Drop ALL existing policies
DROP POLICY IF EXISTS "Admins can view branding settings" ON public.branding_settings;
DROP POLICY IF EXISTS "Admins can manage branding settings" ON public.branding_settings;
DROP POLICY IF EXISTS "Admins can insert branding settings" ON public.branding_settings;
DROP POLICY IF EXISTS "Admins can update branding settings" ON public.branding_settings;
DROP POLICY IF EXISTS "Admins can delete branding settings" ON public.branding_settings;

-- Step 3: Create new policies using the security definer function
CREATE POLICY "Admins can view branding settings"
ON public.branding_settings
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can insert branding settings"
ON public.branding_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update branding settings"
ON public.branding_settings
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete branding settings"
ON public.branding_settings
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Step 4: Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Step 5: Verify everything
SELECT 
  'Policies Created' as status,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'branding_settings';

-- Step 6: Test the function (should return true if you're admin)
SELECT 
  'Function Test' as test,
  auth.uid() as your_user_id,
  public.is_admin() as is_admin_result,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as your_email;
