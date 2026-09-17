begin;

-- The existing member detail, order list and purchased tag read order facts.
-- Keep the identity API's read surface to those columns and the selected mall.
grant usage on schema ordering to zhudatuanidentityapi;
grant select (id,order_number,member_id,mall_id,total_minor,currency,payment_state,
  fulfillment_state,aftersale_state,created_at)
  on ordering.orderrecord to zhudatuanidentityapi;

create policy zhudatuanidentityapi_member_read on ordering.orderrecord
  for select to zhudatuanidentityapi
  using (mall_id=nullif(current_setting('app.scope_id',true),''));

insert into runtime.schemaversion(version,checksum)
values('20260917100000',encode(public.digest('storefront-member-order-read:v1','sha256'),'hex'));

commit;
