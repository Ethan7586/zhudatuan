begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903103000') then
    raise exception 'ORGANIZATION_LABEL_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260903104000') then
    raise exception 'ORGANIZATION_LABEL_CONTRACT_ALREADY_APPLIED';
  end if;
  if (select count(*) from runtime.operation)<>275
    or (select count(*) from capability.operation)<>275
    or (select count(*) from runtime.event)<>103 then
    raise exception 'ORGANIZATION_LABEL_CONTRACT_REGISTRY_INVALID';
  end if;
end
$precondition$;

update runtime.contractcatalog
set checksum='bbef05ea5f447e575590131054c0f391681002a9b4a20ab4c9f80364b155d436',
  operation_count=275,published_at=clock_timestamp()
where artifact='commerce' and version='4.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260903104000',275,275,0,0,
  'select id,owner,method,path,contract_version from runtime.operation where id=''organization.layers.read'';',
  'select artifact,version,checksum,operation_count,event_count,status from runtime.contractcatalog where artifact=''commerce'' and status=''active'';'
);

insert into runtime.schemaversion(version,checksum)
values('20260903104000','bbef05ea5f447e575590131054c0f391681002a9b4a20ab4c9f80364b155d436');

do $assert$
begin
  if not exists(
    select 1 from runtime.operation
    where id='organization.layers.read' and owner='organization' and method='GET'
      and path='/api/v1/organizations/layers' and contract_version='4.0.0'
  ) then
    raise exception 'ORGANIZATION_LABEL_OPERATION_INVALID';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='4.0.0' and status='active'
      and checksum='bbef05ea5f447e575590131054c0f391681002a9b4a20ab4c9f80364b155d436'
      and operation_count=275 and event_count=103
  ) then
    raise exception 'ORGANIZATION_LABEL_CONTRACT_CATALOG_INVALID';
  end if;
  if not exists(
    select 1 from runtime.schemaversion
    where version='20260903104000'
      and checksum='bbef05ea5f447e575590131054c0f391681002a9b4a20ab4c9f80364b155d436'
  ) then
    raise exception 'ORGANIZATION_LABEL_CONTRACT_IDENTITY_INVALID';
  end if;
end
$assert$;

commit;
