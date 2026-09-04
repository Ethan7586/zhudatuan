-- Administration order pages are query-only. Scope inputs are supplied by the
-- commerce API from the resolved membership and are never accepted from a browser.

create index if not exists idx_orders_admin_page on public.orders (tenant_id, mall_id, created_at desc);
create index if not exists idx_orders_order_no on public.orders (order_no);

create or replace function public.api_admin_order_page(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text default null,
  p_keyword text default null, p_status text default null, p_created_from timestamptz default null,
  p_created_to timestamptz default null, p_sort text default 'created_at_desc',
  p_limit integer default 20, p_offset integer default 0
)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  with filtered as (
    select o.*, count(*) over() as total
    from public.orders o
    where o.tenant_id = p_tenant_id and o.enterprise_id = p_enterprise_id and o.mall_id = p_mall_id
      and (p_user_id is null or o.user_id = p_user_id)
      and (nullif(trim(p_keyword), '') is null or o.order_no ilike '%' || trim(p_keyword) || '%'
        or exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.product_name_snapshot ilike '%' || trim(p_keyword) || '%'))
      and (p_status is null or o.status = p_status)
      and (p_created_from is null or o.created_at >= p_created_from)
      and (p_created_to is null or o.created_at < p_created_to)
  ), ranked as (
    select *, row_number() over (
      order by case when p_sort = 'created_at_asc' then created_at end asc,
        case when p_sort = 'payable_asc' then payable_cents end asc,
        case when p_sort = 'payable_desc' then payable_cents end desc, created_at desc, id desc
    ) as position
    from filtered
  ), paged as (
    select * from ranked
    where position > greatest(coalesce(p_offset, 0), 0)
    order by position
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'orderNo', p.order_no, 'status', p.status, 'payableCents', p.payable_cents, 'paidCents', p.paid_cents,
      'welfarePaidCents', coalesce((select sum(pa.amount_cents) from public.payment_allocations pa where pa.order_id = p.id and pa.channel = 'welfare'), 0),
      'mealPaidCents', coalesce((select sum(pa.amount_cents) from public.payment_allocations pa where pa.order_id = p.id and pa.channel = 'meal'), 0),
      'itemCount', coalesce((select sum(oi.quantity) from public.order_items oi where oi.order_id = p.id), 0),
      'firstProductName', coalesce((select oi.product_name_snapshot from public.order_items oi where oi.order_id = p.id order by oi.id limit 1), '订单商品'),
      'supplierNames', coalesce((select jsonb_agg(x.name order by x.name) from (
        select distinct s.name from public.order_items oi join public.sub_orders so on so.id = oi.sub_order_id join public.suppliers s on s.id = so.supplier_id where oi.order_id = p.id
      ) x), '[]'::jsonb), 'createdAt', p.created_at, 'updatedAt', p.updated_at
    ) order by p.position), '[]'::jsonb),
    'total', coalesce((select max(total) from filtered), 0), 'limit', least(greatest(coalesce(p_limit, 20), 1), 100), 'offset', greatest(coalesce(p_offset, 0), 0)
  ) from paged p;
$$;

create or replace function public.api_admin_after_sale_page(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text default null,
  p_keyword text default null, p_status text default null, p_created_from timestamptz default null,
  p_created_to timestamptz default null, p_sort text default 'created_at_desc',
  p_limit integer default 20, p_offset integer default 0
)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  with filtered as (
    select a.*, o.order_no, count(*) over() as total
    from public.after_sales a join public.orders o on o.id = a.order_id
    where o.tenant_id = p_tenant_id and o.enterprise_id = p_enterprise_id and o.mall_id = p_mall_id
      and (p_user_id is null or o.user_id = p_user_id)
      and (nullif(trim(p_keyword), '') is null or a.after_sale_no ilike '%' || trim(p_keyword) || '%' or o.order_no ilike '%' || trim(p_keyword) || '%')
      and (p_status is null or a.status = p_status)
      and (p_created_from is null or a.created_at >= p_created_from) and (p_created_to is null or a.created_at < p_created_to)
  ), ranked as (
    select *, row_number() over (
      order by case when p_sort = 'created_at_asc' then created_at end asc,
        case when p_sort = 'payable_asc' then requested_amount_cents end asc,
        case when p_sort = 'payable_desc' then requested_amount_cents end desc, created_at desc, id desc
    ) as position
    from filtered
  ), paged as (
    select * from ranked
    where position > greatest(coalesce(p_offset, 0), 0)
    order by position
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'afterSaleNo', p.after_sale_no, 'orderId', p.order_id, 'orderNo', p.order_no, 'type', p.type, 'status', p.status,
      'reason', p.reason, 'requestedAmountCents', p.requested_amount_cents,
      'firstProductName', coalesce((select oi.product_name_snapshot from public.order_items oi where oi.id = p.order_item_id),
        (select oi.product_name_snapshot from public.order_items oi where oi.order_id = p.order_id order by oi.id limit 1), '订单商品'),
      'createdAt', p.created_at, 'updatedAt', p.updated_at
    ) order by p.position), '[]'::jsonb),
    'total', coalesce((select max(total) from filtered), 0), 'limit', least(greatest(coalesce(p_limit, 20), 1), 100), 'offset', greatest(coalesce(p_offset, 0), 0)
  ) from paged p;
$$;

revoke all on function public.api_admin_order_page(text,text,text,text,text,text,timestamptz,timestamptz,text,integer,integer) from public, anon, authenticated;
revoke all on function public.api_admin_after_sale_page(text,text,text,text,text,text,timestamptz,timestamptz,text,integer,integer) from public, anon, authenticated;
grant execute on function public.api_admin_order_page(text,text,text,text,text,text,timestamptz,timestamptz,text,integer,integer) to service_role;
grant execute on function public.api_admin_after_sale_page(text,text,text,text,text,text,timestamptz,timestamptz,text,integer,integer) to service_role;
