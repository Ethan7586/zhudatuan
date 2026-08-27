-- Hard cut checkout to one membership-bound, atomic order plus inventory path.
-- This closes the existing MVP order-creation transaction only. It does not
-- claim CheckoutQuote, PaymentIntent, funds/voucher holds, or Outbox delivery.

drop function if exists public.api_create_order_and_clear_cart_authorized(
  text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb
);
drop function if exists public.api_create_order_authorized(
  text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb
);
drop function if exists public.api_create_order_authorized(
  text,text,text,text,jsonb,jsonb,text,text,text,text,text,jsonb
);
drop function if exists public.api_create_order(
  text,text,text,text,jsonb,jsonb,text,text,text,text
);
drop function if exists public.api_delete_ordered_cart_items(
  text,text,text,text,jsonb,text
);

drop function if exists public.api_checkout_order_authorized(
  text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb
);
create function public.api_checkout_order_authorized(
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
) returns jsonb
language plpgsql
security definer
set search_path = public, inventory, pg_temp
as $$
declare
  v_tenant_id text;
  v_enterprise_id text;
  v_mall_id text;
  v_user_id text;
  v_items jsonb;
  v_inventory_items jsonb;
  v_cart_id text;
  v_order_id text := gen_random_uuid()::text;
  v_order_no text := 'SW' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_sub_order_id text;
  v_sub_order_no text;
  v_supplier record;
  v_supplier_index integer := 0;
  v_expected integer;
  v_matched integer;
  v_removed integer;
  v_goods bigint;
  v_qualification jsonb;
  v_reservation jsonb;
  v_existing public.idempotency_keys%rowtype;
  v_request_hash text := trim(coalesce(p_request_hash, ''));
  v_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  v_now timestamptz := clock_timestamp();
  v_expires_at timestamptz;
  v_response jsonb;
begin
  if char_length(v_idempotency_key) not between 1 and 120
     or v_request_hash !~ '^[A-Za-z0-9+/]{43}=$'
     or char_length(trim(coalesce(p_request_id, ''))) not between 1 and 160
     or jsonb_typeof(p_recipient_cipher) is distinct from 'object'
     or p_recipient_cipher = '{}'::jsonb
     or char_length(trim(coalesce(p_recipient_city, ''))) not between 1 and 50
  then raise exception 'INVALID_CHECKOUT_INPUT'; end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 50
     or exists (
       select 1 from jsonb_array_elements(p_items) entry
       where jsonb_typeof(entry) is distinct from 'object'
          or jsonb_typeof(entry->'skuId') is distinct from 'string'
          or char_length(trim(entry->>'skuId')) not between 1 and 100
          or jsonb_typeof(entry->'quantity') is distinct from 'number'
          or entry->>'quantity' !~ '^[1-9][0-9]?$'
     )
  then raise exception 'INVALID_ORDER_INPUT'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) entry
    group by trim(entry->>'skuId') having count(*) > 1
  ) then raise exception 'DUPLICATE_ORDER_SKU'; end if;
  select jsonb_agg(jsonb_build_object(
    'skuId', trim(entry->>'skuId'),
    'quantity', (entry->>'quantity')::integer
  ) order by trim(entry->>'skuId'))
  into v_items from jsonb_array_elements(p_items) entry;
  v_expected := jsonb_array_length(v_items);
  select jsonb_agg(jsonb_build_object(
    'skuId', entry->>'skuId', 'locationId', 'default',
    'quantity', (entry->>'quantity')::integer
  ) order by entry->>'skuId')
  into v_inventory_items from jsonb_array_elements(v_items) entry;

  select membership.tenant_id, membership.enterprise_id, membership.mall_id,
         membership.context_user_id
  into v_tenant_id, v_enterprise_id, v_mall_id, v_user_id
  from public.memberships membership
  join public.members member_record
    on member_record.id = membership.member_id and member_record.status = 'active'
  join public.users actor
    on actor.id = membership.context_user_id
   and actor.id = member_record.user_id and actor.status = 'active'
  join public.tenants tenant
    on tenant.id = membership.tenant_id and tenant.status = 'active'
  join public.enterprises enterprise
    on enterprise.id = membership.enterprise_id
   and enterprise.tenant_id = tenant.id and enterprise.status = 'active'
  join public.malls mall
    on mall.id = membership.mall_id and mall.tenant_id = tenant.id
   and mall.enterprise_id = enterprise.id and mall.status = 'active'
  where membership.id = p_membership_id
    and membership.target = 'storefront'
    and membership.status = 'active'
    and (membership.expires_at is null or membership.expires_at > now())
  for share of membership, member_record, actor, tenant, enterprise, mall;
  if not found then raise exception 'CHECKOUT_ACTOR_NOT_AUTHORIZED'; end if;
  if not public.api_membership_distributor_anchor_valid(p_membership_id)
     or not public.api_membership_actor_matches(
       p_membership_id, v_user_id, 'storefront'
     )
  then raise exception 'CHECKOUT_ACTOR_NOT_AUTHORIZED'; end if;
  if p_tenant_id is distinct from v_tenant_id
     or p_enterprise_id is distinct from v_enterprise_id
     or p_mall_id is distinct from v_mall_id
     or p_user_id is distinct from v_user_id
  then raise exception 'CHECKOUT_SCOPE_MISMATCH'; end if;
  if not exists (
    select 1 from public.membership_scopes scope
    where scope.membership_id = p_membership_id
      and scope.scope_kind = 'self' and scope.resource_id = v_user_id
  ) then raise exception 'CHECKOUT_SELF_SCOPE_REQUIRED'; end if;
  if not public.api_authorization_evidence_matches(
    p_granted_via, p_membership_id, 'order.create', false
  ) or not public.api_membership_has_permission(p_membership_id, 'order.create')
  then raise exception 'CHECKOUT_AUTHORIZATION_EVIDENCE_INVALID'; end if;
  if not public.api_member_phone_verified(p_membership_id, v_user_id)
  then raise exception 'PHONE_VERIFICATION_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_tenant_id || ':' || v_mall_id || ':checkout:order:' || v_idempotency_key, 0
  ));
  select * into v_existing from public.idempotency_keys idempotency
  where idempotency.mall_id = v_mall_id
    and idempotency.scope = 'checkout:order'
    and idempotency.idempotency_key = v_idempotency_key
    and idempotency.expires_at > now();
  if found then
    if v_existing.tenant_id is distinct from v_tenant_id
       or v_existing.request_hash is distinct from v_request_hash
    then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;

  select cart.id into v_cart_id from public.carts cart
  where cart.tenant_id = v_tenant_id and cart.mall_id = v_mall_id
    and cart.user_id = v_user_id
  for update;
  if not found then raise exception 'CHECKOUT_CART_MISMATCH'; end if;
  perform item.id
  from public.cart_items item
  join jsonb_array_elements(v_items) requested
    on item.sku_id = requested->>'skuId'
  where item.cart_id = v_cart_id and item.tenant_id = v_tenant_id
    and item.mall_id = v_mall_id
  order by item.sku_id for update of item;
  select count(*) into v_matched
  from public.cart_items item
  join jsonb_array_elements(v_items) requested
    on item.sku_id = requested->>'skuId'
   and item.quantity = (requested->>'quantity')::integer
  where item.cart_id = v_cart_id and item.tenant_id = v_tenant_id
    and item.mall_id = v_mall_id and item.selected;
  if v_matched <> v_expected then raise exception 'CHECKOUT_CART_MISMATCH'; end if;

  perform sku.id
  from jsonb_array_elements(v_items) requested
  join public.skus sku on sku.id = requested->>'skuId'
  join public.products product on product.id = sku.product_id
  join public.suppliers supplier on supplier.id = product.supplier_id
  where sku.tenant_id = v_tenant_id and sku.mall_id = v_mall_id
    and product.tenant_id = v_tenant_id and product.mall_id = v_mall_id
    and supplier.tenant_id = v_tenant_id
    and sku.status = 'active' and product.status = 'active'
    and supplier.status = 'active'
  order by sku.id for share of sku, product, supplier;
  select count(*), sum(sku.price_cents * (requested->>'quantity')::integer)
  into v_matched, v_goods
  from jsonb_array_elements(v_items) requested
  join public.skus sku on sku.id = requested->>'skuId'
  join public.products product on product.id = sku.product_id
  join public.suppliers supplier on supplier.id = product.supplier_id
  where sku.tenant_id = v_tenant_id and sku.mall_id = v_mall_id
    and product.tenant_id = v_tenant_id and product.mall_id = v_mall_id
    and supplier.tenant_id = v_tenant_id
    and sku.status = 'active' and product.status = 'active'
    and supplier.status = 'active';
  if v_matched <> v_expected or v_goods is null
  then raise exception 'SKU_NOT_AVAILABLE'; end if;

  v_qualification := public.api_assert_order_qualification(
    v_tenant_id, v_enterprise_id, v_mall_id, v_user_id,
    p_membership_id, v_items, trim(p_recipient_city)
  );
  v_expires_at := v_now + interval '15 minutes';
  insert into public.orders (
    id, order_no, tenant_id, enterprise_id, mall_id, user_id, status,
    goods_amount_cents, discount_cents, payable_cents, paid_cents,
    recipient_snapshot_json, qualification_evidence_json, created_at, updated_at
  ) values (
    v_order_id, v_order_no, v_tenant_id, v_enterprise_id, v_mall_id, v_user_id,
    'pending_payment', v_goods, 0, v_goods, 0, p_recipient_cipher,
    v_qualification, v_now, v_now
  );

  for v_supplier in
    select product.supplier_id,
           sum(sku.price_cents * (requested->>'quantity')::integer) amount_cents
    from jsonb_array_elements(v_items) requested
    join public.skus sku on sku.id = requested->>'skuId'
    join public.products product on product.id = sku.product_id
    group by product.supplier_id order by product.supplier_id
  loop
    v_supplier_index := v_supplier_index + 1;
    v_sub_order_id := gen_random_uuid()::text;
    v_sub_order_no := v_order_no || '-' || lpad(v_supplier_index::text, 2, '0');
    insert into public.sub_orders (
      id, sub_order_no, tenant_id, mall_id, parent_order_id, supplier_id,
      status, amount_cents, created_at, updated_at
    ) values (
      v_sub_order_id, v_sub_order_no, v_tenant_id, v_mall_id, v_order_id,
      v_supplier.supplier_id, 'pending_payment', v_supplier.amount_cents, v_now, v_now
    );
    insert into public.order_items (
      id, tenant_id, mall_id, order_id, sub_order_id, product_id, sku_id,
      product_name_snapshot, specs_snapshot_json, unit_price_cents, quantity,
      line_amount_cents
    )
    select gen_random_uuid()::text, v_tenant_id, v_mall_id, v_order_id,
      v_sub_order_id, product.id, sku.id, product.name, sku.specs_json,
      sku.price_cents, (requested->>'quantity')::integer,
      sku.price_cents * (requested->>'quantity')::integer
    from jsonb_array_elements(v_items) requested
    join public.skus sku on sku.id = requested->>'skuId'
    join public.products product on product.id = sku.product_id
    where product.supplier_id = v_supplier.supplier_id
    order by sku.id;
  end loop;

  v_reservation := inventory.reserve(
    v_tenant_id, v_mall_id, v_order_id, v_inventory_items,
    'checkout:' || v_idempotency_key, v_expires_at
  );
  delete from public.cart_items item
  using jsonb_array_elements(v_items) requested
  where item.cart_id = v_cart_id and item.tenant_id = v_tenant_id
    and item.mall_id = v_mall_id and item.selected
    and item.sku_id = requested->>'skuId'
    and item.quantity = (requested->>'quantity')::integer;
  get diagnostics v_removed = row_count;
  if v_removed <> v_expected then raise exception 'CHECKOUT_CART_CHANGED'; end if;
  update public.carts set updated_at = v_now where id = v_cart_id;

  v_response := jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order_id, 'orderNo', v_order_no, 'status', 'pending_payment',
      'goodsAmountCents', v_goods, 'discountCents', 0,
      'payableCents', v_goods, 'paidCents', 0, 'createdAt', v_now,
      'reservationExpiresAt', v_expires_at
    ),
    'inventoryReservation', v_reservation,
    'qualification', v_qualification,
    'cartItemsRemoved', v_removed,
    'requestId', p_request_id
  );
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type,
    action, resource_type, resource_id, request_id, user_agent, after_json,
    membership_id, granted_via, created_at
  ) values (
    gen_random_uuid()::text, v_tenant_id, v_enterprise_id, v_mall_id, v_user_id,
    'user', 'checkout.order.create', 'order', v_order_id, p_request_id,
    left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object(
      'idempotencyKey', v_idempotency_key, 'items', v_items,
      'goodsAmountCents', v_goods, 'reservationExpiresAt', v_expires_at,
      'qualification', v_qualification
    ), p_membership_id, p_granted_via, v_now
  );
  insert into public.idempotency_keys (
    tenant_id, mall_id, scope, idempotency_key, request_hash, resource_id,
    response_json, created_at, expires_at
  ) values (
    v_tenant_id, v_mall_id, 'checkout:order', v_idempotency_key,
    v_request_hash, v_order_id, v_response, v_now, v_now + interval '24 hours'
  );
  return v_response;
end;
$$;

revoke all on function public.api_checkout_order_authorized(
  text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.api_checkout_order_authorized(
  text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb
) to service_role;
