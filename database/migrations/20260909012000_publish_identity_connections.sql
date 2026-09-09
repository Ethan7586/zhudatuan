begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260909011000') then
    raise exception 'IDENTITY_CONNECTIONS_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260909012000') then
    raise exception 'IDENTITY_CONNECTIONS_ALREADY_APPLIED';
  end if;
end
$precondition$;

with family as (
  select operation.capability_id,
    case when operation.operation_id like 'organization.%' then 'identity.directory' else 'identity.federation' end feature
  from capability.operation operation
  where operation.operation_id like 'identity.providers.%'
    or operation.operation_id like 'identity.federations.%'
    or operation.operation_id like 'identity.links.%'
    or operation.operation_id like 'organization.directories.%'
    or operation.operation_id like 'organization.directoryevents.%'
)
insert into capability.dependency(capability_id,depends_on_id)
select capability_id,feature from family
on conflict do nothing;

with published(capability_id) as (
  values('identity.federation'),('identity.directory')
  union
  select operation.capability_id
  from capability.operation operation
  where operation.operation_id like 'identity.providers.%'
    or operation.operation_id like 'identity.federations.%'
    or operation.operation_id like 'identity.links.%'
    or operation.operation_id like 'organization.directories.%'
    or operation.operation_id like 'organization.directoryevents.%'
)
insert into capability.entitlement(
  id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
select 'platform:'||published.capability_id,'organization-platform-root',published.capability_id,'enabled',null,
  '1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration:identity','identityconnections'
from published
on conflict(scope_id,capability_id) do update set
  state='enabled',quota=null,effective_at='1970-01-01T00:00:00Z',expires_at=null,
  version=capability.entitlement.version+1,updated_at=clock_timestamp(),updated_by='migration:identity',reason='identityconnections';

insert into capability.entitlementhistory(
  id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select 'entitlementhistory:'||encode(public.digest(entitlement.id||':identityconnections:20260909012000','sha256'),'hex'),
  entitlement.id,entitlement.scope_id,entitlement.capability_id,entitlement.state,entitlement.quota,
  entitlement.effective_at,entitlement.expires_at,entitlement.version,'migration:identity','identityconnections',clock_timestamp()
from capability.entitlement entitlement
where entitlement.scope_id='organization-platform-root'
  and (entitlement.capability_id in('identity.federation','identity.directory')
    or entitlement.capability_id in(
      select operation.capability_id from capability.operation operation
      where operation.operation_id like 'identity.providers.%'
        or operation.operation_id like 'identity.federations.%'
        or operation.operation_id like 'identity.links.%'
        or operation.operation_id like 'organization.directories.%'
        or operation.operation_id like 'organization.directoryevents.%'
    ));

insert into capability.capabilityset(scope_id,version,updated_at)
values('organization-platform-root',1,clock_timestamp())
on conflict(scope_id) do update set version=capability.capabilityset.version+1,updated_at=clock_timestamp();

select runtime.record_migration_evidence(
  '20260909012000',
  (select count(*) from capability.entitlement entitlement
    where entitlement.scope_id='organization-platform-root' and entitlement.state='enabled'
      and (entitlement.capability_id in('identity.federation','identity.directory')
        or entitlement.capability_id in(
          select operation.capability_id from capability.operation operation
          where operation.operation_id like 'identity.providers.%'
            or operation.operation_id like 'identity.federations.%'
            or operation.operation_id like 'identity.links.%'
            or operation.operation_id like 'organization.directories.%'
            or operation.operation_id like 'organization.directoryevents.%'
        ))),
  (select count(*) from capability.entitlement entitlement
    where entitlement.scope_id='organization-platform-root' and entitlement.state='enabled'
      and (entitlement.capability_id in('identity.federation','identity.directory')
        or entitlement.capability_id in(
          select operation.capability_id from capability.operation operation
          where operation.operation_id like 'identity.providers.%'
            or operation.operation_id like 'identity.federations.%'
            or operation.operation_id like 'identity.links.%'
            or operation.operation_id like 'organization.directories.%'
            or operation.operation_id like 'organization.directoryevents.%'
        ))),
  0,0,
  'select operation_id,capability_id,permission_code,targets from capability.operation where operation_id like ''identity.providers.%'' or operation_id like ''identity.federations.%'' or operation_id like ''identity.links.%'' or operation_id like ''organization.directories.%'' or operation_id like ''organization.directoryevents.%'' order by operation_id;',
  'select scope_id,capability_id,state,reason from capability.entitlement where scope_id=''organization-platform-root'' and reason=''identityconnections'' order by capability_id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260909012000',encode(public.digest('20260909012000_publish_identity_connections','sha256'),'hex'));
update runtime.schemahead set
  migration_head='20260909012000',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:identity',published_at=clock_timestamp()
where artifact='commerce';

do $assert$
declare family_count integer;
begin
  select count(*) into family_count from capability.operation operation
  where operation.operation_id like 'identity.providers.%'
    or operation.operation_id like 'identity.federations.%'
    or operation.operation_id like 'identity.links.%'
    or operation.operation_id like 'organization.directories.%'
    or operation.operation_id like 'organization.directoryevents.%';
  if family_count<>16 then raise exception 'IDENTITY_CONNECTION_OPERATION_COUNT_INVALID:%',family_count; end if;
  if (
    select count(*) from capability.entitlement entitlement
    where entitlement.scope_id='organization-platform-root' and entitlement.state='enabled'
      and (entitlement.capability_id in('identity.federation','identity.directory')
        or entitlement.capability_id in(
          select operation.capability_id from capability.operation operation
          where operation.operation_id like 'identity.providers.%'
            or operation.operation_id like 'identity.federations.%'
            or operation.operation_id like 'identity.links.%'
            or operation.operation_id like 'organization.directories.%'
            or operation.operation_id like 'organization.directoryevents.%'
        ))
  )<>family_count+2 then raise exception 'IDENTITY_CONNECTION_ENTITLEMENT_INCOMPLETE'; end if;
  if exists(
    select 1 from capability.operation operation
    where (operation.operation_id like 'identity.providers.%'
        or operation.operation_id like 'identity.federations.%'
        or operation.operation_id like 'identity.links.%'
        or operation.operation_id like 'organization.directories.%'
        or operation.operation_id like 'organization.directoryevents.%')
      and not exists(
        select 1 from capability.dependency dependency
        where dependency.capability_id=operation.capability_id
          and dependency.depends_on_id=case when operation.operation_id like 'organization.%' then 'identity.directory' else 'identity.federation' end
      )
  ) then raise exception 'IDENTITY_CONNECTION_DEPENDENCY_INCOMPLETE'; end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce'
    and migration_head='20260909012000' and migration_count=(select count(*) from runtime.schemaversion)) then
    raise exception 'IDENTITY_CONNECTION_SCHEMA_HEAD_INVALID';
  end if;
end
$assert$;

commit;
