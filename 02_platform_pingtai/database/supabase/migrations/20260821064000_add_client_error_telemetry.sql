begin;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('observability.clienterrors.create','observability','POST','/api/v1/telemetry/clienterrors','1.0.0'),
  ('observability.clienterrors.read','observability','GET','/api/v1/telemetry/clienterrors','1.0.0');

insert into access.permission(id,code,risk,status) values
  ('permission:80a5c4f355e7258b2f1d5e0b','observability.clienterror.create','low','active'),
  ('permission:47f136b76d214b9c70f60866','observability.clienterror.read','high','active');

insert into access.rolepermission(role_id,permission_id,effect)
select 'role:self',permission.id,'allow' from access.permission permission
where permission.code='observability.clienterror.create'
on conflict do nothing;

insert into access.rolepermission(role_id,permission_id,effect)
select existing.role_id,permission.id,'allow'
from access.rolepermission existing
join access.permission auditpermission on auditpermission.id=existing.permission_id and auditpermission.code='audit.read'
cross join access.permission permission
where existing.effect='allow' and permission.code='observability.clienterror.read'
on conflict do nothing;

insert into capability.capability(id,kind,name,version,status) values
  ('observability.clienterrors.create','operation','observability.clienterrors.create',1,'active'),
  ('observability.clienterrors.read','operation','observability.clienterrors.read',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('observability.clienterrors.create','observability.clienterrors.create','observability.clienterror.create','member'),
  ('observability.clienterrors.read','observability.clienterrors.read','observability.clienterror.read','operator');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability capability where capability.id in('observability.clienterrors.create','observability.clienterrors.read');

update runtime.schemaversion
set checksum='a8a931fd7c85ae7436ca2fee8f9807ed0a92e75d02c42b6a72055f4f5197b6cb'
where version='20260821032000';

insert into runtime.schemaversion(version,checksum)
values('20260821064000','c20637b6c25d59c267307bb1baa374635516119901ba9fad4c71f6abcce1f0db');

do $assert$ begin
  if (select count(*) from runtime.operation)<>208 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if (select count(*) from capability.operation where operation_id like 'observability.clienterrors.%')<>2
    then raise exception 'CLIENT_ERROR_OPERATION_CONTRACT_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260821032000' and checksum='a8a931fd7c85ae7436ca2fee8f9807ed0a92e75d02c42b6a72055f4f5197b6cb')
  then raise exception 'RUNTIME_CONTRACT_CHECKSUM_MISMATCH'; end if;
end $assert$;

commit;
