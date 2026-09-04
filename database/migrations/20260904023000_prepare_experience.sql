begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904022000') then raise exception 'EXPERIENCE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904023000') then raise exception 'EXPERIENCE_ALREADY_APPLIED'; end if;
end $precondition$;

alter table experience.application add column is_primary boolean not null default false;
update experience.application set is_primary=true;
drop index experience.application_mall_unique;
create unique index application_primary_mall_unique on experience.application(mall_id) where is_primary;
create index application_mall_page on experience.application(mall_id,is_primary desc,updated_at desc,id);

alter table experience.version add column validation_issues jsonb not null default '[]'::jsonb;
alter table experience.version add column publish_evidence jsonb;
alter table experience.version add column frozen_at timestamptz;
alter table experience.version add constraint experience_validation_issues_array check(jsonb_typeof(validation_issues)='array') not valid;
alter table experience.version add constraint experience_publish_evidence_object check(publish_evidence is null or jsonb_typeof(publish_evidence)='object') not valid;
alter table experience.version validate constraint experience_validation_issues_array;
alter table experience.version validate constraint experience_publish_evidence_object;

alter table experience.release add column failed_at timestamptz;
alter table experience.release add column failure_code text;
alter table experience.release add constraint experience_release_failure_consistent check(
  (state='failed' and failed_at is not null and failure_code is not null and retired_at is null)
  or (state<>'failed' and failed_at is null and failure_code is null)
) not valid;

create function experience.canonical_json(value jsonb) returns text language sql immutable strict
set search_path=experience,pg_catalog,pg_temp as $function$
  select case jsonb_typeof(value)
    when 'object' then '{'||coalesce((select string_agg(to_jsonb(item.key)::text||':'||experience.canonical_json(item.value),',' order by item.key collate "C") from jsonb_each(value) item),'')||'}'
    when 'array' then '['||coalesce((select string_agg(experience.canonical_json(item.value),',' order by item.ordinality) from jsonb_array_elements(value) with ordinality item(value,ordinality)),'')||']'
    else value::text
  end
$function$;
revoke all on function experience.canonical_json(jsonb) from public;

with normalized as(
  select version.id,version.application_id,version.configuration,
    coalesce(version.configuration->'theme',jsonb_build_object('preset','shop','primaryColor','#1F5EFF','accentColor','#19A974','logoObjectRef',null,'faviconObjectRef',null)) theme,
    coalesce((select page->>'id' from jsonb_array_elements(version.configuration->'pages') page where page->>'path'='home' limit 1),'home') home
  from experience.version version
), document as(
  select id,configuration||jsonb_build_object(
    'theme',theme,
    'navigation',case when jsonb_typeof(configuration->'navigation')='array' and jsonb_array_length(configuration->'navigation')>0
      then configuration->'navigation' else jsonb_build_array(jsonb_build_object('id',application_id||':navigation:home','label','首页','page',home)) end,
    'assets',case when jsonb_typeof(configuration->'assets')='array' then configuration->'assets' else '[]'::jsonb end
  ) value from normalized
)
update experience.version target set configuration=document.value,
  configuration_hash=encode(public.digest(experience.canonical_json(document.value),'sha256'),'hex'),validation_issues='[]'::jsonb,
  publish_evidence=jsonb_build_object('dependencies',jsonb_build_object(
    'catalog',jsonb_build_object('ready',true,'version','cutover:20260904023000'),
    'marketing',jsonb_build_object('ready',true,'version','cutover:20260904023000'),
    'pool',jsonb_build_object('ready',true,'version','cutover:20260904023000'),
    'qualification',jsonb_build_object('ready',true,'version','cutover:20260904023000'),
    'pricing',jsonb_build_object('ready',true,'version','cutover:20260904023000'),
    'inventory',jsonb_build_object('ready',true,'version','cutover:20260904023000'),
    'resources',jsonb_build_object('ready',true,'version','cutover:20260904023000'),
    'domain',jsonb_build_object('ready',true,'version','cutover:20260904023000'),
    'capabilities',jsonb_build_object('ready',true,'version','cutover:20260904023000'),
    'channel',jsonb_build_object('ready',true,'version','cutover:20260904023000')),'issues','[]'::jsonb)
from document where document.id=target.id;

update experience.version version set frozen_at=source.frozen_at
from(select version_id,min(effective_at) frozen_at from experience.release group by version_id) source
where source.version_id=version.id;

update experience.release set failed_at=coalesce(failed_at,effective_at),failure_code=coalesce(failure_code,'EXPERIENCE_PUBLICATION_FAILED'),retired_at=null
where state='failed';
alter table experience.release validate constraint experience_release_failure_consistent;

create function experience.guard_application() returns trigger language plpgsql security definer
set search_path=experience,pg_temp set row_security=off as $function$
begin
  if new.version<1 then raise exception 'EXPERIENCE_APPLICATION_VERSION_INVALID'; end if;
  if tg_op='UPDATE' then
    if (new.id,new.mall_id,new.code,new.public_slug,new.is_primary,new.created_at)
      is distinct from (old.id,old.mall_id,old.code,old.public_slug,old.is_primary,old.created_at)
      then raise exception 'EXPERIENCE_APPLICATION_IDENTITY_IMMUTABLE'; end if;
    if new.version<>old.version+1 then raise exception 'EXPERIENCE_APPLICATION_VERSION_CONFLICT'; end if;
  end if;
  return new;
end
$function$;
create trigger experienceapplicationguard before insert or update on experience.application for each row execute function experience.guard_application();

create function experience.guard_version() returns trigger language plpgsql security definer
set search_path=experience,pg_temp set row_security=off as $function$
begin
  if new.schema_version<>'2' or jsonb_typeof(new.validation_issues)<>'array'
    or (new.publish_evidence is not null and jsonb_typeof(new.publish_evidence)<>'object')
    or new.configuration_hash<>encode(public.digest(experience.canonical_json(new.configuration),'sha256'),'hex')
    then raise exception 'EXPERIENCE_VERSION_INVALID'; end if;
  if new.frozen_at is not null and (new.validation_state<>'valid' or jsonb_array_length(new.validation_issues)>0 or new.publish_evidence is null)
    then raise exception 'EXPERIENCE_VERSION_NOT_VALID'; end if;
  if tg_op='UPDATE' then
    if old.frozen_at is not null and new is distinct from old then raise exception 'EXPERIENCE_VERSION_FROZEN'; end if;
    if (new.id,new.application_id,new.sequence,new.schema_version,new.configuration,new.configuration_hash,new.reason,new.source_version_id,new.created_by,new.created_at)
      is distinct from (old.id,old.application_id,old.sequence,old.schema_version,old.configuration,old.configuration_hash,old.reason,old.source_version_id,old.created_by,old.created_at)
      then raise exception 'EXPERIENCE_VERSION_IMMUTABLE'; end if;
  end if;
  return new;
end
$function$;
create trigger experienceversionguard before insert or update on experience.version for each row execute function experience.guard_version();

create function experience.guard_release() returns trigger language plpgsql security definer
set search_path=experience,pg_temp set row_security=off as $function$
begin
  if tg_op='INSERT' and new.state<>'scheduled' then raise exception 'EXPERIENCE_RELEASE_INITIAL_STATE_INVALID'; end if;
  if tg_op='UPDATE' then
    if (new.id,new.application_id,new.version_id,new.pool_id,new.effective_at,new.published_by)
      is distinct from (old.id,old.application_id,old.version_id,old.pool_id,old.effective_at,old.published_by)
      then raise exception 'EXPERIENCE_RELEASE_IDENTITY_IMMUTABLE'; end if;
    if old.state='retired' and new is distinct from old then raise exception 'EXPERIENCE_RELEASE_RETIRED'; end if;
    if old.state='active' and new.state not in('active','retired') then raise exception 'EXPERIENCE_RELEASE_TRANSITION_INVALID'; end if;
    if old.state in('scheduled','failed') and new.state not in('scheduled','failed','active','retired') then raise exception 'EXPERIENCE_RELEASE_TRANSITION_INVALID'; end if;
  end if;
  return new;
end
$function$;
create trigger experiencereleaseguard before insert or update on experience.release for each row execute function experience.guard_release();
revoke all on function experience.guard_application(),experience.guard_version(),experience.guard_release() from public;

create or replace function experience.read_published(p_mall text)
returns table(release text,version text,hash text,document jsonb,effective_at timestamptz,object_key text)
language sql stable security definer set search_path=experience,access,pg_temp set row_security=off as $function$
  select release.id,version.id,publication.content_hash,version.configuration,release.effective_at,publication.object_key
  from experience.application application
  join experience.release release on release.application_id=application.id and release.state='active' and release.effective_at<=clock_timestamp()
  join experience.publication publication on publication.release_id=release.id and publication.state='active'
  join experience.version version on version.id=release.version_id and version.validation_state='valid' and version.frozen_at is not null
  where application.mall_id=p_mall and access.scope_allowed(p_mall)
  order by application.is_primary desc,release.effective_at desc,release.id desc limit 1
$function$;
revoke all on function experience.read_published(text) from public;
grant execute on function experience.read_published(text) to shopapp;

insert into runtime.operation(id,owner,method,path,contract_version)
values('experience.published.read','experience','GET','/api/v1/experiences/published','5.0.0');
insert into capability.capability(id,kind,name,version,status)
values('experience.published.read','operation','experience.published.read',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience,targets)
values('experience.published.read','experience.published.read',null,'public',array['console','storefront','miniapp','store','supplier']);
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
values('platform:experience.published.read','organization-platform-root','experience.published.read','enabled',null,'1970-01-01T00:00:00Z',null,1,
  clock_timestamp(),clock_timestamp(),'migration:experience','公开端读取不可变发布快照');

delete from runtime.event where type='experience.published';
insert into runtime.event(type,version,owner,schema_ref) values
  ('experience.release.requested',1,'experience','contract://events/experience.release.requested/v1'),
  ('experience.release.activated',1,'experience','contract://events/experience.release.activated/v1'),
  ('experience.release.failed',1,'experience','contract://events/experience.release.failed/v1');
update capability.capability set version=2 where id in('experience.applications.create','experience.applications.copy',
  'experience.applications.detail.read','experience.applications.read','experience.applications.update','experience.versions.save',
  'experience.versions.validate','experience.versions.publish','experience.versions.restore');

update runtime.contractcatalog set checksum='b82031cafdbbf4ced316d9c7db474cf94ccc78ffaa94946b4a27e819e50b550b',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence('20260904023000',(select count(*) from experience.version),(select count(*) from experience.version),0,0,
  'create index concurrently if not exists experience_application_mall_live on experience.application(mall_id,is_primary desc,updated_at desc,id);',
  'select state,count(*) from experience.release group by state;');
insert into runtime.schemaversion(version,checksum)
values('20260904023000','b82031cafdbbf4ced316d9c7db474cf94ccc78ffaa94946b4a27e819e50b550b');

do $assert$ begin
  if exists(select mall_id from experience.application where is_primary group by mall_id having count(*)<>1) then raise exception 'EXPERIENCE_PRIMARY_APPLICATION_INVALID'; end if;
  if exists(select 1 from experience.version where configuration_hash<>encode(public.digest(experience.canonical_json(configuration),'sha256'),'hex')) then raise exception 'EXPERIENCE_VERSION_HASH_INVALID'; end if;
  if exists(select 1 from experience.release where state in('scheduled','active','retired') and failure_code is not null) then raise exception 'EXPERIENCE_RELEASE_FAILURE_INVALID'; end if;
  if (select count(*) from runtime.operation)<>308 then raise exception 'EXPERIENCE_OPERATION_COUNT_INVALID'; end if;
  if (select count(*) from runtime.event)<>135 then raise exception 'EXPERIENCE_EVENT_COUNT_INVALID'; end if;
end $assert$;

commit;
