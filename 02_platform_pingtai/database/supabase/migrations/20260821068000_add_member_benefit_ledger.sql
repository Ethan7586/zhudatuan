begin;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('benefit.ledgers.read','benefit','GET','/api/v1/benefits/ledgers','1.0.0');

insert into capability.capability(id,kind,name,version,status) values
  ('benefit.ledgers.read','operation','benefit.ledgers.read',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('benefit.ledgers.read','benefit.ledgers.read','benefit.read','member');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:benefit.ledgers.read','organization-platform-root','benefit.ledgers.read','enabled',null,'1970-01-01T00:00:00Z',null,0);

update runtime.schemaversion
set checksum='c9f089402eefa212060cf98278586e129be31a53ec7ee3ae8fea34f7bea05c6e'
where version='20260821032000';

insert into runtime.schemaversion(version,checksum)
values('20260821068000','288080e602c99c9fb5aed9eb76969f2ef46b9924711361f99a26b28f1dfa5f4a');

do $assert$ begin
  if (select count(*) from runtime.operation)<>213 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if (select count(*) from capability.operation where operation_id='benefit.ledgers.read')<>1
    then raise exception 'BENEFIT_LEDGER_OPERATION_CONTRACT_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260821032000' and checksum='c9f089402eefa212060cf98278586e129be31a53ec7ee3ae8fea34f7bea05c6e')
  then raise exception 'RUNTIME_CONTRACT_CHECKSUM_MISMATCH'; end if;
end $assert$;

commit;
