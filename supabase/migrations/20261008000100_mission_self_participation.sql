-- FDS only, after migration 012. Extend existing participation and reward records.
ALTER TABLE public.fds_mission_participations
 ADD COLUMN IF NOT EXISTS proof_received_at timestamptz,
 ADD COLUMN IF NOT EXISTS proof_received_by uuid REFERENCES public.profiles(id),
 ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
 ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id);

CREATE OR REPLACE FUNCTION public.join_fds_mission(p_mission_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.fds_missions; v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.freshers_weekend_is_member() THEN RAISE EXCEPTION 'Inicia sessão para participar.'; END IF;
 SELECT * INTO m FROM public.fds_missions WHERE id=p_mission_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missão não encontrada.'; END IF;
 SELECT id INTO v_id FROM public.fds_mission_participations WHERE mission_id=m.id AND user_id=auth.uid();
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 IF m.status NOT IN ('active','scheduled') OR now()<m.start_at OR now()>=m.end_at THEN RAISE EXCEPTION 'Esta missão não está a aceitar participações.'; END IF;
 IF m.max_winners IS NOT NULL AND m.mission_type<>'competition' AND
 (SELECT count(*) FROM public.fds_mission_participations WHERE mission_id=m.id AND reward_given)>=m.max_winners THEN RAISE EXCEPTION 'Esta missão já atribuiu todas as recompensas disponíveis.'; END IF;
 INSERT INTO public.fds_mission_participations(mission_id,user_id,created_by) VALUES(m.id,auth.uid(),auth.uid())
 ON CONFLICT(mission_id,user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING id INTO v_id;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.join_fds_mission(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_fds_mission(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_fds_mission_participation(p_id uuid,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.fds_missions; p public.fds_mission_participations; v_mission uuid; v_balance integer;
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 SELECT mission_id INTO v_mission FROM public.fds_mission_participations WHERE id=p_id;
 -- All operations lock mission first to serialize capacity/reward decisions.
 SELECT * INTO m FROM public.fds_missions WHERE id=v_mission FOR UPDATE;
 SELECT * INTO p FROM public.fds_mission_participations WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Participation not found.'; END IF;
 IF p.reward_given THEN RAISE EXCEPTION 'Reward already assigned.'; END IF;
 IF p_action NOT IN ('approve','reject','winner','proof') THEN RAISE EXCEPTION 'Invalid action.'; END IF;
 IF m.status IN ('draft','paused','completed') OR now()<m.start_at THEN RAISE EXCEPTION 'Mission review unavailable.'; END IF;
 IF p_action='proof' THEN UPDATE public.fds_mission_participations SET proof_received_at=COALESCE(proof_received_at,now()),proof_received_by=COALESCE(proof_received_by,auth.uid()) WHERE id=p.id; RETURN; END IF;
 IF p_action='reject' THEN UPDATE public.fds_mission_participations SET status='rejected',reviewed_at=now(),reviewed_by=auth.uid() WHERE id=p.id; RETURN; END IF;
 IF p_action='winner' AND (m.mission_type<>'competition' OR p.status<>'approved' OR (now()<m.end_at AND m.status<>'closed')) THEN RAISE EXCEPTION 'Close competition and approve participation before selecting winner.'; END IF;
 IF m.mission_type='competition' AND p_action='approve' THEN
 UPDATE public.fds_mission_participations SET status='approved',approved_at=now(),reviewed_at=now(),reviewed_by=auth.uid() WHERE id=p.id; RETURN;
 END IF;
 IF m.max_winners IS NOT NULL AND (SELECT count(*) FROM public.fds_mission_participations WHERE mission_id=m.id AND reward_given)>=m.max_winners THEN RAISE EXCEPTION 'Esta missão já atribuiu todas as recompensas disponíveis.'; END IF;
 SELECT balance INTO v_balance FROM public.profiles WHERE id=p.user_id FOR UPDATE;
 IF v_balance IS NULL OR v_balance::bigint+m.reward_tips>2147483647 THEN RAISE EXCEPTION 'Invalid balance.'; END IF;
 UPDATE public.profiles SET balance=balance+m.reward_tips WHERE id=p.user_id;
 UPDATE public.fds_mission_participations SET status=CASE WHEN m.mission_type='competition' THEN 'winner' ELSE 'approved' END,approved_at=now(),reviewed_at=now(),reviewed_by=auth.uid(),reward_given=true,reward_amount=m.reward_tips,rewarded_at=now() WHERE id=p.id;
 INSERT INTO public.fds_mission_rewards(participation_id,mission_id,user_id,admin_id,amount,balance_before,balance_after)
 VALUES(p.id,m.id,p.user_id,auth.uid(),m.reward_tips,v_balance,v_balance+m.reward_tips);
END;$$;


-- Private profile/proof details are available only to administrators.
CREATE OR REPLACE FUNCTION public.fds_mission_participant_details(p_mission_id uuid)
RETURNS TABLE(id uuid,user_id uuid,status text,reward_given boolean,reward_amount integer,registered_at timestamptz,username text,student_number text,official_name text,instagram_username text,balance integer,proof_received_at timestamptz,reviewed_at timestamptz,reviewed_by uuid,rewarded_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT p.id,p.user_id,p.status,p.reward_given,p.reward_amount,p.registered_at,u.username,u.student_number,r.official_name,u.instagram_username,u.balance,p.proof_received_at,p.reviewed_at,p.reviewed_by,p.rewarded_at
 FROM public.fds_mission_participations p JOIN public.profiles u ON u.id=p.user_id LEFT JOIN public.fds_house_roster r ON r.student_number=u.student_number
 WHERE p.mission_id=p_mission_id AND public.freshers_weekend_is_admin() ORDER BY p.registered_at,p.id;
$$;
CREATE OR REPLACE FUNCTION public.fds_mission_review_summary()
RETURNS TABLE(mission_id uuid,proofs_received bigint,awaiting_review bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT m.id,count(p.id) FILTER(WHERE p.proof_received_at IS NOT NULL),count(p.id) FILTER(WHERE p.proof_received_at IS NOT NULL AND p.status='pending' AND NOT p.reward_given)
 FROM public.fds_missions m LEFT JOIN public.fds_mission_participations p ON p.mission_id=m.id
 WHERE public.freshers_weekend_is_admin() GROUP BY m.id;
$$;
REVOKE ALL ON FUNCTION public.fds_mission_participant_details(uuid),public.fds_mission_review_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fds_mission_participant_details(uuid),public.fds_mission_review_summary() TO authenticated;
