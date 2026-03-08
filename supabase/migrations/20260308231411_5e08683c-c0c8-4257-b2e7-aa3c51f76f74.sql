
-- Create a security definer function to get admin user IDs
CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
$$;
