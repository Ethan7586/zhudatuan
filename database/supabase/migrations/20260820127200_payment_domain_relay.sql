-- Canonical relay RPCs are source-aware but share one lease, retry and inbox
-- implementation.  A dead letter blocks later aggregate versions until an
-- authorized operator explicitly ignores it.
create function public.api_claim_payment_outbox(
  p_source text,p_worker_id text,p_limit integer default 20,
  p_lease_seconds integer default 120
) returns table(
  id uuid,event_key text,topic text,source text,tenant_id text,aggregate_type text,
  aggregate_id text,aggregate_version bigint,event_type text,
  event_version integer,headers_json jsonb,occurred_at timestamptz,
  payload_json jsonb,delivery_attempts integer,lease_token uuid,
  lease_expires_at timestamptz
) language plpgsql security definer set search_path=public,pg_temp as $$
declare seconds integer:=least(greatest(coalesce(p_lease_seconds,120),15),900);
begin
  if p_source not in('wechat','internal','all')
    or trim(coalesce(p_worker_id,''))!~'^[A-Za-z0-9][A-Za-z0-9.:@-]{0,119}$'
  then raise exception 'PAYMENT_OUTBOX_WORKER_INVALID'; end if;
  with retired as(
    update public.payment_outbox outbox set status='dead_letter',
      dead_lettered_at=now(),last_error_code='LEASE_EXPIRED',
      locked_at=null,locked_by=null,lease_token=null,lease_expires_at=null,
      updated_at=now()
    where(p_source='all' or outbox.source=p_source)
      and outbox.delivery_attempts>=12 and(
      outbox.status='pending' or(outbox.status='processing'
        and outbox.lease_expires_at<=now())) returning outbox.*
  ) insert into public.audit_logs(
    id,tenant_id,enterprise_id,mall_id,actor_type,action,resource_type,
    resource_id,request_id,after_json,created_at)
  select gen_random_uuid()::text,retired.tenant_id,orders.enterprise_id,
    orders.mall_id,'system','payment.outbox.dead_lettered','order',
    retired.order_id,'payment-outbox-deadletter:'||retired.id,
    jsonb_build_object('source',retired.source,
      'attempts',retired.delivery_attempts,'reason','LEASE_EXPIRED'),now()
  from retired join public.orders orders on orders.id=retired.order_id;
  return query with claimable as(
    select outbox.id from public.payment_outbox outbox
    where(p_source='all' or outbox.source=p_source)
      and outbox.delivery_attempts<12
      and outbox.available_at<=now() and(outbox.status='pending'
        or(outbox.status='processing' and outbox.lease_expires_at<=now()))
      and not exists(select 1 from public.payment_outbox prior
        where prior.aggregate_id=outbox.aggregate_id
          and prior.aggregate_version<outbox.aggregate_version
          and prior.status not in('delivered','ignored'))
    order by outbox.created_at,outbox.id for update skip locked
    limit least(greatest(coalesce(p_limit,20),1),100)
  ) update public.payment_outbox outbox set status='processing',
    delivery_attempts=outbox.delivery_attempts+1,locked_at=now(),
    locked_by=trim(p_worker_id),lease_token=gen_random_uuid(),
    lease_expires_at=now()+make_interval(secs=>seconds),updated_at=now()
  from claimable where outbox.id=claimable.id
  returning outbox.id,outbox.event_key,outbox.topic,outbox.source,outbox.tenant_id,
    outbox.aggregate_type,outbox.aggregate_id,outbox.aggregate_version,
    outbox.event_type,outbox.event_version,outbox.headers_json,
    outbox.created_at,outbox.payload_json,outbox.delivery_attempts,
    outbox.lease_token,outbox.lease_expires_at;
end $$;

create function public.api_start_payment_effects(
  p_source text,p_event_id uuid,p_worker_id text,p_lease_token uuid
) returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare event public.payment_outbox%rowtype; payment public.payments%rowtype;
  intent public.payment_intents%rowtype;
  attempt public.wechat_payment_attempts%rowtype; orders public.orders%rowtype;
  inbox_id uuid; digest_value text; effects text[];
  inserted_count integer; duplicate boolean:=false;
begin
  if p_source not in('wechat','internal') then
    raise exception 'PAYMENT_OUTBOX_SOURCE_INVALID'; end if;
  select * into event from public.payment_outbox outbox
  where outbox.id=p_event_id and outbox.source=p_source
    and outbox.status='processing' and outbox.locked_by=trim(p_worker_id)
    and outbox.lease_token=p_lease_token and outbox.lease_expires_at>now()
  for update;
  if not found then raise exception 'PAYMENT_OUTBOX_LEASE_LOST'; end if;
  select * into strict orders from public.orders where id=event.order_id;
  if orders.tenant_id<>event.tenant_id or event.aggregate_type<>'order'
    or event.aggregate_id<>event.order_id or event.event_type<>event.topic
    or event.payload_json->>'orderId'<>event.order_id
    or coalesce(event.payload_json->>'amountCents','')!~'^[0-9]+$'
  then raise exception 'PAYMENT_OUTBOX_EVIDENCE_MISMATCH'; end if;
  if event.source='wechat' then
    select * into strict payment from public.payments where id=event.payment_id;
    select * into strict attempt from public.wechat_payment_attempts
      where id=event.attempt_id;
    if payment.order_id<>orders.id or payment.tenant_id<>orders.tenant_id
      or payment.mall_id<>orders.mall_id or payment.user_id<>orders.user_id
      or event.payload_json->>'paymentId'<>payment.id
      or(event.payload_json->>'amountCents')::bigint<>payment.amount_cents
      or attempt.payment_id<>payment.id or attempt.order_id<>orders.id
      or attempt.amount_total<>payment.amount_cents
      or event.payload_json->>'attemptId'<>event.attempt_id::text
      or(event.topic='order.payment_succeeded' and(
        payment.status not in('succeeded','refunded')
        or attempt.status<>'succeeded'
        or orders.status not in('paid','processing','shipped','completed',
          'refund_pending','refunded')
        or orders.paid_cents<>orders.payable_cents
        or payment.provider_trade_no is null
        or event.payload_json->>'tradeState'<>'SUCCESS'
        or event.payload_json->>'outcome'<>'applied'
        or event.payload_json->>'transactionId'<>payment.provider_trade_no
        or attempt.transaction_id<>payment.provider_trade_no
        or not exists(select 1
          from public.wechat_payment_observations observation
          where observation.attempt_id=attempt.id
            and observation.trade_state='SUCCESS'
            and observation.amount_total=payment.amount_cents
            and observation.outcome in('applied','reconciliation_required')
            and event.event_key=observation.provider_event_key||':'||event.topic)))
      or(event.topic='order.payment_terminal' and(
        payment.status not in('failed','closed')
        or attempt.status not in('failed','closed')
        or coalesce(event.payload_json->>'tradeState','')
          not in('CLOSED','REVOKED','PAYERROR')
        or event.payload_json->>'outcome'<>'applied'))
      or(event.topic='order.payment_reconciliation_required' and(
        orders.status not in('refund_pending','refunded')
        or payment.status not in('succeeded','refunded')
        or attempt.status<>'succeeded' or payment.provider_trade_no is null
        or event.payload_json->>'tradeState'<>'SUCCESS'
        or event.payload_json->>'outcome'<>'reconciliation_required'
        or event.payload_json->>'transactionId'<>payment.provider_trade_no
        or attempt.transaction_id<>payment.provider_trade_no))
    then raise exception 'PAYMENT_OUTBOX_STATE_MISMATCH'; end if;
  else
    select * into strict intent from public.payment_intents
      where id=event.payment_intent_id;
    if intent.order_id<>orders.id or intent.tenant_id<>orders.tenant_id
      or intent.mall_id<>orders.mall_id or intent.user_id<>orders.user_id
      or(event.payload_json->>'amountCents')::bigint<>intent.amount_cents
      or event.payload_json->>'paymentIntentId'<>intent.id::text
      or event.payload_json->>'currency'<>'CNY'
      or event.payload_json->>'outcome'<>'applied'
      or not public.internal_payment_intent_valid(intent.id)
    or orders.status not in('paid','processing','shipped','completed',
      'refund_pending','refunded')
    or orders.paid_cents<>orders.payable_cents
      or not exists(select 1 from inventory.reservations reservation
        where reservation.tenant_id=orders.tenant_id
          and reservation.mall_id=orders.mall_id
          and reservation.order_id=orders.id)
      or exists(select 1 from inventory.reservations reservation
        where reservation.tenant_id=orders.tenant_id
          and reservation.mall_id=orders.mall_id
          and reservation.order_id=orders.id and reservation.state<>'committed')
    then raise exception 'PAYMENT_INTERNAL_OUTBOX_STATE_MISMATCH'; end if;
  end if;
  digest_value:=encode(digest(jsonb_build_object(
    'eventId',event.id,'eventKey',event.event_key,'topic',event.topic,
    'tenantId',event.tenant_id,'aggregateType',event.aggregate_type,
    'aggregateId',event.aggregate_id,'aggregateVersion',event.aggregate_version,
    'eventType',event.event_type,'eventVersion',event.event_version,
    'headers',event.headers_json,'occurredAt',event.created_at,
    'payload',event.payload_json)::text,'sha256'),'hex');
  insert into public.payment_event_inbox(
    outbox_id,event_key,tenant_id,aggregate_id,aggregate_version,
    event_type,payload_digest,consumer)
  values(event.id,event.event_key,event.tenant_id,event.aggregate_id,
    event.aggregate_version,event.event_type,digest_value,trim(p_worker_id))
  on conflict do nothing returning id into inbox_id;
  if inbox_id is null then
    duplicate:=true;
    select inbox.id into strict inbox_id from public.payment_event_inbox inbox
    where inbox.outbox_id=event.id and inbox.event_key=event.event_key
      and inbox.tenant_id=event.tenant_id
      and inbox.aggregate_id=event.aggregate_id
      and inbox.aggregate_version=event.aggregate_version
      and inbox.event_type=event.event_type
      and inbox.payload_digest=digest_value;
  end if;
  effects:=case when event.topic='order.payment_succeeded'
      and orders.status in('refund_pending','refunded')
      then array['accounting']
    when event.source='internal' then
      array['accounting','fulfillment','notification']
    when event.topic='order.payment_succeeded' then
      case when orders.paid_cents=orders.payable_cents
        and orders.status in('paid','processing','shipped','completed')
      then array['accounting','fulfillment','notification']
      else array['accounting','notification'] end
    when event.topic='order.payment_terminal' then array['notification']
    else array['accounting','notification'] end;
  insert into public.payment_event_effects(
    inbox_id,outbox_id,tenant_id,order_id,payment_id,payment_intent_id,
    effect_type,payload_json)
  select inbox_id,event.id,event.tenant_id,event.order_id,event.payment_id,
    event.payment_intent_id,
    effect,jsonb_strip_nulls(jsonb_build_object('eventId',event.id,
      'eventKey',event.event_key,'eventType',event.event_type,
      'source',event.source,'orderId',event.order_id,
      'paymentId',event.payment_id,'paymentIntentId',event.payment_intent_id,
      'attemptId',event.attempt_id,
      'occurredAt',event.created_at))
  from unnest(effects) requested(effect)
  on conflict(outbox_id,effect_type) do nothing;
  get diagnostics inserted_count=row_count;
  if not duplicate then
    insert into public.audit_logs(
      id,tenant_id,enterprise_id,mall_id,actor_type,action,resource_type,
      resource_id,request_id,after_json,created_at)
    values(gen_random_uuid()::text,event.tenant_id,orders.enterprise_id,
      orders.mall_id,'system','payment.outbox.effects_started','order',
      event.order_id,'payment-outbox:'||event.id,
      jsonb_build_object('source',event.source,'eventType',event.event_type,
        'effects',to_jsonb(effects)),now());
  end if;
  return jsonb_build_object('accepted',true,'duplicate',duplicate,
    'effectCount',cardinality(effects),'newEffectCount',inserted_count);
end $$;

create function public.api_finish_payment_outbox(
  p_source text,p_event_id uuid,p_worker_id text,p_lease_token uuid,
  p_succeeded boolean,p_error_code text default null
) returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare event public.payment_outbox%rowtype; next_status text;
  delay_seconds double precision; safe_error text;
begin
  if p_source not in('wechat','internal') or p_succeeded is null
  then raise exception 'PAYMENT_OUTBOX_RESULT_INVALID'; end if;
  select * into event from public.payment_outbox outbox
  where outbox.id=p_event_id and outbox.source=p_source
    and outbox.status='processing' and outbox.locked_by=trim(p_worker_id)
    and outbox.lease_token=p_lease_token and outbox.lease_expires_at>now()
  for update;
  if not found then return jsonb_build_object(
    'accepted',false,'status','lease_lost'); end if;
  if p_succeeded and not exists(select 1 from public.payment_event_inbox
    where outbox_id=event.id)
  then raise exception 'PAYMENT_OUTBOX_EFFECTS_NOT_STARTED'; end if;
  next_status:=case when p_succeeded then 'delivered'
    when event.delivery_attempts>=12 then 'dead_letter' else 'pending' end;
  safe_error:=left(coalesce(nullif(regexp_replace(upper(coalesce(
    p_error_code,'')),'[^A-Z0-9_.:-]','','g'),''),'DELIVERY_FAILED'),120);
  delay_seconds:=least(3600.0,5.0*power(2.0,
    least(event.delivery_attempts-1,9)))*(0.8+random()*0.4);
  update public.payment_outbox set status=next_status,
    delivered_at=case when p_succeeded then now() else null end,
    dead_lettered_at=case when next_status='dead_letter' then now() else null end,
    available_at=case when next_status='pending'
      then now()+make_interval(secs=>delay_seconds) else available_at end,
    last_error_code=case when p_succeeded then null else safe_error end,
    locked_at=null,locked_by=null,lease_token=null,lease_expires_at=null,
    updated_at=now() where id=event.id;
  if next_status='dead_letter' then
    insert into public.audit_logs(
      id,tenant_id,enterprise_id,mall_id,actor_type,action,resource_type,
      resource_id,request_id,after_json,created_at)
    select gen_random_uuid()::text,event.tenant_id,orders.enterprise_id,
      orders.mall_id,'system','payment.outbox.dead_lettered','order',
      event.order_id,'payment-outbox-deadletter:'||event.id,
      jsonb_build_object('source',event.source,
        'attempts',event.delivery_attempts,'reason',safe_error),now()
    from public.orders orders where orders.id=event.order_id;
  end if;
  return jsonb_build_object('accepted',true,'status',next_status,
    'attempts',event.delivery_attempts);
end $$;

revoke all on function public.api_claim_payment_outbox(text,text,integer,integer),
  public.api_start_payment_effects(text,uuid,text,uuid),
  public.api_finish_payment_outbox(text,uuid,text,uuid,boolean,text)
from public,anon,authenticated;
grant execute on function public.api_claim_payment_outbox(text,text,integer,integer),
  public.api_start_payment_effects(text,uuid,text,uuid),
  public.api_finish_payment_outbox(text,uuid,text,uuid,boolean,text)
to service_role;
