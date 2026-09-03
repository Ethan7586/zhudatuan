begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903104000') then
    raise exception 'INVITATION_ACCOUNT_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260903105000') then
    raise exception 'INVITATION_ACCOUNT_CONTRACT_ALREADY_APPLIED';
  end if;
  if (select count(*) from runtime.operation)<>275
    or (select count(*) from capability.operation)<>275
    or (select count(*) from runtime.event)<>103 then
    raise exception 'INVITATION_ACCOUNT_CONTRACT_REGISTRY_INVALID';
  end if;
end
$precondition$;

update runtime.contractcatalog
set checksum='9a1e724a268763789c5ff9e870a5ca499ef812f3a838513ef213f50223231801',
  operation_count=275,published_at=clock_timestamp()
where artifact='commerce' and version='4.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260903105000',275,275,0,0,
  'select id,owner,method,path,contract_version from runtime.operation where id=''identity.invitations.read'';',
  'select artifact,version,checksum,operation_count,event_count,status from runtime.contractcatalog where artifact=''commerce'' and status=''active'';'
);

insert into runtime.schemaversion(version,checksum)
values('20260903105000','9a1e724a268763789c5ff9e870a5ca499ef812f3a838513ef213f50223231801');

do $assert$
begin
  if not exists(
    select 1 from runtime.operation
    where id='identity.invitations.read' and owner='identity' and method='GET'
      and path='/api/v1/identity/invitations' and contract_version='4.0.0'
  ) then
    raise exception 'INVITATION_ACCOUNT_OPERATION_INVALID';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='4.0.0' and status='active'
      and checksum='9a1e724a268763789c5ff9e870a5ca499ef812f3a838513ef213f50223231801'
      and operation_count=275 and event_count=103
  ) then
    raise exception 'INVITATION_ACCOUNT_CONTRACT_CATALOG_INVALID';
  end if;
  if not exists(
    select 1 from runtime.schemaversion
    where version='20260903105000'
      and checksum='9a1e724a268763789c5ff9e870a5ca499ef812f3a838513ef213f50223231801'
  ) then
    raise exception 'INVITATION_ACCOUNT_CONTRACT_IDENTITY_INVALID';
  end if;
end
$assert$;

commit;
