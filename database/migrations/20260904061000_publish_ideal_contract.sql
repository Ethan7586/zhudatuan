begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904060000') then raise exception 'IDEAL_CONTRACT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904061000') then raise exception 'IDEAL_CONTRACT_ALREADY_APPLIED'; end if;
end
$precondition$;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('catalog.facets.read','catalog','GET','/api/v1/catalog/facets','5.0.0'),
  ('catalog.listings.price.set','catalog','PUT','/api/v1/catalog/listings/{listingid}/price','5.0.0'),
  ('catalog.listings.pool.set','catalog','PUT','/api/v1/catalog/listings/{listingid}/pool','5.0.0'),
  ('observability.healthoverview.read','observability','GET','/api/v1/observability/health','5.0.0'),
  ('observability.slo.read','observability','GET','/api/v1/observability/slos','5.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;
update runtime.operation set contract_version='5.0.0' where contract_version<>'5.0.0';

insert into access.permission(id,code,risk,status)
values('permission:e8efc2d039bd92973f00306a','observability.health.read','high','active')
on conflict(code) do update set risk=excluded.risk,status=excluded.status;
insert into capability.capability(id,kind,name,version,status) values
  ('catalog.facets.read','operation','catalog.facets.read',3,'active'),
  ('catalog.listings.price.set','operation','catalog.listings.price.set',3,'active'),
  ('catalog.listings.pool.set','operation','catalog.listings.pool.set',3,'active'),
  ('observability.healthoverview.read','operation','observability.healthoverview.read',3,'active'),
  ('observability.slo.read','operation','observability.slo.read',3,'active')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,version=greatest(capability.capability.version,excluded.version),status='active';
insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('catalog.facets.read','catalog.facets.read','catalog.listing.read','console','{console,supplier}'),
  ('catalog.listings.price.set','catalog.listings.price.set','catalog.listing.manage','console','{console,supplier}'),
  ('catalog.listings.pool.set','catalog.listings.pool.set','catalog.listing.manage','console','{console,supplier}'),
  ('observability.healthoverview.read','observability.healthoverview.read','observability.health.read','console','{console}'),
  ('observability.slo.read','observability.slo.read','observability.health.read','console','{console}')
on conflict(operation_id) do update set capability_id=excluded.capability_id,permission_code=excluded.permission_code,
  audience=excluded.audience,targets=excluded.targets;
insert into capability.entitlement(
  id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
values
  ('platform:catalog.facets.read','organization-platform-root','catalog.facets.read','enabled',null,
    '1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration:contract','idealcontractpublish'),
  ('platform:catalog.listings.price.set','organization-platform-root','catalog.listings.price.set','enabled',null,
    '1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration:contract','idealcontractpublish'),
  ('platform:catalog.listings.pool.set','organization-platform-root','catalog.listings.pool.set','enabled',null,
    '1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration:contract','idealcontractpublish'),
  ('platform:observability.healthoverview.read','organization-platform-root','observability.healthoverview.read','enabled',null,
    '1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration:contract','idealcontractpublish'),
  ('platform:observability.slo.read','organization-platform-root','observability.slo.read','enabled',null,
    '1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration:contract','idealcontractpublish')
on conflict(id) do update set state='enabled',version=greatest(capability.entitlement.version,excluded.version),
  updated_at=clock_timestamp(),updated_by='migration:contract',reason='idealcontractpublish';
insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow' from access.permission permission
where permission.code='observability.health.read' on conflict do nothing;

update runtime.contractcatalog set status='retired' where artifact='commerce' and status='active' and version<>'5.0.0';
update runtime.contractcatalog catalog set
  checksum=fingerprint.checksum,
  operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event where retired_at is null),
  status='active',
  published_at=clock_timestamp()
from (
  select encode(public.digest(
    coalesce((select string_agg(id||chr(31)||owner||chr(31)||method||chr(31)||path||chr(31)||contract_version,chr(30) order by id) from runtime.operation),'')
    ||chr(29)||
    coalesce((select string_agg(type||chr(31)||version::text||chr(31)||owner||chr(31)||schema_ref,chr(30) order by type,version)
      from runtime.event where retired_at is null),''),
    'sha256'),'hex') checksum
) fingerprint
where catalog.artifact='commerce' and catalog.version='5.0.0';

select runtime.record_migration_evidence('20260904061000',
  (select operation_count from runtime.contractcatalog where artifact='commerce' and version='5.0.0'),
  (select count(*) from runtime.operation),0,0,
  'select id,owner,method,path,contract_version from runtime.operation order by id;',
  'select artifact,version,checksum,operation_count,event_count,status from runtime.contractcatalog order by artifact,version;');
insert into runtime.schemaversion(version,checksum)
values('20260904061000',encode(public.digest('20260904061000_publish_ideal_contract','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from runtime.operation where contract_version<>'5.0.0') then raise exception 'IDEAL_OPERATION_VERSION_DRIFT'; end if;
  if not exists(select 1 from runtime.operation where id='catalog.facets.read')
    or not exists(select 1 from capability.operation where operation_id='catalog.facets.read'
      and capability_id='catalog.facets.read' and permission_code='catalog.listing.read'
      and audience='console' and targets='{console,supplier}')
  then raise exception 'IDEAL_CATALOG_FACET_OPERATION_MISSING'; end if;
  if not exists(select 1 from runtime.operation where id='catalog.listings.price.set')
    or not exists(select 1 from capability.operation where operation_id='catalog.listings.price.set'
      and capability_id='catalog.listings.price.set' and permission_code='catalog.listing.manage'
      and audience='console' and targets='{console,supplier}')
  then raise exception 'IDEAL_CATALOG_PRICE_OPERATION_MISSING'; end if;
  if not exists(select 1 from runtime.operation where id='catalog.listings.pool.set')
    or not exists(select 1 from capability.operation where operation_id='catalog.listings.pool.set'
      and capability_id='catalog.listings.pool.set' and permission_code='catalog.listing.manage'
      and audience='console' and targets='{console,supplier}')
  then raise exception 'IDEAL_CATALOG_POOL_OPERATION_MISSING'; end if;
  if not exists(select 1 from runtime.operation where id='observability.healthoverview.read')
    or not exists(select 1 from runtime.operation where id='observability.slo.read')
  then raise exception 'IDEAL_OBSERVABILITY_OPERATION_MISSING'; end if;
end
$assert$;

commit;
