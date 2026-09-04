begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904032600') then raise exception 'AUDIT_FACT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904032700')
    or exists(select 1 from information_schema.columns where table_schema='audit' and table_name='record' and column_name='request_id') then
    raise exception 'AUDIT_FACT_ALREADY_APPLIED';
  end if;
end $precondition$;

create temporary table audit_fact_reconcile on commit drop as
select (select count(*) from audit.record)+(select count(*) from audit.accessrecord) rows;

alter table audit.record disable trigger immutable;
alter table audit.accessrecord disable trigger immutable;

alter table audit.record
  rename column action to operation;
alter table audit.record
  rename column resource_type to object_type;
alter table audit.record
  rename column resource_id to object_id;
alter table audit.record
  add column request_id text,
  add column subject_type text,
  add column subject_id text,
  add column outcome text,
  add column reason text;
update audit.record set
  request_id='migration:'||id,
  subject_type=actor_type,
  subject_id=coalesce(actor_id,'system'),
  outcome='succeeded',
  reason='historical-import';
alter table audit.record
  alter column request_id set not null,
  alter column subject_type set not null,
  alter column subject_id set not null,
  alter column outcome set not null,
  alter column reason set not null,
  alter column signature_version set default 3,
  add constraint audit_record_operation check(operation~'^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$' and length(operation)<=160) not valid,
  add constraint audit_record_request check(length(request_id) between 1 and 256),
  add constraint audit_record_subject check(subject_type~'^[a-z][a-z0-9.]{0,63}$' and length(subject_id) between 1 and 512) not valid,
  add constraint audit_record_object check(object_type~'^[a-z][a-z0-9.]{0,63}$' and(object_id is null or length(object_id) between 1 and 512)) not valid,
  add constraint audit_record_outcome check(outcome in('succeeded','rejected','failed')),
  add constraint audit_record_reason check(length(reason) between 1 and 512);

alter table audit.accessrecord
  rename column purpose to operation;
alter table audit.accessrecord
  rename column resource_type to object_type;
alter table audit.accessrecord
  rename column resource_id to object_id;
alter table audit.accessrecord
  add column request_id text,
  add column subject_type text,
  add column subject_id text,
  add column outcome text,
  add column reason text;
update audit.accessrecord set
  request_id='migration:'||id,
  subject_type=actor_type,
  subject_id=actor_id,
  outcome='succeeded',
  reason='historical-access';
alter table audit.accessrecord
  alter column request_id set not null,
  alter column subject_type set not null,
  alter column subject_id set not null,
  alter column outcome set not null,
  alter column reason set not null,
  alter column signature_version set default 3,
  add constraint audit_access_operation check(operation~'^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$' and length(operation)<=160) not valid,
  add constraint audit_access_request check(length(request_id) between 1 and 256),
  add constraint audit_access_subject check(subject_type~'^[a-z][a-z0-9.]{0,63}$' and length(subject_id) between 1 and 512) not valid,
  add constraint audit_access_object check(object_type~'^[a-z][a-z0-9.]{0,63}$' and length(object_id) between 1 and 512) not valid,
  add constraint audit_access_outcome check(outcome in('succeeded','rejected','failed')),
  add constraint audit_access_reason check(length(reason) between 1 and 512);

alter table audit.record enable trigger immutable;
alter table audit.accessrecord enable trigger immutable;

create index audit_record_object on audit.record(scope_id,object_type,object_id,recorded_at desc,id desc) where object_id is not null;
create index audit_record_subject on audit.record(scope_id,subject_type,subject_id,recorded_at desc,id desc);
create index audit_record_trace on audit.record(scope_id,trace_id,recorded_at desc,id desc);
create index audit_access_object on audit.accessrecord(scope_id,object_type,object_id,accessed_at desc,id desc);
create index audit_access_subject on audit.accessrecord(scope_id,subject_type,subject_id,accessed_at desc,id desc);
create index audit_access_trace on audit.accessrecord(scope_id,trace_id,accessed_at desc,id desc);

revoke update,delete,truncate on audit.record,audit.accessrecord,audit.archiveref,audit.archiveitem from shopapp,shopjob;

select runtime.record_migration_evidence('20260904032700',(select rows from audit_fact_reconcile),
  (select count(*) from audit.record)+(select count(*) from audit.accessrecord),0,0,
  'create index concurrently if not exists audit_record_object_live on audit.record(scope_id,object_type,object_id,recorded_at desc,id desc) where object_id is not null;',
  'select scope_id,count(*) from audit.record where request_id is null or subject_id is null group by scope_id; select scope_id,count(*) from audit.accessrecord where request_id is null or subject_id is null group by scope_id;');
insert into runtime.schemaversion(version,checksum)
values('20260904032700',encode(public.digest('20260904032700_harden_audit_facts','sha256'),'hex'));

commit;
