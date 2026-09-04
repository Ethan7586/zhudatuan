begin;

alter table catalog.importjob add column cursor_value integer not null default 0;
alter table catalog.importjob add column validation_summary jsonb not null default '{}'::jsonb;
alter table catalog.importjob add column last_error text;
alter table catalog.importjob add column report_object_ref text;
alter table catalog.importjob add column report_sha256 char(64);
alter table catalog.importjob add column report_size bigint;
update catalog.importjob set total_count=greatest(total_count,success_count+failure_count),
  cursor_value=success_count+failure_count,validation_summary=jsonb_build_object('migrated',true,'rows',greatest(total_count,success_count+failure_count));
alter table catalog.importjob drop constraint importjob_state_check;
alter table catalog.importjob add constraint catalog_import_state
  check(state in('uploaded','validating','ready','running','reporting','completed','failed','cancelled'));
alter table catalog.importjob add constraint catalog_import_progress
  check(total_count between 0 and 100000 and cursor_value between 0 and total_count
    and success_count+failure_count<=cursor_value and jsonb_typeof(validation_summary)='object');
alter table catalog.importjob add constraint catalog_import_report
  check((report_object_ref is null and report_sha256 is null and report_size is null)
    or (report_object_ref is not null and report_sha256~'^[0-9a-f]{64}$' and report_size>0));
alter table catalog.importjob add constraint catalog_import_last_error check(last_error is null or length(last_error)<=500);

alter table catalog.importerror add column scope_id text;
update catalog.importerror error set scope_id=job.scope_id from catalog.importjob job where job.id=error.job_id;
alter table catalog.importerror alter column scope_id set not null;

create table catalog.importrow(
  job_id text not null references catalog.importjob(id) on delete cascade,
  scope_id text not null,
  row_number integer not null check(row_number>1),
  payload jsonb not null check(jsonb_typeof(payload)='object' and pg_column_size(payload)<=65536),
  primary key(job_id,row_number)
);
create index catalog_import_work on catalog.importjob(state,updated_at,id)
  where state in('uploaded','validating','ready','running','reporting');

create table inventory.importjob(
  id text primary key,
  scope_id text not null,
  object_ref text not null,
  sha256 char(64) not null check(sha256~'^[0-9a-f]{64}$'),
  state text not null check(state in('uploaded','validating','ready','running','reporting','completed','failed','cancelled')),
  total_count integer not null default 0 check(total_count between 0 and 100000),
  cursor_value integer not null default 0,
  success_count integer not null default 0 check(success_count>=0),
  failure_count integer not null default 0 check(failure_count>=0),
  validation_summary jsonb not null default '{}'::jsonb check(jsonb_typeof(validation_summary)='object'),
  last_error text check(last_error is null or length(last_error)<=500),
  report_object_ref text,
  report_sha256 char(64),
  report_size bigint,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check(cursor_value between 0 and total_count and success_count+failure_count<=cursor_value),
  check((report_object_ref is null and report_sha256 is null and report_size is null)
    or (report_object_ref is not null and report_sha256~'^[0-9a-f]{64}$' and report_size>0))
);
create table inventory.importrow(
  job_id text not null references inventory.importjob(id) on delete cascade,
  scope_id text not null,
  row_number integer not null check(row_number>1),
  payload jsonb not null check(jsonb_typeof(payload)='object' and pg_column_size(payload)<=65536),
  primary key(job_id,row_number)
);
create table inventory.importerror(
  job_id text not null references inventory.importjob(id) on delete cascade,
  scope_id text not null,
  row_number integer not null check(row_number>1),
  reason_code text not null,
  field text,
  detail text not null,
  primary key(job_id,row_number,reason_code)
);
create index inventory_import_work on inventory.importjob(state,updated_at,id)
  where state in('uploaded','validating','ready','running','reporting');

alter table catalog.importrow enable row level security;
alter table inventory.importjob enable row level security;
alter table inventory.importrow enable row level security;
alter table inventory.importerror enable row level security;
drop policy appscope on catalog.importerror;
drop policy jobscope on catalog.importerror;
create policy appscope on catalog.importerror for all to shopapp
  using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on catalog.importerror for all to shopjob using(true) with check(true);
create policy jobscope on catalog.importrow for all to shopjob using(true) with check(true);
create policy appscope on inventory.importjob for all to shopapp
  using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on inventory.importjob for all to shopjob using(true) with check(true);
create policy jobscope on inventory.importrow for all to shopjob using(true) with check(true);
create policy appscope on inventory.importerror for all to shopapp
  using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on inventory.importerror for all to shopjob using(true) with check(true);

grant select,insert,update,delete on inventory.importjob,inventory.importerror to shopapp;
grant select,insert,update,delete on catalog.importrow,inventory.importjob,inventory.importrow,inventory.importerror to shopjob;
revoke all on catalog.importrow,inventory.importrow from shopapp;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('inventory.imports.create','inventory','POST','/api/v1/inventory/imports','1.0.0'),
  ('inventory.imports.read','inventory','GET','/api/v1/inventory/imports','1.0.0');
insert into access.permission(id,code,risk,status) values
  ('permission:799efec930989e90c70be9f5','inventory.import.manage','high','active'),
  ('permission:870d3eaceee68d5caf25c17e','inventory.import.read','low','active');
insert into capability.capability(id,kind,name,version,status) values
  ('inventory.imports.create','operation','inventory.imports.create',1,'active'),
  ('inventory.imports.read','operation','inventory.imports.read',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('inventory.imports.create','inventory.imports.create','inventory.import.manage','operator'),
  ('inventory.imports.read','inventory.imports.read','inventory.import.read','operator');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version) values
  ('platform:inventory.imports.create','organization-platform-root','inventory.imports.create','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:inventory.imports.read','organization-platform-root','inventory.imports.read','enabled',null,'1970-01-01T00:00:00Z',null,0);

update runtime.schemaversion set checksum='8b6c6ef5d992aa39cd8e911987e4802389bdf41b81dc46730c36c1ab99275aa3'
where version='20260821032000';
insert into runtime.schemaversion(version,checksum)
values('20260821052000','67b64b9714f866f879f54dcf900bf6998be2f1d0ba20f84b4e7748a23ac6f647');

do $assert$ begin
  if (select count(*) from runtime.operation)<>204 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821052000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
  if exists(select 1 from catalog.importjob where success_count+failure_count>cursor_value) then raise exception 'CATALOG_IMPORT_PROGRESS_INVALID'; end if;
end $assert$;

commit;
