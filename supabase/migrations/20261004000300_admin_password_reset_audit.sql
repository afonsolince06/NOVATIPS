CREATE TABLE public.admin_password_reset_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  target_user_id uuid NOT NULL REFERENCES auth.users(id),
  sessions_revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_password_reset_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_password_reset_audit FROM anon, authenticated;
GRANT ALL ON TABLE public.admin_password_reset_audit TO service_role;

CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_sessions(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_clearing_forced_password_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF OLD.raw_user_meta_data ->> 'force_password_change' = 'true'
     AND NEW.raw_user_meta_data ->> 'force_password_change' IS DISTINCT FROM 'true'
     AND NEW.encrypted_password IS NOT DISTINCT FROM OLD.encrypted_password THEN
    RAISE EXCEPTION 'A new password is required before clearing the password reset requirement.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_clearing_forced_password_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER prevent_clearing_forced_password_change
  BEFORE UPDATE OF raw_user_meta_data, encrypted_password ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_clearing_forced_password_change();