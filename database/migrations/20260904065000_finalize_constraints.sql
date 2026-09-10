begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904064000') then raise exception 'IDEAL_FINAL_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904065000') then raise exception 'IDEAL_FINAL_ALREADY_APPLIED'; end if;
end
$precondition$;

-- The original benefit-ledger import used an underscore-separated reference
-- kind. Normalize that data and its derived identity before validating the
-- canonical dot-separated contract. Ledger amounts, journal identities and
-- entry relationships remain unchanged.
do $finance_reference_precondition$
begin
  if exists(
    select 1 from finance.journal
    where reference_type!~'^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$'
      and reference_type<>'benefit_ledger'
  ) then
    raise exception 'FINANCE_JOURNAL_REFERENCE_NORMALIZATION_UNSUPPORTED';
  end if;
  if exists(
    select 1 from finance.journal legacy
    join finance.journal canonical on canonical.scope_id=legacy.scope_id
      and canonical.reference_id=legacy.reference_id and canonical.reference_type='benefit.ledger'
    where legacy.reference_type='benefit_ledger'
  ) or exists(
    select 1 from finance.economicleg legacy
    join finance.economicleg canonical on canonical.owner_event_id=legacy.owner_event_id
      and canonical.economic_leg_id='benefit.ledger'
    where legacy.economic_leg_id='benefit_ledger'
  ) then
    raise exception 'FINANCE_JOURNAL_REFERENCE_NORMALIZATION_CONFLICT';
  end if;
end
$finance_reference_precondition$;

alter table finance.journal disable trigger finance_journal_immutable;
alter table finance.economicleg disable trigger finance_economic_leg_immutable;
alter table finance.postingreference disable trigger finance_postingreference_immutable;

update finance.journal set reference_type='benefit.ledger' where reference_type='benefit_ledger';
update finance.economicleg set economic_leg_id='benefit.ledger' where economic_leg_id='benefit_ledger';
update finance.postingreference
set economic_leg='benefit.ledger',
  source_hash=encode(public.digest(source_id||chr(31)||'benefit.ledger'||chr(31)||journal_id||chr(31)||
    currency||chr(31)||amount_minor::text,'sha256'),'hex'),
  version=version+1
where economic_leg='benefit_ledger';

alter table finance.postingreference enable trigger finance_postingreference_immutable;
alter table finance.economicleg enable trigger finance_economic_leg_immutable;
alter table finance.journal enable trigger finance_journal_immutable;

do $finance_reference_assert$
begin
  if exists(select 1 from finance.journal where reference_type='benefit_ledger')
    or exists(select 1 from finance.economicleg where economic_leg_id='benefit_ledger')
    or exists(select 1 from finance.postingreference where economic_leg='benefit_ledger') then
    raise exception 'FINANCE_JOURNAL_REFERENCE_NORMALIZATION_INCOMPLETE';
  end if;
  if exists(
    select 1 from finance.postingreference reference
    where reference.source_hash<>encode(public.digest(reference.source_id||chr(31)||reference.economic_leg||chr(31)||
      reference.journal_id||chr(31)||reference.currency||chr(31)||reference.amount_minor::text,'sha256'),'hex')
  ) then
    raise exception 'FINANCE_POSTING_REFERENCE_HASH_INVALID';
  end if;
end
$finance_reference_assert$;

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
create policy migrationaccess on runtime.schemahead for all to shopmigration using(true) with check(true);
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

do $module_boundary_precondition$
declare source text;
begin
  select pg_get_functiondef('finance.post(text,text,text,text,text,text,text,text,text,bigint,timestamptz)'::regprocedure) into source;
  if source is null or source not like '%FINANCE_IDEMPOTENCY_MISMATCH%'
    or source not like '%insert into runtime.outbox%' or source like '%runtime.emit(%' then
    raise exception 'FINANCE_OUTBOX_FACADE_SOURCE_INVALID';
  end if;
end
$module_boundary_precondition$;

create or replace function finance.post(
  p_scope text,p_reference_type text,p_reference_id text,p_currency text,p_description text,
  p_debit_code text,p_debit_kind text,p_credit_code text,p_credit_kind text,p_amount bigint,
  p_occurred_at timestamptz default clock_timestamp()
) returns text language plpgsql volatile security definer set search_path=finance,pg_temp as $function$
declare debitid text; creditid text; periodid text:=to_char(p_occurred_at at time zone 'UTC','YYYY-MM');
  journalid text:='journal:'||substr(encode(public.digest(p_scope||':'||p_reference_type||':'||p_reference_id,'sha256'::text),'hex'),1,40); inserted text;
begin
  if p_amount<=0 or p_currency!~'^[A-Z]{3}$'
    or p_reference_type!~'^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$' or p_reference_id='' then
    raise exception 'FINANCE_POST_INVALID';
  end if;
  if exists(select 1 from finance.period where scope_id=p_scope and period=periodid and state='closed')
    then raise exception 'FINANCE_PERIOD_CLOSED'; end if;
  insert into finance.period(scope_id,period,state) values(p_scope,periodid,'open') on conflict(scope_id,period) do nothing;
  debitid:=finance.ensure_account(p_scope,p_debit_code,p_currency,p_debit_kind);
  creditid:=finance.ensure_account(p_scope,p_credit_code,p_currency,p_credit_kind);
  if debitid=creditid then raise exception 'FINANCE_POST_SAME_ACCOUNT'; end if;
  insert into finance.journal(id,scope_id,reference_type,reference_id,currency,period,state,description,posted_at,version)
    values(journalid,p_scope,p_reference_type,p_reference_id,p_currency,periodid,'posted',p_description,p_occurred_at,0)
    on conflict(scope_id,reference_type,reference_id) do nothing returning id into inserted;
  if inserted is null then
    if not exists(select 1 from finance.journal journal where journal.id=journalid and journal.scope_id=p_scope
      and journal.currency=p_currency and journal.state='posted'
      and (select count(*) from finance.entry entry where entry.journal_id=journal.id)=2
      and exists(select 1 from finance.entry where journal_id=journal.id and account_id=debitid and side='debit' and amount_minor=p_amount)
      and exists(select 1 from finance.entry where journal_id=journal.id and account_id=creditid and side='credit' and amount_minor=p_amount))
      then raise exception 'FINANCE_IDEMPOTENCY_MISMATCH'; end if;
    return journalid;
  end if;
  insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at) values
    ('entry:'||substr(encode(public.digest(journalid||':debit','sha256'::text),'hex'),1,40),journalid,debitid,'debit',p_amount,p_occurred_at),
    ('entry:'||substr(encode(public.digest(journalid||':credit','sha256'::text),'hex'),1,40),journalid,creditid,'credit',p_amount,p_occurred_at);
  if (select coalesce(sum(case when side='debit' then amount_minor else -amount_minor end),0) from finance.entry where journal_id=journalid)<>0
    then raise exception 'FINANCE_JOURNAL_UNBALANCED'; end if;
  insert into finance.statement(id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,credit_minor,closing_minor,state,generated_at)
    values('statement:'||substr(encode(public.digest(p_scope||':'||periodid||':'||p_currency,'sha256'::text),'hex'),1,40),p_scope,
      date_trunc('month',p_occurred_at at time zone 'UTC')::date,
      (date_trunc('month',p_occurred_at at time zone 'UTC')+interval '1 month'-interval '1 day')::date,
      p_currency,coalesce((select closing_minor from finance.statement where scope_id=p_scope and currency=p_currency and state='final'
        and period_end<date_trunc('month',p_occurred_at at time zone 'UTC')::date order by period_end desc limit 1),0),p_amount,p_amount,
      coalesce((select closing_minor from finance.statement where scope_id=p_scope and currency=p_currency and state='final'
        and period_end<date_trunc('month',p_occurred_at at time zone 'UTC')::date order by period_end desc limit 1),0),'draft',clock_timestamp())
    on conflict(scope_id,period_start,period_end,currency,state) do update set debit_minor=finance.statement.debit_minor+excluded.debit_minor,
      credit_minor=finance.statement.credit_minor+excluded.credit_minor,closing_minor=finance.statement.opening_minor+
        finance.statement.debit_minor+excluded.debit_minor-finance.statement.credit_minor-excluded.credit_minor,generated_at=clock_timestamp();
  perform runtime.emit('event:'||substr(encode(public.digest('finance.entry.posted:'||journalid,'sha256'::text),'hex'),1,40),
    'finance.entry.posted',1,'journal',journalid,p_scope,
    jsonb_build_object('journal',journalid,'referenceType',p_reference_type,'referenceId',p_reference_id,
      'amountMinor',p_amount,'currency',p_currency,'debit',p_debit_code,'credit',p_credit_code),
    journalid,p_occurred_at,clock_timestamp());
  return journalid;
end
$function$;
revoke all on function finance.post(text,text,text,text,text,text,text,text,text,bigint,timestamptz) from public;
grant execute on function finance.post(text,text,text,text,text,text,text,text,text,bigint,timestamptz) to shopapp,shopjob;

do $module_boundary_assert$
declare source text;
begin
  select pg_get_functiondef('finance.post(text,text,text,text,text,text,text,text,text,bigint,timestamptz)'::regprocedure) into source;
  if source like '%insert into runtime.outbox%' or source not like '%runtime.emit(%' then
    raise exception 'FINANCE_OUTBOX_FACADE_REWRITE_FAILED';
  end if;
end
$module_boundary_assert$;

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
    execute format('grant usage,create on schema %I to %I',authority.schema_name,authority.owner_role);
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
    execute format('grant execute on function public.digest(text,text),public.digest(bytea,text) to %I',authority.owner_role);
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
  grant usage on schema public to shopmigration,shopapp,shopjob;
  grant execute on function public.digest(text,text),public.digest(bytea,text) to shopmigration,shopapp,shopjob;
end
$module_dependencies$;

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
  if exists(
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid=procedure.pronamespace
    cross join lateral regexp_matches(procedure.prosrc,'public\.([a-zA-Z_][a-zA-Z0-9_]*)','g') as reference(name)
    where namespace.nspname in(select schema_name from runtime.moduleauthority) and reference.name[1]<>'digest'
  ) then raise exception 'IDEAL_PUBLIC_FUNCTION_DEPENDENCY_INVALID'; end if;
  if not has_function_privilege('shopapp','public.digest(text,text)','execute')
    or not has_function_privilege('shopjob','public.digest(text,text)','execute') then
    raise exception 'IDEAL_DIGEST_FACADE_PRIVILEGE_INVALID';
  end if;
end
$assert$;

commit;
