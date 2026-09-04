begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904031000') then raise exception 'EXTENSION_CONFIGURATION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904031100') then raise exception 'EXTENSION_CONFIGURATION_ALREADY_APPLIED'; end if;
  if exists(select 1 from runtime.jobs where kind='extensionhealth' and state='running') then raise exception 'EXTENSION_HEALTH_DRAIN_REQUIRED'; end if;
  if exists(
    select 1 from extension.installation where not(
      manifest ?& array['id','version','contractVersion','dependencies','capabilities','configSchema','permissions','secretRefs']
      and jsonb_typeof(manifest->'dependencies')='array'
      and jsonb_typeof(manifest->'capabilities')='array' and jsonb_array_length(manifest->'capabilities')>0
      and jsonb_typeof(manifest->'permissions')='array' and jsonb_array_length(manifest->'permissions')>0
      and jsonb_typeof(manifest->'secretRefs')='array'
    )
  ) then raise exception 'EXTENSION_INSTALLATION_MANIFEST_HARDCUT_REQUIRED'; end if;
end
$precondition$;

create temporary table extension_configuration_before on commit drop as
select count(*) rows_count,coalesce(sum(version),0) version_sum from extension.installation;

alter table extension.installation add column configuration_version bigint not null default 0;
alter table extension.installation add constraint extension_installation_configuration_version check(configuration_version>=0);
alter table extension.installation add constraint extension_installation_manifest_contract check(
  manifest ?& array['id','version','contractVersion','dependencies','capabilities','configSchema','permissions','secretRefs']
  and jsonb_typeof(manifest->'dependencies')='array'
  and jsonb_typeof(manifest->'capabilities')='array' and jsonb_array_length(manifest->'capabilities')>0
  and jsonb_typeof(manifest->'permissions')='array' and jsonb_array_length(manifest->'permissions')>0
  and jsonb_typeof(manifest->'secretRefs')='array'
);

create function extension.guard_installation() returns trigger language plpgsql
set search_path=pg_catalog,extension as $function$
declare configuration_changed boolean; configuration_update boolean;
begin
  if new.base_url is not null and(new.base_url!~'^https://' or new.base_url~'^https://[^/]*@' or position('?' in new.base_url)>0 or position('#' in new.base_url)>0)
    then raise exception 'EXTENSION_BASE_URL_INVALID'; end if;
  if exists(
    select 1 from jsonb_each(new.endpoints) endpoint
    where endpoint.key~*'(secret|password|credential|token|privatekey|apikey|authorization)'
      or jsonb_typeof(endpoint.value)<>'string'
      or endpoint.value#>>'{}'!~'^/' or endpoint.value#>>'{}'~'^//'
      or position('?' in endpoint.value#>>'{}')>0 or position('#' in endpoint.value#>>'{}')>0
  ) then raise exception 'EXTENSION_ENDPOINT_CONFIGURATION_INVALID'; end if;
  if new.secret_ref is not null and new.secret_ref!~'^[a-z0-9][a-z0-9/.-]{2,255}$' then raise exception 'EXTENSION_SECRET_REFERENCE_INVALID'; end if;
  if tg_op='INSERT' then return new; end if;
  if (new.id,new.extension_id,new.extension_version,new.scope_id,new.manifest,new.installed_at) is distinct from
    (old.id,old.extension_id,old.extension_version,old.scope_id,old.manifest,old.installed_at)
    then raise exception 'EXTENSION_INSTALLATION_IDENTITY_IMMUTABLE'; end if;
  if new.version<>old.version+1 then raise exception 'EXTENSION_INSTALLATION_VERSION_INVALID'; end if;
  configuration_changed := (new.base_url,new.endpoints,new.secret_ref,new.health_operation) is distinct from
    (old.base_url,old.endpoints,old.secret_ref,old.health_operation);
  configuration_update := new.configuration_version=old.configuration_version+1;
  if configuration_update then
    if old.status<>'disabled' or new.status<>'disabled'
      then raise exception 'EXTENSION_CONFIGURATION_CAS_INVALID'; end if;
  elsif new.configuration_version<>old.configuration_version or configuration_changed then
    raise exception 'EXTENSION_CONFIGURATION_VERSION_INVALID';
  end if;
  if new.status<>old.status and not(
    old.status='disabled' and new.status='testing'
    or old.status='testing' and new.status in('enabled','degraded','disabled')
    or old.status='enabled' and new.status in('degraded','disabled')
    or old.status='degraded' and new.status in('testing','enabled','disabled')
  ) then raise exception 'EXTENSION_INSTALLATION_TRANSITION_INVALID'; end if;
  if new.status=old.status and not configuration_update then raise exception 'EXTENSION_INSTALLATION_NOOP_INVALID'; end if;
  if new.status<>old.status and configuration_update then raise exception 'EXTENSION_CONFIGURATION_TRANSITION_CONFLICT'; end if;
  return new;
end
$function$;

create trigger extension_installation_guard before insert or update on extension.installation
for each row execute function extension.guard_installation();

revoke all on function extension.guard_installation() from public;

select runtime.record_migration_evidence('20260904031100',before.rows_count,after.rows_count,0,0,
  'select id,status,configuration_version,version from extension.installation order by id;',
  'select installation_id,sequence,next_state,evidence from extension.activationhistory order by installation_id,sequence;')
from extension_configuration_before before cross join(
  select count(*) rows_count,coalesce(sum(version),0) version_sum from extension.installation
) after where before.version_sum=after.version_sum;

insert into runtime.schemaversion(version,checksum)
values('20260904031100',encode(public.digest('20260904031100_guard_extension_configuration','sha256'),'hex'));

do $assert$
begin
  if not exists(select 1 from information_schema.columns where table_schema='extension' and table_name='installation' and column_name='configuration_version' and is_nullable='NO')
    then raise exception 'EXTENSION_CONFIGURATION_VERSION_MISSING'; end if;
  if (select count(*) from pg_trigger where tgrelid='extension.installation'::regclass and tgname='extension_installation_guard' and not tgisinternal)<>1
    then raise exception 'EXTENSION_INSTALLATION_GUARD_MISSING'; end if;
  if exists(select 1 from extension.installation where configuration_version<0 or manifest->>'id'<>extension_id or manifest->>'version'<>extension_version)
    then raise exception 'EXTENSION_INSTALLATION_CONTRACT_INVALID'; end if;
end
$assert$;

commit;
