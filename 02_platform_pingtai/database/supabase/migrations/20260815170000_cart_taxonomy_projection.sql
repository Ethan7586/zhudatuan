-- Add catalog taxonomy to the authenticated cart projection so every client can
-- apply its own approved commerce-category boundary without duplicating product
-- truth or changing the shared Shop catalog.

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
      'categoryCode', product.category_code,
      'taxonomy', jsonb_build_object(
        'l1', product.taxonomy_l1,
        'l2', product.taxonomy_l2,
        'l3', product.taxonomy_l3
      ),
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

revoke all on function public.api_cart_snapshot_qualified(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.api_cart_snapshot_qualified(text,text,text,text,text) to service_role;
