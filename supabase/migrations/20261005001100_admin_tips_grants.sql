-- FDS only, after migration 010. Positive manual grants use profiles.balance.
ALTER TABLE public.freshers_weekend_access ADD COLUMN manual_tips_eligible boolean;
-- Administrators are excluded by default; explicitly opt in legitimate participants.
UPDATE public.freshers_weekend_access SET manual_tips_eligible=false WHERE is_admin;

-- Audit UUIDs/names are snapshots and survive later account deletion.
CREATE TABLE public.admin_tips_grant_batches (
 id uuid PRIMARY KEY, admin_id uuid NOT NULL, admin_name text NOT NULL,
 scope text NOT NULL CHECK(scope IN ('user','all')), recipient_id uuid,
 recipient_name text, preview_balance integer,
 amount integer NOT NULL CHECK(amount BETWEEN 1 AND 1000000),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 300),
 recipient_ids uuid[] NOT NULL, recipient_count integer NOT NULL CHECK(recipient_count>0),
 total_tips bigint NOT NULL, status text NOT NULL DEFAULT 'prepared' CHECK(status IN ('prepared','completed')),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE TABLE public.admin_tips_grant_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL REFERENCES public.admin_tips_grant_batches(id),
 user_id uuid NOT NULL, recipient_name text NOT NULL,
 amount integer NOT NULL CHECK(amount>0), balance_before integer NOT NULL, balance_after integer NOT NULL,
 type text NOT NULL DEFAULT 'ADMIN_GRANT' CHECK(type='ADMIN_GRANT'), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(batch_id,user_id)
);
ALTER TABLE public.admin_tips_grant_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_tips_grant_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_tips_grant_batches,public.admin_tips_grant_entries FROM anon,authenticated;
GRANT ALL ON public.admin_tips_grant_batches,public.admin_tips_grant_entries TO service_role;

-- Reusable eligibility: real FDS accounts with active access, not deleted/banned,
-- opted into manual bonuses. Auth JSON extraction tolerates optional Auth columns.
CREATE FUNCTION public.admin_tips_eligible_users()
RETURNS TABLE(id uuid,username text,student_number text,instagram_username text,balance integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $$
 SELECT p.id,p.username,p.student_number,p.instagram_username,p.balance
 FROM public.profiles p JOIN public.freshers_weekend_access a ON a.email=lower(p.email)
 JOIN auth.users u ON u.id=p.id
 WHERE public.freshers_weekend_is_admin() AND COALESCE(a.manual_tips_eligible,NOT a.is_admin)
 AND NULLIF(to_jsonb(u)->>'deleted_at','') IS NULL
 AND (NULLIF(to_jsonb(u)->>'banned_until','') IS NULL OR (to_jsonb(u)->>'banned_until')::timestamptz<=now());
$$;
REVOKE ALL ON FUNCTION public.admin_tips_eligible_users() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.search_fds_tips_users(p_query text)
RETURNS TABLE(id uuid,username text,student_number text,instagram_username text,balance integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT s.* FROM public.search_fds_mission_users(p_query) s
 JOIN public.admin_tips_eligible_users() e ON e.id=s.id;
$$;

CREATE FUNCTION public.prepare_admin_tips_grant(p_request_id uuid,p_user_id uuid,p_amount integer,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b public.admin_tips_grant_batches; ids uuid[]; v_name text; v_balance integer; v_instagram text;
BEGIN
 IF NOT public.freshers_weekend_is_admin() OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 IF p_request_id IS NULL OR p_amount IS NULL OR p_amount<1 OR p_amount>1000000 OR length(trim(COALESCE(p_reason,''))) NOT BETWEEN 3 AND 300 THEN RAISE EXCEPTION 'Enter a positive amount and a reason (3–300 characters).'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO b FROM public.admin_tips_grant_batches WHERE id=p_request_id FOR UPDATE;
 IF FOUND THEN
  IF b.admin_id IS DISTINCT FROM auth.uid() OR b.recipient_id IS DISTINCT FROM p_user_id OR b.amount<>p_amount OR b.reason<>trim(p_reason) THEN RAISE EXCEPTION 'Request identifier already used for different details.'; END IF;
 ELSE
  SELECT array_agg(e.id ORDER BY e.id) INTO ids FROM public.admin_tips_eligible_users() e WHERE p_user_id IS NULL OR e.id=p_user_id;
  IF COALESCE(cardinality(ids),0)=0 THEN RAISE EXCEPTION 'No eligible recipients.'; END IF;
  IF p_user_id IS NOT NULL THEN
   SELECT COALESCE(NULLIF(e.username,''),e.student_number,'Participante'),e.balance,e.instagram_username INTO v_name,v_balance,v_instagram FROM public.admin_tips_eligible_users() e WHERE e.id=p_user_id;
  END IF;
  INSERT INTO public.admin_tips_grant_batches(id,admin_id,admin_name,scope,recipient_id,recipient_name,preview_balance,amount,reason,recipient_ids,recipient_count,total_tips)
  VALUES(p_request_id,auth.uid(),COALESCE((SELECT COALESCE(NULLIF(username,''),student_number) FROM public.profiles WHERE id=auth.uid()),'Admin'),CASE WHEN p_user_id IS NULL THEN 'all' ELSE 'user' END,p_user_id,v_name,v_balance,p_amount,trim(p_reason),ids,cardinality(ids),p_amount::bigint*cardinality(ids)) RETURNING * INTO b;
 END IF;
 RETURN jsonb_build_object('id',b.id,'scope',b.scope,'recipient_name',b.recipient_name,'balance_before',b.preview_balance,'instagram_username',v_instagram,'amount',b.amount,'recipient_count',b.recipient_count,'total_tips',b.total_tips,'reason',b.reason,'status',b.status);
END;$$;

CREATE FUNCTION public.confirm_admin_tips_grant(p_request_id uuid,p_confirmation text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b public.admin_tips_grant_batches; ids uuid[]; p record; v_awarded integer:=0;
BEGIN
 IF NOT public.freshers_weekend_is_admin() OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 SELECT * INTO b FROM public.admin_tips_grant_batches WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR b.admin_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Grant request not found.'; END IF;
 IF b.status='completed' THEN RETURN b.id; END IF; -- Safe double-click/network retry.
 IF b.scope='all' AND p_confirmation IS DISTINCT FROM 'CONFIRMAR' THEN RAISE EXCEPTION 'Type CONFIRMAR before awarding all users.'; END IF;
 SELECT array_agg(e.id ORDER BY e.id) INTO ids FROM public.admin_tips_eligible_users() e WHERE b.scope='all' OR e.id=b.recipient_id;
 IF ids IS DISTINCT FROM b.recipient_ids THEN RAISE EXCEPTION 'Eligible recipients changed. Review a new grant request.'; END IF;
 -- Consistent order prevents competing bulk grants from deadlocking on profiles.
 FOR p IN SELECT * FROM public.profiles WHERE id=ANY(b.recipient_ids) ORDER BY id FOR UPDATE LOOP
  IF p.balance::bigint+b.amount>2147483647 THEN RAISE EXCEPTION 'Balance limit exceeded. No balances were changed.'; END IF;
  UPDATE public.profiles SET balance=balance+b.amount WHERE id=p.id;
  v_awarded:=v_awarded+1;
  INSERT INTO public.admin_tips_grant_entries(batch_id,user_id,recipient_name,amount,balance_before,balance_after)
  VALUES(b.id,p.id,COALESCE(NULLIF(p.username,''),p.student_number,'Participante'),b.amount,p.balance,p.balance+b.amount);
 END LOOP;
 IF v_awarded<>b.recipient_count THEN RAISE EXCEPTION 'Recipient accounts changed. No balances were changed.'; END IF;
 UPDATE public.admin_tips_grant_batches SET status='completed',completed_at=now() WHERE id=b.id;
 RETURN b.id;
END;$$;

CREATE FUNCTION public.admin_tips_history()
RETURNS TABLE(id uuid,scope text,recipient_name text,amount integer,recipient_count integer,total_tips bigint,reason text,admin_name text,completed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT b.id,b.scope,b.recipient_name,b.amount,b.recipient_count,b.total_tips,b.reason,COALESCE(NULLIF(p.username,''),p.student_number,b.admin_name),b.completed_at
 FROM public.admin_tips_grant_batches b LEFT JOIN public.profiles p ON p.id=b.admin_id
 WHERE public.freshers_weekend_is_admin() AND b.status='completed' ORDER BY b.completed_at DESC,b.id LIMIT 50;
$$;
CREATE FUNCTION public.admin_tips_eligible_count()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT count(*) FROM public.admin_tips_eligible_users();
$$;
REVOKE ALL ON FUNCTION public.search_fds_tips_users(text),public.prepare_admin_tips_grant(uuid,uuid,integer,text),public.confirm_admin_tips_grant(uuid,text),public.admin_tips_history(),public.admin_tips_eligible_count() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_fds_tips_users(text),public.prepare_admin_tips_grant(uuid,uuid,integer,text),public.confirm_admin_tips_grant(uuid,text),public.admin_tips_history(),public.admin_tips_eligible_count() TO authenticated;

CREATE OR REPLACE FUNCTION public.fds_admin_capabilities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN public.freshers_weekend_is_admin() THEN jsonb_build_object('scheduled_predictions',true,'admin_tips_grants',true) ELSE '{}'::jsonb END;
$$;
REVOKE ALL ON FUNCTION public.fds_admin_capabilities() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fds_admin_capabilities() TO authenticated;
