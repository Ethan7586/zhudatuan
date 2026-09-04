-- Cockpit sales facts.  All measures are scoped by the resolved admin context;
-- the browser never aggregates a truncated order list into a business metric.
--
-- Metric contract:
--   cumulativeSalesCents: paid amount less successfully completed refunds.
--   periodSalesCents / trend / product/category ranks: payment amount, grouped
--   by payment date.  Successful refunds are surfaced separately because this
--   schema has no immutable refund allocation per order item.

create index if not exists idx_orders_sales_overview
  on public.orders (tenant_id, enterprise_id, mall_id, paid_at desc)
  where paid_cents > 0;
create index if not exists idx_refunds_sales_overview
  on public.refunds (order_id)
  where status = 'succeeded';
create index if not exists idx_order_items_sales_overview
  on public.order_items (order_id, product_id);

create or replace function public.api_admin_sales_overview_scoped(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with scope as (
    select
      o.id,
      o.paid_cents,
      o.paid_at,
      o.created_at,
      coalesce(refunds.refunded_cents, 0)::bigint as refunded_cents,
      greatest(o.paid_cents - coalesce(refunds.refunded_cents, 0), 0)::bigint as net_sales_cents,
      coalesce(o.paid_at, o.created_at) as payment_at
    from public.orders o
    left join lateral (
      select coalesce(sum(r.amount_cents), 0)::bigint as refunded_cents
      from public.refunds r
      where r.order_id = o.id and r.status = 'succeeded'
    ) refunds on true
    where o.tenant_id = p_tenant_id
      and o.enterprise_id = p_enterprise_id
      and o.mall_id = p_mall_id
      and (p_user_id is null or o.user_id = p_user_id)
      and o.paid_cents > 0
  ),
  paid_orders as (
    select
      *,
      (payment_at at time zone 'Asia/Shanghai')::date as payment_date
    from scope
  ),
  current_period as (
    select (now() at time zone 'Asia/Shanghai')::date as today
  ),
  days as (
    select (current_period.today - offset_days)::date as day
    from current_period
    cross join generate_series(6, 0, -1) as offsets(offset_days)
  ),
  product_sales as (
    select
      oi.product_id,
      max(oi.product_name_snapshot) as product_name,
      sum(oi.quantity)::bigint as quantity,
      sum(oi.line_amount_cents)::bigint as sales_cents,
      count(distinct po.id)::bigint as order_count
    from paid_orders po
    join public.order_items oi on oi.order_id = po.id
    where po.net_sales_cents > 0
    group by oi.product_id
  ),
  category_sales as (
    select
      coalesce(nullif(p.category_code, ''), '未分类') as category_name,
      sum(oi.line_amount_cents)::bigint as sales_cents
    from paid_orders po
    join public.order_items oi on oi.order_id = po.id
    left join public.products p on p.id = oi.product_id
    where po.net_sales_cents > 0
    group by coalesce(nullif(p.category_code, ''), '未分类')
  ),
  active_catalogue as (
    select count(*)::bigint as active_product_count
    from public.products p
    where p.tenant_id = p_tenant_id
      and p.mall_id = p_mall_id
      and p.status = 'active'
  ),
  sold_active_products as (
    select count(distinct p.id)::bigint as sold_product_count
    from product_sales sales
    join public.products p on p.id = sales.product_id
    where p.tenant_id = p_tenant_id
      and p.mall_id = p_mall_id
      and p.status = 'active'
  )
  select jsonb_build_object(
    'asOf', now(),
    'cumulativeSalesCents', coalesce(sum(po.net_sales_cents), 0),
    'paidOrderCount', count(*) filter (where po.net_sales_cents > 0),
    'averageOrderValueCents', case
      when count(*) filter (where po.net_sales_cents > 0) = 0 then 0
      else round(
        coalesce(sum(po.net_sales_cents), 0)::numeric
        / (count(*) filter (where po.net_sales_cents > 0))::numeric
      )::bigint
    end,
    'periodSalesCents', coalesce(sum(po.paid_cents) filter (
      where po.payment_date >= (select today - 29 from current_period)
    ), 0),
    'periodPaidOrderCount', count(*) filter (
      where po.payment_date >= (select today - 29 from current_period)
    ),
    'refundedCents', coalesce(sum(po.refunded_cents), 0),
    'activeProductCount', (select active_product_count from active_catalogue),
    'soldProductCount', (select sold_product_count from sold_active_products),
    'unsoldActiveProductCount', greatest(
      (select active_product_count from active_catalogue) - (select sold_product_count from sold_active_products),
      0
    ),
    'trend', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', daily.day,
        'salesCents', daily.sales_cents,
        'orderCount', daily.order_count
      ) order by daily.day), '[]'::jsonb)
      from (
        select
          days.day,
          coalesce(sum(po.paid_cents), 0)::bigint as sales_cents,
          count(po.id)::bigint as order_count
        from days
        left join paid_orders po on po.payment_date = days.day
        group by days.day
      ) daily
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', ranked.category_name,
        'salesCents', ranked.sales_cents,
        'share', ranked.share
      ) order by ranked.sales_cents desc, ranked.category_name), '[]'::jsonb)
      from (
        select
          category_name,
          sales_cents,
          case
            when sum(sales_cents) over () = 0 then 0
            else round(sales_cents::numeric / sum(sales_cents) over (), 4)
          end as share
        from category_sales
      ) ranked
    ),
    'topProducts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'productId', ranked.product_id,
        'name', ranked.product_name,
        'salesCents', ranked.sales_cents,
        'quantity', ranked.quantity,
        'orderCount', ranked.order_count
      ) order by ranked.sales_cents desc, ranked.quantity desc, ranked.product_name), '[]'::jsonb)
      from (
        select * from product_sales order by sales_cents desc, quantity desc, product_name limit 5
      ) ranked
    )
  )
  from paid_orders po;
$$;

revoke all on function public.api_admin_sales_overview_scoped(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.api_admin_sales_overview_scoped(text, text, text, text)
  to service_role;
