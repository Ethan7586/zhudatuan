begin;
insert into ordering.orderrecord(id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,payment_state,
  fulfillment_state,aftersale_state,lifecycle_state,evidence,address_snapshot,invoice_snapshot,delivery_snapshot,experience_version,
  transaction_id,correlation_id,operating_node_id,operating_line_id,participant_node_id,participant_membership_id,
  participant_realm_id,participant_account_id,participant_snapshot,created_at,updated_at,version)
values('order:test:concurrent','SFL-CONCURRENT-1','mall:d1708f04df2dd8a61736852c4900fb43','member:test:same-mobile',
  'mall:d1708f04df2dd8a61736852c4900fb43','checkout:test:concurrent','CNY',1,'paid','allocated','processing','active','{}','null','null','{}','test-v1',
  'transaction:test:concurrent','correlation:test:concurrent','node:hbbtzn:l1','line:test:trade','node:test:l7','membership:test:realm-a',
  'realm:test:a','account:test:a','{}',clock_timestamp(),clock_timestamp(),0)
on conflict do nothing;

insert into ordering.line(id,order_id,sku_id,listing_id,product_id,title_snapshot,quantity,unit_minor,total_minor,discount_minor,
  provider,partner_id,evidence,route_id,route_version,operating_node_id,operating_line_id,participant_node_id,participant_membership_id,
  supplier_id,supplier_relationship_id,supplier_relationship_version,contract_id,contract_version,fulfillment_party_id,
  settlement_party_id,invoice_party_id,route_snapshot,stockitem_id,cost_minor,shipping_minor,tax_minor,supplier_leg_id)
values('line:test:concurrent','order:test:concurrent','sku:zdt:supplier:trial:001','listing:test:concurrent','product:test:concurrent','并发商品',
  1,1,1,0,'fixture','partner:test:supplier:a','{}','route:test:a',1,'node:hbbtzn:l1','line:test:trade','node:test:l7',
  'membership:test:realm-a','partner:test:supplier:a','relationship:test:a',1,'contract:test:a',1,'partner:test:supplier:a',
  'partner:test:supplier:a','partner:test:supplier:a','{"frozen":true}','stock:zdt:supplier:trial:001',1,0,0,'leg:test:concurrent')
on conflict do nothing;

insert into ordering.suborder(id,order_id,partner_id,provider,state,version,route_id,route_version,supplier_id,supplier_relationship_id,
  contract_id,fulfillment_party_id,settlement_party_id,invoice_party_id,amount_minor,transaction_id,correlation_id,realm_id,line_id,
  operating_node_id,merchandise_minor,discount_minor,shipping_minor,tax_minor,cost_minor,currency)
values('leg:test:concurrent','order:test:concurrent','partner:test:supplier:a','fixture','pending',0,'route:test:a',1,
  'partner:test:supplier:a','relationship:test:a','contract:test:a','partner:test:supplier:a','partner:test:supplier:a',
  'partner:test:supplier:a',1,'transaction:test:concurrent','correlation:test:concurrent','realm:test:a','line:test:trade',
  'node:hbbtzn:l1',1,0,0,0,1,'CNY') on conflict do nothing;

insert into ordering.lineroutestep(order_line_id,route_id,route_version,sequence_no,line_id,signed_level,node_id,party_id,party_kind,mall_id,
  supplier_id,supplier_relationship_id,supplier_relationship_version,contract_id,contract_version,edge_kind,fulfillment_party_id,
  settlement_party_id,invoice_party_id,effective_at)
select 'line:test:concurrent',step.route_id,step.route_version,step.sequence_no,step.line_id,step.signed_level,step.node_id,step.party_id,
  step.party_kind,'mall:d1708f04df2dd8a61736852c4900fb43','partner:test:supplier:a','relationship:test:a',1,'contract:test:a',1,
  step.edge_kind,'partner:test:supplier:a','partner:test:supplier:a','partner:test:supplier:a',step.effective_at
from partner.supplyroutestep step where step.route_id='route:test:a' and step.route_version=1
on conflict(order_line_id,sequence_no) do nothing;

insert into ordering.aftersale(id,order_id,line_id,kind,state,quantity,amount_minor,reason,requested_by,requested_membership_id,
  supplier_leg_id,replay_state,route_snapshot,created_at,updated_at,version)
values('aftersale:test:concurrent','order:test:concurrent','line:test:concurrent','return','processing',1,1,'并发退款','member:test',
  'membership:test:realm-a','leg:test:concurrent','processing','{"frozen":true}',clock_timestamp(),clock_timestamp(),0)
on conflict do nothing;

insert into ordering.aftersaleroutestep(aftersale_id,order_line_id,reverse_sequence_no,original_sequence_no,route_id,route_version,
  party_id,party_kind,responsibility,created_at)
select 'aftersale:test:concurrent','line:test:concurrent',row_number() over(order by step.sequence_no desc),step.sequence_no,
  step.route_id,step.route_version,step.party_id,step.party_kind,'return_refund_restock_reversal',clock_timestamp()
from ordering.lineroutestep step where step.order_line_id='line:test:concurrent'
on conflict(aftersale_id,order_line_id,reverse_sequence_no) do nothing;

insert into payment.refund(id,mall_id,payment_id,provider,provider_reference,idempotency_key,amount_minor,currency,state,reason,aftersale_id,version)
values('refund:test:concurrent','mall:d1708f04df2dd8a61736852c4900fb43','payment:test:four-flow','fixture',
  'provider-refund:test:concurrent','refund:test:concurrent',1,'CNY','succeeded','并发退款','aftersale:test:concurrent',0)
on conflict do nothing;
insert into payment.supplierrefundallocation(id,refund_id,aftersale_id,order_line_id,supplier_leg_id,transaction_id,correlation_id,
  route_id,route_version,supplier_id,amount_minor,currency,state,created_at)
values('supplier-refund-allocation:test:concurrent','refund:test:concurrent','aftersale:test:concurrent','line:test:concurrent',
  'leg:test:concurrent','transaction:test:concurrent','correlation:test:concurrent','route:test:a',1,'partner:test:supplier:a',1,'CNY',
  'succeeded',clock_timestamp()) on conflict(refund_id,order_line_id) do nothing;
insert into inventory.supplierrestockfact(id,aftersale_id,order_line_id,supplier_leg_id,stockitem_id,transaction_id,correlation_id,route_id,
  route_version,quantity,created_at)
values('supplier-restock:test:concurrent','aftersale:test:concurrent','line:test:concurrent','leg:test:concurrent',
  'stock:zdt:supplier:trial:001','transaction:test:concurrent','correlation:test:concurrent','route:test:a',1,1,clock_timestamp())
on conflict(aftersale_id,order_line_id) do nothing;
insert into finance.supplierlegreversal(id,aftersale_id,order_line_id,supplier_leg_id,transaction_id,correlation_id,fact_kind,
  amount_minor,currency,created_at)
select 'aftersale:test:concurrent:'||kind,'aftersale:test:concurrent','line:test:concurrent','leg:test:concurrent',
  'transaction:test:concurrent','correlation:test:concurrent',kind,1,'CNY',clock_timestamp()
from (values('receivable'),('payable'),('income'),('cost')) fact(kind)
on conflict(aftersale_id,order_line_id,fact_kind) do nothing;
commit;
