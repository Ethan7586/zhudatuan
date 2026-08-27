create function public.api_payment_operation_deadletters(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,
  p_enterprise_id text,p_mall_id text,p_granted_via jsonb,
  p_limit integer default 50
) returns table(id uuid,resource_type text,resource_id text,order_id text,
  error_code text,details_json jsonb,occurrence_count integer,
  opened_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_limit is null or p_limit not between 1 and 200
  then raise exception 'PAYMENT_OPERATION_QUERY_INVALID'; end if;
  perform public.internal_authorize_payment_deadletter_actor(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,
    p_mall_id,'payment.outbox.read',p_granted_via,false);
  return query select alert.id,alert.resource_type,alert.resource_id,
    alert.order_id,alert.error_code,alert.details_json,
    alert.occurrence_count,alert.opened_at
  from public.payment_operations_alerts alert
  where alert.status='open' and alert.tenant_id=p_tenant_id
    and alert.enterprise_id=p_enterprise_id and alert.mall_id=p_mall_id
  order by alert.opened_at,alert.id limit p_limit;
end $$;

create function public.api_replay_payment_operation_deadletter(
  p_resource_type text,p_resource_id text,p_actor_membership_id text,
  p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_granted_via jsonb,p_reason text,p_request_id text
) returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare resource_uuid uuid; alert public.payment_operations_alerts%rowtype;
  existing public.payment_recovery_requests%rowtype;
  actor_member_id text; payment_id text; current_status text;
begin
  if p_resource_type not in('payment_effect','payment_query')
    or coalesce(p_resource_id,'')!~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    or length(trim(coalesce(p_reason,''))) not between 4 and 500
    or length(trim(coalesce(p_request_id,''))) not between 1 and 160
  then raise exception 'PAYMENT_RECOVERY_OPERATION_INVALID'; end if;
  resource_uuid:=p_resource_id::uuid;
  actor_member_id:=public.internal_authorize_payment_deadletter_actor(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,
    p_mall_id,'payment.outbox.manage',p_granted_via,true);
  select * into existing from public.payment_recovery_requests recovery
  where recovery.request_id=trim(p_request_id);
  if found then
    if existing.resource_type<>p_resource_type
      or existing.resource_id<>resource_uuid::text
      or existing.actor_member_id<>actor_member_id
      or existing.actor_membership_id<>p_actor_membership_id
      or existing.actor_user_id<>p_actor_user_id
      or existing.reason<>trim(p_reason)
    then raise exception 'PAYMENT_RECOVERY_REQUEST_CONFLICT'; end if;
    return jsonb_build_object('accepted',true,'status','replayed',
      'duplicate',true,'resourceType',p_resource_type,
      'resourceId',resource_uuid);
  end if;
  select * into alert from public.payment_operations_alerts operation_alert
  where operation_alert.resource_type=p_resource_type
    and operation_alert.resource_id=resource_uuid::text
    and operation_alert.status='open'
    and operation_alert.tenant_id=p_tenant_id
    and operation_alert.enterprise_id=p_enterprise_id
    and operation_alert.mall_id=p_mall_id;
  if not found then return jsonb_build_object(
    'accepted',false,'status','not_found'); end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'payment-order:'||alert.order_id,0));
  perform 1 from public.orders orders where orders.id=alert.order_id
    and orders.tenant_id=p_tenant_id
    and orders.enterprise_id=p_enterprise_id
    and orders.mall_id=p_mall_id for update;
  if not found then return jsonb_build_object(
    'accepted',false,'status','not_found'); end if;
  if p_resource_type='payment_effect' then
    select effect.status into current_status
    from public.payment_event_effects effect
    where effect.id=resource_uuid and effect.order_id=alert.order_id for update;
    if not found then return jsonb_build_object(
      'accepted',false,'status','not_found'); end if;
    if current_status<>'dead_letter' then return jsonb_build_object(
      'accepted',false,'status',current_status); end if;
    update public.payment_event_effects set status='pending',attempts=0,
      available_at=now(),locked_by=null,locked_at=null,lease_token=null,
      lease_expires_at=null,completed_at=null,dead_lettered_at=null,
      result_code=null,last_error_code=null,updated_at=now()
    where id=resource_uuid;
  else
    select attempt.payment_id into payment_id
    from public.wechat_payment_attempts attempt
    where attempt.id=resource_uuid and attempt.order_id=alert.order_id;
    if not found then return jsonb_build_object(
      'accepted',false,'status','not_found'); end if;
    perform 1 from public.payments payment where payment.id=payment_id
      and payment.order_id=alert.order_id for update;
    if not found then raise exception 'PAYMENT_QUERY_LINKAGE_INVALID'; end if;
    perform 1 from public.wechat_payment_attempts attempt
      where attempt.id=resource_uuid and attempt.order_id=alert.order_id
        and attempt.query_dead_lettered_at is not null for update;
    if not found then return jsonb_build_object(
      'accepted',false,'status','not_found'); end if;
    update public.wechat_payment_attempts set query_attempts=0,
      query_operation='query',query_available_at=now(),
      query_locked_by=null,query_locked_at=null,query_lease_token=null,
      query_lease_expires_at=null,query_dead_lettered_at=null,
      query_last_error_code=null,updated_at=now() where id=resource_uuid;
  end if;
  insert into public.payment_recovery_requests(
    request_id,resource_type,resource_id,tenant_id,enterprise_id,mall_id,
    actor_member_id,actor_membership_id,actor_user_id,reason,evidence_digest)
  values(trim(p_request_id),p_resource_type,resource_uuid::text,p_tenant_id,
    p_enterprise_id,p_mall_id,actor_member_id,p_actor_membership_id,
    p_actor_user_id,trim(p_reason),
    encode(digest(p_granted_via::text,'sha256'),'hex'));
  update public.payment_operations_alerts set status='resolved',
    resolved_at=now(),resolution_request_id=trim(p_request_id),updated_at=now()
  where id=alert.id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,
    actor_user_id,actor_type,action,resource_type,resource_id,request_id,
    after_json,membership_id,granted_via,created_at)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,
    p_actor_user_id,'admin','payment.operation.replayed',p_resource_type,
    resource_uuid::text,trim(p_request_id),jsonb_build_object(
      'orderId',alert.order_id,'reason',trim(p_reason),
      'actorMemberId',actor_member_id),p_actor_membership_id,p_granted_via,now());
  return jsonb_build_object('accepted',true,'status','replayed',
    'duplicate',false,'resourceType',p_resource_type,
    'resourceId',resource_uuid);
end $$;

revoke all on function public.api_payment_operation_deadletters(
  text,text,text,text,text,jsonb,integer),
  public.api_replay_payment_operation_deadletter(
    text,text,text,text,text,text,text,jsonb,text,text)
from public,anon,authenticated;
grant execute on function public.api_payment_operation_deadletters(
  text,text,text,text,text,jsonb,integer),
  public.api_replay_payment_operation_deadletter(
    text,text,text,text,text,text,text,jsonb,text,text)
to service_role;

notify pgrst,'reload schema';
