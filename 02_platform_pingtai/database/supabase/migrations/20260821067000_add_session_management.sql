begin;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('identity.sessions.read','identity','GET','/api/v1/identity/sessions','1.0.0'),
  ('identity.sessions.revoke','identity','DELETE','/api/v1/identity/sessions/{sessionid}','1.0.0');

insert into runtime.event(type,version,owner,schema_ref) values
  ('identity.session.revoked',1,'identity','contract://events/identity.session.revoked/v1');

insert into capability.capability(id,kind,name,version,status) values
  ('identity.sessions.read','operation','identity.sessions.read',1,'active'),
  ('identity.sessions.revoke','operation','identity.sessions.revoke',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('identity.sessions.read','identity.sessions.read','identity.session.read','member'),
  ('identity.sessions.revoke','identity.sessions.revoke','identity.session.manage','member');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability capability where capability.id in('identity.sessions.read','identity.sessions.revoke');

update runtime.schemaversion
set checksum='cac9aaa3a85150c86f63a47c498086d5fa9596575e0d6c350d329ce14ef2cd92'
where version='20260821032000';

insert into runtime.schemaversion(version,checksum)
values('20260821067000','657944c5fd55c8cd221a4efc33747c3f3ef4d2fb9ca8cc70be0f70bd491393d6');

do $assert$ begin
  if (select count(*) from runtime.operation)<>212 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if (select count(*) from runtime.event)<>58 then raise exception 'EVENT_REGISTRY_COUNT_MISMATCH'; end if;
  if (select count(*) from capability.operation where operation_id in('identity.sessions.read','identity.sessions.revoke'))<>2
    then raise exception 'SESSION_OPERATION_CONTRACT_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260821032000' and checksum='cac9aaa3a85150c86f63a47c498086d5fa9596575e0d6c350d329ce14ef2cd92')
  then raise exception 'RUNTIME_CONTRACT_CHECKSUM_MISMATCH'; end if;
end $assert$;

commit;
