begin;

do $$
declare
  suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  order_id text := 'contract-payment-outbox-order-' || suffix;
  payment_id text := 'contract-payment-outbox-payment-' || suffix;
  sub_order_id text := 'contract-payment-outbox-sub-' || suffix;
  identity_id uuid := gen_random_uuid();
  attempt_id uuid := gen_random_uuid();
  first_event_id uuid := gen_random_uuid();
  second_event_id uuid := gen_random_uuid();
  malformed_event_id uuid := gen_random_uuid();
  first_claim record;
  reclaimed record;
  malformed_claim record;
  start_result jsonb;
  finish_result jsonb;
  error_message text;
begin
  update public.payment_outbox
  set status = 'dead_letter', dead_lettered_at = now(), locked_at = null,
      locked_by = null, lease_token = null, lease_expires_at = null
  where status in ('pending', 'processing');
  insert into public.orders (
    id, order_no, tenant_id, enterprise_id, mall_id, user_id, status,
    goods_amount_cents, discount_cents, payable_cents, paid_cents,
    recipient_snapshot_json, paid_at
  ) values (
    order_id, 'CONTRACT-PAYMENT-OUTBOX-' || suffix, 'tenant-smart-wing',
    'enterprise-demo', 'mall-demo', 'user-test-storefront', 'paid',
    1000, 0, 1000, 1000, '{}'::jsonb, now()
  );
  insert into public.sub_orders (
    id, sub_order_no, tenant_id, mall_id, parent_order_id, supplier_id,
    status, amount_cents
  ) values (
    sub_order_id, 'CONTRACT-PAYMENT-SUB-' || suffix, 'tenant-smart-wing',
    'mall-demo', order_id, 'supplier-central', 'pending_payment', 1000
  );
  insert into public.payments (
    id, payment_no, tenant_id, mall_id, user_id, order_id, channel, status,
    amount_cents, provider_trade_no, idempotency_key, completed_at
  ) values (
    payment_id, 'CONTRACT-PAYMENT-' || suffix, 'tenant-smart-wing',
    'mall-demo', 'user-test-storefront', order_id, 'wechat', 'succeeded',
    1000, 'CONTRACT-TRADE-' || suffix, 'contract-payment-' || suffix, now()
  );
  insert into public.member_wechat_identities (id, app_id, open_id)
  values (identity_id, 'wxcontract' || suffix, 'openid-contract-' || suffix);
  insert into public.wechat_payment_attempts (
    id, payment_id, order_id, identity_id, created_by_membership_id,
    app_id, mch_id, out_trade_no, description, amount_total,
    payer_openid_hash, status, transaction_id, provider_trade_state, completed_at
  ) values (
    attempt_id, payment_id, order_id, identity_id, 'membership-test-storefront',
    'wxcontract' || suffix, '190000contract', 'OUTBOX' || upper(suffix),
    'Contract payment', 1000, repeat('a', 64), 'succeeded',
    'CONTRACT-TRADE-' || suffix, 'SUCCESS', now()
  );
  insert into public.wechat_payment_observations(
    provider_event_key,source,provider_event_id,event_type,resource_type,
    attempt_id,app_id,mch_id,out_trade_no,transaction_id,trade_state,
    success_time,amount_total,payer_openid_hash,evidence_json,evidence_digest,
    request_id,outcome,reason_code
  ) values
    ('contract-payment-observation-1:'||suffix,'query','observation-1-'||suffix,
      'QUERY.TRANSACTION','transaction',attempt_id,'wxcontract'||suffix,
      '190000contract','OUTBOX'||upper(suffix),'CONTRACT-TRADE-'||suffix,
      'SUCCESS',now(),1000,repeat('a',64),'{}',repeat('b',64),
      'observation-request-1-'||suffix,'applied',null),
    ('contract-payment-observation-2:'||suffix,'query','observation-2-'||suffix,
      'QUERY.TRANSACTION','transaction',attempt_id,'wxcontract'||suffix,
      '190000contract','OUTBOX'||upper(suffix),'CONTRACT-TRADE-'||suffix,
      'SUCCESS',now(),1000,repeat('a',64),'{}',repeat('c',64),
      'observation-request-2-'||suffix,'applied',null);
  insert into public.payment_outbox (
    id, event_key, topic, order_id, payment_id, attempt_id, payload_json
  ) values
    (first_event_id, 'contract-payment-observation-1:' || suffix ||
       ':order.payment_succeeded',
     'order.payment_succeeded', order_id, payment_id, attempt_id,
     jsonb_build_object('orderId', order_id, 'paymentId', payment_id,
       'attemptId', attempt_id, 'amountCents', 1000, 'tradeState', 'SUCCESS',
       'outcome', 'applied', 'transactionId', 'CONTRACT-TRADE-' || suffix)),
    (second_event_id, 'contract-payment-observation-2:' || suffix ||
       ':order.payment_succeeded',
     'order.payment_succeeded', order_id, payment_id, attempt_id,
     jsonb_build_object('orderId', order_id, 'paymentId', payment_id,
       'attemptId', attempt_id, 'amountCents', 1000, 'tradeState', 'SUCCESS',
       'outcome', 'applied', 'transactionId', 'CONTRACT-TRADE-' || suffix));

  select * into strict first_claim
  from public.api_claim_payment_outbox('wechat','contract-worker-1',10,30);
  if first_claim.id <> first_event_id or first_claim.aggregate_version <> 1
     or first_claim.delivery_attempts <> 1 or first_claim.lease_token is null
  then raise exception 'CONTRACT_PAYMENT_OUTBOX_FIRST_CLAIM_INVALID'; end if;
  if exists (select 1 from public.api_claim_payment_outbox('wechat','contract-worker-other',10,30))
  then raise exception 'CONTRACT_PAYMENT_OUTBOX_AGGREGATE_ORDER_BROKEN'; end if;

  start_result := public.api_start_payment_effects(
    'wechat',first_event_id,'contract-worker-1',first_claim.lease_token
  );
  if start_result <> jsonb_build_object(
       'accepted', true, 'duplicate', false, 'effectCount', 3, 'newEffectCount', 3
     )
     or (select count(*) from public.payment_event_effects effect
         where effect.outbox_id = first_event_id and effect.status = 'pending') <> 3
  then raise exception 'CONTRACT_PAYMENT_OUTBOX_EFFECT_FANOUT_INVALID'; end if;
  start_result := public.api_start_payment_effects(
    'wechat',first_event_id,'contract-worker-1',first_claim.lease_token
  );
  if start_result->>'duplicate' <> 'true'
     or (select count(*) from public.payment_event_inbox inbox
         where inbox.outbox_id = first_event_id) <> 1
     or (select count(*) from public.payment_event_effects effect
         where effect.outbox_id = first_event_id) <> 3
  then raise exception 'CONTRACT_PAYMENT_OUTBOX_INBOX_NOT_IDEMPOTENT'; end if;

  finish_result := public.api_finish_payment_outbox(
    'wechat',first_event_id,'contract-worker-1',gen_random_uuid(),true,null
  );
  if finish_result->>'status' <> 'lease_lost'
  then raise exception 'CONTRACT_PAYMENT_OUTBOX_STALE_ACK_ACCEPTED'; end if;
  finish_result := public.api_finish_payment_outbox(
    'wechat',first_event_id,'contract-worker-1',first_claim.lease_token,true,null
  );
  if finish_result->>'status' <> 'delivered'
     or (select status from public.payment_outbox where id = first_event_id) <> 'delivered'
  then raise exception 'CONTRACT_PAYMENT_OUTBOX_DELIVERY_NOT_COMPLETED'; end if;

  select * into strict first_claim
  from public.api_claim_payment_outbox('wechat','contract-worker-old',10,15);
  if first_claim.id <> second_event_id then
    raise exception 'CONTRACT_PAYMENT_OUTBOX_SECOND_CLAIM_INVALID';
  end if;
  update public.payment_outbox
  set lease_expires_at = now() - interval '1 second'
  where id = second_event_id;
  select * into strict reclaimed
  from public.api_claim_payment_outbox('wechat','contract-worker-new',10,30);
  if reclaimed.id <> second_event_id or reclaimed.lease_token = first_claim.lease_token
     or reclaimed.delivery_attempts <> 2
  then raise exception 'CONTRACT_PAYMENT_OUTBOX_RECLAIM_INVALID'; end if;
  finish_result := public.api_finish_payment_outbox(
    'wechat',second_event_id,'contract-worker-old',first_claim.lease_token,true,null
  );
  if finish_result->>'status' <> 'lease_lost'
  then raise exception 'CONTRACT_PAYMENT_OUTBOX_RECLAIMED_ACK_ACCEPTED'; end if;
  finish_result := public.api_finish_payment_outbox(
    'wechat',second_event_id,'contract-worker-new',reclaimed.lease_token,false,
    'TRANSIENT_DEPENDENCY'
  );
  if finish_result->>'status' <> 'pending'
     or (select available_at <= now() from public.payment_outbox
         where id = second_event_id)
  then raise exception 'CONTRACT_PAYMENT_OUTBOX_RETRY_INVALID'; end if;

  update public.payment_outbox
  set delivery_attempts = 11, available_at = now()
  where id = second_event_id;
  select * into strict reclaimed
  from public.api_claim_payment_outbox('wechat','contract-worker-dead',10,30);
  perform public.api_start_payment_effects(
    'wechat',second_event_id,'contract-worker-dead',reclaimed.lease_token
  );
  finish_result := public.api_finish_payment_outbox(
    'wechat',second_event_id,'contract-worker-dead',reclaimed.lease_token,false,
    'PERMANENT_FAILURE'
  );
  if finish_result->>'status' <> 'dead_letter'
     or not exists (
       select 1 from public.audit_logs audit
       where audit.request_id = 'payment-outbox-deadletter:' || second_event_id
         and audit.action = 'payment.outbox.dead_lettered'
     )
  then raise exception 'CONTRACT_PAYMENT_OUTBOX_DEADLETTER_INVALID'; end if;
  insert into public.payment_outbox (
    id, event_key, topic, order_id, payment_id, attempt_id, payload_json
  ) values (
    malformed_event_id, 'contract-payment-event-malformed:' || suffix,
    'order.payment_succeeded', order_id, payment_id, attempt_id,
    jsonb_build_object('orderId', 'attacker-order', 'paymentId', payment_id,
      'attemptId', attempt_id, 'amountCents', 1000, 'tradeState', 'SUCCESS',
      'outcome', 'applied', 'transactionId', 'CONTRACT-TRADE-' || suffix)
  );
  if exists(select 1 from public.api_claim_payment_outbox(
    'wechat','contract-worker-blocked',10,30))
  then raise exception 'CONTRACT_PAYMENT_OUTBOX_DEADLETTER_DID_NOT_BLOCK'; end if;
  update public.payment_outbox set status='ignored',ignored_at=now(),
    dead_lettered_at=null,last_error_code=null where id=second_event_id;
  select * into strict malformed_claim
  from public.api_claim_payment_outbox('wechat','contract-worker-malformed',10,30);
  begin
    perform public.api_start_payment_effects(
      'wechat',malformed_event_id,'contract-worker-malformed',malformed_claim.lease_token
    );
    raise exception 'CONTRACT_PAYMENT_OUTBOX_MALFORMED_EVENT_ACCEPTED';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%PAYMENT_OUTBOX_EVIDENCE_MISMATCH%' then raise; end if;
  end;
  if exists (select 1 from public.payment_event_inbox where outbox_id = malformed_event_id)
  then raise exception 'CONTRACT_PAYMENT_OUTBOX_MALFORMED_INBOX_WRITTEN'; end if;
  begin
    perform public.api_finish_payment_outbox(
      'wechat',malformed_event_id,'contract-worker-malformed',malformed_claim.lease_token,
      true, null
    );
    raise exception 'CONTRACT_PAYMENT_OUTBOX_COMPLETED_WITHOUT_EFFECTS';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%PAYMENT_OUTBOX_EFFECTS_NOT_STARTED%' then raise; end if;
  end;

  if to_regprocedure('public.api_claim_wechat_payment_outbox(text,integer)') is not null
     or to_regprocedure('public.api_claim_wechat_payment_outbox(text,integer,integer)') is not null
     or to_regprocedure('public.api_start_wechat_payment_effects(uuid,text,uuid)') is not null
     or to_regprocedure('public.api_finish_wechat_payment_outbox(uuid,text,uuid,boolean,text)') is not null
     or to_regclass('public.wechat_payment_outbox') is not null
     or to_regprocedure('public.api_complete_wechat_payment_outbox(uuid,text,boolean,text)') is not null
     or has_function_privilege(
       'authenticated',
       'public.api_claim_payment_outbox(text,text,integer,integer)', 'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.api_start_payment_effects(text,uuid,text,uuid)', 'execute'
     )
     or has_table_privilege('authenticated', 'public.payment_event_inbox', 'select')
     or has_table_privilege('authenticated', 'public.payment_event_effects', 'select')
  then raise exception 'CONTRACT_PAYMENT_OUTBOX_ACL_INVALID'; end if;
end;
$$;

rollback;
