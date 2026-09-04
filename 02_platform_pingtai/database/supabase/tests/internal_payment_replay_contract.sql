begin;

do $$
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  session_id uuid:=gen_random_uuid(); authz integer; credential integer;
  evidence jsonb; result jsonb; replay jsonb; error_message text;
  paid_order text:='contract-replay-paid-'||suffix;
  other_order text:='contract-replay-other-'||suffix;
  stock_id text:='contract-replay-stock-'||suffix;
  location_id text:='contract-replay-location-'||suffix;
  payment_key text:='contract-replay-key-'||suffix;
  payment_hash text:=repeat('R',43)||'=';
  welfare_balance bigint; meal_balance bigint;
  payment_count bigint; intent_count bigint; outbox_count bigint;
  ledger_count bigint; function_definition text;
begin
  select membership.authz_version,coalesce(identity.credential_version,0)
  into strict authz,credential from public.memberships membership
  left join public.member_credentials identity
    on identity.member_id=membership.member_id
  where membership.id='membership-test-storefront';
  insert into public.auth_sessions(id,member_id,membership_id,target,
    credential_version,ip_hash,user_agent,device_label,expires_at)
  values(session_id,'member-test-storefront','membership-test-storefront',
    'storefront',credential,'internal-replay-contract','contract','contract',
    now()+interval '1 hour');
  evidence:=jsonb_build_object('sessionId',session_id,
    'membershipId','membership-test-storefront','authzVersion',authz,
    'permission','order.create');
  update public.member_identity_assurances set phone_verified_at=now(),
    phone_verification_method='sms_otp',updated_at=now()
  where member_id='member-test-storefront';
  update public.welfare_accounts set balance_cents=10000,status='active',
    version=version+1,updated_at=now()
  where tenant_id='tenant-smart-wing' and enterprise_id='enterprise-demo'
    and mall_id='mall-demo' and user_id='user-test-storefront'
    and account_type in('welfare','meal');
  insert into inventory.stock_items(id,tenant_id,mall_id,sku_id,location_id,
    onhand,safety)
  values(stock_id,'tenant-smart-wing','mall-demo','sku-rice-5kg',location_id,10,0);
  insert into public.orders(id,order_no,tenant_id,enterprise_id,mall_id,user_id,
    status,goods_amount_cents,discount_cents,payable_cents,paid_cents,
    recipient_snapshot_json)
  values
    (paid_order,'CONTRACT-REPLAY-PAID-'||suffix,'tenant-smart-wing',
      'enterprise-demo','mall-demo','user-test-storefront','pending_payment',
      100,0,100,0,'{}'),
    (other_order,'CONTRACT-REPLAY-OTHER-'||suffix,'tenant-smart-wing',
      'enterprise-demo','mall-demo','user-test-storefront','pending_payment',
      100,0,100,0,'{}');
  insert into public.sub_orders(id,sub_order_no,tenant_id,mall_id,parent_order_id,
    supplier_id,status,amount_cents)
  select 'contract-replay-sub-'||ordinality||'-'||suffix,
    'CONTRACT-REPLAY-SUB-'||ordinality||'-'||suffix,'tenant-smart-wing',
    'mall-demo',order_id,'supplier-central','pending_payment',100
  from unnest(array[paid_order,other_order])
    with ordinality requested(order_id,ordinality);
  insert into public.order_items(id,tenant_id,mall_id,order_id,sub_order_id,
    product_id,sku_id,product_name_snapshot,specs_snapshot_json,
    unit_price_cents,quantity,line_amount_cents)
  select 'contract-replay-item-'||ordinality||'-'||suffix,
    'tenant-smart-wing','mall-demo',order_id,
    'contract-replay-sub-'||ordinality||'-'||suffix,'product-rice',
    'sku-rice-5kg','契约商品','{}',100,1,100
  from unnest(array[paid_order,other_order])
    with ordinality requested(order_id,ordinality);
  perform inventory.reserve('tenant-smart-wing','mall-demo',paid_order,
    jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg',
      'locationId',location_id,'quantity',1)),
    'contract-replay-reserve-paid-'||suffix,now()+interval '15 minutes');
  perform inventory.reserve('tenant-smart-wing','mall-demo',other_order,
    jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg',
      'locationId',location_id,'quantity',1)),
    'contract-replay-reserve-other-'||suffix,now()+interval '15 minutes');

  result:=public.api_pay_internal_authorized('tenant-smart-wing',
    'enterprise-demo','mall-demo','user-test-storefront',paid_order,100,0,
    payment_key,payment_hash,'contract-replay-request-'||suffix,'contract',
    'membership-test-storefront',evidence);
  replay:=public.api_pay_internal_authorized('tenant-smart-wing',
    'enterprise-demo','mall-demo','user-test-storefront',paid_order,100,0,
    payment_key,payment_hash,'contract-replay-exact-'||suffix,'contract',
    'membership-test-storefront',evidence);
  if replay<>result then raise exception 'CONTRACT_INTERNAL_EXACT_REPLAY_CHANGED'; end if;
  select balance_cents into strict welfare_balance from public.welfare_accounts
  where mall_id='mall-demo' and user_id='user-test-storefront'
    and account_type='welfare';
  select balance_cents into strict meal_balance from public.welfare_accounts
  where mall_id='mall-demo' and user_id='user-test-storefront'
    and account_type='meal';
  select count(*) into payment_count from public.payments
    where order_id in(paid_order,other_order);
  select count(*) into intent_count from public.payment_intents
    where order_id in(paid_order,other_order);
  select count(*) into outbox_count from public.payment_outbox
    where order_id in(paid_order,other_order);
  select count(*) into ledger_count from public.account_ledgers
    where business_id in(paid_order,other_order);

  begin
    perform public.api_pay_internal_authorized('tenant-smart-wing',
      'enterprise-demo','mall-demo','user-test-storefront',other_order,100,0,
      payment_key,payment_hash,'contract-replay-other-'||suffix,'contract',
      'membership-test-storefront',evidence);
    raise exception 'CONTRACT_INTERNAL_REPLAY_CHANGED_ORDER_ACCEPTED';
  exception when others then get stacked diagnostics error_message=message_text;
    if error_message not like '%IDEMPOTENCY_CONFLICT%' then raise; end if;
  end;
  begin
    perform public.api_pay_internal_authorized('tenant-smart-wing',
      'enterprise-demo','mall-demo','user-test-storefront',paid_order,0,100,
      payment_key,payment_hash,'contract-replay-allocation-'||suffix,'contract',
      'membership-test-storefront',evidence);
    raise exception 'CONTRACT_INTERNAL_REPLAY_CHANGED_TENDER_ACCEPTED';
  exception when others then get stacked diagnostics error_message=message_text;
    if error_message not like '%IDEMPOTENCY_CONFLICT%' then raise; end if;
  end;
  if(select balance_cents from public.welfare_accounts
      where mall_id='mall-demo' and user_id='user-test-storefront'
        and account_type='welfare')<>welfare_balance
    or(select balance_cents from public.welfare_accounts
      where mall_id='mall-demo' and user_id='user-test-storefront'
        and account_type='meal')<>meal_balance
    or(select count(*) from public.payments
      where order_id in(paid_order,other_order))<>payment_count
    or(select count(*) from public.payment_intents
      where order_id in(paid_order,other_order))<>intent_count
    or(select count(*) from public.payment_outbox
      where order_id in(paid_order,other_order))<>outbox_count
    or(select count(*) from public.account_ledgers
      where business_id in(paid_order,other_order))<>ledger_count
    or(select status from public.orders where id=other_order)<>'pending_payment'
    or exists(select 1 from public.idempotency_keys where resource_id=other_order)
  then raise exception 'CONTRACT_INTERNAL_REPLAY_CONFLICT_MUTATED_STATE'; end if;
  select lower(pg_get_functiondef(to_regprocedure(
    'public.api_pay_internal_authorized(text,text,text,text,text,bigint,bigint,text,text,text,text,text,jsonb)'
  ))) into strict function_definition;
  if position('payment-order:' in function_definition)=0
    or position('select * into v_order from public.orders' in function_definition)=0
    or position('payment-order:' in function_definition)>
      position('select * into v_order from public.orders' in function_definition)
  then raise exception 'CONTRACT_INTERNAL_PAYMENT_LOCK_ORDER_REGRESSED'; end if;
  select regexp_replace(lower(pg_get_functiondef(to_regprocedure(
    'public.emit_internal_payment_outbox()'))),'\s+','','g')
  into strict function_definition;
  if position('old.status<>''pending_payment''ornew.status<>''paid'''
      in function_definition)=0
  then raise exception 'CONTRACT_INTERNAL_CAPTURE_TRANSITION_REGRESSED'; end if;
end $$;

rollback;
