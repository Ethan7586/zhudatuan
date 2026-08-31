begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830128000') then
    raise exception 'INVITATION_ERROR_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830129000') then
    raise exception 'INVITATION_ERROR_CONTRACT_ALREADY_APPLIED';
  end if;
end $precondition$;

update runtime.contractcatalog
set checksum='db33b574b89e8bafc35a4dc69fd6197a0baba5d9eff8877e7d4cd8ebb32800cc',
    operation_count=239,event_count=79,published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830129000',1,
  (select count(*) from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active'
    and checksum='db33b574b89e8bafc35a4dc69fd6197a0baba5d9eff8877e7d4cd8ebb32800cc'
    and operation_count=239 and event_count=79),0,0,
  'select artifact,version,checksum,operation_count,event_count,status from runtime.contractcatalog where artifact=''commerce'' and status=''active'';',
  'select version,checksum from runtime.schemaversion where version=''20260830129000'';');
insert into runtime.schemaversion(version,checksum)
values('20260830129000','db33b574b89e8bafc35a4dc69fd6197a0baba5d9eff8877e7d4cd8ebb32800cc');

do $assert$ begin
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active'
    and checksum='db33b574b89e8bafc35a4dc69fd6197a0baba5d9eff8877e7d4cd8ebb32800cc'
    and operation_count=239 and event_count=79) then
    raise exception 'INVITATION_ERROR_CONTRACT_IDENTITY_INVALID';
  end if;
end $assert$;

commit;
