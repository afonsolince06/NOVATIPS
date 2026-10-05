-- Isolated NOVA TIPS database for Edição Fds do Caloiro.
-- Apply only to a NEW Supabase project created for the weekend edition.
-- Add the attendee allowlist before inviting users to register.

CREATE TABLE public.freshers_weekend_access (
  email text PRIMARY KEY CHECK (email = lower(email)),
  is_admin boolean NOT NULL DEFAULT false,
  added_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.freshers_weekend_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.freshers_weekend_access FROM anon, authenticated;
GRANT SELECT ON TABLE public.freshers_weekend_access TO authenticated;
CREATE POLICY "Users can check their own access"
  ON public.freshers_weekend_access
  FOR SELECT TO authenticated
  USING (email = lower(auth.jwt() ->> 'email'));

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  username text,
  balance integer NOT NULL DEFAULT 2500 CHECK (balance >= 0),
  last_claim_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_username_unique_ci
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

CREATE TABLE public.bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text NOT NULL DEFAULT '',
  options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) >= 2),
  closes_in_label text NOT NULL DEFAULT '24h',
  closes_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  trending boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'cancelled')),
  winning_option text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.placed_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bet_id uuid REFERENCES public.bets(id) ON DELETE SET NULL,
  bet_title text NOT NULL,
  option_label text NOT NULL,
  odds numeric(12, 4) NOT NULL CHECK (odds > 1),
  amount integer NOT NULL CHECK (amount > 0),
  potential_return integer NOT NULL CHECK (potential_return >= 0),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Won', 'Lost', 'Cancelled')),
  is_multiple boolean NOT NULL DEFAULT false,
  legs jsonb,
  placed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_multiple OR jsonb_typeof(legs) = 'array')
);
CREATE INDEX placed_bets_user_placed_at_idx
  ON public.placed_bets (user_id, placed_at DESC);
CREATE INDEX placed_bets_bet_status_idx
  ON public.placed_bets (bet_id, status);

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.freshers_weekend_referrals (
  referred_user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referred_user_id <> referrer_user_id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placed_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freshers_weekend_referrals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.freshers_weekend_is_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.freshers_weekend_access
    WHERE email = lower(auth.jwt() ->> 'email')
  );
$$;

CREATE OR REPLACE FUNCTION public.freshers_weekend_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.freshers_weekend_access
    WHERE email = lower(auth.jwt() ->> 'email') AND is_admin
  );
$$;

REVOKE ALL ON FUNCTION public.freshers_weekend_is_member() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.freshers_weekend_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.freshers_weekend_is_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.freshers_weekend_is_admin() TO authenticated;

CREATE POLICY "Members read profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.freshers_weekend_is_member());
CREATE POLICY "Members read open bets"
  ON public.bets FOR SELECT TO authenticated
  USING (public.freshers_weekend_is_member());
CREATE POLICY "Admins create bets"
  ON public.bets FOR INSERT TO authenticated
  WITH CHECK (public.freshers_weekend_is_admin());
CREATE POLICY "Users read their own bets"
  ON public.placed_bets FOR SELECT TO authenticated
  USING (public.freshers_weekend_is_member() AND user_id = auth.uid());
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (public.freshers_weekend_is_member() AND auth.uid() = user_id)
  WITH CHECK (public.freshers_weekend_is_member() AND auth.uid() = user_id);

GRANT SELECT (id, username, balance, last_claim_at) ON public.profiles TO authenticated;
GRANT SELECT ON public.bets TO authenticated;
GRANT INSERT (title, description, options, closes_in_label, closes_at, trending, featured, status)
  ON public.bets TO authenticated;
GRANT SELECT ON public.placed_bets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.profiles, public.bets, public.placed_bets,
  public.push_subscriptions, public.freshers_weekend_access,
  public.freshers_weekend_referrals TO service_role;

CREATE OR REPLACE VIEW public.event_leaderboard
WITH (security_invoker = true)
AS
  SELECT id, username, balance
  FROM public.profiles;
GRANT SELECT ON public.event_leaderboard TO authenticated;

CREATE OR REPLACE FUNCTION public.freshers_weekend_guard_signup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.email IS NULL OR lower(split_part(NEW.email, '@', 2)) <> 'novaims.unl.pt' THEN
    RAISE EXCEPTION 'Only NOVA IMS institutional email addresses may register.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.freshers_weekend_access
    WHERE email = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'This email is not on the Freshers Weekend guest list.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.freshers_weekend_create_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, balance)
  VALUES (NEW.id, lower(NEW.email), 2500);
  RETURN NEW;
END;
$$;

CREATE TRIGGER freshers_weekend_guard_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.freshers_weekend_guard_signup();
CREATE TRIGGER freshers_weekend_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.freshers_weekend_create_profile();

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

CREATE OR REPLACE FUNCTION public.resolve_bet(p_bet_id uuid, p_winning_option text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_bet public.bets%ROWTYPE;
  v_slip public.placed_bets%ROWTYPE;
  v_legs jsonb;
  v_status text;
BEGIN
  IF NOT public.freshers_weekend_is_admin() THEN
    RAISE EXCEPTION 'Only event administrators can resolve bets.';
  END IF;

  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id FOR UPDATE;
  IF NOT FOUND OR v_bet.status <> 'open' THEN
    RAISE EXCEPTION 'Bet is closed or already resolved.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_bet.options) AS option_item
    WHERE option_item ->> 'label' = p_winning_option
  ) THEN
    RAISE EXCEPTION 'Winning option does not belong to this bet.';
  END IF;

  UPDATE public.bets SET status = 'resolved', winning_option = p_winning_option WHERE id = p_bet_id;

  UPDATE public.profiles AS profile
  SET balance = profile.balance + winners.total_return
  FROM (
    SELECT user_id, sum(potential_return)::integer AS total_return
    FROM public.placed_bets
    WHERE bet_id = p_bet_id AND status = 'Pending' AND NOT is_multiple
      AND option_label = p_winning_option
    GROUP BY user_id
  ) AS winners
  WHERE profile.id = winners.user_id;

  UPDATE public.placed_bets
  SET status = CASE WHEN option_label = p_winning_option THEN 'Won' ELSE 'Lost' END
  WHERE bet_id = p_bet_id AND status = 'Pending' AND NOT is_multiple;

  FOR v_slip IN
    SELECT placed.* FROM public.placed_bets AS placed
    WHERE placed.is_multiple AND placed.status IN ('Pending', 'Lost')
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(placed.legs) AS leg
        WHERE leg ->> 'bet_id' = p_bet_id::text
      )
    FOR UPDATE
  LOOP
    SELECT jsonb_agg(
      CASE WHEN leg ->> 'bet_id' = p_bet_id::text THEN
        leg || jsonb_build_object('status', CASE
          WHEN leg ->> 'option_label' = p_winning_option THEN 'Won' ELSE 'Lost' END)
      ELSE leg END
    ) INTO v_legs
    FROM jsonb_array_elements(v_slip.legs) AS leg;

    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_legs) AS leg WHERE leg ->> 'status' = 'Lost') THEN
      v_status := 'Lost';
    ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_legs) AS leg WHERE leg ->> 'status' = 'Pending') THEN
      v_status := 'Pending';
    ELSE
      v_status := 'Won';
    END IF;

    UPDATE public.placed_bets SET legs = v_legs, status = v_status WHERE id = v_slip.id;
    IF v_status = 'Won' AND v_slip.status = 'Pending' THEN
      UPDATE public.profiles SET balance = balance + v_slip.potential_return WHERE id = v_slip.user_id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_bet(p_bet_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.freshers_weekend_is_admin() THEN
    RAISE EXCEPTION 'Only event administrators can delete bets.';
  END IF;
  PERFORM 1 FROM public.bets WHERE id = p_bet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet not found.'; END IF;

  UPDATE public.profiles AS profile
  SET balance = profile.balance + refunds.total_amount
  FROM (
    SELECT user_id, sum(amount)::integer AS total_amount
    FROM public.placed_bets
    WHERE bet_id = p_bet_id AND NOT is_multiple AND status = 'Pending'
    GROUP BY user_id
  ) AS refunds
  WHERE profile.id = refunds.user_id;

  UPDATE public.profiles AS profile
  SET balance = profile.balance + refunds.total_amount
  FROM (
    SELECT placed.user_id, sum(placed.amount)::integer AS total_amount
    FROM public.placed_bets AS placed
    WHERE placed.is_multiple AND placed.status = 'Pending'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(placed.legs) AS leg
        WHERE leg ->> 'bet_id' = p_bet_id::text
      )
    GROUP BY placed.user_id
  ) AS refunds
  WHERE profile.id = refunds.user_id;

  UPDATE public.placed_bets SET status = 'Cancelled'
  WHERE status = 'Pending' AND (
    bet_id = p_bet_id OR (is_multiple AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(placed_bets.legs) AS leg
      WHERE leg ->> 'bet_id' = p_bet_id::text
    ))
  );
  DELETE FROM public.bets WHERE id = p_bet_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_weekly_tips()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_last_claim timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.freshers_weekend_is_member() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;
  SELECT last_claim_at INTO v_last_claim
  FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF v_last_claim IS NOT NULL AND v_last_claim > now() - interval '7 days' THEN
    RAISE EXCEPTION 'Already claimed this week.';
  END IF;
  UPDATE public.profiles
  SET balance = balance + 1000, last_claim_at = now()
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_username(new_username text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_username text := trim(new_username);
BEGIN
  IF auth.uid() IS NULL OR NOT public.freshers_weekend_is_member() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;
  IF v_username IS NULL OR length(v_username) < 2 OR length(v_username) > 24 THEN
    RAISE EXCEPTION 'Username must be between 2 and 24 characters.';
  END IF;
  UPDATE public.profiles SET username = v_username WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found.'; END IF;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'That username is already taken.';
END;
$$;

CREATE OR REPLACE FUNCTION public.process_referral(p_referrer_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.freshers_weekend_is_member() THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;
  IF p_referrer_id = auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_referrer_id
  ) THEN
    RAISE EXCEPTION 'Invalid referral.';
  END IF;
  INSERT INTO public.freshers_weekend_referrals (referred_user_id, referrer_user_id)
  VALUES (auth.uid(), p_referrer_id);
  UPDATE public.profiles SET balance = balance + 500 WHERE id IN (auth.uid(), p_referrer_id);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Referral already processed.';
END;
$$;

REVOKE ALL ON FUNCTION public.place_bet(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.place_multiple_bet(integer, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_bet(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_bet(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_weekly_tips() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_username(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_referral(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_multiple_bet(integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_bet(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_bet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_weekly_tips() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_referral(uuid) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public' AND tablename = 'bets'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
  END IF;
END;
$$;
