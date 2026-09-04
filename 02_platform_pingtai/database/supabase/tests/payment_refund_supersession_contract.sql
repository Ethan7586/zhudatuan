begin;
do $$
declare suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  internal_order text:='contract-superseded-internal-'||suffix;
  wechat_order text:='contract-superseded-wechat-'||suffix;
  internal_payment text:='contract-superseded-ip-'||suffix;
  wechat_payment text:='contract-superseded-wp-'||suffix;
  internal_intent uuid:=gen_random_uuid();wechat_attempt uuid:=gen_random_uuid();
  internal_event uuid:=gen_random_uuid();wechat_event uuid:=gen_random_uuid();
  internal_inbox uuid:=gen_random_uuid();wechat_inbox uuid:=gen_random_uuid();
  internal_accounting uuid:=gen_random_uuid();internal_fulfillment uuid:=gen_random_uuid();
  internal_notification uuid:=gen_random_uuid();wechat_accounting uuid:=gen_random_uuid();
  wechat_fulfillment uuid:=gen_random_uuid();wechat_notification uuid:=gen_random_uuid();
  identity_id uuid:=gen_random_uuid();account_id text;account_balance bigint;
  claim record;result jsonb;processed integer:=0;
begin
  update public.payment_event_effects set status='dead_letter',dead_lettered_at=now(),
    locked_by=null,locked_at=null,lease_token=null,lease_expires_at=null
  where status in('pending','processing');
  update public.payment_outbox set status='dead_letter',dead_lettered_at=now(),
    locked_by=null,locked_at=null,lease_token=null,lease_expires_at=null
  where status in('pending','processing');
  select account.id,account.balance_cents into strict account_id,account_balance
  from public.welfare_accounts account where account.tenant_id='tenant-smart-wing'
    and account.mall_id='mall-demo' and account.user_id='user-test-storefront'
    and account.account_type='welfare';
  insert into public.orders(id,order_no,tenant_id,enterprise_id,mall_id,user_id,
    status,goods_amount_cents,discount_cents,payable_cents,paid_cents,
    recipient_snapshot_json,paid_at)
  values
    (internal_order,'CONTRACT-SUPERSEDED-I-'||suffix,'tenant-smart-wing',
      'enterprise-demo','mall-demo','user-test-storefront','paid',100,0,100,100,'{}',now()),
    (wechat_order,'CONTRACT-SUPERSEDED-W-'||suffix,'tenant-smart-wing',
      'enterprise-demo','mall-demo','user-test-storefront','paid',100,0,100,100,'{}',now());
  insert into public.payment_intents(id,tenant_id,mall_id,user_id,order_id,source,
    currency,amount_cents,status,idempotency_key,completed_at)
  values(internal_intent,'tenant-smart-wing','mall-demo','user-test-storefront',
    internal_order,'internal','CNY',100,'succeeded','superseded-intent-'||suffix,now());
  insert into public.payments(id,payment_no,tenant_id,mall_id,user_id,order_id,
    channel,status,amount_cents,provider_trade_no,idempotency_key,completed_at,
    payment_intent_id)
  values
    (internal_payment,'CONTRACT-SUPERSEDED-IP-'||suffix,'tenant-smart-wing','mall-demo',
      'user-test-storefront',internal_order,'welfare','succeeded',100,null,
      'superseded-pay-'||suffix||':welfare',now(),internal_intent),
    (wechat_payment,'CONTRACT-SUPERSEDED-WP-'||suffix,'tenant-smart-wing','mall-demo',
      'user-test-storefront',wechat_order,'wechat','succeeded',100,
      'CONTRACT-SUPERSEDED-TRADE-'||suffix,'superseded-wechat-'||suffix,now(),null);
  insert into public.payment_allocations(id,tenant_id,mall_id,payment_id,order_id,
    account_id,channel,amount_cents)
  values('contract-superseded-allocation-'||suffix,'tenant-smart-wing','mall-demo',
    internal_payment,internal_order,account_id,'welfare',100);
  insert into public.account_ledgers(id,tenant_id,mall_id,account_id,user_id,
    direction,amount_cents,balance_after_cents,business_type,business_id,
    idempotency_key)
  values('contract-superseded-ledger-'||suffix,'tenant-smart-wing','mall-demo',
    account_id,'user-test-storefront','debit',100,account_balance,'order_payment',
    internal_order,'superseded-pay-'||suffix||':welfare');
  insert into public.member_wechat_identities(id,app_id,open_id)
  values(identity_id,'wxsup'||suffix,'openid-superseded-'||suffix);
  insert into public.wechat_payment_attempts(id,payment_id,order_id,identity_id,
    created_by_membership_id,app_id,mch_id,out_trade_no,description,amount_total,
    payer_openid_hash,status,transaction_id,provider_trade_state,completed_at)
  values(wechat_attempt,wechat_payment,wechat_order,identity_id,
    'membership-test-storefront','wxsup'||suffix,'mchsup'||suffix,
    'SUPER'||upper(suffix),'Contract',100,repeat('a',64),'succeeded',
    'CONTRACT-SUPERSEDED-TRADE-'||suffix,'SUCCESS',now());
  insert into public.wechat_payment_observations(provider_event_key,source,
    provider_event_id,event_type,resource_type,attempt_id,app_id,mch_id,
    out_trade_no,transaction_id,trade_state,success_time,amount_total,
    payer_openid_hash,evidence_json,evidence_digest,request_id,outcome)
  values('contract-superseded-observation-'||suffix,'query','superseded-'||suffix,
    'QUERY.TRANSACTION','transaction',wechat_attempt,'wxsup'||suffix,
    'mchsup'||suffix,'SUPER'||upper(suffix),'CONTRACT-SUPERSEDED-TRADE-'||suffix,
    'SUCCESS',now(),100,repeat('a',64),'{}',repeat('b',64),
    'contract-superseded-observation-'||suffix,'applied');
  insert into public.payment_outbox(id,event_key,source,topic,order_id,payment_id,
    payment_intent_id,attempt_id,payload_json,status,delivered_at)
  values
    (internal_event,'contract-superseded-internal-event-'||suffix,'internal',
      'order.payment_succeeded',internal_order,null,internal_intent,null,
      jsonb_build_object('orderId',internal_order,'paymentIntentId',internal_intent,
        'amountCents',100,'currency','CNY','outcome','applied'),'delivered',now()),
    (wechat_event,'contract-superseded-observation-'||suffix||':order.payment_succeeded',
      'wechat','order.payment_succeeded',wechat_order,wechat_payment,null,
      wechat_attempt,jsonb_build_object('orderId',wechat_order,'paymentId',wechat_payment,
        'attemptId',wechat_attempt,'amountCents',100,'tradeState','SUCCESS',
        'outcome','applied','transactionId','CONTRACT-SUPERSEDED-TRADE-'||suffix),
      'delivered',now());
  insert into public.payment_event_inbox(id,outbox_id,event_key,tenant_id,
    aggregate_id,aggregate_version,event_type,payload_digest,consumer)
  select internal_inbox,outbox.id,outbox.event_key,outbox.tenant_id,
    outbox.aggregate_id,outbox.aggregate_version,outbox.event_type,repeat('c',64),'contract'
  from public.payment_outbox outbox where outbox.id=internal_event
  union all
  select wechat_inbox,outbox.id,outbox.event_key,outbox.tenant_id,
    outbox.aggregate_id,outbox.aggregate_version,outbox.event_type,repeat('d',64),'contract'
  from public.payment_outbox outbox where outbox.id=wechat_event;
  insert into public.payment_event_effects(id,inbox_id,outbox_id,tenant_id,
    order_id,payment_id,payment_intent_id,effect_type,payload_json)
  values
    (internal_accounting,internal_inbox,internal_event,'tenant-smart-wing',internal_order,
      null,internal_intent,'accounting','{}'),
    (internal_fulfillment,internal_inbox,internal_event,'tenant-smart-wing',internal_order,
      null,internal_intent,'fulfillment','{}'),
    (internal_notification,internal_inbox,internal_event,'tenant-smart-wing',internal_order,
      null,internal_intent,'notification','{}'),
    (wechat_accounting,wechat_inbox,wechat_event,'tenant-smart-wing',wechat_order,
      wechat_payment,null,'accounting','{}'),
    (wechat_fulfillment,wechat_inbox,wechat_event,'tenant-smart-wing',wechat_order,
      wechat_payment,null,'fulfillment','{}'),
    (wechat_notification,wechat_inbox,wechat_event,'tenant-smart-wing',wechat_order,
      wechat_payment,null,'notification','{}');
  for claim in select * from public.api_claim_payment_event_effects(
    'contract-superseded-accounting',10,30) loop
    result:=public.api_execute_payment_event_effect(claim.id,
      'contract-superseded-accounting',claim.lease_token);
    if claim.effect_type<>'accounting' or result->>'resultCode'<>'journal_posted'
    then raise exception 'CONTRACT_SUPERSEDED_ACCOUNTING_NOT_FIRST:%',result;end if;
    processed:=processed+1;
  end loop;
  if processed<>2 then raise exception 'CONTRACT_SUPERSEDED_ACCOUNTING_COUNT';end if;
  update public.orders set status='refunded'
  where id in(internal_order,wechat_order);
  update public.payments set status='refunded'
  where id in(internal_payment,wechat_payment);
  insert into public.refunds(id,refund_no,tenant_id,mall_id,order_id,payment_id,
    amount_cents,status,reason,idempotency_key,completed_at)
  values
    ('contract-superseded-ir-'||suffix,'CONTRACT-SUPERSEDED-IR-'||suffix,
      'tenant-smart-wing','mall-demo',internal_order,internal_payment,100,
      'succeeded','全额退款','superseded-ir-'||suffix,now()),
    ('contract-superseded-wr-'||suffix,'CONTRACT-SUPERSEDED-WR-'||suffix,
      'tenant-smart-wing','mall-demo',wechat_order,wechat_payment,100,
      'succeeded','全额退款','superseded-wr-'||suffix,now());
  if not public.payment_capture_effect_superseded(internal_fulfillment)
    or not public.payment_capture_effect_superseded(internal_notification)
    or not public.payment_capture_effect_superseded(wechat_fulfillment)
    or not public.payment_capture_effect_superseded(wechat_notification)
  then raise exception 'CONTRACT_CAPTURE_SUPERSESSION_FACTS_REJECTED';end if;
  for processed in 1..3 loop
    for claim in select * from public.api_claim_payment_event_effects(
      'contract-superseded-effects',10,30) loop
      result:=public.api_execute_payment_event_effect(claim.id,
        'contract-superseded-effects',claim.lease_token);
      if result->>'status'<>'succeeded'
        or(claim.effect_type='fulfillment' and result->>'resultCode'<>
          'fulfillment_superseded_refunded')
        or(claim.effect_type='notification' and result->>'resultCode'<>
          'notification_superseded_refunded')
      then raise exception 'CONTRACT_SUPERSEDED_EFFECT_FAILED:%',result;end if;
    end loop;
  end loop;
  if exists(select 1 from public.payment_event_effects effect
      where effect.id in(internal_fulfillment,internal_notification,
        wechat_fulfillment,wechat_notification) and effect.status<>'succeeded')
    or exists(select 1 from public.fulfillment_orders fulfillment
      where fulfillment.order_id in(internal_order,wechat_order))
    or exists(select 1 from public.notification_dispatches dispatch
      where dispatch.source_effect_id in(internal_notification,wechat_notification))
    or exists(select 1 from public.payment_operations_alerts alert
      where alert.resource_id in(internal_fulfillment::text,internal_notification::text,
        wechat_fulfillment::text,wechat_notification::text))
    or has_function_privilege('service_role',
      'public.payment_capture_effect_superseded(uuid)','execute')
  then raise exception 'CONTRACT_CAPTURE_SUPERSESSION_SIDE_EFFECTED';end if;
end $$;
rollback;
