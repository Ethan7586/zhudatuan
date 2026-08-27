begin;

alter table audit.record add constraint audit_record_evidence check(jsonb_typeof(evidence)='object' and pg_column_size(evidence)<=262144);

alter table audit.accessrecord add column scope_id text;
update audit.accessrecord set scope_id='organization-platform-root';
alter table audit.accessrecord alter column scope_id set not null;
alter table audit.accessrecord add column actor_type text;
update audit.accessrecord set actor_type='migration';
alter table audit.accessrecord alter column actor_type set not null;
alter table audit.accessrecord add column previous_hash char(64);
alter table audit.accessrecord add column record_hash char(64);
update audit.accessrecord set record_hash=encode(digest(jsonb_build_object('id',id,'scope',scope_id,'actor',actor_id,'actorType',actor_type,
  'resourceType',resource_type,'resource',resource_id,'fields',fields,'purpose',purpose,'trace',trace_id,'previous',previous_hash,
  'accessedAt',accessed_at)::text,'sha256'),'hex');
alter table audit.accessrecord alter column record_hash set not null;
alter table audit.accessrecord add constraint audit_access_fields check(jsonb_typeof(fields)='object' and pg_column_size(fields)<=65536);

alter table audit.archiveref add column scope_id text;
update audit.archiveref set scope_id='organization-platform-root';
alter table audit.archiveref alter column scope_id set not null;
alter table audit.archiveref add column object_size bigint;
update audit.archiveref set object_size=1;
alter table audit.archiveref alter column object_size set not null;
alter table audit.archiveref add constraint audit_archive_objectsize check(object_size>0 and object_size<=67108864);
alter table audit.archiveref add column key_version text;
update audit.archiveref set key_version='legacy';
alter table audit.archiveref alter column key_version set not null;
alter table audit.archiveref add column first_record_hash char(64);
update audit.archiveref set first_record_hash=sha256;
alter table audit.archiveref alter column first_record_hash set not null;
alter table audit.archiveref add column last_record_hash char(64);
update audit.archiveref set last_record_hash=sha256;
alter table audit.archiveref alter column last_record_hash set not null;
alter table audit.archiveref add column through_at timestamptz;
update audit.archiveref set through_at=archived_at;
alter table audit.archiveref alter column through_at set not null;
alter table audit.archiveref add column expires_at timestamptz;
update audit.archiveref set expires_at=archived_at+interval '7 years';
alter table audit.archiveref alter column expires_at set not null;
alter table audit.archiveref add constraint audit_archive_period check(period_start<=period_end and through_at<=archived_at and expires_at>through_at);
alter table audit.archiveref drop constraint archiveref_period_start_period_end_key;
alter table audit.archiveref add constraint audit_archive_identity unique(scope_id,period_start,period_end,last_record_hash);

create table audit.retention(
  scope_id text primary key,
  hot_days integer not null check(hot_days between 1 and 3650),
  archive_years integer not null check(archive_years between 1 and 30),
  legal_hold boolean not null,
  reason text,
  configured_by text not null,
  configured_at timestamptz not null,
  version bigint not null check(version>=0),
  check(not legal_hold or reason is not null)
);
insert into audit.retention(scope_id,hot_days,archive_years,legal_hold,reason,configured_by,configured_at,version)
values('organization-platform-root',90,7,false,null,'migration',clock_timestamp(),0);

create index audit_access_scope_time on audit.accessrecord(scope_id,accessed_at desc,id);
create index audit_archive_scope_time on audit.archiveref(scope_id,through_at desc,id);
create index audit_record_archive on audit.record(scope_id,recorded_at,id);

create or replace function audit.scope_allowed(p_scope text) returns boolean language sql stable security definer
set search_path=audit,access,organization,pg_temp as $function$
  select access.scope_allowed(p_scope) or (
    nullif(current_setting('app.scope_id',true),'')='organization-platform-root'
    and not exists(select 1 from organization.organization where id=p_scope)
  )
$function$;
revoke all on function audit.scope_allowed(text) from public;
grant execute on function audit.scope_allowed(text) to shopapp;

create or replace function audit.reject_mutation() returns trigger language plpgsql security definer
set search_path=audit,pg_temp as $function$
begin
  if tg_op='DELETE' and tg_table_name in('record','recorddefault','accessrecord')
    and (session_user='shopjob' or current_setting('role',true)='shopjob')
    and current_setting('app.workload',true)='jobs' and current_setting('app.audit_archive',true)='true' then return old;
  end if;
  raise exception 'AUDIT_IMMUTABLE';
end
$function$;
revoke all on function audit.reject_mutation() from public;

create trigger immutable before update or delete on audit.record for each row execute function audit.reject_mutation();
create trigger immutable before update or delete on audit.accessrecord for each row execute function audit.reject_mutation();
create trigger immutable before update or delete on audit.archiveref for each row execute function audit.reject_mutation();

drop policy appscope on audit.record;
drop policy appscope on audit.recorddefault;
drop policy appscope on audit.accessrecord;
drop policy appscope on audit.archiveref;
create policy appselect on audit.record for select to shopapp using(audit.scope_allowed(scope_id));
create policy appinsert on audit.record for insert to shopapp with check(audit.scope_allowed(scope_id));
create policy appselect on audit.recorddefault for select to shopapp using(audit.scope_allowed(scope_id));
create policy appinsert on audit.recorddefault for insert to shopapp with check(audit.scope_allowed(scope_id));
create policy appselect on audit.accessrecord for select to shopapp using(audit.scope_allowed(scope_id));
create policy appinsert on audit.accessrecord for insert to shopapp with check(audit.scope_allowed(scope_id));
create policy appselect on audit.archiveref for select to shopapp using(audit.scope_allowed(scope_id));
alter table audit.retention enable row level security;
create policy appselect on audit.retention for select to shopapp using(audit.scope_allowed(scope_id));
create policy jobscope on audit.retention for all to shopjob using(true) with check(true);
grant select,insert,update,delete on audit.retention to shopapp,shopjob;

insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
values('job:auditarchive:bootstrap','auditarchive','audit','organization-platform-root','{}'::jsonb,'queued',80,
  clock_timestamp(),clock_timestamp(),clock_timestamp());

insert into runtime.schemaversion(version,checksum)
values('20260821050000','6931218731741d1f2d46edc10e0c882f4435c58632496c08b72950bc2e5d683e');

do $assert$ begin
  if (select count(*) from runtime.operation)<>202 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if exists(select 1 from pg_policies where schemaname='audit' and tablename in('record','recorddefault','accessrecord','archiveref')
    and roles@>array['shopapp']::name[] and cmd in('UPDATE','DELETE','ALL')) then raise exception 'AUDIT_APP_MUTATION_POLICY_PRESENT'; end if;
  if (select count(*) from pg_trigger where tgname='immutable' and tgrelid in('audit.record'::regclass,'audit.accessrecord'::regclass,
    'audit.archiveref'::regclass) and not tgisinternal)<>3 then raise exception 'AUDIT_IMMUTABILITY_TRIGGER_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821050000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
