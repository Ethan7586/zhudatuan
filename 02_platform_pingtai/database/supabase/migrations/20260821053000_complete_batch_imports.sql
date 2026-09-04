begin;

alter table member.importjob alter column cursor_value type integer
  using coalesce(nullif(cursor_value,''),'0')::integer;
update member.importjob set total_count=greatest(total_count,success_count+failure_count),
  cursor_value=greatest(cursor_value,success_count+failure_count);
alter table member.importjob alter column cursor_value set default 0;
alter table member.importjob alter column cursor_value set not null;
alter table member.importjob add column validation_summary jsonb not null default '{}'::jsonb;
alter table member.importjob add column last_error text;
alter table member.importjob add column report_object_ref text;
alter table member.importjob add column report_sha256 char(64);
alter table member.importjob add column report_size bigint;
alter table member.importjob drop constraint importjob_state_check;
alter table member.importjob add constraint member_import_state
  check(state in('uploaded','validating','ready','running','reporting','completed','failed','cancelled'));
alter table member.importjob add constraint member_import_progress
  check(total_count between 0 and 100000 and cursor_value between 0 and total_count
    and success_count+failure_count<=cursor_value and jsonb_typeof(validation_summary)='object');
alter table member.importjob add constraint member_import_report
  check((report_object_ref is null and report_sha256 is null and report_size is null)
    or (report_object_ref is not null and report_sha256~'^[0-9a-f]{64}$' and report_size>0));
alter table member.importjob add constraint member_import_last_error check(last_error is null or length(last_error)<=500);
create table member.importrow(
  job_id text not null references member.importjob(id) on delete cascade,
  organization_id text not null,
  row_number integer not null check(row_number>1),
  payload jsonb not null check(jsonb_typeof(payload)='object' and pg_column_size(payload)<=8192),
  primary key(job_id,row_number)
);
create index member_import_work on member.importjob(state,updated_at,id)
  where state in('uploaded','validating','ready','running','reporting');

alter table voucher.importjob add column cursor_value integer not null default 0;
alter table voucher.importjob add column validation_summary jsonb not null default '{}'::jsonb;
alter table voucher.importjob add column last_error text;
alter table voucher.importjob add column report_object_ref text;
alter table voucher.importjob add column report_sha256 char(64);
alter table voucher.importjob add column report_size bigint;
alter table voucher.importjob drop constraint importjob_state_check;
alter table voucher.importjob add constraint voucher_import_state
  check(state in('uploaded','validating','ready','running','reporting','completed','failed','cancelled'));
alter table voucher.importjob add constraint voucher_import_progress
  check(total_count between 0 and 100000 and cursor_value between 0 and total_count
    and success_count+failure_count<=cursor_value and jsonb_typeof(validation_summary)='object');
alter table voucher.importjob add constraint voucher_import_report
  check((report_object_ref is null and report_sha256 is null and report_size is null)
    or (report_object_ref is not null and report_sha256~'^[0-9a-f]{64}$' and report_size>0));
alter table voucher.importjob add constraint voucher_import_last_error check(last_error is null or length(last_error)<=500);
alter table voucher.importerror add column field text;
create table voucher.importrow(
  job_id text not null references voucher.importjob(id) on delete cascade,
  scope_id text not null,
  row_number integer not null check(row_number>1),
  code_ciphertext text,
  code_fingerprint char(64) check(code_fingerprint~'^[0-9a-f]{64}$'),
  code_key_version text,
  error_code text,
  primary key(job_id,row_number),
  unique(job_id,code_fingerprint),
  check((error_code is null and code_ciphertext is not null and code_fingerprint is not null and code_key_version is not null)
    or (error_code is not null and code_ciphertext is null and code_fingerprint is null and code_key_version is null))
);
create index voucher_import_work on voucher.importjob(state,updated_at,id)
  where state in('uploaded','validating','ready','running','reporting');

alter table member.importrow enable row level security;
alter table voucher.importrow enable row level security;
create policy jobscope on member.importrow for all to shopjob using(true) with check(true);
create policy jobscope on voucher.importrow for all to shopjob using(true) with check(true);
grant select,insert,update,delete on member.importrow,voucher.importrow to shopjob;
revoke all on member.importrow,voucher.importrow from shopapp;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('member.imports.read','member','GET','/api/v1/members/imports/{importid}','1.0.0'),
  ('voucher.imports.read','voucher','GET','/api/v1/vouchers/imports/{importid}','1.0.0');
insert into capability.capability(id,kind,name,version,status) values
  ('member.imports.read','operation','member.imports.read',1,'active'),
  ('voucher.imports.read','operation','voucher.imports.read',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('member.imports.read','member.imports.read','member.import','operator'),
  ('voucher.imports.read','voucher.imports.read','voucher.cardlibrary.read','operator');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version) values
  ('platform:member.imports.read','organization-platform-root','member.imports.read','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:voucher.imports.read','organization-platform-root','voucher.imports.read','enabled',null,'1970-01-01T00:00:00Z',null,0);

update runtime.schemaversion set checksum='5de419de47e41b59539a99fcf0b9630857de014c937ef97178dddb08d4b0d640'
where version='20260821032000';
insert into runtime.schemaversion(version,checksum)
values('20260821053000','bfa2e8523fec7be54f85d8394c1d9605428955ca28bfd3f4a25806293a765ef1');

do $assert$ begin
  if (select count(*) from runtime.operation)<>206 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821053000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
  if exists(select 1 from member.importjob where success_count+failure_count>cursor_value) then raise exception 'MEMBER_IMPORT_PROGRESS_INVALID'; end if;
  if exists(select 1 from voucher.importjob where success_count+failure_count>cursor_value) then raise exception 'VOUCHER_IMPORT_PROGRESS_INVALID'; end if;
end $assert$;

commit;
