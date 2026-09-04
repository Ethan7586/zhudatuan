begin;

-- Stable cross-domain reporting read model. The reporting repository consumes
-- this function instead of joining another module's tables directly.
create function reporting.cockpit(p_scope text) returns jsonb
language sql stable security invoker
set search_path=pg_catalog,reporting,organization,catalog,inventory,ordering
as $function$
  with descendants as(
    select descendant_id id from organization.unitclosure where ancestor_id=p_scope
  ), scoped_facts as(
    select fact.metric_id,fact.period_start,fact.period_end,fact.timezone,fact.dimensions,fact.value_numeric,fact.watermark
    from reporting.fact fact where fact.scope_id=p_scope
  ), totals as(
    select coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)::float8 sales,
      coalesce(sum(value_numeric) filter(where metric_id='sales.orders'),0)::float8 orders,
      coalesce(sum(value_numeric) filter(where metric_id='refund.amount'),0)::float8 refunds,
      coalesce(sum(value_numeric) filter(where metric_id='refund.orders'),0)::float8 refundorders,
      coalesce(max(watermark),clock_timestamp()) watermark
    from scoped_facts
  ), period as(
    select coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)::float8 sales,
      coalesce(sum(value_numeric) filter(where metric_id='sales.orders'),0)::float8 orders
    from scoped_facts where period_start>=date_trunc('day',clock_timestamp())-interval '29 days'
  ), active as(
    select count(distinct listing.sku_id)::integer count from catalog.listing listing join descendants on descendants.id=listing.scope_id
    where listing.status='published' and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
      and (listing.expires_at is null or listing.expires_at>clock_timestamp())
  ), sold as(
    select count(distinct dimensions->>'product')::integer count from scoped_facts where metric_id='product.amount'
  ), trend as(
    select jsonb_agg(jsonb_build_object('date',day::date,'salesCents',coalesce(amount,0)::float8,
      'orderCount',coalesce(orders,0)::float8) order by day) value
    from generate_series(date_trunc('day',clock_timestamp())-interval '6 days',date_trunc('day',clock_timestamp()),interval '1 day') day
    left join lateral(
      select sum(value_numeric) filter(where metric_id='sales.amount') amount,
        sum(value_numeric) filter(where metric_id='sales.orders') orders from scoped_facts
      where (period_start at time zone timezone)::date=day::date
    ) metric on true
  ), categories as(
    select coalesce(jsonb_agg(jsonb_build_object('name',category,'salesCents',amount,'share',
      case when total>0 then amount/total else 0 end) order by amount desc,category),'[]'::jsonb) value from(
      select dimensions->>'category' category,sum(value_numeric)::float8 amount,
        sum(sum(value_numeric)) over()::float8 total from scoped_facts
      where metric_id='category.amount' and period_start>=date_trunc('day',clock_timestamp())-interval '29 days'
      group by dimensions->>'category' order by amount desc limit 5
    ) ranked
  )
  select jsonb_build_object(
    'catalogCount',(select count(*)::integer from catalog.listing listing join descendants on descendants.id=listing.scope_id),
    'availableStock',(select coalesce(sum(stock.onhand-stock.safety-coalesce(reserved.quantity,0)),0)::float8
      from inventory.stockitem stock join descendants on descendants.id=stock.scope_id
      left join lateral(select sum(reservation.quantity) quantity from inventory.reservation reservation
        where reservation.stockitem_id=stock.id and reservation.state='active' and reservation.expires_at>clock_timestamp()) reserved on true),
    'orderCount',(select count(*)::integer from ordering.orderrecord orders join descendants on descendants.id=orders.mall_id),
    'afterSaleCount',(select count(*)::integer from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
      join descendants on descendants.id=orders.mall_id where aftersale.state not in('completed','cancelled','rejected')),
    'sales',jsonb_build_object('asOf',(select watermark from totals),
      'cumulativeSalesCents',greatest((select sales-refunds from totals),0),
      'paidOrderCount',greatest((select orders-refundorders from totals),0),
      'averageOrderValueCents',case when (select orders-refundorders from totals)>0
        then round(greatest((select sales-refunds from totals),0)/(select orders-refundorders from totals)) else 0 end,
      'periodSalesCents',(select sales from period),'periodPaidOrderCount',(select orders from period),
      'refundedCents',(select refunds from totals),'activeProductCount',(select count from active),
      'soldProductCount',(select count from sold),'unsoldActiveProductCount',greatest((select count from active)-(select count from sold),0),
      'trend',(select value from trend),'categories',(select value from categories),'topProducts','[]'::jsonb)
  )
$function$;

revoke all on function reporting.cockpit(text) from public;
grant execute on function reporting.cockpit(text) to shopapp,shopjob;

insert into runtime.schemaversion(version,checksum)
values('20260821077000','4e88ead328d8b3f4b2a912309cad55df9f582f5bd6afdd70cbfe2ef22324fbd0');

commit;
