begin;

alter table ordering.orderrecord
  add column if not exists transaction_id text,
  add column if not exists correlation_id text,
  add column if not exists operating_node_id text,
  add column if not exists operating_line_id text,
  add column if not exists participant_node_id text,
  add column if not exists participant_membership_id text,
  add column if not exists participant_realm_id text,
  add column if not exists participant_account_id text,
  add column if not exists participant_snapshot jsonb;

alter table ordering.line
  add column if not exists product_id text,
  add column if not exists route_id text,
  add column if not exists route_version bigint,
  add column if not exists operating_node_id text,
  add column if not exists operating_line_id text,
  add column if not exists participant_node_id text,
  add column if not exists participant_membership_id text,
  add column if not exists supplier_id text,
  add column if not exists supplier_relationship_id text,
  add column if not exists contract_id text,
  add column if not exists contract_hash text,
  add column if not exists fulfillment_party_id text,
  add column if not exists settlement_party_id text,
  add column if not exists invoice_party_id text,
  add column if not exists route_snapshot jsonb;

alter table ordering.suborder
  add column if not exists route_id text,
  add column if not exists route_version bigint,
  add column if not exists supplier_id text,
  add column if not exists supplier_relationship_id text,
  add column if not exists contract_id text,
  add column if not exists fulfillment_party_id text,
  add column if not exists settlement_party_id text,
  add column if not exists invoice_party_id text,
  add column if not exists amount_minor bigint;

alter table ordering.aftersale
  add column if not exists route_snapshot jsonb;

create index if not exists ordering_orderrecord_transaction_idx
  on ordering.orderrecord(transaction_id);
create index if not exists ordering_orderrecord_participant_idx
  on ordering.orderrecord(participant_membership_id,created_at desc);
create index if not exists ordering_line_route_idx
  on ordering.line(route_id,route_version);
create index if not exists ordering_line_supplier_idx
  on ordering.line(supplier_id,supplier_relationship_id,contract_id);

commit;
