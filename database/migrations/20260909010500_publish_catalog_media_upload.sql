begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260909010000') then
    raise exception 'CATALOG_MEDIA_UPLOAD_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260909010500') then
    raise exception 'CATALOG_MEDIA_UPLOAD_ALREADY_APPLIED';
  end if;
  if (select count(*) from runtime.operation)<>382
    or (select count(*) from capability.operation)<>382 then
    raise exception 'CATALOG_MEDIA_UPLOAD_PREVIOUS_REGISTRY_INVALID';
  end if;
  if not exists(select 1 from access.permission where code='catalog.product.manage' and status='active') then
    raise exception 'CATALOG_PRODUCT_PERMISSION_MISSING';
  end if;
end
$precondition$;

insert into runtime.operation(id,owner,method,path,contract_version)
values('catalog.mediauploads.create','catalog','POST','/api/v1/catalog/mediauploads','5.0.0');

insert into capability.capability(id,kind,name,version,status)
values('catalog.mediauploads.create','operation','catalog.mediauploads.create',3,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience,targets)
values('catalog.mediauploads.create','catalog.mediauploads.create','catalog.product.manage','console','{console,supplier}');

insert into capability.entitlement(
  id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
values(
  'platform:catalog.mediauploads.create','organization-platform-root','catalog.mediauploads.create','enabled',null,
  '1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration:catalog','catalogmediauploadpublish');

insert into capability.entitlementhistory(
  id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select
  'entitlementhistory:'||encode(public.digest(entitlement.id||':20260909010500','sha256'),'hex'),
  entitlement.id,entitlement.scope_id,entitlement.capability_id,entitlement.state,entitlement.quota,
  entitlement.effective_at,entitlement.expires_at,entitlement.version,'migration:catalog','catalogmediauploadpublish',clock_timestamp()
from capability.entitlement entitlement
where entitlement.id='platform:catalog.mediauploads.create';

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
  '20260909010500',383,383,0,0,
  'select id,owner,method,path,contract_version from runtime.operation where id=''catalog.mediauploads.create'';',
  'select operation_id,capability_id,permission_code,audience,targets from capability.operation where operation_id=''catalog.mediauploads.create'';'
);

insert into runtime.schemaversion(version,checksum)
values('20260909010500',encode(public.digest('20260909010500_publish_catalog_media_upload','sha256'),'hex'));

update runtime.schemahead set
  migration_head='20260909010500',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:catalog',published_at=clock_timestamp()
where artifact='commerce';

do $assert$
begin
  if (select count(*) from runtime.operation)<>383
    or (select count(*) from capability.operation)<>383 then
    raise exception 'CATALOG_MEDIA_UPLOAD_REGISTRY_INVALID';
  end if;
  if not exists(
    select 1 from capability.operation
    where operation_id='catalog.mediauploads.create'
      and capability_id='catalog.mediauploads.create'
      and permission_code='catalog.product.manage'
      and audience='console'
      and targets='{console,supplier}'
  ) then raise exception 'CATALOG_MEDIA_UPLOAD_BINDING_INVALID'; end if;
  if not exists(
    select 1 from capability.entitlement
    where scope_id='organization-platform-root'
      and capability_id='catalog.mediauploads.create'
      and state='enabled'
  ) then raise exception 'CATALOG_MEDIA_UPLOAD_ENTITLEMENT_INVALID'; end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='5.0.0' and status='active'
      and operation_count=383 and event_count=145 and checksum~'^[0-9a-f]{64}$'
  ) then raise exception 'CATALOG_MEDIA_UPLOAD_CONTRACT_INVALID'; end if;
  if not exists(
    select 1 from runtime.schemahead
    where artifact='commerce' and migration_head='20260909010500'
      and migration_count=(select count(*) from runtime.schemaversion)
  ) then raise exception 'CATALOG_MEDIA_UPLOAD_SCHEMA_HEAD_INVALID'; end if;
end
$assert$;

commit;
