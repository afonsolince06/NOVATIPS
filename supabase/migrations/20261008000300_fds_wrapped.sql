-- FDS only. Additive Wrapped storage; no betting, settlement or balance RPC is replaced.
CREATE TABLE public.fds_wrapped_settings (
 kind text PRIMARY KEY CHECK (kind IN ('day1','final')),
 release_at timestamptz,
 period_start timestamptz,
 enabled boolean NOT NULL DEFAULT false,
 disabled_stories text[] NOT NULL DEFAULT '{}',
 editorial_copy jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(editorial_copy)='object'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (release_at IS NULL OR period_start IS NULL OR period_start < release_at)
);
INSERT INTO public.fds_wrapped_settings(kind) VALUES ('day1'),('final') ON CONFLICT DO NOTHING;
CREATE TABLE public.fds_wrapped_snapshots (
 kind text PRIMARY KEY REFERENCES public.fds_wrapped_settings(kind),
 cutoff_at timestamptz NOT NULL,
 published_at timestamptz NOT NULL DEFAULT now(),
 global_payload jsonb NOT NULL CHECK (jsonb_typeof(global_payload)='object')
);
CREATE TABLE public.fds_wrapped_personal (
 kind text NOT NULL REFERENCES public.fds_wrapped_snapshots(kind),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
 PRIMARY KEY(kind,user_id)
);
CREATE TABLE public.fds_wrapped_views (
 kind text NOT NULL REFERENCES public.fds_wrapped_snapshots(kind),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 announcement_seen_at timestamptz,
 opened_at timestamptz,
 completed_at timestamptz,
 PRIMARY KEY(kind,user_id)
);
ALTER TABLE public.fds_wrapped_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fds_wrapped_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fds_wrapped_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fds_wrapped_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fds_wrapped_settings,public.fds_wrapped_snapshots,public.fds_wrapped_personal,public.fds_wrapped_views FROM anon,authenticated;

ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS settled_at timestamptz;
UPDATE public.bets SET settled_at=now() WHERE status='resolved' AND settled_at IS NULL;

-- A selection is one predicted outcome. Multiple slips contribute one selection per leg.
-- A prediction is settled only when the underlying bet has been resolved by the cutoff.
CREATE OR REPLACE FUNCTION public.fds_wrapped_selections(p_start timestamptz,p_cutoff timestamptz)
RETURNS TABLE(user_id uuid,bet_id uuid,option_label text,placed_at timestamptz,amount integer,correct boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT p.user_id,p.bet_id,p.option_label,p.placed_at,p.amount,
 CASE WHEN b.status='resolved' AND b.settled_at<=p_cutoff THEN p.option_label=b.winning_option ELSE NULL END
 FROM public.placed_bets p JOIN public.bets b ON b.id=p.bet_id
 WHERE NOT p.is_multiple AND p.status<>'Cancelled' AND p.placed_at>=p_start AND p.placed_at<=p_cutoff
 UNION ALL
 SELECT p.user_id,(leg->>'bet_id')::uuid,leg->>'option_label',p.placed_at,p.amount,
 CASE WHEN b.status='resolved' AND b.settled_at<=p_cutoff THEN leg->>'option_label'=b.winning_option ELSE NULL END
 FROM public.placed_bets p CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.legs,'[]'::jsonb)) leg
 JOIN public.bets b ON b.id=(leg->>'bet_id')::uuid
 WHERE p.is_multiple AND p.status<>'Cancelled' AND p.placed_at>=p_start AND p.placed_at<=p_cutoff;
$$;
REVOKE ALL ON FUNCTION public.fds_wrapped_selections(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;

-- Record settlement time without changing the existing settlement implementation.
CREATE OR REPLACE FUNCTION public.fds_wrapped_stamp_settlement() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status='resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN NEW.settled_at:=now(); END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS fds_wrapped_stamp_settlement ON public.bets;
CREATE TRIGGER fds_wrapped_stamp_settlement BEFORE UPDATE OF status ON public.bets
FOR EACH ROW EXECUTE FUNCTION public.fds_wrapped_stamp_settlement();

-- A small balance journal makes the cutoff balance exact even if snapshot work runs later.
CREATE TABLE public.fds_wrapped_balance_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 balance integer NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX fds_wrapped_balance_history_lookup ON public.fds_wrapped_balance_history(user_id,changed_at DESC,id DESC);
ALTER TABLE public.fds_wrapped_balance_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fds_wrapped_balance_history FROM anon,authenticated;
INSERT INTO public.fds_wrapped_balance_history(user_id,balance) SELECT id,balance FROM public.profiles;
CREATE OR REPLACE FUNCTION public.fds_wrapped_record_balance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.balance IS DISTINCT FROM OLD.balance THEN
  INSERT INTO public.fds_wrapped_balance_history(user_id,balance) VALUES(NEW.id,NEW.balance);
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS fds_wrapped_record_balance ON public.profiles;
CREATE TRIGGER fds_wrapped_record_balance AFTER INSERT OR UPDATE OF balance ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.fds_wrapped_record_balance();
REVOKE ALL ON FUNCTION public.fds_wrapped_record_balance() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.fds_wrapped_build_global(p_start timestamptz,p_cutoff timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_result jsonb; v_popular jsonb; v_upset jsonb; v_oracle jsonb; v_houses jsonb; v_winner jsonb;
BEGIN
 WITH s AS (SELECT * FROM public.fds_wrapped_selections(p_start,p_cutoff)), u AS (SELECT DISTINCT user_id,bet_id,option_label,correct FROM s)
 SELECT jsonb_build_object(
  'prediction_count',(SELECT count(*) FROM s),
  'participant_count',(SELECT count(DISTINCT user_id) FROM s),
  'settled_count',count(*) FILTER(WHERE correct IS NOT NULL),
  'correct_count',count(*) FILTER(WHERE correct),
  'tips_staked',(SELECT COALESCE(sum(amount),0) FROM public.placed_bets WHERE status<>'Cancelled' AND placed_at BETWEEN p_start AND p_cutoff)) INTO v_result FROM u;
 WITH s AS (SELECT * FROM public.fds_wrapped_selections(p_start,p_cutoff)), ranked AS (
  SELECT s.bet_id,count(DISTINCT s.user_id) n FROM s GROUP BY s.bet_id ORDER BY n DESC,s.bet_id LIMIT 1)
 SELECT jsonb_build_object('title',b.title,'participants',r.n) INTO v_popular
 FROM ranked r JOIN public.bets b ON b.id=r.bet_id;
 WITH raw AS (SELECT * FROM public.fds_wrapped_selections(p_start,p_cutoff)), s AS (SELECT DISTINCT ON (user_id,bet_id) user_id,bet_id,option_label,correct FROM raw ORDER BY user_id,bet_id,placed_at,option_label), groups AS (
  SELECT b.id,b.title,CASE WHEN b.winning_option LIKE '__mega_boost_loss_%' THEN 'Não aconteceu' ELSE b.winning_option END winning_option,s.option_label,count(DISTINCT s.user_id) voters,
  (SELECT count(DISTINCT x.user_id) FROM s x WHERE x.bet_id=b.id) total
  FROM s JOIN public.bets b ON b.id=s.bet_id WHERE s.correct=false
  GROUP BY b.id,b.title,b.winning_option,s.option_label), ranked AS (
  SELECT *,round(100.0*voters/NULLIF(total,0)) pct FROM groups
  WHERE total>=8 AND voters*100>=65*total ORDER BY voters*1.0/total DESC,total DESC,id LIMIT 1)
 SELECT jsonb_build_object('title',title,'chose',option_label,'answer',winning_option,'percent',pct,'participants',total)
 INTO v_upset FROM ranked;
 WITH raw AS (SELECT * FROM public.fds_wrapped_selections(p_start,p_cutoff)), s AS (SELECT DISTINCT user_id,bet_id,option_label,correct FROM raw), scores AS (
  SELECT user_id,count(*) FILTER(WHERE correct) wins,count(*) FILTER(WHERE correct IS NOT NULL) settled
  FROM s WHERE user_id IN (SELECT id FROM public.fds_eligible_participants()) GROUP BY user_id HAVING count(*) FILTER(WHERE correct IS NOT NULL)>=3), best AS (
  SELECT *,rank() OVER(ORDER BY wins::numeric/settled DESC,wins DESC) place FROM scores)
 SELECT jsonb_agg(jsonb_build_object('name',COALESCE(NULLIF(p.username,''),'Participante'),'wins',b.wins,'settled',b.settled))
 INTO v_oracle FROM best b JOIN public.profiles p ON p.id=b.user_id WHERE b.place=1;
 SELECT jsonb_agg(jsonb_build_object('number',number,'rank',rank,'score',score,'mode',ranking_mode) ORDER BY rank,number)
 INTO v_houses FROM (SELECT * FROM public.fds_house_leaderboard_at(p_cutoff) WHERE rank IS NOT NULL ORDER BY rank,number LIMIT 3) h;
 WITH raw AS (SELECT * FROM public.fds_wrapped_selections(p_start,p_cutoff)), s AS (SELECT DISTINCT user_id,bet_id,option_label,correct FROM raw), scores AS (
  SELECT user_id,count(*) FILTER(WHERE correct) wins,count(*) FILTER(WHERE correct IS NOT NULL) settled FROM s GROUP BY user_id), eligible AS (
  SELECT e.id,e.username,h.balance,COALESCE(sc.wins,0) wins,COALESCE(sc.settled,0) settled FROM public.fds_eligible_participants() e JOIN LATERAL (SELECT balance FROM public.fds_wrapped_balance_history WHERE user_id=e.id AND changed_at<=p_cutoff ORDER BY changed_at DESC,id DESC LIMIT 1) h ON true LEFT JOIN scores sc ON sc.user_id=e.id), ranked AS (
  SELECT *,rank() OVER(ORDER BY balance DESC,wins DESC,CASE WHEN settled>0 THEN wins::numeric/settled ELSE 0 END DESC) place FROM eligible)
 SELECT jsonb_agg(jsonb_build_object('name',COALESCE(NULLIF(username,''),'Participante'),'tips',balance)) INTO v_winner FROM ranked WHERE place=1;
 RETURN v_result || jsonb_build_object(
  'popular',v_popular,'upset',v_upset,'oracle',v_oracle,'houses',COALESCE(v_houses,'[]'::jsonb),'winners',COALESCE(v_winner,'[]'::jsonb),
  'mission_participations',(SELECT count(*) FROM public.fds_mission_participations WHERE registered_at BETWEEN p_start AND p_cutoff),
  'mission_proofs',(SELECT count(*) FROM public.fds_mission_participations WHERE proof_received_at BETWEEN p_start AND p_cutoff),
  'mission_tips',(SELECT COALESCE(sum(amount),0) FROM public.fds_mission_rewards WHERE created_at BETWEEN p_start AND p_cutoff),
  'mission_count',(SELECT count(*) FROM public.fds_missions WHERE status<>'draft' AND start_at<=p_cutoff AND end_at>=p_start),
  'house_count',(SELECT count(*) FROM public.fds_houses),
  'mission_popular',(SELECT jsonb_build_object('title',m.title,'participants',count(p.id)) FROM public.fds_missions m JOIN public.fds_mission_participations p ON p.mission_id=m.id WHERE p.registered_at BETWEEN p_start AND p_cutoff GROUP BY m.id,m.title ORDER BY count(p.id) DESC,m.id LIMIT 1),
  'mega_boost',(SELECT jsonb_build_object('title',b.title,'participants',count(DISTINCT s.user_id)) FROM public.bets b JOIN public.fds_wrapped_selections(p_start,p_cutoff) s ON s.bet_id=b.id WHERE b.mega_boost IS NOT NULL AND b.mega_boost->>'enabled'='true' GROUP BY b.id,b.title ORDER BY count(DISTINCT s.user_id) DESC,b.id LIMIT 1));
END;$$;
REVOKE ALL ON FUNCTION public.fds_wrapped_build_global(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.fds_wrapped_build_personal(p_user uuid,p_start timestamptz,p_cutoff timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_stats record; v_rank bigint; v_total bigint; v_balance integer; v_start_balance integer;
 v_house record; v_missions bigint; v_mission_tips bigint; v_name text; v_personality text;
BEGIN
 WITH s AS (SELECT * FROM public.fds_wrapped_selections(p_start,p_cutoff) WHERE user_id=p_user), u AS (SELECT DISTINCT user_id,bet_id,option_label,correct FROM s)
 SELECT (SELECT count(*) FROM s) selections,count(*) FILTER(WHERE correct) wins,count(*) FILTER(WHERE correct=false) losses,
 count(*) FILTER(WHERE correct IS NOT NULL) settled INTO v_stats FROM u;
 SELECT h.balance INTO v_balance FROM public.fds_wrapped_balance_history h
 WHERE h.user_id=p_user AND h.changed_at<=p_cutoff ORDER BY h.changed_at DESC,h.id DESC LIMIT 1;
 SELECT h.balance INTO v_start_balance FROM public.fds_wrapped_balance_history h
 WHERE h.user_id=p_user AND h.changed_at<=p_start ORDER BY h.changed_at DESC,h.id DESC LIMIT 1;
 SELECT COALESCE(NULLIF(username,''),'Participante') INTO v_name FROM public.profiles WHERE id=p_user;
 WITH raw AS (SELECT * FROM public.fds_wrapped_selections(p_start,p_cutoff)), s AS (SELECT DISTINCT user_id,bet_id,option_label,correct FROM raw), scores AS (
  SELECT user_id,count(*) FILTER(WHERE correct) wins,count(*) FILTER(WHERE correct IS NOT NULL) settled FROM s GROUP BY user_id), eligible AS (
  SELECT e.id,h.balance,COALESCE(sc.wins,0) wins,COALESCE(sc.settled,0) settled FROM public.fds_eligible_participants() e
  JOIN LATERAL (SELECT balance FROM public.fds_wrapped_balance_history WHERE user_id=e.id AND changed_at<=p_cutoff ORDER BY changed_at DESC,id DESC LIMIT 1) h ON true
  LEFT JOIN scores sc ON sc.user_id=e.id), ranked AS (
  SELECT id,rank() OVER(ORDER BY balance DESC,wins DESC,CASE WHEN settled>0 THEN wins::numeric/settled ELSE 0 END DESC) place FROM eligible)
 SELECT max(place) FILTER(WHERE id=p_user),count(*) INTO v_rank,v_total FROM ranked;
 SELECT h.number,h.rank,h.score,h.ranking_mode INTO v_house FROM public.profiles p JOIN public.fds_houses fh ON fh.id=p.house_id
 JOIN public.fds_house_leaderboard_at(p_cutoff) h ON h.id=fh.id WHERE p.id=p_user AND EXISTS(SELECT 1 FROM public.fds_eligible_participants() e WHERE e.id=p_user);
 SELECT count(*),COALESCE(sum(reward_amount),0) INTO v_missions,v_mission_tips
 FROM public.fds_mission_participations WHERE user_id=p_user AND reward_given AND rewarded_at BETWEEN p_start AND p_cutoff;
 v_personality:=CASE WHEN v_stats.settled>=5 AND v_stats.wins*100>=75*v_stats.settled THEN 'O Oráculo'
 WHEN v_missions>=3 THEN 'O Flash'
 WHEN v_stats.selections>=10 THEN 'O Sem Medo'
 WHEN v_stats.settled>=3 AND v_stats.wins*100>=66*v_stats.settled THEN 'O Sniper'
 ELSE NULL END;
 RETURN jsonb_build_object('name',v_name,'prediction_count',v_stats.selections,'correct',v_stats.wins,'lost',v_stats.losses,
 'settled',v_stats.settled,'accuracy',CASE WHEN v_stats.settled>0 THEN round(v_stats.wins*100.0/v_stats.settled) ELSE NULL END,
 'tips_staked',(SELECT COALESCE(sum(amount),0) FROM public.placed_bets WHERE user_id=p_user AND status<>'Cancelled' AND placed_at BETWEEN p_start AND p_cutoff),'balance',v_balance,'start_balance',v_start_balance,'rank',v_rank,'rank_total',v_total,
 'house',CASE WHEN v_house.number IS NOT NULL THEN jsonb_build_object('number',v_house.number,'rank',v_house.rank,'score',v_house.score,'mode',v_house.ranking_mode) ELSE NULL END,
 'missions_completed',v_missions,'mission_tips',v_mission_tips,'personality',v_personality);
END;$$;
REVOKE ALL ON FUNCTION public.fds_wrapped_build_personal(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.fds_wrapped_readiness(p_kind text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.fds_wrapped_settings; v_bets bigint; v_missions bigint;
BEGIN
 SELECT * INTO c FROM public.fds_wrapped_settings WHERE kind=p_kind;
 IF NOT FOUND THEN RAISE EXCEPTION 'Wrapped desconhecido.'; END IF;
 SELECT count(*) INTO v_bets FROM public.bets WHERE published AND status='open' AND start_at<=c.release_at AND closes_at>=c.period_start;
 SELECT count(*) INTO v_missions FROM public.fds_missions m WHERE m.status NOT IN ('draft','completed') AND m.start_at<=c.release_at AND m.end_at>=c.period_start;
 RETURN jsonb_build_object('unsettled_bets',v_bets,'pending_missions',v_missions,'ready',v_bets=0 AND v_missions=0);
END;$$;
REVOKE ALL ON FUNCTION public.fds_wrapped_readiness(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.fds_wrapped_publish_due()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.fds_wrapped_settings; u record; v_global jsonb; v_cutoff timestamptz;
BEGIN
 FOR c IN SELECT * FROM public.fds_wrapped_settings WHERE enabled AND release_at<=now() AND period_start IS NOT NULL ORDER BY release_at FOR UPDATE LOOP
  IF EXISTS(SELECT 1 FROM public.fds_wrapped_snapshots WHERE kind=c.kind) THEN CONTINUE; END IF;
  IF c.kind='final' AND NOT (public.fds_wrapped_readiness(c.kind)->>'ready')::boolean THEN CONTINUE; END IF;
  v_cutoff:=CASE WHEN c.kind='final' THEN now() ELSE c.release_at END;
  v_global:=public.fds_wrapped_build_global(c.period_start,v_cutoff);
  INSERT INTO public.fds_wrapped_snapshots(kind,cutoff_at,global_payload) VALUES(c.kind,v_cutoff,v_global);
  FOR u IN SELECT id FROM public.profiles LOOP
   INSERT INTO public.fds_wrapped_personal(kind,user_id,payload)
   VALUES(c.kind,u.id,public.fds_wrapped_build_personal(u.id,c.period_start,v_cutoff));
  END LOOP;
 END LOOP;
END;$$;
REVOKE ALL ON FUNCTION public.fds_wrapped_publish_due() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.fds_wrapped_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.freshers_weekend_is_member() THEN RAISE EXCEPTION 'Inicia sessão para ver o Wrapped.'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('kind',s.kind,'published_at',s.published_at,
 'announcement_seen',v.announcement_seen_at IS NOT NULL,'opened',v.opened_at IS NOT NULL,'completed',v.completed_at IS NOT NULL)
 ORDER BY s.published_at DESC),'[]'::jsonb) INTO v FROM public.fds_wrapped_snapshots s
 LEFT JOIN public.fds_wrapped_views v ON v.kind=s.kind AND v.user_id=auth.uid();
 RETURN v;
END;$$;
CREATE OR REPLACE FUNCTION public.fds_wrapped_get(p_kind text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.freshers_weekend_is_member() THEN RAISE EXCEPTION 'Inicia sessão para ver o Wrapped.'; END IF;
 SELECT jsonb_build_object('kind',s.kind,'cutoff_at',s.cutoff_at,'global',s.global_payload,
 'personal',COALESCE(p.payload,'{}'::jsonb),'disabled_stories',c.disabled_stories,'editorial_copy',c.editorial_copy)
 INTO v FROM public.fds_wrapped_snapshots s JOIN public.fds_wrapped_settings c USING(kind)
 LEFT JOIN public.fds_wrapped_personal p ON p.kind=s.kind AND p.user_id=auth.uid()
 WHERE s.kind=p_kind;
 IF v IS NULL THEN RAISE EXCEPTION 'Este Wrapped ainda não está disponível.'; END IF;
 RETURN v;
END;$$;
CREATE OR REPLACE FUNCTION public.fds_wrapped_mark(p_kind text,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.freshers_weekend_is_member() THEN RAISE EXCEPTION 'Inicia sessão para ver o Wrapped.'; END IF;
 IF p_action NOT IN ('announcement','opened','completed') THEN RAISE EXCEPTION 'Ação inválida.'; END IF;
 INSERT INTO public.fds_wrapped_views(kind,user_id,announcement_seen_at,opened_at,completed_at)
 VALUES(p_kind,auth.uid(),CASE WHEN p_action='announcement' THEN now() END,
 CASE WHEN p_action='opened' THEN now() END,CASE WHEN p_action='completed' THEN now() END)
 ON CONFLICT(kind,user_id) DO UPDATE SET
 announcement_seen_at=COALESCE(fds_wrapped_views.announcement_seen_at,EXCLUDED.announcement_seen_at),
 opened_at=COALESCE(fds_wrapped_views.opened_at,EXCLUDED.opened_at),
 completed_at=COALESCE(fds_wrapped_views.completed_at,EXCLUDED.completed_at);
END;$$;
CREATE OR REPLACE FUNCTION public.fds_wrapped_admin_settings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v jsonb;
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(c)||jsonb_build_object('published_at',s.published_at,'readiness',public.fds_wrapped_readiness(c.kind)) ORDER BY c.kind),'[]'::jsonb)
 INTO v FROM public.fds_wrapped_settings c LEFT JOIN public.fds_wrapped_snapshots s USING(kind);
 RETURN v;
END;$$;
CREATE OR REPLACE FUNCTION public.fds_wrapped_admin_save(p_kind text,p_release_at timestamptz,p_period_start timestamptz,p_enabled boolean,p_disabled_stories text[],p_editorial_copy jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 IF p_release_at IS NULL OR p_period_start IS NULL OR p_period_start>=p_release_at THEN RAISE EXCEPTION 'Escolhe um início e uma publicação posteriores.'; END IF;
 IF p_enabled AND p_release_at<=now() THEN RAISE EXCEPTION 'A publicação automática precisa de uma hora futura.'; END IF;
 IF jsonb_typeof(p_editorial_copy)<>'object' OR length(p_editorial_copy::text)>4000 THEN RAISE EXCEPTION 'Texto editorial inválido.'; END IF;
 UPDATE public.fds_wrapped_settings SET release_at=p_release_at,period_start=p_period_start,enabled=p_enabled,
 disabled_stories=COALESCE(p_disabled_stories,'{}'),editorial_copy=p_editorial_copy,updated_at=now()
 WHERE kind=p_kind AND NOT EXISTS(SELECT 1 FROM public.fds_wrapped_snapshots WHERE kind=p_kind);
 IF NOT FOUND THEN RAISE EXCEPTION 'Wrapped desconhecido ou já publicado.'; END IF;
END;$$;
CREATE OR REPLACE FUNCTION public.fds_wrapped_admin_preview(p_kind text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.fds_wrapped_settings; v_cutoff timestamptz;
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 SELECT * INTO c FROM public.fds_wrapped_settings WHERE kind=p_kind;
 IF NOT FOUND OR c.period_start IS NULL OR c.release_at IS NULL THEN RAISE EXCEPTION 'Configura primeiro as datas do Wrapped.'; END IF;
 v_cutoff:=LEAST(now(),c.release_at);
 RETURN jsonb_build_object('kind',p_kind,'preview',true,'cutoff_at',v_cutoff,
 'global',public.fds_wrapped_build_global(c.period_start,v_cutoff),
 'personal',public.fds_wrapped_build_personal(auth.uid(),c.period_start,v_cutoff),
 'disabled_stories',c.disabled_stories,'editorial_copy',c.editorial_copy);
END;$$;
CREATE OR REPLACE FUNCTION public.fds_wrapped_admin_publish(p_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fds_wrapped_settings WHERE kind=p_kind AND enabled AND release_at<=now()) THEN
  RAISE EXCEPTION 'O Wrapped ainda não chegou à hora de publicação.';
 END IF;
 PERFORM public.fds_wrapped_publish_due();
 IF NOT EXISTS(SELECT 1 FROM public.fds_wrapped_snapshots WHERE kind=p_kind) THEN
  RAISE EXCEPTION 'Ainda há resultados por resolver antes da publicação final.';
 END IF;
END;$$;
REVOKE ALL ON FUNCTION public.fds_wrapped_status(),public.fds_wrapped_get(text),public.fds_wrapped_mark(text,text),
 public.fds_wrapped_admin_settings(),public.fds_wrapped_admin_save(text,timestamptz,timestamptz,boolean,text[],jsonb),
 public.fds_wrapped_admin_preview(text),public.fds_wrapped_admin_publish(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fds_wrapped_status(),public.fds_wrapped_get(text),public.fds_wrapped_mark(text,text),
 public.fds_wrapped_admin_settings(),public.fds_wrapped_admin_save(text,timestamptz,timestamptz,boolean,text[],jsonb),
 public.fds_wrapped_admin_preview(text),public.fds_wrapped_admin_publish(text) TO authenticated;

-- Keep the exact House scoring expression used by the live leaderboard; permit the database scheduler.
CREATE OR REPLACE FUNCTION public.fds_house_leaderboard()
RETURNS TABLE(id uuid,number integer,display_name text,member_count bigint,total_tips bigint,average_tips numeric,score numeric,rank bigint,ranking_mode text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH totals AS(SELECT h.id,h.number,h.display_name,count(e.id) members,COALESCE(sum(e.balance),0)::bigint total FROM public.fds_houses h LEFT JOIN public.profiles p ON p.house_id=h.id LEFT JOIN public.fds_eligible_participants() e ON e.id=p.id GROUP BY h.id),
 scores AS(SELECT t.*,CASE WHEN members>0 THEN total::numeric/members ELSE NULL END avg_tips,s.ranking_mode FROM totals t CROSS JOIN public.fds_house_settings s),
 ranked AS(SELECT *,CASE WHEN ranking_mode='average' THEN avg_tips WHEN members>0 THEN total::numeric ELSE NULL END metric FROM scores)
 SELECT id,number,display_name,members,total,avg_tips,metric,
 CASE WHEN members>0 THEN rank() OVER(ORDER BY metric DESC NULLS LAST) ELSE NULL END,ranking_mode
 FROM ranked WHERE public.freshers_weekend_is_member() OR current_setting('role',true) IN ('none','service_role')
 ORDER BY metric DESC NULLS LAST,number;
$$;

-- One scoring formula for live House ranking and historical Wrapped snapshots.
CREATE OR REPLACE FUNCTION public.fds_house_leaderboard_at(p_cutoff timestamptz)
RETURNS TABLE(id uuid,number integer,display_name text,member_count bigint,total_tips bigint,average_tips numeric,score numeric,rank bigint,ranking_mode text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH totals AS(
  SELECT h.id,h.number,h.display_name,count(e.id) members,COALESCE(sum(b.balance),0)::bigint total
  FROM public.fds_houses h LEFT JOIN public.profiles p ON p.house_id=h.id
  LEFT JOIN public.fds_eligible_participants() e ON e.id=p.id
  LEFT JOIN LATERAL (SELECT balance FROM public.fds_wrapped_balance_history WHERE user_id=e.id AND changed_at<=p_cutoff ORDER BY changed_at DESC,id DESC LIMIT 1) b ON true
  GROUP BY h.id),scores AS(
  SELECT t.*,CASE WHEN members>0 THEN total::numeric/members ELSE NULL END avg_tips,s.ranking_mode
  FROM totals t CROSS JOIN public.fds_house_settings s),ranked AS(
  SELECT *,CASE WHEN ranking_mode='average' THEN avg_tips WHEN members>0 THEN total::numeric ELSE NULL END metric FROM scores)
 SELECT id,number,display_name,members,total,avg_tips,metric,
 CASE WHEN members>0 THEN rank() OVER(ORDER BY metric DESC NULLS LAST) ELSE NULL END,ranking_mode
 FROM ranked WHERE public.freshers_weekend_is_member() OR current_setting('role',true) IN ('none','service_role')
 ORDER BY metric DESC NULLS LAST,number;
$$;
REVOKE ALL ON FUNCTION public.fds_house_leaderboard_at(timestamptz) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.fds_house_leaderboard()
RETURNS TABLE(id uuid,number integer,display_name text,member_count bigint,total_tips bigint,average_tips numeric,score numeric,rank bigint,ranking_mode text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT * FROM public.fds_house_leaderboard_at(now());
$$;

-- Release defaults for the 2026 FDS. Admin must enable publication after verification.
UPDATE public.fds_wrapped_settings SET release_at='2026-10-10 14:00 Europe/Lisbon'::timestamptz WHERE kind='day1' AND release_at IS NULL;
UPDATE public.fds_wrapped_settings SET release_at='2026-10-11 14:00 Europe/Lisbon'::timestamptz WHERE kind='final' AND release_at IS NULL;

UPDATE public.fds_wrapped_settings SET period_start='2026-10-09 15:00 Europe/Lisbon'::timestamptz WHERE kind IN ('day1','final') AND period_start IS NULL;
