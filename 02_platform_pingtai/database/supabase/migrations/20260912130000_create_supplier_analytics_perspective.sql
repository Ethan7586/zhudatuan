begin;

create or replace function reporting.supplier_metric_rows(
  p_scope text,
  p_supplier text,
  p_dimension text,
  p_period text
)
returns table(
  code text,
  version integer,
  scope text,
  period jsonb,
  dimensions jsonb,
  value double precision,
  unit text,
  watermark timestamptz,
  projection_version integer,
  cursor_time timestamptz,
  cursor_id text
)
language sql stable security definer
set search_path=pg_catalog,reporting,partner,catalog,ordering,finance
set row_security=off
as $function$
  with bounds as (
    select case p_period
      when 'yesterday' then date_trunc('day',clock_timestamp())-interval '1 day'
      when '7days' then date_trunc('day',clock_timestamp())-interval '6 days'
      when '30days' then date_trunc('day',clock_timestamp())-interval '29 days'
      else date_trunc('day',clock_timestamp()) end from_at,
      case when p_period='yesterday' then date_trunc('day',clock_timestamp()) else clock_timestamp() end to_at
  ), supplier as (
    select value.id,value.name
    from partner.partner value
    where value.id=p_supplier and value.scope_id=p_scope and value.kind='supplier' and value.status='active'
  ), supplied_lines as (
    select orders.id order_id,orders.created_at,orders.updated_at,orders.fulfillment_state,orders.aftersale_state,
      line.id line_id,line.total_minor,line.quantity,
      coalesce(line.product_id,product.id) product_id,coalesce(product.title,line.title_snapshot) product_name,
      coalesce(category.id,'category:uncategorized') category_id,coalesce(category.name,'未分类') category_name,
      coalesce(product.attributes->>'supplyChannel',line.provider,'供应商直供') channel
    from ordering.orderrecord orders
    join ordering.line line on line.order_id=orders.id
    left join catalog.sku sku on sku.id=line.sku_id
    left join catalog.product product on product.id=coalesce(line.product_id,sku.product_id)
    left join catalog.category category on category.id=product.category_id
    join supplier on supplier.id=coalesce(line.supplier_id,product.owner_partner_id)
    cross join bounds
    where orders.mall_id=p_scope and orders.payment_state in('paid','partially_refunded','refunded')
      and orders.created_at>=bounds.from_at and orders.created_at<bounds.to_at
  ), refunds as (
    select coalesce(sum(coalesce(aftersale.amount_minor,0)),0)::double precision amount
    from ordering.aftersale aftersale join supplied_lines line on line.line_id=aftersale.line_id
    where aftersale.state='completed'
  ), rows as (
    select 'sales.amount' code,'净供应成交额' label,
      greatest(coalesce(sum(line.total_minor),0)-(select amount from refunds),0)::double precision value,'minor' unit,
      jsonb_build_object('supplier',p_supplier,'supplierName',(select name from supplier)) extra
    from supplied_lines line having p_dimension='sales'
    union all
    select 'sales.orders','供应订单',count(distinct line.order_id)::double precision,'count',
      jsonb_build_object('supplier',p_supplier,'supplierName',(select name from supplier))
    from supplied_lines line having p_dimension='sales'
    union all
    select 'product.amount',line.product_name,coalesce(sum(line.total_minor),0)::double precision,'minor',
      jsonb_build_object('supplier',p_supplier,'supplierName',(select name from supplier),'product',line.product_id)
    from supplied_lines line where p_dimension='product'
    group by line.product_id,line.product_name
    union all
    select 'category.amount',line.category_name,coalesce(sum(line.total_minor),0)::double precision,'minor',
      jsonb_build_object('supplier',p_supplier,'supplierName',(select name from supplier),'category',line.category_id)
    from supplied_lines line where p_dimension='category'
    group by line.category_id,line.category_name
    union all
    select 'channel.amount',line.channel,coalesce(sum(line.total_minor),0)::double precision,'minor',
      jsonb_build_object('supplier',p_supplier,'supplierName',(select name from supplier),'channel',line.channel)
    from supplied_lines line where p_dimension='channel'
    group by line.channel
    union all
    select 'fulfillment.orders',case line.fulfillment_state
      when 'unallocated' then '待分配' when 'allocated' then '待处理' when 'processing' then '履约中'
      when 'shipped' then '已发货' when 'delivered' then '已完成' when 'cancelled' then '已取消'
      when 'returned' then '已退回' else line.fulfillment_state end,
      count(distinct line.order_id)::double precision,'count',
      jsonb_build_object('supplier',p_supplier,'supplierName',(select name from supplier),'state',line.fulfillment_state)
    from supplied_lines line where p_dimension='fulfillment'
    group by line.fulfillment_state
    union all
    select 'settlement.amount',case settlement.state
      when 'draft' then '待确认' when 'approved' then '已确认' when 'payable' then '待付款'
      when 'paid' then '已结算' when 'cancelled' then '已取消' else settlement.state end,
      coalesce(sum(settlement.amount_minor),0)::double precision,'minor',
      jsonb_build_object('supplier',p_supplier,'supplierName',(select name from supplier),'state',settlement.state)
    from finance.settlement settlement cross join bounds
    where p_dimension='settlement' and settlement.scope_id=p_scope and settlement.partner_id=p_supplier
      and coalesce(settlement.paid_at,settlement.approved_at,settlement.frozen_at,bounds.to_at)>=bounds.from_at
    group by settlement.state
  )
  select rows.code,1,p_supplier,
    jsonb_build_object('from',bounds.from_at,'to',bounds.to_at,'timezone','Asia/Shanghai'),
    rows.extra||jsonb_build_object('label',rows.label),rows.value,rows.unit,
    coalesce((select max(updated_at) from supplied_lines),bounds.to_at),1,bounds.to_at,
    rows.code||':'||md5((rows.extra||jsonb_build_object('label',rows.label))::text)
  from rows cross join bounds
  where exists(select 1 from supplier)
  order by rows.value desc,rows.label
$function$;

create or replace function reporting.cockpit(p_scope text,p_supplier text,p_period text)
returns jsonb
language sql stable security definer
set search_path=pg_catalog,reporting,organization,partner,catalog,pricing,inventory,ordering,finance
set row_security=off
as $function$
  with bounds as (
    select case p_period
      when 'yesterday' then date_trunc('day',clock_timestamp())-interval '1 day'
      when '7days' then date_trunc('day',clock_timestamp())-interval '6 days'
      when '30days' then date_trunc('day',clock_timestamp())-interval '29 days'
      else date_trunc('day',clock_timestamp()) end from_at,
      case when p_period='yesterday' then date_trunc('day',clock_timestamp()) else clock_timestamp() end to_at,
      case p_period
      when 'yesterday' then date_trunc('day',clock_timestamp())-interval '2 days'
      when '7days' then date_trunc('day',clock_timestamp())-interval '13 days'
      when '30days' then date_trunc('day',clock_timestamp())-interval '59 days'
      else date_trunc('day',clock_timestamp())-interval '1 day' end previous_from_at
  ), supplier as (
    select value.id,value.name,coalesce(max(product.attributes->>'supplyChannel'),'供应商直供') channel
    from partner.partner value
    left join catalog.product product on product.owner_partner_id=value.id
    where value.id=p_supplier and value.scope_id=p_scope and value.kind='supplier' and value.status='active'
    group by value.id,value.name
  ), supplied_products as (
    select product.id,product.title,product.category_id
    from catalog.product product join supplier on supplier.id=product.owner_partner_id
  ), supplied_listings as (
    select distinct listing.id,listing.sku_id,product.id product_id,product.category_id
    from supplied_products product join catalog.sku sku on sku.product_id=product.id
    join catalog.listing listing on listing.sku_id=sku.id and listing.scope_id=p_scope
    where listing.status='published' and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
      and (listing.expires_at is null or listing.expires_at>clock_timestamp())
  ), supplied_stock as (
    select coalesce(sum(greatest(stock.onhand-stock.safety-coalesce(reserved.quantity,0),0)),0)::double precision available
    from supplied_products product join catalog.sku sku on sku.product_id=product.id
    join inventory.stockitem stock on stock.sku_id=sku.id and stock.scope_id=p_scope and stock.status='active'
    left join lateral(select coalesce(sum(reservation.quantity),0)::bigint quantity
      from inventory.reservation reservation where reservation.stockitem_id=stock.id and reservation.mall_id=p_scope
        and reservation.state='active' and reservation.expires_at>clock_timestamp()) reserved on true
  ), supplied_lines as (
    select orders.id order_id,orders.created_at,orders.updated_at,orders.fulfillment_state,
      line.id line_id,line.total_minor,coalesce(line.product_id,product.id) product_id,
      coalesce(product.title,line.title_snapshot) product_name,coalesce(category.name,'未分类') category_name
    from ordering.orderrecord orders join ordering.line line on line.order_id=orders.id
    left join catalog.sku sku on sku.id=line.sku_id
    left join catalog.product product on product.id=coalesce(line.product_id,sku.product_id)
    left join catalog.category category on category.id=product.category_id
    join supplier on supplier.id=coalesce(line.supplier_id,product.owner_partner_id)
    where orders.mall_id=p_scope and orders.payment_state in('paid','partially_refunded','refunded')
  ), completed_refunds as (
    select coalesce(sum(coalesce(aftersale.amount_minor,0)),0)::double precision amount,
      count(distinct aftersale.order_id)::double precision orders
    from ordering.aftersale aftersale join supplied_lines line on line.line_id=aftersale.line_id
    where aftersale.state='completed'
  ), current_totals as (
    select coalesce(sum(line.total_minor),0)::double precision sales,count(distinct line.order_id)::double precision orders
    from supplied_lines line cross join bounds where line.created_at>=bounds.from_at and line.created_at<bounds.to_at
  ), previous_totals as (
    select coalesce(sum(line.total_minor),0)::double precision sales,count(distinct line.order_id)::double precision orders
    from supplied_lines line cross join bounds where line.created_at>=bounds.previous_from_at and line.created_at<bounds.from_at
  ), all_totals as (
    select coalesce(sum(line.total_minor),0)::double precision sales,count(distinct line.order_id)::double precision orders
    from supplied_lines line
  ), pending as (
    select count(distinct order_id)::integer count from supplied_lines
    where fulfillment_state in('unallocated','allocated','processing')
  ), aftersales as (
    select count(distinct aftersale.id)::integer count from ordering.aftersale aftersale
    join supplied_lines line on line.line_id=aftersale.line_id
    where aftersale.state not in('completed','cancelled','rejected')
  ), settlements as (
    select coalesce(sum(amount_minor) filter(where state in('draft','approved','payable')),0)::double precision payable,
      coalesce(sum(amount_minor) filter(where state='paid'),0)::double precision paid
    from finance.settlement where scope_id=p_scope and partner_id=p_supplier
  ), trend as (
    select coalesce(jsonb_agg(jsonb_build_object('date',day::date,'salesCents',coalesce(metric.sales,0),
      'orderCount',coalesce(metric.orders,0)) order by day),'[]'::jsonb) value
    from generate_series(date_trunc('day',clock_timestamp())-interval '6 days',date_trunc('day',clock_timestamp()),interval '1 day') day
    left join lateral(select sum(total_minor)::double precision sales,count(distinct order_id)::double precision orders
      from supplied_lines where created_at>=day and created_at<day+interval '1 day') metric on true
  ), categories as (
    select coalesce(jsonb_agg(jsonb_build_object('name',category_name,'salesCents',sales,
      'share',case when total>0 then sales/total else 0 end) order by sales desc),'[]'::jsonb) value
    from (select ranked.*,sum(sales) over() total from (
      select category_name,sum(total_minor)::double precision sales from supplied_lines cross join bounds
      where created_at>=bounds.from_at and created_at<bounds.to_at group by category_name order by sales desc limit 5
    ) ranked) shared
  ), mall as (
    select id,name from organization.organization where id=p_scope
  )
  select case when not exists(select 1 from supplier) then reporting.cockpit(p_scope) else jsonb_build_object(
    'catalogCount',(select count(*)::integer from supplied_listings),
    'availableStock',(select available from supplied_stock),
    'orderCount',(select orders::integer from all_totals),
    'afterSaleCount',(select count from aftersales),
    'perspective',jsonb_build_object('kind','supplier','id',(select id from supplier),'name',(select name from supplier),
      'channel',(select channel from supplier)),
    'operations',jsonb_build_object('pendingFulfillmentCount',(select count from pending),
      'payableSettlementCents',(select payable from settlements),'paidSettlementCents',(select paid from settlements)),
    'sales',jsonb_build_object(
      'asOf',coalesce((select max(updated_at) from supplied_lines),clock_timestamp()),
      'cumulativeSalesCents',greatest((select sales from all_totals)-(select amount from completed_refunds),0),
      'paidOrderCount',(select orders from all_totals),'averageOrderValueCents',case when (select orders from current_totals)>0
        then round((select sales from current_totals)/(select orders from current_totals)) else 0 end,
      'periodSalesCents',(select sales from current_totals),'periodPaidOrderCount',(select orders from current_totals),
      'refundedCents',(select amount from completed_refunds),'activeProductCount',(select count(*)::integer from supplied_listings),
      'soldProductCount',(select count(distinct product_id)::integer from supplied_lines),
      'unsoldActiveProductCount',greatest((select count(*)::integer from supplied_listings)-(select count(distinct product_id)::integer from supplied_lines),0),
      'trend',(select value from trend),'categories',(select value from categories),'topProducts','[]'::jsonb,
      'period',jsonb_build_object('from',(select from_at from bounds),'to',(select to_at from bounds)),
      'conclusion',case when (select count from pending)>0 then (select count from pending)||' 笔供应订单等待履约'
        when (select sales from current_totals)>0 then '当前供应经营稳定，成交与库存数据已实时归集'
        else '供应关系已就绪，等待首笔真实供应订单' end,
      'deltas',jsonb_build_object(
        'netSalesRatio',case when (select sales from previous_totals)>0 then ((select sales from current_totals)-(select sales from previous_totals))/(select sales from previous_totals) else 0 end,
        'paidOrdersRatio',case when (select orders from previous_totals)>0 then ((select orders from current_totals)-(select orders from previous_totals))/(select orders from previous_totals) else 0 end,
        'averageOrderRatio',0,'refundRate',case when (select sales from all_totals)>0 then (select amount from completed_refunds)/(select sales from all_totals) else 0 end,
        'refundRateDeltaPoints',0),
      'malls',jsonb_build_array(jsonb_build_object('id',(select id from mall),'name',(select name from mall),
        'salesCents',(select sales from current_totals),'paidOrderCount',(select orders::integer from current_totals),
        'refundRate',case when (select sales from all_totals)>0 then (select amount from completed_refunds)/(select sales from all_totals) else 0 end)),
      'events',jsonb_build_array(
        jsonb_build_object('id','fulfillment','kind',case when (select count from pending)>0 then 'warning' else 'sync' end,
          'title','待履约订单','metric',(select count from pending)||' 笔','time','实时'),
        jsonb_build_object('id','inventory','kind','sync','title','可用库存','metric',round((select available from supplied_stock))||' 件','time','实时'),
        jsonb_build_object('id','settlement','kind','calendar','title','待结算金额','metric','¥'||round(((select payable from settlements)/100)::numeric,2),'time','当前账期')),
      'insights',case when (select count from pending)>0 then jsonb_build_array(jsonb_build_object('id','pending-fulfillment','tone','warning',
        'title','有供应订单等待履约','detail',(select count from pending)||' 笔订单尚未完成发货','action','查看订单','target','orders'))
        else jsonb_build_array(jsonb_build_object('id','supply-ready','tone','positive','title','供应关系运行正常',
          'detail','商品、库存、订单与结算均按当前供应商口径归集','action','查看报表','target','reports')) end)
    )
  end
  from bounds
$function$;

revoke all on function reporting.supplier_metric_rows(text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function reporting.cockpit(text,text,text) from public,anon,authenticated,service_role;
grant execute on function reporting.supplier_metric_rows(text,text,text,text) to shopapp,shopjob,zhudatuanidentityapi,zhudatuanwebapi;
grant execute on function reporting.cockpit(text,text,text) to shopapp,shopjob,zhudatuanidentityapi,zhudatuanwebapi;

insert into runtime.schemaversion(version,checksum)
values('20260912130000','4c9bfd1d4d066e1993099bb0fb977669d5c69ca9015aaa9e6784ab8cb1fe3c00');

commit;
