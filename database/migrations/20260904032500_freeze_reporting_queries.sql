begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904032400') then raise exception 'REPORTING_QUERY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904032500') then raise exception 'REPORTING_QUERY_ALREADY_APPLIED'; end if;
  if to_regprocedure('reporting.cockpit(text,text,text)') is null or to_regprocedure('reporting.cockpitproducts(text,text,text)') is null then
    raise exception 'REPORTING_LEGACY_QUERY_MISSING';
  end if;
end
$precondition$;

drop function reporting.cockpit(text,text,text);
drop function reporting.cockpitproducts(text,text,text);

alter table reporting.export add column snapshot_at timestamptz;
update reporting.export set snapshot_at=created_at;
alter table reporting.export alter column snapshot_at set not null;
alter table reporting.export add constraint reporting_export_snapshot_time check(watermark_at<=snapshot_at and snapshot_at<=created_at);

create or replace function reporting.guard_export_snapshot() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
begin
  if new.scope_id<>old.scope_id or new.report<>old.report or new.filter<>old.filter or new.query_snapshot<>old.query_snapshot or
    new.authorization_snapshot<>old.authorization_snapshot or new.watermark_event<>old.watermark_event or new.watermark_at<>old.watermark_at or
    new.watermark_version<>old.watermark_version or new.generation_version<>old.generation_version or new.snapshot_at<>old.snapshot_at or
    new.created_at<>old.created_at then raise exception 'REPORTING_EXPORT_SNAPSHOT_IMMUTABLE'; end if;
  return new;
end
$function$;

create function reporting.metricexportrows(p_export text) returns table(key text,rowvalues jsonb)
language sql stable security invoker
set search_path=pg_catalog,reporting
as $function$
  with selected_job as(
    select job.* from reporting.export job where job.id=p_export and job.report='metrics'
  ), facts as(
    select distinct on(revision.metric_id,revision.metric_version,revision.scope_id,revision.period_start,revision.dimensions) revision.*
    from selected_job job join reporting.factrevision revision on revision.scope_id=job.scope_id
      and revision.watermark<=job.watermark_at and revision.data_version<=job.watermark_version
    order by revision.metric_id,revision.metric_version,revision.scope_id,revision.period_start,revision.dimensions,revision.projection_version desc
  ), selected as(
    select fact.*,metric.name,metric.formula,metric.dimensions available_dimensions,metric.granularity,metric.owner,metric.unit,
      job.query_snapshot,job.watermark_at,job.snapshot_at
    from selected_job job join facts fact on true
    join reporting.metric metric on metric.id=fact.metric_id and metric.version=fact.metric_version
    where fact.metric_id like case job.filter->>'view'
      when 'sales' then 'sales.%' when 'products' then 'product.%' when 'malls' then 'mall.%'
      when 'categories' then 'category.%' when 'channels' then 'channel.%' when 'members' then 'member.%'
      when 'voucher' then 'voucher.%' else null end
      and (not job.filter?'application' or fact.dimensions->>'application'=job.filter->>'application')
      and fact.period_start>=case job.filter->>'period'
        when 'yesterday' then date_trunc('day',job.snapshot_at at time zone fact.timezone) at time zone fact.timezone-interval '1 day'
        when '7days' then date_trunc('day',job.snapshot_at at time zone fact.timezone) at time zone fact.timezone-interval '6 days'
        when '30days' then date_trunc('day',job.snapshot_at at time zone fact.timezone) at time zone fact.timezone-interval '29 days'
        when 'realtime' then date_trunc('day',job.snapshot_at at time zone fact.timezone) at time zone fact.timezone
        else null end
      and (job.filter->>'period'<>'yesterday' or fact.period_end<=date_trunc('day',job.snapshot_at at time zone fact.timezone) at time zone fact.timezone)
  )
  select to_char(period_end,'YYYY-MM-DD"T"HH24:MI:SS.USOF')||':'||metric_id||':'||md5(dimensions::text),
    jsonb_build_array(metric_id,metric_version,name,formula,available_dimensions,granularity,owner,scope_id,period_start,period_end,
      timezone,dimensions,value_numeric,unit,currency,watermark,projection_version,query_snapshot,snapshot_at)
  from selected
$function$;

create function reporting.cockpitproducts(
  p_scope text,p_period text,p_application text,p_watermark timestamptz,p_version bigint,p_snapshot_at timestamptz
) returns jsonb
language sql stable security invoker
set search_path=pg_catalog,reporting,organization
as $function$
  with settings as(
    select coalesce((select timezone from organization.organization where id=p_scope),'Asia/Shanghai') timezone
  ), bounds as(
    select timezone,
      case p_period when 'yesterday' then date_trunc('day',p_snapshot_at at time zone timezone) at time zone timezone-interval '1 day'
        when '7days' then date_trunc('day',p_snapshot_at at time zone timezone) at time zone timezone-interval '6 days'
        when '30days' then date_trunc('day',p_snapshot_at at time zone timezone) at time zone timezone-interval '29 days'
        else date_trunc('day',p_snapshot_at at time zone timezone) at time zone timezone end from_at,
      case when p_period='yesterday' then date_trunc('day',p_snapshot_at at time zone timezone) at time zone timezone else p_snapshot_at end to_at
    from settings where p_period in('realtime','yesterday','7days','30days')
  ), orders as(
    select distinct on(revision.order_id,revision.scope_id) revision.* from reporting.orderrevision revision
    where revision.scope_id=p_scope and revision.watermark<=p_watermark and revision.data_version<=p_version
    order by revision.order_id,revision.scope_id,revision.projection_version desc
  ), lines as(
    select projection.order_id,line.value from orders projection cross join bounds
    cross join lateral jsonb_array_elements(case when jsonb_typeof(projection.snapshot->'lines')='array' then projection.snapshot->'lines' else '[]'::jsonb end) line
    where projection.payment_state in('paid','partially_refunded','refunded')
      and projection.watermark>=bounds.from_at and projection.watermark<bounds.to_at
      and (p_application is null or projection.snapshot->>'application'=p_application)
      and line.value->>'product' is not null and line.value->>'product'<>''
      and line.value->>'payableMinor'~'^[0-9]+$' and line.value->>'quantity'~'^[0-9]+$'
  ), ranked as(
    select value->>'product' product_id,coalesce(nullif(value->>'title',''),value->>'product') product_name,
      sum((value->>'payableMinor')::bigint)::float8 sales_cents,sum((value->>'quantity')::integer)::integer quantity,
      count(distinct order_id)::integer order_count
    from lines group by value->>'product',coalesce(nullif(value->>'title',''),value->>'product')
    order by sales_cents desc,quantity desc,product_id limit 5
  )
  select coalesce(jsonb_agg(jsonb_build_object('productId',product_id,'name',product_name,'salesCents',sales_cents,
    'quantity',quantity,'orderCount',order_count) order by sales_cents desc,quantity desc,product_id),'[]'::jsonb) from ranked
$function$;

create function reporting.cockpit(
  p_scope text,p_period text,p_application text,p_watermark timestamptz,p_version bigint,p_snapshot_at timestamptz
) returns jsonb
language sql stable security invoker
set search_path=pg_catalog,reporting,organization
as $function$
  with settings as(
    select coalesce((select timezone from organization.organization where id=p_scope),'Asia/Shanghai') timezone
  ), bounds as(
    select timezone,
      case p_period when 'yesterday' then date_trunc('day',p_snapshot_at at time zone timezone) at time zone timezone-interval '1 day'
        when '7days' then date_trunc('day',p_snapshot_at at time zone timezone) at time zone timezone-interval '6 days'
        when '30days' then date_trunc('day',p_snapshot_at at time zone timezone) at time zone timezone-interval '29 days'
        else date_trunc('day',p_snapshot_at at time zone timezone) at time zone timezone end from_at,
      case when p_period='yesterday' then date_trunc('day',p_snapshot_at at time zone timezone) at time zone timezone else p_snapshot_at end to_at
    from settings where p_period in('realtime','yesterday','7days','30days')
  ), periods as(select *,from_at-(to_at-from_at) previous_from from bounds),
  descendants as(select descendant_id id from organization.unitclosure where ancestor_id=p_scope),
  scoped_facts as(
    select distinct on(revision.metric_id,revision.metric_version,revision.scope_id,revision.period_start,revision.dimensions) revision.*
    from reporting.factrevision revision where revision.scope_id=p_scope and revision.watermark<=p_watermark and revision.data_version<=p_version
      and (p_application is null or revision.dimensions->>'application'=p_application)
    order by revision.metric_id,revision.metric_version,revision.scope_id,revision.period_start,revision.dimensions,revision.projection_version desc
  ), scoped_orders as(
    select distinct on(revision.order_id,revision.scope_id) revision.* from reporting.orderrevision revision
    where revision.scope_id=p_scope and revision.watermark<=p_watermark and revision.data_version<=p_version
      and (p_application is null or revision.snapshot->>'application'=p_application)
    order by revision.order_id,revision.scope_id,revision.projection_version desc
  ), scoped_events as(
    select event.* from reporting.projectionevent event join descendants on descendants.id=event.scope_id
    where event.occurred_at<=p_watermark and event.projected_at<=p_snapshot_at
  ), cumulative as(
    select coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)::float8 sales,
      coalesce(sum(value_numeric) filter(where metric_id='sales.orders'),0)::float8 orders,
      coalesce(sum(value_numeric) filter(where metric_id='refund.amount'),0)::float8 refunds
    from scoped_facts
  ), current_values as(
    select coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)::float8 sales,
      coalesce(sum(value_numeric) filter(where metric_id='sales.orders'),0)::float8 orders,
      coalesce(sum(value_numeric) filter(where metric_id='refund.amount'),0)::float8 refunds
    from scoped_facts,periods where period_start>=from_at and period_start<to_at
  ), previous_values as(
    select coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)::float8 sales,
      coalesce(sum(value_numeric) filter(where metric_id='sales.orders'),0)::float8 orders,
      coalesce(sum(value_numeric) filter(where metric_id='refund.amount'),0)::float8 refunds
    from scoped_facts,periods where period_start>=previous_from and period_start<from_at
  ), calculated as(
    select greatest(current.sales-current.refunds,0)::float8 net_sales,current.orders::float8 paid_orders,
      case when current.orders>0 then greatest(current.sales-current.refunds,0)/current.orders else 0 end::float8 average_order,
      case when current.sales>0 then current.refunds/current.sales else 0 end::float8 refund_rate,
      greatest(previous.sales-previous.refunds,0)::float8 previous_net_sales,previous.orders::float8 previous_paid_orders,
      case when previous.orders>0 then greatest(previous.sales-previous.refunds,0)/previous.orders else 0 end::float8 previous_average_order,
      case when previous.sales>0 then previous.refunds/previous.sales else 0 end::float8 previous_refund_rate
    from current_values current cross join previous_values previous
  ), listing_events as(
    select distinct on(event.payload->>'listing') event.* from scoped_events event
    where event.event_type in('catalog.listing.published','catalog.listing.unpublished') and event.payload->>'listing' is not null
    order by event.payload->>'listing',event.occurred_at desc,event.event_id desc
  ), catalog_state as(
    select count(*)::integer count,count(distinct payload->>'sku')::integer products from listing_events
    where event_type='catalog.listing.published'
  ), stock_events as(
    select distinct on(event.payload->>'stockitem') event.* from scoped_events event
    where event.event_type='inventory.stock.changed' and event.payload->>'stockitem' is not null
    order by event.payload->>'stockitem',event.occurred_at desc,event.event_id desc
  ), stock_state as(
    select coalesce(sum((payload->>'available')::integer),0)::float8 available from stock_events where payload->>'available'~'^[0-9]+$'
  ), aftersale_events as(
    select distinct on(event.payload->>'aftersale') event.* from scoped_events event
    where event.event_type in('aftersale.applied','aftersale.changed') and event.payload->>'aftersale' is not null
      and (p_application is null or exists(select 1 from scoped_orders orders where orders.order_id=event.payload->>'order'))
    order by event.payload->>'aftersale',event.occurred_at desc,event.event_id desc
  ), aftersale_state as(
    select count(*)::integer count from aftersale_events where payload->>'state' not in('resolved','rejected','cancelled')
  ), sold as(
    select count(distinct dimensions->>'product')::integer count from scoped_facts,periods
    where metric_id='product.amount' and period_start>=from_at and period_start<to_at
  ), day_trend as(
    select coalesce(jsonb_agg(jsonb_build_object('date',to_char(day at time zone periods.timezone,'YYYY-MM-DD'),
      'salesCents',greatest(coalesce(metric.sales,0)-coalesce(metric.refunds,0),0)::float8,'orderCount',coalesce(metric.orders,0)::float8) order by day),'[]'::jsonb) value
    from periods cross join lateral generate_series(from_at,date_trunc('day',(to_at-interval '1 microsecond') at time zone timezone) at time zone timezone,interval '1 day') day
    left join lateral(select sum(value_numeric) filter(where metric_id='sales.amount') sales,
      sum(value_numeric) filter(where metric_id='refund.amount') refunds,sum(value_numeric) filter(where metric_id='sales.orders') orders
      from scoped_facts where period_start>=day and period_start<day+interval '1 day') metric on true group by periods.timezone
  ), week_trend as(
    select coalesce(jsonb_agg(jsonb_build_object('date',to_char(week_at at time zone periods.timezone,'YYYY-MM-DD'),
      'salesCents',greatest(coalesce(metric.sales,0)-coalesce(metric.refunds,0),0)::float8,'orderCount',coalesce(metric.orders,0)::float8) order by week_at),'[]'::jsonb) value
    from periods cross join lateral generate_series(date_trunc('week',to_at at time zone timezone) at time zone timezone-interval '7 weeks',
      date_trunc('week',to_at at time zone timezone) at time zone timezone,interval '1 week') week_at
    left join lateral(select sum(value_numeric) filter(where metric_id='sales.amount') sales,
      sum(value_numeric) filter(where metric_id='refund.amount') refunds,sum(value_numeric) filter(where metric_id='sales.orders') orders
      from scoped_facts where period_start>=week_at and period_start<week_at+interval '1 week') metric on true group by periods.timezone
  ), categories as(
    select coalesce(jsonb_agg(jsonb_build_object('name',category,'salesCents',amount,'share',case when total>0 then amount/total else 0 end)
      order by amount desc,category),'[]'::jsonb) value from(
      select dimensions->>'category' category,sum(value_numeric)::float8 amount,sum(sum(value_numeric)) over()::float8 total
      from scoped_facts,periods where metric_id='category.amount' and period_start>=from_at and period_start<to_at
      group by dimensions->>'category' order by amount desc,category limit 5
    ) ranked
  ), mall_rows as(
    select dimensions->>'mall' id,greatest(coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)-coalesce(sum(value_numeric) filter(where metric_id='refund.amount'),0),0)::float8 sales,
      coalesce(sum(value_numeric) filter(where metric_id='sales.orders'),0)::integer orders,
      case when coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)>0 then coalesce(sum(value_numeric) filter(where metric_id='refund.amount'),0)/sum(value_numeric) filter(where metric_id='sales.amount') else 0 end::float8 refund_rate
    from scoped_facts,periods where period_start>=from_at and period_start<to_at and dimensions?'mall' group by dimensions->>'mall'
  ), malls as(
    select coalesce(jsonb_agg(jsonb_build_object('id',mall.id,'name',coalesce(organization.name,mall.id),'salesCents',mall.sales,
      'paidOrderCount',mall.orders,'refundRate',mall.refund_rate) order by mall.sales desc,mall.id),'[]'::jsonb) value
    from mall_rows mall left join organization.organization organization on organization.id=mall.id
  ), event_rows as(
    select event.event_id,event.event_type,event.payload,event.occurred_at,
      case when event.event_type='refund.completed' then 'warning' when event.event_type='channel.sync.completed' then 'sync' else 'calendar' end kind,
      case event.event_type when 'refund.completed' then '退款完成' when 'channel.sync.completed' then '渠道同步完成'
        when 'voucher.redeemed' then '卡券核销' when 'order.paid' then '订单支付' else '经营状态更新' end title
    from scoped_events event,periods where event.occurred_at>=from_at and event.occurred_at<to_at
      and event.event_type in('order.paid','refund.completed','voucher.redeemed','channel.sync.completed')
      and (p_application is null or coalesce(event.payload->>'application',event.payload->'snapshot'->>'application')=p_application)
    order by event.occurred_at desc,event.event_id desc limit 6
  ), events as(
    select coalesce(jsonb_agg(jsonb_build_object('id',event_id,'kind',kind,'title',title,
      'metric',case when payload?'amountMinor' then '¥'||to_char((payload->>'amountMinor')::numeric/100,'FM999G999G999G990D00') else '已完成' end,
      'time',occurred_at,'date',to_char(occurred_at at time zone (select timezone from settings),'YYYY-MM-DD'))
      order by occurred_at desc,event_id desc),'[]'::jsonb) value from event_rows
  ), insights as(
    select coalesce(jsonb_agg(value order by priority,id),'[]'::jsonb) value from(
      select 1 priority,'refund-rate' id,jsonb_build_object('id','refund-rate','tone','warning','title','退款率需要关注',
        'detail','当前周期退款率为 '||to_char(refund_rate*100,'FM990D0')||'%','action','查看订单','target','orders') value
      from calculated where refund_rate>=0.04
      union all select 2,'unsold-products',jsonb_build_object('id','unsold-products','tone','warning','title','存在未售出的上架商品',
        'detail',(select greatest(products-sold.count,0) from catalog_state cross join sold)||' 个商品在当前周期尚未成交','action','查看报表','target','reports')
      from catalog_state cross join sold where products-sold.count>0
      union all select 3,'net-sales-growth',jsonb_build_object('id','net-sales-growth','tone','positive','title','净成交额保持增长',
        'detail','较上一等长周期增长 '||to_char((net_sales/previous_net_sales-1)*100,'FM990D0')||'%','action','查看报表','target','reports')
      from calculated where previous_net_sales>0 and net_sales>previous_net_sales
    ) insight
  )
  select jsonb_build_object(
    'catalogCount',(select count from catalog_state),'availableStock',(select available from stock_state),
    'orderCount',(select count(*)::integer from scoped_orders),'afterSaleCount',(select count from aftersale_state),
    'sales',jsonb_build_object('asOf',p_watermark,'cumulativeSalesCents',greatest((select sales-refunds from cumulative),0),
      'paidOrderCount',(select orders from cumulative),'averageOrderValueCents',(select average_order from calculated),
      'periodSalesCents',(select net_sales from calculated),'periodPaidOrderCount',(select paid_orders from calculated),
      'refundedCents',(select refunds from current_values),'activeProductCount',(select products from catalog_state),
      'soldProductCount',(select count from sold),'unsoldActiveProductCount',(select greatest(catalog_state.products-sold.count,0) from catalog_state cross join sold),
      'period',jsonb_build_object('from',(select from_at from periods),'to',(select to_at from periods)),
      'conclusion',(select case when refund_rate>=0.04 then '退款率高于 4%，建议优先检查售后订单与商品质量。'
        when previous_net_sales>0 and net_sales>previous_net_sales then '净成交额较上一等长周期增长，经营表现向好。'
        when net_sales=0 then '当前周期暂无净成交，请检查商品可售状态与渠道运行情况。'
        else '当前经营数据平稳，建议继续关注趋势与商城差异。' end from calculated),
      'deltas',(select jsonb_build_object('netSalesRatio',case when previous_net_sales>0 then net_sales/previous_net_sales-1 else null end,
        'paidOrdersRatio',case when previous_paid_orders>0 then paid_orders/previous_paid_orders-1 else null end,
        'averageOrderRatio',case when previous_average_order>0 then average_order/previous_average_order-1 else null end,
        'refundRate',refund_rate,'refundRateDeltaPoints',case when previous_values.sales>0 then refund_rate-previous_refund_rate else null end)
        from calculated cross join previous_values),
      'trend',(select value from day_trend),'weeklyTrend',(select value from week_trend),'categories',(select value from categories),
      'topProducts','[]'::jsonb,'malls',(select value from malls),'events',(select value from events),'insights',(select value from insights)
    )
  )
$function$;

revoke all on function reporting.metricexportrows(text) from public;
revoke all on function reporting.cockpit(text,text,text,timestamptz,bigint,timestamptz) from public;
revoke all on function reporting.cockpitproducts(text,text,text,timestamptz,bigint,timestamptz) from public;
grant execute on function reporting.metricexportrows(text) to shopapp,shopjob;
grant execute on function reporting.cockpit(text,text,text,timestamptz,bigint,timestamptz) to shopapp,shopjob;
grant execute on function reporting.cockpitproducts(text,text,text,timestamptz,bigint,timestamptz) to shopapp,shopjob;

select runtime.record_migration_evidence(
  '20260904032500',0,0,0,0,
  'select to_regprocedure(''reporting.metricexportrows(text)''),to_regprocedure(''reporting.cockpit(text,text,text,timestamptz,bigint,timestamptz)'');',
  'select id,scope_id,filter,query_snapshot,watermark_at,watermark_version,snapshot_at,created_at from reporting.export where report=''metrics'' order by created_at desc limit 20;'
);

insert into runtime.schemaversion(version,checksum)
values('20260904032500',encode(public.digest('20260904032500_freeze_reporting_queries','sha256'),'hex'));

do $assert$
begin
  if to_regprocedure('reporting.cockpit(text,text,text)') is not null or to_regprocedure('reporting.cockpitproducts(text,text,text)') is not null then
    raise exception 'REPORTING_COMPATIBILITY_QUERY_RESTORED';
  end if;
  if to_regprocedure('reporting.metricexportrows(text)') is null
    or to_regprocedure('reporting.cockpit(text,text,text,timestamptz,bigint,timestamptz)') is null
    or to_regprocedure('reporting.cockpitproducts(text,text,text,timestamptz,bigint,timestamptz)') is null then
    raise exception 'REPORTING_FROZEN_QUERY_MISSING';
  end if;
  if exists(select 1 from reporting.export where watermark_at>snapshot_at or snapshot_at>created_at) then raise exception 'REPORTING_EXPORT_SNAPSHOT_TIME_INVALID'; end if;
  if jsonb_typeof(reporting.cockpit('organization-platform-root','30days',null,clock_timestamp(),1,clock_timestamp()))<>'object'
    or jsonb_typeof(reporting.cockpitproducts('organization-platform-root','30days',null,clock_timestamp(),1,clock_timestamp()))<>'array' then
    raise exception 'REPORTING_FROZEN_QUERY_RESULT_INVALID';
  end if;
end
$assert$;

commit;
