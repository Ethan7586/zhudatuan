begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260909013000') then
    raise exception 'IDENTITY_PROVIDER_READ_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260909014000') then
    raise exception 'IDENTITY_PROVIDER_READ_ALREADY_APPLIED';
  end if;
end
$precondition$;

insert into access.permission(id,code,risk,status)
values('permission:identity.provider.read','identity.provider.read','elevated','active')
on conflict(code) do update set risk=excluded.risk,status=excluded.status;

with source as (
  select mapping.role_id,mapping.effect
  from access.rolepermission mapping
  join access.permission permission on permission.id=mapping.permission_id
  where permission.code='identity.provider.manage'
), target as (
  select id from access.permission where code='identity.provider.read'
)
insert into access.rolepermission(role_id,permission_id,effect)
select source.role_id,target.id,source.effect from source cross join target
on conflict do nothing;

update access.roletemplate set
  allows=array(select distinct permission from unnest(allows||array['identity.provider.read']) permission order by permission),
  version=version+1,
  updated_at=clock_timestamp()
where state='active' and 'identity.provider.manage'=any(allows) and not('identity.provider.read'=any(allows));

update access.roletemplate set
  denies=array(select distinct permission from unnest(denies||array['identity.provider.read']) permission order by permission),
  version=version+1,
  updated_at=clock_timestamp()
where state='active' and 'identity.provider.manage'=any(denies) and not('identity.provider.read'=any(denies));

update capability.operation
set permission_code='identity.provider.read'
where operation_id='identity.providers.center.read';

select runtime.record_migration_evidence(
  '20260909014000',
  (select count(*) from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
    where permission.code='identity.provider.manage'),
  (select count(*) from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
    where permission.code='identity.provider.read'),
  0,0,
  'select operation_id,permission_code from capability.operation where operation_id=''identity.providers.center.read'';',
  'select role.name,mapping.effect from access.rolepermission mapping join access.role role on role.id=mapping.role_id join access.permission permission on permission.id=mapping.permission_id where permission.code=''identity.provider.read'' order by role.name,mapping.effect;'
);

insert into runtime.schemaversion(version,checksum)
values('20260909014000',encode(public.digest('20260909014000_separate_identity_provider_read','sha256'),'hex'));
update runtime.schemahead set
  migration_head='20260909014000',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:identity',published_at=clock_timestamp()
where artifact='commerce';

do $assert$
begin
  if not exists(select 1 from access.permission where code='identity.provider.read' and risk='elevated' and status='active') then
    raise exception 'IDENTITY_PROVIDER_READ_PERMISSION_INVALID';
  end if;
  if not exists(select 1 from capability.operation where operation_id='identity.providers.center.read'
      and permission_code='identity.provider.read') then
    raise exception 'IDENTITY_PROVIDER_READ_BINDING_INVALID';
  end if;
  if exists(
    select 1 from access.rolepermission source
    join access.permission sourcepermission on sourcepermission.id=source.permission_id and sourcepermission.code='identity.provider.manage'
    where not exists(
      select 1 from access.rolepermission target
      join access.permission targetpermission on targetpermission.id=target.permission_id and targetpermission.code='identity.provider.read'
      where target.role_id=source.role_id and target.effect=source.effect
    )
  ) then raise exception 'IDENTITY_PROVIDER_READ_ROLE_GRANT_INCOMPLETE'; end if;
  if exists(select 1 from access.roletemplate where state='active' and 'identity.provider.manage'=any(allows)
      and not('identity.provider.read'=any(allows)))
    or exists(select 1 from access.roletemplate where state='active' and 'identity.provider.manage'=any(denies)
      and not('identity.provider.read'=any(denies))) then
    raise exception 'IDENTITY_PROVIDER_READ_TEMPLATE_INCOMPLETE';
  end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce'
    and migration_head='20260909014000' and migration_count=(select count(*) from runtime.schemaversion)) then
    raise exception 'IDENTITY_PROVIDER_READ_SCHEMA_HEAD_INVALID';
  end if;
end
$assert$;

commit;
