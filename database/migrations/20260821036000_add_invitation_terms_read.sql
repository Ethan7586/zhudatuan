begin;

insert into runtime.operation(id,owner,method,path,contract_version)
values('identity.invitations.read','identity','POST','/api/v1/identity/invitations/resolve','1.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;

insert into capability.capability(id,kind,name,version,status)
values('identity.invitations.read','operation','identity.invitations.read',1,'active')
on conflict(id) do update set status=excluded.status;

insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('identity.invitations.read','identity.invitations.read',null,'public')
on conflict(operation_id) do update set capability_id=excluded.capability_id,permission_code=null,audience='public';

insert into runtime.schemaversion(version,checksum)
values('20260821036000','4cdd6d184f0b8fe669d532d5cf941bd18fcdc7a69b1b932be7a7fd75ccce0092');

do $assert$
begin
  if (select count(*) from runtime.operation)<>154 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if not exists(select 1 from capability.operation where operation_id='identity.invitations.read' and audience='public') then
    raise exception 'INVITATION_TERMS_CAPABILITY_MISSING';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821036000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
