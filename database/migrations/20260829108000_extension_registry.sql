begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829107000') then raise exception 'EXTENSION_REGISTRY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829108000') or to_regclass('extension.registry') is not null then
    raise exception 'EXTENSION_REGISTRY_ALREADY_APPLIED';
  end if;
end $precondition$;

create temporary table extension_reconcile on commit drop as
select count(*)::bigint rows,0::numeric minor from extension.installation where status='enabled';
create table extension.registry(
  extension_id text not null,
  scope_id text not null,
  installation_id text not null unique references extension.installation(id),
  extension_version text not null,
  installation_version bigint not null check(installation_version>=0),
  state text not null check(state in('enabled','degraded')),
  generation bigint not null check(generation>0),
  activated_at timestamptz not null,
  primary key(extension_id,scope_id)
);
insert into extension.registry(extension_id,scope_id,installation_id,extension_version,installation_version,state,generation,activated_at)
select extension_id,scope_id,id,extension_version,version,'enabled',1,installed_at from extension.installation where status='enabled';
alter table extension.registry add constraint extension_registry_version check(extension_version~'^[0-9]+\.[0-9]+\.[0-9]+$') not valid;
alter table extension.registry validate constraint extension_registry_version;

create or replace function extension.sync_registry() returns trigger language plpgsql security definer set search_path=extension,pg_temp as $function$
begin
  if new.status='enabled' then
    insert into extension.registry(extension_id,scope_id,installation_id,extension_version,installation_version,state,generation,activated_at)
    values(new.extension_id,new.scope_id,new.id,new.extension_version,new.version,'enabled',1,clock_timestamp())
    on conflict(extension_id,scope_id) do update set installation_id=excluded.installation_id,
      extension_version=excluded.extension_version,installation_version=excluded.installation_version,state='enabled',
      generation=extension.registry.generation+1,activated_at=clock_timestamp();
  elsif new.status='degraded' then
    update extension.registry set state='degraded',installation_version=new.version,generation=generation+1
      where extension_id=new.extension_id and scope_id=new.scope_id and installation_id=new.id;
  else
    delete from extension.registry where extension_id=new.extension_id and scope_id=new.scope_id and installation_id=new.id;
  end if;
  return new;
end $function$;
create trigger extension_registry_sync after insert or update of status on extension.installation
for each row execute function extension.sync_registry();
create index extension_registry_state on extension.registry(state,extension_id,scope_id,generation);
alter table extension.registry enable row level security;
create policy appselect on extension.registry for select to shopapp using(access.scope_allowed(scope_id));
create policy jobselect on extension.registry for select to shopjob using(true);
grant select on extension.registry to shopapp,shopjob;

create or replace function extension.enabled_installations()
returns setof extension.installation language sql stable security definer set search_path=extension,pg_temp as $function$
  select installation.* from extension.registry registry join extension.installation installation on installation.id=registry.installation_id
  where registry.state='enabled' and installation.status='enabled'
  order by registry.extension_id,registry.scope_id,registry.generation
$function$;

select runtime.record_migration_evidence('20260829108000',(select rows from extension_reconcile),(select count(*) from extension.registry),0,0,
  'create index concurrently if not exists extension_registry_state_live on extension.registry(state,extension_id,scope_id,generation);',
  'select extension_id,scope_id from extension.registry where state<>''enabled'';');
insert into runtime.schemaversion(version,checksum)
values('20260829108000',encode(public.digest('20260829108000_extension_registry','sha256'),'hex'));

commit;
