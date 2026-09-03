begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903108000') then
    raise exception 'COCKPIT_PROJECTION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260903109000') then
    raise exception 'COCKPIT_PROJECTION_ALREADY_APPLIED';
  end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0'
    and checksum='4aa32bd8ab3432b2a47891fb0cddf8f52fd2e9de2b5ba5d9ffaf5943da222fa1' and status='active') then
    raise exception 'COCKPIT_PROJECTION_PREVIOUS_CONTRACT_INVALID';
  end if;
end
$precondition$;

insert into runtime.operation(id,owner,method,path,contract_version)
values('order.aftersaleattachments.create','order','POST','/api/v1/orders/{orderid}/aftersale-attachments','5.0.0');
insert into capability.capability(id,kind,name,version,status)
values('order.aftersaleattachments.create','operation','order.aftersaleattachments.create',3,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('order.aftersaleattachments.create','order.aftersaleattachments.create','order.aftersale.apply','storefront');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:order.aftersaleattachments.create','organization-platform-root','order.aftersaleattachments.create','enabled',null,'1970-01-01T00:00:00Z',null,0);

alter table reporting.projectionevent add column payload jsonb not null default '{}'::jsonb;
alter table reporting.projectionevent alter column payload drop default;
alter table reporting.projectionevent add constraint reporting_projection_payload check(jsonb_typeof(payload)='object' and pg_column_size(payload)<=262144);
create index reporting_projection_scope_time on reporting.projectionevent(scope_id,occurred_at desc,event_id desc);

drop function reporting.cockpit(text);
create function reporting.cockpit(p_scope text,p_period text,p_application text) returns jsonb
language sql stable security invoker
set search_path=pg_catalog,reporting,organization,catalog,inventory,ordering,experience
as $function$
  with settings as(
    select coalesce((select timezone from organization.organization where id=p_scope),'Asia/Shanghai') timezone,
      clock_timestamp() now_at
  ), bounds as(
    select timezone,now_at,
      case p_period
        when 'yesterday' then date_trunc('day',now_at at time zone timezone) at time zone timezone-interval '1 day'
        when '7days' then date_trunc('day',now_at at time zone timezone) at time zone timezone-interval '6 days'
        when '30days' then date_trunc('day',now_at at time zone timezone) at time zone timezone-interval '29 days'
        else date_trunc('day',now_at at time zone timezone) at time zone timezone
      end from_at,
      case when p_period='yesterday' then date_trunc('day',now_at at time zone timezone) at time zone timezone else now_at end to_at
    from settings where p_period in('realtime','yesterday','7days','30days')
  ), periods as(
    select *,from_at-(to_at-from_at) previous_from from bounds
  ), descendants as(
    select descendant_id id from organization.unitclosure where ancestor_id=p_scope
  ), selected_pool as(
    select release.pool_id from experience.application application
    join descendants on descendants.id=application.mall_id
    join experience.release release on release.application_id=application.id and release.state='active' and release.effective_at<=(select now_at from settings)
    where application.id=p_application order by release.effective_at desc,release.id desc limit 1
  ), scoped_facts as(
    select fact.* from reporting.fact fact
    where fact.scope_id=p_scope and (p_application is null or fact.dimensions->>'application'=p_application)
  ), cumulative as(
    select coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)::float8 sales,
      coalesce(sum(value_numeric) filter(where metric_id='sales.orders'),0)::float8 orders,
      coalesce(sum(value_numeric) filter(where metric_id='refund.amount'),0)::float8 refunds,
      coalesce(sum(value_numeric) filter(where metric_id='refund.orders'),0)::float8 refundorders
    from scoped_facts
  ), current_values as(
    select coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)::float8 sales,
      coalesce(sum(value_numeric) filter(where metric_id='sales.orders'),0)::float8 orders,
      coalesce(sum(value_numeric) filter(where metric_id='refund.amount'),0)::float8 refunds,
      coalesce(sum(value_numeric) filter(where metric_id='refund.orders'),0)::float8 refundorders
    from scoped_facts,periods where period_start>=from_at and period_start<to_at
  ), previous_values as(
    select coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)::float8 sales,
      coalesce(sum(value_numeric) filter(where metric_id='sales.orders'),0)::float8 orders,
      coalesce(sum(value_numeric) filter(where metric_id='refund.amount'),0)::float8 refunds,
      coalesce(sum(value_numeric) filter(where metric_id='refund.orders'),0)::float8 refundorders
    from scoped_facts,periods where period_start>=previous_from and period_start<from_at
  ), calculated as(
    select greatest(current.sales-current.refunds,0)::float8 net_sales,current.orders::float8 paid_orders,
      case when current.orders>0 then greatest(current.sales-current.refunds,0)/current.orders else 0 end::float8 average_order,
      case when current.sales>0 then current.refunds/current.sales else 0 end::float8 refund_rate,
      greatest(previous.sales-previous.refunds,0)::float8 previous_net_sales,previous.orders::float8 previous_paid_orders,
      case when previous.orders>0 then greatest(previous.sales-previous.refunds,0)/previous.orders else 0 end::float8 previous_average_order,
      case when previous.sales>0 then previous.refunds/previous.sales else 0 end::float8 previous_refund_rate
    from current_values current cross join previous_values previous
  ), active as(
    select count(distinct listing.sku_id)::integer count from catalog.listing listing
    join descendants on descendants.id=listing.scope_id
    where listing.status='published' and (listing.effective_at is null or listing.effective_at<=(select now_at from settings))
      and (listing.expires_at is null or listing.expires_at>(select now_at from settings))
      and (p_application is null or listing.pool_id=(select pool_id from selected_pool))
  ), catalog_total as(
    select count(*)::integer count from catalog.listing listing join descendants on descendants.id=listing.scope_id
    where p_application is null or listing.pool_id=(select pool_id from selected_pool)
  ), sold as(
    select count(distinct dimensions->>'product')::integer count from scoped_facts,periods
    where metric_id='product.amount' and period_start>=from_at and period_start<to_at
  ), day_trend as(
    select coalesce(jsonb_agg(jsonb_build_object('date',to_char(day at time zone periods.timezone,'YYYY-MM-DD'),
      'salesCents',greatest(coalesce(metric.sales,0)-coalesce(metric.refunds,0),0)::float8,
      'orderCount',coalesce(metric.orders,0)::float8) order by day),'[]'::jsonb) value
    from periods cross join lateral generate_series(from_at,date_trunc('day',(to_at-interval '1 microsecond') at time zone timezone) at time zone timezone,interval '1 day') day
    left join lateral(
      select sum(value_numeric) filter(where metric_id='sales.amount') sales,
        sum(value_numeric) filter(where metric_id='refund.amount') refunds,
        sum(value_numeric) filter(where metric_id='sales.orders') orders
      from scoped_facts where period_start>=day and period_start<day+interval '1 day'
    ) metric on true group by periods.timezone
  ), week_trend as(
    select coalesce(jsonb_agg(jsonb_build_object('date',to_char(week_at at time zone periods.timezone,'YYYY-MM-DD'),
      'salesCents',greatest(coalesce(metric.sales,0)-coalesce(metric.refunds,0),0)::float8,
      'orderCount',coalesce(metric.orders,0)::float8) order by week_at),'[]'::jsonb) value
    from periods cross join lateral generate_series(
      date_trunc('week',to_at at time zone timezone) at time zone timezone-interval '7 weeks',
      date_trunc('week',to_at at time zone timezone) at time zone timezone,interval '1 week') week_at
    left join lateral(
      select sum(value_numeric) filter(where metric_id='sales.amount') sales,
        sum(value_numeric) filter(where metric_id='refund.amount') refunds,
        sum(value_numeric) filter(where metric_id='sales.orders') orders
      from scoped_facts where period_start>=week_at and period_start<week_at+interval '1 week'
    ) metric on true group by periods.timezone
  ), categories as(
    select coalesce(jsonb_agg(jsonb_build_object('name',category,'salesCents',amount,'share',case when total>0 then amount/total else 0 end)
      order by amount desc,category),'[]'::jsonb) value from(
      select dimensions->>'category' category,sum(value_numeric)::float8 amount,sum(sum(value_numeric)) over()::float8 total
      from scoped_facts,periods where metric_id='category.amount' and period_start>=from_at and period_start<to_at
      group by dimensions->>'category' order by amount desc,category limit 5
    ) ranked
  ), mall_rows as(
    select dimensions->>'mall' id,
      greatest(coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)-coalesce(sum(value_numeric) filter(where metric_id='refund.amount'),0),0)::float8 sales,
      coalesce(sum(value_numeric) filter(where metric_id='sales.orders'),0)::integer orders,
      case when coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)>0
        then coalesce(sum(value_numeric) filter(where metric_id='refund.amount'),0)/sum(value_numeric) filter(where metric_id='sales.amount') else 0 end::float8 refund_rate
    from scoped_facts,periods where period_start>=from_at and period_start<to_at and dimensions?'mall'
    group by dimensions->>'mall'
  ), malls as(
    select coalesce(jsonb_agg(jsonb_build_object('id',mall.id,'name',coalesce(organization.name,mall.id),'salesCents',mall.sales,
      'paidOrderCount',mall.orders,'refundRate',mall.refund_rate) order by mall.sales desc,mall.id),'[]'::jsonb) value
    from mall_rows mall left join organization.organization organization on organization.id=mall.id
  ), event_rows as(
    select event.event_id,event.event_type,event.payload,event.occurred_at,
      case when event.event_type='refund.completed' then 'warning' when event.event_type='channel.sync.completed' then 'sync' else 'calendar' end kind,
      case event.event_type when 'refund.completed' then '退款完成' when 'channel.sync.completed' then '渠道同步完成'
        when 'voucher.redeemed' then '卡券核销' when 'order.paid' then '订单支付' else '经营状态更新' end title
    from reporting.projectionevent event join organization.unitclosure closure
      on closure.descendant_id=event.scope_id and closure.ancestor_id=p_scope
    where event.occurred_at>=(select from_at from periods) and event.occurred_at<(select to_at from periods)
      and event.event_type in('order.paid','refund.completed','voucher.redeemed','channel.sync.completed')
      and (p_application is null or coalesce(event.payload->>'application',event.payload->'snapshot'->>'application',
        (select projection.snapshot->>'application' from reporting.orderprojection projection
          where projection.order_id=event.payload->>'order' and projection.scope_id=p_scope limit 1))=p_application)
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
      union all
      select 2,'unsold-products',jsonb_build_object('id','unsold-products','tone','warning','title','存在未售出的上架商品',
        'detail',(select greatest(active.count-sold.count,0) from active cross join sold)||' 个商品在当前周期尚未成交','action','查看报表','target','reports')
      from active cross join sold where active.count-sold.count>0
      union all
      select 3,'net-sales-growth',jsonb_build_object('id','net-sales-growth','tone','positive','title','净成交额保持增长',
        'detail','较上一等长周期增长 '||to_char((net_sales/previous_net_sales-1)*100,'FM990D0')||'%','action','查看报表','target','reports')
      from calculated where previous_net_sales>0 and net_sales>previous_net_sales
    ) insight
  ), waterline as(
    select coalesce((select occurred_at from reporting.watermark where projection='commerce' and scope_id=p_scope),
      (select max(watermark) from scoped_facts),(select now_at from settings)) value
  )
  select jsonb_build_object(
    'catalogCount',(select count from catalog_total),
    'availableStock',(select coalesce(sum(stock.onhand-stock.safety-coalesce(reserved.quantity,0)),0)::float8
      from inventory.stockitem stock join descendants on descendants.id=stock.scope_id
      left join lateral(select sum(reservation.quantity) quantity from inventory.reservation reservation
        where reservation.stockitem_id=stock.id and reservation.state='active' and reservation.expires_at>(select now_at from settings)) reserved on true
      where p_application is null or exists(select 1 from catalog.listing listing where listing.sku_id=stock.sku_id and listing.pool_id=(select pool_id from selected_pool))),
    'orderCount',(select count(*)::integer from reporting.orderprojection projection where projection.scope_id=p_scope
      and (p_application is null or projection.snapshot->>'application'=p_application)),
    'afterSaleCount',(select count(*)::integer from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
      join descendants on descendants.id=orders.mall_id where aftersale.state not in('resolved','rejected') and
      (p_application is null or exists(select 1 from reporting.orderprojection projection where projection.order_id=orders.id
        and projection.scope_id=p_scope and projection.snapshot->>'application'=p_application))),
    'sales',jsonb_build_object(
      'asOf',(select value from waterline),
      'cumulativeSalesCents',greatest((select sales-refunds from cumulative),0),
      'paidOrderCount',(select orders from cumulative),
      'averageOrderValueCents',(select average_order from calculated),
      'periodSalesCents',(select net_sales from calculated),
      'periodPaidOrderCount',(select paid_orders from calculated),
      'refundedCents',(select refunds from current_values),
      'activeProductCount',(select count from active),
      'soldProductCount',(select count from sold),
      'unsoldActiveProductCount',(select greatest(active.count-sold.count,0) from active cross join sold),
      'period',jsonb_build_object('from',(select from_at from periods),'to',(select to_at from periods)),
      'conclusion',(select case when refund_rate>=0.04 then '退款率高于 4%，建议优先检查售后订单与商品质量。'
        when previous_net_sales>0 and net_sales>previous_net_sales then '净成交额较上一等长周期增长，经营表现向好。'
        when net_sales=0 then '当前周期暂无净成交，请检查商品可售状态与渠道运行情况。'
        else '当前经营数据平稳，建议继续关注趋势与商城差异。' end from calculated),
      'deltas',(select jsonb_build_object(
        'netSalesRatio',case when previous_net_sales>0 then net_sales/previous_net_sales-1 else null end,
        'paidOrdersRatio',case when previous_paid_orders>0 then paid_orders/previous_paid_orders-1 else null end,
        'averageOrderRatio',case when previous_average_order>0 then average_order/previous_average_order-1 else null end,
        'refundRate',refund_rate,
        'refundRateDeltaPoints',case when previous_values.sales>0 then refund_rate-previous_refund_rate else null end)
        from calculated cross join previous_values),
      'trend',(select value from day_trend),
      'weeklyTrend',(select value from week_trend),
      'categories',(select value from categories),
      'topProducts','[]'::jsonb,
      'malls',(select value from malls),
      'events',(select value from events),
      'insights',(select value from insights)
    )
  )
$function$;

revoke all on function reporting.cockpit(text,text,text) from public;
grant execute on function reporting.cockpit(text,text,text) to shopapp,shopjob;

update runtime.contractcatalog
set checksum='353640f7fc3c991b6193a7f9e446ba0ecb143d94223af1a0c423466ab2de0e78',
    operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260903109000',1,1,0,0,
  'select to_regprocedure(''reporting.cockpit(text,text,text)'');',
  'select event_id,event_type,scope_id,occurred_at from reporting.projectionevent order by occurred_at desc,event_id desc limit 20;'
);

insert into runtime.schemaversion(version,checksum) values('20260903109000','353640f7fc3c991b6193a7f9e446ba0ecb143d94223af1a0c423466ab2de0e78');

do $assert$
begin
  if to_regprocedure('reporting.cockpit(text,text,text)') is null or to_regprocedure('reporting.cockpit(text)') is not null then
    raise exception 'COCKPIT_PROJECTION_FUNCTION_INVALID';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='reporting' and table_name='projectionevent' and column_name='payload') then
    raise exception 'COCKPIT_PROJECTION_EVENT_PAYLOAD_MISSING';
  end if;
  if not exists(select 1 from capability.operation where operation_id='order.aftersaleattachments.create'
    and permission_code='order.aftersale.apply' and audience='storefront') then
    raise exception 'AFTERSALE_ATTACHMENT_OPERATION_MISSING';
  end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0' and status='active'
    and checksum='353640f7fc3c991b6193a7f9e446ba0ecb143d94223af1a0c423466ab2de0e78' and operation_count=275 and event_count=103) then
    raise exception 'COCKPIT_PROJECTION_CONTRACT_INVALID';
  end if;
end
$assert$;

commit;
