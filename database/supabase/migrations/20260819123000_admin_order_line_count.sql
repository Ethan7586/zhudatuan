-- Keep distinct product lines separate from total units in every admin-order read.
-- Existing migration files are immutable after application, so both RPC readers
-- are replaced here rather than editing their historical definitions.

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
      'lineCount', coalesce((select count(*) from public.order_items oi where oi.order_id = p.id), 0),
      'itemCount', coalesce((select sum(oi.quantity) from public.order_items oi where oi.order_id = p.id), 0),
      'firstProductName', coalesce((select oi.product_name_snapshot from public.order_items oi where oi.order_id = p.id order by oi.id limit 1), '订单商品'),
      'supplierNames', coalesce((select jsonb_agg(x.name order by x.name) from (
        select distinct s.name from public.order_items oi join public.sub_orders so on so.id = oi.sub_order_id join public.suppliers s on s.id = so.supplier_id where oi.order_id = p.id
      ) x), '[]'::jsonb), 'createdAt', p.created_at, 'updatedAt', p.updated_at
    ) order by p.position), '[]'::jsonb),
    'total', coalesce((select max(total) from filtered), 0), 'limit', least(greatest(coalesce(p_limit, 20), 1), 100), 'offset', greatest(coalesce(p_offset, 0), 0)
  ) from paged p;
$$;

create or replace function public.api_admin_order_export(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text default null,
  p_keyword text default null, p_status text default null, p_created_from timestamptz default null,
  p_created_to timestamptz default null, p_sort text default 'created_at_desc'
)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  with ranked as (
    select o.*, row_number() over (
      order by case when p_sort = 'created_at_asc' then o.created_at end asc,
        case when p_sort = 'payable_asc' then o.payable_cents end asc,
        case when p_sort = 'payable_desc' then o.payable_cents end desc, o.created_at desc, o.id desc
    ) as position
    from public.orders o
    where o.tenant_id = p_tenant_id and o.enterprise_id = p_enterprise_id and o.mall_id = p_mall_id and (p_user_id is null or o.user_id = p_user_id)
      and (nullif(trim(p_keyword), '') is null or o.order_no ilike '%' || trim(p_keyword) || '%' or exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.product_name_snapshot ilike '%' || trim(p_keyword) || '%'))
      and (p_status is null or o.status = p_status) and (p_created_from is null or o.created_at >= p_created_from) and (p_created_to is null or o.created_at < p_created_to)
  ), scoped as (
    select * from ranked order by position limit 5001
  ) select coalesce(jsonb_agg(jsonb_build_object(
    'orderNo', o.order_no, 'firstProductName', coalesce((select oi.product_name_snapshot from public.order_items oi where oi.order_id = o.id order by oi.id limit 1), '订单商品'),
    'lineCount', coalesce((select count(*) from public.order_items oi where oi.order_id = o.id), 0),
    'itemCount', coalesce((select sum(oi.quantity) from public.order_items oi where oi.order_id = o.id), 0), 'payableCents', o.payable_cents, 'paidCents', o.paid_cents,
    'welfarePaidCents', coalesce((select sum(pa.amount_cents) from public.payment_allocations pa where pa.order_id = o.id and pa.channel = 'welfare'), 0),
    'mealPaidCents', coalesce((select sum(pa.amount_cents) from public.payment_allocations pa where pa.order_id = o.id and pa.channel = 'meal'), 0),
    'supplierNames', coalesce((select string_agg(x.name, '、' order by x.name) from (select distinct s.name from public.order_items oi join public.sub_orders so on so.id = oi.sub_order_id join public.suppliers s on s.id = so.supplier_id where oi.order_id = o.id) x), ''),
    'status', o.status, 'createdAt', o.created_at
  ) order by o.position), '[]'::jsonb) from scoped o;
$$;

revoke all on function public.api_admin_order_page(text,text,text,text,text,text,timestamptz,timestamptz,text,integer,integer) from public, anon, authenticated;
revoke all on function public.api_admin_order_export(text,text,text,text,text,text,timestamptz,timestamptz,text) from public, anon, authenticated;
grant execute on function public.api_admin_order_page(text,text,text,text,text,text,timestamptz,timestamptz,text,integer,integer) to service_role;
grant execute on function public.api_admin_order_export(text,text,text,text,text,text,timestamptz,timestamptz,text) to service_role;
