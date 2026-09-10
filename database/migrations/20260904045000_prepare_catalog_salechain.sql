begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904044000') then raise exception 'IDEAL_SALECHAIN_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904045000') then raise exception 'IDEAL_SALECHAIN_ALREADY_APPLIED'; end if;
end
$precondition$;

create table catalog.salechainhead(
  id text primary key check(id~'^salechainhead:'),
  tenant_id text not null,
  scope_id text not null,
  listing_id text not null unique,
  product_id text not null,
  sku_id text not null,
  pool_id text not null,
  qualification_version bigint not null check(qualification_version>=0),
  quote_version bigint not null check(quote_version>=0),
  inventory_version bigint not null check(inventory_version>=0),
  channel_version bigint not null check(channel_version>=0),
  publication_hash char(64) not null check(publication_hash~'^[0-9a-f]{64}$'),
  version bigint not null check(version>0),
  published_by text not null,
  published_at timestamptz not null,
  updated_at timestamptz not null check(updated_at>=published_at),
  unique(scope_id,product_id,sku_id,pool_id)
);
create index catalog_salechain_scope on catalog.salechainhead(scope_id,published_at desc,id)
  include(listing_id,product_id,sku_id,pool_id,version);
alter table catalog.salechainhead enable row level security;
alter table catalog.salechainhead force row level security;
create policy migrationaccess on catalog.salechainhead for all to shopmigration using(true) with check(true);
create policy salechainapp on catalog.salechainhead for select to shopapp using(access.scope_allowed(scope_id));
create policy salechainjob on catalog.salechainhead for all to shopjob using(true) with check(true);
revoke all on catalog.salechainhead from public;
grant select on catalog.salechainhead to shopapp;
grant select,insert,update,delete on catalog.salechainhead to shopjob;

select runtime.record_migration_evidence('20260904045000',
  (select count(*) from catalog.listing),(select count(*) from catalog.listing),0,0,
  'select scope_id,status,count(*) from catalog.listing group by scope_id,status;',
  'select listing_id,qualification_version,quote_version,inventory_version,channel_version,publication_hash from catalog.salechainhead order by listing_id;');
insert into runtime.schemaversion(version,checksum)
values('20260904045000',encode(public.digest('20260904045000_prepare_catalog_salechain','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from catalog.product where version<=0) or exists(select 1 from catalog.sku where version<=0)
    or exists(select 1 from catalog.pool where version<=0) or exists(select 1 from catalog.listing where version<=0)
  then raise exception 'IDEAL_CATALOG_VERSION_INVALID'; end if;
end
$assert$;

commit;
