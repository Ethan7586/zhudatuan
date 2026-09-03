begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903100000') then
    raise exception 'AUTH_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260903101000') then
    raise exception 'AUTH_CONTRACT_ALREADY_APPLIED';
  end if;
  if (select count(*) from runtime.operation)<>275
    or (select count(*) from capability.operation)<>275
    or (select count(*) from runtime.event)<>103 then
    raise exception 'AUTH_CONTRACT_REGISTRY_INVALID';
  end if;
end
$precondition$;

select runtime.record_migration_evidence(
  '20260903101000',275,275,0,0,
  'select id,owner,method,path,contract_version from runtime.operation where id=''identity.bootstrap.read'';',
  'select artifact,version,checksum,operation_count,event_count,status from runtime.contractcatalog where artifact=''commerce'' and status=''active'';'
);

insert into runtime.schemaversion(version,checksum)
values('20260903101000','ccf1d79041d4174d9b0fa77bfcbc925dbbd60e10965e27ee089782d986ad998c');

do $assert$
begin
  if not exists(
    select 1 from runtime.operation operation
    join capability.operation binding on binding.operation_id=operation.id
    join capability.capability capability on capability.id=binding.capability_id
    where operation.id='identity.bootstrap.read' and operation.owner='identity'
      and operation.method='GET' and operation.path='/api/v1/identity/bootstrap'
      and operation.contract_version='4.0.0' and binding.permission_code is null
      and binding.audience='public' and capability.kind='operation' and capability.status='active'
  ) then
    raise exception 'AUTH_BOOTSTRAP_CONTRACT_INVALID';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='4.0.0' and status='active'
      and checksum='bf156c5335a436a72f803cda376fc8f26bc3a037bc7e17b0204187d7065fef29'
      and operation_count=275 and event_count=103
  ) then
    raise exception 'AUTH_CONTRACT_CATALOG_INVALID';
  end if;
  if not exists(
    select 1 from runtime.schemaversion
    where version='20260903101000'
      and checksum='ccf1d79041d4174d9b0fa77bfcbc925dbbd60e10965e27ee089782d986ad998c'
  ) then
    raise exception 'AUTH_CONTRACT_IDENTITY_INVALID';
  end if;
end
$assert$;

commit;
