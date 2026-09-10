begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904032500') then raise exception 'RISK_DECISION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904032600') then raise exception 'RISK_DECISION_ALREADY_APPLIED'; end if;
end
$precondition$;

alter table risk.signal
  add column version integer not null default 1 check(version>0),
  add column source text not null default 'legacy' check(source~'^[a-z][a-z0-9.:-]{1,127}$'),
  add column sensitivity text not null default 'personal' check(sensitivity in('public','personal','sensitive')),
  add column value_hash char(64),
  add column retention_until timestamptz;

update risk.signal set
  value_hash=encode(public.digest(value::text,'sha256'),'hex'),
  retention_until=least(coalesce(expires_at,'infinity'::timestamptz),observed_at+interval '7 days');

alter table risk.signal
  alter column value_hash set not null,
  alter column retention_until set not null,
  add constraint risk_signal_value_hash check(value_hash~'^[0-9a-f]{64}$'),
  add constraint risk_signal_retention check(retention_until>observed_at);

create unique index risk_signal_fact_unique on risk.signal(
  scope_id,coalesce(actor_id,''),type,version,source,observed_at,value_hash
);
create index risk_signal_retention on risk.signal(retention_until,id);

alter table risk.decision drop constraint risk_decision_reason;
alter table risk.decision add constraint risk_decision_reason check(safe_reason in('policy','amount','velocity','signal','list','timeout','dependency'));

alter table approval.templates drop constraint templates_subject_kind_check;
alter table approval.templates add constraint templates_subject_kind_check
  check(subject_kind in('voucherstock','voucherissue','financerepair','reconciliation','withdrawal','refund','experiencepublish','riskexception','riskaction'));
alter table approval.template_versions drop constraint template_versions_subject_kind_check;
alter table approval.template_versions add constraint template_versions_subject_kind_check
  check(subject_kind in('voucherstock','voucherissue','financerepair','reconciliation','withdrawal','refund','experiencepublish','riskexception','riskaction'));
alter table approval.instances drop constraint instances_subject_kind_check;
alter table approval.instances add constraint instances_subject_kind_check
  check(subject_kind in('voucherstock','voucherissue','financerepair','reconciliation','withdrawal','refund','experiencepublish','riskexception','riskaction'));
alter table approval.proofs drop constraint proofs_subject_kind_check;
alter table approval.proofs add constraint proofs_subject_kind_check
  check(subject_kind in('voucherstock','voucherissue','financerepair','reconciliation','withdrawal','refund','experiencepublish','riskexception','riskaction'));

create table risk.action(
  id text primary key,
  scope_id text not null,
  decision_id text not null references risk.decision(id),
  kind text not null check(kind in('blocksettlement','requireverification','pausesales','suggestunlist')),
  target_module text not null check(target_module in('catalog','finance','payment','voucher','identity')),
  target_type text not null,
  target_id text not null,
  rationale text not null,
  approval_required boolean not null,
  approval_instance text,
  approval_proof text,
  state text not null check(state in('proposed','approvalrequired','approved','applied','rejected','expired')),
  evidence_hash char(64) not null check(evidence_hash~'^[0-9a-f]{64}$'),
  version bigint not null default 1 check(version>0),
  requested_at timestamptz not null,
  updated_at timestamptz not null,
  expires_at timestamptz not null,
  unique(decision_id,kind,target_module,target_type,target_id),
  check(expires_at>requested_at),
  check((approval_required and state<>'proposed') or not approval_required),
  check((approval_instance is null and approval_proof is null) or approval_required),
  check(not approval_required or state='approvalrequired' or approval_proof is not null)
);
create index risk_action_state on risk.action(state,requested_at,id) include(scope_id,kind,target_module,target_id,approval_instance);
create unique index risk_action_approval on risk.action(approval_instance) where approval_instance is not null;

create table risk.assessment(
  id text primary key,
  scope_id text not null,
  actor_id text not null,
  operation text not null,
  resource_id text,
  scope_chain jsonb not null check(jsonb_typeof(scope_chain)='array' and pg_column_size(scope_chain)<=16384),
  amount_minor bigint,
  signals jsonb not null check(jsonb_typeof(signals)='array' and pg_column_size(signals)<=65536),
  operation_risk text not null check(operation_risk in('low','elevated','high','critical')),
  trace_id text not null,
  state text not null check(state in('queued','running','completed','failed','expired')),
  created_at timestamptz not null,
  completed_at timestamptz,
  expires_at timestamptz not null,
  check(expires_at>created_at)
);
create index risk_assessment_queue on risk.assessment(state,created_at,id) include(scope_id,operation_risk);

create function risk.reject_immutable_fact() returns trigger language plpgsql
set search_path=risk,pg_temp as $function$
begin
  raise exception 'RISK_IMMUTABLE_FACT';
end
$function$;
revoke all on function risk.reject_immutable_fact() from public,shopapp,shopjob;
create trigger risk_policyversion_immutable before update or delete on risk.policyversion
for each row execute function risk.reject_immutable_fact();
create trigger risk_decision_immutable before update or delete on risk.decision
for each row execute function risk.reject_immutable_fact();

create function risk.guard_action() returns trigger language plpgsql
set search_path=risk,pg_temp as $function$
begin
  if row(old.id,old.scope_id,old.decision_id,old.kind,old.target_module,old.target_type,old.target_id,old.rationale,old.approval_required,old.evidence_hash,old.requested_at,old.expires_at)
    is distinct from row(new.id,new.scope_id,new.decision_id,new.kind,new.target_module,new.target_type,new.target_id,new.rationale,new.approval_required,new.evidence_hash,new.requested_at,new.expires_at)
  then raise exception 'RISK_ACTION_PROPOSAL_IMMUTABLE'; end if;
  if new.version<>old.version+1 or new.updated_at<=old.updated_at then raise exception 'RISK_ACTION_VERSION_INVALID'; end if;
  return new;
end
$function$;
revoke all on function risk.guard_action() from public,shopapp,shopjob;
create trigger risk_action_guard before update on risk.action for each row execute function risk.guard_action();

create function risk.purgesignals(p_scope text,p_batch integer) returns integer language plpgsql
set search_path=risk,pg_temp as $function$
declare affected integer;
begin
  if p_scope is null or p_batch<1 or p_batch>1000 then raise exception 'RISK_SIGNAL_PURGE_INPUT_INVALID'; end if;
  with expired as(
    select id from risk.signal where scope_id=p_scope and(retention_until<=clock_timestamp() or expires_at<=clock_timestamp())
    order by retention_until,id limit p_batch for update skip locked
  )
  delete from risk.signal signal using expired where signal.id=expired.id;
  get diagnostics affected=row_count;
  return affected;
end
$function$;
revoke all on function risk.purgesignals(text,integer) from public;
grant execute on function risk.purgesignals(text,integer) to shopapp,shopjob;

alter table risk.action enable row level security;
alter table risk.action force row level security;
alter table risk.assessment enable row level security;
alter table risk.assessment force row level security;
create policy migrationaccess on risk.action for all to shopmigration using(true) with check(true);
create policy migrationaccess on risk.assessment for all to shopmigration using(true) with check(true);
create policy appselect on risk.action for select to shopapp,shopjob using(risk.scope_allowed(scope_id));
create policy appinsert on risk.action for insert to shopapp,shopjob with check(risk.scope_allowed(scope_id));
create policy appupdate on risk.action for update to shopapp,shopjob using(risk.scope_allowed(scope_id)) with check(risk.scope_allowed(scope_id));
create policy appselect on risk.assessment for select to shopapp,shopjob using(risk.scope_allowed(scope_id));
create policy appinsert on risk.assessment for insert to shopapp,shopjob with check(risk.scope_allowed(scope_id));
create policy appupdate on risk.assessment for update to shopapp,shopjob using(risk.scope_allowed(scope_id)) with check(risk.scope_allowed(scope_id));
grant select,insert,update on risk.action,risk.assessment to shopapp,shopjob;
revoke update,delete on risk.policyversion,risk.decision from shopapp,shopjob;

do $verify$
begin
  if (select count(*) from pg_trigger where tgrelid in('risk.policyversion'::regclass,'risk.decision'::regclass) and not tgisinternal)<>2 then
    raise exception 'RISK_IMMUTABILITY_GUARDS_MISSING';
  end if;
  if to_regclass('risk.action') is null or to_regclass('risk.assessment') is null then raise exception 'RISK_ACTION_TABLES_MISSING'; end if;
end
$verify$;

select runtime.record_migration_evidence('20260904032600',4,4,0,0,
  'select policy_id,version,rule_hash from risk.policyversion order by policy_id,version limit 20;',
  'select id,scope_id,decision_id,kind,state,evidence_hash from risk.action order by id limit 20;');
insert into runtime.schemaversion(version,checksum)
values('20260904032600',encode(public.digest('20260904032600_harden_risk_decisions','sha256'),'hex'));

commit;
