begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830124000') then raise exception 'ACCESS_OVERRIDE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260830125000') then raise exception 'ACCESS_OVERRIDE_ALREADY_APPLIED'; end if;
end $precondition$;

insert into runtime.operation(id,owner,method,path,contract_version)
values('access.overrides.manage','access','PUT','/api/v1/access/overrides','3.0.0');

update runtime.operation
set path='/api/v1/access/scopes',contract_version='3.0.0'
where id='access.scopes.manage' and owner='access' and method='PUT';

insert into access.permission(id,code,risk,status)
values('permission:059051505f79a95e7e0e8791','access.override.manage','critical','active')
on conflict(code) do update set risk=excluded.risk,status='active';

insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow' from access.role role cross join access.permission permission
where role.kind='owner' and role.status='active' and permission.code='access.override.manage'
on conflict do nothing;

insert into capability.capability(id,kind,name,version,status)
values('access.overrides.manage','operation','access.overrides.manage',3,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('access.overrides.manage','access.overrides.manage','access.override.manage','console');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:access.overrides.manage','organization-platform-root','access.overrides.manage','enabled',null,
  '1970-01-01T00:00:00Z',null,0);

update runtime.contractcatalog
set checksum='3274474003b8deeb444452c9a9e832486093f47c8a25e7854a2005b9af8889e2',
  operation_count=239,event_count=79,published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830125000',1,
  (select count(*) from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active'
    and checksum='3274474003b8deeb444452c9a9e832486093f47c8a25e7854a2005b9af8889e2'
    and operation_count=239 and event_count=79),0,0,
  'create index concurrently if not exists access_override_permission_live on access.membershipoverride(permission_id,membership_id) where revoked_at is null;',
  'select membership_id,permission_id,effect,effective_at,expires_at,revoked_at from access.membershipoverride order by membership_id,permission_id;');
insert into runtime.schemaversion(version,checksum)
values('20260830125000','3274474003b8deeb444452c9a9e832486093f47c8a25e7854a2005b9af8889e2');

do $assert$ begin
  if not exists(select 1 from runtime.operation where id='access.overrides.manage' and owner='access')
    or not exists(select 1 from runtime.operation where id='access.scopes.manage' and owner='access'
      and method='PUT' and path='/api/v1/access/scopes' and contract_version='3.0.0')
    or not exists(select 1 from access.permission where code='access.override.manage' and status='active')
    or not exists(select 1 from capability.operation where operation_id='access.overrides.manage'
      and permission_code='access.override.manage' and audience='console') then
    raise exception 'ACCESS_OVERRIDE_CONTRACT_INVALID';
  end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active'
    and checksum='3274474003b8deeb444452c9a9e832486093f47c8a25e7854a2005b9af8889e2'
    and operation_count=239 and event_count=79) then raise exception 'ACCESS_OVERRIDE_CONTRACT_IDENTITY_INVALID'; end if;
end $assert$;

commit;
