begin;

do $$
<<atomic_checkout_contract>>
declare
  suffix text := substr(replace(gen_random_uuid()::text,'-',''),1,10);
  session_id uuid := gen_random_uuid();
  authz_version integer; credential_version integer;
  evidence jsonb; first_response jsonb; replay_response jsonb;
  stale_evidence jsonb;
  v_order_id text; v_cart_id text; v_stock_id text; error_message text;
  v_platform_id text; v_distributor_id text := 'contract-distributor-'||suffix;
  v_distributor_org_id text := 'contract-distributor-org-'||suffix;
  initial_onhand integer; price_cents bigint;
  before_orders bigint; before_suborders bigint; before_lines bigint;
  before_reservations bigint; before_commands bigint; before_movements bigint;
  before_idempotency bigint; before_audits bigint;
begin
  select membership.authz_version,credential.credential_version
  into strict authz_version,credential_version
  from public.memberships membership
  left join public.member_credentials credential
    on credential.member_id=membership.member_id
  where membership.id='membership-test-storefront';
  insert into public.auth_sessions (
    id,member_id,membership_id,target,credential_version,ip_hash,user_agent,
    device_label,expires_at
  ) values (
    session_id,'member-test-storefront','membership-test-storefront','storefront',
    credential_version,'atomic-contract-ip','atomic-contract','atomic-contract',
    now()+interval '1 hour'
  );
  evidence:=jsonb_build_object(
    'sessionId',session_id,'membershipId','membership-test-storefront',
    'authzVersion',authz_version,'permission','order.create'
  );

  select stock.id,stock.onhand into strict v_stock_id,initial_onhand
  from inventory.stock_items stock
  where stock.tenant_id='tenant-smart-wing' and stock.mall_id='mall-demo'
    and stock.sku_id='sku-rice-5kg' and stock.location_id='default';
  if (select cutover_status from inventory.stock_items where id=v_stock_id)<>'ready'
     or not exists(select 1 from inventory.cutover_reviews review
       where review.stock_item_id=v_stock_id and review.action='auto_zero_reserved')
     or not exists(select 1 from public.audit_logs audit
       where audit.resource_id=v_stock_id and audit.action='inventory.cutover.auto_ready')
  then raise exception 'CONTRACT_ZERO_RESERVED_CUTOVER_INVALID'; end if;

  insert into public.carts (id,tenant_id,mall_id,user_id,updated_at)
  values ('atomic-cart-'||suffix,'tenant-smart-wing','mall-demo',
    'user-test-storefront',now())
  on conflict (mall_id,user_id) do update set updated_at=excluded.updated_at
  returning id into v_cart_id;
  delete from public.cart_items item
  where item.cart_id=v_cart_id and item.sku_id='sku-rice-5kg';
  insert into public.cart_items (
    id,tenant_id,mall_id,cart_id,sku_id,quantity,selected
  ) values (
    'atomic-cart-line-'||suffix,'tenant-smart-wing','mall-demo',v_cart_id,
    'sku-rice-5kg',2,true
  );
  select sku.price_cents into strict price_cents from public.skus sku
  where sku.id='sku-rice-5kg';

  update public.member_identity_assurances
  set phone_verified_at=null,phone_verification_method=null,updated_at=now()
  where member_id='member-test-storefront';
  begin
    perform public.api_checkout_order_authorized(
      'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',
      '[{"skuId":"sku-rice-5kg","quantity":2}]'::jsonb,
      '{"ciphertext":"contract"}'::jsonb,'北京市','checkout-phone-'||suffix,
      repeat('A',43)||'=','contract-phone-'||suffix,'contract',
      'membership-test-storefront',evidence
    );
    raise exception 'CONTRACT_UNVERIFIED_PHONE_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%PHONE_VERIFICATION_REQUIRED%' then raise; end if;
  end;
  update public.member_identity_assurances
  set phone_verified_at=now(),phone_verification_method='sms_otp',updated_at=now()
  where member_id='member-test-storefront';
  begin
    perform public.api_checkout_order_authorized(
      'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',
      '[{"skuId":"sku-rice-5kg","quantity":2}]'::jsonb,
      '{"ciphertext":"contract"}'::jsonb,'北京市','checkout-session-'||suffix,
      repeat('A',43)||'=','contract-session-'||suffix,'contract',
      'membership-test-storefront',evidence-'sessionId'
    );
    raise exception 'CONTRACT_UNTRACKED_SESSION_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%CHECKOUT_AUTHORIZATION_EVIDENCE_INVALID%' then raise; end if;
  end;
  begin
    perform public.api_checkout_order_authorized(
      'tenant-smart-wing','enterprise-demo','mall-demo','user-test-owner',
      '[{"skuId":"sku-rice-5kg","quantity":2}]'::jsonb,
      '{"ciphertext":"contract"}'::jsonb,'北京市','checkout-scope-'||suffix,
      repeat('A',43)||'=','contract-scope-'||suffix,'contract',
      'membership-test-storefront',evidence
    );
    raise exception 'CONTRACT_CALLER_SCOPE_TRUSTED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%CHECKOUT_SCOPE_MISMATCH%' then raise; end if;
  end;

  first_response:=public.api_checkout_order_authorized(
    'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',
    '[{"quantity":2,"skuId":"sku-rice-5kg"}]'::jsonb,
    '{"ciphertext":"contract"}'::jsonb,'北京市','checkout-success-'||suffix,
    repeat('B',43)||'=','contract-success-'||suffix,'contract',
    'membership-test-storefront',evidence
  );
  v_order_id:=first_response#>>'{order,id}';
  if v_order_id is null
     or (first_response->>'cartItemsRemoved')::integer<>1
     or (first_response#>>'{order,payableCents}')::bigint<>price_cents*2
     or (select count(*) from public.orders where id=v_order_id
       and tenant_id='tenant-smart-wing' and enterprise_id='enterprise-demo'
       and mall_id='mall-demo' and user_id='user-test-storefront')<>1
     or (select count(*) from public.sub_orders where parent_order_id=v_order_id)<>1
     or (select count(*) from public.order_items where order_id=v_order_id
       and sku_id='sku-rice-5kg' and quantity=2 and unit_price_cents=price_cents)<>1
     or (select count(*) from inventory.reservations where order_id=v_order_id
       and state='active' and quantity=2)<>1
     or (select count(*) from inventory.movements where order_id=v_order_id
       and kind='reserve' and quantity=2)<>1
     or exists(select 1 from public.cart_items item
       where item.cart_id=v_cart_id and item.sku_id='sku-rice-5kg')
     or (select onhand from inventory.stock_items where id=v_stock_id)<>initial_onhand
     or inventory.available_stock('tenant-smart-wing','mall-demo','sku-rice-5kg')<>initial_onhand-2
     or not exists(select 1 from public.audit_logs where resource_id=v_order_id
       and action='checkout.order.create' and membership_id='membership-test-storefront')
     or not exists(select 1 from public.idempotency_keys where resource_id=v_order_id
       and scope='checkout:order')
  then raise exception 'CONTRACT_ATOMIC_CHECKOUT_RESULT_INVALID'; end if;

  if to_regclass('public.inventory') is not null then
    raise exception 'CONTRACT_LEGACY_INVENTORY_RELATION_REMAINS';
  end if;

  replay_response:=public.api_checkout_order_authorized(
    'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',
    '[{"skuId":"sku-rice-5kg","quantity":2}]'::jsonb,
    '{"ciphertext":"retry-cipher"}'::jsonb,'北京市','checkout-success-'||suffix,
    repeat('B',43)||'=','contract-replay-'||suffix,'contract',
    'membership-test-storefront',evidence
  );
  if replay_response<>first_response
     or (select count(*) from public.orders where id=v_order_id)<>1
     or (select count(*) from inventory.reservations where order_id=v_order_id)<>1
  then raise exception 'CONTRACT_CHECKOUT_REPLAY_INVALID'; end if;
  begin
    perform public.api_checkout_order_authorized(
      'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',
      '[{"skuId":"sku-rice-5kg","quantity":2}]'::jsonb,
      '{"ciphertext":"contract"}'::jsonb,'北京市','checkout-success-'||suffix,
      repeat('C',43)||'=','contract-conflict-'||suffix,'contract',
      'membership-test-storefront',evidence
    );
    raise exception 'CONTRACT_CHECKOUT_IDEMPOTENCY_CONFLICT_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%IDEMPOTENCY_CONFLICT%' then raise; end if;
  end;

  insert into public.cart_items (
    id,tenant_id,mall_id,cart_id,sku_id,quantity,selected
  ) values (
    'atomic-insufficient-line-'||suffix,'tenant-smart-wing','mall-demo',v_cart_id,
    'sku-rice-5kg',1,true
  );
  update inventory.stock_items
  set safety=onhand-2,version=version+1 where id=v_stock_id;
  select count(*) into before_orders from public.orders;
  select count(*) into before_suborders from public.sub_orders;
  select count(*) into before_lines from public.order_items;
  select count(*) into before_reservations from inventory.reservations;
  select count(*) into before_commands from inventory.commands;
  select count(*) into before_movements from inventory.movements;
  select count(*) into before_idempotency from public.idempotency_keys;
  select count(*) into before_audits from public.audit_logs;
  begin
    perform public.api_checkout_order_authorized(
      'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',
      '[{"skuId":"sku-rice-5kg","quantity":1}]'::jsonb,
      '{"ciphertext":"contract"}'::jsonb,'北京市','checkout-insufficient-'||suffix,
      repeat('D',43)||'=','contract-insufficient-'||suffix,'contract',
      'membership-test-storefront',evidence
    );
    raise exception 'CONTRACT_CHECKOUT_OVERSELL_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%INSUFFICIENT_INVENTORY%' then raise; end if;
  end;
  if (select count(*) from public.orders)<>before_orders
     or (select count(*) from public.sub_orders)<>before_suborders
     or (select count(*) from public.order_items)<>before_lines
     or (select count(*) from inventory.reservations)<>before_reservations
     or (select count(*) from inventory.commands)<>before_commands
     or (select count(*) from inventory.movements)<>before_movements
     or (select count(*) from public.idempotency_keys)<>before_idempotency
     or (select count(*) from public.audit_logs)<>before_audits
     or not exists(select 1 from public.cart_items item
       where item.cart_id=v_cart_id
         and item.sku_id='sku-rice-5kg' and item.quantity=1)
  then raise exception 'CONTRACT_INSUFFICIENT_CHECKOUT_NOT_ROLLED_BACK'; end if;

  select unit.id into strict v_platform_id from public.org_units unit
  where unit.kind='platform' and unit.status='active';
  insert into public.org_units (id,parent_id,kind,code,name,status)
  values (v_distributor_org_id,v_platform_id,'distributor','d-'||suffix,
    'Contract Distributor','active');
  insert into public.distributors (id,code,name,org_unit_id,status)
  values (v_distributor_id,'contract-'||suffix,'Contract Distributor',
    v_distributor_org_id,'active');
  insert into public.distributor_tenants (
    distributor_id,tenant_id,starts_at,agreement_evidence_json,status
  ) values (
    v_distributor_id,'tenant-smart-wing',now()-interval '2 hours',
    jsonb_build_object('contract',true),'active'
  );
  insert into public.membership_scopes (membership_id,scope_kind,resource_id)
  values ('membership-test-storefront','distributor',v_distributor_id);
  update public.distributor_tenants
  set status='expired',ends_at=now()-interval '1 minute',updated_at=now()
  where distributor_id=v_distributor_id and tenant_id='tenant-smart-wing';
  select membership.authz_version into strict authz_version
  from public.memberships membership
  where membership.id='membership-test-storefront';
  stale_evidence:=evidence||jsonb_build_object('authzVersion',authz_version);
  if public.api_membership_distributor_anchor_valid('membership-test-storefront')
     or public.api_membership_actor_matches(
       'membership-test-storefront','user-test-storefront','storefront'
     )
  then raise exception 'CONTRACT_STALE_DISTRIBUTOR_ANCHOR_ACCEPTED'; end if;
  begin
    perform public.api_checkout_order_authorized(
      'tenant-smart-wing','enterprise-demo','mall-demo','user-test-storefront',
      '[{"skuId":"sku-rice-5kg","quantity":1}]'::jsonb,
      '{"ciphertext":"contract"}'::jsonb,'北京市','checkout-stale-d-'||suffix,
      repeat('E',43)||'=','contract-stale-d-'||suffix,'contract',
      'membership-test-storefront',stale_evidence
    );
    raise exception 'CONTRACT_STALE_DISTRIBUTOR_CHECKOUT_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%CHECKOUT_ACTOR_NOT_AUTHORIZED%' then raise; end if;
  end;

  if exists(
    select 1 from pg_proc function join pg_namespace namespace
      on namespace.oid=function.pronamespace
    where namespace.nspname='public' and function.proname in (
      'api_create_order','api_create_order_authorized',
      'api_create_order_and_clear_cart_authorized','api_delete_ordered_cart_items'
    )
  ) or (select count(*) from pg_proc function join pg_namespace namespace
    on namespace.oid=function.pronamespace where namespace.nspname='public'
      and function.proname='api_checkout_order_authorized')<>1
  then raise exception 'CONTRACT_LEGACY_CHECKOUT_ENTRY_REMAINS'; end if;
  if not has_function_privilege('service_role',
       'public.api_checkout_order_authorized(text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb)','execute')
     or has_function_privilege('anon',
       'public.api_checkout_order_authorized(text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb)','execute')
     or has_function_privilege('authenticated',
       'public.api_checkout_order_authorized(text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb)','execute')
  then raise exception 'CONTRACT_CHECKOUT_RPC_ACL_INVALID'; end if;
end atomic_checkout_contract;
$$;

rollback;
