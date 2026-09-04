create or replace function public.api_import_test_catalog(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 200 then
    raise exception 'INVALID_TEST_CATALOG_BATCH';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where item->>'id' not like 'abo\_%' escape '\'
      or coalesce(item->>'externalId', '') = ''
      or coalesce(item->>'name', '') = ''
  ) then
    raise exception 'INVALID_TEST_CATALOG_ITEM';
  end if;

  insert into public.suppliers (
    id, tenant_id, code, name, settlement_mode, status
  ) values (
    'supplier-test-abo', 'tenant-smart-wing', 'ABO_TEST',
    'ABO非商业测试数据', 'none', 'active'
  )
  on conflict (id) do update set
    name = excluded.name,
    status = excluded.status;

  insert into public.products (
    id, tenant_id, mall_id, supplier_id, spu_code, name, subtitle,
    category_code, cover_url, detail_json, status, is_test
  )
  select
    item->>'id',
    'tenant-smart-wing',
    'mall-demo',
    'supplier-test-abo',
    'ABO-' || item->>'externalId',
    left(item->>'name', 500),
    left(item->>'subtitle', 500),
    item->>'categoryCode',
    item->>'coverUrl',
    coalesce(item->'detail', '{}'::jsonb),
    'active',
    true
  from jsonb_array_elements(p_items) item
  on conflict (id) do update set
    name = excluded.name,
    subtitle = excluded.subtitle,
    category_code = excluded.category_code,
    cover_url = excluded.cover_url,
    detail_json = excluded.detail_json,
    status = 'active',
    is_test = true,
    updated_at = now();

  insert into public.skus (
    id, tenant_id, mall_id, product_id, sku_code, specs_json,
    price_cents, market_price_cents, status
  )
  select
    'sku_' || item->>'id',
    'tenant-smart-wing',
    'mall-demo',
    item->>'id',
    'ABO-SKU-' || item->>'externalId',
    '{"数据状态":"测试数据"}'::jsonb,
    0,
    null,
    'active'
  from jsonb_array_elements(p_items) item
  on conflict (id) do update set
    specs_json = excluded.specs_json,
    price_cents = 0,
    market_price_cents = null,
    status = 'active',
    updated_at = now();

  insert into public.inventory (
    tenant_id, mall_id, sku_id, available_qty, reserved_qty
  )
  select
    'tenant-smart-wing',
    'mall-demo',
    'sku_' || item->>'id',
    0,
    0
  from jsonb_array_elements(p_items) item
  on conflict (sku_id) do update set
    available_qty = 0,
    reserved_qty = 0,
    updated_at = now();

  v_count := jsonb_array_length(p_items);
  return v_count;
end;
$$;

revoke all on function public.api_import_test_catalog(jsonb)
  from public, anon, authenticated;
grant execute on function public.api_import_test_catalog(jsonb)
  to service_role;
