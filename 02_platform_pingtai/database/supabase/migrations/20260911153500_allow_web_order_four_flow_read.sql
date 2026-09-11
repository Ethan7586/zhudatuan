begin;

grant usage on schema payment, finance to zhudatuanwebapi;
grant select on all tables in schema payment, finance to zhudatuanwebapi;

commit;
