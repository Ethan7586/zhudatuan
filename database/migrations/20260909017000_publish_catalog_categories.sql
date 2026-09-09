begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260909016000') then
    raise exception 'CATALOG_CATEGORIES_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260909017000') then
    raise exception 'CATALOG_CATEGORIES_ALREADY_APPLIED';
  end if;
  if (select count(*) from runtime.operation)<>383
    or (select count(*) from capability.operation)<>383 then
    raise exception 'CATALOG_CATEGORIES_PREVIOUS_REGISTRY_INVALID';
  end if;
  if not exists(select 1 from access.permission where code='catalog.product.read' and status='active')
    or not exists(select 1 from access.permission where code='catalog.product.manage' and status='active') then
    raise exception 'CATALOG_CATEGORY_PERMISSIONS_MISSING';
  end if;
end
$precondition$;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('catalog.categories.read','catalog','GET','/api/v1/catalog/categories','5.0.0'),
  ('catalog.categories.create','catalog','POST','/api/v1/catalog/categories','5.0.0');

insert into capability.capability(id,kind,name,version,status) values
  ('catalog.categories.read','operation','catalog.categories.read',3,'active'),
  ('catalog.categories.create','operation','catalog.categories.create',3,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('catalog.categories.read','catalog.categories.read','catalog.product.read','console','{console,supplier}'),
  ('catalog.categories.create','catalog.categories.create','catalog.product.manage','console','{console}');

insert into capability.entitlement(
  id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
values
  ('platform:catalog.categories.read','organization-platform-root','catalog.categories.read','enabled',null,'1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration:catalog','catalogcategoriespublish'),
  ('platform:catalog.categories.create','organization-platform-root','catalog.categories.create','enabled',null,'1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration:catalog','catalogcategoriespublish');

insert into capability.entitlementhistory(
  id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select
  'entitlementhistory:'||encode(public.digest(entitlement.id||':20260909017000','sha256'),'hex'),
  entitlement.id,entitlement.scope_id,entitlement.capability_id,entitlement.state,entitlement.quota,
  entitlement.effective_at,entitlement.expires_at,entitlement.version,'migration:catalog','catalogcategoriespublish',clock_timestamp()
from capability.entitlement entitlement
where entitlement.id in('platform:catalog.categories.read','platform:catalog.categories.create');

update capability.capabilityset
set version=version+1,updated_at=clock_timestamp()
where scope_id='organization-platform-root';

update runtime.contractcatalog catalog set
  checksum=fingerprint.checksum,
  operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event where retired_at is null),
  published_at=clock_timestamp()
from (
  select encode(public.digest(
    coalesce((select string_agg(id||chr(31)||owner||chr(31)||method||chr(31)||path||chr(31)||contract_version,chr(30) order by id)
      from runtime.operation),'')
    ||chr(29)||
    coalesce((select string_agg(type||chr(31)||version::text||chr(31)||owner||chr(31)||schema_ref,chr(30) order by type,version)
      from runtime.event where retired_at is null),''),
    'sha256'),'hex') checksum
) fingerprint
where catalog.artifact='commerce' and catalog.version='5.0.0' and catalog.status='active';

select runtime.record_migration_evidence(
  '20260909017000',385,385,0,0,
  'select id,owner,method,path,contract_version from runtime.operation where id like ''catalog.categories.%'' order by id;',
  'select operation_id,capability_id,permission_code,audience,targets from capability.operation where operation_id like ''catalog.categories.%'' order by operation_id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260909017000',encode(public.digest('20260909017000_publish_catalog_categories','sha256'),'hex'));

update runtime.schemahead set
  migration_head='20260909017000',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:catalog',published_at=clock_timestamp()
where artifact='commerce';

do $assert$
begin
  if (select count(*) from runtime.operation)<>385
    or (select count(*) from capability.operation)<>385 then
    raise exception 'CATALOG_CATEGORIES_REGISTRY_INVALID';
  end if;
  if (select count(*) from capability.operation where operation_id like 'catalog.categories.%')<>2 then
    raise exception 'CATALOG_CATEGORIES_BINDINGS_INVALID';
  end if;
  if (select count(*) from capability.entitlement where scope_id='organization-platform-root'
      and capability_id in('catalog.categories.read','catalog.categories.create') and state='enabled')<>2 then
    raise exception 'CATALOG_CATEGORIES_ENTITLEMENTS_INVALID';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='5.0.0' and status='active'
      and operation_count=385 and event_count=145 and checksum~'^[0-9a-f]{64}$'
  ) then raise exception 'CATALOG_CATEGORIES_CONTRACT_INVALID'; end if;
  if not exists(
    select 1 from runtime.schemahead
    where artifact='commerce' and migration_head='20260909017000'
      and migration_count=(select count(*) from runtime.schemaversion)
  ) then raise exception 'CATALOG_CATEGORIES_SCHEMA_HEAD_INVALID'; end if;
end
$assert$;

commit;
