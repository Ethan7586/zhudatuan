begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830139000') then
    raise exception 'CARD_LIBRARY_CREATION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830140000') then
    raise exception 'CARD_LIBRARY_CREATION_ALREADY_APPLIED';
  end if;
end $precondition$;

update runtime.contractcatalog
set checksum='522cf5f43192e6295d72acddb5dd6a9ce57633f22517efab4455ebe9412c07d0',
    operation_count=(select count(*) from runtime.operation),
    event_count=(select count(*) from runtime.event),
    published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830140000',1,1,0,0,
  'select id,method,path from runtime.operation where id=''voucher.cardlibraries.create'';',
  'select operation_id,permission_code,audience from capability.operation where operation_id=''voucher.cardlibraries.create'';');
insert into runtime.schemaversion(version,checksum)
values('20260830140000','522cf5f43192e6295d72acddb5dd6a9ce57633f22517efab4455ebe9412c07d0');

do $assert$ begin
  if not exists(select 1 from runtime.operation where id='voucher.cardlibraries.create' and method='POST') then
    raise exception 'CARD_LIBRARY_CREATION_OPERATION_MISSING';
  end if;
  if not exists(select 1 from runtime.contractcatalog
    where artifact='commerce' and version='3.0.0' and status='active'
      and checksum='522cf5f43192e6295d72acddb5dd6a9ce57633f22517efab4455ebe9412c07d0'
      and operation_count=(select count(*) from runtime.operation)
      and event_count=(select count(*) from runtime.event)) then
    raise exception 'CARD_LIBRARY_CREATION_CONTRACT_IDENTITY_INVALID';
  end if;
end $assert$;

commit;
