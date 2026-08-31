-- Provider query and close work is leased, bounded and recoverable. All paths
-- that can deadletter use order -> payment -> attempt lock order.
alter table public.wechat_payment_attempts
  add column query_attempts integer not null default 0
    check(query_attempts between 0 and 12),
  add column query_operation text not null default 'query'
    check(query_operation in('query','close')),
  add column query_available_at timestamptz not null default now(),
  add column query_locked_by text,
  add column query_locked_at timestamptz,
  add column query_lease_token uuid,
  add column query_lease_expires_at timestamptz,
  add column query_dead_lettered_at timestamptz,
  add column query_last_error_code text,
  add column close_requested_at timestamptz,
  add column close_request_count integer not null default 0
    check(close_request_count>=0),
  add constraint wechat_payment_query_lease_consistent check(
    (query_lease_token is null and query_locked_by is null
      and query_locked_at is null and query_lease_expires_at is null)
    or(query_lease_token is not null and query_locked_by is not null
      and query_locked_at is not null and query_lease_expires_at is not null));
create index wechat_payment_query_due
on public.wechat_payment_attempts(query_available_at,updated_at,id)
where status in('created','prepay_ready','prepay_failed','processing')
  and query_dead_lettered_at is null;

create function public.api_claim_wechat_payment_queries(
  p_worker_id text,p_limit integer default 20,p_lease_seconds integer default 120
) returns table(attempt_id uuid,operation text,out_trade_no text,attempts integer,
  lease_token uuid,lease_expires_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare seconds integer:=least(greatest(coalesce(p_lease_seconds,120),15),900);
  candidate record; retired public.wechat_payment_attempts%rowtype;
begin
  if trim(coalesce(p_worker_id,''))!~'^[A-Za-z0-9][A-Za-z0-9.:@-]{0,119}$'
  then raise exception 'PAYMENT_QUERY_WORKER_INVALID'; end if;
  for candidate in select attempt.id,attempt.order_id,attempt.payment_id
    from public.wechat_payment_attempts attempt
    where attempt.query_attempts>=12 and attempt.query_dead_lettered_at is null
      and(attempt.query_lease_token is null or attempt.query_lease_expires_at<=now())
    order by attempt.updated_at,attempt.id limit 100
  loop
    perform pg_advisory_xact_lock(hashtextextended('payment-order:'||candidate.order_id,0));
    perform 1 from public.orders orders where orders.id=candidate.order_id for update;
    if not found then raise exception 'PAYMENT_QUERY_ORDER_MISSING'; end if;
    perform 1 from public.payments payment where payment.id=candidate.payment_id
      and payment.order_id=candidate.order_id for update;
    if not found then raise exception 'PAYMENT_QUERY_LINKAGE_INVALID'; end if;
    retired:=null;
    update public.wechat_payment_attempts attempt set query_dead_lettered_at=now(),
      query_last_error_code='LEASE_EXPIRED',query_locked_by=null,
      query_locked_at=null,query_lease_token=null,query_lease_expires_at=null,updated_at=now()
    where attempt.id=candidate.id and attempt.order_id=candidate.order_id
      and attempt.payment_id=candidate.payment_id and attempt.query_attempts>=12
      and attempt.query_dead_lettered_at is null and(attempt.query_lease_token is null
        or attempt.query_lease_expires_at<=now()) returning attempt.* into retired;
    if retired.id is not null then
      insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_type,
        action,resource_type,resource_id,request_id,after_json,created_at)
      select gen_random_uuid()::text,orders.tenant_id,orders.enterprise_id,orders.mall_id,
        'system','payment.query.dead_letter','payment_attempt',retired.id::text,
        'payment-query-retired:'||retired.id,jsonb_build_object(
          'errorCode','LEASE_EXPIRED','attempts',retired.query_attempts),now()
      from public.orders orders where orders.id=retired.order_id;
    end if;
  end loop;
  return query with claimable as(
    select attempt.id from public.wechat_payment_attempts attempt
    join public.orders orders on orders.id=attempt.order_id
    join public.payments payment on payment.id=attempt.payment_id
    where attempt.status in('created','prepay_ready','prepay_failed','processing')
      and payment.status in('created','processing')
      and attempt.query_dead_lettered_at is null and attempt.query_attempts<12
      and attempt.query_available_at<=now()
      and(attempt.query_lease_token is null or attempt.query_lease_expires_at<=now())
      and(attempt.status in('prepay_ready','processing')
        or attempt.created_at<=now()-interval '30 seconds')
      and(attempt.query_operation='close' or attempt.last_query_at is null
        or attempt.last_query_at<=now()-interval '15 seconds')
    order by(select min(reservation.expires_at) from inventory.reservations reservation
      where reservation.order_id=orders.id and reservation.tenant_id=orders.tenant_id
        and reservation.mall_id=orders.mall_id and reservation.state='active') nulls last,
      attempt.updated_at,attempt.id for update of attempt skip locked
    limit least(greatest(coalesce(p_limit,20),1),100)
  ) update public.wechat_payment_attempts attempt set
    query_attempts=attempt.query_attempts+1,query_locked_by=trim(p_worker_id),
    query_locked_at=now(),query_lease_token=gen_random_uuid(),
    query_lease_expires_at=now()+make_interval(secs=>seconds),updated_at=now()
  from claimable where attempt.id=claimable.id
  returning attempt.id,attempt.query_operation,attempt.out_trade_no,
    attempt.query_attempts,attempt.query_lease_token,attempt.query_lease_expires_at;
end $$;

create function public.lock_wechat_payment_query(
  p_attempt_id uuid,p_worker_id text,p_lease_token uuid
) returns public.wechat_payment_attempts language plpgsql security definer
set search_path=public,pg_temp as $$
declare snapshot public.wechat_payment_attempts%rowtype;
  locked_attempt public.wechat_payment_attempts%rowtype;
begin
  select * into snapshot from public.wechat_payment_attempts where id=p_attempt_id;
  if not found then return null;end if;
  perform pg_advisory_xact_lock(hashtextextended('payment-order:'||snapshot.order_id,0));
  perform 1 from public.orders orders where orders.id=snapshot.order_id for update;
  if not found then raise exception 'PAYMENT_QUERY_LINKAGE_INVALID';end if;
  perform 1 from public.payments payment where payment.id=snapshot.payment_id
    and payment.order_id=snapshot.order_id for update;
  if not found then raise exception 'PAYMENT_QUERY_LINKAGE_INVALID';end if;
  select * into locked_attempt from public.wechat_payment_attempts
  where id=p_attempt_id and order_id=snapshot.order_id and payment_id=snapshot.payment_id
    and query_locked_by=trim(p_worker_id) and query_lease_token=p_lease_token
    and query_lease_expires_at>now() for update;
  return locked_attempt;
end $$;

create function public.api_fail_wechat_payment_query(
  p_attempt_id uuid,p_worker_id text,p_lease_token uuid,
  p_error_code text,p_retryable boolean
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare attempt public.wechat_payment_attempts%rowtype;
  code text; dead boolean; delay_seconds double precision;
begin
  code:=left(regexp_replace(upper(coalesce(p_error_code,'')),'[^A-Z0-9_.:-]','','g'),120);
  if code='' or p_retryable is null then raise exception 'PAYMENT_QUERY_FAILURE_INVALID'; end if;
  attempt:=public.lock_wechat_payment_query(p_attempt_id,p_worker_id,p_lease_token);
  if attempt.id is null then return jsonb_build_object('accepted',false,'status','lease_lost'); end if;
  dead:=not p_retryable or attempt.query_attempts>=12;
  delay_seconds:=least(3600.0,5.0*power(2.0,least(attempt.query_attempts-1,9)))
    *(0.8+random()*0.4);
  update public.wechat_payment_attempts set
    query_dead_lettered_at=case when dead then now() else null end,
    query_last_error_code=code,query_available_at=case when dead then query_available_at
      else now()+make_interval(secs=>delay_seconds) end,query_locked_by=null,
    query_locked_at=null,query_lease_token=null,query_lease_expires_at=null,updated_at=now()
  where id=attempt.id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_type,
    action,resource_type,resource_id,request_id,after_json,created_at)
  select gen_random_uuid()::text,orders.tenant_id,orders.enterprise_id,orders.mall_id,
    'system',case when dead then 'payment.query.dead_letter' else 'payment.query.retry' end,
    'payment_attempt',attempt.id::text,'payment-query:'||attempt.id||':'||attempt.query_attempts,
    jsonb_build_object('errorCode',code,'attempts',attempt.query_attempts),now()
  from public.orders orders where orders.id=attempt.order_id;
  return jsonb_build_object('accepted',true,
    'status',case when dead then 'dead_letter' else 'pending' end,
    'attempts',attempt.query_attempts,'errorCode',code);
end $$;

revoke all on function public.api_claim_wechat_payment_queries(text,integer,integer),
  public.api_fail_wechat_payment_query(uuid,text,uuid,text,boolean)
from public,anon,authenticated;
grant execute on function public.api_claim_wechat_payment_queries(text,integer,integer),
  public.api_fail_wechat_payment_query(uuid,text,uuid,text,boolean) to service_role;
