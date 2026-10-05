-- Store the Freshers Weekend section for each bet.
-- Apply after migrations 002, 003, and 004 on the existing weekend project.

ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'general';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bets_section_allowed_values'
      AND conrelid = 'public.bets'::regclass
  ) THEN
    ALTER TABLE public.bets
      ADD CONSTRAINT bets_section_allowed_values
      CHECK (section IN ('cartoons', 'neon', 'rally', 'general', 'special'));
  END IF;
END;
$$;

GRANT INSERT (section) ON public.bets TO authenticated;
