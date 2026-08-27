begin;

do $$
<<inventory_lifecycle_contract>>
declare
  suffix text := substr(replace(gen_random_uuid()::text,'-',''),1,10);
  location_id text := 'contract-'||suffix;
  stock_id text := 'contract-stock-'||suffix;
  manual_location_id text := 'manual-'||suffix;
  manual_stock_id text := 'manual-stock-'||suffix;
  commit_order_id text := 'contract-inventory-commit-'||suffix;
  release_order_id text := 'contract-inventory-release-'||suffix;
  expire_order_id text := 'contract-inventory-expire-'||suffix;
  oversell_order_id text := 'contract-inventory-oversell-'||suffix;
  legacy_order_id text := 'contract-inventory-legacy-'||suffix;
  sub_order_id text := 'contract-inventory-sub-'||suffix;
  after_sale_id text := 'contract-inventory-return-'||suffix;
  inspection_reference text := 'contract-inspection-'||suffix;
  manual_command_id text;
  first_response jsonb; replay_response jsonb; error_message text;
begin
  insert into inventory.stock_items (
    id,tenant_id,mall_id,sku_id,location_id,onhand,safety
  ) values (
    stock_id,'tenant-smart-wing','mall-demo','sku-rice-5kg',location_id,10,1
  );
  insert into inventory.stock_items (
    id,tenant_id,mall_id,sku_id,location_id,onhand,safety,cutover_status
  ) values (
    manual_stock_id,'tenant-smart-wing','mall-demo','sku-rice-5kg',
    manual_location_id,4,0,'manual_review'
  );
  insert into inventory.cutover_records (
    tenant_id,mall_id,stock_item_id,source_relation,legacy_available,
    legacy_reserved,status,reason
  ) values (
    'tenant-smart-wing','mall-demo',manual_stock_id,'contract.legacy',4,1,
    'manual_review','reservation_ownership_missing'
  );
  insert into public.orders (
    id,order_no,tenant_id,enterprise_id,mall_id,user_id,status,goods_amount_cents,
    discount_cents,payable_cents,paid_cents,recipient_snapshot_json
  ) values
    (commit_order_id,'INV-COMMIT-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo',
     'user-test-storefront','pending_payment',500,0,500,0,'{}'::jsonb),
    (release_order_id,'INV-RELEASE-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo',
     'user-test-storefront','pending_payment',200,0,200,0,'{}'::jsonb),
    (expire_order_id,'INV-EXPIRE-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo',
     'user-test-storefront','pending_payment',100,0,100,0,'{}'::jsonb),
    (oversell_order_id,'INV-OVERSELL-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo',
     'user-test-storefront','pending_payment',500,0,500,0,'{}'::jsonb),
    (legacy_order_id,'INV-LEGACY-'||suffix,'tenant-smart-wing','enterprise-demo','mall-demo',
     'user-test-storefront','pending_payment',100,0,100,0,'{}'::jsonb);
  insert into public.sub_orders (
    id,sub_order_no,tenant_id,mall_id,parent_order_id,supplier_id,status,amount_cents
  ) values (
    sub_order_id,'INV-SUB-'||suffix,'tenant-smart-wing','mall-demo',commit_order_id,
    'supplier-central','pending_payment',500
  );
  insert into public.order_items (
    id,tenant_id,mall_id,order_id,sub_order_id,product_id,sku_id,
    product_name_snapshot,specs_snapshot_json,unit_price_cents,quantity,line_amount_cents
  ) values (
    'contract-inventory-line-'||suffix,'tenant-smart-wing','mall-demo',commit_order_id,
    sub_order_id,'product-rice','sku-rice-5kg','契约商品','{}'::jsonb,100,5,500
  );

  first_response:=inventory.reserve(
    'tenant-smart-wing','mall-demo',commit_order_id,
    jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg','locationId',location_id,'quantity',5)),
    'reserve-commit-'||suffix,clock_timestamp()+interval '15 minutes'
  );
  replay_response:=inventory.reserve(
    'tenant-smart-wing','mall-demo',commit_order_id,
    jsonb_build_array(jsonb_build_object('quantity',5,'locationId',location_id,'skuId','sku-rice-5kg')),
    'reserve-commit-'||suffix,(first_response#>>'{reservations,0,expiresAt}')::timestamptz
  );
  if first_response<>replay_response
     or (select count(*) from inventory.reservations where order_id=commit_order_id)<>1
     or (select onhand from inventory.stock_items where id=stock_id)<>10
  then raise exception 'CONTRACT_INVENTORY_RESERVE_REPLAY_FAILED'; end if;

  begin
    perform inventory.reserve(
      'tenant-smart-wing','mall-demo',commit_order_id,
      jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg','locationId',location_id,'quantity',4)),
      'reserve-commit-'||suffix,clock_timestamp()+interval '15 minutes'
    );
    raise exception 'CONTRACT_INVENTORY_IDEMPOTENCY_CONFLICT_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%INVENTORY_IDEMPOTENCY_CONFLICT%' then raise; end if;
  end;
  begin
    perform inventory.reserve(
      'tenant-smart-wing','mall-demo',oversell_order_id,
      jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg','locationId',location_id,'quantity',5)),
      'reserve-oversell-'||suffix,clock_timestamp()+interval '15 minutes'
    );
    raise exception 'CONTRACT_INVENTORY_OVERSELL_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%INSUFFICIENT_INVENTORY%' then raise; end if;
  end;
  begin
    perform inventory.commit('tenant-smart-wing','mall-demo',commit_order_id,'commit-before-pay-'||suffix);
    raise exception 'CONTRACT_INVENTORY_UNPAID_COMMIT_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%INVENTORY_PAYMENT_REQUIRED%' then raise; end if;
  end;
  update public.orders set status='paid',paid_cents=payable_cents,paid_at=now()
  where id=commit_order_id;
  perform inventory.commit('tenant-smart-wing','mall-demo',commit_order_id,'commit-'||suffix);
  perform inventory.commit('tenant-smart-wing','mall-demo',commit_order_id,'commit-replay-'||suffix);
  if (select state from inventory.reservations where order_id=commit_order_id)<>'committed'
     or (select onhand from inventory.stock_items where id=stock_id)<>5
     or (select count(*) from inventory.movements where order_id=commit_order_id and kind='sale')<>1
  then raise exception 'CONTRACT_INVENTORY_COMMIT_INVALID'; end if;

  perform inventory.reserve(
    'tenant-smart-wing','mall-demo',release_order_id,
    jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg','locationId',location_id,'quantity',2)),
    'reserve-release-'||suffix,clock_timestamp()+interval '15 minutes'
  );
  update public.orders set status='cancelled' where id=release_order_id;
  perform inventory.release('tenant-smart-wing','mall-demo',release_order_id,'cancelled','release-'||suffix);
  perform inventory.release('tenant-smart-wing','mall-demo',release_order_id,'cancelled','release-replay-'||suffix);
  if (select state from inventory.reservations where order_id=release_order_id)<>'released'
     or (select onhand from inventory.stock_items where id=stock_id)<>5
     or (select count(*) from inventory.movements where order_id=release_order_id and kind='release')<>1
  then raise exception 'CONTRACT_INVENTORY_RELEASE_INVALID'; end if;

  insert into inventory.commands (
    tenant_id,mall_id,operation,idempotency_key,request_json,response_json,completed_at
  ) values (
    'tenant-smart-wing','mall-demo','reserve','manual-expire-'||suffix,'{}'::jsonb,'{}'::jsonb,now()
  ) returning id into manual_command_id;
  insert into inventory.reservations (
    tenant_id,mall_id,order_id,stock_item_id,sku_id,location_id,quantity,expires_at,created_by_command_id
  ) values (
    'tenant-smart-wing','mall-demo',expire_order_id,stock_id,'sku-rice-5kg',location_id,1,
    clock_timestamp()-interval '1 minute',manual_command_id
  );
  update inventory.stock_items set version=version+1 where id=stock_id;
  perform inventory.expire('tenant-smart-wing','mall-demo',expire_order_id,'expire-'||suffix);
  perform inventory.expire('tenant-smart-wing','mall-demo',expire_order_id,'expire-replay-'||suffix);
  if (select state from inventory.reservations where order_id=expire_order_id)<>'expired'
     or (select count(*) from inventory.movements where order_id=expire_order_id and kind='expire')<>1
  then raise exception 'CONTRACT_INVENTORY_EXPIRE_INVALID'; end if;

  begin
    update inventory.reservations set state='active',committed_at=null,version=version+1
    where order_id=commit_order_id;
    raise exception 'CONTRACT_INVENTORY_TERMINAL_TRANSITION_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%INVENTORY_RESERVATION_TRANSITION_INVALID%' then raise; end if;
  end;
  begin
    perform inventory.reserve(
      'tenant-smart-wing','mall-demo',legacy_order_id,
      jsonb_build_array(jsonb_build_object(
        'skuId','sku-rice-5kg','locationId',manual_location_id,'quantity',1
      )),
      'reserve-legacy-'||suffix,clock_timestamp()+interval '15 minutes'
    );
    raise exception 'CONTRACT_INVENTORY_LEGACY_HISTORY_TRUSTED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%INVENTORY_HISTORY_REQUIRES_REVIEW%' then raise; end if;
  end;

  insert into public.after_sales (
    id,after_sale_no,tenant_id,mall_id,user_id,order_id,type,status,reason,
    requested_amount_cents,requested_by_membership_id,requested_by_member_id,
    order_status_before_request,migration_status
  ) values (
    after_sale_id,'INV-AS-'||suffix,'tenant-smart-wing','mall-demo','user-test-storefront',
    commit_order_id,'return_refund','completed','契约测试退货',200,
    'membership-test-storefront','member-test-storefront','paid','ready'
  );
  begin
    perform inventory.restock(
      'tenant-smart-wing','mall-demo',commit_order_id,after_sale_id,inspection_reference,
      jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg','locationId',location_id,'quantity',2)),
      'restock-no-inspection-'||suffix
    );
    raise exception 'CONTRACT_INVENTORY_UNINSPECTED_RESTOCK_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%INVENTORY_RESTOCK_INSPECTION_REQUIRED%' then raise; end if;
  end;
  insert into inventory.observations (
    tenant_id,mall_id,stock_item_id,sku_id,location_id,observation_kind,source_kind,
    source_reference,observed_quantity,disposition,payload_json,observed_at
  ) values (
    'tenant-smart-wing','mall-demo',stock_id,'sku-rice-5kg',location_id,'return_inspection',
    'quality',inspection_reference,2,'accepted',
    jsonb_build_object('restockEligible',true,'itemKind','physical',
      'orderId',commit_order_id,'afterSaleId',after_sale_id),clock_timestamp()
  );
  perform inventory.restock(
    'tenant-smart-wing','mall-demo',commit_order_id,after_sale_id,inspection_reference,
    jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg','locationId',location_id,'quantity',2)),
    'restock-'||suffix
  );
  perform inventory.restock(
    'tenant-smart-wing','mall-demo',commit_order_id,after_sale_id,inspection_reference,
    jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg','locationId',location_id,'quantity',2)),
    'restock-replay-'||suffix
  );
  if (select onhand from inventory.stock_items where id=stock_id)<>7
     or (select count(*) from inventory.movements where kind='restock' and business_reference=inspection_reference)<>1
  then raise exception 'CONTRACT_INVENTORY_RESTOCK_REPLAY_INVALID'; end if;
  insert into inventory.observations (
    tenant_id,mall_id,stock_item_id,sku_id,location_id,observation_kind,source_kind,
    source_reference,observed_quantity,disposition,payload_json,observed_at
  ) values (
    'tenant-smart-wing','mall-demo',stock_id,'sku-rice-5kg',location_id,'return_inspection',
    'quality','contract-inspection-over-'||suffix,4,'accepted',
    jsonb_build_object('restockEligible',true,'itemKind','physical',
      'orderId',commit_order_id,'afterSaleId',after_sale_id),clock_timestamp()
  );
  begin
    perform inventory.restock(
      'tenant-smart-wing','mall-demo',commit_order_id,after_sale_id,
      'contract-inspection-over-'||suffix,
      jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg','locationId',location_id,'quantity',4)),
      'restock-over-'||suffix
    );
    raise exception 'CONTRACT_INVENTORY_OVER_RESTOCK_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%INVENTORY_RESTOCK_QUANTITY_INVALID%' then raise; end if;
  end;
  begin
    update inventory.movements set quantity=quantity+1
    where order_id=commit_order_id and kind='sale';
    raise exception 'CONTRACT_INVENTORY_MOVEMENT_MUTABLE';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%movements_IS_IMMUTABLE%' then raise; end if;
  end;

  if not exists(
       select 1 from inventory.cutover_records record join inventory.stock_items stock
         on stock.id=record.stock_item_id
       where stock.id=manual_stock_id and stock.location_id=manual_location_id
         and stock.cutover_status='manual_review' and record.status='manual_review'
     )
  then raise exception 'CONTRACT_INVENTORY_CUTOVER_NOT_FAIL_CLOSED'; end if;
  if exists(
       select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
       where namespace.nspname='inventory' and relation.relkind in ('r','p')
         and (has_table_privilege('service_role',relation.oid,'select')
           or has_table_privilege('service_role',relation.oid,'insert')
           or has_table_privilege('service_role',relation.oid,'update')
           or has_table_privilege('service_role',relation.oid,'delete'))
     )
     or has_function_privilege('service_role',
       'inventory.begin_command(text,text,text,text,jsonb)','execute')
     or (select count(*) from pg_proc function join pg_namespace namespace
       on namespace.oid=function.pronamespace where namespace.nspname='inventory'
       and function.proname in ('reserve','commit','release','expire','restock'))<>5
     or exists(
       select 1 from pg_proc function join pg_namespace namespace on namespace.oid=function.pronamespace
       where namespace.nspname='inventory'
         and function.proname in ('reserve','commit','release','expire','restock')
         and (not has_function_privilege('service_role',function.oid,'execute')
           or has_function_privilege('authenticated',function.oid,'execute')
           or has_function_privilege('anon',function.oid,'execute'))
     )
  then raise exception 'CONTRACT_INVENTORY_ACL_INVALID'; end if;
end inventory_lifecycle_contract;
$$;

rollback;
