-- Cart and checkout read model for the WeChat mini-program.
-- The client may cache this projection for fast paint, but order creation
-- still revalidates qualification, price and inventory inside the database.

create or replace function public.api_cart_snapshot_qualified(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text,
  p_membership_id text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(row_value.payload order by row_value.updated_at desc), '[]'::jsonb)
  from (
    select item.updated_at, jsonb_build_object(
      'id', item.id,
      'skuId', item.sku_id,
      'productId', product.id,
      'quantity', item.quantity,
      'selected', item.selected,
      'updatedAt', item.updated_at,
      'purchasable', coalesce((decision.result ->> 'purchasable')::boolean, false),
      'qualification', decision.result,
      'name', product.name,
      'subtitle', product.subtitle,
      'coverUrl', product.cover_url,
      'specs', sku.specs_json,
      'priceCents', sku.price_cents,
      'marketPriceCents', sku.market_price_cents,
      'availableStock', greatest(coalesce(inventory.available_qty, 0) - coalesce(inventory.reserved_qty, 0), 0),
      'supplierId', supplier.id,
      'supplierName', supplier.name,
      'isTest', product.is_test
    ) as payload
    from public.carts cart
    join public.cart_items item on item.cart_id = cart.id
    join public.skus sku on sku.id = item.sku_id
    join public.products product on product.id = sku.product_id
    join public.suppliers supplier on supplier.id = product.supplier_id
    left join public.inventory inventory on inventory.sku_id = sku.id
    cross join lateral public.api_employee_sku_qualification(
      p_tenant_id,
      p_enterprise_id,
      p_mall_id,
      p_user_id,
      p_membership_id,
      item.sku_id,
      item.quantity,
      null,
      null,
      null
    ) decision(result)
    where cart.tenant_id = p_tenant_id
      and cart.mall_id = p_mall_id
      and cart.user_id = p_user_id
      and item.tenant_id = p_tenant_id
      and item.mall_id = p_mall_id
  ) row_value;
$$;

create or replace function public.api_delete_ordered_cart_items(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text,
  p_items jsonb,
  p_request_id text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_removed integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_ORDER_INPUT';
  end if;

  delete from public.cart_items item
  using public.carts cart
  where item.cart_id = cart.id
    and item.tenant_id = p_tenant_id
    and item.mall_id = p_mall_id
    and cart.tenant_id = p_tenant_id
    and cart.mall_id = p_mall_id
    and cart.user_id = p_user_id
    and exists (
      select 1
      from jsonb_array_elements(p_items) requested(value)
      where requested.value ->> 'skuId' = item.sku_id
    );
  get diagnostics v_removed = row_count;

  update public.carts
  set updated_at = now()
  where tenant_id = p_tenant_id and mall_id = p_mall_id and user_id = p_user_id;

  return v_removed;
end;
$$;

create or replace function public.api_create_order_and_clear_cart_authorized(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text,
  p_items jsonb,
  p_recipient_cipher jsonb,
  p_recipient_city text,
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
  v_result jsonb;
  v_removed integer;
  v_existing public.idempotency_keys%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id || ':' || p_mall_id || ':order:create:' || p_idempotency_key, 0
  ));
  select * into v_existing
  from public.idempotency_keys
  where mall_id = p_mall_id
    and scope = 'order:create'
    and idempotency_key = p_idempotency_key
    and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.response_json || jsonb_build_object('cartItemsRemoved', 0);
  end if;

  v_result := public.api_create_order_authorized(
    p_tenant_id,
    p_enterprise_id,
    p_mall_id,
    p_user_id,
    p_items,
    p_recipient_cipher,
    p_recipient_city,
    p_idempotency_key,
    p_request_hash,
    p_request_id,
    p_user_agent,
    p_membership_id,
    p_granted_via
  );

  v_removed := public.api_delete_ordered_cart_items(
    p_tenant_id,
    p_enterprise_id,
    p_mall_id,
    p_user_id,
    p_items,
    p_request_id
  );

  return v_result || jsonb_build_object('cartItemsRemoved', v_removed);
end;
$$;

revoke all on function public.api_cart_snapshot_qualified(text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.api_delete_ordered_cart_items(text,text,text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.api_create_order_and_clear_cart_authorized(text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.api_cart_snapshot_qualified(text,text,text,text,text) to service_role;
grant execute on function public.api_create_order_and_clear_cart_authorized(text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb) to service_role;
