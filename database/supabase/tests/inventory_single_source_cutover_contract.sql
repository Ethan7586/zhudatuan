begin;

do $$
<<inventory_cutover_contract>>
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  session_id uuid:=gen_random_uuid();
  factor_id text:='inventory-cutover-factor-'||suffix;
  challenge_id text:='inventory-cutover-stepup-'||suffix;
  target_mall_id text:='inventory-cutover-mall-'||suffix;
  target_product_id text:='inventory-cutover-product-'||suffix;
  target_sku_id text:='inventory-cutover-sku-'||suffix;
  target_stock_id text:='inventory-cutover-stock-'||suffix||'-001';
  authz_version integer; credential_version integer;
  verified_at timestamptz:=clock_timestamp();
  cutover_evidence jsonb; inventory_evidence jsonb;
  status_result jsonb; review_result jsonb; replay_result jsonb;
  supplier_result jsonb; error_message text;
  supplier_product_id text; supplier_sku_id text;
begin
  select membership.authz_version,credential.credential_version
  into strict authz_version,credential_version
  from public.memberships membership
  left join public.member_credentials credential
    on credential.member_id=membership.member_id
  where membership.id='membership-test-owner-admin';
  insert into public.auth_sessions(
    id,member_id,membership_id,target,credential_version,ip_hash,
    user_agent,device_label,expires_at
  ) values (
    session_id,'member-test-owner','membership-test-owner-admin','admin',
    credential_version,'inventory-contract-ip','inventory-contract',
    'inventory-contract',now()+interval '1 hour'
  );
  insert into public.admin_mfa_factors(
    id,tenant_id,user_id,factor_type,secret_ciphertext,label,status
  ) values (
    factor_id,'tenant-smart-wing','user-test-owner','totp',repeat('i',32),
    'Inventory cutover contract','active'
  ) on conflict(user_id,factor_type) do update set status='active'
  returning id into factor_id;
  insert into public.admin_step_up_challenges(
    id,membership_id,user_id,session_id,factor_id,status,attempts,
    request_id,created_at,expires_at,verified_at,updated_at
  ) values (
    challenge_id,'membership-test-owner-admin','user-test-owner',session_id::text,
    factor_id,'verified',0,'inventory-cutover-'||suffix,verified_at,
    verified_at+interval '5 minutes',verified_at,verified_at
  );
  cutover_evidence:=jsonb_build_object(
    'sessionId',session_id,'membershipId','membership-test-owner-admin',
    'authzVersion',authz_version,'permission','inventory.cutover.manage',
    'stepUpAt',verified_at
  );
  inventory_evidence:=cutover_evidence||jsonb_build_object(
    'permission','inventory.update'
  );

  insert into public.malls(
    id,tenant_id,enterprise_id,code,public_slug,name,brand_name
  ) values (
    target_mall_id,'tenant-smart-wing','enterprise-demo','INV-'||suffix,
    'inventory-cutover-'||suffix,'Inventory Cutover Contract','Contract'
  );
  insert into public.products(
    id,tenant_id,mall_id,supplier_id,spu_code,name,category_code,status,
    classification_status,classification_confidence
  ) values (
    target_product_id,'tenant-smart-wing',target_mall_id,'supplier-central',
    'INV-SPU-'||suffix,'Inventory Cutover Product','welfare','active','pending',0
  );
  insert into public.skus(
    id,tenant_id,mall_id,product_id,sku_code,price_cents,status
  ) values (
    target_sku_id,'tenant-smart-wing',target_mall_id,target_product_id,
    'INV-SKU-'||suffix,100,'active'
  );
  insert into inventory.stock_items(
    id,tenant_id,mall_id,sku_id,location_id,onhand,safety,cutover_status
  ) select
    'inventory-cutover-stock-'||suffix||'-'||lpad(series::text,3,'0'),
    'tenant-smart-wing',target_mall_id,target_sku_id,
    'contract-'||lpad(series::text,3,'0'),10,0,'manual_review'
  from generate_series(1,101) series;
  insert into inventory.cutover_records(
    tenant_id,mall_id,stock_item_id,source_relation,legacy_available,
    legacy_reserved,status,reason
  ) select
    'tenant-smart-wing',target_mall_id,stock.id,'contract.inventory',10,1,
    'manual_review','reservation_ownership_missing'
  from inventory.stock_items stock where stock.mall_id=target_mall_id;

  begin
    perform public.api_inventory_cutover_status_authorized(
      'membership-test-owner-admin','user-test-owner','tenant-smart-wing',
      cutover_evidence-'stepUpAt',null,7
    );
    raise exception 'CONTRACT_CUTOVER_WITHOUT_STEPUP_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%INVENTORY_CUTOVER_NOT_AUTHORIZED%' then raise; end if;
  end;
  status_result:=public.api_inventory_cutover_status_authorized(
    'membership-test-owner-admin','user-test-owner','tenant-smart-wing',
    cutover_evidence,null,7
  );
  if (status_result->>'deploymentReady')::boolean
     or (status_result->>'manualReviewCount')::integer<>101
     or jsonb_array_length(status_result->'items')<>7
     or status_result->>'nextCursor' is null
     or status_result#>>'{items,0,mallId}'<>target_mall_id
  then raise exception 'CONTRACT_CUTOVER_GLOBAL_PAGE_INVALID'; end if;

  review_result:=public.api_review_inventory_cutover_authorized(
    'membership-test-owner-admin','user-test-owner','tenant-smart-wing',
    target_stock_id,0,12,'physical-count-'||suffix,'cutover-key-'||suffix,
    repeat('R',43)||'=','cutover-review-'||suffix,'contract',cutover_evidence
  );
  replay_result:=public.api_review_inventory_cutover_authorized(
    'membership-test-owner-admin','user-test-owner','tenant-smart-wing',
    target_stock_id,0,12,'physical-count-'||suffix,'cutover-key-'||suffix,
    repeat('R',43)||'=','cutover-replay-'||suffix,'contract',cutover_evidence
  );
  if replay_result<>review_result
     or (select cutover_status from inventory.stock_items
       where id=target_stock_id)<>'ready'
     or (select onhand from inventory.stock_items where id=target_stock_id)<>12
     or (select count(*) from inventory.cutover_reviews
       where stock_item_id=target_stock_id)<>1
     or not exists(select 1 from public.audit_logs audit
       where audit.resource_id=target_stock_id
         and audit.action='inventory.cutover.release_orphaned')
  then raise exception 'CONTRACT_CUTOVER_REVIEW_INVALID'; end if;
  begin
    perform public.api_review_inventory_cutover_authorized(
      'membership-test-owner-admin','user-test-owner','tenant-smart-wing',
      target_stock_id,0,13,'physical-count-'||suffix,'cutover-key-'||suffix,
      repeat('S',43)||'=','cutover-conflict-'||suffix,'contract',cutover_evidence
    );
    raise exception 'CONTRACT_CUTOVER_IDEMPOTENCY_CONFLICT_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%IDEMPOTENCY_CONFLICT%' then raise; end if;
  end;
  status_result:=public.api_inventory_cutover_status_authorized(
    'membership-test-owner-admin','user-test-owner','tenant-smart-wing',
    cutover_evidence,null,7
  );
  if (status_result->>'manualReviewCount')::integer<>100 then
    raise exception 'CONTRACT_CUTOVER_GLOBAL_COUNT_STALE';
  end if;

  supplier_result:=public.api_upsert_supplier_catalog(
    'tenant-smart-wing','enterprise-demo','mall-demo','user-test-owner',
    'contract_'||suffix,'Contract Supplier',jsonb_build_array(jsonb_build_object(
      'externalSpuId','spu-'||suffix,'externalSkuId','sku-'||suffix,
      'name','Contract Supplier Product','priceCents',100,'availableStock',9
    )),'supplier-key-'||suffix,repeat('T',43)||'=','supplier-'||suffix,
    'contract','membership-test-owner-admin',inventory_evidence
  );
  if (supplier_result->>'itemsWritten')::integer<>1
     or not exists(select 1 from inventory.stock_items stock
       where stock.sku_id='sku-source-'||md5(
         'mall-demo:contract_'||suffix||':sku-'||suffix
       ) and stock.onhand=9 and stock.cutover_status='ready')
     or not exists(select 1 from inventory.observations observation
       where observation.source_kind='contract_'||suffix
         and observation.observed_onhand=9 and observation.disposition='accepted')
     or not exists(select 1 from inventory.sync_states state
       where state.source_reference='contract_'||suffix and state.state='completed')
  then raise exception 'CONTRACT_CANONICAL_SUPPLIER_SYNC_INVALID'; end if;

  supplier_product_id:='product-source-'||md5(
    'mall-demo:contract_'||suffix||':spu-'||suffix
  );
  supplier_sku_id:='sku-source-'||md5(
    'mall-demo:contract_'||suffix||':sku-'||suffix
  );
  supplier_result:=public.api_upsert_supplier_catalog(
    'tenant-smart-wing','enterprise-demo','mall-demo','user-test-owner',
    'contract_'||suffix,'Contract Supplier',jsonb_build_array(jsonb_build_object(
      'externalSpuId','spu-'||suffix,'externalSkuId','sku-'||suffix,
      'name','Changed Product','priceCents',110,'availableStock',0
    )),'supplier-refresh-'||suffix,repeat('U',43)||'=','supplier-refresh-'||suffix,
    'contract','membership-test-owner-admin',inventory_evidence
  );
  if supplier_result->>'status'<>'blocked_reconciliation'
     or (supplier_result->>'blockedStockItems')::integer<>1
  then raise exception 'CONTRACT_STALE_SUPPLIER_SNAPSHOT_WAS_NOT_BLOCKED'; end if;
  if (select name from public.products where id=supplier_product_id)
       <>'Contract Supplier Product'
     or (select price_cents from public.skus where id=supplier_sku_id)<>100
     or (select status from public.skus where id=supplier_sku_id)<>'inactive'
     or (select onhand from inventory.stock_items where sku_id=supplier_sku_id)<>9
     or (select count(*) from inventory.observations observation
       where observation.sku_id=supplier_sku_id)<>2
     or not exists(select 1 from inventory.observations observation
       where observation.sku_id=supplier_sku_id
         and observation.observed_onhand=0 and observation.disposition='pending')
     or (select state from inventory.sync_states state
       where state.source_reference='contract_'||suffix)<>'failed'
  then raise exception 'CONTRACT_REJECTED_SUPPLIER_SYNC_LEFT_SIDE_EFFECTS'; end if;

  if to_regclass('public.inventory') is not null
     or to_regprocedure('public.api_import_test_catalog(jsonb)') is not null
     or to_regprocedure('public.api_test_catalog_stats()') is not null
     or to_regprocedure('public.purge_test_catalog(text)') is not null
     or has_function_privilege('service_role',
       'inventory.lock_cutover_operator(text,text,text,jsonb)','execute')
     or has_function_privilege('anon',
       'public.api_review_inventory_cutover_authorized(text,text,text,text,bigint,integer,text,text,text,text,text,jsonb)','execute')
     or not has_function_privilege('service_role',
       'public.api_review_inventory_cutover_authorized(text,text,text,text,bigint,integer,text,text,text,text,text,jsonb)','execute')
  then raise exception 'CONTRACT_INVENTORY_CUTOVER_ACL_INVALID'; end if;
end inventory_cutover_contract;
$$;

rollback;
