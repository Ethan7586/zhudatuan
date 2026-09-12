begin;

-- The purchase runtime already owns the order transaction. Keep its existing
-- mall/member boundary while allowing the supplier-flow snapshot written by
-- PlaceOrder instead of requiring the legacy supplier fields to be empty.
drop policy if exists zhudatuanpurchaseapiinsert on ordering.line;
create policy zhudatuanpurchaseapiinsert on ordering.line
  for insert to zhudatuanpurchaseapi
  with check(access.purchase_order_allowed(order_id));

drop policy if exists zhudatuanpurchaseapiinsert on ordering.suborder;
create policy zhudatuanpurchaseapiinsert on ordering.suborder
  for insert to zhudatuanpurchaseapi
  with check(access.purchase_order_allowed(order_id) and state='pending');

drop policy if exists zhudatuanpurchaseapiupdate on ordering.line;
create policy zhudatuanpurchaseapiupdate on ordering.line
  for update to zhudatuanpurchaseapi
  using(access.purchase_order_allowed(order_id))
  with check(access.purchase_order_allowed(order_id));

-- Exact privileges used by QuoteReader and PlaceOrder. No schema-wide or
-- database-wide grant is introduced.
grant select on catalog.supplyoffer to zhudatuanpurchaseapi;
grant select on partner.supplierrelationship,partner.suppliercontract,
  partner.supplyroute,partner.supplyroutestep to zhudatuanpurchaseapi;
grant insert on ordering.lineroutestep to zhudatuanpurchaseapi;
grant update(supplier_leg_id) on ordering.line to zhudatuanpurchaseapi;
grant insert on inventory.supplierreservationfact to zhudatuanpurchaseapi;
grant insert on fulfillment.supplierresponsibility to zhudatuanpurchaseapi;

insert into runtime.schemaversion(version,checksum)
values('20260913021500','ff91f2848d6127c46c17147a8c489fbee951429cfbcb6877ab8118d3bd36aa7a');

commit;
