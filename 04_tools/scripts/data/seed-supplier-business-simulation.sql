\set ON_ERROR_STOP on

begin;

-- Repeatable temporary business simulation for 宏泰甄选.
-- Every inserted row is namespaced with supplier-business-v1 so the companion
-- cleanup script can remove this batch without touching real business data.

delete from reporting.fact where dimensions->>'simulation'='supplier-business-v1';
delete from finance.settlement where id like 'simulation:supplier-business:v1:settlement:%';
delete from finance.reconciliation where id like 'simulation:supplier-business:v1:reconciliation:%';
delete from channel.statement where id like 'simulation:supplier-business:v1:statement:%';
delete from channel.connection where id='simulation:supplier-business:v1:connection';
delete from ordering.aftersale where id like 'simulation:supplier-business:v1:aftersale:%';
delete from ordering.line where order_id like 'simulation:supplier-business:v1:order:%';
delete from ordering.orderrecord where id like 'simulation:supplier-business:v1:order:%';

create temporary table simulation_orders on commit drop as
with product_pool as (
  select product.owner_partner_id supplier_id,product.id product_id,product.title,product.category_id,
    coalesce(category.name,'未分类') category_name,coalesce(product.attributes->>'supplyChannel','供应商直供') supply_channel,
    sku.id sku_id,listing.id listing_id,
    row_number() over(partition by product.owner_partner_id order by product.id,sku.id,listing.id) product_rank,
    count(*) over(partition by product.owner_partner_id) pool_count
  from catalog.product product
  join catalog.sku sku on sku.product_id=product.id
  join catalog.listing listing on listing.sku_id=sku.id and listing.scope_id='mall:d1708f04df2dd8a61736852c4900fb43'
  left join catalog.category category on category.id=product.category_id
  where product.owner_partner_id in('partner:supplier:zhudatuan','partner:supplier:cakeuncle')
    and listing.status='published'
), generated as (
  select sequence,
    case when sequence%5 in(0,1,2) then 'partner:supplier:zhudatuan' else 'partner:supplier:cakeuncle' end supplier_id,
    least(((date_trunc('day',clock_timestamp() at time zone 'Asia/Shanghai')
      - ((sequence-1)%30)*interval '1 day'
      + (8+(sequence%12))*interval '1 hour'
      + (sequence%60)*interval '1 minute') at time zone 'Asia/Shanghai'),clock_timestamp()-interval '1 minute') created_at
  from generate_series(1,1000) sequence
), selected as (
  select generated.*,pool.product_id,pool.title,pool.category_id,pool.category_name,pool.supply_channel,
    pool.sku_id,pool.listing_id,pool.product_rank,
    case when generated.supplier_id='partner:supplier:zhudatuan' and pool.product_rank<=10
      then 100+(pool.product_rank-1)*10
      when generated.supplier_id='partner:supplier:zhudatuan' then 690+(generated.sequence*137)%8000
      else 5900+(generated.sequence*389)%34000 end::bigint unit_minor,
    case when generated.supplier_id='partner:supplier:cakeuncle' then 1 else 1+(generated.sequence%3) end::bigint quantity
  from generated
  join product_pool pool on pool.supplier_id=generated.supplier_id
    and pool.product_rank=1+((generated.sequence-1)%pool.pool_count)
)
select selected.*,
  unit_minor*quantity total_minor,
  case when sequence%100<92 then 'paid' when sequence%100<96 then 'partially_refunded' else 'refunded' end payment_state,
  case when sequence%100<5 then 'unallocated' when sequence%100<10 then 'allocated'
    when sequence%100<18 then 'processing' when sequence%100<35 then 'shipped'
    when sequence%100<90 then 'delivered' when sequence%100<96 then 'returned' else 'cancelled' end fulfillment_state,
  case when sequence%10<>0 then 'none' when sequence%40=0 then 'requested'
    when sequence%20=0 then 'processing' else 'resolved' end aftersale_state
from selected;

insert into ordering.orderrecord(
  id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,payment_state,
  fulfillment_state,aftersale_state,lifecycle_state,evidence,created_at,updated_at,version,
  address_snapshot,invoice_snapshot,delivery_snapshot,experience_version,transaction_id,correlation_id,
  operating_node_id,participant_node_id,participant_membership_id,participant_realm_id,participant_account_id,participant_snapshot
)
select 'simulation:supplier-business:v1:order:'||lpad(sequence::text,4,'0'),
  'SIM-SUP-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||lpad(sequence::text,4,'0'),
  'mall:d1708f04df2dd8a61736852c4900fb43','member:simulation:'||lpad(((sequence-1)%240+1)::text,3,'0'),
  'mall:d1708f04df2dd8a61736852c4900fb43','simulation:supplier-business:v1:checkout:'||lpad(sequence::text,4,'0'),
  'CNY',total_minor,payment_state,fulfillment_state,aftersale_state,
  case when fulfillment_state='delivered' then 'completed' when fulfillment_state='cancelled' then 'cancelled' else 'active' end,
  jsonb_build_object('simulation','supplier-business-v1','temporary',true,'scene','supplier-finance-sales'),
  created_at,created_at+interval '6 hours',1,'null'::jsonb,'null'::jsonb,
  jsonb_build_object('mode',case when supplier_id='partner:supplier:cakeuncle' then '同城配送' else '供应商发货' end),
  'supplier-business-v1','simulation:transaction:'||lpad(sequence::text,4,'0'),
  'simulation:correlation:'||lpad(sequence::text,4,'0'),'node:mall:d1708f04df2dd8a61736852c4900fb43',
  supplier_id,'membership:simulation:supplier','realm:supplier','account:simulation:supplier',
  jsonb_build_object('supplier',supplier_id,'simulation','supplier-business-v1')
from simulation_orders;

insert into ordering.line(
  id,order_id,sku_id,listing_id,title_snapshot,quantity,unit_minor,total_minor,provider,partner_id,
  discount_minor,evidence,product_id,route_id,route_version,operating_node_id,participant_node_id,
  participant_membership_id,supplier_id,supplier_relationship_id,contract_id,contract_hash,
  fulfillment_party_id,settlement_party_id,invoice_party_id,route_snapshot
)
select 'simulation:supplier-business:v1:line:'||lpad(sequence::text,4,'0'),
  'simulation:supplier-business:v1:order:'||lpad(sequence::text,4,'0'),sku_id,listing_id,title,quantity,unit_minor,total_minor,
  supply_channel,supplier_id,0,jsonb_build_object('simulation','supplier-business-v1','temporary',true),product_id,
  'route:simulation:'||supplier_id,1,'node:mall:d1708f04df2dd8a61736852c4900fb43',supplier_id,
  'membership:simulation:supplier',supplier_id,'relationship:simulation:'||supplier_id,
  'contract:simulation:'||supplier_id,md5('contract:simulation:'||supplier_id),supplier_id,supplier_id,supplier_id,
  jsonb_build_object('simulation','supplier-business-v1','supplier',supplier_id,'channel',supply_channel)
from simulation_orders;

insert into ordering.aftersale(
  id,order_id,line_id,kind,state,quantity,amount_minor,reason,requested_by,requested_membership_id,
  created_at,updated_at,version,route_snapshot
)
select 'simulation:supplier-business:v1:aftersale:'||lpad(sequence::text,4,'0'),
  'simulation:supplier-business:v1:order:'||lpad(sequence::text,4,'0'),
  'simulation:supplier-business:v1:line:'||lpad(sequence::text,4,'0'),
  case when sequence%30=0 then 'return' else 'refund' end,
  case when sequence%40=0 then 'requested' when sequence%20=0 then 'processing' else 'completed' end,
  1,case when sequence%20=0 then least(unit_minor,total_minor) else total_minor end,
  case when sequence%30=0 then '模拟：商品退回' else '模拟：售后退款' end,
  'actor:simulation:buyer','membership:simulation:buyer',least(created_at+interval '2 days',clock_timestamp()),
  least(created_at+interval '3 days',clock_timestamp()),1,
  jsonb_build_object('simulation','supplier-business-v1','supplier',supplier_id)
from simulation_orders where sequence%10=0;

insert into channel.connection(
  id,provider,scope_id,status,contract_version,configuration,connection_timeout_ms,response_timeout_ms,total_deadline_ms,
  max_concurrency,requests_per_second,max_attempts,failure_threshold,recovery_ms,region,version
)
values('simulation:supplier-business:v1:connection','supplier-business-sim','mall:d1708f04df2dd8a61736852c4900fb43',
  'enabled','simulation-v1','{"simulation":"supplier-business-v1","temporary":true}'::jsonb,
  3000,10000,30000,8,50,2,5,30000,'cn-north-2',1);

create temporary table simulation_settlements on commit drop as
with periods as (
  select sequence,
    case when sequence%2=1 then 'partner:supplier:zhudatuan' else 'partner:supplier:cakeuncle' end supplier_id,
    (clock_timestamp() at time zone 'Asia/Shanghai')::date-sequence*3 period_start,
    (clock_timestamp() at time zone 'Asia/Shanghai')::date-sequence*3+2 period_end
  from generate_series(1,8) sequence
), supplier_totals as (
  select supplier_id,sum(total_minor)::bigint total_minor from simulation_orders group by supplier_id
)
select periods.*,period_start::text||'/'||period_end::text period,
  greatest((supplier_totals.total_minor/4),1000)::bigint gross_minor,
  case when sequence%4 in(1,2) then 'paid' when sequence%4=3 then 'payable' else 'approved' end state
from periods join supplier_totals using(supplier_id);

insert into channel.statement(
  id,connection_id,provider,scope_id,partner_id,period_start,period_end,timezone,object_ref,sha256,generated_at
)
select 'simulation:supplier-business:v1:statement:'||sequence,
  'simulation:supplier-business:v1:connection','supplier-business-sim','mall:d1708f04df2dd8a61736852c4900fb43',
  supplier_id,period_start,period_end,'Asia/Shanghai','simulation://supplier-business-v1/statement/'||sequence,
  md5('simulation-statement-'||sequence)||md5('simulation-statement-sha-'||sequence),clock_timestamp()
from simulation_settlements;

insert into finance.reconciliation(
  id,scope_id,provider,partner_id,period,statement_ref,statement_hash,state,debit_minor,credit_minor,difference_minor,
  created_by,approved_by,evidence,updated_at,version
)
select 'simulation:supplier-business:v1:reconciliation:'||sequence,'mall:d1708f04df2dd8a61736852c4900fb43',
  'supplier-business-sim',supplier_id,period,'simulation:supplier-business:v1:statement:'||sequence,
  md5('simulation-statement-'||sequence)||md5('simulation-statement-sha-'||sequence),'approved',
  gross_minor,gross_minor,0,'actor:simulation:finance-requester','actor:simulation:finance-approver',
  jsonb_build_object('simulation','supplier-business-v1','temporary',true),clock_timestamp(),1
from simulation_settlements;

insert into finance.settlement(
  id,partner_id,period,reconciliation_id,amount_minor,currency,state,scope_id,requested_by,approved_by,
  frozen_at,approved_at,paid_at,evidence,version,gross_minor,fee_minor,invoice_basis
)
select 'simulation:supplier-business:v1:settlement:'||sequence,supplier_id,period,
  'simulation:supplier-business:v1:reconciliation:'||sequence,
  gross_minor-floor(gross_minor*0.05)::bigint,'CNY',state,'mall:d1708f04df2dd8a61736852c4900fb43',
  'actor:simulation:finance-requester','actor:simulation:finance-approver',clock_timestamp()-interval '2 days',
  clock_timestamp()-interval '1 day',case when state='paid' then clock_timestamp() else null end,
  jsonb_build_object('simulation','supplier-business-v1','temporary',true,'feeRate',0.05),1,
  gross_minor,floor(gross_minor*0.05)::bigint,'net'
from simulation_settlements;

with paid_lines as (
  select date_trunc('day',orders.created_at at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai' period_start,
    orders.created_at,orders.updated_at,orders.id order_id,orders.total_minor,orders.payment_state,
    line.id line_id,line.product_id,line.supplier_id,line.provider,product.title,
    coalesce(category.id,'category:uncategorized') category_id,coalesce(category.name,'未分类') category_name,
    partner.name supplier_name
  from ordering.orderrecord orders
  join ordering.line line on line.order_id=orders.id
  join partner.partner partner on partner.id=line.supplier_id
  left join catalog.product product on product.id=line.product_id
  left join catalog.category category on category.id=product.category_id
  where orders.id like 'simulation:supplier-business:v1:order:%'
    and orders.payment_state in('paid','partially_refunded','refunded')
), facts as (
  select 'sales.amount' metric_id,period_start,
    jsonb_build_object('simulation','supplier-business-v1','application','mall-console','supplier',supplier_id,
      'supplierName',supplier_name,'label',supplier_name) dimensions,sum(total_minor)::numeric value_numeric,'CNY'::char(3) currency
  from paid_lines group by period_start,supplier_id,supplier_name
  union all
  select 'sales.orders',period_start,
    jsonb_build_object('simulation','supplier-business-v1','application','mall-console','supplier',supplier_id,
      'supplierName',supplier_name,'label',supplier_name),count(distinct order_id)::numeric,null::char(3)
  from paid_lines group by period_start,supplier_id,supplier_name
  union all
  select 'mall.amount',period_start,
    jsonb_build_object('simulation','supplier-business-v1','application','mall-console','mall','mall:d1708f04df2dd8a61736852c4900fb43',
      'mallName','宏泰甄选','label','宏泰甄选'),sum(total_minor)::numeric,'CNY'::char(3)
  from paid_lines group by period_start
  union all
  select 'product.amount',period_start,
    jsonb_build_object('simulation','supplier-business-v1','application','mall-console','supplier',supplier_id,
      'supplierName',supplier_name,'product',product_id,'productName',title,'label',title),sum(total_minor)::numeric,'CNY'::char(3)
  from paid_lines group by period_start,supplier_id,supplier_name,product_id,title
  union all
  select 'category.amount',period_start,
    jsonb_build_object('simulation','supplier-business-v1','application','mall-console','supplier',supplier_id,
      'supplierName',supplier_name,'category',category_id,'categoryName',category_name,'label',category_name),sum(total_minor)::numeric,'CNY'::char(3)
  from paid_lines group by period_start,supplier_id,supplier_name,category_id,category_name
  union all
  select 'channel.amount',period_start,
    jsonb_build_object('simulation','supplier-business-v1','application','mall-console','supplier',supplier_id,
      'supplierName',supplier_name,'channel',provider,'label',provider),sum(total_minor)::numeric,'CNY'::char(3)
  from paid_lines group by period_start,supplier_id,supplier_name,provider
  union all
  select 'refund.amount',date_trunc('day',aftersale.created_at at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai',
    jsonb_build_object('simulation','supplier-business-v1','application','mall-console','supplier',paid_lines.supplier_id,
      'supplierName',paid_lines.supplier_name,'label',paid_lines.supplier_name),sum(aftersale.amount_minor)::numeric,'CNY'::char(3)
  from ordering.aftersale aftersale join paid_lines on paid_lines.line_id=aftersale.line_id
  where aftersale.state='completed' group by 2,paid_lines.supplier_id,paid_lines.supplier_name
  union all
  select 'refund.orders',date_trunc('day',aftersale.created_at at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai',
    jsonb_build_object('simulation','supplier-business-v1','application','mall-console','supplier',paid_lines.supplier_id,
      'supplierName',paid_lines.supplier_name,'label',paid_lines.supplier_name),count(distinct aftersale.order_id)::numeric,null::char(3)
  from ordering.aftersale aftersale join paid_lines on paid_lines.line_id=aftersale.line_id
  where aftersale.state='completed' group by 2,paid_lines.supplier_id,paid_lines.supplier_name
)
insert into reporting.fact(
  metric_id,metric_version,scope_id,dimensions,period_start,period_end,timezone,value_numeric,currency,watermark,projection_version
)
select metric_id,1,'mall:d1708f04df2dd8a61736852c4900fb43',dimensions,period_start,period_start+interval '1 day',
  'Asia/Shanghai',value_numeric,currency,clock_timestamp(),1
from facts
on conflict(metric_id,metric_version,scope_id,period_start,dimensions) do update set
  value_numeric=excluded.value_numeric,currency=excluded.currency,watermark=excluded.watermark,
  projection_version=reporting.fact.projection_version+1;

do $assert$
declare order_count integer; main_count integer; cake_count integer; cheap_products integer;
begin
  select count(*),count(*) filter(where line.supplier_id='partner:supplier:zhudatuan'),
    count(*) filter(where line.supplier_id='partner:supplier:cakeuncle'),
    count(distinct line.product_id) filter(where line.supplier_id='partner:supplier:zhudatuan' and line.unit_minor between 100 and 200)
  into order_count,main_count,cake_count,cheap_products
  from ordering.orderrecord orders join ordering.line line on line.order_id=orders.id
  where orders.id like 'simulation:supplier-business:v1:order:%';
  if order_count<>1000 or main_count<>600 or cake_count<>400 then
    raise exception 'SUPPLIER_BUSINESS_SIMULATION_COUNT_INVALID';
  end if;
  if cheap_products<>10 then raise exception 'SUPPLIER_BUSINESS_SIMULATION_CHEAP_PRODUCT_COUNT_INVALID'; end if;
end
$assert$;

commit;

select count(*) simulation_orders,
  count(*) filter(where line.supplier_id='partner:supplier:zhudatuan') main_supplier_orders,
  count(*) filter(where line.supplier_id='partner:supplier:cakeuncle') cake_supplier_orders
from ordering.orderrecord orders join ordering.line line on line.order_id=orders.id
where orders.id like 'simulation:supplier-business:v1:order:%';
