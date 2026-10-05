-- Apply after migrations 004, 005 and 006, on the FDS project only.
-- Reuse save_mega_boost validation, uploads, replacement and option locking.
CREATE OR REPLACE FUNCTION public.save_prediction(p_bet_id uuid, p_payload jsonb, p_replace_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_id uuid; v_mega boolean;
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 v_mega := COALESCE((p_payload->>'enabled')::boolean, false);
 IF NOT v_mega AND COALESCE(trim(p_payload->>'no_label'),'') = '' THEN
   RAISE EXCEPTION 'Normal predictions require two options.';
 END IF;
 v_id := public.save_mega_boost(p_bet_id,p_payload,p_replace_id);
 UPDATE public.bets SET
   mega_boost=CASE WHEN v_mega THEN mega_boost ELSE NULL END,
   trending=COALESCE((p_payload->>'trending')::boolean,false),
   featured=COALESCE((p_payload->>'featured')::boolean,false)
 WHERE id=v_id;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_prediction(uuid,jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_prediction(uuid,jsonb,uuid) TO authenticated;
