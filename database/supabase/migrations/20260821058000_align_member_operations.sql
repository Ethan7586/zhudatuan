begin;

update capability.operation
set audience='member'
where operation_id in(
  'cart.current.read','cart.items.put','cart.items.batch','checkout.quote.create','order.orders.create','order.orders.read',
  'order.aftersales.read','order.aftersales.apply','benefit.accounts.read','voucher.bindings.read','voucher.redemptions.read',
  'invoice.requests.create','support.cases.create','payment.intents.create','catalog.listings.read','pricing.offers.read',
  'inventory.availability.read'
);

update runtime.schemaversion
set checksum='6ada1cec97f6ad63842578d89453a04b88c95cf9f6fa33f320988b5150b8506a'
where version='20260821032000';

insert into runtime.schemaversion(version,checksum)
values('20260821058000','bfc232335f5ff8fe8d6ba44f663774569cf63167f95e36a42da20b07545ad620');

do $assert$ begin
  if (select count(*) from capability.operation where operation_id in(
    'cart.current.read','cart.items.put','cart.items.batch','checkout.quote.create','order.orders.create','order.orders.read',
    'order.aftersales.read','order.aftersales.apply','benefit.accounts.read','voucher.bindings.read','voucher.redemptions.read',
    'invoice.requests.create','support.cases.create','payment.intents.create','catalog.listings.read','pricing.offers.read',
    'inventory.availability.read'
  ) and audience='member')<>17 then raise exception 'MEMBER_OPERATION_AUDIENCE_MISMATCH'; end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260821032000' and checksum='6ada1cec97f6ad63842578d89453a04b88c95cf9f6fa33f320988b5150b8506a')
  then raise exception 'RUNTIME_CONTRACT_CHECKSUM_MISMATCH'; end if;
end $assert$;

commit;
