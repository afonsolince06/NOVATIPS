-- Apply after Mega Boost migration 004. Custom labels and independent boosted odds.
CREATE OR REPLACE FUNCTION public.save_mega_boost(p_bet_id uuid, p_payload jsonb, p_replace_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
 v_id uuid; v_current uuid; v_old public.bets; v_options jsonb; v_meta jsonb;
 v_label_yes text; v_label_no text; v_boost_no numeric; v_close timestamptz; v_yes numeric; v_no numeric; v_boost numeric; v_active boolean; v_enabled boolean;
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 -- Serialize concurrent activation attempts. Confirmation names the exact replaced prediction.
 PERFORM pg_advisory_xact_lock(610050004);
 v_enabled := COALESCE((p_payload->>'enabled')::boolean, true);
 v_active := v_enabled AND COALESCE((p_payload->>'active')::boolean, false);
 v_close := (p_payload->>'closes_at')::timestamptz;
 v_yes := (p_payload->>'yes_odds')::numeric;
 v_no := (p_payload->>'no_odds')::numeric;
 v_boost := NULLIF(p_payload->>'boosted_odds','')::numeric;
 v_boost_no := NULLIF(p_payload->>'boosted_no_odds','')::numeric;
 v_label_yes := trim(COALESCE(p_payload->>'yes_label','Sim'));
 v_label_no := trim(COALESCE(p_payload->>'no_label','Não'));
 IF v_label_yes = '' OR v_label_no = '' OR lower(v_label_yes)=lower(v_label_no) THEN RAISE EXCEPTION 'Give each option a distinct name.'; END IF;
 IF COALESCE(trim(p_payload->>'title'),'') = '' OR v_close IS NULL OR
    v_yes IS NULL OR v_no IS NULL OR v_yes <= 1 OR v_no <= 1 OR
    (v_boost IS NOT NULL AND v_boost <= 1) THEN RAISE EXCEPTION 'Title, closing date and odds greater than 1 are required.'; END IF;
 IF v_yes::text IN ('NaN','Infinity','-Infinity') OR v_no::text IN ('NaN','Infinity','-Infinity') OR v_boost::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Odds must be finite.'; END IF;
 IF v_boost IS NOT NULL AND v_boost <= v_yes THEN RAISE EXCEPTION 'Boosted odds must exceed the base YES odds.'; END IF;
 IF v_boost_no IS NOT NULL AND (v_boost_no::text IN ('NaN','Infinity','-Infinity') OR v_boost_no <= v_no) THEN RAISE EXCEPTION 'Option 2 boosted odds must exceed its base odds.'; END IF;
 IF v_active AND v_close <= now() THEN RAISE EXCEPTION 'An active Mega Boost must close in the future.'; END IF;
 IF p_bet_id IS NOT NULL THEN
   SELECT * INTO v_old FROM public.bets WHERE id = p_bet_id FOR UPDATE;
   IF NOT FOUND OR v_old.status <> 'open' THEN RAISE EXCEPTION 'Prediction is no longer open.'; END IF;
 END IF;
 v_options := jsonb_build_array(jsonb_build_object('label',v_label_yes,'odds',COALESCE(v_boost,v_yes)),jsonb_build_object('label',v_label_no,'odds',COALESCE(v_boost_no,v_no)));
 -- Never change outcomes/odds once users have placed single or multiple bets.
 IF p_bet_id IS NOT NULL AND v_options IS DISTINCT FROM v_old.options AND EXISTS (
   SELECT 1 FROM public.placed_bets WHERE bet_id=p_bet_id OR
   (is_multiple AND legs @> jsonb_build_array(jsonb_build_object('bet_id',p_bet_id::text)))
 ) THEN RAISE EXCEPTION 'Cannot change options or odds after bets have been placed.'; END IF;
 IF v_enabled AND COALESCE(p_payload->>'image_path','') = '' THEN RAISE EXCEPTION 'Upload a Mega Boost image.'; END IF;
 IF v_enabled AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='prediction-images' AND name=p_payload->>'image_path') THEN
   RAISE EXCEPTION 'Uploaded image not found.';
 END IF;
 SELECT id INTO v_current FROM public.bets WHERE mega_boost @> '{"enabled":true,"active":true}'::jsonb AND status='open' AND id IS DISTINCT FROM p_bet_id;
 IF v_active AND v_current IS NOT NULL THEN
   IF p_replace_id IS DISTINCT FROM v_current THEN RAISE EXCEPTION 'Another Mega Boost is active. Refresh and confirm replacement.'; END IF;
   UPDATE public.bets SET mega_boost=jsonb_set(mega_boost,'{active}','false') WHERE id=v_current;
 END IF;
 v_meta := jsonb_build_object('enabled',v_enabled,'active',v_active,'image_path',p_payload->>'image_path','badge',left(COALESCE(p_payload->>'badge',''),80),'base_yes_odds',v_yes,'base_no_odds',v_no,'boosted_odds',v_boost,'boosted_no_odds',v_boost_no);
 IF p_bet_id IS NULL THEN
   INSERT INTO public.bets(title,description,options,closes_at,closes_in_label,section,mega_boost)
   VALUES(trim(p_payload->>'title'),COALESCE(p_payload->>'description',''),v_options,v_close,'',COALESCE(p_payload->>'section','general'),v_meta) RETURNING id INTO v_id;
 ELSE
   UPDATE public.bets SET title=trim(p_payload->>'title'),description=COALESCE(p_payload->>'description',''),options=v_options,closes_at=v_close,section=COALESCE(p_payload->>'section','general'),mega_boost=v_meta WHERE id=p_bet_id RETURNING id INTO v_id;
 END IF;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_mega_boost(uuid,jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_mega_boost(uuid,jsonb,uuid) TO authenticated;
