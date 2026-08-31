begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830109000') then
    raise exception 'CAMPAIGN_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830110000') then
    raise exception 'CAMPAIGN_CONTRACT_ALREADY_APPLIED';
  end if;
end $precondition$;

update runtime.contractcatalog
set checksum='9a6311dd85e68365e78c11f138a5d06047163f716e05b5d63ad87f4b905151db',published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830110000',1,
  (select count(*) from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active'
    and checksum='9a6311dd85e68365e78c11f138a5d06047163f716e05b5d63ad87f4b905151db'),0,0,
  'create index concurrently if not exists runtime_contractcatalog_active_live on runtime.contractcatalog(artifact,version,status);',
  'select artifact,version,checksum,status from runtime.contractcatalog where artifact=''commerce'' order by published_at desc;');
insert into runtime.schemaversion(version,checksum)
values('20260830110000','9a6311dd85e68365e78c11f138a5d06047163f716e05b5d63ad87f4b905151db');

do $assert$ begin
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active'
    and checksum='9a6311dd85e68365e78c11f138a5d06047163f716e05b5d63ad87f4b905151db') then
    raise exception 'CAMPAIGN_CONTRACT_CHECKSUM_INVALID';
  end if;
end $assert$;

commit;
