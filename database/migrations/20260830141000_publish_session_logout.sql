begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830140000') then
    raise exception 'SESSION_LOGOUT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830141000') then
    raise exception 'SESSION_LOGOUT_ALREADY_APPLIED';
  end if;
end $precondition$;

update runtime.contractcatalog
set checksum='5afc19b0699f67af2feca5fd51238eced326c86fd17bc41742a8e05682e7723f',
    operation_count=(select count(*) from runtime.operation),
    event_count=(select count(*) from runtime.event),
    published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830141000',1,1,0,0,
  'select id,method,path from runtime.operation where id=''identity.session.delete'';',
  'select operation_id,permission_code,audience from capability.operation where operation_id=''identity.session.delete'';');
insert into runtime.schemaversion(version,checksum)
values('20260830141000','5afc19b0699f67af2feca5fd51238eced326c86fd17bc41742a8e05682e7723f');

do $assert$ begin
  if not exists(select 1 from runtime.operation where id='identity.session.delete' and method='DELETE') then
    raise exception 'SESSION_LOGOUT_OPERATION_MISSING';
  end if;
  if not exists(select 1 from runtime.contractcatalog
    where artifact='commerce' and version='3.0.0' and status='active'
      and checksum='5afc19b0699f67af2feca5fd51238eced326c86fd17bc41742a8e05682e7723f'
      and operation_count=(select count(*) from runtime.operation)
      and event_count=(select count(*) from runtime.event)) then
    raise exception 'SESSION_LOGOUT_CONTRACT_IDENTITY_INVALID';
  end if;
end $assert$;

commit;
