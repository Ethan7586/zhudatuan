begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260910011000') then
    raise exception 'MEMBER_CODE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260910012000') then
    raise exception 'MEMBER_CODE_ALREADY_APPLIED';
  end if;
  if (select count(*) from runtime.operation)<>385
    or (select count(*) from capability.operation)<>385 then
    raise exception 'MEMBER_CODE_PREVIOUS_REGISTRY_INVALID';
  end if;
  if not exists(select 1 from access.permission where code='verification.issue' and status='active') then
    raise exception 'MEMBER_CODE_PERMISSION_MISSING';
  end if;
end
$precondition$;

alter table verification.session
  add column issued_access_version bigint,
  add column revoked_at timestamptz,
  add column revoke_reason text;

update verification.session session
set issued_access_version=membership.access_version
from access.membership membership
where membership.id=session.issued_by;

update verification.session
set issued_access_version=0
where issued_access_version is null;

update verification.session
set revoked_at=created_at,revoke_reason='migration'
where state='revoked';

alter table verification.session
  alter column issued_access_version set not null,
  add constraint verification_session_access_version check(issued_access_version>=0) not valid,
  add constraint verification_session_revoke_reason check(revoke_reason is null or revoke_reason in('member_action','refreshed','authorization_changed','migration')) not valid,
  add constraint verification_session_revocation check((state='revoked')=(revoked_at is not null and revoke_reason is not null)) not valid;

alter table verification.session validate constraint verification_session_access_version;
alter table verification.session validate constraint verification_session_revoke_reason;
alter table verification.session validate constraint verification_session_revocation;

create index verification_member_code_active
on verification.session(issued_by,created_at desc,id)
where purpose='member_code' and state='issued';

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('verification.membercodes.issue','verification','POST','/api/v1/verifications/member-codes','5.0.0'),
  ('verification.membercodes.revoke','verification','DELETE','/api/v1/verifications/member-codes/{challengeid}','5.0.0');

insert into capability.capability(id,kind,name,version,status) values
  ('verification.membercodes.issue','operation','verification.membercodes.issue',3,'active'),
  ('verification.membercodes.revoke','operation','verification.membercodes.revoke',3,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('verification.membercodes.issue','verification.membercodes.issue','verification.issue','storefront','{storefront,miniapp}'),
  ('verification.membercodes.revoke','verification.membercodes.revoke','verification.issue','storefront','{storefront,miniapp}');

insert into capability.entitlement(
  id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
values
  ('platform:verification.membercodes.issue','organization-platform-root','verification.membercodes.issue','enabled',null,'1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration:verification','membercodepublish'),
  ('platform:verification.membercodes.revoke','organization-platform-root','verification.membercodes.revoke','enabled',null,'1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration:verification','membercodepublish');

insert into capability.entitlementhistory(
  id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select
  'entitlementhistory:'||encode(public.digest(entitlement.id||':20260910012000','sha256'),'hex'),
  entitlement.id,entitlement.scope_id,entitlement.capability_id,entitlement.state,entitlement.quota,
  entitlement.effective_at,entitlement.expires_at,entitlement.version,'migration:verification','membercodepublish',clock_timestamp()
from capability.entitlement entitlement
where entitlement.id in('platform:verification.membercodes.issue','platform:verification.membercodes.revoke');

update capability.capabilityset
set version=version+1,updated_at=clock_timestamp()
where scope_id='organization-platform-root';

update runtime.contractcatalog catalog set
  checksum=fingerprint.checksum,
  operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event where retired_at is null),
  published_at=clock_timestamp()
from (
  select encode(public.digest(
    coalesce((select string_agg(id||chr(31)||owner||chr(31)||method||chr(31)||path||chr(31)||contract_version,chr(30) order by id)
      from runtime.operation),'')
    ||chr(29)||
    coalesce((select string_agg(type||chr(31)||version::text||chr(31)||owner||chr(31)||schema_ref,chr(30) order by type,version)
      from runtime.event where retired_at is null),''),
    'sha256'),'hex') checksum
) fingerprint
where catalog.artifact='commerce' and catalog.version='5.0.0' and catalog.status='active';

select runtime.record_migration_evidence(
  '20260910012000',387,387,0,0,
  'select id,owner,method,path,contract_version from runtime.operation where id like ''verification.membercodes.%'' order by id;',
  'select operation_id,capability_id,permission_code,audience,targets from capability.operation where operation_id like ''verification.membercodes.%'' order by operation_id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260910012000',encode(public.digest('20260910012000_publish_member_code','sha256'),'hex'));

update runtime.schemahead set
  migration_head='20260910012000',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:verification',published_at=clock_timestamp()
where artifact='commerce';

do $assert$
begin
  if (select count(*) from runtime.operation)<>387
    or (select count(*) from capability.operation)<>387 then
    raise exception 'MEMBER_CODE_REGISTRY_INVALID';
  end if;
  if (select count(*) from capability.operation where operation_id like 'verification.membercodes.%'
      and audience='storefront' and targets='{storefront,miniapp}')<>2 then
    raise exception 'MEMBER_CODE_BINDINGS_INVALID';
  end if;
  if (select count(*) from capability.entitlement where scope_id='organization-platform-root'
      and capability_id in('verification.membercodes.issue','verification.membercodes.revoke') and state='enabled')<>2 then
    raise exception 'MEMBER_CODE_ENTITLEMENTS_INVALID';
  end if;
  if exists(select 1 from verification.session where issued_access_version<0
      or (state='revoked')<>(revoked_at is not null and revoke_reason is not null)) then
    raise exception 'MEMBER_CODE_SESSION_INVARIANT_INVALID';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='5.0.0' and status='active'
      and operation_count=387 and event_count=145 and checksum~'^[0-9a-f]{64}$'
  ) then raise exception 'MEMBER_CODE_CONTRACT_INVALID'; end if;
  if not exists(
    select 1 from runtime.schemahead
    where artifact='commerce' and migration_head='20260910012000'
      and migration_count=(select count(*) from runtime.schemaversion)
  ) then raise exception 'MEMBER_CODE_SCHEMA_HEAD_INVALID'; end if;
end
$assert$;

commit;
