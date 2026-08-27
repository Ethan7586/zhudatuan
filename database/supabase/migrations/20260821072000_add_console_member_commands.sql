begin;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('identity.members.manage','identity','PUT','/api/v1/identity/members/{membershipid}','1.0.0'),
  ('identity.password.verify','identity','POST','/api/v1/identity/password/verify','1.0.0');

insert into access.permission(id,code,risk,status)
values('permission:2dc6e91f369d44e7872a8b5c','member.manage','high','active');

insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow' from access.permission permission
where permission.code='member.manage' on conflict do nothing;

insert into capability.capability(id,kind,name,version,status) values
  ('identity.members.manage','operation','identity.members.manage',1,'active'),
  ('identity.password.verify','operation','identity.password.verify',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('identity.members.manage','identity.members.manage','member.manage','operator'),
  ('identity.password.verify','identity.password.verify','identity.assurance.manage','member');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability capability where capability.id in('identity.members.manage','identity.password.verify');

insert into runtime.schemaversion(version,checksum)
values('20260821072000','ae126fdfceef76d61ff83b59f97b2eb9ce8145d67f4a9cc2db99477ef021a766');

do $assert$ begin
  if (select count(*) from runtime.operation)<>217 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if (select count(*) from capability.operation where operation_id in('identity.members.manage','identity.password.verify'))<>2
    then raise exception 'CONSOLE_MEMBER_COMMAND_CONTRACT_MISSING'; end if;
  if not exists(select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
    where mapping.role_id='role-platform-owner-v2' and permission.code='member.manage' and mapping.effect='allow')
    then raise exception 'PLATFORM_OWNER_MEMBER_MANAGE_MISSING'; end if;
end $assert$;

commit;
