begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260901012000') then
    raise exception 'MOBILE_CHALLENGE_CONTRACT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260901013000') then
    raise exception 'MOBILE_CHALLENGE_CONTRACT_ALREADY_APPLIED';
  end if;
  if not exists(
    select 1 from runtime.schemaversion
    where version='20260831046000'
      and checksum='a9846680ce3534a98a0e2c44b2050a0b3bb2c1fba3413da8675e757a922ccb8d'
  ) then
    raise exception 'MOBILE_CHALLENGE_CONTRACT_PREVIOUS_IDENTITY_INVALID';
  end if;
end $precondition$;

insert into runtime.operation(id,owner,method,path,contract_version)
values('identity.mobile.challenges.create','identity','POST','/api/v1/identity/mobile/challenges','3.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,
  contract_version=excluded.contract_version;

insert into capability.capability(id,kind,name,version,status)
values('identity.mobile.challenges.create','operation','identity.mobile.challenges.create',3,'active')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,version=excluded.version,status=excluded.status;

insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('identity.mobile.challenges.create','identity.mobile.challenges.create','identity.assurance.manage','public')
on conflict(operation_id) do update set capability_id=excluded.capability_id,
  permission_code=excluded.permission_code,audience=excluded.audience;

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values(
  'platform:identity.mobile.challenges.create','organization-platform-root',
  'identity.mobile.challenges.create','enabled',null,'1970-01-01T00:00:00Z',null,0
)
on conflict(id) do update set scope_id=excluded.scope_id,capability_id=excluded.capability_id,
  state=excluded.state,quota=excluded.quota,effective_at=excluded.effective_at,
  expires_at=excluded.expires_at,version=excluded.version;

alter table runtime.mvpauthority disable row level security;
update runtime.mvpauthority
set checksum=encode(public.digest('packages/contract/definitions/operations.yml:270','sha256'),'hex'),
  expected_count=270,observed_count=270,published_at=clock_timestamp()
where id='mvp:operations';
alter table runtime.mvpauthority enable row level security;
alter table runtime.mvpauthority force row level security;

update runtime.contractcatalog
set checksum='b6a6803d866fe082b61511eb434b3223e027162f805f47505745113624a96390',
  operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event),
  published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260901013000',4,4,0,0,
  'select id,owner,method,path,contract_version from runtime.operation where id=''identity.mobile.challenges.create'';',
  'select operation_id,capability_id,permission_code,audience from capability.operation where operation_id=''identity.mobile.challenges.create'';'
);

insert into runtime.schemaversion(version,checksum)
values('20260901013000','b6a6803d866fe082b61511eb434b3223e027162f805f47505745113624a96390');

do $assert$ begin
  if (select count(*) from runtime.operation)<>270 or (select count(*) from capability.operation)<>270 then
    raise exception 'MOBILE_CHALLENGE_CONTRACT_OPERATION_COUNT_INVALID';
  end if;
  if not exists(
    select 1 from runtime.operation
    where id='identity.mobile.challenges.create' and owner='identity' and method='POST'
      and path='/api/v1/identity/mobile/challenges' and contract_version='3.0.0'
  ) then
    raise exception 'MOBILE_CHALLENGE_RUNTIME_OPERATION_INVALID';
  end if;
  if not exists(
    select 1 from capability.operation
    where operation_id='identity.mobile.challenges.create'
      and capability_id='identity.mobile.challenges.create'
      and permission_code='identity.assurance.manage' and audience='public'
  ) then
    raise exception 'MOBILE_CHALLENGE_CAPABILITY_OPERATION_INVALID';
  end if;
  if not exists(
    select 1 from capability.entitlement
    where id='platform:identity.mobile.challenges.create' and scope_id='organization-platform-root'
      and capability_id='identity.mobile.challenges.create' and state='enabled'
  ) then
    raise exception 'MOBILE_CHALLENGE_ENTITLEMENT_INVALID';
  end if;
  if not exists(
    select 1 from runtime.mvpauthority
    where id='mvp:operations' and expected_count=270 and observed_count=270
  ) then
    raise exception 'MOBILE_CHALLENGE_MVP_AUTHORITY_INVALID';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='3.0.0' and status='active'
      and checksum='b6a6803d866fe082b61511eb434b3223e027162f805f47505745113624a96390'
      and operation_count=270 and event_count=(select count(*) from runtime.event)
  ) then
    raise exception 'MOBILE_CHALLENGE_CONTRACT_CATALOG_INVALID';
  end if;
  if not exists(
    select 1 from runtime.schemaversion
    where version='20260901013000'
      and checksum='b6a6803d866fe082b61511eb434b3223e027162f805f47505745113624a96390'
  ) then
    raise exception 'MOBILE_CHALLENGE_CONTRACT_HEAD_INVALID';
  end if;
end $assert$;

commit;
