begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903113000') then
    raise exception 'ACCESS_MEMBER_PROJECTION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260903114000') then
    raise exception 'ACCESS_MEMBER_PROJECTION_ALREADY_APPLIED';
  end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0'
    and checksum='9fe623baf3766a8165fae54ff209324619f9fd39a17dfdbfdb927665deb9b42d'
    and operation_count=276 and event_count=103 and status='active') then
    raise exception 'ACCESS_MEMBER_PROJECTION_CONTRACT_INVALID';
  end if;
end
$precondition$;

create table access.memberprofile(
  member_id text primary key,
  display_name text not null check(length(btrim(display_name)) between 1 and 128),
  mobile_masked text,
  source_version bigint not null check(source_version>=0),
  updated_at timestamptz not null default clock_timestamp()
);

insert into access.memberprofile(member_id,display_name,mobile_masked,source_version,updated_at)
select profile.id,profile.display_name,profile.mobile_masked,profile.version,profile.updated_at
from member.profile profile;

alter table access.memberprofile enable row level security;
create policy memberprofileapp on access.memberprofile for all to shopapp using(true) with check(true);
create policy memberprofilejob on access.memberprofile for all to shopjob using(true) with check(true);
revoke all on access.memberprofile from public;
grant select,insert,update on access.memberprofile to shopapp,shopjob;

select runtime.record_migration_evidence(
  '20260903114000',0,0,0,0,
  'select count(*) from access.memberprofile where display_name<>'''';',
  'select count(*) from access.membership membership left join access.memberprofile profile on profile.member_id=membership.member_id where profile.member_id is null;'
);

insert into runtime.schemaversion(version,checksum)
values('20260903114000','0f878582568561601b7c95d7ed69d8f18a06e5740306b6466cffa874eb283e2a');

do $assert$
begin
  if exists(
    select 1 from access.membership membership
    left join access.memberprofile profile on profile.member_id=membership.member_id
    where profile.member_id is null
  ) then raise exception 'ACCESS_MEMBER_PROJECTION_INCOMPLETE'; end if;
  if not has_table_privilege('shopapp','access.memberprofile','SELECT,INSERT,UPDATE')
    or not has_table_privilege('shopjob','access.memberprofile','SELECT,INSERT,UPDATE') then
    raise exception 'ACCESS_MEMBER_PROJECTION_GRANT_INVALID';
  end if;
end
$assert$;

commit;
