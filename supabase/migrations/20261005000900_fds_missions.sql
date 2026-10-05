-- FDS only, after migration 008. No changes to betting/settlement RPCs.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_username text;
CREATE TABLE public.fds_missions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 150),
 description text NOT NULL DEFAULT '', instructions text NOT NULL DEFAULT '',
 image_path text, mission_type text NOT NULL CHECK(mission_type IN ('normal','race','competition')),
 reward_tips integer NOT NULL CHECK(reward_tips BETWEEN 1 AND 1000000),
 max_winners integer CHECK(max_winners>0),
 start_at timestamptz NOT NULL, end_at timestamptz NOT NULL CHECK(end_at>start_at),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','active','paused','closed','completed')),
 featured boolean NOT NULL DEFAULT false, is_flash boolean NOT NULL DEFAULT false,
 proof_method text NOT NULL CHECK(proof_method IN ('dm','story','organizer','other')),
 proof_instructions text NOT NULL DEFAULT '',
 created_by uuid REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(mission_type='normal' OR max_winners IS NOT NULL)
);
CREATE TABLE public.fds_mission_participations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mission_id uuid NOT NULL REFERENCES public.fds_missions(id),
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','winner')),
 registered_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz,
 reward_given boolean NOT NULL DEFAULT false, reward_amount integer NOT NULL DEFAULT 0,
 rewarded_at timestamptz, created_by uuid REFERENCES public.profiles(id),
 UNIQUE(mission_id,user_id)
);
CREATE TABLE public.fds_mission_rewards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 participation_id uuid NOT NULL UNIQUE REFERENCES public.fds_mission_participations(id),
 mission_id uuid NOT NULL REFERENCES public.fds_missions(id),
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 admin_id uuid NOT NULL REFERENCES public.profiles(id),
 amount integer NOT NULL CHECK(amount>0), balance_before integer NOT NULL, balance_after integer NOT NULL,
 type text NOT NULL DEFAULT 'MISSION_REWARD' CHECK(type='MISSION_REWARD'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fds_mission_participations_user_idx ON public.fds_mission_participations(user_id);
ALTER TABLE public.fds_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fds_mission_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fds_mission_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read published missions or admin drafts" ON public.fds_missions FOR SELECT TO authenticated
 USING(public.freshers_weekend_is_member() AND (status<>'draft' OR public.freshers_weekend_is_admin()));
CREATE POLICY "Own mission participation or admin" ON public.fds_mission_participations FOR SELECT TO authenticated
 USING(public.freshers_weekend_is_member() AND (user_id=auth.uid() OR public.freshers_weekend_is_admin()));
CREATE POLICY "Own mission reward or admin" ON public.fds_mission_rewards FOR SELECT TO authenticated
 USING(public.freshers_weekend_is_member() AND (user_id=auth.uid() OR public.freshers_weekend_is_admin()));
GRANT SELECT ON public.fds_missions,public.fds_mission_participations,public.fds_mission_rewards TO authenticated;
GRANT ALL ON public.fds_missions,public.fds_mission_participations,public.fds_mission_rewards TO service_role;

CREATE FUNCTION public.update_my_instagram(p_username text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.freshers_weekend_is_member() THEN RAISE EXCEPTION 'Access denied.'; END IF;
 v:=lower(trim(COALESCE(p_username,'')));
 v:=regexp_replace(v,'^https?://(www\.)?instagram\.com/','');
 v:=regexp_replace(v,'[/?].*$',''); v:=ltrim(v,'@');
 IF v<>'' AND v !~ '^[a-z0-9._]{1,30}$' THEN RAISE EXCEPTION 'Instagram inválido.'; END IF;
 UPDATE public.profiles SET instagram_username=NULLIF(v,'') WHERE id=auth.uid();
END;$$;
CREATE FUNCTION public.my_instagram()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT instagram_username FROM public.profiles WHERE id=auth.uid() AND public.freshers_weekend_is_member();
$$;

CREATE FUNCTION public.save_fds_mission(p_id uuid,p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public.fds_missions; v_id uuid; v_status text; v_image text;
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 v_status:=COALESCE(p_data->>'status','draft'); v_image:=NULLIF(p_data->>'image_path','');
 IF v_image IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='prediction-images' AND name=v_image) THEN RAISE EXCEPTION 'Image not found.'; END IF;
 IF p_id IS NOT NULL THEN
 SELECT * INTO v FROM public.fds_missions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Mission not found.'; END IF;
 IF EXISTS(SELECT 1 FROM public.fds_mission_participations WHERE mission_id=p_id) AND
 (v.mission_type IS DISTINCT FROM p_data->>'mission_type' OR v.reward_tips IS DISTINCT FROM (p_data->>'reward_tips')::integer OR v.max_winners IS DISTINCT FROM NULLIF(p_data->>'max_winners','')::integer)
 THEN RAISE EXCEPTION 'Reward, model and capacity cannot change after participation.'; END IF;
 END IF;
 IF v_status IN ('active','scheduled') AND (p_data->>'end_at')::timestamptz<=now() THEN RAISE EXCEPTION 'Choose a future deadline.'; END IF;
 IF p_id IS NULL THEN
 INSERT INTO public.fds_missions(title,description,instructions,image_path,mission_type,reward_tips,max_winners,start_at,end_at,status,featured,is_flash,proof_method,proof_instructions,created_by)
 VALUES(trim(p_data->>'title'),COALESCE(p_data->>'description',''),COALESCE(p_data->>'instructions',''),v_image,p_data->>'mission_type',(p_data->>'reward_tips')::integer,NULLIF(p_data->>'max_winners','')::integer,(p_data->>'start_at')::timestamptz,(p_data->>'end_at')::timestamptz,v_status,COALESCE((p_data->>'featured')::boolean,false),COALESCE((p_data->>'is_flash')::boolean,false),p_data->>'proof_method',COALESCE(p_data->>'proof_instructions',''),auth.uid()) RETURNING id INTO v_id;
 ELSE
 UPDATE public.fds_missions SET title=trim(p_data->>'title'),description=COALESCE(p_data->>'description',''),instructions=COALESCE(p_data->>'instructions',''),image_path=v_image,mission_type=p_data->>'mission_type',reward_tips=(p_data->>'reward_tips')::integer,max_winners=NULLIF(p_data->>'max_winners','')::integer,start_at=(p_data->>'start_at')::timestamptz,end_at=(p_data->>'end_at')::timestamptz,status=v_status,featured=COALESCE((p_data->>'featured')::boolean,false),is_flash=COALESCE((p_data->>'is_flash')::boolean,false),proof_method=p_data->>'proof_method',proof_instructions=COALESCE(p_data->>'proof_instructions',''),updated_at=now() WHERE id=p_id RETURNING id INTO v_id;
 END IF; RETURN v_id;
END;$$;

CREATE FUNCTION public.set_fds_mission_status(p_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 IF p_status NOT IN ('paused','closed','completed','active') THEN RAISE EXCEPTION 'Invalid status.'; END IF;
 UPDATE public.fds_missions SET status=p_status,updated_at=now() WHERE id=p_id AND status<>'draft'
 AND (p_status NOT IN ('active') OR end_at>now());
 IF NOT FOUND THEN RAISE EXCEPTION 'Mission cannot change to this status.'; END IF;
END;$$;

CREATE FUNCTION public.search_fds_mission_users(p_query text)
RETURNS TABLE(id uuid,username text,student_number text,instagram_username text,balance integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT p.id,p.username,p.student_number,p.instagram_username,p.balance FROM public.profiles p
 WHERE public.freshers_weekend_is_admin() AND length(trim(p_query))>=2
 AND (p.username ILIKE '%'||trim(p_query)||'%' OR p.student_number ILIKE '%'||trim(p_query)||'%' OR p.instagram_username ILIKE '%'||ltrim(trim(p_query),'@')||'%')
 ORDER BY p.username NULLS LAST,p.id LIMIT 20;
$$;
CREATE FUNCTION public.register_fds_mission_participation(p_mission_id uuid,p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.fds_missions; v_id uuid;
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 SELECT * INTO m FROM public.fds_missions WHERE id=p_mission_id FOR UPDATE;
 IF NOT FOUND OR m.status NOT IN ('active','scheduled') OR now()<m.start_at OR now()>=m.end_at THEN RAISE EXCEPTION 'Mission is not accepting participation.'; END IF;
 IF m.max_winners IS NOT NULL AND m.mission_type<>'competition' AND
 (SELECT count(*) FROM public.fds_mission_participations WHERE mission_id=m.id AND reward_given)>=m.max_winners THEN RAISE EXCEPTION 'Reward slots full.'; END IF;
 INSERT INTO public.fds_mission_participations(mission_id,user_id,created_by)
 VALUES(m.id,p_user_id,auth.uid()) ON CONFLICT(mission_id,user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING id INTO v_id;
 RETURN v_id;
END;$$;

CREATE FUNCTION public.review_fds_mission_participation(p_id uuid,p_action text)
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
 IF p_action NOT IN ('approve','reject','winner') THEN RAISE EXCEPTION 'Invalid action.'; END IF;
 IF m.status IN ('draft','paused','completed') OR now()<m.start_at THEN RAISE EXCEPTION 'Mission review unavailable.'; END IF;
 IF p_action='reject' THEN UPDATE public.fds_mission_participations SET status='rejected' WHERE id=p.id; RETURN; END IF;
 IF p_action='winner' AND (m.mission_type<>'competition' OR p.status<>'approved' OR (now()<m.end_at AND m.status<>'closed')) THEN RAISE EXCEPTION 'Close competition and approve participation before selecting winner.'; END IF;
 IF m.mission_type='competition' AND p_action='approve' THEN
 UPDATE public.fds_mission_participations SET status='approved',approved_at=now() WHERE id=p.id; RETURN;
 END IF;
 IF m.max_winners IS NOT NULL AND (SELECT count(*) FROM public.fds_mission_participations WHERE mission_id=m.id AND reward_given)>=m.max_winners THEN RAISE EXCEPTION 'Reward slots full.'; END IF;
 SELECT balance INTO v_balance FROM public.profiles WHERE id=p.user_id FOR UPDATE;
 IF v_balance IS NULL OR v_balance::bigint+m.reward_tips>2147483647 THEN RAISE EXCEPTION 'Invalid balance.'; END IF;
 UPDATE public.profiles SET balance=balance+m.reward_tips WHERE id=p.user_id;
 UPDATE public.fds_mission_participations SET status=CASE WHEN m.mission_type='competition' THEN 'winner' ELSE 'approved' END,approved_at=now(),reward_given=true,reward_amount=m.reward_tips,rewarded_at=now() WHERE id=p.id;
 INSERT INTO public.fds_mission_rewards(participation_id,mission_id,user_id,admin_id,amount,balance_before,balance_after)
 VALUES(p.id,m.id,p.user_id,auth.uid(),m.reward_tips,v_balance,v_balance+m.reward_tips);
END;$$;

CREATE FUNCTION public.fds_mission_capacity()
RETURNS TABLE(mission_id uuid,rewarded bigint,participants bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT m.id,count(p.id) FILTER(WHERE p.reward_given),count(p.id) FILTER(WHERE p.status<>'rejected')
 FROM public.fds_missions m LEFT JOIN public.fds_mission_participations p ON p.mission_id=m.id
 WHERE public.freshers_weekend_is_member() AND (m.status<>'draft' OR public.freshers_weekend_is_admin()) GROUP BY m.id;
$$;
CREATE FUNCTION public.fds_mission_admin_participants(p_mission_id uuid)
RETURNS TABLE(id uuid,user_id uuid,status text,reward_given boolean,reward_amount integer,registered_at timestamptz,username text,student_number text,instagram_username text,balance integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT p.id,p.user_id,p.status,p.reward_given,p.reward_amount,p.registered_at,u.username,u.student_number,u.instagram_username,u.balance
 FROM public.fds_mission_participations p JOIN public.profiles u ON u.id=p.user_id
 WHERE p.mission_id=p_mission_id AND public.freshers_weekend_is_admin() ORDER BY p.registered_at,p.id;
$$;

REVOKE ALL ON FUNCTION public.update_my_instagram(text),public.my_instagram(),public.save_fds_mission(uuid,jsonb),public.set_fds_mission_status(uuid,text),public.search_fds_mission_users(text),public.register_fds_mission_participation(uuid,uuid),public.review_fds_mission_participation(uuid,text),public.fds_mission_capacity(),public.fds_mission_admin_participants(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_my_instagram(text),public.my_instagram(),public.save_fds_mission(uuid,jsonb),public.set_fds_mission_status(uuid,text),public.search_fds_mission_users(text),public.register_fds_mission_participation(uuid,uuid),public.review_fds_mission_participation(uuid,text),public.fds_mission_capacity(),public.fds_mission_admin_participants(uuid) TO authenticated;
