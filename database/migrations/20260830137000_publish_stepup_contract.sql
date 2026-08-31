begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830136000') then
    raise exception 'STEPUP_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830137000') then
    raise exception 'STEPUP_CONTRACT_ALREADY_APPLIED';
  end if;
end $precondition$;

update runtime.contractcatalog
set checksum='89484d2685bfe4ec8faf0e04efeec8ab8b729473fbc481d85bb9e8c37d8008d1',
    operation_count=(select count(*) from runtime.operation),
    event_count=(select count(*) from runtime.event),
    published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830137000',2,2,0,0,
  'select id from runtime.operation where id in(''identity.stepup.start'',''identity.stepup.complete'') order by id;',
  'select artifact,version,checksum,operation_count,event_count from runtime.contractcatalog where artifact=''commerce'' and status=''active'';');
insert into runtime.schemaversion(version,checksum)
values('20260830137000','89484d2685bfe4ec8faf0e04efeec8ab8b729473fbc481d85bb9e8c37d8008d1');

do $assert$ begin
  if (select count(*) from runtime.operation where id in('identity.stepup.start','identity.stepup.complete'))<>2 then
    raise exception 'STEPUP_CONTRACT_OPERATION_MISSING';
  end if;
  if not exists(select 1 from runtime.contractcatalog
    where artifact='commerce' and version='3.0.0' and status='active'
      and checksum='89484d2685bfe4ec8faf0e04efeec8ab8b729473fbc481d85bb9e8c37d8008d1'
      and operation_count=(select count(*) from runtime.operation)
      and event_count=(select count(*) from runtime.event)) then
    raise exception 'STEPUP_CONTRACT_IDENTITY_INVALID';
  end if;
end $assert$;

commit;
