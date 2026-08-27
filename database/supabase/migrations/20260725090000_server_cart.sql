-- Server-authoritative cart operations. Cart data is scoped to the authenticated
-- tenant, mall, and employee; browser state is never accepted as authority.

create or replace function public.api_cart_items(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text
)
returns table(id text, sku_id text, product_id text, quantity integer, selected boolean, updated_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select ci.id, ci.sku_id, s.product_id, ci.quantity, ci.selected, ci.updated_at
  from public.carts c
  join public.cart_items ci on ci.cart_id = c.id
  join public.skus s on s.id = ci.sku_id
  join public.products p on p.id = s.product_id
  where c.tenant_id = p_tenant_id and c.mall_id = p_mall_id and c.user_id = p_user_id
    and s.tenant_id = p_tenant_id and s.mall_id = p_mall_id and s.status = 'active' and p.status = 'active'
  order by ci.updated_at desc;
$$;

create or replace function public.api_upsert_cart_item(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_sku_id text, p_quantity integer, p_selected boolean, p_request_id text
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cart_id text; v_item public.cart_items%rowtype; v_now timestamptz := clock_timestamp();
begin
  if p_quantity < 1 or p_quantity > 99 then raise exception 'INVALID_CART_QUANTITY'; end if;
  if not exists (select 1 from public.skus s join public.products p on p.id = s.product_id
    where s.id = p_sku_id and s.tenant_id = p_tenant_id and s.mall_id = p_mall_id and s.status = 'active' and p.status = 'active') then
    raise exception 'SKU_NOT_AVAILABLE';
  end if;
  insert into public.carts (id, tenant_id, mall_id, user_id, updated_at)
    values (gen_random_uuid()::text, p_tenant_id, p_mall_id, p_user_id, v_now)
    on conflict (mall_id, user_id) do update set updated_at = excluded.updated_at returning id into v_cart_id;
  insert into public.cart_items (id, tenant_id, mall_id, cart_id, sku_id, quantity, selected, created_at, updated_at)
    values (gen_random_uuid()::text, p_tenant_id, p_mall_id, v_cart_id, p_sku_id, p_quantity, p_selected, v_now, v_now)
    on conflict (cart_id, sku_id) do update set quantity = excluded.quantity, selected = excluded.selected, updated_at = excluded.updated_at
    returning * into v_item;
  insert into public.audit_logs (id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action, resource_type, resource_id, request_id, created_at)
    values (gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, 'user', 'cart.item.upserted', 'cart_item', v_item.id, p_request_id, v_now);
  return jsonb_build_object('item', jsonb_build_object('id', v_item.id, 'skuId', v_item.sku_id, 'quantity', v_item.quantity, 'selected', v_item.selected));
end;
$$;

create or replace function public.api_delete_cart_item(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text, p_cart_item_id text, p_request_id text
)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_deleted integer; begin
  delete from public.cart_items ci using public.carts c
    where ci.id = p_cart_item_id and ci.cart_id = c.id and c.tenant_id = p_tenant_id and c.mall_id = p_mall_id and c.user_id = p_user_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 1 then
    insert into public.audit_logs (id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action, resource_type, resource_id, request_id)
      values (gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, 'user', 'cart.item.deleted', 'cart_item', p_cart_item_id, p_request_id);
  end if;
  return v_deleted = 1;
end;
$$;

revoke all on function public.api_cart_items(text,text,text,text) from public, anon, authenticated;
revoke all on function public.api_upsert_cart_item(text,text,text,text,text,integer,boolean,text) from public, anon, authenticated;
revoke all on function public.api_delete_cart_item(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.api_cart_items(text,text,text,text) to service_role;
grant execute on function public.api_upsert_cart_item(text,text,text,text,text,integer,boolean,text) to service_role;
grant execute on function public.api_delete_cart_item(text,text,text,text,text,text) to service_role;
