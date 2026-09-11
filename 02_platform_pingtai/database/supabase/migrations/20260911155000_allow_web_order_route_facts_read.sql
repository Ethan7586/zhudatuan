begin;

grant usage on schema ordering, inventory, fulfillment to zhudatuanwebapi;
grant select on all tables in schema ordering, inventory, fulfillment to zhudatuanwebapi;

commit;
