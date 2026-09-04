begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904065000') then raise exception 'CATALOG_IMPORT_PREFLIGHT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260907010000') then raise exception 'CATALOG_IMPORT_PREFLIGHT_ALREADY_APPLIED'; end if;
end
$precondition$;

alter table catalog.category add column required_attributes text[] not null default '{}';
alter table catalog.category add constraint catalog_category_required_attributes
  check(cardinality(required_attributes)<=100 and array_position(required_attributes,null) is null);

create table catalog.import_receipts(
  import_id text not null,
  scope_id text not null,
  row_number bigint not null check(row_number>1),
  source_hash char(64) not null check(source_hash~'^[0-9a-f]{64}$'),
  product_id text not null references catalog.product(id),
  sku_id text not null references catalog.sku(id),
  product_version bigint not null check(product_version>0),
  sku_version bigint not null check(sku_version>0),
  created_at timestamptz not null,
  primary key(import_id,row_number),
  unique(import_id,sku_id)
);
create index catalog_import_receipts_product on catalog.import_receipts(scope_id,product_id,created_at desc);

alter table catalog.import_receipts enable row level security;
alter table catalog.import_receipts force row level security;
create policy moduleowner on catalog.import_receipts for all to shopcatalogowner using(true) with check(true);
create policy modulereader on catalog.import_receipts for select to shopcatalogreader using(true);
create policy modulewriter on catalog.import_receipts for all to shopcatalogwriter using(true) with check(true);
create policy migrationaccess on catalog.import_receipts for all to shopmigration using(true) with check(true);
create policy importreceiptjob on catalog.import_receipts for all to shopjob using(true) with check(true);
revoke all on catalog.import_receipts from public;
grant select,insert,update,delete on catalog.import_receipts to shopcatalogwriter,shopjob;
grant select on catalog.import_receipts to shopcatalogreader;
alter table catalog.import_receipts owner to shopcatalogowner;

insert into runtime.schemaversion(version,checksum)
values('20260907010000',encode(public.digest('20260907010000_catalog_import_preflight','sha256'),'hex'));
update runtime.schemahead set migration_head='20260907010000',migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:catalog',published_at=clock_timestamp() where artifact='commerce';

select runtime.record_migration_evidence('20260907010000',
  (select count(*) from catalog.category where cardinality(required_attributes)>0),
  (select count(*) from catalog.import_receipts),0,0,
  'select id,code,required_attributes from catalog.category where cardinality(required_attributes)>0 order by id;',
  'select import_id,row_number,product_id,sku_id,product_version,sku_version from catalog.import_receipts order by import_id,row_number;');

do $assert$
begin
  if not exists(select 1 from runtime.schemahead where artifact='commerce' and migration_head='20260907010000'
    and migration_count=(select count(*) from runtime.schemaversion)) then raise exception 'CATALOG_IMPORT_PREFLIGHT_HEAD_INVALID'; end if;
  if (select relowner::regrole::text from pg_class where oid='catalog.import_receipts'::regclass)<>'shopcatalogowner'
    then raise exception 'CATALOG_IMPORT_RECEIPT_OWNER_INVALID'; end if;
end
$assert$;

commit;
