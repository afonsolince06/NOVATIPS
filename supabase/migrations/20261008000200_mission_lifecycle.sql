-- FDS only, after migration 013. Finished missions keep history; unused test missions may be deleted.
ALTER TABLE public.fds_missions ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.complete_fds_mission(p_id uuid,p_allow_unresolved boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.fds_missions; v_unresolved bigint; v_rewarded bigint;
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 SELECT * INTO m FROM public.fds_missions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missão não encontrada.'; END IF;
 IF m.status='completed' THEN RETURN; END IF;
 IF m.status='draft' OR (m.status IN ('scheduled','active','paused') AND now()<m.end_at) THEN
  RAISE EXCEPTION 'Fecha a missão ou espera pelo fim do prazo antes de a concluir.';
 END IF;
 SELECT count(*) FILTER(WHERE status='pending' AND NOT reward_given),
        count(*) FILTER(WHERE reward_given)
 INTO v_unresolved,v_rewarded FROM public.fds_mission_participations WHERE mission_id=p_id;
 IF NOT p_allow_unresolved AND (v_unresolved>0 OR (m.max_winners IS NOT NULL AND v_rewarded<m.max_winners)) THEN
  RAISE EXCEPTION 'Ainda há provas ou prémios por decidir. Revê e confirma o arquivo.';
 END IF;
 UPDATE public.fds_missions SET status='completed',completed_at=now(),updated_at=now() WHERE id=p_id;
END;$$;

CREATE OR REPLACE FUNCTION public.delete_unused_fds_mission(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.fds_missions;
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 SELECT * INTO m FROM public.fds_missions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missão não encontrada.'; END IF;
 IF EXISTS(SELECT 1 FROM public.fds_mission_participations WHERE mission_id=p_id) OR
    EXISTS(SELECT 1 FROM public.fds_mission_rewards WHERE mission_id=p_id) THEN
  RAISE EXCEPTION 'Esta missão tem participações ou recompensas. Conclui e arquiva para preservar o histórico.';
 END IF;
 DELETE FROM public.fds_missions WHERE id=p_id;
END;$$;
REVOKE ALL ON FUNCTION public.complete_fds_mission(uuid,boolean),public.delete_unused_fds_mission(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_fds_mission(uuid,boolean),public.delete_unused_fds_mission(uuid) TO authenticated;
