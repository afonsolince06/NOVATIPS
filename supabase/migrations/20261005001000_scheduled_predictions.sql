-- FDS only, after migration 009. Preserve existing open/resolved/cancelled states.
ALTER TABLE public.bets ADD COLUMN start_at timestamptz;
UPDATE public.bets SET start_at=LEAST(created_at,closes_at-interval '1 second');
ALTER TABLE public.bets ALTER COLUMN start_at SET DEFAULT now(), ALTER COLUMN start_at SET NOT NULL;
ALTER TABLE public.bets ADD COLUMN published boolean NOT NULL DEFAULT true;
ALTER TABLE public.bets ADD CONSTRAINT bets_publication_window CHECK(closes_at>start_at);
DROP POLICY "Members read open bets" ON public.bets;
CREATE POLICY "Members read published bets or admin previews" ON public.bets FOR SELECT TO authenticated
USING(public.freshers_weekend_is_member() AND
 (public.freshers_weekend_is_admin() OR (published AND start_at<=now())));
-- Unpublished drafts do not reserve the featured Mega Boost slot.
DROP INDEX public.one_active_mega_boost;
CREATE UNIQUE INDEX one_active_mega_boost ON public.bets ((true))
WHERE published AND mega_boost @> '{"enabled":true,"active":true}'::jsonb AND status='open';
-- Realtime Postgres Changes respects the same SELECT RLS policy.

CREATE OR REPLACE FUNCTION public.save_mega_boost(p_bet_id uuid, p_payload jsonb, p_replace_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
 v_start timestamptz; v_published boolean; v_id uuid; v_current uuid; v_old public.bets; v_options jsonb; v_meta jsonb;
 v_label_yes text; v_label_no text; v_boost_no numeric; v_close timestamptz; v_yes numeric; v_no numeric; v_boost numeric; v_active boolean; v_enabled boolean;
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 -- Serialize concurrent activation attempts. Confirmation names the exact replaced prediction.
 PERFORM pg_advisory_xact_lock(610050004);
 v_enabled := COALESCE((p_payload->>'enabled')::boolean, true);
 v_active := v_enabled AND COALESCE((p_payload->>'active')::boolean, false);
 v_close := (p_payload->>'closes_at')::timestamptz;
 v_start := COALESCE(NULLIF(p_payload->>'start_at','')::timestamptz, now());
 v_published := COALESCE((p_payload->>'published')::boolean,true);
 v_yes := (p_payload->>'yes_odds')::numeric;
 v_no := NULLIF(p_payload->>'no_odds','')::numeric;
 v_boost := NULLIF(p_payload->>'boosted_odds','')::numeric;
 v_boost_no := NULLIF(p_payload->>'boosted_no_odds','')::numeric;
 v_label_yes := trim(COALESCE(p_payload->>'yes_label','Sim'));
 v_label_no := trim(COALESCE(p_payload->>'no_label','Não'));
 IF v_label_yes = '' OR (v_label_no <> '' AND lower(v_label_yes)=lower(v_label_no)) THEN RAISE EXCEPTION 'Give each option a distinct name.'; END IF;
 IF COALESCE(trim(p_payload->>'title'),'') = '' OR v_close IS NULL OR
    v_yes IS NULL OR v_yes <= 1 OR (v_label_no <> '' AND (v_no IS NULL OR v_no <= 1)) OR
    (v_boost IS NOT NULL AND v_boost <= 1) THEN RAISE EXCEPTION 'Title, closing date and odds greater than 1 are required.'; END IF;
 IF v_yes::text IN ('NaN','Infinity','-Infinity') OR v_no::text IN ('NaN','Infinity','-Infinity') OR v_boost::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Odds must be finite.'; END IF;
 IF v_boost IS NOT NULL AND v_boost <= v_yes THEN RAISE EXCEPTION 'Boosted odds must exceed the base YES odds.'; END IF;
 IF v_boost_no IS NOT NULL AND (v_boost_no::text IN ('NaN','Infinity','-Infinity') OR v_boost_no <= v_no) THEN RAISE EXCEPTION 'Option 2 boosted odds must exceed its base odds.'; END IF;
 IF v_close <= v_start THEN RAISE EXCEPTION 'Closing time must be after publication time.'; END IF;
 IF v_published AND v_close <= now() THEN RAISE EXCEPTION 'Published predictions must close in the future.'; END IF;
 IF p_bet_id IS NOT NULL THEN
   SELECT * INTO v_old FROM public.bets WHERE id = p_bet_id FOR UPDATE;
   IF NOT FOUND OR v_old.status <> 'open' THEN RAISE EXCEPTION 'Prediction is no longer open.'; END IF;
 IF EXISTS (SELECT 1 FROM public.placed_bets WHERE bet_id=p_bet_id OR (is_multiple AND legs @> jsonb_build_array(jsonb_build_object('bet_id',p_bet_id::text)))) AND (NOT v_published OR v_start>now()) THEN RAISE EXCEPTION 'Cannot hide or reschedule a prediction after bets have been placed.'; END IF;
 END IF;
 IF v_label_no = '' THEN v_no := NULL; v_boost_no := NULL; END IF;
 v_options := jsonb_build_array(jsonb_build_object('label',v_label_yes,'odds',COALESCE(v_boost,v_yes)));
 IF v_label_no <> '' THEN v_options := v_options || jsonb_build_array(jsonb_build_object('label',v_label_no,'odds',COALESCE(v_boost_no,v_no))); END IF;
 -- Never change outcomes/odds once users have placed single or multiple bets.
 IF p_bet_id IS NOT NULL AND v_options IS DISTINCT FROM v_old.options AND EXISTS (
   SELECT 1 FROM public.placed_bets WHERE bet_id=p_bet_id OR
   (is_multiple AND legs @> jsonb_build_array(jsonb_build_object('bet_id',p_bet_id::text)))
 ) THEN RAISE EXCEPTION 'Cannot change options or odds after bets have been placed.'; END IF;
 IF v_enabled AND v_published AND COALESCE(p_payload->>'image_path','') = '' THEN RAISE EXCEPTION 'Upload a Mega Boost image.'; END IF;
 IF v_enabled AND COALESCE(p_payload->>'image_path','')<>'' AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='prediction-images' AND name=p_payload->>'image_path') THEN
   RAISE EXCEPTION 'Uploaded image not found.';
 END IF;
 SELECT id INTO v_current FROM public.bets WHERE mega_boost @> '{"enabled":true,"active":true}'::jsonb AND status='open' AND published AND id IS DISTINCT FROM p_bet_id;
 IF v_active AND v_published AND v_current IS NOT NULL THEN
   IF p_replace_id IS DISTINCT FROM v_current THEN RAISE EXCEPTION 'Another Mega Boost is active. Refresh and confirm replacement.'; END IF;
   UPDATE public.bets SET mega_boost=jsonb_set(mega_boost,'{active}','false') WHERE id=v_current;
 END IF;
 v_meta := jsonb_build_object('enabled',v_enabled,'active',v_active,'image_path',p_payload->>'image_path','badge',left(COALESCE(p_payload->>'badge',''),80),'base_yes_odds',v_yes,'base_no_odds',v_no,'boosted_odds',v_boost,'boosted_no_odds',v_boost_no);
 IF p_bet_id IS NULL THEN
   INSERT INTO public.bets(title,description,options,closes_at,closes_in_label,section,mega_boost,start_at,published)
   VALUES(trim(p_payload->>'title'),COALESCE(p_payload->>'description',''),v_options,v_close,'',COALESCE(p_payload->>'section','general'),v_meta,v_start,v_published) RETURNING id INTO v_id;
 ELSE
   UPDATE public.bets SET title=trim(p_payload->>'title'),description=COALESCE(p_payload->>'description',''),options=v_options,closes_at=v_close,section=COALESCE(p_payload->>'section','general'),mega_boost=v_meta,start_at=v_start,published=v_published WHERE id=p_bet_id RETURNING id INTO v_id;
 END IF;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_mega_boost(uuid,jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_mega_boost(uuid,jsonb,uuid) TO authenticated;

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
  IF NOT FOUND OR v_bet.status <> 'open' OR NOT v_bet.published OR v_bet.start_at > now() OR v_bet.closes_at <= now() THEN
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
    IF NOT FOUND OR v_bet.status <> 'open' OR NOT v_bet.published OR v_bet.start_at > now() OR v_bet.closes_at <= now() THEN
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
CREATE FUNCTION public.set_prediction_publication(p_bet_id uuid,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b public.bets;
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 PERFORM pg_advisory_xact_lock(610050004);
 SELECT * INTO b FROM public.bets WHERE id=p_bet_id FOR UPDATE;
 IF NOT FOUND OR b.status<>'open' THEN RAISE EXCEPTION 'Prediction is no longer open.'; END IF;
 IF p_action='publish_now' THEN
  IF b.closes_at<=now() THEN RAISE EXCEPTION 'Choose a future closing time.'; END IF;
  UPDATE public.bets SET published=true,start_at=now() WHERE id=b.id;
 ELSIF p_action='cancel_schedule' THEN
  IF NOT b.published OR b.start_at<=now() THEN RAISE EXCEPTION 'Only a scheduled prediction can be moved to drafts.'; END IF;
  UPDATE public.bets SET published=false WHERE id=b.id;
 ELSE RAISE EXCEPTION 'Invalid action.';
 END IF;
END;$$;
REVOKE ALL ON FUNCTION public.set_prediction_publication(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_prediction_publication(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fds_admin_capabilities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN public.freshers_weekend_is_admin() THEN jsonb_build_object('scheduled_predictions',true,'admin_tips_grants',false) ELSE '{}'::jsonb END;
$$;
REVOKE ALL ON FUNCTION public.fds_admin_capabilities() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fds_admin_capabilities() TO authenticated;
