begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903115000') then
    raise exception 'CONTRACT_IDENTITY_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260903116000') then
    raise exception 'CONTRACT_IDENTITY_ALREADY_APPLIED';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='5.0.0'
      and checksum='9fe623baf3766a8165fae54ff209324619f9fd39a17dfdbfdb927665deb9b42d'
      and operation_count=276 and event_count=103 and status='active'
  ) then raise exception 'CONTRACT_IDENTITY_PREVIOUS_CONTRACT_INVALID'; end if;
end
$precondition$;

update runtime.contractcatalog
set checksum='f43f53b4befd83bf6944f60c48ec823d5ecf113ed42de69613e3ba599a0d2782',
  operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event),
  published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260903116000',0,0,0,0,
  'select artifact,version,checksum,operation_count,event_count,status from runtime.contractcatalog where artifact=''commerce'' and status=''active'';',
  'select count(*) operation_count from runtime.operation; select count(*) event_count from runtime.event;'
);

insert into runtime.schemaversion(version,checksum)
values('20260903116000','f43f53b4befd83bf6944f60c48ec823d5ecf113ed42de69613e3ba599a0d2782');

do $assert$
begin
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='5.0.0'
      and checksum='f43f53b4befd83bf6944f60c48ec823d5ecf113ed42de69613e3ba599a0d2782'
      and operation_count=276 and event_count=103 and status='active'
  ) then raise exception 'CONTRACT_IDENTITY_CATALOG_INVALID'; end if;
  if (select count(*) from runtime.operation)<>276
    or (select count(*) from capability.operation)<>276
    or (select count(*) from runtime.event)<>103 then
    raise exception 'CONTRACT_IDENTITY_REGISTRY_INVALID';
  end if;
end
$assert$;

commit;
