begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260901015000') then
    raise exception 'STEPUP_DISABLE_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260901016000') then
    raise exception 'STEPUP_DISABLE_CONTRACT_ALREADY_APPLIED';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='3.0.0' and status='active'
      and checksum='0fa65a88e13853d6db30740982d97f58ed37970de3f9c5d5f3e502ab87da38d7'
      and operation_count=271
  ) then
    raise exception 'STEPUP_DISABLE_CONTRACT_PREVIOUS_IDENTITY_INVALID';
  end if;
end $precondition$;

insert into runtime.operation(id,owner,method,path,contract_version)
values('identity.stepup.disable','identity','DELETE','/api/v1/identity/stepup','3.0.0');

insert into capability.capability(id,kind,name,version,status)
values('identity.stepup.disable','operation','identity.stepup.disable',3,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('identity.stepup.disable','identity.stepup.disable','identity.assurance.manage','public');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values(
  'platform:identity.stepup.disable','organization-platform-root',
  'identity.stepup.disable','enabled',null,'1970-01-01T00:00:00Z',null,0
);

alter table runtime.mvpauthority disable row level security;
update runtime.mvpauthority
set checksum=encode(public.digest('packages/contract/definitions/operations.yml:272','sha256'),'hex'),
  expected_count=272,observed_count=272,published_at=clock_timestamp()
where id='mvp:operations';

update runtime.contractcatalog
set checksum='29c753774add43dc7528adc9707c2c2ca3279c7986a93d4c0f6872916d9a7693',
  operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event),
  published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260901016000',4,4,0,0,
  'select id,owner,method,path,contract_version from runtime.operation where id=''identity.stepup.disable'';',
  'select operation_id,capability_id,permission_code,audience from capability.operation where operation_id=''identity.stepup.disable'';'
);

insert into runtime.schemaversion(version,checksum)
values('20260901016000','29c753774add43dc7528adc9707c2c2ca3279c7986a93d4c0f6872916d9a7693');

do $assert$ begin
  if (select count(*) from runtime.operation)<>272 or (select count(*) from capability.operation)<>272 then
    raise exception 'STEPUP_DISABLE_CONTRACT_OPERATION_COUNT_INVALID';
  end if;
  if not exists(
    select 1 from runtime.operation
    where id='identity.stepup.disable' and owner='identity' and method='DELETE'
      and path='/api/v1/identity/stepup' and contract_version='3.0.0'
  ) then
    raise exception 'STEPUP_DISABLE_RUNTIME_OPERATION_INVALID';
  end if;
  if not exists(
    select 1 from capability.operation
    where operation_id='identity.stepup.disable' and capability_id='identity.stepup.disable'
      and permission_code='identity.assurance.manage' and audience='public'
  ) then
    raise exception 'STEPUP_DISABLE_CAPABILITY_OPERATION_INVALID';
  end if;
  if not exists(
    select 1 from capability.entitlement
    where id='platform:identity.stepup.disable' and scope_id='organization-platform-root'
      and capability_id='identity.stepup.disable' and state='enabled'
  ) then
    raise exception 'STEPUP_DISABLE_ENTITLEMENT_INVALID';
  end if;
  if not exists(
    select 1 from runtime.mvpauthority
    where id='mvp:operations' and expected_count=272 and observed_count=272
  ) then
    raise exception 'STEPUP_DISABLE_MVP_AUTHORITY_INVALID';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='3.0.0' and status='active'
      and checksum='29c753774add43dc7528adc9707c2c2ca3279c7986a93d4c0f6872916d9a7693'
      and operation_count=272 and event_count=(select count(*) from runtime.event)
  ) then
    raise exception 'STEPUP_DISABLE_CONTRACT_CATALOG_INVALID';
  end if;
  if not exists(
    select 1 from runtime.schemaversion
    where version='20260901016000'
      and checksum='29c753774add43dc7528adc9707c2c2ca3279c7986a93d4c0f6872916d9a7693'
  ) then
    raise exception 'STEPUP_DISABLE_CONTRACT_HEAD_INVALID';
  end if;
end $assert$;

alter table runtime.mvpauthority enable row level security;
alter table runtime.mvpauthority force row level security;

commit;
