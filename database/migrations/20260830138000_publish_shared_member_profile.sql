begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830137000') then
    raise exception 'SHARED_MEMBER_PROFILE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830138000') then
    raise exception 'SHARED_MEMBER_PROFILE_ALREADY_APPLIED';
  end if;
end $precondition$;

update capability.operation
set audience='public'
where operation_id='member.profile.read';

delete from access.rolepermission mapping
using access.permission permission
where mapping.role_id='role-platform-owner-v2' and mapping.permission_id=permission.id
  and permission.code='member.profile.read' and mapping.effect='deny';
insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow' from access.permission permission
where permission.code='member.profile.read' and permission.status='active'
on conflict do nothing;

update runtime.contractcatalog
set checksum='247152906e06893ee9188c249e53a644990894773bed202636f7d12f403cd032',
    operation_count=(select count(*) from runtime.operation),
    event_count=(select count(*) from runtime.event),
    published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830138000',1,1,0,0,
  'select operation_id,permission_code,audience from capability.operation where operation_id=''member.profile.read'';',
  'select mapping.role_id,permission.code from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id where mapping.role_id=''role-platform-owner-v2'' and permission.code=''member.profile.read'' and mapping.effect=''allow'';');
insert into runtime.schemaversion(version,checksum)
values('20260830138000','247152906e06893ee9188c249e53a644990894773bed202636f7d12f403cd032');

do $assert$ begin
  if not exists(select 1 from capability.operation where operation_id='member.profile.read' and audience='public') then
    raise exception 'SHARED_MEMBER_PROFILE_AUDIENCE_INVALID';
  end if;
  if not exists(select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
    where mapping.role_id='role-platform-owner-v2' and permission.code='member.profile.read' and mapping.effect='allow')
    or not exists(select 1 from capability.entitlement entitlement where entitlement.scope_id='organization-platform-root'
      and entitlement.capability_id='member.profile.read' and entitlement.state='enabled') then
    raise exception 'SHARED_MEMBER_PROFILE_CONSOLE_CAPABILITY_MISSING';
  end if;
  if not exists(select 1 from runtime.contractcatalog
    where artifact='commerce' and version='3.0.0' and status='active'
      and checksum='247152906e06893ee9188c249e53a644990894773bed202636f7d12f403cd032'
      and operation_count=(select count(*) from runtime.operation)
      and event_count=(select count(*) from runtime.event)) then
    raise exception 'SHARED_MEMBER_PROFILE_CONTRACT_IDENTITY_INVALID';
  end if;
end $assert$;

commit;
