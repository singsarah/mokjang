-- === Fix create_profile_on_signup() trigger ===
-- The original function referenced `profiles` unqualified and did not pin a
-- search_path. As a SECURITY DEFINER trigger it runs in the calling role's
-- context (supabase_auth_admin), whose search_path does not include `public`,
-- so the INSERT failed with "Database error creating new user" (500) on signup.
-- Fix: pin an empty search_path and fully schema-qualify every object.

CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- === Harden RLS helper functions with a pinned search_path ===
-- Same SECURITY DEFINER hygiene: pin search_path and schema-qualify all objects.
CREATE OR REPLACE FUNCTION public.is_active_member(gid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE group_id = gid AND user_id = uid AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_role_in_group(gid uuid, uid uuid)
RETURNS public.role_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.memberships
  WHERE group_id = gid AND user_id = uid AND status = 'active'
  LIMIT 1;
$$;
