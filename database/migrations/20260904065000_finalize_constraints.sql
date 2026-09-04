begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904064000') then raise exception 'IDEAL_FINAL_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904065000') then raise exception 'IDEAL_FINAL_ALREADY_APPLIED'; end if;
end
$precondition$;

-- Historical audit classifications include provider and route separators. They
-- are immutable evidence, so normalize the forward contract rather than
-- rewriting signed history during finalization.
alter table audit.record drop constraint audit_record_operation;
alter table audit.record drop constraint audit_record_subject;
alter table audit.record drop constraint audit_record_object;
alter table audit.record add constraint audit_record_operation
  check(length(operation) between 1 and 160 and operation!~'[[:cntrl:]]') not valid;
alter table audit.record add constraint audit_record_subject
  check(length(subject_type) between 1 and 128 and subject_type!~'[[:cntrl:]]' and length(subject_id) between 1 and 512) not valid;
alter table audit.record add constraint audit_record_object
  check(length(object_type) between 1 and 128 and object_type!~'[[:cntrl:]]' and(object_id is null or length(object_id) between 1 and 512)) not valid;
alter table audit.accessrecord drop constraint audit_access_operation;
alter table audit.accessrecord drop constraint audit_access_subject;
alter table audit.accessrecord drop constraint audit_access_object;
alter table audit.accessrecord add constraint audit_access_operation
  check(length(operation) between 1 and 160 and operation!~'[[:cntrl:]]') not valid;
alter table audit.accessrecord add constraint audit_access_subject
  check(length(subject_type) between 1 and 128 and subject_type!~'[[:cntrl:]]' and length(subject_id) between 1 and 512) not valid;
alter table audit.accessrecord add constraint audit_access_object
  check(length(object_type) between 1 and 128 and object_type!~'[[:cntrl:]]' and length(object_id) between 1 and 512) not valid;

do $constraints$
declare constraintrow record;
begin
  for constraintrow in
    select namespace.nspname schema_name,relation.relname table_name,constraintinfo.conname
    from pg_constraint constraintinfo
    join pg_class relation on relation.oid=constraintinfo.conrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where not constraintinfo.convalidated and namespace.nspname in(select schema_name from runtime.moduleauthority)
    order by namespace.nspname,relation.relname,constraintinfo.conname
  loop
    execute format('alter table %I.%I validate constraint %I',
      constraintrow.schema_name,constraintrow.table_name,constraintrow.conname);
  end loop;
end
$constraints$;

insert into runtime.schemaversion(version,checksum)
values('20260904065000',encode(public.digest('20260904065000_finalize_constraints','sha256'),'hex'));

create table runtime.schemahead(
  artifact text primary key,
  contract_version text not null,
  migration_head char(14) not null check(migration_head~'^[0-9]{14}$'),
  checksum char(64) not null check(checksum~'^[0-9a-f]{64}$'),
  migration_count integer not null check(migration_count>0),
  published_by text not null,
  published_at timestamptz not null
);
insert into runtime.schemahead(artifact,contract_version,migration_head,checksum,migration_count,published_by,published_at)
select 'commerce','5.0.0','20260904065000',
  encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex'),
  count(*),'migration:finalize',clock_timestamp()
from runtime.schemaversion;
alter table runtime.schemahead enable row level security;
alter table runtime.schemahead force row level security;
create policy schemaheadread on runtime.schemahead for select to shopread,shopapp,shopjob using(true);
revoke all on runtime.schemahead from public;
grant select on runtime.schemahead to shopread,shopapp,shopjob;

do $statistics$
declare target record;
begin
  for target in select schemaname,tablename from pg_tables
    where schemaname in(select schema_name from runtime.moduleauthority)
    order by schemaname,tablename
  loop
    execute format('analyze %I.%I',target.schemaname,target.tablename);
  end loop;
end
$statistics$;

select runtime.record_migration_evidence('20260904065000',
  (select count(*) from runtime.schemaversion),(select migration_count from runtime.schemahead where artifact='commerce'),0,0,
  'select artifact,contract_version,migration_head,checksum,migration_count,published_at from runtime.schemahead;',
  'select namespace.nspname,relation.relname,constraintinfo.conname from pg_constraint constraintinfo join pg_class relation on relation.oid=constraintinfo.conrelid join pg_namespace namespace on namespace.oid=relation.relnamespace where not constraintinfo.convalidated order by 1,2,3;');

-- Runtime owns the physical Outbox. Business modules append through this
-- narrow security-definer Facade, preserving atomic writes without granting
-- cross-Schema DML to module owners.
create function runtime.emit(
  p_id text,p_event_type text,p_event_version integer,p_aggregate_type text,p_aggregate_id text,p_scope text,
  p_payload jsonb,p_trace text,p_occurred_at timestamptz,p_available_at timestamptz
) returns text language plpgsql volatile security definer set search_path=runtime,pg_temp as $function$
declare emitted text;
begin
  if p_id is null or p_id='' or p_event_type is null or p_event_type='' or p_event_version<=0
    or p_aggregate_type is null or p_aggregate_type='' or p_aggregate_id is null or p_aggregate_id=''
    or p_scope is null or p_scope='' or jsonb_typeof(p_payload)<>'object' or p_trace is null or p_trace=''
    or p_occurred_at is null or p_available_at is null then raise exception 'RUNTIME_EVENT_INVALID'; end if;
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
  values(p_id,p_event_type,p_event_version,p_aggregate_type,p_aggregate_id,p_scope,p_payload,p_trace,p_occurred_at,p_available_at)
  on conflict(id) do nothing returning id into emitted;
  if emitted is null and not exists(select 1 from runtime.outbox value where value.id=p_id and value.event_type=p_event_type
    and value.event_version=p_event_version and value.aggregate_type=p_aggregate_type and value.aggregate_id=p_aggregate_id
    and value.scope_id=p_scope and value.payload=p_payload and value.trace_id=p_trace and value.occurred_at=p_occurred_at)
  then raise exception 'RUNTIME_EVENT_IDEMPOTENCY_MISMATCH'; end if;
  return p_id;
end
$function$;
revoke all on function runtime.emit(text,text,integer,text,text,text,jsonb,text,timestamptz,timestamptz) from public;

do $module_boundary$
declare source text; rewritten text;
begin
  select pg_get_functiondef('finance.post(text,text,text,text,text,text,text,text,text,bigint,timestamptz)'::regprocedure) into source;
  rewritten=replace(source,$outboxwrite$
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
    values('event:'||substr(encode(public.digest('finance.entry.posted:'||journalid,'sha256'::text),'hex'),1,40),'finance.entry.posted',1,
      'journal',journalid,p_scope,jsonb_build_object('journal',journalid,'referenceType',p_reference_type,'referenceId',p_reference_id,
        'amountMinor',p_amount,'currency',p_currency,'debit',p_debit_code,'credit',p_credit_code),journalid,p_occurred_at,clock_timestamp())
    on conflict(id) do nothing;
$outboxwrite$,$outboxfacade$
  perform runtime.emit('event:'||substr(encode(public.digest('finance.entry.posted:'||journalid,'sha256'::text),'hex'),1,40),
    'finance.entry.posted',1,'journal',journalid,p_scope,
    jsonb_build_object('journal',journalid,'referenceType',p_reference_type,'referenceId',p_reference_id,
      'amountMinor',p_amount,'currency',p_currency,'debit',p_debit_code,'credit',p_credit_code),
    journalid,p_occurred_at,clock_timestamp());
$outboxfacade$);
  if rewritten=source or rewritten like '%insert into runtime.outbox%' or rewritten not like '%runtime.emit(%'
    then raise exception 'FINANCE_OUTBOX_FACADE_REWRITE_FAILED'; end if;
  execute rewritten;
end
$module_boundary$;

do $ownership$
declare authorities jsonb; owner_roles text; authority record; target record;
begin
  select jsonb_agg(to_jsonb(source) order by source.module_id) into authorities
  from (
    select module_id,schema_name,owner_role,reader_role,writer_role,created_at registered_at
    from runtime.moduleauthority
    union all
    select 'financeinvoice','invoice','shopfinanceowner','shopfinancereader','shopfinancewriter',clock_timestamp()
  ) source;
  select string_agg(format('%I',role.owner_role),',' order by role.owner_role) into owner_roles
  from (select distinct source.owner_role from jsonb_to_recordset(authorities) as source(
    module_id text,schema_name text,owner_role text,reader_role text,writer_role text,
    registered_at timestamptz
  )) role;
  for authority in select * from jsonb_to_recordset(authorities) as source(
    module_id text,schema_name text,owner_role text,reader_role text,writer_role text,
    registered_at timestamptz
  ) loop
    for target in select relation.relkind,relation.oid::regclass object_name
      from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname=authority.schema_name and relation.relkind in('r','p','S','v','m')
      order by relation.relkind,relation.relname
    loop
      if target.relkind in('r','p') then
        execute format('alter table %s owner to %I',target.object_name,authority.owner_role);
        execute format('alter table %s enable row level security',target.object_name);
        execute format('alter table %s force row level security',target.object_name);
        execute format('revoke all privileges on table %s from shopmigration',target.object_name);
        execute format('drop policy if exists moduleowner on %s',target.object_name);
        execute format('create policy moduleowner on %s for all to %I using(true) with check(true)',target.object_name,authority.owner_role);
        execute format('drop policy if exists moduleread on %s',target.object_name);
        execute format('create policy moduleread on %s for select to %s using(true)',target.object_name,owner_roles);
        execute format('drop policy if exists modulereader on %s',target.object_name);
        execute format('create policy modulereader on %s for select to %I using(true)',target.object_name,authority.reader_role);
        execute format('drop policy if exists modulewriter on %s',target.object_name);
        execute format('create policy modulewriter on %s for all to %I using(true) with check(true)',target.object_name,authority.writer_role);
        execute format('drop policy if exists migrationaccess on %s',target.object_name);
        execute format('create policy migrationaccess on %s for all to shopmigration using(true) with check(true)',target.object_name);
      elsif target.relkind='S' then
        execute format('alter sequence %s owner to %I',target.object_name,authority.owner_role);
        execute format('revoke all privileges on sequence %s from shopmigration',target.object_name);
      elsif target.relkind='v' then
        execute format('alter view %s owner to %I',target.object_name,authority.owner_role);
        execute format('revoke all privileges on table %s from shopmigration',target.object_name);
      elsif target.relkind='m' then
        execute format('alter materialized view %s owner to %I',target.object_name,authority.owner_role);
        execute format('revoke all privileges on table %s from shopmigration',target.object_name);
      end if;
    end loop;
    for target in select procedure.oid::regprocedure object_name,
        coalesce('row_security=off'=any(procedure.proconfig),false) has_row_security_off
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid=procedure.pronamespace
      where namespace.nspname=authority.schema_name order by procedure.proname,procedure.oid
    loop
      execute format('alter function %s owner to %I',target.object_name,authority.owner_role);
      execute format('revoke all privileges on function %s from shopmigration',target.object_name);
      if target.has_row_security_off then
        execute format('alter function %s reset row_security',target.object_name);
      end if;
    end loop;
    execute format('alter schema %I owner to %I',authority.schema_name,authority.owner_role);
    execute format('revoke all privileges on schema %I from shopmigration',authority.schema_name);
    execute format('grant usage,create on schema %I to shopmigration',authority.schema_name);
    execute format('grant all privileges on all tables in schema %I to shopmigration',authority.schema_name);
    execute format('grant all privileges on all sequences in schema %I to shopmigration',authority.schema_name);
    execute format('grant execute on all functions in schema %I to shopmigration',authority.schema_name);
    execute format('grant usage on schema %I to %I,%I',authority.schema_name,authority.reader_role,authority.writer_role);
    execute format('grant select on all tables in schema %I to %I',authority.schema_name,authority.reader_role);
    execute format('grant select,insert,update,delete on all tables in schema %I to %I',authority.schema_name,authority.writer_role);
    execute format('grant usage,select on all sequences in schema %I to %I,%I',authority.schema_name,authority.reader_role,authority.writer_role);
    execute format('grant execute on all functions in schema %I to %I',authority.schema_name,authority.writer_role);
  end loop;
end
$ownership$;

do $module_dependencies$
declare authorities jsonb; authority record; dependency record;
begin
  select jsonb_agg(to_jsonb(source) order by source.module_id) into authorities
  from (
    select module_id,schema_name,owner_role,reader_role,writer_role,created_at registered_at
    from runtime.moduleauthority
    union all
    select 'financeinvoice','invoice','shopfinanceowner','shopfinancereader','shopfinancewriter',clock_timestamp()
  ) source;
  for authority in select * from jsonb_to_recordset(authorities) as source(
    module_id text,schema_name text,owner_role text,reader_role text,writer_role text,
    registered_at timestamptz
  ) loop
    execute format('grant usage on schema public to %I',authority.owner_role);
    execute format('grant execute on all functions in schema public to %I',authority.owner_role);
    for dependency in select * from jsonb_to_recordset(authorities) as source(
      module_id text,schema_name text,owner_role text,reader_role text,writer_role text,
      registered_at timestamptz
    ) loop
      execute format('grant usage on schema %I to %I',dependency.schema_name,authority.owner_role);
      execute format('grant select on all tables in schema %I to %I',dependency.schema_name,authority.owner_role);
      execute format('grant usage,select on all sequences in schema %I to %I',dependency.schema_name,authority.owner_role);
      execute format('grant execute on all functions in schema %I to %I',dependency.schema_name,authority.owner_role);
    end loop;
  end loop;
  grant usage on schema public to shopmigration;
  grant execute on all functions in schema public to shopmigration;
end
$module_dependencies$;

-- Migration runners retain membership so future changes can explicitly SET ROLE
-- to one module owner, but may no longer inherit every module's privileges.
alter role shopmigration noinherit;

do $assert$
begin
  if exists(select 1 from pg_constraint constraintinfo join pg_class relation on relation.oid=constraintinfo.conrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where not constraintinfo.convalidated and namespace.nspname in(select schema_name from runtime.moduleauthority))
  then raise exception 'IDEAL_UNVALIDATED_CONSTRAINT_REMAINS'; end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce' and contract_version='5.0.0'
    and migration_head='20260904065000') then raise exception 'IDEAL_SCHEMA_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.moduleauthority authority join pg_namespace namespace on namespace.nspname=authority.schema_name
    where namespace.nspowner::regrole::text<>authority.owner_role) then raise exception 'IDEAL_SCHEMA_OWNER_INVALID'; end if;
  if not exists(select 1 from pg_namespace where nspname='invoice' and nspowner::regrole::text='shopfinanceowner')
    then raise exception 'IDEAL_INVOICE_SCHEMA_OWNER_INVALID'; end if;
  if exists(select 1 from pg_roles where rolname='shopmigration' and rolinherit)
    then raise exception 'IDEAL_MIGRATION_ROLE_MUST_NOT_INHERIT'; end if;
end
$assert$;

commit;
