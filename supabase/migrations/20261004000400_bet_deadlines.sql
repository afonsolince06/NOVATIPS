-- Add server-enforced closing timestamps to an already initialized weekend DB.
-- Safe to run after the original core migration has already been applied.

ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS closes_at timestamptz;

UPDATE public.bets
SET closes_at = created_at
  + make_interval(days => COALESCE((regexp_match(lower(closes_in_label), '(\d+)\s*d'))[1]::integer, 0))
  + make_interval(hours => COALESCE((regexp_match(lower(closes_in_label), '(\d+)\s*h'))[1]::integer, 0))
  + make_interval(mins => COALESCE((regexp_match(lower(closes_in_label), '(\d+)\s*m'))[1]::integer, 0))
WHERE closes_at IS NULL;

UPDATE public.bets
SET closes_at = created_at + interval '24 hours'
WHERE closes_at IS NULL OR closes_at <= created_at;

ALTER TABLE public.bets
  ALTER COLUMN closes_at SET DEFAULT (now() + interval '24 hours'),
  ALTER COLUMN closes_at SET NOT NULL;

GRANT INSERT (title, description, options, closes_in_label, closes_at, trending, featured, status)
  ON public.bets TO authenticated;

CREATE OR REPLACE FUNCTION public.place_bet(p_bet_id uuid, p_option_label text, p_amount integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_bet public.bets%ROWTYPE;
  v_odds numeric;
  v_balance integer;
  v_return numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.freshers_weekend_is_member() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Stake must be greater than zero.';
  END IF;

  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id FOR UPDATE;
  IF NOT FOUND OR v_bet.status <> 'open' OR v_bet.closes_at <= now() THEN
    RAISE EXCEPTION 'Bet is closed or unavailable.';
  END IF;

  SELECT (option_item ->> 'odds')::numeric INTO v_odds
  FROM jsonb_array_elements(v_bet.options) AS option_item
  WHERE option_item ->> 'label' = p_option_label
  LIMIT 1;
  IF v_odds IS NULL OR v_odds <= 1 THEN
    RAISE EXCEPTION 'Invalid bet option.';
  END IF;

  SELECT balance INTO v_balance FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF v_balance IS NULL OR p_amount > v_balance THEN
    RAISE EXCEPTION 'Insufficient balance.';
  END IF;
  v_return := floor(p_amount * v_odds);
  IF v_return > 2147483647 THEN
    RAISE EXCEPTION 'Potential return is too large.';
  END IF;

  UPDATE public.profiles SET balance = balance - p_amount WHERE id = auth.uid();
  INSERT INTO public.placed_bets
    (user_id, bet_id, bet_title, option_label, odds, amount, potential_return, status)
  VALUES
    (auth.uid(), v_bet.id, v_bet.title, p_option_label, v_odds, p_amount, v_return::integer, 'Pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.place_multiple_bet(p_amount integer, p_legs jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_leg jsonb;
  v_bet public.bets%ROWTYPE;
  v_odds numeric;
  v_total_odds numeric := 1;
  v_verified_legs jsonb := '[]'::jsonb;
  v_balance integer;
  v_return numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.freshers_weekend_is_member() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Stake must be greater than zero.';
  END IF;
  IF jsonb_typeof(p_legs) <> 'array' OR jsonb_array_length(p_legs) < 2 THEN
    RAISE EXCEPTION 'A multiple bet needs at least two selections.';
  END IF;
  IF (SELECT count(DISTINCT leg ->> 'bet_id') FROM jsonb_array_elements(p_legs) AS leg)
      <> jsonb_array_length(p_legs) THEN
    RAISE EXCEPTION 'A bet can only appear once in a multiple.';
  END IF;

  FOR v_leg IN SELECT value FROM jsonb_array_elements(p_legs) AS value LOOP
    SELECT * INTO v_bet
    FROM public.bets
    WHERE id = (v_leg ->> 'bet_id')::uuid
    FOR UPDATE;
    IF NOT FOUND OR v_bet.status <> 'open' OR v_bet.closes_at <= now() THEN
      RAISE EXCEPTION 'One of the selected bets is closed or unavailable.';
    END IF;

    SELECT (option_item ->> 'odds')::numeric INTO v_odds
    FROM jsonb_array_elements(v_bet.options) AS option_item
    WHERE option_item ->> 'label' = v_leg ->> 'option_label'
    LIMIT 1;
    IF v_odds IS NULL OR v_odds <= 1 THEN
      RAISE EXCEPTION 'One of the selected options is invalid.';
    END IF;
    v_total_odds := v_total_odds * v_odds;
    v_verified_legs := v_verified_legs || jsonb_build_array(jsonb_build_object(
      'bet_id', v_bet.id,
      'bet_title', v_bet.title,
      'option_label', v_leg ->> 'option_label',
      'odds', v_odds,
      'status', 'Pending'
    ));
  END LOOP;

  SELECT balance INTO v_balance FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF v_balance IS NULL OR p_amount > v_balance THEN
    RAISE EXCEPTION 'Insufficient balance.';
  END IF;
  v_return := floor(p_amount * v_total_odds);
  IF v_return > 2147483647 THEN
    RAISE EXCEPTION 'Potential return is too large.';
  END IF;

  UPDATE public.profiles SET balance = balance - p_amount WHERE id = auth.uid();
  INSERT INTO public.placed_bets
    (user_id, bet_title, option_label, odds, amount, potential_return, is_multiple, legs, status)
  VALUES
    (auth.uid(), 'Múltipla (' || jsonb_array_length(v_verified_legs) || ' seleções)',
     'Múltipla', v_total_odds, p_amount, v_return::integer, true, v_verified_legs, 'Pending');
END;
$$;
