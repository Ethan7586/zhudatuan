begin;

alter table extension.manifest add constraint extension_manifest_identity check(
  id~'^[a-z][a-z0-9]{1,63}$' and version~'^[0-9]+\.[0-9]+\.[0-9]+$' and length(contract_version) between 1 and 128);
alter table extension.manifest add constraint extension_manifest_size check(pg_column_size(manifest)<=65536);
alter table extension.manifest add constraint extension_manifest_hash check(manifest_hash~'^[0-9a-f]{64}$');
alter table extension.manifest add constraint extension_manifest_signature check(length(signature) between 8 and 1024
  and signature~'^[A-Za-z0-9+/]+={0,2}$');
alter table extension.contractversion add constraint extension_contract_hash check(schema_hash~'^[0-9a-f]{64}$');
alter table extension.installation add constraint extension_installation_size check(pg_column_size(manifest)<=65536
  and pg_column_size(endpoints)<=32768 and length(id)<=128 and length(scope_id)<=128);
alter table extension.installation add constraint extension_installation_configuration check(
  length(health_operation) between 1 and 64 and health_operation~'^[a-z][a-z0-9]*$'
  and (base_url is null or (length(base_url)<=2048 and base_url~'^https://'))
  and (secret_ref is null or (length(secret_ref) between 3 and 256 and secret_ref~'^[a-z0-9][a-z0-9/.-]+$')));
alter table extension.health add constraint extension_health_reason check(reason is null or length(reason)<=500);
alter table extension.activationhistory add constraint extension_activation_evidence check(pg_column_size(evidence)<=65536);

update extension.installation set status='disabled' where status='draft';
alter table extension.installation drop constraint installation_status_check;
alter table extension.installation add constraint extension_installation_status
  check(status in('disabled','testing','enabled','degraded'));
alter table extension.installation drop constraint installation_extension_id_scope_id_key;
alter table channel.connection drop constraint connection_provider_scope_id_key;
create unique index extension_installation_enabled on extension.installation(extension_id,scope_id) where status='enabled';
create index extension_installation_healthwork on extension.installation(status,installed_at,id)
  where status in('testing','enabled','degraded');
create index extension_health_latest on extension.health(installation_id,checked_at desc);

do $validate$ begin
  if exists(select 1 from extension.manifest where not (manifest ? 'healthOperation') or manifest->>'healthOperation' is null)
    then raise exception 'EXTENSION_MANIFEST_HEALTH_OPERATION_MISSING'; end if;
  if exists(select 1 from extension.manifest where manifest->>'id'<>id or manifest->>'version'<>version
    or manifest->>'contractVersion'<>contract_version or manifest->>'signature'<>signature)
    then raise exception 'EXTENSION_MANIFEST_STORAGE_INVALID'; end if;
end $validate$;

create or replace function extension.enabled_installations()
returns setof extension.installation language sql stable security definer set search_path=extension,pg_temp as $function$
  select installation.* from extension.installation installation where installation.status='enabled'
  order by installation.extension_id,installation.scope_id,installation.id
$function$;

create or replace function extension.runnable_installations()
returns setof extension.installation language sql stable security definer set search_path=extension,pg_temp as $function$
  select installation.* from extension.installation installation where installation.status in('testing','enabled','degraded')
  order by installation.extension_id,installation.scope_id,installation.id
$function$;

create or replace function extension.load_installation(p_id text,p_scope text)
returns setof extension.installation language sql stable security definer set search_path=extension,access,pg_temp as $function$
  select installation.* from extension.installation installation where installation.id=p_id and installation.scope_id=p_scope
    and installation.status in('testing','enabled','degraded')
    and (session_user='shopjob' or access.scope_allowed(installation.scope_id))
$function$;
revoke all on function extension.load_installation(text,text) from public;
grant execute on function extension.load_installation(text,text) to shopapp,shopjob;

drop policy appscope on extension.manifest;
drop policy jobscope on extension.manifest;
drop policy appscope on extension.contractversion;
drop policy jobscope on extension.contractversion;
drop policy appscope on extension.installation;
drop policy jobscope on extension.installation;
drop policy appscope on extension.health;
drop policy jobscope on extension.health;
drop policy appscope on extension.activationhistory;
drop policy jobscope on extension.activationhistory;

create policy appselect on extension.manifest for select to shopapp using(nullif(current_setting('app.scope_id',true),'') is not null);
create policy jobselect on extension.manifest for select to shopjob using(true);
create policy appselect on extension.contractversion for select to shopapp using(nullif(current_setting('app.scope_id',true),'') is not null);
create policy jobselect on extension.contractversion for select to shopjob using(true);
create policy appselect on extension.installation for select to shopapp using(access.scope_allowed(scope_id));
create policy appinsert on extension.installation for insert to shopapp with check(access.scope_allowed(scope_id));
create policy appupdate on extension.installation for update to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on extension.installation for all to shopjob using(true) with check(true);
create policy appselect on extension.health for select to shopapp using(exists(select 1 from extension.installation installation
  where installation.id=installation_id and access.scope_allowed(installation.scope_id)));
create policy appinsert on extension.health for insert to shopapp with check(exists(select 1 from extension.installation installation
  where installation.id=installation_id and access.scope_allowed(installation.scope_id)));
create policy jobscope on extension.health for all to shopjob using(true) with check(true);
create policy appselect on extension.activationhistory for select to shopapp using(exists(select 1 from extension.installation installation
  where installation.id=installation_id and access.scope_allowed(installation.scope_id)));
create policy appinsert on extension.activationhistory for insert to shopapp with check(exists(select 1 from extension.installation installation
  where installation.id=installation_id and access.scope_allowed(installation.scope_id)));
create policy jobscope on extension.activationhistory for all to shopjob using(true) with check(true);

revoke insert,update,delete on extension.manifest,extension.contractversion from shopapp,shopjob;
revoke delete on extension.installation,extension.health,extension.activationhistory from shopapp;

insert into runtime.event(type,version,owner,schema_ref) values
  ('extension.enabled',1,'extension','contract://events/extension.enabled/v1'),
  ('extension.disabled',1,'extension','contract://events/extension.disabled/v1'),
  ('extension.degraded',1,'extension','contract://events/extension.degraded/v1');

insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
values('job:extensionhealth:scan:bootstrap','extensionhealth','extension',null,'{"scan":true}'::jsonb,'queued',50,
  clock_timestamp(),clock_timestamp(),clock_timestamp());

insert into runtime.schemaversion(version,checksum)
values('20260821051000','43fb0b467c3725e90c451dc245092f689629231e3d986ebf09f8d624ac47ba82');
update runtime.schemaversion set checksum='4e5b827013bcb5b6a436c0e64f40884339c0690a3e37cfe2fdf73e82362cf0b4'
where version='20260821032000';

do $assert$ begin
  if (select count(*) from runtime.operation)<>202 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if (select count(*) from runtime.event)<>57 then raise exception 'EVENT_REGISTRY_COUNT_MISMATCH'; end if;
  if exists(select 1 from extension.installation where status='draft') then raise exception 'EXTENSION_DRAFT_STATE_REMAINS'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821051000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
