-- Run once on the FDS project, after migration 003.
-- Supabase Auth writes the password and user metadata in separate UPDATEs.
-- Clear the requirement on the password UPDATE, retaining the metadata guard.
CREATE OR REPLACE FUNCTION public.prevent_clearing_forced_password_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF OLD.raw_user_meta_data ->> 'force_password_change' = 'true' THEN
    IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password
       AND NEW.encrypted_password IS NOT NULL
       AND NEW.encrypted_password <> '' THEN
      NEW.raw_user_meta_data := jsonb_set(
        COALESCE(NEW.raw_user_meta_data, '{}'::jsonb),
        '{force_password_change}',
        'false'::jsonb,
        true
      );
    ELSIF NEW.raw_user_meta_data ->> 'force_password_change' IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'A new password is required before clearing the password reset requirement.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_clearing_forced_password_change() FROM PUBLIC, anon, authenticated;
