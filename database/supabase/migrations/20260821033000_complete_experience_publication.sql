begin;

create table experience.publication(
  id text primary key,
  release_id text not null unique references experience.release(id),
  application_id text not null references experience.application(id),
  version_id text not null references experience.version(id),
  content_hash char(64) not null check(content_hash~'^[0-9a-f]{64}$'),
  object_key text not null unique check(object_key~'^experience/[A-Za-z0-9:.-]+/[0-9a-f]{64}\.json$'),
  object_ref text not null,
  object_hash char(64) not null check(object_hash~'^[0-9a-f]{64}$' and object_hash=content_hash),
  object_size bigint not null check(object_size>0),
  state text not null check(state in('staged','active','retired','failed')),
  staged_at timestamptz not null,
  published_at timestamptz,
  failure_code text,
  unique(application_id,content_hash),
  check((state='active' and published_at is not null and failure_code is null) or state<>'active')
);
create unique index experience_publication_active on experience.publication(application_id) where state='active';
alter table experience.publication enable row level security;
create policy appscope on experience.publication for all to shopapp
  using(exists(select 1 from experience.application where application.id=experience.publication.application_id and access.scope_allowed(application.scope_id)))
  with check(exists(select 1 from experience.application where application.id=experience.publication.application_id and access.scope_allowed(application.scope_id)));
create policy jobscope on experience.publication for all to shopjob using(true) with check(true);

grant select,insert,update,delete on experience.publication to shopapp,shopjob;

create or replace function experience.read_published(p_mall text)
returns table(release text,version text,hash text,document jsonb,effective_at timestamptz,object_key text)
language sql stable security definer set search_path=experience,pg_temp as $function$
  select release.id,version.id,publication.content_hash,version.configuration,release.effective_at,publication.object_key
  from experience.binding binding
  join experience.release release on release.application_id=binding.application_id and release.state='active' and release.effective_at<=clock_timestamp()
  join experience.publication publication on publication.release_id=release.id and publication.state='active'
  join experience.version version on version.id=publication.version_id and version.validation_state='valid'
  where binding.mall_id=p_mall
  order by release.effective_at desc,release.id desc limit 1
$function$;
revoke all on function experience.read_published(text) from public,anon,authenticated,service_role;
grant execute on function experience.read_published(text) to shopapp;

insert into runtime.schemaversion(version,checksum)
values('20260821033000','93fd551300bbebcb1e4cfdd351177c234b094eb44d1012d4a976aa7d6992015b');

do $assert$
begin
  if to_regclass('experience.publication') is null then raise exception 'EXPERIENCE_PUBLICATION_MISSING'; end if;
  if to_regprocedure('experience.read_published(text)') is null then raise exception 'EXPERIENCE_PUBLIC_READER_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821033000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
