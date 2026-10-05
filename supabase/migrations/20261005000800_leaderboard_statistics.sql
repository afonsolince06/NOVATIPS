-- FDS only. Aggregate results without exposing individual betting histories.
CREATE OR REPLACE FUNCTION public.event_prediction_statistics()
RETURNS TABLE(user_id uuid, correct_predictions bigint, settled_predictions bigint, accuracy numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
 WITH outcomes AS (
 SELECT p.user_id, p.bet_id::text AS prediction_id, p.option_label, p.status
 FROM public.placed_bets p WHERE NOT p.is_multiple AND p.status IN ('Won','Lost')
 UNION
 SELECT p.user_id, leg->>'bet_id', leg->>'option_label', leg->>'status'
 FROM public.placed_bets p CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.legs,'[]'::jsonb)) leg
 WHERE p.is_multiple AND p.status <> 'Cancelled' AND leg->>'status' IN ('Won','Lost')
 ), totals AS (
 SELECT o.user_id, count(*) FILTER(WHERE o.status='Won') AS correct, count(*) AS settled
 FROM outcomes o GROUP BY o.user_id
 )
 SELECT p.id, COALESCE(t.correct,0), COALESCE(t.settled,0),
 CASE WHEN t.settled > 0 THEN t.correct::numeric*100/t.settled ELSE NULL END
 FROM public.profiles p LEFT JOIN totals t ON t.user_id=p.id
 WHERE public.freshers_weekend_is_member();
$$;
REVOKE ALL ON FUNCTION public.event_prediction_statistics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_prediction_statistics() TO authenticated;
