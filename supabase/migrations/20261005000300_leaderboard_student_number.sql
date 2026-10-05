-- Run on the FDS Supabase project. Keep full emails out of the leaderboard.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_number text;
UPDATE public.profiles SET student_number = split_part(email, '@', 1) WHERE student_number IS NULL;
CREATE OR REPLACE FUNCTION public.freshers_weekend_create_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, balance, student_number)
  VALUES (NEW.id, lower(NEW.email), 2500, split_part(lower(NEW.email), '@', 1));
  RETURN NEW;
END;
$$;
GRANT SELECT (student_number) ON public.profiles TO authenticated;
CREATE OR REPLACE VIEW public.event_leaderboard WITH (security_invoker = true)
AS SELECT id, username, balance, student_number FROM public.profiles;
GRANT SELECT ON public.event_leaderboard TO authenticated;
