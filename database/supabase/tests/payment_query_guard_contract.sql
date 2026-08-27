begin;

do $$
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  query_order_id text:='contract-query-order-'||suffix;
  query_payment_id text:='contract-query-payment-'||suffix;
  refunded_order text:='contract-query-refunded-order-'||suffix;
  refunded_payment text:='contract-query-refunded-payment-'||suffix;
  stock_id text:='contract-query-stock-'||suffix;
  location_id text:='contract-query-location-'||suffix;
  command_id text:='contract-query-command-'||suffix;
  query_attempt_id uuid:=gen_random_uuid(); refunded_attempt uuid:=gen_random_uuid();
  identity_id uuid:=gen_random_uuid(); claim record; response jsonb;
  observation_count bigint; outbox_count bigint; error_message text;
  function_definition text;
  app_id text:='wxquery'||suffix; mch_id text:='mchquery'||suffix;
  trade_no text:='QUERY'||upper(suffix); transaction_id text:='TX'||upper(suffix);
begin
  update public.wechat_payment_attempts set
    query_available_at=now()+interval '1 day'
  where status in('created','prepay_ready','prepay_failed','processing');
  insert into public.orders(id,order_no,tenant_id,enterprise_id,mall_id,user_id,
    status,goods_amount_cents,discount_cents,payable_cents,paid_cents,
    recipient_snapshot_json)
  values(query_order_id,'CONTRACT-QUERY-'||suffix,'tenant-smart-wing',
    'enterprise-demo','mall-demo','user-test-storefront','pending_payment',
    100,0,100,0,'{}');
  insert into public.sub_orders(id,sub_order_no,tenant_id,mall_id,
    parent_order_id,supplier_id,status,amount_cents)
  values('contract-query-sub-'||suffix,'CONTRACT-QUERY-SUB-'||suffix,
    'tenant-smart-wing','mall-demo',query_order_id,'supplier-central',
    'pending_payment',100);
  insert into public.order_items(id,tenant_id,mall_id,order_id,sub_order_id,
    product_id,sku_id,product_name_snapshot,specs_snapshot_json,
    unit_price_cents,quantity,line_amount_cents)
  values('contract-query-item-'||suffix,'tenant-smart-wing','mall-demo',
    query_order_id,'contract-query-sub-'||suffix,'product-rice','sku-rice-5kg',
    '契约商品','{}',100,1,100);
  insert into inventory.stock_items(id,tenant_id,mall_id,sku_id,location_id,
    onhand,safety)
  values(stock_id,'tenant-smart-wing','mall-demo','sku-rice-5kg',
    location_id,10,0);
  insert into inventory.commands(id,tenant_id,mall_id,operation,
    idempotency_key,request_json,response_json,completed_at)
  values(command_id,'tenant-smart-wing','mall-demo','reserve',
    'contract-query-reserve-'||suffix,'{}','{}',now());
  insert into inventory.reservations(tenant_id,mall_id,order_id,stock_item_id,
    sku_id,location_id,quantity,expires_at,created_by_command_id)
  values('tenant-smart-wing','mall-demo',query_order_id,stock_id,'sku-rice-5kg',
    location_id,1,now()-interval '1 minute',command_id);
  insert into public.member_wechat_identities(id,app_id,open_id)
  values(identity_id,app_id,'openid-query-'||suffix);
  insert into public.payments(id,payment_no,tenant_id,mall_id,user_id,order_id,
    channel,status,amount_cents,idempotency_key)
  values(query_payment_id,'CONTRACT-QUERY-PAY-'||suffix,'tenant-smart-wing',
    'mall-demo','user-test-storefront',query_order_id,'wechat','processing',100,
    'contract-query-payment-'||suffix);
  insert into public.wechat_payment_attempts(id,payment_id,order_id,identity_id,
    created_by_membership_id,app_id,mch_id,out_trade_no,description,
    amount_total,payer_openid_hash,status,query_available_at)
  values(query_attempt_id,query_payment_id,query_order_id,identity_id,
    'membership-test-storefront',app_id,mch_id,trade_no,'Contract query',
    100,repeat('a',64),'processing',now());

  select * into strict claim from public.api_claim_wechat_payment_queries(
    'contract-query-worker',1,30);
  select count(*) into observation_count
    from public.wechat_payment_observations observation
    where observation.attempt_id=query_attempt_id;
  select count(*) into outbox_count
    from public.payment_outbox event where event.attempt_id=query_attempt_id;
  response:=public.api_record_wechat_payment_query_result(
    query_attempt_id,'contract-query-worker',gen_random_uuid(),app_id,mch_id,
    trade_no,transaction_id,'SUCCESS',now(),100,repeat('a',64),'{}');
  if response->>'status'<>'lease_lost'
    or(select count(*) from public.wechat_payment_observations observation
      where observation.attempt_id=query_attempt_id)<>observation_count
    or(select count(*) from public.payment_outbox event
      where event.attempt_id=query_attempt_id)<>outbox_count
    or(select status from public.payments where id=query_payment_id)<>'processing'
    or(select status from public.orders where id=query_order_id)<>'pending_payment'
  then raise exception 'CONTRACT_QUERY_STALE_LEASE_MUTATED_STATE'; end if;

  response:=public.api_record_wechat_payment_query_result(
    query_attempt_id,'contract-query-worker',claim.lease_token,app_id,mch_id,
    trade_no,'','NOTPAY',null,100,null,
    jsonb_build_object('tradeState','NOTPAY'));
  if response->>'status'<>'pending'
    or(select query_operation from public.wechat_payment_attempts
      where id=query_attempt_id)<>'close'
    or(select query_lease_token from public.wechat_payment_attempts
      where id=query_attempt_id) is not null
    or(select state from inventory.reservations
      where order_id=query_order_id)<>'active'
  then raise exception 'CONTRACT_QUERY_NOTPAY_DID_NOT_SCHEDULE_CLOSE'; end if;

  update public.wechat_payment_attempts set query_available_at=now()
    where id=query_attempt_id;
  select * into strict claim from public.api_claim_wechat_payment_queries(
    'contract-query-worker',1,30);
  if claim.operation<>'close' then
    raise exception 'CONTRACT_QUERY_CLOSE_NOT_CLAIMED'; end if;
  response:=public.api_record_wechat_payment_close_accepted(
    query_attempt_id,'contract-query-worker',claim.lease_token,'provider-request');
  if response->>'outcome'<>'close_accepted'
    or(select query_operation from public.wechat_payment_attempts
      where id=query_attempt_id)<>'query'
    or(select close_request_count from public.wechat_payment_attempts
      where id=query_attempt_id)<>1
    or(select state from inventory.reservations
      where order_id=query_order_id)<>'active'
    or(select status from public.orders where id=query_order_id)<>'pending_payment'
    or exists(select 1 from public.api_expire_due_checkout_orders(
      'contract-query-expiry',20) expired where expired.order_id=query_order_id)
  then raise exception 'CONTRACT_QUERY_CLOSE_ACCEPTANCE_RELEASED_INVENTORY'; end if;

  update public.wechat_payment_attempts set query_available_at=now(),
    last_query_at=now()-interval '20 seconds' where id=query_attempt_id;
  select * into strict claim from public.api_claim_wechat_payment_queries(
    'contract-query-worker',1,30);
  response:=public.api_record_wechat_payment_query_result(
    query_attempt_id,'contract-query-worker',claim.lease_token,app_id,mch_id,
    trade_no,'','CLOSED',null,100,null,
    jsonb_build_object('tradeState','CLOSED'));
  if response->>'status'<>'terminal'
    or(select status from public.orders where id=query_order_id)<>'cancelled'
    or(select status from public.payments where id=query_payment_id)<>'closed'
    or(select state from inventory.reservations
      where order_id=query_order_id)<>'released'
    or(select count(*) from inventory.movements
      where order_id=query_order_id and kind='release')<>1
    or not exists(select 1 from public.wechat_payment_observations
      where attempt_id=query_attempt_id and trade_state='CLOSED')
  then raise exception 'CONTRACT_QUERY_CLOSED_NOT_TERMINAL'; end if;

  insert into public.orders(id,order_no,tenant_id,enterprise_id,mall_id,user_id,
    status,goods_amount_cents,discount_cents,payable_cents,paid_cents,
    recipient_snapshot_json,paid_at)
  values(refunded_order,'CONTRACT-QUERY-REFUNDED-'||suffix,
    'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',
    'refunded',100,0,100,100,'{}',now());
  insert into public.payments(id,payment_no,tenant_id,mall_id,user_id,order_id,
    channel,status,amount_cents,provider_trade_no,idempotency_key,completed_at)
  values(refunded_payment,'CONTRACT-QUERY-REFPAY-'||suffix,
    'tenant-smart-wing','mall-demo','user-test-storefront',refunded_order,
    'wechat','refunded',100,transaction_id,'contract-refunded-'||suffix,now());
  insert into public.wechat_payment_attempts(id,payment_id,order_id,identity_id,
    created_by_membership_id,app_id,mch_id,out_trade_no,description,
    amount_total,payer_openid_hash,status,transaction_id,
    provider_trade_state,completed_at)
  values(refunded_attempt,refunded_payment,refunded_order,identity_id,
    'membership-test-storefront',app_id,mch_id,'REFUND'||upper(suffix),
    'Contract refunded query',100,repeat('a',64),'succeeded',transaction_id,
    'SUCCESS',now());
  response:=public.api_apply_wechat_payment_query(
    'contract-refunded-repeat-'||suffix,app_id,mch_id,
    'REFUND'||upper(suffix),transaction_id,'SUCCESS',now(),100,
    repeat('a',64),'{}','contract-refunded-request-'||suffix);
  if response->>'reasonCode'<>'payment_already_refunded'
    or(select status from public.payments where id=refunded_payment)<>'refunded'
    or(select status from public.orders where id=refunded_order)<>'refunded'
    or exists(select 1 from public.payment_outbox
      where payment_id=refunded_payment)
  then raise exception 'CONTRACT_QUERY_REFUNDED_SUCCESS_REVIVED_PAYMENT'; end if;
  response:=public.api_apply_wechat_payment_query(
    'contract-refunded-repeat-'||suffix,app_id,mch_id,
    'REFUND'||upper(suffix),transaction_id,'SUCCESS',now(),100,
    repeat('a',64),'{}','contract-refunded-retry-'||suffix);
  if response->>'duplicate'<>'true' then
    raise exception 'CONTRACT_QUERY_IDENTICAL_EVIDENCE_NOT_IDEMPOTENT'; end if;
  select count(*) into observation_count from public.wechat_payment_observations;
  select count(*) into outbox_count from public.payment_outbox;
  begin
    perform public.api_apply_wechat_payment_query(
      'contract-refunded-repeat-'||suffix,app_id,mch_id,
      'REFUND'||upper(suffix),transaction_id,'SUCCESS',now(),101,
      repeat('a',64),'{}','contract-refunded-amount-mismatch-'||suffix);
    raise exception 'CONTRACT_QUERY_REUSED_KEY_AMOUNT_ACCEPTED';
  exception when others then get stacked diagnostics error_message=message_text;
    if error_message not like '%WECHAT_PAYMENT_OBSERVATION_REPLAY_MISMATCH%'
    then raise; end if;
  end;
  begin
    perform public.api_apply_wechat_payment_observation(
      'notification','query:contract-refunded-repeat-'||suffix,
      'contract-refunded-repeat-'||suffix,'QUERY.TRANSACTION','transaction',
      app_id,mch_id,'REFUND'||upper(suffix),transaction_id,'SUCCESS',now(),100,
      repeat('a',64),'{}','contract-refunded-source-mismatch-'||suffix);
    raise exception 'CONTRACT_QUERY_REUSED_KEY_SOURCE_ACCEPTED';
  exception when others then get stacked diagnostics error_message=message_text;
    if error_message not like '%WECHAT_PAYMENT_OBSERVATION_REPLAY_MISMATCH%'
    then raise; end if;
  end;
  begin
    perform public.api_apply_wechat_payment_query(
      'contract-refunded-repeat-'||suffix,app_id,mch_id,
      'REFUND'||upper(suffix),'','CLOSED',null,100,null,'{}',
      'contract-refunded-state-mismatch-'||suffix);
    raise exception 'CONTRACT_QUERY_REUSED_KEY_STATE_ACCEPTED';
  exception when others then get stacked diagnostics error_message=message_text;
    if error_message not like '%WECHAT_PAYMENT_OBSERVATION_REPLAY_MISMATCH%'
    then raise; end if;
  end;
  begin
    perform public.api_apply_wechat_payment_query(
      'contract-refunded-repeat-'||suffix,app_id,mch_id,trade_no,
      transaction_id,'SUCCESS',now(),100,repeat('a',64),'{}',
      'contract-refunded-order-mismatch-'||suffix);
    raise exception 'CONTRACT_QUERY_REUSED_KEY_ORDER_ACCEPTED';
  exception when others then get stacked diagnostics error_message=message_text;
    if error_message not like '%WECHAT_PAYMENT_OBSERVATION_REPLAY_MISMATCH%'
    then raise; end if;
  end;
  if (select count(*) from public.wechat_payment_observations)<>observation_count
    or(select count(*) from public.payment_outbox)<>outbox_count
    or(select status from public.payments where id=refunded_payment)<>'refunded'
    or(select status from public.orders where id=refunded_order)<>'refunded'
  then raise exception 'CONTRACT_QUERY_REPLAY_MISMATCH_MUTATED_STATE'; end if;
  begin
    perform public.api_apply_wechat_payment_query(
      'contract-refunded-conflict-'||suffix,app_id,mch_id,
      'REFUND'||upper(suffix),'ATTACKER'||upper(suffix),'SUCCESS',now(),100,
      repeat('a',64),'{}','contract-refunded-conflict-'||suffix);
    raise exception 'CONTRACT_QUERY_REFUNDED_TRANSACTION_CONFLICT_ACCEPTED';
  exception when others then get stacked diagnostics error_message=message_text;
    if error_message not like '%WECHAT_REFUNDED_PAYMENT_EVIDENCE_MISMATCH%'
    then raise; end if;
  end;
  begin
    perform public.api_apply_wechat_payment_query(
      'contract-unmapped-'||suffix,app_id,mch_id,'UNKNOWN'||upper(suffix),
      '','NOTPAY',null,100,null,'{}','contract-unmapped-'||suffix);
    raise exception 'CONTRACT_QUERY_UNMAPPED_FELL_THROUGH_CORE';
  exception when others then get stacked diagnostics error_message=message_text;
    if error_message not like '%WECHAT_PAYMENT_ATTEMPT_NOT_FOUND%'
    then raise; end if;
  end;
  select lower(pg_get_functiondef(
    'public.api_apply_wechat_payment_observation(text,text,text,text,text,text,text,text,text,text,timestamptz,bigint,text,jsonb,text)'::regprocedure
  )) into function_definition;
  if has_function_privilege('authenticated',
      'public.api_claim_wechat_payment_queries(text,integer,integer)','execute')
    or has_function_privilege('authenticated',
      'public.api_record_wechat_payment_query_result(uuid,text,uuid,text,text,text,text,text,timestamptz,bigint,text,jsonb)','execute')
    or has_function_privilege('service_role',
      'public.lock_wechat_payment_query(uuid,text,uuid)','execute')
    or position('payment-order:' in function_definition)=0
    or position('wechat-payment-trade:' in function_definition)=0
    or position('payment-order:' in function_definition)
      >position('wechat-payment-trade:' in function_definition)
    or to_regprocedure(
      'public.apply_wechat_payment_observation_core(text,text,text,text,text,text,text,text,text,text,timestamptz,bigint,text,jsonb,text)')
      is not null
  then raise exception 'CONTRACT_QUERY_ACL_INVALID'; end if;
end $$;

rollback;
