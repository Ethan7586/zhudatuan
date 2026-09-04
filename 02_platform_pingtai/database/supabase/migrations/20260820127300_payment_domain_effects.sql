-- Final payment effect model: one capture anchor, balanced immutable journals,
-- fail-closed fulfillment and order-first leased execution.
alter table public.finance_journals add column payment_intent_id uuid references public.payment_intents(id),alter column payment_id drop not null,
  add constraint finance_journals_payment_anchor_check check((payment_id is not null)<>(payment_intent_id is not null));
alter table public.finance_journal_entries add column payment_intent_id uuid references public.payment_intents(id),alter column payment_id drop not null,
  add constraint finance_entries_payment_anchor_check check((payment_id is not null)<>(payment_intent_id is not null));
alter table public.fulfillment_orders add column payment_intent_id uuid references public.payment_intents(id),alter column payment_id drop not null,
  add constraint fulfillment_payment_anchor_check check((payment_id is not null)<>(payment_intent_id is not null));
alter table public.notification_dispatches add column payment_intent_id uuid references public.payment_intents(id),alter column payment_id drop not null,
  add constraint notification_payment_anchor_check check((payment_id is not null)<>(payment_intent_id is not null));

create function public.enforce_payment_effect_identity() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin
  if row(new.inbox_id,new.outbox_id,new.tenant_id,new.order_id,new.payment_id,new.payment_intent_id,new.effect_type,new.payload_json,new.created_at)
    is distinct from row(old.inbox_id,old.outbox_id,old.tenant_id,old.order_id,old.payment_id,old.payment_intent_id,old.effect_type,old.payload_json,old.created_at)
  then raise exception 'PAYMENT_EFFECT_IDENTITY_IMMUTABLE'; end if;return new;end $$;
create trigger payment_effect_identity before update on public.payment_event_effects
for each row execute function public.enforce_payment_effect_identity();
create function public.enforce_fulfillment_identity() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin
  if row(new.tenant_id,new.mall_id,new.order_id,new.sub_order_id,new.supplier_id,new.payment_id,new.payment_intent_id,new.source_effect_id,new.amount_cents,new.idempotency_key,new.created_at)
    is distinct from row(old.tenant_id,old.mall_id,old.order_id,old.sub_order_id,old.supplier_id,old.payment_id,old.payment_intent_id,old.source_effect_id,old.amount_cents,old.idempotency_key,old.created_at)
  then raise exception 'FULFILLMENT_IDENTITY_IMMUTABLE'; end if;return new;end $$;
create trigger fulfillment_identity before update on public.fulfillment_orders
for each row execute function public.enforce_fulfillment_identity();

create function public.payment_capture_effect_superseded(p_effect_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce((select effect.effect_type in('fulfillment','notification')
    and event.topic='order.payment_succeeded' and orders.status='refunded'
    and orders.paid_cents=orders.payable_cents
    and event.tenant_id=orders.tenant_id and event.order_id=orders.id
    and event.payment_id is not distinct from effect.payment_id
    and event.payment_intent_id is not distinct from effect.payment_intent_id
    and ((event.source='wechat' and exists(select 1
      from public.payments payment join public.wechat_payment_attempts attempt
        on attempt.id=event.attempt_id and attempt.payment_id=payment.id
      where payment.id=effect.payment_id and payment.order_id=orders.id
        and payment.tenant_id=orders.tenant_id and payment.mall_id=orders.mall_id
        and payment.user_id=orders.user_id and payment.channel='wechat'
        and payment.status='refunded' and attempt.status='succeeded'
        and attempt.transaction_id is not distinct from payment.provider_trade_no
        and(select coalesce(sum(refund.amount_cents),0) from public.refunds refund
          where refund.payment_id=payment.id and refund.status='succeeded')=payment.amount_cents
        and not exists(select 1 from public.refunds refund
          where refund.payment_id=payment.id and(refund.tenant_id<>orders.tenant_id
            or refund.mall_id<>orders.mall_id or refund.order_id<>orders.id))
        and exists(select 1 from public.finance_journals journal
          where journal.payment_id=payment.id and journal.payment_intent_id is null
            and journal.order_id=orders.id and journal.journal_type='payment_capture'
            and journal.status='posted' and journal.amount_cents=payment.amount_cents)))
      or(event.source='internal' and effect.payment_id is null
        and public.internal_payment_intent_valid(effect.payment_intent_id)
        and(select coalesce(sum(refund.amount_cents),0) from public.refunds refund
          join public.payments payment on payment.id=refund.payment_id
          where payment.payment_intent_id=effect.payment_intent_id
            and refund.status='succeeded')=orders.paid_cents
        and exists(select 1 from public.finance_journals journal
          where journal.payment_intent_id=effect.payment_intent_id
            and journal.payment_id is null and journal.order_id=orders.id
            and journal.journal_type='payment_capture' and journal.status='posted'
            and journal.amount_cents=orders.paid_cents)))
  from public.payment_event_effects effect join public.payment_outbox event
    on event.id=effect.outbox_id join public.orders orders on orders.id=effect.order_id
  where effect.id=p_effect_id),false)
$$;

create function public.process_payment_accounting_effect(p_effect_id uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare effect public.payment_event_effects%rowtype;event public.payment_outbox%rowtype;payment public.payments%rowtype;
  intent public.payment_intents%rowtype;orders public.orders%rowtype;attempt public.wechat_payment_attempts%rowtype;journal_id uuid;
begin
  select * into strict effect from public.payment_event_effects where id=p_effect_id and effect_type='accounting';
  select * into strict event from public.payment_outbox where id=effect.outbox_id;select * into strict orders from public.orders where id=effect.order_id;
  if event.tenant_id<>effect.tenant_id or event.order_id<>orders.id or orders.tenant_id<>effect.tenant_id then raise exception 'PAYMENT_ACCOUNTING_EVIDENCE_MISMATCH';end if;
  if event.source='wechat' then
    select * into strict payment from public.payments where id=effect.payment_id;select * into strict attempt from public.wechat_payment_attempts where id=event.attempt_id;
    if event.payment_id<>payment.id or effect.payment_intent_id is not null or payment.tenant_id<>orders.tenant_id or payment.order_id<>orders.id
      or payment.mall_id<>orders.mall_id or payment.user_id<>orders.user_id or payment.status not in('succeeded','refunded') or payment.channel<>'wechat'
      or attempt.payment_id<>payment.id or attempt.order_id<>orders.id or attempt.status<>'succeeded' or attempt.transaction_id is distinct from payment.provider_trade_no
      or attempt.amount_total<>payment.amount_cents or event.topic not in('order.payment_succeeded','order.payment_reconciliation_required')
      or not exists(select 1 from public.wechat_payment_observations observation where observation.attempt_id=attempt.id and observation.trade_state='SUCCESS'
        and observation.amount_total=payment.amount_cents and observation.outcome in('applied','reconciliation_required')
        and event.event_key=observation.provider_event_key||':'||event.topic)
      or(event.topic='order.payment_succeeded' and(orders.status not in('paid','processing','shipped','completed','refund_pending','refunded')
        or orders.paid_cents<>orders.payable_cents))
      or(event.topic='order.payment_reconciliation_required' and orders.status not in('refund_pending','refunded'))
    then raise exception 'PAYMENT_ACCOUNTING_EVIDENCE_MISMATCH';end if;
  else
    select * into strict intent from public.payment_intents where id=effect.payment_intent_id;
    if event.payment_intent_id<>intent.id or effect.payment_id is not null or event.topic<>'order.payment_succeeded'
      or intent.order_id<>orders.id or not public.internal_payment_intent_valid(intent.id)
    then raise exception 'PAYMENT_ACCOUNTING_EVIDENCE_MISMATCH';end if;
  end if;
  select id into journal_id from public.finance_journals where source_effect_id=effect.id;if found then return 'journal_posted';end if;
  insert into public.finance_journals(tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,journal_type,business_reference,currency,amount_cents,status,occurred_at)
  values(effect.tenant_id,orders.mall_id,orders.id,effect.payment_id,effect.payment_intent_id,effect.id,'payment_capture',
    case when event.source='wechat' then 'payment:'||payment.id else 'payment-intent:'||intent.id end,'CNY',
    case when event.source='wechat' then payment.amount_cents else intent.amount_cents end,'posted',event.created_at) returning id into journal_id;
  if event.source='wechat' then
    insert into public.finance_journal_entries(journal_id,tenant_id,mall_id,order_id,payment_id,payment_intent_id,account_code,side,amount_cents,subject_type,subject_id)
    values(journal_id,effect.tenant_id,orders.mall_id,orders.id,payment.id,null,'asset:wechat_receivable','debit',payment.amount_cents,'order',orders.id),
      (journal_id,effect.tenant_id,orders.mall_id,orders.id,payment.id,null,'liability:customer_payment_clearing','credit',payment.amount_cents,'order',orders.id);
  else
    insert into public.finance_journal_entries(journal_id,tenant_id,mall_id,order_id,payment_id,payment_intent_id,account_code,side,amount_cents,subject_type,subject_id)
    select journal_id,intent.tenant_id,intent.mall_id,intent.order_id,tender.id,null,'liability:'||tender.channel||'_balance','debit',tender.amount_cents,'order',intent.order_id
    from public.payments tender where tender.payment_intent_id=intent.id;
    insert into public.finance_journal_entries(journal_id,tenant_id,mall_id,order_id,payment_id,payment_intent_id,account_code,side,amount_cents,subject_type,subject_id)
    values(journal_id,intent.tenant_id,intent.mall_id,intent.order_id,null,intent.id,'liability:customer_payment_clearing','credit',intent.amount_cents,'order',intent.order_id);
  end if;return 'journal_posted';
end $$;

create function public.process_payment_fulfillment_effect(p_effect_id uuid)
returns text language plpgsql security definer set search_path=public,inventory,pg_temp as $$
declare effect public.payment_event_effects%rowtype;event public.payment_outbox%rowtype;orders public.orders%rowtype;
begin
  select * into strict effect from public.payment_event_effects where id=p_effect_id and effect_type='fulfillment';
  select * into strict event from public.payment_outbox where id=effect.outbox_id;select * into strict orders from public.orders where id=effect.order_id;
  if public.payment_capture_effect_superseded(effect.id) then return 'fulfillment_superseded_refunded';end if;
  if event.topic<>'order.payment_succeeded' or event.tenant_id<>orders.tenant_id or event.order_id<>orders.id
    or event.payment_id is distinct from effect.payment_id or event.payment_intent_id is distinct from effect.payment_intent_id
    or orders.status not in('paid','processing','shipped','completed') or orders.paid_cents<>orders.payable_cents
    or(event.source='wechat' and not exists(select 1 from public.payments p where p.id=effect.payment_id and p.order_id=orders.id
      and p.tenant_id=orders.tenant_id and p.mall_id=orders.mall_id and p.user_id=orders.user_id and p.status='succeeded' and p.channel='wechat'))
    or(event.source='internal' and not public.internal_payment_intent_valid(effect.payment_intent_id))
    or not exists(select 1 from inventory.reservations r where r.tenant_id=orders.tenant_id and r.mall_id=orders.mall_id and r.order_id=orders.id)
    or exists(select 1 from inventory.reservations r where r.tenant_id=orders.tenant_id and r.mall_id=orders.mall_id and r.order_id=orders.id and r.state<>'committed')
  then raise exception 'PAYMENT_FULFILLMENT_EVIDENCE_MISMATCH';end if;
  insert into public.fulfillment_orders(tenant_id,mall_id,order_id,sub_order_id,supplier_id,payment_id,payment_intent_id,source_effect_id,amount_cents,idempotency_key)
  select orders.tenant_id,orders.mall_id,orders.id,sub.id,sub.supplier_id,effect.payment_id,effect.payment_intent_id,effect.id,sub.amount_cents,
    coalesce('payment:'||effect.payment_id,'payment-intent:'||effect.payment_intent_id)||':suborder:'||sub.id
  from public.sub_orders sub where sub.parent_order_id=orders.id and sub.tenant_id=orders.tenant_id and sub.mall_id=orders.mall_id and sub.status='paid'
  on conflict(source_effect_id,sub_order_id) do nothing;
  if not exists(select 1 from public.fulfillment_orders where source_effect_id=effect.id) then raise exception 'PAYMENT_FULFILLMENT_SUBORDER_MISSING';end if;
  insert into public.fulfillment_order_items(fulfillment_order_id,order_item_id,sku_id,quantity)
  select f.id,item.id,item.sku_id,item.quantity from public.fulfillment_orders f join public.order_items item
    on item.sub_order_id=f.sub_order_id and item.order_id=orders.id where f.source_effect_id=effect.id
  on conflict(fulfillment_order_id,order_item_id) do nothing;
  if exists(select 1 from public.fulfillment_orders f where f.source_effect_id=effect.id and not exists(
    select 1 from public.fulfillment_order_items item where item.fulfillment_order_id=f.id))
  then raise exception 'PAYMENT_FULFILLMENT_ITEMS_MISSING';end if;return 'fulfillment_queued';
end $$;

create function public.process_payment_notification_effect(p_effect_id uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare effect public.payment_event_effects%rowtype;event public.payment_outbox%rowtype;payment public.payments%rowtype;
  intent public.payment_intents%rowtype;orders public.orders%rowtype;template text;amount bigint;
begin
  select * into strict effect from public.payment_event_effects where id=p_effect_id and effect_type='notification';
  select * into strict event from public.payment_outbox where id=effect.outbox_id;select * into strict orders from public.orders where id=effect.order_id;
  if event.tenant_id<>orders.tenant_id or event.order_id<>orders.id or event.payment_id is distinct from effect.payment_id
    or event.payment_intent_id is distinct from effect.payment_intent_id then raise exception 'PAYMENT_NOTIFICATION_EVIDENCE_MISMATCH';end if;
  if public.payment_capture_effect_superseded(effect.id) then return 'notification_superseded_refunded';end if;
  if event.source='internal' then select * into strict intent from public.payment_intents where id=effect.payment_intent_id;
    if event.topic<>'order.payment_succeeded' or not public.internal_payment_intent_valid(intent.id) then raise exception 'PAYMENT_NOTIFICATION_EVIDENCE_MISMATCH';end if;
    template:='payment.succeeded';amount:=intent.amount_cents;
  else select * into strict payment from public.payments where id=effect.payment_id;
    if payment.order_id<>orders.id or payment.tenant_id<>orders.tenant_id or payment.mall_id<>orders.mall_id or payment.user_id<>orders.user_id
      or(event.topic='order.payment_succeeded' and payment.status not in('succeeded','refunded'))
      or(event.topic='order.payment_terminal' and payment.status not in('failed','closed'))
      or(event.topic='order.payment_reconciliation_required' and(payment.status not in('succeeded','refunded') or orders.status not in('refund_pending','refunded')))
    then raise exception 'PAYMENT_NOTIFICATION_EVIDENCE_MISMATCH';end if;
    template:=case event.topic when 'order.payment_succeeded' then 'payment.succeeded' when 'order.payment_terminal'
      then case when payment.status='closed' then 'payment.closed' else 'payment.failed' end else 'payment.reconciliation' end;amount:=payment.amount_cents;
  end if;
  insert into public.notification_dispatches(tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,recipient_kind,recipient_id,channel,template_key,payload_json)
  values(orders.tenant_id,orders.mall_id,orders.id,effect.payment_id,effect.payment_intent_id,effect.id,'user',orders.user_id,'inapp',template,
    jsonb_strip_nulls(jsonb_build_object('orderId',orders.id,'paymentId',effect.payment_id,'paymentIntentId',effect.payment_intent_id,
      'amountCents',amount,'paymentStatus',case when event.source='internal' then intent.status else payment.status end)))
  on conflict(source_effect_id,recipient_kind,channel) do nothing;
  if event.topic='order.payment_reconciliation_required' then
    insert into public.notification_dispatches(tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,recipient_kind,recipient_id,channel,template_key,payload_json)
    values(orders.tenant_id,orders.mall_id,orders.id,effect.payment_id,null,effect.id,'operations',orders.mall_id,'inapp','payment.reconciliation.operations',
      jsonb_build_object('orderId',orders.id,'paymentId',effect.payment_id,'reasonCode',event.payload_json->>'reasonCode'))
    on conflict(source_effect_id,recipient_kind,channel) do nothing;end if;return 'notification_persisted';
end $$;

create function public.api_claim_payment_event_effects(p_worker_id text,p_limit integer default 20,p_lease_seconds integer default 120)
returns table(id uuid,effect_type text,tenant_id text,aggregate_id text,aggregate_version bigint,event_type text,attempts integer,lease_token uuid,lease_expires_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare seconds integer:=least(greatest(coalesce(p_lease_seconds,120),15),900);candidate record;retired public.payment_event_effects%rowtype;
begin
  if trim(coalesce(p_worker_id,''))!~'^[A-Za-z0-9][A-Za-z0-9.:@-]{0,119}$' then raise exception 'PAYMENT_EFFECT_WORKER_INVALID';end if;
  for candidate in select effect.id,effect.order_id from public.payment_event_effects effect where effect.attempts>=12
    and(effect.status='pending' or(effect.status='processing' and effect.lease_expires_at<=now())) order by effect.updated_at,effect.id limit 100 loop
    perform pg_advisory_xact_lock(hashtextextended('payment-order:'||candidate.order_id,0));perform 1 from public.orders o where o.id=candidate.order_id for update;
    if not found then raise exception 'PAYMENT_EFFECT_ORDER_MISSING';end if;retired:=null;
    update public.payment_event_effects effect set status='dead_letter',dead_lettered_at=now(),last_error_code='LEASE_EXPIRED',locked_by=null,locked_at=null,
      lease_token=null,lease_expires_at=null,updated_at=now() where effect.id=candidate.id and effect.order_id=candidate.order_id and effect.attempts>=12
      and(effect.status='pending' or(effect.status='processing' and effect.lease_expires_at<=now())) returning effect.* into retired;
    if retired.id is not null then insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_type,action,resource_type,resource_id,request_id,after_json,created_at)
      select gen_random_uuid()::text,retired.tenant_id,o.enterprise_id,o.mall_id,'system','payment.effect.dead_letter','payment_effect',retired.id::text,
        'payment-effect-retired:'||retired.id,jsonb_build_object('effectType',retired.effect_type,'errorCode','LEASE_EXPIRED','attempts',retired.attempts),now()
      from public.orders o where o.id=retired.order_id;end if;end loop;
  return query with claimable as(select effect.id from public.payment_event_effects effect join public.payment_outbox event on event.id=effect.outbox_id
    where effect.attempts<12 and effect.available_at<=now() and(effect.status='pending' or(effect.status='processing' and effect.lease_expires_at<=now()))
      and not exists(select 1 from public.payment_event_effects prior join public.payment_outbox pe on pe.id=prior.outbox_id where pe.aggregate_id=event.aggregate_id
        and prior.status not in('succeeded','ignored') and(pe.aggregate_version<event.aggregate_version or(pe.aggregate_version=event.aggregate_version
          and case prior.effect_type when 'accounting' then 1 when 'fulfillment' then 2 else 3 end<case effect.effect_type when 'accounting' then 1 when 'fulfillment' then 2 else 3 end)))
    order by event.aggregate_version,case effect.effect_type when 'accounting' then 1 when 'fulfillment' then 2 else 3 end,effect.created_at
    for update of effect skip locked limit least(greatest(coalesce(p_limit,20),1),100))
  update public.payment_event_effects effect set status='processing',attempts=effect.attempts+1,locked_by=trim(p_worker_id),locked_at=now(),
    lease_token=gen_random_uuid(),lease_expires_at=now()+make_interval(secs=>seconds),updated_at=now()
  from claimable,public.payment_outbox event where effect.id=claimable.id and event.id=effect.outbox_id
  returning effect.id,effect.effect_type,effect.tenant_id,event.aggregate_id,event.aggregate_version,event.event_type,effect.attempts,effect.lease_token,effect.lease_expires_at;
end $$;

create function public.api_execute_payment_event_effect(p_effect_id uuid,p_worker_id text,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path=public,inventory,pg_temp as $$
declare snapshot public.payment_event_effects%rowtype;effect public.payment_event_effects%rowtype;result text;error_code text;next_status text;delay_seconds double precision;
begin
  select * into snapshot from public.payment_event_effects where id=p_effect_id;if not found then return jsonb_build_object('accepted',false,'status','lease_lost');end if;
  perform pg_advisory_xact_lock(hashtextextended('payment-order:'||snapshot.order_id,0));perform 1 from public.orders o where o.id=snapshot.order_id for update;
  if not found then raise exception 'PAYMENT_EFFECT_ORDER_MISSING';end if;
  select * into effect from public.payment_event_effects where id=p_effect_id and order_id=snapshot.order_id and status='processing'
    and locked_by=trim(p_worker_id) and lease_token=p_lease_token and lease_expires_at>now() for update;
  if not found then return jsonb_build_object('accepted',false,'status','lease_lost');end if;
  begin result:=case effect.effect_type when 'accounting' then public.process_payment_accounting_effect(effect.id)
    when 'fulfillment' then public.process_payment_fulfillment_effect(effect.id) else public.process_payment_notification_effect(effect.id) end;
  exception when others then error_code:=left(coalesce(nullif(regexp_replace(upper(sqlerrm),'[^A-Z0-9_.:-]','','g'),''),'PAYMENT_EFFECT_FAILED'),120);end;
  if error_code is null then next_status:='succeeded';else next_status:=case when effect.attempts>=12 then 'dead_letter' else 'pending' end;
    delay_seconds:=least(3600.0,5.0*power(2.0,least(effect.attempts-1,9)))*(0.8+random()*0.4);end if;
  update public.payment_event_effects set status=next_status,result_code=case when next_status='succeeded' then result else null end,
    completed_at=case when next_status='succeeded' then now() else null end,dead_lettered_at=case when next_status='dead_letter' then now() else null end,
    last_error_code=error_code,available_at=case when next_status='pending' then now()+make_interval(secs=>delay_seconds) else available_at end,
    locked_by=null,locked_at=null,lease_token=null,lease_expires_at=null,updated_at=now() where id=effect.id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_type,action,resource_type,resource_id,request_id,after_json,created_at)
  select gen_random_uuid()::text,effect.tenant_id,o.enterprise_id,o.mall_id,'system',case when next_status='succeeded' then 'payment.effect.completed' else 'payment.effect.'||next_status end,
    'payment_effect',effect.id::text,'payment-effect:'||effect.id||':'||effect.attempts,jsonb_build_object('effectType',effect.effect_type,'resultCode',result,'errorCode',error_code,'attempts',effect.attempts),now()
  from public.orders o where o.id=effect.order_id;
  return jsonb_build_object('accepted',true,'status',next_status,'resultCode',result,'errorCode',error_code,'attempts',effect.attempts);
end $$;

revoke all on function public.process_payment_accounting_effect(uuid),public.process_payment_fulfillment_effect(uuid),public.process_payment_notification_effect(uuid)
from public,anon,authenticated,service_role;
revoke all on function public.payment_capture_effect_superseded(uuid),
  public.enforce_payment_effect_identity(),public.enforce_fulfillment_identity()
from public,anon,authenticated,service_role;
revoke all on function public.api_claim_payment_event_effects(text,integer,integer),public.api_execute_payment_event_effect(uuid,text,uuid)
from public,anon,authenticated;
grant execute on function public.api_claim_payment_event_effects(text,integer,integer),public.api_execute_payment_event_effect(uuid,text,uuid) to service_role;
