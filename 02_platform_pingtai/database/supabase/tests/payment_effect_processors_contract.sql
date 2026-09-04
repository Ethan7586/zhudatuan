begin;

do $$
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  success_order text:='contract-effect-success-'||suffix;
  terminal_order text:='contract-effect-terminal-'||suffix;
  recon_order text:='contract-effect-recon-'||suffix;
  success_payment text:='contract-effect-pay-success-'||suffix;
  terminal_payment text:='contract-effect-pay-terminal-'||suffix;
  recon_payment text:='contract-effect-pay-recon-'||suffix;
  success_attempt uuid:=gen_random_uuid(); terminal_attempt uuid:=gen_random_uuid(); recon_attempt uuid:=gen_random_uuid();
  success_event uuid:=gen_random_uuid(); terminal_event uuid:=gen_random_uuid(); recon_event uuid:=gen_random_uuid();
  identity_id uuid:=gen_random_uuid(); stock_id text:='contract-effect-stock-'||suffix;
  location_id text:='contract-effect-location-'||suffix; claim record; pass integer;
  start_result jsonb; finish_result jsonb; execute_result jsonb; error_message text;
  success_accounting uuid; success_fulfillment uuid; success_notification uuid; terminal_notification uuid;
  terminal_bad_effect uuid:=gen_random_uuid(); debit bigint; credit bigint;
  blocked_event uuid:=gen_random_uuid(); blocked_notification uuid;
  retired_effect uuid:=gen_random_uuid();
begin
  update public.payment_event_effects set status='dead_letter',dead_lettered_at=now(),locked_by=null,
    locked_at=null,lease_token=null,lease_expires_at=null where status in ('pending','processing');
  update public.payment_outbox set status='dead_letter',dead_lettered_at=now(),locked_by=null,
    locked_at=null,lease_token=null,lease_expires_at=null where status in ('pending','processing');
  insert into public.orders(id,order_no,tenant_id,enterprise_id,mall_id,user_id,status,
    goods_amount_cents,discount_cents,payable_cents,paid_cents,recipient_snapshot_json,paid_at)
  values
    (success_order,'CONTRACT-EFFECT-S-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',
      'pending_payment',1000,0,1000,0,'{}',null),
    (terminal_order,'CONTRACT-EFFECT-T-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',
      'cancelled',1000,0,1000,0,'{}',null),
    (recon_order,'CONTRACT-EFFECT-R-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',
      'refund_pending',1000,0,1000,1000,'{}',now());
  insert into public.sub_orders(id,sub_order_no,tenant_id,mall_id,parent_order_id,supplier_id,status,amount_cents)
  values('contract-effect-sub-'||suffix,'CONTRACT-EFFECT-SUB-'||suffix,'tenant-smart-wing','mall-demo',
    success_order,'supplier-central','pending_payment',1000);
  insert into public.order_items(id,tenant_id,mall_id,order_id,sub_order_id,product_id,sku_id,
    product_name_snapshot,specs_snapshot_json,unit_price_cents,quantity,line_amount_cents)
  values('contract-effect-item-'||suffix,'tenant-smart-wing','mall-demo',success_order,'contract-effect-sub-'||suffix,
    'product-rice','sku-rice-5kg','契约商品','{}',1000,1,1000);
  insert into inventory.stock_items(id,tenant_id,mall_id,sku_id,location_id,onhand,safety)
  values(stock_id,'tenant-smart-wing','mall-demo','sku-rice-5kg',location_id,10,0);
  perform inventory.reserve('tenant-smart-wing','mall-demo',success_order,
    jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg','locationId',location_id,'quantity',1)),
    'contract-effect-reserve-'||suffix,now()+interval '15 minutes');
  update public.orders set status='paid',paid_cents=payable_cents,paid_at=now() where id=success_order;
  update public.sub_orders set status='paid' where parent_order_id=success_order;
  perform inventory.commit_payment('tenant-smart-wing','mall-demo',success_order,'contract-effect-commit-'||suffix);

  insert into public.payments(id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,
    amount_cents,provider_trade_no,idempotency_key,completed_at)
  values
    (success_payment,'CONTRACT-EFFECT-PAY-S-'||suffix,'tenant-smart-wing','mall-demo','user-test-storefront',
      success_order,'wechat','succeeded',1000,'CONTRACT-EFFECT-TRADE-S-'||suffix,'effect-pay-s-'||suffix,now()),
    (terminal_payment,'CONTRACT-EFFECT-PAY-T-'||suffix,'tenant-smart-wing','mall-demo','user-test-storefront',
      terminal_order,'wechat','closed',1000,null,'effect-pay-t-'||suffix,now()),
    (recon_payment,'CONTRACT-EFFECT-PAY-R-'||suffix,'tenant-smart-wing','mall-demo','user-test-storefront',
      recon_order,'wechat','succeeded',1000,'CONTRACT-EFFECT-TRADE-R-'||suffix,'effect-pay-r-'||suffix,now());
  insert into public.member_wechat_identities(id,app_id,open_id)
  values(identity_id,'wxeffect'||suffix,'openid-effect-'||suffix);
  insert into public.wechat_payment_attempts(id,payment_id,order_id,identity_id,created_by_membership_id,
    app_id,mch_id,out_trade_no,description,amount_total,payer_openid_hash,status,transaction_id,provider_trade_state,completed_at)
  values
    (success_attempt,success_payment,success_order,identity_id,'membership-test-storefront','wxeffect'||suffix,
      'mcheffect'||suffix,'EFFECTS'||upper(suffix),'Contract',1000,repeat('a',64),'succeeded',
      'CONTRACT-EFFECT-TRADE-S-'||suffix,'SUCCESS',now()),
    (terminal_attempt,terminal_payment,terminal_order,identity_id,'membership-test-storefront','wxeffect'||suffix,
      'mcheffect'||suffix,'EFFECTT'||upper(suffix),'Contract',1000,repeat('a',64),'closed',null,'CLOSED',now()),
    (recon_attempt,recon_payment,recon_order,identity_id,'membership-test-storefront','wxeffect'||suffix,
      'mcheffect'||suffix,'EFFECTR'||upper(suffix),'Contract',1000,repeat('a',64),'succeeded',
      'CONTRACT-EFFECT-TRADE-R-'||suffix,'SUCCESS',now());
  insert into public.wechat_payment_observations(
    provider_event_key,source,provider_event_id,event_type,resource_type,
    attempt_id,app_id,mch_id,out_trade_no,transaction_id,trade_state,
    success_time,amount_total,payer_openid_hash,evidence_json,evidence_digest,
    request_id,outcome,reason_code)
  values
    ('contract-effect-success:'||suffix,'query','success-'||suffix,
      'QUERY.TRANSACTION','transaction',success_attempt,'wxeffect'||suffix,
      'mcheffect'||suffix,'EFFECTS'||upper(suffix),
      'CONTRACT-EFFECT-TRADE-S-'||suffix,'SUCCESS',now(),1000,
      repeat('a',64),'{}',repeat('b',64),'success-'||suffix,'applied',null),
    ('contract-effect-recon:'||suffix,'query','recon-'||suffix,
      'QUERY.TRANSACTION','transaction',recon_attempt,'wxeffect'||suffix,
      'mcheffect'||suffix,'EFFECTR'||upper(suffix),
      'CONTRACT-EFFECT-TRADE-R-'||suffix,'SUCCESS',now(),1000,
      repeat('a',64),'{}',repeat('c',64),'recon-'||suffix,
      'reconciliation_required','inventory_reservation_missing');
  insert into public.payment_outbox(id,event_key,topic,order_id,payment_id,attempt_id,payload_json)
  values
    (success_event,'contract-effect-success:'||suffix||':order.payment_succeeded','order.payment_succeeded',success_order,success_payment,success_attempt,
      jsonb_build_object('orderId',success_order,'paymentId',success_payment,'attemptId',success_attempt,'amountCents',1000,
        'tradeState','SUCCESS','outcome','applied','transactionId','CONTRACT-EFFECT-TRADE-S-'||suffix)),
    (terminal_event,'contract-effect-terminal:'||suffix,'order.payment_terminal',terminal_order,terminal_payment,terminal_attempt,
      jsonb_build_object('orderId',terminal_order,'paymentId',terminal_payment,'attemptId',terminal_attempt,'amountCents',1000,
        'tradeState','CLOSED','outcome','applied')),
    (recon_event,'contract-effect-recon:'||suffix||':order.payment_reconciliation_required','order.payment_reconciliation_required',recon_order,recon_payment,recon_attempt,
      jsonb_build_object('orderId',recon_order,'paymentId',recon_payment,'attemptId',recon_attempt,'amountCents',1000,
        'tradeState','SUCCESS','outcome','reconciliation_required','reasonCode','inventory_reservation_missing',
        'transactionId','CONTRACT-EFFECT-TRADE-R-'||suffix));

  for claim in select * from public.api_claim_payment_outbox('wechat','contract-effect-relay',10,30) loop
    start_result:=public.api_start_payment_effects('wechat',claim.id,'contract-effect-relay',claim.lease_token);
    finish_result:=public.api_finish_payment_outbox('wechat',claim.id,'contract-effect-relay',claim.lease_token,true,null);
    if start_result->>'accepted'<>'true' or finish_result->>'status'<>'delivered'
    then raise exception 'CONTRACT_EFFECT_RELAY_START_FAILED'; end if;
  end loop;
  if (select count(*) from public.payment_event_effects where outbox_id=success_event)<>3
    or exists(select 1 from public.payment_event_effects where outbox_id=terminal_event and effect_type<>'notification')
    or (select array_agg(effect_type order by effect_type) from public.payment_event_effects where outbox_id=recon_event)
       <>array['accounting','notification']
  then raise exception 'CONTRACT_EFFECT_TOPIC_FANOUT_INVALID'; end if;
  select id into strict success_accounting from public.payment_event_effects where outbox_id=success_event and effect_type='accounting';
  select id into strict success_fulfillment from public.payment_event_effects where outbox_id=success_event and effect_type='fulfillment';
  select id into strict success_notification from public.payment_event_effects where outbox_id=success_event and effect_type='notification';
  select id into strict terminal_notification from public.payment_event_effects where outbox_id=terminal_event and effect_type='notification';

  for pass in 1..4 loop
    for claim in select * from public.api_claim_payment_event_effects('contract-effect-worker',10,30) loop
      if claim.id=success_accounting then
        execute_result:=public.api_execute_payment_event_effect(claim.id,'contract-effect-worker',gen_random_uuid());
        if execute_result->>'status'<>'lease_lost' then raise exception 'CONTRACT_EFFECT_STALE_LEASE_ACCEPTED'; end if;
        update public.orders set status='refund_pending' where id=success_order;
        update public.payments set status='refunded' where id=success_payment;
      end if;
      execute_result:=public.api_execute_payment_event_effect(claim.id,'contract-effect-worker',claim.lease_token);
      if execute_result->>'status'<>'succeeded' then raise exception 'CONTRACT_EFFECT_EXECUTION_FAILED:%',execute_result; end if;
      if claim.id=success_accounting then
        update public.orders set status='paid' where id=success_order;
        update public.payments set status='succeeded' where id=success_payment;
      end if;
    end loop;
  end loop;
  if exists(select 1 from public.payment_event_effects where outbox_id in(success_event,terminal_event,recon_event) and status<>'succeeded')
  then raise exception 'CONTRACT_EFFECT_AGGREGATE_DRAIN_INCOMPLETE'; end if;
  select coalesce(sum(amount_cents) filter(where side='debit'),0),coalesce(sum(amount_cents) filter(where side='credit'),0)
    into debit,credit from public.finance_journal_entries where payment_id=success_payment;
  if debit<>1000 or credit<>1000 or debit<>credit
    or (select count(*) from public.finance_journals where payment_id=success_payment and status='posted')<>1
    or (select count(*) from public.finance_journal_entries where payment_id=success_payment)<>2
  then raise exception 'CONTRACT_EFFECT_JOURNAL_NOT_BALANCED'; end if;
  if (select count(*) from public.fulfillment_orders where payment_id=success_payment and status='queued')<>1
    or (select count(*) from public.fulfillment_order_items item join public.fulfillment_orders fulfillment
      on fulfillment.id=item.fulfillment_order_id where fulfillment.payment_id=success_payment)<>1
    or (select count(*) from public.notification_dispatches where payment_id=success_payment and status='pending'
      and sent_at is null and provider_reference is null)<>1
    or exists(select 1 from public.fulfillment_orders where payment_id in(terminal_payment,recon_payment))
    or (select count(*) from public.notification_dispatches where payment_id=terminal_payment and template_key='payment.closed' and status='pending')<>1
    or (select count(*) from public.notification_dispatches where payment_id=recon_payment and status='pending')<>2
  then raise exception 'CONTRACT_EFFECT_DURABLE_REQUESTS_INVALID'; end if;
  perform public.process_payment_accounting_effect(success_accounting);
  perform public.process_payment_fulfillment_effect(success_fulfillment);
  perform public.process_payment_notification_effect(success_notification);
  if (select count(*) from public.finance_journals where payment_id=success_payment)<>1
    or (select count(*) from public.fulfillment_orders where payment_id=success_payment)<>1
    or (select count(*) from public.notification_dispatches where payment_id=success_payment)<>1
  then raise exception 'CONTRACT_EFFECT_PROCESSOR_NOT_IDEMPOTENT'; end if;

  begin
    insert into public.payment_outbox(event_key,topic,order_id,payment_id,attempt_id,payload_json)
    values('contract-effect-unknown:'||suffix,'order.payment_unknown',terminal_order,terminal_payment,terminal_attempt,'{}');
    raise exception 'CONTRACT_EFFECT_UNKNOWN_TOPIC_ACCEPTED';
  exception when check_violation then null; end;
  insert into public.payment_outbox(id,event_key,topic,order_id,payment_id,attempt_id,payload_json)
  values(blocked_event,'contract-effect-blocked:'||suffix,'order.payment_terminal',terminal_order,terminal_payment,terminal_attempt,
    jsonb_build_object('orderId',terminal_order,'paymentId',terminal_payment,'attemptId',terminal_attempt,'amountCents',1000,
      'tradeState','CLOSED','outcome','applied'));
  select * into strict claim from public.api_claim_payment_outbox('wechat','contract-effect-blocked-relay',1,30);
  perform public.api_start_payment_effects('wechat',claim.id,'contract-effect-blocked-relay',claim.lease_token);
  perform public.api_finish_payment_outbox('wechat',claim.id,'contract-effect-blocked-relay',claim.lease_token,true,null);
  select id into strict blocked_notification from public.payment_event_effects where outbox_id=blocked_event and effect_type='notification';
  insert into public.payment_event_effects(id,inbox_id,outbox_id,tenant_id,order_id,payment_id,effect_type,payload_json,attempts)
  select terminal_bad_effect,inbox.id,blocked_event,'tenant-smart-wing',terminal_order,terminal_payment,'fulfillment','{}',11
  from public.payment_event_inbox inbox where inbox.outbox_id=blocked_event;
  select * into strict claim from public.api_claim_payment_event_effects('contract-effect-deadletter',1,30);
  execute_result:=public.api_execute_payment_event_effect(claim.id,'contract-effect-deadletter',claim.lease_token);
  if claim.id<>terminal_bad_effect or execute_result->>'status'<>'dead_letter'
    or (select attempts from public.payment_event_effects where id=terminal_bad_effect)<>12
    or exists(select 1 from public.fulfillment_orders where payment_id=terminal_payment)
  then raise exception 'CONTRACT_EFFECT_DEADLETTER_INVALID'; end if;
  if exists(select 1 from public.api_claim_payment_event_effects('contract-effect-blocked',1,30))
  then raise exception 'CONTRACT_EFFECT_DEADLETTER_DID_NOT_BLOCK_AGGREGATE'; end if;
  update public.payment_event_effects set status='ignored',dead_lettered_at=null,last_error_code=null where id=terminal_bad_effect;
  select * into strict claim from public.api_claim_payment_event_effects('contract-effect-unblocked',1,30);
  if claim.id<>blocked_notification then raise exception 'CONTRACT_EFFECT_IGNORE_DID_NOT_UNBLOCK_AGGREGATE'; end if;
  execute_result:=public.api_execute_payment_event_effect(claim.id,'contract-effect-unblocked',claim.lease_token);
  if execute_result->>'resultCode'<>'notification_persisted' then raise exception 'CONTRACT_EFFECT_UNBLOCKED_EXECUTION_FAILED'; end if;
  insert into public.payment_event_effects(id,inbox_id,outbox_id,tenant_id,order_id,payment_id,effect_type,payload_json,attempts)
  select retired_effect,inbox.id,blocked_event,'tenant-smart-wing',terminal_order,terminal_payment,'accounting','{}',12
  from public.payment_event_inbox inbox where inbox.outbox_id=blocked_event;
  perform public.api_claim_payment_event_effects('contract-effect-retire',1,30);
  if (select status from public.payment_event_effects where id=retired_effect)<>'dead_letter'
    or not exists(select 1 from public.audit_logs where resource_id=retired_effect::text and action='payment.effect.dead_letter')
  then raise exception 'CONTRACT_EFFECT_EXHAUSTED_LEASE_NOT_AUDITED'; end if;
  begin
    update public.finance_journals set amount_cents=amount_cents+1 where payment_id=success_payment;
    raise exception 'CONTRACT_EFFECT_JOURNAL_MUTABLE';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%IMMUTABLE%' then raise; end if;
  end;
  begin
    insert into public.finance_journals(tenant_id,mall_id,order_id,payment_id,source_effect_id,journal_type,
      business_reference,currency,amount_cents,status,occurred_at)
    values('tenant-smart-wing','mall-demo',terminal_order,terminal_payment,terminal_notification,
      'payment_capture','unbalanced-'||suffix,'CNY',1000,'posted',now());
    set constraints all immediate;
    raise exception 'CONTRACT_EFFECT_UNBALANCED_JOURNAL_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%FINANCE_JOURNAL_UNBALANCED%' then raise; end if;
  end;
  set constraints all deferred;
  if has_table_privilege('service_role','public.payment_event_effects','select')
    or has_table_privilege('authenticated','public.finance_journals','select')
    or has_function_privilege('service_role','public.process_payment_accounting_effect(uuid)','execute')
    or has_function_privilege('authenticated','public.api_claim_payment_event_effects(text,integer,integer)','execute')
    or not has_function_privilege('service_role','public.api_claim_payment_event_effects(text,integer,integer)','execute')
    or not has_function_privilege('service_role','public.api_execute_payment_event_effect(uuid,text,uuid)','execute')
  then raise exception 'CONTRACT_EFFECT_ACL_INVALID'; end if;
end $$;

rollback;
