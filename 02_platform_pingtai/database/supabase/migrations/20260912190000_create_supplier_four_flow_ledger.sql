begin;

create table partner.supplierrelationship(
  id text primary key,
  relationship_id text not null,
  relationship_version bigint not null check(relationship_version>0),
  supplier_id text not null references partner.partner(id),
  purchasing_node_id text not null,
  realm_id text not null,
  line_id text not null,
  mall_id text not null,
  product_scope jsonb not null check(jsonb_typeof(product_scope)='object'),
  status text not null check(status in('draft','active','superseded','terminated')),
  effective_at timestamptz not null,
  superseded_at timestamptz,
  predecessor_id text references partner.supplierrelationship(id),
  created_at timestamptz not null,
  unique(relationship_id,relationship_version)
);

create table partner.suppliercontract(
  id text primary key,
  contract_id text not null,
  contract_version bigint not null check(contract_version>0),
  supplier_relationship_id text not null references partner.supplierrelationship(id),
  supply_terms jsonb not null check(jsonb_typeof(supply_terms)='object'),
  fulfillment_party_id text not null,
  settlement_party_id text not null,
  invoice_party_id text not null,
  status text not null check(status in('draft','active','superseded','terminated')),
  effective_at timestamptz not null,
  superseded_at timestamptz,
  predecessor_id text references partner.suppliercontract(id),
  created_at timestamptz not null,
  unique(contract_id,contract_version)
);

create table partner.supplyroute(
  route_id text not null,
  route_version bigint not null check(route_version>0),
  supplier_relationship_id text not null references partner.supplierrelationship(id),
  contract_id text not null references partner.suppliercontract(id),
  line_id text not null,
  mall_id text not null,
  status text not null check(status in('draft','active','superseded','terminated')),
  effective_at timestamptz not null,
  superseded_at timestamptz,
  primary key(route_id,route_version)
);

create table partner.supplyroutestep(
  route_id text not null,
  route_version bigint not null,
  sequence_no integer not null check(sequence_no>0),
  line_id text not null,
  signed_level text not null check(signed_level~'^L(-[1-9][0-9]*|[0-9]|10|11)$'),
  node_id text,
  party_id text not null,
  party_kind text not null check(party_kind in('supplier','operating_owner','participant','service_provider')),
  edge_kind text not null,
  effective_at timestamptz not null,
  primary key(route_id,route_version,sequence_no),
  foreign key(route_id,route_version) references partner.supplyroute(route_id,route_version)
);

create table catalog.supplyoffer(
  id text primary key,
  mall_id text not null,
  sku_id text not null references catalog.sku(id),
  supplier_id text not null references partner.partner(id),
  supplier_relationship_id text not null references partner.supplierrelationship(id),
  contract_id text not null references partner.suppliercontract(id),
  route_id text not null,
  route_version bigint not null,
  stockitem_id text not null references inventory.stockitem(id),
  unit_cost_minor bigint not null check(unit_cost_minor>=0),
  status text not null check(status in('active','superseded','terminated')),
  effective_at timestamptz not null,
  superseded_at timestamptz,
  foreign key(route_id,route_version) references partner.supplyroute(route_id,route_version),
  unique(mall_id,sku_id,effective_at)
);

alter table ordering.line
  add column if not exists stockitem_id text,
  add column if not exists supplier_relationship_version bigint,
  add column if not exists contract_version bigint,
  add column if not exists cost_minor bigint not null default 0,
  add column if not exists shipping_minor bigint not null default 0,
  add column if not exists tax_minor bigint not null default 0,
  add column if not exists supplier_leg_id text;

alter table ordering.suborder
  add column if not exists transaction_id text,
  add column if not exists correlation_id text,
  add column if not exists realm_id text,
  add column if not exists line_id text,
  add column if not exists operating_node_id text,
  add column if not exists merchandise_minor bigint not null default 0,
  add column if not exists discount_minor bigint not null default 0,
  add column if not exists shipping_minor bigint not null default 0,
  add column if not exists tax_minor bigint not null default 0,
  add column if not exists cost_minor bigint not null default 0,
  add column if not exists currency char(3) not null default 'CNY';

alter table ordering.aftersale
  add column if not exists supplier_leg_id text,
  add column if not exists replay_state text not null default 'pending';

create table ordering.lineroutestep(
  order_line_id text not null references ordering.line(id),
  route_id text not null,
  route_version bigint not null,
  sequence_no integer not null check(sequence_no>0),
  line_id text not null,
  signed_level text not null,
  node_id text,
  party_id text not null,
  party_kind text not null,
  mall_id text not null,
  supplier_id text not null,
  supplier_relationship_id text not null,
  supplier_relationship_version bigint not null,
  contract_id text not null,
  contract_version bigint not null,
  edge_kind text not null,
  fulfillment_party_id text not null,
  settlement_party_id text not null,
  invoice_party_id text not null,
  effective_at timestamptz not null,
  primary key(order_line_id,sequence_no)
);

create table ordering.aftersaleroutestep(
  aftersale_id text not null references ordering.aftersale(id),
  order_line_id text not null references ordering.line(id),
  reverse_sequence_no integer not null check(reverse_sequence_no>0),
  original_sequence_no integer not null check(original_sequence_no>0),
  route_id text not null,
  route_version bigint not null,
  party_id text not null,
  party_kind text not null,
  responsibility text not null,
  created_at timestamptz not null,
  primary key(aftersale_id,order_line_id,reverse_sequence_no)
);

create table ordering.aftersaleexception(
  id text primary key,
  aftersale_id text not null references ordering.aftersale(id),
  supplier_leg_id text,
  reason text not null,
  state text not null check(state in('pending','resolved')),
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  created_at timestamptz not null,
  resolved_at timestamptz,
  unique(aftersale_id,reason)
);

create table inventory.supplierreservationfact(
  id text primary key,
  reservation_id text not null references inventory.reservation(id),
  order_id text not null references ordering.orderrecord(id),
  order_line_id text not null references ordering.line(id),
  supplier_leg_id text not null references ordering.suborder(id),
  stockitem_id text not null references inventory.stockitem(id),
  transaction_id text not null,
  correlation_id text not null,
  route_id text not null,
  route_version bigint not null,
  supplier_id text not null,
  quantity bigint not null check(quantity>0),
  state text not null check(state in('reserved','committed','released')),
  created_at timestamptz not null,
  unique(order_line_id,reservation_id)
);

create table inventory.supplierrestockfact(
  id text primary key,
  aftersale_id text not null references ordering.aftersale(id),
  order_line_id text not null references ordering.line(id),
  supplier_leg_id text not null references ordering.suborder(id),
  stockitem_id text not null references inventory.stockitem(id),
  transaction_id text not null,
  correlation_id text not null,
  route_id text not null,
  route_version bigint not null,
  quantity bigint not null check(quantity>0),
  created_at timestamptz not null,
  unique(aftersale_id,order_line_id)
);

create table fulfillment.supplierresponsibility(
  id text primary key,
  order_id text not null references ordering.orderrecord(id),
  supplier_leg_id text not null references ordering.suborder(id),
  transaction_id text not null,
  correlation_id text not null,
  route_id text not null,
  route_version bigint not null,
  supplier_id text not null,
  fulfillment_party_id text not null,
  settlement_party_id text not null,
  invoice_party_id text not null,
  state text not null check(state in('pending','accepted','processing','completed','cancelled','returned')),
  created_at timestamptz not null,
  unique(order_id,supplier_leg_id)
);

create table fulfillment.supplierreturnfact(
  id text primary key,
  aftersale_id text not null references ordering.aftersale(id),
  order_line_id text not null references ordering.line(id),
  supplier_leg_id text not null references ordering.suborder(id),
  transaction_id text not null,
  correlation_id text not null,
  route_id text not null,
  route_version bigint not null,
  fulfillment_party_id text not null,
  quantity bigint not null check(quantity>0),
  state text not null check(state in('accepted','exception')),
  created_at timestamptz not null,
  unique(aftersale_id,order_line_id)
);

create table payment.merchantreceipt(
  id text primary key,
  payment_id text not null references payment.payment(id),
  order_id text not null references ordering.orderrecord(id),
  transaction_id text not null,
  correlation_id text not null,
  mall_id text not null,
  amount_minor bigint not null check(amount_minor>0),
  currency char(3) not null,
  provider_source text not null,
  observed_at timestamptz not null,
  unique(payment_id)
);

create table payment.supplierrefundallocation(
  id text primary key,
  refund_id text not null references payment.refund(id),
  aftersale_id text not null references ordering.aftersale(id),
  order_line_id text not null references ordering.line(id),
  supplier_leg_id text not null references ordering.suborder(id),
  transaction_id text not null,
  correlation_id text not null,
  route_id text not null,
  route_version bigint not null,
  supplier_id text not null,
  amount_minor bigint not null check(amount_minor>0),
  currency char(3) not null,
  state text not null check(state in('planned','succeeded','failed')),
  created_at timestamptz not null,
  unique(refund_id,order_line_id)
);

create table finance.supplierlegfact(
  id text primary key,
  order_id text not null references ordering.orderrecord(id),
  supplier_leg_id text not null references ordering.suborder(id),
  transaction_id text not null,
  correlation_id text not null,
  route_id text not null,
  route_version bigint not null,
  supplier_id text not null,
  fact_kind text not null check(fact_kind in('receivable','payable','income','cost')),
  amount_minor bigint not null check(amount_minor>=0),
  currency char(3) not null,
  journal_id text,
  created_at timestamptz not null,
  unique(supplier_leg_id,fact_kind)
);

create table finance.supplierlegreversal(
  id text primary key,
  aftersale_id text not null references ordering.aftersale(id),
  order_line_id text not null references ordering.line(id),
  supplier_leg_id text not null references ordering.suborder(id),
  transaction_id text not null,
  correlation_id text not null,
  fact_kind text not null check(fact_kind in('receivable','payable','income','cost')),
  amount_minor bigint not null check(amount_minor>=0),
  currency char(3) not null,
  journal_id text,
  created_at timestamptz not null,
  unique(aftersale_id,order_line_id,fact_kind)
);

create index ordering_suborder_transaction_idx on ordering.suborder(transaction_id,supplier_id);
create index ordering_line_supplier_leg_idx on ordering.line(supplier_leg_id);
create index ordering_lineroute_route_idx on ordering.lineroutestep(route_id,route_version,sequence_no);
create index payment_supplierrefund_leg_idx on payment.supplierrefundallocation(supplier_leg_id,created_at);
create index finance_supplierleg_transaction_idx on finance.supplierlegfact(transaction_id,supplier_leg_id);

insert into finance.accountingeventrule(event_type,version,recognition,debit_roles,credit_roles,subledger_kind,reversal_event,effective_at) values
  ('supplier-leg.sale',1,'Supplier-leg receivable and sales income',array['order_receivable'],array['commerce_revenue'],'order_receivable','supplier-leg.refund-sale','1970-01-01T00:00:00Z'),
  ('supplier-leg.cost',1,'Supplier-leg cost and supplier payable',array['settlement_cost'],array['supplier_payable'],'supplier_payable','supplier-leg.refund-cost','1970-01-01T00:00:00Z'),
  ('supplier-leg.refund-sale',1,'Supplier-leg sales return reduces receivable',array['sales_return'],array['order_receivable'],'order_receivable','finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('supplier-leg.refund-cost',1,'Supplier-leg return reduces supplier payable and cost',array['supplier_payable'],array['settlement_cost'],'supplier_payable','finance.journal.reversal','1970-01-01T00:00:00Z');

grant select,insert,update on partner.supplierrelationship,partner.suppliercontract,partner.supplyroute,partner.supplyroutestep,
  catalog.supplyoffer,ordering.lineroutestep,ordering.aftersaleroutestep,ordering.aftersaleexception,
  inventory.supplierreservationfact,inventory.supplierrestockfact,fulfillment.supplierresponsibility,
  fulfillment.supplierreturnfact,payment.merchantreceipt,payment.supplierrefundallocation,
  finance.supplierlegfact,finance.supplierlegreversal to shopapp,shopjob;

insert into runtime.schemaversion(version,checksum)
values('20260912190000','ed34c5c7137ce60aaf6995781f9a0e7a3f0792bb1a3bcefb27a8c6486a808515');

commit;
