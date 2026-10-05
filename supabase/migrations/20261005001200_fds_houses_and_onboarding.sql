-- FDS only, after 011. Official identity imports are private; no account/balance creation.
CREATE TABLE public.fds_houses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),number integer UNIQUE NOT NULL CHECK(number>0),display_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.fds_houses(number,display_name) SELECT n,'Casa '||n FROM unnest(ARRAY[3,4,5,6,7,8,9,10,11,12,13,14,15,16,18,20,21,25]) n;
ALTER TABLE public.profiles ADD COLUMN house_id uuid REFERENCES public.fds_houses(id),ADD COLUMN house_manual boolean NOT NULL DEFAULT false;
CREATE INDEX profiles_house_idx ON public.profiles(house_id);
-- Pending official assignments support later signup without making fake users.
CREATE TABLE public.fds_house_roster(student_number text PRIMARY KEY CHECK(student_number ~ '^[0-9]{8}$'),official_name text NOT NULL,house_id uuid REFERENCES public.fds_houses(id),source text NOT NULL CHECK(source IN ('official','manual')),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.fds_house_imports(id uuid PRIMARY KEY,admin_id uuid NOT NULL,payload jsonb NOT NULL,preview jsonb NOT NULL,applied_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.fds_house_changes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),admin_id uuid NOT NULL,user_id uuid NOT NULL,old_house_id uuid,new_house_id uuid,source text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.fds_house_settings(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),ranking_mode text NOT NULL DEFAULT 'average' CHECK(ranking_mode IN ('average','total')));
INSERT INTO public.fds_house_settings DEFAULT VALUES;
CREATE TABLE public.fds_user_experience(user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,onboarding_version_seen integer NOT NULL DEFAULT 0,seen_help text[] NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.fds_houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fds_house_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fds_house_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fds_house_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fds_house_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fds_user_experience ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fds_houses,public.fds_house_roster,public.fds_house_imports,public.fds_house_changes,public.fds_house_settings,public.fds_user_experience FROM anon,authenticated;
GRANT ALL ON public.fds_houses,public.fds_house_roster,public.fds_house_imports,public.fds_house_changes,public.fds_house_settings,public.fds_user_experience TO service_role;
GRANT SELECT ON public.fds_houses TO authenticated;
CREATE POLICY "Members read houses" ON public.fds_houses FOR SELECT TO authenticated USING(public.freshers_weekend_is_member());
GRANT SELECT(house_id) ON public.profiles TO authenticated;
CREATE OR REPLACE VIEW public.event_leaderboard WITH(security_invoker=true) AS SELECT p.id,p.username,p.balance,p.student_number,p.house_id,h.number AS house_number FROM public.profiles p LEFT JOIN public.fds_houses h ON h.id=p.house_id;
GRANT SELECT ON public.event_leaderboard TO authenticated;

-- One canonical eligibility rule, reused by manual TIPS grants and house scoring.
CREATE FUNCTION public.fds_eligible_participants()
RETURNS TABLE(id uuid,username text,student_number text,instagram_username text,balance integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $$
 SELECT p.id,p.username,p.student_number,p.instagram_username,p.balance FROM public.profiles p JOIN public.freshers_weekend_access a ON a.email=lower(p.email) JOIN auth.users u ON u.id=p.id
 WHERE COALESCE(a.manual_tips_eligible,NOT a.is_admin) AND NULLIF(to_jsonb(u)->>'deleted_at','') IS NULL AND (NULLIF(to_jsonb(u)->>'banned_until','') IS NULL OR (to_jsonb(u)->>'banned_until')::timestamptz<=now());
$$;
REVOKE ALL ON FUNCTION public.fds_eligible_participants() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_tips_eligible_users()
RETURNS TABLE(id uuid,username text,student_number text,instagram_username text,balance integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT * FROM public.fds_eligible_participants() WHERE public.freshers_weekend_is_admin(); $$;

CREATE FUNCTION public.guard_fds_house_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF (NEW.house_id IS DISTINCT FROM OLD.house_id OR NEW.house_manual IS DISTINCT FROM OLD.house_manual) AND NOT public.freshers_weekend_is_admin() AND current_setting('role',true) NOT IN ('none','service_role') THEN RAISE EXCEPTION 'Only administrators can change House membership.';END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.guard_fds_house_assignment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_fds_house_assignment BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_fds_house_assignment();
CREATE OR REPLACE FUNCTION public.freshers_weekend_create_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(610050012);
 INSERT INTO public.profiles(id,email,balance,student_number,house_id,house_manual)
 SELECT NEW.id,lower(NEW.email),2500,split_part(lower(NEW.email),'@',1),r.house_id,COALESCE(r.source='manual',false)
 FROM (SELECT 1) seed LEFT JOIN public.fds_house_roster r ON r.student_number=split_part(lower(NEW.email),'@',1);
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.freshers_weekend_create_profile() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.fds_house_leaderboard()
RETURNS TABLE(id uuid,number integer,display_name text,member_count bigint,total_tips bigint,average_tips numeric,score numeric,rank bigint,ranking_mode text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH totals AS(SELECT h.id,h.number,h.display_name,count(e.id) members,COALESCE(sum(e.balance),0)::bigint total FROM public.fds_houses h LEFT JOIN public.profiles p ON p.house_id=h.id LEFT JOIN public.fds_eligible_participants() e ON e.id=p.id GROUP BY h.id),scores AS(SELECT t.*,CASE WHEN members>0 THEN total::numeric/members ELSE NULL END avg_tips,s.ranking_mode FROM totals t CROSS JOIN public.fds_house_settings s),ranked AS(SELECT *,CASE WHEN ranking_mode='average' THEN avg_tips WHEN members>0 THEN total::numeric ELSE NULL END metric FROM scores)
 SELECT id,number,display_name,members,total,avg_tips,metric,CASE WHEN members>0 THEN rank() OVER(ORDER BY metric DESC NULLS LAST) ELSE NULL END,ranking_mode FROM ranked WHERE public.freshers_weekend_is_member() ORDER BY metric DESC NULLS LAST,number;
$$;
CREATE FUNCTION public.fds_house_members(p_house_id uuid)
RETURNS TABLE(id uuid,username text,student_number text,balance integer,house_number integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT e.id,e.username,e.student_number,e.balance,h.number FROM public.fds_eligible_participants() e JOIN public.profiles p ON p.id=e.id JOIN public.fds_houses h ON h.id=p.house_id WHERE h.id=p_house_id AND public.freshers_weekend_is_member() ORDER BY e.balance DESC,e.student_number; $$;
CREATE FUNCTION public.admin_set_house_ranking(p_mode text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.';END IF;IF p_mode NOT IN ('average','total') OR p_mode IS NULL THEN RAISE EXCEPTION 'Invalid ranking mode.';END IF;UPDATE public.fds_house_settings SET ranking_mode=p_mode;END;$$;
CREATE FUNCTION public.admin_fds_house_users(p_house_id uuid DEFAULT NULL,p_unassigned boolean DEFAULT false)
RETURNS TABLE(id uuid,username text,student_number text,house_id uuid,house_number integer,balance integer,eligible boolean,official_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT p.id,p.username,p.student_number,p.house_id,h.number,p.balance,e.id IS NOT NULL,r.official_name FROM public.profiles p LEFT JOIN public.fds_house_roster r ON r.student_number=p.student_number LEFT JOIN public.fds_houses h ON h.id=p.house_id LEFT JOIN public.fds_eligible_participants() e ON e.id=p.id WHERE public.freshers_weekend_is_admin() AND (p_house_id IS NULL OR p.house_id=p_house_id) AND (NOT p_unassigned OR p.house_id IS NULL) ORDER BY p.student_number;
$$;
CREATE FUNCTION public.admin_set_user_house(p_user_id uuid,p_house_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE p public.profiles;
BEGIN
 IF NOT public.freshers_weekend_is_admin() OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Administrator access required.';END IF;
 PERFORM pg_advisory_xact_lock(610050012);
 IF p_house_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.fds_houses WHERE id=p_house_id) THEN RAISE EXCEPTION 'House not found.';END IF;
 SELECT * INTO p FROM public.profiles WHERE id=p_user_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'User not found.';END IF;
 UPDATE public.profiles SET house_id=p_house_id,house_manual=true WHERE id=p.id;
 IF p.student_number ~ '^[0-9]{8}$' THEN INSERT INTO public.fds_house_roster(student_number,official_name,house_id,source) VALUES(p.student_number,COALESCE(p.username,p.student_number),p_house_id,'manual') ON CONFLICT(student_number) DO UPDATE SET house_id=excluded.house_id,source='manual',updated_at=now();END IF;
 INSERT INTO public.fds_house_changes(admin_id,user_id,old_house_id,new_house_id,source) VALUES(auth.uid(),p.id,p.house_id,p_house_id,'manual');
END;$$;

-- Preview exposes unresolved names only to administrators, never public bundles/views.
CREATE FUNCTION public.preview_fds_house_import(p_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE row jsonb;result jsonb:='[]';p public.profiles;h uuid;r public.fds_house_roster;s text;student text;
BEGIN
 IF NOT public.freshers_weekend_is_admin() THEN RAISE EXCEPTION 'Administrator access required.';END IF;
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows)>1000 THEN RAISE EXCEPTION 'Import an array of at most 1000 participants.';END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  student:=row->>'student_number';h:=NULL;p:=NULL;r:=NULL;
  SELECT id INTO h FROM public.fds_houses WHERE number=CASE WHEN row->>'house_number' ~ '^[0-9]{1,3}$' THEN (row->>'house_number')::integer END;
  IF row->>'source_status' IS DISTINCT FROM 'matched' OR student IS NULL OR student !~ '^[0-9]{8}$' OR h IS NULL OR COALESCE(length(trim(row->>'name')),0) NOT BETWEEN 2 AND 150 THEN s:=CASE WHEN row->>'source_status'='ambiguous' THEN 'ambiguous' ELSE 'unmatched' END;
  ELSIF (SELECT count(*) FROM jsonb_array_elements(p_rows) item WHERE item->>'student_number'=student)>1 OR (SELECT count(*) FROM public.profiles WHERE student_number=student)>1 THEN s:='ambiguous';
  ELSE
   SELECT * INTO p FROM public.profiles WHERE student_number=student;
   SELECT * INTO r FROM public.fds_house_roster WHERE student_number=student;
   IF (p.id IS NOT NULL AND (p.house_manual OR p.house_id IS NOT NULL) AND p.house_id IS DISTINCT FROM h) OR (r.student_number IS NOT NULL AND r.house_id IS DISTINCT FROM h) THEN s:='conflict';
   ELSIF p.id IS NULL THEN s:='pending_account';ELSE s:='matched';END IF;
  END IF;
  result:=result||jsonb_build_array(jsonb_build_object('name',row->>'name','student_number',student,'house_number',row->>'house_number','status',s,'user_id',p.id,'current_house_id',p.house_id,'candidates',COALESCE(row->'candidates','[]'::jsonb)));
 END LOOP;RETURN result;
END;$$;
CREATE FUNCTION public.prepare_fds_house_import(p_request_id uuid,p_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_preview jsonb;b public.fds_house_imports;
BEGIN
 IF NOT public.freshers_weekend_is_admin() OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Administrator access required.';END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'Request identifier required.';END IF;
 PERFORM pg_advisory_xact_lock(610050012);SELECT * INTO b FROM public.fds_house_imports WHERE id=p_request_id FOR UPDATE;
 IF FOUND THEN IF b.admin_id IS DISTINCT FROM auth.uid() OR b.payload IS DISTINCT FROM p_rows THEN RAISE EXCEPTION 'Import identifier already used.';END IF;RETURN b.preview;END IF;
 v_preview:=public.preview_fds_house_import(p_rows);INSERT INTO public.fds_house_imports(id,admin_id,payload,preview) VALUES(p_request_id,auth.uid(),p_rows,v_preview);RETURN v_preview;
END;$$;
CREATE FUNCTION public.apply_fds_house_import(p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b public.fds_house_imports;row jsonb;h uuid;p public.profiles;
BEGIN
 IF NOT public.freshers_weekend_is_admin() OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Administrator access required.';END IF;
 PERFORM pg_advisory_xact_lock(610050012);SELECT * INTO b FROM public.fds_house_imports WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR b.admin_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Import not found.';END IF;
 IF b.applied_at IS NOT NULL THEN RETURN b.preview;END IF;
 IF public.preview_fds_house_import(b.payload) IS DISTINCT FROM b.preview THEN RAISE EXCEPTION 'Membership changed. Review a new import.';END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(b.preview) WHERE value->>'status' IN ('matched','pending_account') LOOP
  SELECT id INTO h FROM public.fds_houses WHERE number=(row->>'house_number')::integer;
  INSERT INTO public.fds_house_roster(student_number,official_name,house_id,source) VALUES(row->>'student_number',row->>'name',h,'official') ON CONFLICT(student_number) DO UPDATE SET official_name=excluded.official_name,updated_at=now();
  SELECT * INTO p FROM public.profiles WHERE student_number=row->>'student_number' FOR UPDATE;
  IF p.id IS NOT NULL AND NOT p.house_manual AND p.house_id IS NULL THEN
   UPDATE public.profiles SET house_id=h WHERE id=p.id;
   INSERT INTO public.fds_house_changes(admin_id,user_id,old_house_id,new_house_id,source) VALUES(auth.uid(),p.id,p.house_id,h,'import');
  END IF;
 END LOOP;
 UPDATE public.fds_house_imports SET applied_at=now() WHERE id=b.id;RETURN b.preview;
END;$$;
CREATE FUNCTION public.admin_fds_pending_roster()
RETURNS TABLE(student_number text,official_name text,house_number integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT r.student_number,r.official_name,h.number FROM public.fds_house_roster r LEFT JOIN public.fds_houses h ON h.id=r.house_id WHERE public.freshers_weekend_is_admin() AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.student_number=r.student_number) ORDER BY h.number,r.official_name;$$;

CREATE FUNCTION public.my_fds_experience() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('onboarding_version_seen',COALESCE(x.onboarding_version_seen,0),'seen_help',COALESCE(x.seen_help,'{}'::text[]),'house_id',p.house_id,'house_number',h.number)
 FROM public.profiles p LEFT JOIN public.fds_houses h ON h.id=p.house_id LEFT JOIN public.fds_user_experience x ON x.user_id=p.id WHERE p.id=auth.uid() AND public.freshers_weekend_is_member();
$$;
CREATE FUNCTION public.mark_fds_experience(p_onboarding boolean DEFAULT false,p_help text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.freshers_weekend_is_member() THEN RAISE EXCEPTION 'Access denied.';END IF;
 IF p_help IS NOT NULL AND p_help NOT IN ('mega_boost','flash_mission','house_ranking') THEN RAISE EXCEPTION 'Invalid help topic.';END IF;
 INSERT INTO public.fds_user_experience(user_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
 UPDATE public.fds_user_experience SET onboarding_version_seen=GREATEST(onboarding_version_seen,CASE WHEN p_onboarding THEN 1 ELSE 0 END),seen_help=CASE WHEN p_help IS NULL OR p_help=ANY(seen_help) THEN seen_help ELSE array_append(seen_help,p_help) END,updated_at=now() WHERE user_id=auth.uid();
 RETURN public.my_fds_experience();
END;$$;
REVOKE ALL ON FUNCTION public.fds_house_leaderboard(),public.fds_house_members(uuid),public.admin_set_house_ranking(text),public.admin_fds_house_users(uuid,boolean),public.admin_set_user_house(uuid,uuid),public.preview_fds_house_import(jsonb),public.prepare_fds_house_import(uuid,jsonb),public.apply_fds_house_import(uuid),public.admin_fds_pending_roster(),public.my_fds_experience(),public.mark_fds_experience(boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fds_house_leaderboard(),public.fds_house_members(uuid),public.admin_set_house_ranking(text),public.admin_fds_house_users(uuid,boolean),public.admin_set_user_house(uuid,uuid),public.preview_fds_house_import(jsonb),public.prepare_fds_house_import(uuid,jsonb),public.apply_fds_house_import(uuid),public.admin_fds_pending_roster(),public.my_fds_experience(),public.mark_fds_experience(boolean,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.fds_admin_capabilities() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT CASE WHEN public.freshers_weekend_is_admin() THEN jsonb_build_object('scheduled_predictions',true,'admin_tips_grants',true,'houses',true) ELSE '{}'::jsonb END;$$;

CREATE FUNCTION public.search_fds_house_users(p_query text)
RETURNS TABLE(id uuid,username text,student_number text,instagram_username text,balance integer,house_id uuid,house_number integer,official_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH matched AS(SELECT id FROM public.search_fds_mission_users(p_query) UNION SELECT p.id FROM public.profiles p JOIN public.fds_house_roster r ON r.student_number=p.student_number WHERE length(trim(p_query))>=2 AND r.official_name ILIKE '%'||replace(replace(replace(trim(p_query),'\','\\'),'%','\%'),'_','\_')||'%')
 SELECT p.id,p.username,p.student_number,p.instagram_username,p.balance,p.house_id,h.number,r.official_name FROM matched m JOIN public.profiles p ON p.id=m.id LEFT JOIN public.fds_houses h ON h.id=p.house_id LEFT JOIN public.fds_house_roster r ON r.student_number=p.student_number WHERE public.freshers_weekend_is_admin() ORDER BY p.student_number LIMIT 30;
$$;
REVOKE ALL ON FUNCTION public.search_fds_house_users(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_fds_house_users(text) TO authenticated;
