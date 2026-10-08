-- Supabase FDS only, after 003. Run in SQL Editor to enable minute-level publication.
-- The job reads configured release times in Europe/Lisbon-converted timestamptz values.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
SELECT cron.schedule('fds-wrapped-publish-minute','* * * * *','SELECT public.fds_wrapped_publish_due()');
