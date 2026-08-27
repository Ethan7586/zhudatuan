-- Real administration operations: every mutation is scoped by the service,
-- idempotent, and leaves immutable authorization evidence in audit_logs.

drop function if exists public.api_admin_catalog(text, text);
drop function if exists public.api_admin_catalog(text, text, integer);

create function public.api_admin_catalog(p_tenant_id text, p_mall_id text, p_limit integer default 100)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'skuId', sku.id,
    'name', coalesce(p.name_zh, p.name),
    'nameZh', p.name_zh,
    'supplierName', supplier.name,
    'categoryCode', p.category_code,
    'coverUrl', p.cover_url,
    'priceCents', sku.price_cents,
    'marketPriceCents', sku.market_price_cents,
    'availableStock', coalesce(inventory.available_qty - inventory.reserved_qty, 0),
    'status', p.status,
    'classificationStatus', p.classification_status
  ) order by p.updated_at desc, p.id), '[]'::jsonb)
  from (
    select * from public.products
    where tenant_id = p_tenant_id and mall_id = p_mall_id
    order by updated_at desc, id
    limit least(greatest(p_limit, 1), 100)
  ) p
  join public.suppliers supplier on supplier.id = p.supplier_id
  left join lateral (
    select s.id, s.price_cents, s.market_price_cents
    from public.skus s
    where s.product_id = p.id and s.mall_id = p.mall_id
    order by s.id
    limit 1
  ) sku on true
  left join public.inventory inventory on inventory.sku_id = sku.id and inventory.mall_id = p.mall_id
  ;
$$;

create or replace function public.api_order_views_scoped(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text default null
)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'orderNo', o.order_no, 'status', o.status,
    'goodsAmountCents', o.goods_amount_cents, 'discountCents', o.discount_cents,
    'payableCents', o.payable_cents, 'paidCents', o.paid_cents,
    'welfarePaidCents', coalesce((select sum(pa.amount_cents) from public.payment_allocations pa where pa.order_id = o.id and pa.channel = 'welfare'), 0),
    'mealPaidCents', coalesce((select sum(pa.amount_cents) from public.payment_allocations pa where pa.order_id = o.id and pa.channel = 'meal'), 0),
    'createdAt', o.created_at, 'updatedAt', o.updated_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('productId', oi.product_id, 'productTitle', oi.product_name_snapshot,
        'productImage', product.cover_url, 'priceCents', oi.unit_price_cents, 'quantity', oi.quantity,
        'specs', oi.specs_snapshot_json) order by oi.id)
      from public.order_items oi join public.products product on product.id = oi.product_id
      where oi.order_id = o.id
    ), '[]'::jsonb)
  ) order by o.created_at desc), '[]'::jsonb)
  from public.orders o
  where o.tenant_id = p_tenant_id and o.enterprise_id = p_enterprise_id and o.mall_id = p_mall_id
    and (p_user_id is null or o.user_id = p_user_id);
$$;

create or replace function public.api_after_sale_count_scoped(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text default null
)
returns bigint
language sql stable security definer set search_path = public, pg_temp
as $$
  select count(*)
  from public.after_sales a
  join public.orders o on o.id = a.order_id
  where o.tenant_id = p_tenant_id and o.enterprise_id = p_enterprise_id and o.mall_id = p_mall_id
    and (p_user_id is null or o.user_id = p_user_id);
$$;

create or replace function public.api_product_authorization_scope(p_product_id text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object('tenant_id', p.tenant_id, 'mall_id', p.mall_id, 'supplier_id', p.supplier_id)
  from public.products p where p.id = p_product_id;
$$;

create or replace function public.api_set_product_status(
  p_tenant_id text, p_mall_id text, p_operator_user_id text, p_product_id text, p_status text,
  p_idempotency_key text, p_request_hash text, p_request_id text, p_user_agent text,
  p_membership_id text, p_granted_via jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_product public.products%rowtype; v_existing public.idempotency_keys%rowtype; v_response jsonb; v_now timestamptz := now();
begin
  if p_status not in ('active', 'inactive') or length(trim(coalesce(p_idempotency_key, ''))) = 0 or length(p_idempotency_key) > 120 then
    raise exception 'INVALID_PRODUCT_STATUS_INPUT';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_mall_id || ':product:status:' || p_idempotency_key));
  select * into v_existing from public.idempotency_keys where mall_id = p_mall_id and scope = 'product:status'
    and idempotency_key = p_idempotency_key and expires_at > v_now;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;
  select * into v_product from public.products where id = p_product_id and tenant_id = p_tenant_id and mall_id = p_mall_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  update public.products set status = p_status, updated_at = v_now where id = v_product.id;
  v_response := jsonb_build_object('productId', v_product.id, 'previousStatus', v_product.status, 'status', p_status, 'updatedAt', v_now, 'requestId', p_request_id);
  insert into public.idempotency_keys values (p_tenant_id, p_mall_id, 'product:status', p_idempotency_key, p_request_hash, v_product.id, v_response, v_now, v_now + interval '24 hours');
  insert into public.audit_logs (id, tenant_id, mall_id, actor_user_id, actor_type, action, resource_type, resource_id, request_id, user_agent, before_json, after_json, membership_id, granted_via, created_at)
  values (gen_random_uuid()::text, p_tenant_id, p_mall_id, p_operator_user_id, 'admin', case when p_status = 'active' then 'product.publish' else 'product.unpublish' end,
    'product', v_product.id, p_request_id, left(coalesce(p_user_agent, ''), 300), jsonb_build_object('status', v_product.status), jsonb_build_object('status', p_status), p_membership_id, p_granted_via, v_now);
  return v_response;
end;
$$;

create or replace function public.api_ship_order(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_operator_user_id text, p_order_id text,
  p_idempotency_key text, p_request_hash text, p_request_id text, p_user_agent text,
  p_membership_id text, p_granted_via jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_order public.orders%rowtype; v_existing public.idempotency_keys%rowtype; v_response jsonb; v_now timestamptz := now();
begin
  if length(trim(coalesce(p_idempotency_key, ''))) = 0 or length(p_idempotency_key) > 120 then raise exception 'IDEMPOTENCY_KEY_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtext(p_mall_id || ':order:ship:' || p_idempotency_key));
  select * into v_existing from public.idempotency_keys where mall_id = p_mall_id and scope = 'order:ship'
    and idempotency_key = p_idempotency_key and expires_at > v_now;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;
  select * into v_order from public.orders where id = p_order_id and tenant_id = p_tenant_id and enterprise_id = p_enterprise_id and mall_id = p_mall_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status not in ('paid', 'processing') then raise exception 'ORDER_NOT_SHIPPABLE'; end if;
  update public.orders set status = 'shipped', updated_at = v_now where id = v_order.id;
  update public.sub_orders set status = 'shipped', updated_at = v_now where parent_order_id = v_order.id and tenant_id = p_tenant_id and mall_id = p_mall_id and status in ('paid', 'processing');
  v_response := jsonb_build_object('orderId', v_order.id, 'orderNo', v_order.order_no, 'previousStatus', v_order.status, 'status', 'shipped', 'updatedAt', v_now, 'requestId', p_request_id);
  insert into public.idempotency_keys values (p_tenant_id, p_mall_id, 'order:ship', p_idempotency_key, p_request_hash, v_order.id, v_response, v_now, v_now + interval '24 hours');
  insert into public.audit_logs (id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action, resource_type, resource_id, request_id, user_agent, before_json, after_json, membership_id, granted_via, created_at)
  values (gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_operator_user_id, 'admin', 'order.ship', 'order', v_order.id, p_request_id,
    left(coalesce(p_user_agent, ''), 300), jsonb_build_object('status', v_order.status), jsonb_build_object('status', 'shipped'), p_membership_id, p_granted_via, v_now);
  return v_response;
end;
$$;

revoke all on function public.api_admin_catalog(text, text, integer) from public, anon, authenticated;
revoke all on function public.api_order_views_scoped(text, text, text, text) from public, anon, authenticated;
revoke all on function public.api_after_sale_count_scoped(text, text, text, text) from public, anon, authenticated;
revoke all on function public.api_product_authorization_scope(text) from public, anon, authenticated;
revoke all on function public.api_set_product_status(text, text, text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.api_ship_order(text, text, text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.api_admin_catalog(text, text, integer) to service_role;
grant execute on function public.api_order_views_scoped(text, text, text, text) to service_role;
grant execute on function public.api_after_sale_count_scoped(text, text, text, text) to service_role;
grant execute on function public.api_product_authorization_scope(text) to service_role;
grant execute on function public.api_set_product_status(text, text, text, text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.api_ship_order(text, text, text, text, text, text, text, text, text, text, jsonb) to service_role;
