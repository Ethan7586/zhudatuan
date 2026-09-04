begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904046000') then raise exception 'IDEAL_EXPERIENCE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904047000') then raise exception 'IDEAL_EXPERIENCE_ALREADY_APPLIED'; end if;
end
$precondition$;

create table experience.releasehead(
  id text primary key check(id~'^releasehead:'),
  tenant_id text not null,
  scope_id text not null,
  application_id text not null unique,
  release_id text not null unique,
  version_id text not null,
  publication_id text not null,
  theme text not null check(theme in('quietorder','easterngallery','warmworkshop')),
  component_schema_version integer not null check(component_schema_version>0),
  content_hash char(64) not null check(content_hash~'^[0-9a-f]{64}$'),
  configuration_hash char(64) not null check(configuration_hash~'^[0-9a-f]{64}$'),
  version bigint not null check(version>0),
  published_by text not null,
  published_at timestamptz not null,
  updated_at timestamptz not null check(updated_at>=published_at)
);
alter table experience.releasehead enable row level security;
alter table experience.releasehead force row level security;
create policy releaseheadapp on experience.releasehead for select to shopapp using(access.scope_allowed(scope_id));
create policy releaseheadjob on experience.releasehead for all to shopjob using(true) with check(true);
revoke all on experience.releasehead from public;
grant select on experience.releasehead to shopapp;
grant select,insert,update,delete on experience.releasehead to shopjob;

select runtime.record_migration_evidence('20260904047000',
  (select count(*) from experience.release),(select count(*) from experience.release),0,0,
  'select application_id,state,count(*) from experience.release group by application_id,state;',
  'select application_id,release_id,version_id,theme,content_hash,configuration_hash from experience.releasehead order by application_id;');
insert into runtime.schemaversion(version,checksum)
values('20260904047000',encode(public.digest('20260904047000_prepare_experience_release','sha256'),'hex'));

do $assert$
begin
  if exists(select mall_id from experience.application where is_primary group by mall_id having count(*)>1)
    then raise exception 'IDEAL_EXPERIENCE_PRIMARY_DUPLICATE'; end if;
end
$assert$;

commit;
