begin;

insert into partner.partner(id,scope_id,kind,name,status,version,created_at,updated_at) values
  ('partner:test:supplier:a','mall:d1708f04df2dd8a61736852c4900fb43','supplier','四流测试供应商A','active',0,clock_timestamp(),clock_timestamp()),
  ('partner:test:supplier:b','mall:d1708f04df2dd8a61736852c4900fb43','supplier','四流测试供应商B','active',0,clock_timestamp(),clock_timestamp()),
  ('partner:test:supplier:c','mall:d1708f04df2dd8a61736852c4900fb43','supplier','四流测试供应商C','active',0,clock_timestamp(),clock_timestamp())
on conflict(id) do nothing;

insert into partner.supplierrelationship(id,relationship_id,relationship_version,supplier_id,purchasing_node_id,realm_id,line_id,mall_id,
  product_scope,status,effective_at,created_at) values
  ('relationship-version:test:a:1','relationship:test:a',1,'partner:test:supplier:a','node:hbbtzn:l1','realm:l1','line:test:trade',
    'mall:d1708f04df2dd8a61736852c4900fb43','{"skus":["sku:zdt:supplier:trial:001"]}','active','2026-09-01T00:00:00Z',clock_timestamp()),
  ('relationship-version:test:b:1','relationship:test:b:line-one',1,'partner:test:supplier:b','node:hbbtzn:l1','realm:l1','line:test:trade',
    'mall:d1708f04df2dd8a61736852c4900fb43','{"skus":["sku:zdt:supplier:trial:002","sku:zdt:supplier:trial:003"]}','active','2026-09-01T00:00:00Z',clock_timestamp()),
  ('relationship-version:test:b:other-line:1','relationship:test:b:line-two',1,'partner:test:supplier:b','node:other:l1','realm:other',
    'line:test:other','mall:d1708f04df2dd8a61736852c4900fb43','{"skus":[]}','active','2026-09-01T00:00:00Z',clock_timestamp());

insert into partner.suppliercontract(id,contract_id,contract_version,supplier_relationship_id,supply_terms,fulfillment_party_id,
  settlement_party_id,invoice_party_id,status,effective_at,created_at) values
  ('contract-version:test:a:1','contract:test:a',1,'relationship-version:test:a:1','{"supply":"direct"}',
    'partner:test:supplier:a','partner:test:supplier:a','partner:test:supplier:a','active','2026-09-01T00:00:00Z',clock_timestamp()),
  ('contract-version:test:b:warehouse:1','contract:test:b:warehouse',1,'relationship-version:test:b:1','{"supply":"warehouse"}',
    'partner:test:supplier:b','partner:test:supplier:b','partner:test:supplier:b','active','2026-09-01T00:00:00Z',clock_timestamp()),
  ('contract-version:test:b:dropship:1','contract:test:b:dropship',1,'relationship-version:test:b:1','{"supply":"dropship"}',
    'party:test:fulfillment:b2','partner:test:supplier:b','party:test:invoice:b2','active','2026-09-01T00:00:00Z',clock_timestamp());

insert into partner.supplyroute(route_id,route_version,supplier_relationship_id,contract_id,line_id,mall_id,status,effective_at) values
  ('route:test:a',1,'relationship-version:test:a:1','contract-version:test:a:1','line:test:trade','mall:d1708f04df2dd8a61736852c4900fb43','active','2026-09-01T00:00:00Z'),
  ('route:test:b:warehouse',1,'relationship-version:test:b:1','contract-version:test:b:warehouse:1','line:test:trade','mall:d1708f04df2dd8a61736852c4900fb43','active','2026-09-01T00:00:00Z'),
  ('route:test:b:dropship',1,'relationship-version:test:b:1','contract-version:test:b:dropship:1','line:test:trade','mall:d1708f04df2dd8a61736852c4900fb43','active','2026-09-01T00:00:00Z');

insert into partner.supplyroutestep(route_id,route_version,sequence_no,line_id,signed_level,node_id,party_id,party_kind,edge_kind,effective_at)
select route.route_id,1,step.sequence_no,'line:test:trade',step.signed_level,step.node_id,
  case when step.party_kind='supplier' and route.route_id='route:test:a' then 'partner:test:supplier:a' else step.party_id end,
  step.party_kind,step.edge_kind,'2026-09-01T00:00:00Z'
from (values('route:test:a'),('route:test:b:warehouse'),('route:test:b:dropship')) route(route_id)
cross join (values
  (1,'L0','node:zhudatuan:l0','party:test:l0','operating_owner','operates'),
  (2,'L1','node:hbbtzn:l1','party:test:l1','operating_owner','purchases'),
  (3,'L-2',null,'partner:test:supplier:b','supplier','supplier_contract'),
  (4,'L2','node:test:l2','party:test:l2','participant','participates'),
  (5,'L6','node:test:l6','party:test:l6','participant','participates'),
  (6,'L7','node:test:l7','party:test:l7','participant','participates')
) step(sequence_no,signed_level,node_id,party_id,party_kind,edge_kind);

insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at) values
  ('stock:zdt:supplier:trial:001','mall:d1708f04df2dd8a61736852c4900fb43','sku:zdt:supplier:trial:001','location:test:a',100,0,0,'active',clock_timestamp()),
  ('stock:zdt:supplier:trial:002','mall:d1708f04df2dd8a61736852c4900fb43','sku:zdt:supplier:trial:002','location:test:b1',100,0,0,'active',clock_timestamp()),
  ('stock:zdt:supplier:trial:003','mall:d1708f04df2dd8a61736852c4900fb43','sku:zdt:supplier:trial:003','location:test:b2',100,0,0,'active',clock_timestamp())
on conflict(id) do nothing;

insert into catalog.supplyoffer(id,mall_id,sku_id,supplier_id,supplier_relationship_id,contract_id,route_id,route_version,
  stockitem_id,unit_cost_minor,status,effective_at) values
  ('offer:test:a','mall:d1708f04df2dd8a61736852c4900fb43','sku:zdt:supplier:trial:001','partner:test:supplier:a',
    'relationship-version:test:a:1','contract-version:test:a:1','route:test:a',1,'stock:zdt:supplier:trial:001',600,'active','2026-09-01T00:00:00Z'),
  ('offer:test:b:warehouse','mall:d1708f04df2dd8a61736852c4900fb43','sku:zdt:supplier:trial:002','partner:test:supplier:b',
    'relationship-version:test:b:1','contract-version:test:b:warehouse:1','route:test:b:warehouse',1,'stock:zdt:supplier:trial:002',350,'active','2026-09-01T00:00:00Z'),
  ('offer:test:b:dropship','mall:d1708f04df2dd8a61736852c4900fb43','sku:zdt:supplier:trial:003','partner:test:supplier:b',
    'relationship-version:test:b:1','contract-version:test:b:dropship:1','route:test:b:dropship',1,'stock:zdt:supplier:trial:003',500,'active','2026-09-01T00:00:00Z');

insert into ordering.orderrecord(id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,payment_state,
  fulfillment_state,aftersale_state,lifecycle_state,evidence,address_snapshot,invoice_snapshot,delivery_snapshot,experience_version,
  transaction_id,correlation_id,operating_node_id,operating_line_id,participant_node_id,participant_membership_id,
  participant_realm_id,participant_account_id,participant_snapshot,created_at,updated_at,version) values
  ('order:test:four-flow','SFL-FOUR-FLOW-1','mall:d1708f04df2dd8a61736852c4900fb43','member:test:same-mobile',
    'mall:d1708f04df2dd8a61736852c4900fb43','checkout:test:four-flow','CNY',2800,'paid','allocated','none','active','{}','null','null','{}','test-v1',
    'transaction:test:four-flow','correlation:test:four-flow','node:hbbtzn:l1','line:test:trade','node:test:l7','membership:test:realm-a',
    'realm:test:a','account:test:a','{"mobile":"same"}',clock_timestamp(),clock_timestamp(),0),
  ('order:test:realm-b','SFL-FOUR-FLOW-REALM-B','mall:d1708f04df2dd8a61736852c4900fb43','member:test:same-mobile',
    'mall:d1708f04df2dd8a61736852c4900fb43','checkout:test:realm-b','CNY',0,'unpaid','unallocated','none','created','{}','null','null','{}','test-v1',
    'transaction:test:realm-b','correlation:test:realm-b','node:test:realm-b','line:test:other','node:test:realm-b','membership:test:realm-b',
    'realm:test:b','account:test:b','{"mobile":"same"}',clock_timestamp(),clock_timestamp(),0);

insert into ordering.line(id,order_id,sku_id,listing_id,product_id,title_snapshot,quantity,unit_minor,total_minor,discount_minor,
  provider,partner_id,evidence,route_id,route_version,operating_node_id,operating_line_id,participant_node_id,participant_membership_id,
  supplier_id,supplier_relationship_id,supplier_relationship_version,contract_id,contract_version,fulfillment_party_id,
  settlement_party_id,invoice_party_id,route_snapshot,stockitem_id,cost_minor,shipping_minor,tax_minor) values
  ('line:test:a','order:test:four-flow','sku:zdt:supplier:trial:001','listing:test:a','product:test:a','A商品',1,1000,1000,100,
    'fixture','partner:test:supplier:a','{}','route:test:a',1,'node:hbbtzn:l1','line:test:trade','node:test:l7','membership:test:realm-a',
    'partner:test:supplier:a','relationship:test:a',1,'contract:test:a',1,'partner:test:supplier:a','partner:test:supplier:a',
    'partner:test:supplier:a','{"frozen":true}','stock:zdt:supplier:trial:001',600,0,0),
  ('line:test:b:warehouse','order:test:four-flow','sku:zdt:supplier:trial:002','listing:test:b1','product:test:b1','B仓配商品',2,600,1200,100,
    'fixture','partner:test:supplier:b','{}','route:test:b:warehouse',1,'node:hbbtzn:l1','line:test:trade','node:test:l7','membership:test:realm-a',
    'partner:test:supplier:b','relationship:test:b:line-one',1,'contract:test:b:warehouse',1,'partner:test:supplier:b','partner:test:supplier:b',
    'partner:test:supplier:b','{"frozen":true}','stock:zdt:supplier:trial:002',700,0,0),
  ('line:test:b:dropship','order:test:four-flow','sku:zdt:supplier:trial:003','listing:test:b2','product:test:b2','B直发商品',1,800,800,0,
    'fixture','partner:test:supplier:b','{}','route:test:b:dropship',1,'node:hbbtzn:l1','line:test:trade','node:test:l7','membership:test:realm-a',
    'partner:test:supplier:b','relationship:test:b:line-one',1,'contract:test:b:dropship',1,'party:test:fulfillment:b2','partner:test:supplier:b',
    'party:test:invoice:b2','{"frozen":true}','stock:zdt:supplier:trial:003',500,0,0);

insert into ordering.suborder(id,order_id,partner_id,provider,state,version,route_id,route_version,supplier_id,supplier_relationship_id,
  contract_id,fulfillment_party_id,settlement_party_id,invoice_party_id,amount_minor,transaction_id,correlation_id,realm_id,line_id,
  operating_node_id,merchandise_minor,discount_minor,shipping_minor,tax_minor,cost_minor,currency) values
  ('leg:test:a','order:test:four-flow','partner:test:supplier:a','fixture','pending',0,'route:test:a',1,'partner:test:supplier:a',
    'relationship:test:a','contract:test:a','partner:test:supplier:a','partner:test:supplier:a','partner:test:supplier:a',900,
    'transaction:test:four-flow','correlation:test:four-flow','realm:test:a','line:test:trade','node:hbbtzn:l1',1000,100,0,0,600,'CNY'),
  ('leg:test:b:warehouse','order:test:four-flow','partner:test:supplier:b','fixture','pending',0,'route:test:b:warehouse',1,'partner:test:supplier:b',
    'relationship:test:b:line-one','contract:test:b:warehouse','partner:test:supplier:b','partner:test:supplier:b','partner:test:supplier:b',1100,
    'transaction:test:four-flow','correlation:test:four-flow','realm:test:a','line:test:trade','node:hbbtzn:l1',1200,100,0,0,700,'CNY'),
  ('leg:test:b:dropship','order:test:four-flow','partner:test:supplier:b','fixture','pending',0,'route:test:b:dropship',1,'partner:test:supplier:b',
    'relationship:test:b:line-one','contract:test:b:dropship','party:test:fulfillment:b2','partner:test:supplier:b','party:test:invoice:b2',800,
    'transaction:test:four-flow','correlation:test:four-flow','realm:test:a','line:test:trade','node:hbbtzn:l1',800,0,0,0,500,'CNY');

update ordering.line set supplier_leg_id=case id when 'line:test:a' then 'leg:test:a'
  when 'line:test:b:warehouse' then 'leg:test:b:warehouse' else 'leg:test:b:dropship' end where order_id='order:test:four-flow';

insert into ordering.lineroutestep(order_line_id,route_id,route_version,sequence_no,line_id,signed_level,node_id,party_id,party_kind,mall_id,
  supplier_id,supplier_relationship_id,supplier_relationship_version,contract_id,contract_version,edge_kind,fulfillment_party_id,
  settlement_party_id,invoice_party_id,effective_at)
select line.id,line.route_id,line.route_version,step.sequence_no,step.line_id,step.signed_level,step.node_id,step.party_id,step.party_kind,
  orders.mall_id,line.supplier_id,line.supplier_relationship_id,line.supplier_relationship_version,line.contract_id,line.contract_version,
  step.edge_kind,line.fulfillment_party_id,line.settlement_party_id,line.invoice_party_id,step.effective_at
from ordering.line line join ordering.orderrecord orders on orders.id=line.order_id
join partner.supplyroutestep step on step.route_id=line.route_id and step.route_version=line.route_version
where line.order_id='order:test:four-flow';

insert into inventory.reservation(id,mall_id,stockitem_id,owner_type,owner_id,quantity,state,expires_at,created_at,version) values
  ('reservation:test:a','mall:d1708f04df2dd8a61736852c4900fb43','stock:zdt:supplier:trial:001','order','order:test:four-flow',1,'committed',clock_timestamp()+interval '1 day',clock_timestamp(),0),
  ('reservation:test:b1','mall:d1708f04df2dd8a61736852c4900fb43','stock:zdt:supplier:trial:002','order','order:test:four-flow',2,'committed',clock_timestamp()+interval '1 day',clock_timestamp(),0),
  ('reservation:test:b2','mall:d1708f04df2dd8a61736852c4900fb43','stock:zdt:supplier:trial:003','order','order:test:four-flow',1,'committed',clock_timestamp()+interval '1 day',clock_timestamp(),0);

insert into inventory.supplierreservationfact(id,reservation_id,order_id,order_line_id,supplier_leg_id,stockitem_id,transaction_id,
  correlation_id,route_id,route_version,supplier_id,quantity,state,created_at)
select 'supplier-reservation:'||line.id,reservation.id,line.order_id,line.id,line.supplier_leg_id,line.stockitem_id,'transaction:test:four-flow',
  'correlation:test:four-flow',line.route_id,line.route_version,line.supplier_id,line.quantity,'committed',clock_timestamp()
from ordering.line line join inventory.reservation reservation on reservation.owner_id=line.order_id and reservation.stockitem_id=line.stockitem_id
where line.order_id='order:test:four-flow';

insert into fulfillment.supplierresponsibility(id,order_id,supplier_leg_id,transaction_id,correlation_id,route_id,route_version,supplier_id,
  fulfillment_party_id,settlement_party_id,invoice_party_id,state,created_at)
select 'supplier-responsibility:'||id,order_id,id,transaction_id,correlation_id,route_id,route_version,supplier_id,
  fulfillment_party_id,settlement_party_id,invoice_party_id,'pending',clock_timestamp()
from ordering.suborder where order_id='order:test:four-flow';

insert into payment.intent(id,mall_id,order_id,member_id,currency,amount_minor,state,idempotency_key,provider_reference,expires_at,version)
values('intent:test:four-flow','mall:d1708f04df2dd8a61736852c4900fb43','order:test:four-flow','member:test:same-mobile','CNY',2800,
  'captured','idempotency:test:four-flow','provider:test:four-flow',clock_timestamp()+interval '1 day',0);
insert into payment.payment(id,mall_id,intent_id,amount_minor,currency,captured_minor,refunded_minor,state,version)
values('payment:test:four-flow','mall:d1708f04df2dd8a61736852c4900fb43','intent:test:four-flow',2800,'CNY',2800,0,'captured',0);
insert into payment.capture(id,scope_id,mall_id,member_id,order_id,source,currency,amount_minor,state,idempotency_key,completed_at,created_at)
values('capture:test:four-flow','mall:d1708f04df2dd8a61736852c4900fb43','mall:d1708f04df2dd8a61736852c4900fb43',
  'member:test:same-mobile','order:test:four-flow','fixture','CNY',2800,'succeeded','capture:test:four-flow',clock_timestamp(),clock_timestamp());
insert into payment.allocation(mall_id,payment_id,target_type,target_id,amount_minor,currency)
select 'mall:d1708f04df2dd8a61736852c4900fb43','payment:test:four-flow','supplier_economic_leg',id,amount_minor,'CNY'
from ordering.suborder where order_id='order:test:four-flow';
insert into payment.merchantreceipt(id,payment_id,order_id,transaction_id,correlation_id,mall_id,amount_minor,currency,provider_source,observed_at)
values('merchant-receipt:test','payment:test:four-flow','order:test:four-flow','transaction:test:four-flow','correlation:test:four-flow',
  'mall:d1708f04df2dd8a61736852c4900fb43',2800,'CNY','fixture',clock_timestamp());

insert into finance.supplierlegfact(id,order_id,supplier_leg_id,transaction_id,correlation_id,route_id,route_version,supplier_id,fact_kind,
  amount_minor,currency,created_at)
select leg.id||':'||fact.kind,leg.order_id,leg.id,leg.transaction_id,leg.correlation_id,leg.route_id,leg.route_version,leg.supplier_id,
  fact.kind,case fact.kind when 'receivable' then leg.amount_minor when 'income' then leg.amount_minor else leg.cost_minor end,'CNY',clock_timestamp()
from ordering.suborder leg cross join (values('receivable'),('payable'),('income'),('cost')) fact(kind)
where leg.order_id='order:test:four-flow';

update partner.supplierrelationship set status='superseded',superseded_at='2026-09-10T00:00:00Z'
where id='relationship-version:test:b:1';
insert into partner.supplierrelationship(id,relationship_id,relationship_version,supplier_id,purchasing_node_id,realm_id,line_id,mall_id,
  product_scope,status,effective_at,predecessor_id,created_at)
values('relationship-version:test:b:2','relationship:test:b:line-one',2,'partner:test:supplier:b','node:test:new-owner','realm:test:new',
  'line:test:trade','mall:d1708f04df2dd8a61736852c4900fb43','{"skus":[]}','active','2026-09-10T00:00:00Z',
  'relationship-version:test:b:1',clock_timestamp());
update partner.suppliercontract set status='superseded',superseded_at='2026-09-10T00:00:00Z'
where id='contract-version:test:b:warehouse:1';
insert into partner.suppliercontract(id,contract_id,contract_version,supplier_relationship_id,supply_terms,fulfillment_party_id,
  settlement_party_id,invoice_party_id,status,effective_at,predecessor_id,created_at)
values('contract-version:test:b:warehouse:2','contract:test:b:warehouse',2,'relationship-version:test:b:2','{"supply":"new"}',
  'party:test:new-fulfillment','party:test:new-settlement','party:test:new-invoice','active','2026-09-10T00:00:00Z',
  'contract-version:test:b:warehouse:1',clock_timestamp());

insert into ordering.aftersale(id,order_id,line_id,kind,state,quantity,amount_minor,reason,requested_by,requested_membership_id,
  supplier_leg_id,replay_state,route_snapshot,created_at,updated_at,version) values
  ('aftersale:test:a','order:test:four-flow','line:test:a','return','processing',1,900,'A退货','member:test','membership:test:realm-a',
    'leg:test:a','processing','{"frozen":true}',clock_timestamp(),clock_timestamp(),0),
  ('aftersale:test:b:partial','order:test:four-flow','line:test:b:warehouse','return','processing',1,550,'B部分退货','member:test','membership:test:realm-a',
    'leg:test:b:warehouse','processing','{"frozen":true}',clock_timestamp(),clock_timestamp(),0);

insert into ordering.aftersaleroutestep(aftersale_id,order_line_id,reverse_sequence_no,original_sequence_no,route_id,route_version,
  party_id,party_kind,responsibility,created_at)
select aftersale.id,line.id,row_number() over(partition by aftersale.id order by step.sequence_no desc),step.sequence_no,step.route_id,
  step.route_version,step.party_id,step.party_kind,'return_refund_restock_reversal',clock_timestamp()
from ordering.aftersale aftersale join ordering.line line on line.id=aftersale.line_id
join ordering.lineroutestep step on step.order_line_id=line.id where aftersale.id in('aftersale:test:a','aftersale:test:b:partial');

insert into payment.refund(id,mall_id,payment_id,provider,provider_reference,idempotency_key,amount_minor,currency,state,reason,aftersale_id,version) values
  ('refund:test:a','mall:d1708f04df2dd8a61736852c4900fb43','payment:test:four-flow','fixture','provider-refund:test:a','refund:test:a',900,'CNY','succeeded','A退货','aftersale:test:a',0),
  ('refund:test:b:partial','mall:d1708f04df2dd8a61736852c4900fb43','payment:test:four-flow','fixture','provider-refund:test:b','refund:test:b',550,'CNY','succeeded','B部分退货','aftersale:test:b:partial',0);
insert into payment.supplierrefundallocation(id,refund_id,aftersale_id,order_line_id,supplier_leg_id,transaction_id,correlation_id,
  route_id,route_version,supplier_id,amount_minor,currency,state,created_at) values
  ('supplier-refund-allocation:test:a','refund:test:a','aftersale:test:a','line:test:a','leg:test:a','transaction:test:four-flow',
    'correlation:test:four-flow','route:test:a',1,'partner:test:supplier:a',900,'CNY','succeeded',clock_timestamp()),
  ('supplier-refund-allocation:test:b','refund:test:b:partial','aftersale:test:b:partial','line:test:b:warehouse','leg:test:b:warehouse',
    'transaction:test:four-flow','correlation:test:four-flow','route:test:b:warehouse',1,'partner:test:supplier:b',550,'CNY','succeeded',clock_timestamp());

insert into fulfillment.supplierreturnfact(id,aftersale_id,order_line_id,supplier_leg_id,transaction_id,correlation_id,route_id,route_version,
  fulfillment_party_id,quantity,state,created_at) values
  ('supplier-return:test:a','aftersale:test:a','line:test:a','leg:test:a','transaction:test:four-flow','correlation:test:four-flow','route:test:a',1,'partner:test:supplier:a',1,'accepted',clock_timestamp()),
  ('supplier-return:test:b','aftersale:test:b:partial','line:test:b:warehouse','leg:test:b:warehouse','transaction:test:four-flow','correlation:test:four-flow','route:test:b:warehouse',1,'partner:test:supplier:b',1,'accepted',clock_timestamp())
on conflict(aftersale_id,order_line_id) do nothing;
insert into inventory.supplierrestockfact(id,aftersale_id,order_line_id,supplier_leg_id,stockitem_id,transaction_id,correlation_id,route_id,
  route_version,quantity,created_at) values
  ('supplier-restock:test:a','aftersale:test:a','line:test:a','leg:test:a','stock:zdt:supplier:trial:001','transaction:test:four-flow','correlation:test:four-flow','route:test:a',1,1,clock_timestamp()),
  ('supplier-restock:test:b','aftersale:test:b:partial','line:test:b:warehouse','leg:test:b:warehouse','stock:zdt:supplier:trial:002','transaction:test:four-flow','correlation:test:four-flow','route:test:b:warehouse',1,1,clock_timestamp())
on conflict(aftersale_id,order_line_id) do nothing;
insert into finance.supplierlegreversal(id,aftersale_id,order_line_id,supplier_leg_id,transaction_id,correlation_id,fact_kind,amount_minor,currency,created_at)
select aftersale.id||':'||fact.kind,aftersale.id,line.id,line.supplier_leg_id,'transaction:test:four-flow','correlation:test:four-flow',fact.kind,
  case when aftersale.id='aftersale:test:a' then case when fact.kind in('receivable','income') then 900 else 600 end
    else case when fact.kind in('receivable','income') then 550 else 350 end end,'CNY',clock_timestamp()
from ordering.aftersale aftersale join ordering.line line on line.id=aftersale.line_id
cross join (values('receivable'),('payable'),('income'),('cost')) fact(kind)
where aftersale.id in('aftersale:test:a','aftersale:test:b:partial')
on conflict(aftersale_id,order_line_id,fact_kind) do nothing;

do $business_results$
declare frozen jsonb;
begin
  if (select count(*) from partner.partner where id like 'partner:test:supplier:%')<>3 then raise exception 'SUPPLIER_PARTY_COUNT'; end if;
  if (select count(*) from partner.supplierrelationship where supplier_id='partner:test:supplier:b')<>3 then raise exception 'RELATIONSHIP_VERSION_COUNT'; end if;
  if (select count(*) from ordering.suborder where order_id='order:test:four-flow')<>3 then raise exception 'SUPPLIER_LEG_COUNT'; end if;
  if (select sum(merchandise_minor) from ordering.suborder where order_id='order:test:four-flow')<>3000
    or (select sum(discount_minor) from ordering.suborder where order_id='order:test:four-flow')<>200
    or (select sum(amount_minor) from ordering.suborder where order_id='order:test:four-flow')<>2800
    or (select sum(amount_minor) from payment.allocation where payment_id='payment:test:four-flow' and target_type='supplier_economic_leg')<>2800
    then raise exception 'LEG_MONEY_CONSERVATION'; end if;
  if array(select signed_level from ordering.lineroutestep where order_line_id='line:test:a' order by sequence_no)
    <>array['L0','L1','L-2','L2','L6','L7'] then raise exception 'SIGNED_ROUTE_SEQUENCE'; end if;
  if array(select original_sequence_no from ordering.aftersaleroutestep where aftersale_id='aftersale:test:a' order by reverse_sequence_no)
    <>array[6,5,4,3,2,1] then raise exception 'REVERSE_ROUTE_SEQUENCE'; end if;
  select jsonb_agg(to_jsonb(step) order by sequence_no) into frozen from ordering.lineroutestep step where order_line_id='line:test:b:warehouse';
  if frozen::text not like '%contract:test:b:warehouse%' or frozen::text like '%party:test:new-fulfillment%'
    then raise exception 'HISTORY_RECOMPUTED'; end if;
  if (select count(*) from inventory.supplierreservationfact where order_id='order:test:four-flow')<>3
    or (select count(*) from fulfillment.supplierresponsibility where order_id='order:test:four-flow')<>3
    or (select count(*) from payment.merchantreceipt where order_id='order:test:four-flow')<>1
    or (select count(*) from finance.supplierlegfact where order_id='order:test:four-flow')<>12
    then raise exception 'FOUR_FLOW_FACTS_INCOMPLETE'; end if;
  if exists(select 1 from payment.supplierrefundallocation where aftersale_id='aftersale:test:a' and supplier_leg_id<>'leg:test:a')
    or exists(select 1 from finance.supplierlegreversal where aftersale_id='aftersale:test:a' and supplier_leg_id<>'leg:test:a')
    then raise exception 'SUPPLIER_A_REFUND_LEAKED'; end if;
  if (select count(*) from finance.supplierlegreversal where aftersale_id='aftersale:test:b:partial')<>4
    or (select amount_minor from finance.supplierlegreversal where aftersale_id='aftersale:test:b:partial' and fact_kind='cost')<>350
    then raise exception 'PARTIAL_REFUND_ALLOCATION'; end if;
  if (select count(*) from ordering.orderrecord where member_id='member:test:same-mobile' and participant_membership_id='membership:test:realm-a')<>1
    or (select count(*) from ordering.orderrecord where member_id='member:test:same-mobile' and participant_membership_id='membership:test:realm-b')<>1
    then raise exception 'REALM_MEMBERSHIP_PROJECTION'; end if;
end
$business_results$;

do $atomic_failure_results$
begin
  begin
    insert into ordering.orderrecord(id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,payment_state,
      fulfillment_state,aftersale_state,lifecycle_state,evidence,address_snapshot,invoice_snapshot,delivery_snapshot,created_at,updated_at,version)
    values('order:test:rolled-back','SFL-ROLLBACK','mall:d1708f04df2dd8a61736852c4900fb43','member:test',
      'mall:d1708f04df2dd8a61736852c4900fb43','checkout:test:rolled-back','CNY',1,'unpaid','unallocated','none','created','{}','null','null','{}',clock_timestamp(),clock_timestamp(),0);
    insert into ordering.lineroutestep(order_line_id,route_id,route_version,sequence_no,line_id,signed_level,node_id,party_id,party_kind,mall_id,
      supplier_id,supplier_relationship_id,supplier_relationship_version,contract_id,contract_version,edge_kind,fulfillment_party_id,
      settlement_party_id,invoice_party_id,effective_at)
    values('missing-line','route:missing',1,1,'line:test','L0',null,'party:test','participant','mall:test','supplier:test','relationship:test',1,
      'contract:test',1,'test','party:test','party:test','party:test',clock_timestamp());
  exception when foreign_key_violation then null;
  end;
  if exists(select 1 from ordering.orderrecord where id='order:test:rolled-back') then raise exception 'HALF_ORDER_SURVIVED'; end if;

  begin
    insert into ordering.aftersaleexception(id,aftersale_id,supplier_leg_id,reason,state,evidence,created_at)
    values('exception:test:inventory-rollback','aftersale:test:a','leg:test:a','inventory-rollback-probe','pending','{}',clock_timestamp());
    insert into inventory.supplierrestockfact(id,aftersale_id,order_line_id,supplier_leg_id,stockitem_id,transaction_id,correlation_id,
      route_id,route_version,quantity,created_at)
    values('supplier-restock:test:rolled-back','aftersale:test:a','line:test:b:warehouse','leg:test:b:warehouse','stock:missing',
      'transaction:test:four-flow','correlation:test:four-flow','route:test:b:warehouse',1,1,clock_timestamp());
  exception when foreign_key_violation then null;
  end;
  if exists(select 1 from ordering.aftersaleexception where id='exception:test:inventory-rollback')
    then raise exception 'HALF_INVENTORY_REPLAY_SURVIVED'; end if;

  begin
    insert into ordering.aftersaleexception(id,aftersale_id,supplier_leg_id,reason,state,evidence,created_at)
    values('exception:test:refund-rollback','aftersale:test:b:partial','leg:test:b:warehouse','refund-rollback-probe','pending','{}',clock_timestamp());
    insert into payment.supplierrefundallocation(id,refund_id,aftersale_id,order_line_id,supplier_leg_id,transaction_id,correlation_id,
      route_id,route_version,supplier_id,amount_minor,currency,state,created_at)
    values('supplier-refund-allocation:test:rolled-back','refund:missing','aftersale:test:b:partial','line:test:b:warehouse','leg:test:b:warehouse',
      'transaction:test:four-flow','correlation:test:four-flow','route:test:b:warehouse',1,'partner:test:supplier:b',1,'CNY','planned',clock_timestamp());
  exception when foreign_key_violation then null;
  end;
  if exists(select 1 from ordering.aftersaleexception where id='exception:test:refund-rollback')
    then raise exception 'HALF_REFUND_REPLAY_SURVIVED'; end if;
end
$atomic_failure_results$;

rollback;
