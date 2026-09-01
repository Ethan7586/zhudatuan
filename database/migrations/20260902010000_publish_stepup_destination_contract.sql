begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260901016000') then
    raise exception 'STEPUP_DESTINATION_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902010000') then
    raise exception 'STEPUP_DESTINATION_CONTRACT_ALREADY_APPLIED';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='3.0.0' and status='active'
      and checksum='29c753774add43dc7528adc9707c2c2ca3279c7986a93d4c0f6872916d9a7693'
      and operation_count=272
  ) then
    raise exception 'STEPUP_DESTINATION_CONTRACT_PREVIOUS_IDENTITY_INVALID';
  end if;
  if exists(select 1 from runtime.errorcontract where code='STEPUP_DESTINATION_MISSING') then
    raise exception 'STEPUP_DESTINATION_ERROR_ALREADY_PUBLISHED';
  end if;
end
$precondition$;

insert into runtime.errorcontract(code,status,retryable,audit,client,contract_version)
values('STEPUP_DESTINATION_MISSING',409,false,false,'message','3.0.0');

update runtime.contractcatalog
set checksum='73f5a4cee3d961c6ab72aa92bfbc3c1ba688c3427a5d01b2017347f24ca6ad95',
  operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event),
  published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260902010000',1,1,0,0,
  'select code,status,retryable,audit,client,contract_version from runtime.errorcontract where code=''STEPUP_DESTINATION_MISSING'';',
  'select artifact,version,checksum,operation_count,event_count,status from runtime.contractcatalog where artifact=''commerce'' and status=''active'';'
);

insert into runtime.schemaversion(version,checksum)
values('20260902010000','73f5a4cee3d961c6ab72aa92bfbc3c1ba688c3427a5d01b2017347f24ca6ad95');

do $assert$
begin
  if not exists(
    select 1 from runtime.errorcontract
    where code='STEPUP_DESTINATION_MISSING' and status=409 and not retryable and not audit
      and client='message' and contract_version='3.0.0'
  ) then
    raise exception 'STEPUP_DESTINATION_ERROR_CONTRACT_INVALID';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='3.0.0' and status='active'
      and checksum='73f5a4cee3d961c6ab72aa92bfbc3c1ba688c3427a5d01b2017347f24ca6ad95'
      and operation_count=272 and event_count=(select count(*) from runtime.event)
  ) then
    raise exception 'STEPUP_DESTINATION_CONTRACT_CATALOG_INVALID';
  end if;
  if not exists(
    select 1 from runtime.schemaversion
    where version='20260902010000'
      and checksum='73f5a4cee3d961c6ab72aa92bfbc3c1ba688c3427a5d01b2017347f24ca6ad95'
  ) then
    raise exception 'STEPUP_DESTINATION_CONTRACT_HEAD_INVALID';
  end if;
end
$assert$;

commit;
