-- Signed observations are applied behind one order-first boundary. A reused
-- provider event key is idempotent only when every provider evidence field is
-- identical; changed evidence fails closed before state or outbox mutation.
create or replace function public.api_apply_wechat_payment_observation(
  p_source text,p_provider_event_key text,p_provider_event_id text,
  p_event_type text,p_resource_type text,p_app_id text,p_mch_id text,
  p_out_trade_no text,p_transaction_id text,p_trade_state text,
  p_success_time timestamptz,p_amount_total bigint,p_payer_openid_hash text,
  p_evidence_json jsonb,p_request_id text
) returns jsonb language plpgsql security definer
set search_path=public,inventory,pg_temp as $$
declare mapped_order_id text; mapped_payment_id text;
  attempt public.wechat_payment_attempts%rowtype; payment public.payments%rowtype;
  order_row public.orders%rowtype; existing public.wechat_payment_observations%rowtype;
  outcome text:='recorded'; reason text; applied boolean:=false;
  next_paid bigint; topic text; inventory_error text; evidence_digest text;
begin
  if p_source not in('notification','query')
    or length(trim(coalesce(p_provider_event_key,''))) not between 1 and 200
    or length(trim(coalesce(p_provider_event_id,''))) not between 1 and 160
    or length(trim(coalesce(p_event_type,''))) not between 1 and 80
    or length(trim(coalesce(p_resource_type,''))) not between 1 and 80
    or length(trim(coalesce(p_app_id,''))) not between 6 and 64
    or length(trim(coalesce(p_mch_id,''))) not between 6 and 64
    or length(trim(coalesce(p_request_id,''))) not between 1 and 160
    or p_trade_state not in('SUCCESS','REFUND','NOTPAY','CLOSED','REVOKED','USERPAYING','PAYERROR')
    or p_amount_total<0
    or(p_payer_openid_hash is not null and p_payer_openid_hash!~'^[0-9a-f]{64}$')
    or jsonb_typeof(coalesce(p_evidence_json,'{}'))<>'object'
    or octet_length(coalesce(p_evidence_json,'{}')::text)>8192
    or lower(coalesce(p_evidence_json,'{}')::text) like '%"openid"%'
  then raise exception 'WECHAT_PAYMENT_OBSERVATION_INVALID'; end if;
  select a.order_id,a.payment_id into mapped_order_id,mapped_payment_id
  from public.wechat_payment_attempts a where a.out_trade_no=p_out_trade_no;
  if not found then raise exception 'WECHAT_PAYMENT_ATTEMPT_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payment-order:'||mapped_order_id,0));
  select * into strict order_row from public.orders o
    where o.id=mapped_order_id for update;
  select * into strict payment from public.payments p
    where p.id=mapped_payment_id and p.order_id=mapped_order_id for update;
  select * into strict attempt from public.wechat_payment_attempts a
    where a.out_trade_no=p_out_trade_no and a.order_id=mapped_order_id
      and a.payment_id=mapped_payment_id for update;
  if payment.tenant_id<>order_row.tenant_id or payment.mall_id<>order_row.mall_id
    or payment.user_id<>order_row.user_id or payment.amount_cents<>attempt.amount_total
  then raise exception 'WECHAT_PAYMENT_LINKAGE_INVALID'; end if;
  evidence_digest:=encode(digest(coalesce(p_evidence_json,'{}')::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'wechat-payment-observation:'||p_provider_event_key,0));
  select * into existing from public.wechat_payment_observations observation
    where observation.provider_event_key=p_provider_event_key;
  if found then
    if existing.source<>p_source or existing.provider_event_id<>p_provider_event_id
      or existing.event_type<>p_event_type or existing.resource_type<>p_resource_type
      or existing.attempt_id is distinct from attempt.id or existing.app_id<>p_app_id
      or existing.mch_id<>p_mch_id or existing.out_trade_no<>p_out_trade_no
      or existing.transaction_id is distinct from nullif(p_transaction_id,'')
      or existing.trade_state<>p_trade_state
      or existing.success_time is distinct from p_success_time
      or existing.amount_total<>p_amount_total
      or existing.payer_openid_hash is distinct from p_payer_openid_hash
      or existing.evidence_digest<>evidence_digest
    then raise exception 'WECHAT_PAYMENT_OBSERVATION_REPLAY_MISMATCH'; end if;
    return jsonb_build_object('applied',false,'duplicate',true,
      'orderId',mapped_order_id,'paymentId',mapped_payment_id,
      'outcome',existing.outcome,'reasonCode',existing.reason_code);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'wechat-payment-trade:'||coalesce(p_out_trade_no,''),0));
  if attempt.app_id<>p_app_id then outcome:='rejected';reason:='app_id_mismatch';
  elsif attempt.mch_id<>p_mch_id then outcome:='rejected';reason:='mch_id_mismatch';
  elsif attempt.amount_total<>p_amount_total then outcome:='rejected';reason:='amount_mismatch';
  elsif p_payer_openid_hash is not null and attempt.payer_openid_hash<>p_payer_openid_hash
    then outcome:='rejected';reason:='payer_mismatch';
  elsif p_trade_state='SUCCESS' and p_payer_openid_hash is null
    then outcome:='rejected';reason:='payer_evidence_missing';
  elsif p_trade_state='SUCCESS' and(length(trim(coalesce(p_transaction_id,'')))=0
      or p_success_time is null)
    then outcome:='rejected';reason:='success_evidence_missing';
  end if;
  if outcome<>'rejected' and p_source='query' then
    update public.wechat_payment_attempts set last_query_at=now(),updated_at=now()
    where id=attempt.id;
  end if;
  if outcome<>'rejected' and p_trade_state='SUCCESS' then
    perform pg_advisory_xact_lock(hashtextextended(
      'wechat-payment-transaction:'||p_transaction_id,0));
    if exists(select 1 from public.wechat_payment_attempts other
      where other.transaction_id=p_transaction_id and other.id<>attempt.id)
    then outcome:='rejected';reason:='transaction_id_conflict';
    elsif payment.status='refunded' then
      if attempt.status<>'succeeded'
        or attempt.transaction_id is distinct from p_transaction_id
        or payment.provider_trade_no is distinct from p_transaction_id
      then raise exception 'WECHAT_REFUNDED_PAYMENT_EVIDENCE_MISMATCH'; end if;
      outcome:='recorded';reason:='payment_already_refunded';
    elsif payment.status='succeeded' then
      if payment.provider_trade_no is distinct from p_transaction_id
        or attempt.transaction_id is distinct from p_transaction_id
      then outcome:='rejected';reason:='transaction_id_mismatch';
      else outcome:='recorded';reason:='payment_already_succeeded'; end if;
    else
      update public.wechat_payment_attempts set status='succeeded',
        transaction_id=p_transaction_id,provider_trade_state='SUCCESS',last_error_code=null,
        completed_at=coalesce(completed_at,p_success_time),updated_at=now() where id=attempt.id;
      update public.payments set status='succeeded',provider_trade_no=p_transaction_id,
        completed_at=coalesce(completed_at,p_success_time) where id=payment.id;
      next_paid:=order_row.paid_cents+payment.amount_cents;
      if next_paid<=order_row.payable_cents and order_row.status='pending_payment' then
        update public.orders set paid_cents=next_paid,
          paid_at=case when next_paid=payable_cents then coalesce(paid_at,p_success_time) else paid_at end,
          status=case when next_paid=payable_cents then 'paid' else status end,updated_at=now()
        where id=order_row.id;
        if next_paid=order_row.payable_cents then
          begin
            perform inventory.commit_payment(order_row.tenant_id,order_row.mall_id,
              order_row.id,'payment:wechat:'||payment.id);
            update public.sub_orders set status='paid',updated_at=now()
            where tenant_id=order_row.tenant_id and mall_id=order_row.mall_id
              and parent_order_id=order_row.id;
            outcome:='applied';applied:=true;topic:='order.payment_succeeded';
          exception when others then
            get stacked diagnostics inventory_error=message_text;
            update public.orders set status='refund_pending',updated_at=now()
              where id=order_row.id;
            outcome:='reconciliation_required';applied:=true;
            topic:='order.payment_reconciliation_required';
            reason:=case when inventory_error like '%INVENTORY_PAYMENT_RESERVATION_MISSING%'
              then 'inventory_reservation_missing'
              when inventory_error like '%INVENTORY_PAYMENT_RESERVATION_EXPIRED%'
              then 'inventory_reservation_expired'
              when inventory_error like '%INVENTORY_PAYMENT_RESERVATION_TERMINAL%'
              then 'inventory_reservation_terminal' else 'inventory_commit_conflict' end;
          end;
        else
          update public.orders set status='refund_pending',updated_at=now()
            where id=order_row.id;
          outcome:='reconciliation_required';reason:='partial_payment_not_supported';
          applied:=true;topic:='order.payment_reconciliation_required';
        end if;
      else
        update public.orders set paid_cents=least(payable_cents,next_paid),
          paid_at=case when next_paid>=payable_cents
            then coalesce(paid_at,p_success_time) else paid_at end,
          status='refund_pending',updated_at=now() where id=order_row.id;
        outcome:='reconciliation_required';reason:='order_state_or_amount_conflict';
        applied:=true;topic:='order.payment_reconciliation_required';
      end if;
    end if;
  elsif outcome<>'rejected' and p_trade_state in('CLOSED','REVOKED','PAYERROR') then
    if payment.status in('succeeded','refunded') then
      outcome:='recorded';reason:=case when payment.status='refunded'
        then 'payment_already_refunded' else 'payment_already_succeeded' end;
    elsif payment.status in('closed','failed') and attempt.status in('closed','failed') then
      outcome:='recorded';reason:='payment_terminal_already_applied';
    else
      update public.wechat_payment_attempts set status=case when p_trade_state in('CLOSED','REVOKED')
        then 'closed' else 'failed' end,provider_trade_state=p_trade_state,
        last_error_code=lower(p_trade_state),updated_at=now() where id=attempt.id;
      update public.payments set status=case when p_trade_state in('CLOSED','REVOKED')
        then 'closed' else 'failed' end where id=payment.id;
      if order_row.status='pending_payment' and order_row.paid_cents=0 then
        update public.orders set status='cancelled',updated_at=now() where id=order_row.id;
        if exists(select 1 from inventory.reservations r where r.tenant_id=order_row.tenant_id
          and r.mall_id=order_row.mall_id and r.order_id=order_row.id and r.state='active')
        then perform inventory.release(order_row.tenant_id,order_row.mall_id,order_row.id,
          'payment_failed','payment:wechat:terminal:'||payment.id); end if;
        update public.sub_orders set status='cancelled',updated_at=now()
        where tenant_id=order_row.tenant_id and mall_id=order_row.mall_id
          and parent_order_id=order_row.id;
      elsif order_row.status='pending_payment' then reason:='order_partial_payment_conflict'; end if;
      outcome:='applied';applied:=true;topic:='order.payment_terminal';
    end if;
  elsif outcome<>'rejected' and p_trade_state in('USERPAYING','NOTPAY') then
    if payment.status not in('succeeded','refunded') then
      update public.wechat_payment_attempts set status=case when p_trade_state='USERPAYING'
        then 'processing' else status end,provider_trade_state=p_trade_state,updated_at=now()
      where id=attempt.id;
      update public.payments set status=case when p_trade_state='USERPAYING'
        then 'processing' else status end where id=payment.id;
    end if; outcome:='recorded';
  elsif outcome<>'rejected' then outcome:='recorded';reason:='refund_requires_reconciliation';
  end if;
  insert into public.wechat_payment_observations(provider_event_key,source,
    provider_event_id,event_type,resource_type,attempt_id,app_id,mch_id,out_trade_no,
    transaction_id,trade_state,success_time,amount_total,payer_openid_hash,
    evidence_json,evidence_digest,request_id,outcome,reason_code)
  values(p_provider_event_key,p_source,p_provider_event_id,p_event_type,p_resource_type,
    attempt.id,p_app_id,p_mch_id,p_out_trade_no,nullif(p_transaction_id,''),p_trade_state,
    p_success_time,p_amount_total,p_payer_openid_hash,coalesce(p_evidence_json,'{}'),
    evidence_digest,p_request_id,outcome,reason);
  if topic is not null then
    insert into public.payment_outbox(event_key,topic,order_id,payment_id,attempt_id,payload_json)
    values(p_provider_event_key||':'||topic,topic,attempt.order_id,attempt.payment_id,
      attempt.id,jsonb_build_object('orderId',attempt.order_id,'paymentId',attempt.payment_id,
        'attemptId',attempt.id,'outTradeNo',attempt.out_trade_no,
        'transactionId',p_transaction_id,'tradeState',p_trade_state,
        'amountCents',p_amount_total,'outcome',outcome,'reasonCode',reason));
  end if;
  if applied then insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,
    actor_type,action,resource_type,resource_id,request_id,after_json,created_at)
    values(gen_random_uuid()::text,order_row.tenant_id,order_row.enterprise_id,
      order_row.mall_id,'system','payment.wechat_observation_applied','payment',
      attempt.payment_id,p_request_id,jsonb_build_object('source',p_source,
        'tradeState',p_trade_state,'outcome',outcome,'reasonCode',reason,
        'providerEventId',p_provider_event_id),now()); end if;
  return jsonb_build_object('applied',applied,'duplicate',false,
    'orderId',attempt.order_id,'paymentId',attempt.payment_id,
    'outcome',outcome,'reasonCode',reason);
end $$;

revoke all on function public.api_apply_wechat_payment_observation(
  text,text,text,text,text,text,text,text,text,text,timestamptz,bigint,text,jsonb,text)
from public,anon,authenticated,service_role;

do $$ begin
  if to_regclass('public.wechat_payment_outbox') is not null
    or to_regprocedure('public.api_claim_wechat_payment_outbox(text,integer,integer)') is not null
    or to_regprocedure('public.api_start_wechat_payment_effects(uuid,text,uuid)') is not null
    or to_regprocedure('public.api_finish_wechat_payment_outbox(uuid,text,uuid,boolean,text)') is not null
    or to_regprocedure('public.apply_wechat_payment_observation_core(text,text,text,text,text,text,text,text,text,text,timestamptz,bigint,text,jsonb,text)') is not null
    or exists(select 1 from pg_proc procedure join pg_namespace namespace
      on namespace.oid=procedure.pronamespace where namespace.nspname='public'
        and procedure.prosrc like '%public.wechat_payment_outbox%')
  then raise exception 'PAYMENT_LEGACY_RUNTIME_REMAINS';end if;
end $$;
