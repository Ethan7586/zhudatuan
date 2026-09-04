-- Supplier catalogue ingestion: one idempotent, tenant-scoped write path for
-- JD / Tmall / cake / book / voucher adapters.  Credentials remain outside the
-- database and are never accepted as part of a catalogue payload.

alter table public.products
  add column if not exists source_code text,
  add column if not exists source_spu_id text;

alter table public.skus
  add column if not exists source_code text,
  add column if not exists source_sku_id text;

create unique index if not exists uq_products_source_spu
  on public.products (mall_id, source_code, source_spu_id)
  where source_code is not null and source_spu_id is not null;

create unique index if not exists uq_skus_source_sku
  on public.skus (mall_id, source_code, source_sku_id)
  where source_code is not null and source_sku_id is not null;

create or replace function public.api_upsert_supplier_catalog(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_operator_user_id text,
  p_source text,
  p_supplier_name text,
  p_items jsonb,
  p_idempotency_key text,
  p_request_hash text,
  p_request_id text,
  p_user_agent text,
  p_membership_id text,
  p_granted_via jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_existing public.idempotency_keys%rowtype;
  v_supplier_id text;
  v_item jsonb;
  v_product_id text;
  v_sku_id text;
  v_status text;
  v_response jsonb;
  v_count integer := 0;
begin
  if p_source !~ '^[a-z][a-z0-9_-]{1,39}$'
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 100
    or length(trim(coalesce(p_idempotency_key, ''))) = 0
    or length(p_idempotency_key) > 120 then
    raise exception 'INVALID_CATALOG_IMPORT_INPUT';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where jsonb_typeof(item) <> 'object'
      or length(trim(coalesce(item->>'externalSpuId', ''))) = 0
      or length(trim(coalesce(item->>'externalSkuId', ''))) = 0
      or length(trim(coalesce(item->>'name', ''))) = 0
      or coalesce(jsonb_typeof(item->'detail'), 'object') <> 'object'
      or coalesce(jsonb_typeof(item->'specs'), 'object') <> 'object'
      or jsonb_typeof(item->'priceCents') <> 'number'
      or (item->>'priceCents')::bigint < 0
      or jsonb_typeof(item->'availableStock') <> 'number'
      or (item->>'availableStock')::bigint < 0
      or (item->>'availableStock')::bigint > 2147483647
      or (item ? 'marketPriceCents' and item->'marketPriceCents' <> 'null'::jsonb and (
        jsonb_typeof(item->'marketPriceCents') <> 'number'
        or (item->>'marketPriceCents')::bigint < (item->>'priceCents')::bigint
      ))
      or coalesce(item->>'status', 'active') not in ('active', 'inactive')
  ) then
    raise exception 'INVALID_CATALOG_IMPORT_INPUT';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    group by item->>'externalSkuId'
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_SOURCE_SKU_IN_BATCH';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_mall_id || ':catalog:upsert:' || p_idempotency_key));
  select * into v_existing
  from public.idempotency_keys
  where mall_id = p_mall_id
    and scope = 'catalog:upsert'
    and idempotency_key = p_idempotency_key
    and expires_at > v_now;
  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.response_json;
  end if;

  v_supplier_id := 'supplier-source-' || md5(p_tenant_id || ':' || p_source);
  insert into public.suppliers (id, tenant_id, code, name, settlement_mode, status)
  values (
    v_supplier_id,
    p_tenant_id,
    'source-' || p_source,
    coalesce(nullif(trim(p_supplier_name), ''), p_source),
    'api',
    'active'
  )
  on conflict (id) do update set
    name = excluded.name,
    status = 'active';

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := 'product-source-' || md5(p_mall_id || ':' || p_source || ':' || (v_item->>'externalSpuId'));
    v_sku_id := 'sku-source-' || md5(p_mall_id || ':' || p_source || ':' || (v_item->>'externalSkuId'));
    v_status := coalesce(v_item->>'status', 'active');

    insert into public.products (
      id, tenant_id, mall_id, supplier_id, spu_code, name, name_zh, subtitle,
      category_code, cover_url, detail_json, status, source_code, source_spu_id,
      classification_status, classification_confidence
    ) values (
      v_product_id,
      p_tenant_id,
      p_mall_id,
      v_supplier_id,
      p_source || ':' || (v_item->>'externalSpuId'),
      left(v_item->>'name', 500),
      nullif(left(coalesce(v_item->>'nameZh', ''), 500), ''),
      nullif(left(coalesce(v_item->>'subtitle', ''), 500), ''),
      'welfare',
      nullif(v_item->>'coverUrl', ''),
      jsonb_strip_nulls(jsonb_build_object(
        'source', p_source,
        'sourceCategory', v_item->>'sourceCategory',
        'externalSpuId', v_item->>'externalSpuId'
      )) || coalesce(v_item->'detail', '{}'::jsonb),
      v_status,
      p_source,
      v_item->>'externalSpuId',
      'pending',
      0
    )
    on conflict (id) do update set
      supplier_id = excluded.supplier_id,
      name = excluded.name,
      name_zh = coalesce(public.products.name_zh, excluded.name_zh),
      subtitle = excluded.subtitle,
      cover_url = excluded.cover_url,
      detail_json = excluded.detail_json,
      status = excluded.status,
      updated_at = v_now;

    insert into public.skus (
      id, tenant_id, mall_id, product_id, sku_code, specs_json, price_cents,
      market_price_cents, status, source_code, source_sku_id
    ) values (
      v_sku_id,
      p_tenant_id,
      p_mall_id,
      v_product_id,
      p_source || ':' || (v_item->>'externalSkuId'),
      coalesce(v_item->'specs', '{}'::jsonb),
      (v_item->>'priceCents')::bigint,
      case when v_item->'marketPriceCents' is null or v_item->'marketPriceCents' = 'null'::jsonb then null else (v_item->>'marketPriceCents')::bigint end,
      v_status,
      p_source,
      v_item->>'externalSkuId'
    )
    on conflict (id) do update set
      product_id = excluded.product_id,
      specs_json = excluded.specs_json,
      price_cents = excluded.price_cents,
      market_price_cents = excluded.market_price_cents,
      status = excluded.status,
      updated_at = v_now;

    insert into public.inventory (tenant_id, mall_id, sku_id, available_qty, reserved_qty, updated_at)
    values (p_tenant_id, p_mall_id, v_sku_id, (v_item->>'availableStock')::integer, 0, v_now)
    on conflict (sku_id) do update set
      available_qty = excluded.available_qty,
      reserved_qty = least(public.inventory.reserved_qty, excluded.available_qty),
      version = public.inventory.version + 1,
      updated_at = v_now;

    v_count := v_count + 1;
  end loop;

  v_response := jsonb_build_object(
    'source', p_source,
    'supplierId', v_supplier_id,
    'itemsWritten', v_count,
    'requestId', p_request_id,
    'updatedAt', v_now
  );

  insert into public.idempotency_keys (
    tenant_id, mall_id, scope, idempotency_key, request_hash, resource_id,
    response_json, created_at, expires_at
  ) values (
    p_tenant_id, p_mall_id, 'catalog:upsert', p_idempotency_key, p_request_hash,
    'catalog-source:' || p_source, v_response, v_now, v_now + interval '24 hours'
  );

  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json,
    membership_id, granted_via, created_at
  ) values (
    gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id,
    p_operator_user_id, 'admin', 'catalog.source_sync', 'catalog_source',
    p_source, p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('source', p_source, 'itemsWritten', v_count),
    p_membership_id, p_granted_via, v_now
  );

  return v_response;
end;
$$;

revoke all on function public.api_upsert_supplier_catalog(text, text, text, text, text, text, jsonb, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.api_upsert_supplier_catalog(text, text, text, text, text, text, jsonb, text, text, text, text, text, jsonb) to service_role;
