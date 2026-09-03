begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903106000') then
    raise exception 'REPORTING_CATEGORY_HARD_CUT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260903107000') then
    raise exception 'REPORTING_CATEGORY_HARD_CUT_ALREADY_APPLIED';
  end if;
  if (select count(*) from runtime.operation)<>275
    or (select count(*) from capability.operation)<>275
    or (select count(*) from runtime.event)<>103 then
    raise exception 'REPORTING_CATEGORY_HARD_CUT_REGISTRY_INVALID';
  end if;
end
$precondition$;

alter table runtime.operation drop constraint runtime_operation_contract_v4;

delete from reporting.fact where metric_id='powderclass.amount';
delete from reporting.metric where id='powderclass.amount';
delete from capability.entitlement where capability_id='reporting.powderclass.read';
delete from capability.dependency where capability_id='reporting.powderclass.read' or depends_on_id='reporting.powderclass.read';
delete from capability.operation where operation_id='reporting.powderclass.read';
delete from capability.capability where id='reporting.powderclass.read';
delete from access.rolepermission where permission_id in(select id from access.permission where code='reporting.powderclass.read');
delete from access.permission where code='reporting.powderclass.read';
delete from runtime.operation where id='reporting.powderclass.read';

update runtime.operation set contract_version='5.0.0' where contract_version<>'5.0.0';
alter table runtime.operation add constraint runtime_operation_contract_v5 check(contract_version='5.0.0') not valid;
alter table runtime.operation validate constraint runtime_operation_contract_v5;

update runtime.contractcatalog set status='retired' where artifact='commerce' and status='active';
insert into runtime.contractcatalog(artifact,version,checksum,operation_count,event_count,status,published_at)
values('commerce','5.0.0','f16857a88b6e47eee536d8bb268a1bcd1edf82fb160b5a90a6faef4212b22d4a',274,103,'active',clock_timestamp());

select runtime.record_migration_evidence(
  '20260903107000',274,274,0,0,
  'delete from reporting.fact where metric_id=''powderclass.amount''; delete from reporting.metric where id=''powderclass.amount'';',
  'select id,owner,method,path,contract_version from runtime.operation where owner=''reporting'' order by id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260903107000','f16857a88b6e47eee536d8bb268a1bcd1edf82fb160b5a90a6faef4212b22d4a');

do $assert$
begin
  if (select count(*) from runtime.operation)<>274
    or (select count(*) from capability.operation)<>274
    or (select count(*) from runtime.event)<>103 then
    raise exception 'REPORTING_CATEGORY_HARD_CUT_COUNT_INVALID';
  end if;
  if exists(select 1 from runtime.operation where contract_version<>'5.0.0') then
    raise exception 'REPORTING_CATEGORY_HARD_CUT_VERSION_INVALID';
  end if;
  if exists(select 1 from runtime.operation where id='reporting.powderclass.read')
    or exists(select 1 from capability.capability where id='reporting.powderclass.read')
    or exists(select 1 from access.permission where code='reporting.powderclass.read')
    or exists(select 1 from reporting.metric where id='powderclass.amount') then
    raise exception 'REPORTING_CATEGORY_HARD_CUT_ACTIVE_REFERENCE_REMAINS';
  end if;
  if not exists(select 1 from reporting.metric where id='category.amount') then
    raise exception 'REPORTING_CATEGORY_METRIC_MISSING';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='5.0.0' and checksum='f16857a88b6e47eee536d8bb268a1bcd1edf82fb160b5a90a6faef4212b22d4a'
      and operation_count=274 and event_count=103 and status='active'
  ) then
    raise exception 'REPORTING_CATEGORY_HARD_CUT_CONTRACT_INVALID';
  end if;
end
$assert$;

commit;
