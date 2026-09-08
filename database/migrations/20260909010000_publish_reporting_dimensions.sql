begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260908014000') then
    raise exception 'REPORTING_DIMENSIONS_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260909010000') then
    raise exception 'REPORTING_DIMENSIONS_ALREADY_APPLIED';
  end if;
end
$precondition$;

insert into runtime.operation(id,owner,method,path,contract_version)
values('reporting.dimensions.read','reporting','GET','/api/v1/reports/dimensions','5.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;

insert into access.permission(id,code,risk,status)
values('permission:5df5e07828e814893c2dcab3','reporting.dimension.read','low','active')
on conflict(code) do update set risk=excluded.risk,status=excluded.status;

insert into capability.capability(id,kind,name,version,status)
values('reporting.dimensions.read','operation','reporting.dimensions.read',1,'active')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,version=greatest(capability.capability.version,excluded.version),status='active';

insert into capability.operation(operation_id,capability_id,permission_code,audience,targets)
values('reporting.dimensions.read','reporting.dimensions.read','reporting.dimension.read','console','{console}')
on conflict(operation_id) do update set capability_id=excluded.capability_id,permission_code=excluded.permission_code,
  audience=excluded.audience,targets=excluded.targets;

insert into capability.entitlement(
  id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
values('platform:reporting.dimensions.read','organization-platform-root','reporting.dimensions.read','enabled',null,
  '1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration:reporting','namedreportdimensions')
on conflict(id) do update set state='enabled',expires_at=null,updated_at=clock_timestamp(),updated_by='migration:reporting',reason='namedreportdimensions';

with reporting_roles as (
  select distinct mapping.role_id
  from access.rolepermission mapping
  join access.permission permission on permission.id=mapping.permission_id
  where mapping.effect='allow' and permission.code in(
    'reporting.dashboard.read','reporting.sales.read','reporting.product.read','reporting.mall.read',
    'reporting.category.read','reporting.channel.read','reporting.voucher.read'
  )
)
insert into access.rolepermission(role_id,permission_id,effect)
select role.role_id,permission.id,'allow'
from reporting_roles role
cross join access.permission permission
where permission.code='reporting.dimension.read'
on conflict do nothing;

update access.roletemplate set
  allows=array(select distinct permission from unnest(allows||array['reporting.dimension.read']) permission order by permission),
  version=version+1,
  updated_at=clock_timestamp()
where state='active'
  and exists(select 1 from unnest(allows) permission where permission like 'reporting.%' and permission like '%.read')
  and not('reporting.dimension.read'=any(allows));

update capability.capabilityset set version=version+1,updated_at=clock_timestamp()
where scope_id='organization-platform-root';

update runtime.contractcatalog set status='retired'
where artifact='commerce' and status='active' and version<>'5.0.0';
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

select runtime.record_migration_evidence(
  '20260909010000',1,1,0,0,
  'select id,owner,method,path,contract_version from runtime.operation where id=''reporting.dimensions.read'';',
  'select operation_id,capability_id,permission_code,audience,targets from capability.operation where operation_id=''reporting.dimensions.read'';'
);

insert into runtime.schemaversion(version,checksum)
values('20260909010000',encode(public.digest('20260909010000_publish_reporting_dimensions','sha256'),'hex'));
update runtime.schemahead set
  migration_head='20260909010000',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:reporting',
  published_at=clock_timestamp()
where artifact='commerce';

do $assert$
begin
  if not exists(
    select 1 from runtime.operation operation
    join capability.operation binding on binding.operation_id=operation.id
    join access.permission permission on permission.code=binding.permission_code and permission.status='active'
    join capability.entitlement entitlement on entitlement.capability_id=binding.capability_id
    where operation.id='reporting.dimensions.read' and operation.method='GET'
      and entitlement.scope_id='organization-platform-root' and entitlement.state='enabled'
  ) then
    raise exception 'REPORTING_DIMENSIONS_CONTRACT_INCOMPLETE';
  end if;
  if exists(
    select 1 from access.role role
    where role.kind='owner' and role.status='active'
      and exists(
        select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
        where mapping.role_id=role.id and mapping.effect='allow' and permission.code='reporting.sales.read'
      )
      and not exists(
        select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
        where mapping.role_id=role.id and mapping.effect='allow' and permission.code='reporting.dimension.read'
      )
  ) then
    raise exception 'REPORTING_DIMENSIONS_OWNER_PERMISSION_MISSING';
  end if;
  if exists(
    select 1 from access.roletemplate template
    where template.state='active'
      and exists(select 1 from unnest(template.allows) permission where permission like 'reporting.%' and permission like '%.read')
      and not('reporting.dimension.read'=any(template.allows))
  ) then
    raise exception 'REPORTING_DIMENSIONS_ROLE_TEMPLATE_MISSING';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='5.0.0' and status='active'
      and operation_count=(select count(*) from runtime.operation)
      and event_count=(select count(*) from runtime.event where retired_at is null)
      and checksum~'^[0-9a-f]{64}$'
  ) then
    raise exception 'REPORTING_DIMENSIONS_CONTRACT_CATALOG_INVALID';
  end if;
  if not exists(
    select 1 from runtime.schemahead
    where artifact='commerce' and migration_head='20260909010000'
      and migration_count=(select count(*) from runtime.schemaversion)
  ) then
    raise exception 'REPORTING_DIMENSIONS_SCHEMA_HEAD_INVALID';
  end if;
end
$assert$;

commit;
