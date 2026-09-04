begin;

do $$
<<inventory_payment_contract>>
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  session_id uuid:=gen_random_uuid();
  authz_version integer; credential_version integer; evidence jsonb;
  stock_id text:='contract-pay-stock-'||suffix;
  location_id text:='contract-pay-'||suffix;
  internal_order text:='contract-internal-ok-'||suffix;
  failed_order text:='contract-internal-fail-'||suffix;
  wechat_order text:='contract-wechat-ok-'||suffix;
  conflict_order text:='contract-wechat-conflict-'||suffix;
  terminal_order text:='contract-wechat-terminal-'||suffix;
  expiry_order text:='contract-checkout-expiry-'||suffix;
  identity_id uuid:=gen_random_uuid();
  ok_attempt uuid:=gen_random_uuid(); conflict_attempt uuid:=gen_random_uuid();
  terminal_attempt uuid:=gen_random_uuid();
  ok_payment text:='contract-wx-pay-ok-'||suffix;
  conflict_payment text:='contract-wx-pay-conflict-'||suffix;
  terminal_payment text:='contract-wx-pay-terminal-'||suffix;
  app_id text:='wxcontract'||suffix; mch_id text:='mchcontract'||suffix;
  manual_command text:='contract-expire-command-'||suffix;
  first_response jsonb; replay_response jsonb; expiry_response jsonb;
  before_balance bigint; before_payments bigint; before_onhand integer;
  error_message text; function_definition text;
begin
  select membership.authz_version,credential.credential_version
  into strict authz_version,credential_version
  from public.memberships membership left join public.member_credentials credential
    on credential.member_id=membership.member_id
  where membership.id='membership-test-storefront';
  insert into public.auth_sessions (
    id,member_id,membership_id,target,credential_version,ip_hash,user_agent,
    device_label,expires_at
  ) values (
    session_id,'member-test-storefront','membership-test-storefront','storefront',
    credential_version,'inventory-payment-contract','contract','contract',now()+interval '1 hour'
  );
  evidence:=jsonb_build_object(
    'sessionId',session_id,'membershipId','membership-test-storefront',
    'authzVersion',authz_version,'permission','order.create'
  );
  update public.member_identity_assurances set phone_verified_at=now(),
    phone_verification_method='sms_otp',updated_at=now()
  where member_id='member-test-storefront';
  update public.welfare_accounts set balance_cents=10000,status='active',
    version=version+1,updated_at=now()
  where tenant_id='tenant-smart-wing' and enterprise_id='enterprise-demo'
    and mall_id='mall-demo' and user_id='user-test-storefront'
    and account_type='welfare';

  insert into inventory.stock_items (
    id,tenant_id,mall_id,sku_id,location_id,onhand,safety
  ) values (
    stock_id,'tenant-smart-wing','mall-demo','sku-rice-5kg',location_id,30,0
  );
  insert into public.orders (
    id,order_no,tenant_id,enterprise_id,mall_id,user_id,status,goods_amount_cents,
    discount_cents,payable_cents,paid_cents,recipient_snapshot_json
  ) values
    (internal_order,'CONTRACT-INT-OK-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront','pending_payment',100,0,100,0,'{}'),
    (failed_order,'CONTRACT-INT-FAIL-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront','pending_payment',100,0,100,0,'{}'),
    (wechat_order,'CONTRACT-WX-OK-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront','pending_payment',100,0,100,0,'{}'),
    (conflict_order,'CONTRACT-WX-CONFLICT-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront','pending_payment',100,0,100,0,'{}'),
    (terminal_order,'CONTRACT-WX-TERMINAL-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront','pending_payment',100,0,100,0,'{}'),
    (expiry_order,'CONTRACT-EXPIRY-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront','pending_payment',100,0,100,0,'{}');
  insert into public.sub_orders (
    id,sub_order_no,tenant_id,mall_id,parent_order_id,supplier_id,status,amount_cents
  ) select 'contract-sub-'||ordinality||'-'||suffix,'CONTRACT-SUB-'||ordinality||'-'||suffix,
    'tenant-smart-wing','mall-demo',order_id,'supplier-central','pending_payment',100
  from unnest(array[internal_order,failed_order,wechat_order,conflict_order,terminal_order,expiry_order])
    with ordinality requested(order_id,ordinality);
  insert into public.order_items (
    id,tenant_id,mall_id,order_id,sub_order_id,product_id,sku_id,
    product_name_snapshot,specs_snapshot_json,unit_price_cents,quantity,line_amount_cents
  ) select 'contract-line-'||ordinality||'-'||suffix,'tenant-smart-wing','mall-demo',
    order_id,'contract-sub-'||ordinality||'-'||suffix,'product-rice','sku-rice-5kg',
    '契约商品','{}',100,1,100
  from unnest(array[internal_order,failed_order,wechat_order,conflict_order,terminal_order,expiry_order])
    with ordinality requested(order_id,ordinality);
  perform inventory.reserve(
    'tenant-smart-wing','mall-demo',internal_order,
    jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg','locationId',location_id,'quantity',1)),
    'contract-int-reserve-'||suffix,now()+interval '15 minutes'
  );
  perform inventory.reserve(
    'tenant-smart-wing','mall-demo',wechat_order,
    jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg','locationId',location_id,'quantity',1)),
    'contract-wx-reserve-'||suffix,now()+interval '15 minutes'
  );
  perform inventory.reserve(
    'tenant-smart-wing','mall-demo',terminal_order,
    jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg','locationId',location_id,'quantity',1)),
    'contract-terminal-reserve-'||suffix,now()+interval '15 minutes'
  );
  insert into inventory.commands (
    id,tenant_id,mall_id,operation,idempotency_key,request_json,response_json,completed_at
  ) values (
    manual_command,'tenant-smart-wing','mall-demo','reserve','contract-expiry-reserve-'||suffix,
    '{}','{}',now()
  );
  insert into inventory.reservations (
    tenant_id,mall_id,order_id,stock_item_id,sku_id,location_id,quantity,
    expires_at,created_by_command_id
  ) values (
    'tenant-smart-wing','mall-demo',expiry_order,stock_id,'sku-rice-5kg',location_id,
    1,now()-interval '1 minute',manual_command
  );
  update inventory.stock_items set version=version+1 where id=stock_id;

  select balance_cents into strict before_balance from public.welfare_accounts
  where mall_id='mall-demo' and user_id='user-test-storefront' and account_type='welfare';
  first_response:=public.api_pay_internal_authorized(
    'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',internal_order,
    100,0,'contract-int-pay-'||suffix,repeat('A',43)||'=','contract-int-pay-'||suffix,
    'contract','membership-test-storefront',evidence
  );
  replay_response:=public.api_pay_internal_authorized(
    'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',internal_order,
    100,0,'contract-int-pay-'||suffix,repeat('A',43)||'=','contract-int-replay-'||suffix,
    'contract','membership-test-storefront',evidence
  );
  if first_response<>replay_response
     or (select status from public.orders where id=internal_order)<>'paid'
     or (select state from inventory.reservations where order_id=internal_order)<>'committed'
     or (select count(*) from inventory.movements where order_id=internal_order and kind='sale')<>1
     or (select balance_cents from public.welfare_accounts where mall_id='mall-demo'
       and user_id='user-test-storefront' and account_type='welfare')<>before_balance-100
     or first_response#>>'{inventoryReservation,orderId}'<>internal_order
     or (select count(*) from public.audit_logs where resource_id=internal_order
       and action in ('payment.internal.succeeded','payment.internal.authorized'))<>2
  then raise exception 'CONTRACT_INTERNAL_PAYMENT_COMMIT_INVALID'; end if;

  select balance_cents into strict before_balance from public.welfare_accounts
  where mall_id='mall-demo' and user_id='user-test-storefront' and account_type='welfare';
  select count(*) into before_payments from public.payments where order_id=failed_order;
  begin
    perform public.api_pay_internal_authorized(
      'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',failed_order,
      100,0,'contract-int-fail-'||suffix,repeat('B',43)||'=','contract-int-fail-'||suffix,
      'contract','membership-test-storefront',evidence
    );
    raise exception 'CONTRACT_INTERNAL_PAYMENT_WITHOUT_RESERVATION_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%INVENTORY_PAYMENT_RESERVATION_MISSING%' then raise; end if;
  end;
  if (select balance_cents from public.welfare_accounts where mall_id='mall-demo'
       and user_id='user-test-storefront' and account_type='welfare')<>before_balance
     or (select count(*) from public.payments where order_id=failed_order)<>before_payments
     or (select status from public.orders where id=failed_order)<>'pending_payment'
     or exists(select 1 from public.idempotency_keys where resource_id=failed_order)
  then raise exception 'CONTRACT_INTERNAL_PAYMENT_FAILURE_NOT_ROLLED_BACK'; end if;
  begin
    perform public.api_pay_internal_authorized(
      'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',expiry_order,
      100,0,'contract-int-expired-'||suffix,repeat('C',43)||'=','contract-int-expired-'||suffix,
      'contract','membership-test-storefront',evidence
    );
    raise exception 'CONTRACT_INTERNAL_EXPIRED_RESERVATION_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%INVENTORY_PAYMENT_RESERVATION_EXPIRED%' then raise; end if;
  end;
  if (select status from public.orders where id=expiry_order)<>'pending_payment'
     or exists(select 1 from public.payments where order_id=expiry_order)
  then raise exception 'CONTRACT_INTERNAL_EXPIRED_PAYMENT_NOT_ROLLED_BACK'; end if;

  insert into public.member_wechat_identities(id,app_id,open_id)
  values(identity_id,app_id,'openid-contract-'||suffix);
  insert into public.payments(
    id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,amount_cents,idempotency_key
  ) values
    (ok_payment,'CONTRACT-WXP-OK-'||suffix,'tenant-smart-wing','mall-demo','user-test-storefront',wechat_order,'wechat','processing',100,'contract-wxp-ok-'||suffix),
    (conflict_payment,'CONTRACT-WXP-CONFLICT-'||suffix,'tenant-smart-wing','mall-demo','user-test-storefront',conflict_order,'wechat','processing',100,'contract-wxp-conflict-'||suffix),
    (terminal_payment,'CONTRACT-WXP-TERMINAL-'||suffix,'tenant-smart-wing','mall-demo','user-test-storefront',terminal_order,'wechat','processing',100,'contract-wxp-terminal-'||suffix);
  insert into public.wechat_payment_attempts(
    id,payment_id,order_id,identity_id,created_by_membership_id,app_id,mch_id,
    out_trade_no,description,amount_total,payer_openid_hash,status
  ) values
    (ok_attempt,ok_payment,wechat_order,identity_id,'membership-test-storefront',app_id,mch_id,'WXOK'||upper(suffix),'Contract',100,repeat('a',64),'processing'),
    (conflict_attempt,conflict_payment,conflict_order,identity_id,'membership-test-storefront',app_id,mch_id,'WXCONFLICT'||upper(suffix),'Contract',100,repeat('a',64),'processing'),
    (terminal_attempt,terminal_payment,terminal_order,identity_id,'membership-test-storefront',app_id,mch_id,'WXTERMINAL'||upper(suffix),'Contract',100,repeat('a',64),'processing');

  before_onhand:=(select onhand from inventory.stock_items where id=stock_id);
  first_response:=public.api_apply_wechat_payment_observation(
    'notification','contract-wx-event-ok-'||suffix,'contract-wx-provider-ok-'||suffix,
    'TRANSACTION.SUCCESS','transaction',app_id,mch_id,'WXOK'||upper(suffix),
    'WXTXOK'||upper(suffix),'SUCCESS',now(),100,repeat('a',64),'{"signature":"verified"}',
    'contract-wx-request-ok-'||suffix
  );
  replay_response:=public.api_apply_wechat_payment_observation(
    'notification','contract-wx-event-ok-'||suffix,'contract-wx-provider-ok-'||suffix,
    'TRANSACTION.SUCCESS','transaction',app_id,mch_id,'WXOK'||upper(suffix),
    'WXTXOK'||upper(suffix),'SUCCESS',now(),100,repeat('a',64),'{"signature":"verified"}',
    'contract-wx-request-replay-'||suffix
  );
  if first_response->>'outcome'<>'applied' or replay_response->>'duplicate'<>'true'
     or (select status from public.orders where id=wechat_order)<>'paid'
     or (select state from inventory.reservations where order_id=wechat_order)<>'committed'
     or (select onhand from inventory.stock_items where id=stock_id)<>before_onhand-1
     or (select count(*) from inventory.movements where order_id=wechat_order and kind='sale')<>1
     or (select count(*) from public.payment_outbox where order_id=wechat_order
       and topic='order.payment_succeeded')<>1
  then raise exception 'CONTRACT_WECHAT_PAYMENT_COMMIT_OR_REPLAY_INVALID'; end if;

  first_response:=public.api_apply_wechat_payment_observation(
    'notification','contract-wx-event-conflict-'||suffix,'contract-wx-provider-conflict-'||suffix,
    'TRANSACTION.SUCCESS','transaction',app_id,mch_id,'WXCONFLICT'||upper(suffix),
    'WXTXCONFLICT'||upper(suffix),'SUCCESS',now(),100,repeat('a',64),'{"signature":"verified"}',
    'contract-wx-request-conflict-'||suffix
  );
  if first_response->>'outcome'<>'reconciliation_required'
     or first_response->>'reasonCode'<>'inventory_reservation_missing'
     or (select status from public.orders where id=conflict_order)<>'refund_pending'
     or (select paid_cents from public.orders where id=conflict_order)<>100
     or (select status from public.payments where id=conflict_payment)<>'succeeded'
     or not exists(select 1 from public.wechat_payment_observations
       where provider_event_key='contract-wx-event-conflict-'||suffix and outcome='reconciliation_required')
     or (select count(*) from public.payment_outbox where order_id=conflict_order
       and topic='order.payment_reconciliation_required')<>1
     or exists(select 1 from public.payment_outbox where order_id=conflict_order
       and topic='order.payment_succeeded')
  then raise exception 'CONTRACT_WECHAT_RECONCILIATION_EVIDENCE_INVALID'; end if;

  first_response:=public.api_apply_wechat_payment_observation(
    'notification','contract-wx-event-terminal-'||suffix,'contract-wx-provider-terminal-'||suffix,
    'TRANSACTION.CLOSED','transaction',app_id,mch_id,'WXTERMINAL'||upper(suffix),
    null,'CLOSED',null,100,null,'{"signature":"verified"}',
    'contract-wx-request-terminal-'||suffix
  );
  perform public.api_apply_wechat_payment_observation(
    'query','contract-wx-event-late-terminal-'||suffix,'contract-wx-provider-late-'||suffix,
    'QUERY.TRANSACTION','transaction',app_id,mch_id,'WXOK'||upper(suffix),
    null,'CLOSED',null,100,null,'{"signature":"verified"}',
    'contract-wx-request-late-'||suffix
  );
  if first_response->>'outcome'<>'applied'
     or (select status from public.orders where id=terminal_order)<>'cancelled'
     or (select state from inventory.reservations where order_id=terminal_order)<>'released'
     or (select count(*) from inventory.movements where order_id=terminal_order and kind='release')<>1
     or (select status from public.payments where id=terminal_payment)<>'closed'
     or (select count(*) from public.payment_outbox where order_id=terminal_order
       and topic='order.payment_terminal')<>1
     or (select status from public.orders where id=wechat_order)<>'paid'
     or (select status from public.payments where id=ok_payment)<>'succeeded'
  then raise exception 'CONTRACT_WECHAT_TERMINAL_RELEASE_INVALID'; end if;

  first_response:=public.api_apply_wechat_payment_observation(
    'notification','contract-wx-event-late-success-'||suffix,'contract-wx-provider-late-success-'||suffix,
    'TRANSACTION.SUCCESS','transaction',app_id,mch_id,'WXTERMINAL'||upper(suffix),
    'WXTXLATE'||upper(suffix),'SUCCESS',now(),100,repeat('a',64),'{"signature":"verified"}','contract-wx-request-late-success-'||suffix);
  if first_response->>'outcome'<>'reconciliation_required' or (select status from public.orders where id=terminal_order)<>'refund_pending'
     or (select status from public.payments where id=terminal_payment)<>'succeeded' or (select state from inventory.reservations where order_id=terminal_order)<>'released'
     or (select count(*) from inventory.movements where order_id=terminal_order and kind='commit')<>0 or (select count(*) from public.payment_outbox where order_id=terminal_order and topic='order.payment_reconciliation_required')<>1
     or exists(select 1 from public.payment_outbox where order_id=terminal_order and topic='order.payment_succeeded') then raise exception 'CONTRACT_WECHAT_LATE_SUCCESS_RECONCILIATION_INVALID'; end if;

  select jsonb_agg(to_jsonb(expired)) into expiry_response
  from public.api_expire_due_checkout_orders('contract-expiry-worker',20) expired
  where expired.order_id=expiry_order;
  if jsonb_array_length(expiry_response)<>1
     or expiry_response#>>'{0,status}'<>'cancelled'
     or (expiry_response#>>'{0,expired_reservation_count}')::integer<>1
     or (select status from public.orders where id=expiry_order)<>'cancelled'
     or (select state from inventory.reservations where order_id=expiry_order)<>'expired'
     or (select count(*) from inventory.movements where order_id=expiry_order and kind='expire')<>1
     or (select count(*) from public.audit_logs where resource_id=expiry_order
       and action='checkout.order.expired')<>1
  then raise exception 'CONTRACT_CHECKOUT_EXPIRY_INVALID'; end if;
  if exists(select 1 from public.api_expire_due_checkout_orders('contract-expiry-worker',20)
    where order_id=expiry_order)
     or (select count(*) from inventory.movements where order_id=expiry_order and kind='expire')<>1
  then raise exception 'CONTRACT_CHECKOUT_EXPIRY_REPLAYED'; end if;
  begin
    perform public.api_expire_due_checkout_orders('',0);
    raise exception 'CONTRACT_CHECKOUT_EXPIRY_INVALID_WORKER_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%CHECKOUT_EXPIRY_WORKER_INPUT_INVALID%' then raise; end if;
  end;

  select lower(pg_get_functiondef('public.api_expire_due_checkout_orders(text,integer)'::regprocedure))
  into function_definition;
  if position('for update of orders skip locked' in function_definition)=0
     or to_regprocedure('public.api_pay_internal(text,text,text,text,text,bigint,bigint,text,text,text,text)') is not null
     or not has_function_privilege('service_role','public.api_pay_internal_authorized(text,text,text,text,text,bigint,bigint,text,text,text,text,text,jsonb)','execute')
     or has_function_privilege('authenticated','public.api_pay_internal_authorized(text,text,text,text,text,bigint,bigint,text,text,text,text,text,jsonb)','execute')
     or not has_function_privilege('service_role','public.api_expire_due_checkout_orders(text,integer)','execute')
     or has_function_privilege('authenticated','public.api_expire_due_checkout_orders(text,integer)','execute')
     or has_function_privilege('anon','public.api_expire_due_checkout_orders(text,integer)','execute')
     or has_function_privilege('service_role','inventory.commit_payment(text,text,text,text)','execute')
  then raise exception 'CONTRACT_INVENTORY_PAYMENT_ACL_OR_LOCK_INVALID'; end if;
end inventory_payment_contract;
$$;

rollback;
