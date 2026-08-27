create or replace function public.api_order_views(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'orderNo', o.order_no,
      'status', o.status,
      'goodsAmountCents', o.goods_amount_cents,
      'discountCents', o.discount_cents,
      'payableCents', o.payable_cents,
      'paidCents', o.paid_cents,
      'welfarePaidCents', coalesce((
        select sum(pa.amount_cents)
        from public.payment_allocations pa
        where pa.order_id = o.id and pa.channel = 'welfare'
      ), 0),
      'mealPaidCents', coalesce((
        select sum(pa.amount_cents)
        from public.payment_allocations pa
        where pa.order_id = o.id and pa.channel = 'meal'
      ), 0),
      'createdAt', o.created_at,
      'updatedAt', o.updated_at,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'productId', oi.product_id,
          'productTitle', oi.product_name_snapshot,
          'productImage', p.cover_url,
          'priceCents', oi.unit_price_cents,
          'quantity', oi.quantity,
          'specs', oi.specs_snapshot_json,
          'itemType', case
            when p.category_code = 'virtual-card' then 'virtual_coupon'
            when p.category_code = 'movie' then 'movie_ticket'
            when p.category_code = 'life' then 'life_service'
            else 'physical'
          end
        ) order by oi.id)
        from public.order_items oi
        join public.products p on p.id = oi.product_id
        where oi.order_id = o.id
      ), '[]'::jsonb)
    )
    order by o.created_at desc
  ), '[]'::jsonb)
  from public.orders o
  where o.tenant_id = p_tenant_id
    and o.enterprise_id = p_enterprise_id
    and o.mall_id = p_mall_id
    and o.user_id = p_user_id;
$$;

revoke all on function public.api_order_views(text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.api_order_views(text,text,text,text)
  to service_role;
