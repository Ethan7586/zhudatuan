-- Canonical operations are introduced once; no compatibility relation or
-- WeChat-specific operation alias is created in this migration sequence.
create function public.api_payment_outbox_deadletters(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,
  p_enterprise_id text,p_mall_id text,p_granted_via jsonb,p_limit integer default 50
) returns table(id uuid,event_key text,topic text,order_id text,aggregate_id text,
  aggregate_version bigint,delivery_attempts integer,last_error_code text,
  created_at timestamptz,dead_lettered_at timestamptz)
language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if p_limit is null or p_limit not between 1 and 200
  then raise exception 'PAYMENT_OUTBOX_QUERY_INVALID'; end if;
  perform public.internal_authorize_payment_deadletter_actor(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,p_mall_id,
    'payment.outbox.read',p_granted_via,false);
  return query select outbox.id,outbox.event_key,outbox.topic,outbox.order_id,
    outbox.aggregate_id,outbox.aggregate_version,outbox.delivery_attempts,
    outbox.last_error_code,outbox.created_at,outbox.dead_lettered_at
  from public.payment_outbox outbox join public.orders orders on orders.id=outbox.order_id
  where outbox.status='dead_letter' and outbox.tenant_id=p_tenant_id
    and orders.tenant_id=p_tenant_id and orders.enterprise_id=p_enterprise_id
    and orders.mall_id=p_mall_id order by outbox.dead_lettered_at desc nulls last,
      outbox.created_at,outbox.id limit p_limit;
end $$;

create function public.api_replay_payment_deadletter(
  p_event_id uuid,p_actor_membership_id text,p_actor_user_id text,
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_granted_via jsonb,
  p_reason text,p_request_id text
) returns jsonb language plpgsql volatile security definer
set search_path=public,pg_temp as $$
declare event_row public.payment_outbox%rowtype; mapped_order_id text;
  existing public.payment_deadletter_reviews%rowtype; resolved_actor_member_id text;
begin
  if p_event_id is null or length(trim(coalesce(p_reason,''))) not between 4 and 500
    or length(trim(coalesce(p_request_id,''))) not between 1 and 160
  then raise exception 'PAYMENT_OUTBOX_OPERATION_INVALID'; end if;
  resolved_actor_member_id:=public.internal_authorize_payment_deadletter_actor(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,p_mall_id,
    'payment.outbox.manage',p_granted_via,true);
  select outbox.order_id into mapped_order_id from public.payment_outbox outbox
    join public.orders orders on orders.id=outbox.order_id
    where outbox.id=p_event_id and outbox.tenant_id=p_tenant_id
      and orders.tenant_id=p_tenant_id and orders.enterprise_id=p_enterprise_id
      and orders.mall_id=p_mall_id;
  if not found then return jsonb_build_object('accepted',false,'status','not_found'); end if;
  perform pg_advisory_xact_lock(hashtextextended('payment-order:'||mapped_order_id,0));
  perform 1 from public.orders orders where orders.id=mapped_order_id for update;
  select outbox.* into event_row from public.payment_outbox outbox
    where outbox.id=p_event_id and outbox.order_id=mapped_order_id for update;
  if not found then return jsonb_build_object('accepted',false,'status','not_found'); end if;
  select * into existing from public.payment_deadletter_reviews review
    where review.request_id=trim(p_request_id);
  if found then
    if existing.event_id<>p_event_id or existing.decision<>'replay'
      or existing.actor_member_id<>resolved_actor_member_id
      or existing.actor_membership_id<>p_actor_membership_id
      or existing.actor_user_id<>p_actor_user_id or existing.reason<>trim(p_reason)
    then raise exception 'PAYMENT_OUTBOX_REQUEST_CONFLICT'; end if;
    return jsonb_build_object('accepted',true,'status','replayed',
      'duplicate',true,'eventId',p_event_id);
  end if;
  if event_row.status<>'dead_letter' then return jsonb_build_object(
    'accepted',false,'status',event_row.status); end if;
  if exists(select 1 from public.payment_outbox later
    where later.aggregate_id=event_row.aggregate_id
      and later.aggregate_version>event_row.aggregate_version)
  then raise exception 'PAYMENT_OUTBOX_REPLAY_SUPERSEDED'; end if;
  insert into public.payment_deadletter_reviews(event_id,decision,tenant_id,
    enterprise_id,mall_id,actor_member_id,actor_membership_id,actor_user_id,
    reason,evidence_digest,request_id)
  values(event_row.id,'replay',p_tenant_id,p_enterprise_id,p_mall_id,
    resolved_actor_member_id,p_actor_membership_id,p_actor_user_id,trim(p_reason),
    encode(digest(p_granted_via::text,'sha256'),'hex'),trim(p_request_id));
  update public.payment_outbox set status='pending',available_at=now(),
    delivery_attempts=0,locked_at=null,locked_by=null,lease_token=null,
    lease_expires_at=null,last_error_code=null,dead_lettered_at=null,ignored_at=null,
    replay_count=replay_count+1,last_replayed_at=now(),updated_at=now()
  where id=event_row.id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,
    actor_type,action,resource_type,resource_id,request_id,after_json,
    membership_id,granted_via,created_at)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,
    'admin','payment.outbox.replayed','order',event_row.order_id,trim(p_request_id),
    jsonb_build_object('eventId',event_row.id,'reason',trim(p_reason),
      'actorMemberId',resolved_actor_member_id,
      'aggregateVersion',event_row.aggregate_version),
    p_actor_membership_id,p_granted_via,now());
  return jsonb_build_object('accepted',true,'status','replayed',
    'duplicate',false,'eventId',event_row.id);
end $$;

create function public.api_ignore_payment_deadletter(
  p_event_id uuid,p_actor_membership_id text,p_actor_user_id text,
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_granted_via jsonb,
  p_reason text,p_request_id text
) returns jsonb language plpgsql volatile security definer
set search_path=public,pg_temp as $$
declare event_row public.payment_outbox%rowtype; mapped_order_id text;
  existing public.payment_deadletter_reviews%rowtype; resolved_actor_member_id text;
  approvals integer; reviewers jsonb;
begin
  if p_event_id is null or length(trim(coalesce(p_reason,''))) not between 4 and 500
    or length(trim(coalesce(p_request_id,''))) not between 1 and 160
  then raise exception 'PAYMENT_OUTBOX_OPERATION_INVALID'; end if;
  resolved_actor_member_id:=public.internal_authorize_payment_deadletter_actor(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,p_mall_id,
    'payment.outbox.manage',p_granted_via,true);
  select outbox.order_id into mapped_order_id from public.payment_outbox outbox
    join public.orders orders on orders.id=outbox.order_id
    where outbox.id=p_event_id and outbox.tenant_id=p_tenant_id
      and orders.tenant_id=p_tenant_id and orders.enterprise_id=p_enterprise_id
      and orders.mall_id=p_mall_id;
  if not found then return jsonb_build_object('accepted',false,'status','not_found'); end if;
  perform pg_advisory_xact_lock(hashtextextended('payment-order:'||mapped_order_id,0));
  perform 1 from public.orders orders where orders.id=mapped_order_id for update;
  select * into event_row from public.payment_outbox outbox
    where outbox.id=p_event_id and outbox.order_id=mapped_order_id for update;
  select * into existing from public.payment_deadletter_reviews review
    where review.request_id=trim(p_request_id);
  if found then
    if existing.event_id<>p_event_id or existing.decision<>'ignore'
      or existing.actor_member_id<>resolved_actor_member_id
      or existing.actor_membership_id<>p_actor_membership_id
      or existing.actor_user_id<>p_actor_user_id or existing.reason<>trim(p_reason)
    then raise exception 'PAYMENT_OUTBOX_REQUEST_CONFLICT'; end if;
    select count(distinct review.actor_member_id) into approvals
    from public.payment_deadletter_reviews review
    where review.event_id=p_event_id and review.decision='ignore';
    return jsonb_build_object('accepted',true,'status',case when event_row.status='ignored'
      then 'ignored' else 'pending_second_approval' end,'duplicate',true,
      'approvals',approvals,'eventId',p_event_id);
  end if;
  if event_row.status<>'dead_letter' then return jsonb_build_object(
    'accepted',false,'status',event_row.status); end if;
  if exists(select 1 from public.payment_deadletter_reviews review
    where review.event_id=p_event_id and review.decision='ignore'
      and review.actor_member_id=resolved_actor_member_id)
  then select count(distinct review.actor_member_id) into approvals
    from public.payment_deadletter_reviews review
    where review.event_id=p_event_id and review.decision='ignore';
    return jsonb_build_object('accepted',true,'status','pending_second_approval',
      'duplicate',true,'approvals',approvals,'eventId',p_event_id); end if;
  insert into public.payment_deadletter_reviews(event_id,decision,tenant_id,
    enterprise_id,mall_id,actor_member_id,actor_membership_id,actor_user_id,
    reason,evidence_digest,request_id)
  values(event_row.id,'ignore',p_tenant_id,p_enterprise_id,p_mall_id,
    resolved_actor_member_id,p_actor_membership_id,p_actor_user_id,trim(p_reason),
    encode(digest(p_granted_via::text,'sha256'),'hex'),trim(p_request_id));
  select count(distinct review.actor_member_id),
    jsonb_agg(review.actor_member_id order by review.actor_member_id)
  into approvals,reviewers from public.payment_deadletter_reviews review
  where review.event_id=p_event_id and review.decision='ignore';
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,
    actor_type,action,resource_type,resource_id,request_id,after_json,
    membership_id,granted_via,created_at)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,
    'admin','payment.outbox.ignore_approved','order',event_row.order_id,
    trim(p_request_id),jsonb_build_object('eventId',event_row.id,
      'reason',trim(p_reason),'actorMemberId',resolved_actor_member_id,
      'approvals',approvals),
    p_actor_membership_id,p_granted_via,now());
  if approvals<2 then return jsonb_build_object('accepted',true,
    'status','pending_second_approval','duplicate',false,
    'approvals',approvals,'eventId',event_row.id); end if;
  update public.payment_outbox set status='ignored',ignored_at=now(),locked_at=null,
    locked_by=null,lease_token=null,lease_expires_at=null,updated_at=now()
  where id=event_row.id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,
    actor_type,action,resource_type,resource_id,request_id,after_json,
    membership_id,granted_via,created_at)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,
    'admin','payment.outbox.ignored','order',event_row.order_id,trim(p_request_id),
    jsonb_build_object('eventId',event_row.id,'reason',trim(p_reason),
      'reviewerMemberIds',reviewers),p_actor_membership_id,p_granted_via,now());
  return jsonb_build_object('accepted',true,'status','ignored','duplicate',false,
    'approvals',approvals,'eventId',event_row.id);
end $$;

revoke all on function public.prepare_payment_outbox_envelope(),
  public.enforce_payment_outbox_envelope_immutable()
from public,anon,authenticated,service_role;
revoke all on function public.api_payment_outbox_deadletters(
  text,text,text,text,text,jsonb,integer),
  public.api_replay_payment_deadletter(uuid,text,text,text,text,text,jsonb,text,text),
  public.api_ignore_payment_deadletter(uuid,text,text,text,text,text,jsonb,text,text)
from public,anon,authenticated;
grant execute on function public.api_payment_outbox_deadletters(
  text,text,text,text,text,jsonb,integer),
  public.api_replay_payment_deadletter(uuid,text,text,text,text,text,jsonb,text,text),
  public.api_ignore_payment_deadletter(uuid,text,text,text,text,text,jsonb,text,text)
to service_role;
