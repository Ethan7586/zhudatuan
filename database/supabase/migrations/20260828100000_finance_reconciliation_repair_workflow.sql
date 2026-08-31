begin;

-- A reconciliation repair is a sealed, server-generated proposal.  The client
-- supplies only a justification/evidence envelope; accounts, amounts, event
-- identity and accounting time are reconstructed from authoritative facts.
create table finance.reconciliationrepair(
  id text primary key,
  reconciliation_id text not null references finance.reconciliation(id),
  item_id text not null references finance.reconciliationitem(id),
  scope_id text not null,
  reason text not null check(reason<>'' and length(reason)<=1000),
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  state text not null check(state in('preview','submitted','executed','rejected','reversed')),
  source_reconciliation_version bigint not null check(source_reconciliation_version>=0),
  source_item_version bigint not null check(source_item_version>=0),
  submitted_reconciliation_version bigint check(submitted_reconciliation_version>=0),
  submitted_item_version bigint check(submitted_item_version>=0),
  source_hash char(64) not null,
  target_hash char(64) not null,
  preview_hash char(64) not null unique,
  expires_at timestamptz not null,
  proposed_by text not null,
  submitted_by text,
  approved_by text,
  rejected_by text,
  reversed_by text,
  preview_idempotency text not null,
  submit_idempotency text,
  decision_idempotency text,
  reverse_idempotency text,
  submit_expected_version bigint check(submit_expected_version>=0),
  decision_expected_version bigint check(decision_expected_version>=0),
  reverse_expected_version bigint check(reverse_expected_version>=0),
  decision_reason text,
  decision_evidence jsonb,
  reverse_reason text,
  created_at timestamptz not null,
  submitted_at timestamptz,
  decided_at timestamptz,
  executed_at timestamptz,
  reversed_at timestamptz,
  updated_at timestamptz not null,
  version bigint not null default 0 check(version>=0),
  unique(scope_id,preview_idempotency),
  unique(scope_id,submit_idempotency),
  unique(scope_id,decision_idempotency),
  unique(scope_id,reverse_idempotency),
  check(decision_evidence is null or jsonb_typeof(decision_evidence)='object'),
  check(approved_by is null or approved_by<>proposed_by),
  check(rejected_by is null or rejected_by<>proposed_by),
  check(reversed_by is null or reversed_by<>proposed_by),
  check(
    (state='preview' and submitted_by is null and approved_by is null and rejected_by is null
      and submit_expected_version is null and decision_expected_version is null and reverse_expected_version is null
      and submitted_at is null and decided_at is null and executed_at is null and reversed_at is null)
    or (state='submitted' and submitted_by=proposed_by and submitted_at is not null
      and submitted_reconciliation_version is not null and submitted_item_version is not null
      and submit_expected_version is not null and decision_expected_version is null and reverse_expected_version is null
      and approved_by is null and rejected_by is null and decided_at is null and executed_at is null and reversed_at is null)
    or (state='executed' and submitted_by=proposed_by and submitted_at is not null
      and submit_expected_version is not null and decision_expected_version is not null and reverse_expected_version is null
      and approved_by is not null and rejected_by is null and decided_at is not null and executed_at is not null
      and decision_reason is not null and decision_evidence is not null and reversed_at is null)
    or (state='rejected' and submitted_by=proposed_by and submitted_at is not null
      and submit_expected_version is not null and decision_expected_version is not null and reverse_expected_version is null
      and rejected_by is not null and approved_by is null and decided_at is not null
      and decision_reason is not null and decision_evidence is not null and executed_at is null and reversed_at is null)
    or (state='reversed' and submitted_by=proposed_by and approved_by is not null and executed_at is not null
      and submit_expected_version is not null and decision_expected_version is not null and reverse_expected_version is not null
      and reversed_by is not null and reversed_at is not null and reverse_reason is not null)
  )
);

create table finance.reconciliationrepairline(
  repair_id text not null references finance.reconciliationrepair(id),
  sequence integer not null check(sequence in(1,2)),
  side text not null check(side in('debit','credit')),
  account_code text not null check(account_code<>''),
  account_kind text not null check(account_kind in('asset','liability','income','expense')),
  amount_minor bigint not null check(amount_minor between 1 and 9007199254740991),
  currency char(3) not null check(currency='CNY'),
  primary key(repair_id,sequence),
  unique(repair_id,side)
);

create table finance.reconciliationrepaireffect(
  id text primary key,
  repair_id text not null references finance.reconciliationrepair(id),
  scope_id text not null,
  kind text not null check(kind in('execute','reverse')),
  journal_id text not null unique references finance.journal(id),
  source_hash char(64) not null,
  target_hash char(64) not null,
  receipt_hash char(64) not null unique,
  actor_id text not null,
  reason text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null,
  unique(repair_id,kind)
);

-- Only a proof-bound repair transition may authorize an API-originated payment
-- journal or an exact reversal of a repair journal.  The marker is inaccessible
-- to application roles and is consumed by the journal trigger in this tx.
create table finance.reconciliationrepairauthorization(
  transaction_id bigint not null,
  repair_id text not null references finance.reconciliationrepair(id),
  action text not null check(action in('execute','reverse')),
  scope_id text not null,
  reference_type text not null,
  reference_id text not null,
  journal_id text,
  primary key(transaction_id,repair_id,action)
);

create or replace function finance.guard_reconciliation_repair()
returns trigger language plpgsql set search_path=finance,pg_temp as $function$
begin
  if tg_op='DELETE' then raise exception 'FINANCE_REPAIR_IMMUTABLE'; end if;
  if row(new.id,new.reconciliation_id,new.item_id,new.scope_id,new.reason,new.evidence,
      new.source_reconciliation_version,new.source_item_version,new.source_hash,new.target_hash,
      new.preview_hash,new.expires_at,new.proposed_by,new.preview_idempotency,new.created_at)
    is distinct from
    row(old.id,old.reconciliation_id,old.item_id,old.scope_id,old.reason,old.evidence,
      old.source_reconciliation_version,old.source_item_version,old.source_hash,old.target_hash,
      old.preview_hash,old.expires_at,old.proposed_by,old.preview_idempotency,old.created_at)
  then raise exception 'FINANCE_REPAIR_SNAPSHOT_IMMUTABLE'; end if;
  if new.version<>old.version+1 or not (
    (old.state='preview' and new.state='submitted')
    or (old.state='submitted' and new.state in('executed','rejected'))
    or (old.state='executed' and new.state='reversed')
  ) then raise exception 'FINANCE_REPAIR_STATE_INVALID'; end if;
  return new;
end $function$;

create or replace function finance.decide_reconciliation_repair(
  p_repair text,p_scope text,p_actor text,p_idempotency text,p_expected_version bigint,
  p_decision text,p_reason text,p_evidence jsonb,p_request_hash text
) returns jsonb language plpgsql volatile security definer
set search_path=finance,access,public,pg_temp as $function$
declare
  repair finance.reconciliationrepair%rowtype;
  plan record;
  item finance.reconciliationitem%rowtype;
  changed bigint;
  decidedat timestamptz:=clock_timestamp();
  journalid text;
  receipthash char(64);
begin
  if p_repair is null or p_repair='' or p_scope is null or p_scope='' or p_actor is null or p_actor=''
    or p_idempotency is null or p_idempotency='' or length(p_idempotency)>255
    or p_expected_version is null or p_expected_version<0 or p_decision not in('approve','reject')
    or p_reason is null or p_reason='' or length(p_reason)>1000
    or p_evidence is null or jsonb_typeof(p_evidence)<>'object' or pg_column_size(p_evidence)>65536
    or p_request_hash is null or p_request_hash!~'^[0-9a-f]{64}$'
  then raise exception 'FINANCE_REPAIR_DECISION_INVALID'; end if;
  if current_setting('app.workload',true)<>'api'
    or current_setting('app.scope_id',true) is distinct from p_scope
    or current_setting('app.actor_id',true) is distinct from p_actor
    or not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_REPAIR_CONTEXT_INVALID'; end if;

  select * into repair from finance.reconciliationrepair
  where id=p_repair and scope_id=p_scope for update;
  if repair.id is null then raise exception 'FINANCE_REPAIR_NOT_FOUND'; end if;
  if repair.decision_idempotency=p_idempotency then
    if repair.decision_expected_version<>p_expected_version or repair.decision_reason<>p_reason
      or repair.decision_evidence<>p_evidence
      or (p_decision='approve' and repair.approved_by<>p_actor)
      or (p_decision='reject' and repair.rejected_by<>p_actor)
    then raise exception 'FINANCE_REPAIR_IDEMPOTENCY_MISMATCH'; end if;
    return finance.reconciliation_repair_receipt(p_repair,p_scope);
  end if;
  if repair.state<>'submitted' or repair.version<>p_expected_version
  then raise exception 'VERSION_CONFLICT'; end if;
  if p_actor=repair.proposed_by or p_actor=repair.submitted_by
  then raise exception 'FINANCE_REPAIR_FOUR_EYES_REQUIRED'; end if;
  if repair.expires_at<=decidedat then raise exception 'FINANCE_REPAIR_PREVIEW_EXPIRED'; end if;
  perform finance.require_repair_action_proof('finance.reconciliationrepairs.decide',
    p_repair,p_scope,p_actor,p_idempotency,p_expected_version,p_request_hash);

  select * into plan from finance.reconciliation_repair_snapshot(
    repair.reconciliation_id,repair.item_id,p_scope);
  if plan.source_hash<>repair.source_hash or plan.target_hash<>repair.target_hash
    or plan.reconciliation_version<>repair.submitted_reconciliation_version
    or plan.item_version<>repair.submitted_item_version
  then raise exception 'FINANCE_REPAIR_SNAPSHOT_STALE'; end if;
  select * into item from finance.reconciliationitem
  where id=repair.item_id and reconciliation_id=repair.reconciliation_id and scope_id=p_scope for update;
  if item.state<>'resolutionpending' or item.version<>repair.submitted_item_version
    or item.resolved_by<>repair.proposed_by
    or item.resolution->>'kind'<>'authoritative_repair'
    or item.resolution->>'repair'<>repair.id
    or item.resolution->>'previewHash'<>repair.preview_hash
  then raise exception 'FINANCE_REPAIR_ITEM_STALE'; end if;
  if not exists(
    select 1 from finance.reconciliationrepairline line where line.repair_id=repair.id
    group by line.repair_id having count(*)=2
      and sum(case line.side when 'debit' then line.amount_minor else -line.amount_minor end)=0
      and bool_and(line.amount_minor=plan.amount_minor and line.currency=plan.currency)
      and bool_or(line.side='debit' and line.account_code=plan.debit_code and line.account_kind=plan.debit_kind)
      and bool_or(line.side='credit' and line.account_code=plan.credit_code and line.account_kind=plan.credit_kind)
  ) then raise exception 'FINANCE_REPAIR_PLAN_STALE'; end if;

  if p_decision='reject' then
    update finance.reconciliationitem set state='difference',resolution=null,resolved_by=null,resolved_at=null,
      approved_by=null,approved_at=null,version=version+1
    where id=repair.item_id and state='resolutionpending' and version=repair.submitted_item_version;
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'FINANCE_REPAIR_ITEM_STALE'; end if;
    update finance.reconciliation set state='difference',version=version+1,updated_at=decidedat
    where id=repair.reconciliation_id and scope_id=p_scope and state='difference'
      and version=repair.submitted_reconciliation_version;
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'FINANCE_REPAIR_RECONCILIATION_STALE'; end if;
    update finance.reconciliationrepair set state='rejected',rejected_by=p_actor,
      decision_idempotency=p_idempotency,decision_expected_version=p_expected_version,
      decision_reason=p_reason,decision_evidence=p_evidence,decided_at=decidedat,
      updated_at=decidedat,version=version+1
    where id=repair.id and state='submitted' and version=p_expected_version;
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'VERSION_CONFLICT'; end if;
    return finance.reconciliation_repair_receipt(p_repair,p_scope);
  end if;

  insert into finance.reconciliationrepairauthorization(
    transaction_id,repair_id,action,scope_id,reference_type,reference_id,journal_id
  ) values(txid_current(),repair.id,'execute',p_scope,plan.reference_type,plan.reference_id,null);
  journalid:=finance.post(p_scope,plan.reference_type,plan.reference_id,plan.currency,plan.description,
    plan.debit_code,plan.debit_kind,plan.credit_code,plan.credit_kind,plan.amount_minor,plan.occurred_at);
  if not exists(
    select 1 from finance.journal journal where journal.id=journalid and journal.scope_id=p_scope
      and journal.reference_type=plan.reference_type and journal.reference_id=plan.reference_id
      and journal.currency=plan.currency and journal.state='posted' and journal.posted_at=plan.occurred_at
      and (select count(*) from finance.entry entry where entry.journal_id=journal.id)=2
      and (select coalesce(sum(case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end),0)
        from finance.entry entry where entry.journal_id=journal.id)=0
      and not exists(select 1 from finance.reconciliationrepairline line where line.repair_id=repair.id
        and not exists(select 1 from finance.entry entry join finance.account account on account.id=entry.account_id
          where entry.journal_id=journal.id and account.scope_id=p_scope and account.currency=line.currency
            and account.code=line.account_code and account.kind=line.account_kind
            and entry.side=line.side and entry.amount_minor=line.amount_minor))
  ) then raise exception 'FINANCE_REPAIR_JOURNAL_MISMATCH'; end if;
  receipthash:=encode(public.digest(jsonb_build_object(
    'repair',repair.id,'kind','execute','journal',journalid,'sourceHash',repair.source_hash,
    'targetHash',repair.target_hash,'actor',p_actor,'reason',p_reason,'evidence',p_evidence
  )::text,'sha256'),'hex');
  insert into finance.reconciliationrepaireffect(
    id,repair_id,scope_id,kind,journal_id,source_hash,target_hash,receipt_hash,
    actor_id,reason,occurred_at,created_at
  ) values(
    'repaireffect:'||substr(encode(public.digest(repair.id||':execute','sha256'),'hex'),1,40),
    repair.id,p_scope,'execute',journalid,repair.source_hash,repair.target_hash,receipthash,
    p_actor,p_reason,plan.occurred_at,decidedat
  );
  update finance.reconciliationitem set state='matched',reason_code=null,
    evidence=evidence||jsonb_build_object(
      'repair',repair.id,'repairReceiptHash',receipthash,'journal',journalid,
      'journalReferenceType',plan.reference_type,'journalReferenceId',plan.reference_id,
      'settlementEligible',true,'repairExecutedAt',decidedat),
    resolution=null,resolved_by=null,resolved_at=null,approved_by=null,approved_at=null,version=version+1
  where id=repair.item_id and state='resolutionpending' and version=repair.submitted_item_version;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'FINANCE_REPAIR_ITEM_STALE'; end if;
  update finance.reconciliation reconciliation set
    state=case when exists(select 1 from finance.reconciliationitem candidate
      where candidate.reconciliation_id=reconciliation.id
        and (candidate.state<>'matched' or candidate.reason_code is not null or candidate.difference_minor<>0))
      then 'difference' else 'balanced' end,
    version=version+1,updated_at=decidedat
  where reconciliation.id=repair.reconciliation_id and reconciliation.scope_id=p_scope
    and reconciliation.state='difference' and reconciliation.version=repair.submitted_reconciliation_version;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'FINANCE_REPAIR_RECONCILIATION_STALE'; end if;
  update finance.reconciliationrepair set state='executed',approved_by=p_actor,
    decision_idempotency=p_idempotency,decision_expected_version=p_expected_version,
    decision_reason=p_reason,decision_evidence=p_evidence,decided_at=decidedat,executed_at=decidedat,
    updated_at=decidedat,version=version+1
  where id=repair.id and state='submitted' and version=p_expected_version;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'VERSION_CONFLICT'; end if;
  return finance.reconciliation_repair_receipt(p_repair,p_scope);
end $function$;

create or replace function finance.reconciliation_repair_receipt(p_repair text,p_scope text)
returns jsonb language sql stable security definer
set search_path=finance,pg_temp as $function$
  select jsonb_build_object(
    'repair',jsonb_build_object(
      'id',repair.id,'reconciliationId',repair.reconciliation_id,'itemId',repair.item_id,
      'scopeId',repair.scope_id,'reason',repair.reason,'evidence',repair.evidence,'state',repair.state,
      'sourceReconciliationVersion',repair.source_reconciliation_version,
      'sourceItemVersion',repair.source_item_version,
      'submittedReconciliationVersion',repair.submitted_reconciliation_version,
      'submittedItemVersion',repair.submitted_item_version,
      'sourceHash',repair.source_hash,'targetHash',repair.target_hash,'previewHash',repair.preview_hash,
      'expiresAt',repair.expires_at,'proposedBy',repair.proposed_by,'submittedBy',repair.submitted_by,
      'approvedBy',repair.approved_by,'rejectedBy',repair.rejected_by,'reversedBy',repair.reversed_by,
      'createdAt',repair.created_at,'submittedAt',repair.submitted_at,'decidedAt',repair.decided_at,
      'executedAt',repair.executed_at,'reversedAt',repair.reversed_at,'updatedAt',repair.updated_at,
      'version',repair.version
    ),
    'lines',coalesce((select jsonb_agg(jsonb_build_object(
      'sequence',line.sequence,'side',line.side,'accountCode',line.account_code,
      'accountKind',line.account_kind,'amountMinor',line.amount_minor,'currency',line.currency
    ) order by line.sequence) from finance.reconciliationrepairline line
      where line.repair_id=repair.id),'[]'::jsonb),
    'effects',coalesce((select jsonb_agg(jsonb_build_object(
      'id',effect.id,'kind',effect.kind,'journalId',effect.journal_id,
      'sourceHash',effect.source_hash,'targetHash',effect.target_hash,
      'receiptHash',effect.receipt_hash,'actorId',effect.actor_id,'reason',effect.reason,
      'occurredAt',effect.occurred_at,'createdAt',effect.created_at
    ) order by case effect.kind when 'execute' then 1 else 2 end) from finance.reconciliationrepaireffect effect
      where effect.repair_id=repair.id and effect.scope_id=repair.scope_id),'[]'::jsonb),
    'reconciliation',jsonb_build_object('id',reconciliation.id,'state',reconciliation.state,
      'differenceMinor',reconciliation.difference_minor,'version',reconciliation.version),
    'item',jsonb_build_object('id',item.id,'state',item.state,'reasonCode',item.reason_code,
      'evidence',item.evidence,'version',item.version)
  )
  from finance.reconciliationrepair repair
  join finance.reconciliation reconciliation on reconciliation.id=repair.reconciliation_id
    and reconciliation.scope_id=repair.scope_id
  join finance.reconciliationitem item on item.id=repair.item_id
    and item.reconciliation_id=repair.reconciliation_id and item.scope_id=repair.scope_id
  where repair.id=p_repair and repair.scope_id=p_scope
$function$;

create or replace function finance.read_reconciliation_repair(p_repair text,p_scope text)
returns jsonb language plpgsql stable security definer
set search_path=finance,access,pg_temp as $function$
declare receipt jsonb;
begin
  if p_repair is null or p_repair='' or p_scope is null or p_scope=''
    or current_setting('app.workload',true)<>'api'
    or current_setting('app.scope_id',true) is distinct from p_scope
    or not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_REPAIR_SCOPE_FORBIDDEN'; end if;
  receipt:=finance.reconciliation_repair_receipt(p_repair,p_scope);
  if receipt is null then raise exception 'FINANCE_REPAIR_NOT_FOUND'; end if;
  return receipt;
end $function$;

create or replace function finance.preview_reconciliation_repair(
  p_reconciliation text,p_item text,p_scope text,p_actor text,p_idempotency text,
  p_expected_reconciliation_version bigint,p_expected_item_version bigint,p_reason text,p_evidence jsonb
) returns jsonb language plpgsql volatile security definer
set search_path=finance,access,public,pg_temp as $function$
declare
  existing finance.reconciliationrepair%rowtype;
  plan record;
  repairid text;
  previewhash char(64);
  createdat timestamptz:=clock_timestamp();
  expiresat timestamptz;
begin
  if current_setting('app.workload',true)<>'api'
    or current_setting('app.scope_id',true) is distinct from p_scope
    or current_setting('app.actor_id',true) is distinct from p_actor
    or not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_REPAIR_CONTEXT_INVALID'; end if;
  if p_reconciliation is null or p_reconciliation='' or p_item is null or p_item=''
    or p_scope is null or p_scope='' or p_actor is null or p_actor=''
    or p_idempotency is null or p_idempotency='' or length(p_idempotency)>255
    or p_expected_reconciliation_version is null or p_expected_reconciliation_version<0
    or p_expected_item_version is null or p_expected_item_version<0
    or p_reason is distinct from 'INTERNAL_JOURNAL_MISSING'
    or p_evidence is null or jsonb_typeof(p_evidence)<>'object' or pg_column_size(p_evidence)>65536
  then raise exception 'FINANCE_REPAIR_PREVIEW_INVALID'; end if;

  select * into existing from finance.reconciliationrepair
  where scope_id=p_scope and preview_idempotency=p_idempotency for update;
  if existing.id is not null then
    if existing.reconciliation_id<>p_reconciliation or existing.item_id<>p_item
      or existing.proposed_by<>p_actor or existing.reason<>p_reason or existing.evidence<>p_evidence
      or existing.source_reconciliation_version<>p_expected_reconciliation_version
      or existing.source_item_version<>p_expected_item_version
    then raise exception 'FINANCE_REPAIR_IDEMPOTENCY_MISMATCH'; end if;
    return finance.reconciliation_repair_receipt(existing.id,p_scope);
  end if;

  select * into plan from finance.reconciliation_repair_snapshot(p_reconciliation,p_item,p_scope);
  if plan.reconciliation_version is null
    or plan.reconciliation_version<>p_expected_reconciliation_version
    or plan.item_version<>p_expected_item_version
  then raise exception 'VERSION_CONFLICT'; end if;
  expiresat:=createdat+interval '5 minutes';
  repairid:='repair:'||substr(encode(public.digest(
    p_scope||':'||p_reconciliation||':'||p_item||':'||p_idempotency,'sha256'),'hex'),1,40);
  previewhash:=encode(public.digest(jsonb_build_object(
    'repair',repairid,'scope',p_scope,'reconciliation',p_reconciliation,'item',p_item,
    'reconciliationVersion',plan.reconciliation_version,'itemVersion',plan.item_version,
    'sourceHash',plan.source_hash,'targetHash',plan.target_hash,
    'expiresAt',to_char(expiresat at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')
  )::text,'sha256'),'hex');
  insert into finance.reconciliationrepair(
    id,reconciliation_id,item_id,scope_id,reason,evidence,state,
    source_reconciliation_version,source_item_version,source_hash,target_hash,preview_hash,expires_at,
    proposed_by,preview_idempotency,created_at,updated_at,version
  ) values(
    repairid,p_reconciliation,p_item,p_scope,p_reason,p_evidence,'preview',
    plan.reconciliation_version,plan.item_version,plan.source_hash,plan.target_hash,previewhash,expiresat,
    p_actor,p_idempotency,createdat,createdat,0
  );
  insert into finance.reconciliationrepairline(
    repair_id,sequence,side,account_code,account_kind,amount_minor,currency
  ) values
    (repairid,1,'debit',plan.debit_code,plan.debit_kind,plan.amount_minor,plan.currency),
    (repairid,2,'credit',plan.credit_code,plan.credit_kind,plan.amount_minor,plan.currency);
  return finance.reconciliation_repair_receipt(repairid,p_scope);
end $function$;

-- The generic access proof is consumed by ModuleOperations before the command
-- action runs.  This transaction-local marker carries that exact binding into
-- the SECURITY DEFINER repair function and cannot be written by application
-- roles directly.
create table access.repairactionauthorization(
  transaction_id bigint not null,
  actor_id text not null,
  scope_id text not null,
  operation text not null check(operation in(
    'finance.reconciliationrepairs.submit',
    'finance.reconciliationrepairs.decide',
    'finance.reconciliationrepairs.reverse'
  )),
  resource_id text not null,
  idempotency_key text not null,
  expected_version bigint not null check(expected_version>=0),
  request_hash char(64) not null,
  primary key(transaction_id,operation,resource_id,idempotency_key)
);

create or replace function finance.resource_scope(p_resource text)
returns text language plpgsql stable security definer
set search_path=finance,invoice,pg_temp as $function$
declare resolved text;
begin
  select scope_id into resolved from finance.reconciliation where id=p_resource;
  if resolved is null then select scope_id into resolved from finance.reconciliationrepair where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.settlement where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.settlementadjustment where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.withdrawal where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.hold where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.periodclose where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.backfill where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.policy where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.statement where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.account where id=p_resource; end if;
  if resolved is null then select owner_id into resolved from invoice.profile where id=p_resource; end if;
  if resolved is null then select owner_id into resolved from invoice.requestprofile where request_id=p_resource; end if;
  return resolved;
end $function$;

create or replace function access.issue_action_proof(
  p_token_hash text,p_actor text,p_session text,p_membership text,p_assurance text,
  p_operation text,p_resource text,p_idempotency text,p_expected_version bigint,p_request_hash text
) returns table(scope_id text,resource_id text,expires_at timestamptz)
language plpgsql volatile security definer
set search_path=access,identity,capability,pg_temp as $function$
declare
  target_scope text;
  bound_resource text;
  assuranceid text;
  expiry timestamptz;
begin
  if p_token_hash is null or p_token_hash!~'^[0-9a-f]{64}$' or p_actor is null or p_actor=''
    or p_session is null or p_session='' or p_membership is null or p_membership=''
    or p_assurance is null or p_assurance=''
    or p_idempotency is null or p_idempotency='' or length(p_idempotency)>255
    or p_request_hash is null or p_request_hash!~'^[0-9a-f]{64}$'
    or (p_resource is not null and (p_resource='' or length(p_resource)>255))
  then raise exception 'ACTION_PROOF_REQUIRED'; end if;
  if p_operation not in(
    'finance.statements.export','finance.reconciliations.manage','finance.settlements.decide',
    'finance.settlements.adjust','finance.withdrawals.create','finance.withdrawals.decide',
    'finance.withdrawals.recover','finance.periods.manage','finance.backfills.decide',
    'finance.policies.manage','invoice.requests.decide','invoice.requests.red',
    'finance.reconciliationrepairs.submit','finance.reconciliationrepairs.decide',
    'finance.reconciliationrepairs.reverse'
  ) then raise exception 'ACTION_PROOF_REQUIRED'; end if;
  if p_operation<>'finance.statements.export' and p_expected_version is null
  then raise exception 'EXPECTED_VERSION_REQUIRED'; end if;
  if p_expected_version is not null and p_expected_version<0
  then raise exception 'EXPECTED_VERSION_INVALID'; end if;

  select assurance.id,least(clock_timestamp()+interval '5 minutes',coalesce(assurance.expires_at,clock_timestamp()+interval '5 minutes'))
    into assuranceid,expiry
  from identity.session session
  join identity.principal principal on principal.id=session.principal_id
  join access.membership membership on membership.id=session.membership_id
  join identity.assurance assurance
    on assurance.id=p_assurance and assurance.principal_id=session.principal_id and assurance.session_id=session.id
  where session.id=p_session and session.principal_id=p_actor and session.membership_id=p_membership
    and session.revoked_at is null and session.expires_at>clock_timestamp() and session.assurance_level>=3
    and principal.status='active' and session.credential_version=principal.credential_version
    and membership.status='active' and session.access_version=membership.access_version
    and assurance.level=3 and assurance.verified_at>=clock_timestamp()-interval '5 minutes'
    and (assurance.expires_at is null or assurance.expires_at>clock_timestamp())
  limit 1;
  if assuranceid is null then raise exception 'STEPUP_REQUIRED'; end if;
  if not exists(select 1 from capability.membership_operations(p_membership) granted
    join capability.operation operation on operation.operation_id=granted.operation_id
    join capability.capability capability on capability.id=operation.capability_id and capability.status='active'
    left join access.permission permission on permission.code=operation.permission_code
    where granted.operation_id=p_operation
      and (operation.permission_code is null or permission.status='active'))
  then raise exception 'PERMISSION_DENIED'; end if;

  target_scope:=access.resource_scope(p_operation,p_resource,p_membership);
  bound_resource:=coalesce(p_resource,target_scope);
  insert into access.actionproof(token_hash,actor_id,session_id,membership_id,assurance_id,scope_id,operation,
    resource_id,idempotency_key,expected_version,request_hash,issued_at,expires_at)
  values(p_token_hash,p_actor,p_session,p_membership,assuranceid,target_scope,p_operation,bound_resource,
    p_idempotency,p_expected_version,p_request_hash,clock_timestamp(),expiry);
  return query select target_scope,bound_resource,expiry;
end $function$;

create or replace function access.consume_action_proof(
  p_token_hash text,p_actor text,p_session text,p_membership text,p_scope text,p_operation text,
  p_resource text,p_idempotency text,p_expected_version bigint,p_request_hash text
) returns boolean language plpgsql volatile security definer
set search_path=access,identity,capability,pg_temp as $function$
declare consumed boolean:=false;
begin
  update access.actionproof proof set consumed_at=clock_timestamp()
  where proof.token_hash=p_token_hash and proof.actor_id=p_actor and proof.session_id=p_session
    and proof.membership_id=p_membership and proof.scope_id=p_scope and proof.operation=p_operation
    and proof.resource_id=p_resource and proof.idempotency_key=p_idempotency
    and proof.expected_version is not distinct from p_expected_version
    and proof.request_hash=p_request_hash
    and proof.consumed_at is null and proof.expires_at>clock_timestamp()
    and exists(select 1 from identity.session session
      join identity.principal principal on principal.id=session.principal_id
      join access.membership membership on membership.id=session.membership_id
      where session.id=p_session and session.principal_id=p_actor and session.membership_id=p_membership
      and session.revoked_at is null and session.expires_at>clock_timestamp() and session.assurance_level>=3
      and principal.status='active' and session.credential_version=principal.credential_version
      and membership.status='active' and session.access_version=membership.access_version
      and exists(select 1 from capability.membership_operations(p_membership) granted
        join capability.operation operation on operation.operation_id=granted.operation_id
        join capability.capability capability on capability.id=operation.capability_id and capability.status='active'
        left join access.permission permission on permission.code=operation.permission_code
        where granted.operation_id=p_operation
          and (operation.permission_code is null or permission.status='active')))
    and exists(select 1 from identity.assurance assurance where assurance.id=proof.assurance_id
      and assurance.principal_id=p_actor and assurance.session_id=p_session and assurance.level=3
      and (assurance.expires_at is null or assurance.expires_at>clock_timestamp()));
  consumed:=found;
  if consumed and p_operation in('finance.reconciliationrepairs.submit',
      'finance.reconciliationrepairs.decide','finance.reconciliationrepairs.reverse')
  then
    insert into access.repairactionauthorization(transaction_id,actor_id,scope_id,operation,
      resource_id,idempotency_key,expected_version,request_hash)
    values(txid_current(),p_actor,p_scope,p_operation,p_resource,p_idempotency,p_expected_version,p_request_hash);
  end if;
  return consumed;
end $function$;

create or replace function finance.require_repair_action_proof(
  p_operation text,p_resource text,p_scope text,p_actor text,p_idempotency text,p_expected_version bigint,
  p_request_hash text
) returns boolean language plpgsql volatile security definer
set search_path=access,finance,pg_temp as $function$
declare accepted boolean:=false;
begin
  if current_setting('app.workload',true)<>'api'
    or current_setting('app.scope_id',true) is distinct from p_scope
    or current_setting('app.actor_id',true) is distinct from p_actor
    or not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_REPAIR_CONTEXT_INVALID'; end if;
  delete from access.repairactionauthorization marker
  where marker.transaction_id=txid_current()
    and marker.actor_id=p_actor and marker.scope_id=p_scope
    and marker.operation=p_operation and marker.resource_id=p_resource
    and marker.idempotency_key=p_idempotency
    and marker.expected_version=p_expected_version
    and marker.request_hash=p_request_hash
  returning true into accepted;
  if accepted is not true then raise exception 'ACTION_PROOF_REQUIRED'; end if;
  return true;
end $function$;

create or replace function finance.assert_expected_version(
  p_operation text,p_resource text,p_scope text,p_expected_version bigint
) returns boolean language plpgsql volatile security definer
set search_path=finance,invoice,pg_temp as $function$
declare valid boolean:=false;
begin
  if p_expected_version is null then raise exception 'EXPECTED_VERSION_REQUIRED'; end if;
  if p_expected_version<0 then raise exception 'EXPECTED_VERSION_INVALID'; end if;

  if p_operation in('finance.reconciliations.manage','finance.reconciliationrepairs.preview') then
    select true into valid from finance.reconciliation where id=p_resource and scope_id=p_scope
      and version=p_expected_version for update;
  elsif p_operation in('finance.reconciliationrepairs.submit','finance.reconciliationrepairs.decide',
      'finance.reconciliationrepairs.reverse') then
    select true into valid from finance.reconciliationrepair where id=p_resource and scope_id=p_scope
      and version=p_expected_version for update;
  elsif p_operation in('finance.settlements.decide','finance.settlements.adjust',
      'finance.withdrawals.create','invoice.requests.create') then
    select true into valid from finance.settlement where id=p_resource and scope_id=p_scope
      and version=p_expected_version for update;
  elsif p_operation in('finance.withdrawals.decide','finance.withdrawals.recover') then
    select true into valid from finance.withdrawal where id=p_resource and scope_id=p_scope
      and version=p_expected_version for update;
  elsif p_operation='finance.periods.manage' then
    select true into valid from finance.periodclose where scope_id=p_scope and period=p_resource
      and version=p_expected_version for update;
    if valid is not true and p_expected_version=0 and exists(select 1 from finance.period where scope_id=p_scope and period=p_resource)
      and not exists(select 1 from finance.periodclose where scope_id=p_scope and period=p_resource)
    then valid:=true; end if;
  elsif p_operation='finance.backfills.decide' then
    select true into valid from finance.backfill where id=p_resource and scope_id=p_scope
      and version=p_expected_version for update;
  elsif p_operation='finance.policies.manage' then
    select true into valid from finance.policy where id=p_resource and scope_id=p_scope
      and version=p_expected_version for update;
    if valid is not true and p_expected_version=0 and not exists(select 1 from finance.policy where id=p_resource)
    then valid:=true; end if;
  elsif p_operation='invoice.profiles.manage' then
    select true into valid from invoice.profile where id=p_resource and owner_id=p_scope
      and version=p_expected_version for update;
    if valid is not true and p_expected_version=0 and not exists(select 1 from invoice.profile where id=p_resource)
    then valid:=true; end if;
  elsif p_operation in('invoice.requests.cancel','invoice.requests.decide','invoice.requests.red') then
    select true into valid from invoice.request request join invoice.requestprofile profile on profile.request_id=request.id
      where request.id=p_resource and profile.owner_id=p_scope and request.version=p_expected_version for update of request;
  else
    raise exception 'EXPECTED_VERSION_INVALID';
  end if;
  if valid is not true then raise exception 'VERSION_CONFLICT'; end if;
  return true;
end $function$;

create or replace function finance.reject_reconciliation_repair_fact_mutation()
returns trigger language plpgsql set search_path=finance,pg_temp as $function$
begin
  raise exception 'FINANCE_REPAIR_FACT_IMMUTABLE';
end $function$;

create trigger finance_reconciliationrepair_guard before update or delete
on finance.reconciliationrepair for each row execute function finance.guard_reconciliation_repair();
create trigger finance_reconciliationrepairline_immutable before update or delete
on finance.reconciliationrepairline for each row execute function finance.reject_reconciliation_repair_fact_mutation();
create trigger finance_reconciliationrepaireffect_immutable before update or delete
on finance.reconciliationrepaireffect for each row execute function finance.reject_reconciliation_repair_fact_mutation();

create or replace function finance.guard_repair_journal_write()
returns trigger language plpgsql security definer
set search_path=finance,pg_temp as $function$
declare accepted boolean:=false;
begin
  if current_setting('app.workload',true)='api'
    and new.reference_type in('payment.succeeded','payment.refunded')
  then
    delete from finance.reconciliationrepairauthorization marker
    where marker.transaction_id=txid_current()
      and marker.action='execute'
      and marker.scope_id=new.scope_id
      and marker.reference_type=new.reference_type
      and marker.reference_id=new.reference_id
    returning true into accepted;
    if accepted is not true then raise exception 'FINANCE_REPAIR_JOURNAL_PROOF_REQUIRED'; end if;
  elsif current_setting('app.workload',true)='api'
    and new.reference_type='finance.journal.reversal'
    and exists(select 1 from finance.reconciliationrepaireffect effect
      where effect.kind='execute' and effect.journal_id=new.reversal_of)
  then
    delete from finance.reconciliationrepairauthorization marker
    where marker.transaction_id=txid_current()
      and marker.action='reverse'
      and marker.scope_id=new.scope_id
      and marker.reference_type=new.reference_type
      and marker.reference_id=new.reference_id
      and marker.journal_id=new.reversal_of
    returning true into accepted;
    if accepted is not true then raise exception 'FINANCE_REPAIR_REVERSAL_PROOF_REQUIRED'; end if;
  end if;
  return new;
end $function$;

create trigger finance_repair_journal_write before insert on finance.journal
for each row execute function finance.guard_repair_journal_write();

-- Reconstruct the only repair supported in the first release.  A candidate is
-- accepted only when one normal WeChat payment/refund tender is present, all
-- scope/currency/allocation/provider facts agree, the statement line agrees,
-- and the expected journal is actually absent.
create or replace function finance.reconciliation_repair_snapshot(
  p_reconciliation text,p_item text,p_scope text
) returns table(
  reconciliation_version bigint,item_version bigint,source_hash char(64),target_hash char(64),
  reference_type text,reference_id text,currency text,description text,
  debit_code text,debit_kind text,credit_code text,credit_kind text,
  amount_minor bigint,occurred_at timestamptz,period text
) language plpgsql volatile security definer
set search_path=finance,payment,ordering,channel,pg_temp as $function$
declare
  reconciliationrow finance.reconciliation%rowtype;
  itemrow finance.reconciliationitem%rowtype;
  linerow finance.statementline%rowtype;
  providerstatement channel.statement%rowtype;
  ledgerrow finance.ledger%rowtype;
  fact record;
  periodstate text;
  periodid text;
  sourcetext text;
  targettext text;
  plannedreferencetype text;
  plannedreferenceid text;
  plannedcurrency text;
begin
  select * into reconciliationrow from finance.reconciliation
  where id=p_reconciliation and scope_id=p_scope for update;
  if reconciliationrow.id is null then raise exception 'FINANCE_REPAIR_RECONCILIATION_NOT_FOUND'; end if;
  select * into itemrow from finance.reconciliationitem
  where id=p_item and reconciliation_id=p_reconciliation and scope_id=p_scope for update;
  if itemrow.id is null then raise exception 'FINANCE_REPAIR_ITEM_NOT_FOUND'; end if;
  if reconciliationrow.state<>'difference'
    or itemrow.state not in('difference','resolutionpending')
    or itemrow.reason_code<>'INTERNAL_JOURNAL_MISSING'
    or itemrow.statement_line_id is null
    or itemrow.internal_type is distinct from itemrow.kind
    or itemrow.internal_id is null
    or itemrow.external_minor<=0
    or itemrow.external_minor<>itemrow.internal_minor
    or itemrow.difference_minor<>0
    or reconciliationrow.provider<>'wechat'
  then raise exception 'FINANCE_REPAIR_FACT_UNSUPPORTED'; end if;

  select * into linerow from finance.statementline
  where id=itemrow.statement_line_id and reconciliation_id=p_reconciliation
    and scope_id=p_scope and kind=itemrow.kind for share;
  select * into providerstatement from channel.statement
  where id=reconciliationrow.statement_ref and scope_id=p_scope
    and provider=reconciliationrow.provider and partner_id=reconciliationrow.partner_id
    and sha256=reconciliationrow.statement_hash for share;
  if linerow.id is null or providerstatement.id is null
    or linerow.amount_minor<>itemrow.external_minor or linerow.currency<>'CNY'
  then raise exception 'FINANCE_REPAIR_STATEMENT_STALE'; end if;

  if itemrow.kind='payment' then
    select payment.id,payment.amount_minor payment_total,payment.currency,intent.id intent_id,intent.order_id,orders.scope_id,
      tender.tender_count,tender.tender_minor,allocation.allocation_count,allocation.allocation_minor,
      capture.id capture_id,capture.amount_minor capture_minor,capture.currency capture_currency,
      capture.source capture_source,capture.provider_occurred_at capture_occurred_at,
      capture.provider_effect capture_effect,capture.provider_effect_hash capture_effect_hash,
      provider.attempt_count,provider.attempt_id,provider.provider_reference,
      provider.provider_occurred_at,provider.provider_effect,provider.provider_effect_hash
    into fact
    from payment.payment payment
    join payment.intent intent on intent.id=payment.intent_id
    join ordering.orderrecord orders on orders.id=intent.order_id
    left join payment.capture capture on capture.id='capture:'||intent.id
      and capture.order_id=orders.id and capture.scope_id=orders.scope_id and capture.state='succeeded'
    cross join lateral(select count(*)::integer tender_count,coalesce(sum(candidate.amount_minor),0)::bigint tender_minor
      from payment.intenttender candidate where candidate.intent_id=intent.id
        and candidate.kind='wechat' and candidate.state='captured') tender
    cross join lateral(select count(*)::integer allocation_count,coalesce(sum(candidate.amount_minor),0)::bigint allocation_minor
      from payment.allocation candidate where candidate.payment_id=payment.id) allocation
    cross join lateral(select count(*)::integer attempt_count,max(attempt.id) attempt_id,
      max(attempt.external_transaction) provider_reference,max(attempt.provider_occurred_at) provider_occurred_at,
      max(attempt.provider_effect::text)::jsonb provider_effect,max(attempt.provider_effect_hash) provider_effect_hash
      from payment.attempt attempt where attempt.intent_id=intent.id
        and attempt.provider='wechat' and attempt.state='succeeded') provider
    where payment.id=itemrow.internal_id and payment.state in('captured','partially_refunded','refunded');
    if fact.id is not null and (fact.provider_occurred_at is null or fact.provider_effect is null
      or fact.provider_effect_hash is null or fact.capture_occurred_at is null
      or fact.capture_effect is null or fact.capture_effect_hash is null)
    then raise exception 'PROVIDER_TIME_UNAVAILABLE'; end if;
    if fact.id is null or fact.scope_id<>p_scope or fact.currency<>'CNY'
      or fact.tender_count<>1 or fact.tender_minor<>itemrow.internal_minor
      or fact.allocation_count<>1 or fact.allocation_minor<>fact.payment_total
      or fact.capture_id is null or fact.capture_currency<>fact.currency
      or fact.capture_minor<>fact.payment_total or fact.capture_source='latewechat'
      or fact.attempt_count<>1 or fact.provider_reference<>linerow.external_reference
      or fact.provider_occurred_at is null or fact.capture_occurred_at is null
      or fact.provider_occurred_at<>fact.capture_occurred_at
      or linerow.occurred_at is distinct from fact.provider_occurred_at
      or fact.provider_effect is null or fact.provider_effect_hash is null
      or fact.capture_effect is null or fact.capture_effect_hash is null
      or fact.provider_effect_hash<>encode(public.digest(fact.provider_effect::text,'sha256'),'hex')
      or fact.capture_effect_hash<>encode(public.digest(fact.capture_effect::text,'sha256'),'hex')
      or fact.provider_effect_hash<>fact.capture_effect_hash
      or fact.provider_effect is distinct from fact.capture_effect
      or coalesce(fact.provider_effect->>'provider','')<>'wechat'
      or coalesce(fact.provider_effect->>'kind','')<>'payment.capture'
      or coalesce(fact.provider_effect->>'intent','')<>fact.intent_id
      or coalesce(fact.provider_effect->>'order','')<>fact.order_id
      or coalesce(fact.provider_effect->>'transaction','')<>fact.provider_reference
      or coalesce(fact.provider_effect->>'providerAmountMinor','')<>fact.tender_minor::text
      or coalesce(fact.provider_effect->>'aggregateAmountMinor','')<>fact.payment_total::text
      or coalesce(fact.provider_effect->>'currency','')<>fact.currency
      or not (fact.provider_effect ? 'occurredAt')
      or (fact.provider_effect->>'occurredAt')::timestamptz<>fact.provider_occurred_at
    then raise exception 'FINANCE_REPAIR_PAYMENT_FACT_STALE'; end if;
    plannedreferencetype:='payment.succeeded';
    plannedreferenceid:=fact.id;
    plannedcurrency:=fact.currency;
    description:='External payment capture';
    debit_code:='channel.clearing.wechat'; debit_kind:='asset';
    credit_code:='order.receivable.'||fact.order_id; credit_kind:='asset';
    amount_minor:=fact.tender_minor; occurred_at:=fact.provider_occurred_at;
    sourcetext:=jsonb_build_object(
      'reconciliation',reconciliationrow.id,'statement',providerstatement.id,
      'statementHash',reconciliationrow.statement_hash,'line',linerow.id,'lineHash',linerow.raw_hash,
      'externalReference',linerow.external_reference,'kind',itemrow.kind,'internalId',itemrow.internal_id,
      'externalMinor',itemrow.external_minor,'internalMinor',itemrow.internal_minor,
      'paymentTotalMinor',fact.payment_total,'tenderMinor',fact.tender_minor,
      'allocationCount',fact.allocation_count,'allocationMinor',fact.allocation_minor,
      'capture',fact.capture_id,'captureMinor',fact.capture_minor,
      'providerAttempt',fact.attempt_id,'providerReference',fact.provider_reference,
      'providerAttemptHash',fact.provider_effect_hash,'providerCaptureHash',fact.capture_effect_hash,
      'occurredAt',to_char(fact.provider_occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')
    )::text;
  elsif itemrow.kind='refund' then
    select refund.id,refund.amount_minor refund_total,refund.currency,payment.id payment_id,intent.id intent_id,
      intent.order_id,orders.scope_id,
      tender.tender_count,tender.tender_minor,tender.provider_references,
      capturedtender.tender_count captured_tender_count,capturedtender.tender_minor captured_tender_minor,
      allocation.allocation_count,allocation.allocation_minor,payment.amount_minor payment_total,
      capture.id capture_id,capture.source capture_source,capture.amount_minor capture_minor,
      capture.currency capture_currency,capture.provider_occurred_at capture_occurred_at,
      capture.provider_effect capture_effect,capture.provider_effect_hash capture_effect_hash,
      captureprovider.provider_record_count capture_provider_record_count,
      captureprovider.attempt_id capture_attempt_id,captureprovider.provider_reference capture_provider_reference,
      captureprovider.provider_occurred_at capture_attempt_occurred_at,
      captureprovider.provider_effect capture_attempt_effect,
      captureprovider.provider_effect_hash capture_attempt_effect_hash,
      provider.provider_record_count,provider.attempt_id,provider.provider_reference,
      provider.provider_occurred_at,provider.provider_effect,provider.provider_effect_hash
    into fact
    from payment.refund refund
    join payment.payment payment on payment.id=refund.payment_id
    join payment.intent intent on intent.id=payment.intent_id
    join ordering.orderrecord orders on orders.id=intent.order_id
    left join payment.capture capture on capture.id='capture:'||intent.id
      and capture.order_id=orders.id and capture.scope_id=orders.scope_id and capture.state='succeeded'
    cross join lateral(select count(*)::integer tender_count,coalesce(sum(candidate.amount_minor),0)::bigint tender_minor,
      coalesce(array_agg(distinct candidate.provider_reference order by candidate.provider_reference)
        filter(where candidate.provider_reference is not null and candidate.provider_reference<>''),array[]::text[]) provider_references
      from payment.refundtender candidate where candidate.refund_id=refund.id
        and candidate.kind='wechat' and candidate.state='succeeded') tender
    cross join lateral(select count(*)::integer tender_count,coalesce(sum(candidate.amount_minor),0)::bigint tender_minor
      from payment.intenttender candidate where candidate.intent_id=intent.id
        and candidate.kind='wechat' and candidate.state='captured') capturedtender
    cross join lateral(select count(*)::integer allocation_count,coalesce(sum(candidate.amount_minor),0)::bigint allocation_minor
      from payment.allocation candidate where candidate.payment_id=payment.id) allocation
    cross join lateral(select count(*)::integer provider_record_count,max(attempt.id) attempt_id,
      max(attempt.external_transaction) provider_reference,max(attempt.provider_occurred_at) provider_occurred_at,
      max(attempt.provider_effect::text)::jsonb provider_effect,max(attempt.provider_effect_hash) provider_effect_hash
      from payment.attempt attempt where attempt.intent_id=intent.id
        and attempt.provider='wechat' and attempt.state='succeeded') captureprovider
    cross join lateral(select count(*)::integer provider_record_count,max(attempt.id) attempt_id,
      max(attempt.provider_reference) provider_reference,max(attempt.provider_occurred_at) provider_occurred_at,
      max(attempt.provider_effect::text)::jsonb provider_effect,max(attempt.provider_effect_hash) provider_effect_hash
      from payment.providerattempt attempt where attempt.refund_id=refund.id and attempt.outcome='succeeded'
        and attempt.provider_state='succeeded') provider
    where refund.id=itemrow.internal_id and refund.state='succeeded'
      and payment.state in('captured','partially_refunded','refunded');
    if fact.id is not null and (fact.provider_occurred_at is null or fact.provider_effect is null
      or fact.provider_effect_hash is null or fact.capture_occurred_at is null
      or fact.capture_effect is null or fact.capture_effect_hash is null
      or fact.capture_attempt_occurred_at is null or fact.capture_attempt_effect is null
      or fact.capture_attempt_effect_hash is null)
    then raise exception 'PROVIDER_TIME_UNAVAILABLE'; end if;
    if fact.id is null or fact.scope_id<>p_scope or fact.currency<>'CNY'
      or fact.tender_count<>1 or fact.tender_minor<>itemrow.internal_minor
      or fact.captured_tender_count<>1 or fact.captured_tender_minor<=0
      or fact.tender_minor>fact.captured_tender_minor
      or fact.allocation_count<>1 or fact.allocation_minor<>fact.payment_total
      or fact.capture_id is null or fact.capture_source='latewechat'
      or fact.capture_minor<>fact.payment_total or fact.capture_currency<>fact.currency
      or fact.capture_provider_record_count<>1 or fact.capture_provider_reference is null
      or fact.provider_record_count<>1 or fact.provider_reference<>linerow.external_reference
      or not (fact.provider_reference=any(fact.provider_references))
      or fact.provider_occurred_at is null or linerow.occurred_at is distinct from fact.provider_occurred_at
      or fact.provider_effect is null or fact.provider_effect_hash is null
      or fact.provider_effect_hash<>encode(public.digest(fact.provider_effect::text,'sha256'),'hex')
      or coalesce(fact.provider_effect->>'provider','')<>'wechat'
      or coalesce(fact.provider_effect->>'kind','')<>'payment.refund'
      or coalesce(fact.provider_effect->>'refund','')<>fact.id
      or coalesce(fact.provider_effect->>'payment','')<>fact.payment_id
      or coalesce(fact.provider_effect->>'reference','')<>fact.provider_reference
      or coalesce(fact.provider_effect->>'amountMinor','')<>fact.tender_minor::text
      or coalesce(fact.provider_effect->>'totalMinor','')<>fact.captured_tender_minor::text
      or coalesce(fact.provider_effect->>'currency','')<>fact.currency
      or not (fact.provider_effect ? 'occurredAt')
      or (fact.provider_effect->>'occurredAt')::timestamptz<>fact.provider_occurred_at
      or fact.capture_occurred_at is null or fact.capture_effect is null or fact.capture_effect_hash is null
      or fact.capture_effect_hash<>encode(public.digest(fact.capture_effect::text,'sha256'),'hex')
      or fact.capture_attempt_effect_hash<>encode(public.digest(fact.capture_attempt_effect::text,'sha256'),'hex')
      or fact.capture_effect_hash<>fact.capture_attempt_effect_hash
      or fact.capture_effect is distinct from fact.capture_attempt_effect
      or fact.capture_occurred_at<>fact.capture_attempt_occurred_at
      or coalesce(fact.capture_effect->>'provider','')<>'wechat'
      or coalesce(fact.capture_effect->>'kind','')<>'payment.capture'
      or coalesce(fact.capture_effect->>'intent','')<>fact.intent_id
      or coalesce(fact.capture_effect->>'order','')<>fact.order_id
      or coalesce(fact.capture_effect->>'transaction','')<>fact.capture_provider_reference
      or coalesce(fact.capture_effect->>'providerAmountMinor','')<>fact.captured_tender_minor::text
      or coalesce(fact.capture_effect->>'aggregateAmountMinor','')<>fact.payment_total::text
      or coalesce(fact.capture_effect->>'currency','')<>fact.currency
      or not (fact.capture_effect ? 'occurredAt')
      or (fact.capture_effect->>'occurredAt')::timestamptz<>fact.capture_occurred_at
    then raise exception 'FINANCE_REPAIR_REFUND_FACT_STALE'; end if;
    plannedreferencetype:='payment.refunded';
    plannedreferenceid:=fact.id;
    plannedcurrency:=fact.currency;
    description:='External payment refund';
    debit_code:='commerce.refund'; debit_kind:='expense';
    credit_code:='channel.clearing.wechat'; credit_kind:='asset';
    amount_minor:=fact.tender_minor; occurred_at:=fact.provider_occurred_at;
    sourcetext:=jsonb_build_object(
      'reconciliation',reconciliationrow.id,'statement',providerstatement.id,
      'statementHash',reconciliationrow.statement_hash,'line',linerow.id,'lineHash',linerow.raw_hash,
      'externalReference',linerow.external_reference,'kind',itemrow.kind,'internalId',itemrow.internal_id,
      'externalMinor',itemrow.external_minor,'internalMinor',itemrow.internal_minor,
      'refundTotalMinor',fact.refund_total,'paymentTotalMinor',fact.payment_total,
      'tenderMinor',fact.tender_minor,'providerTotalMinor',fact.captured_tender_minor,
      'allocationCount',fact.allocation_count,
      'allocationMinor',fact.allocation_minor,'capture',fact.capture_id,
      'captureProviderAttempt',fact.capture_attempt_id,'captureProviderReference',fact.capture_provider_reference,
      'providerAttempt',fact.attempt_id,'providerReference',fact.provider_reference,
      'providerCaptureAttemptHash',fact.capture_attempt_effect_hash,
      'providerRefundHash',fact.provider_effect_hash,'providerCaptureHash',fact.capture_effect_hash,
      'occurredAt',to_char(fact.provider_occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')
    )::text;
  else
    raise exception 'FINANCE_REPAIR_FACT_UNSUPPORTED';
  end if;

  if exists(select 1 from finance.journal journal where journal.scope_id=p_scope
    and journal.reference_type=plannedreferencetype and journal.reference_id=plannedreferenceid)
  then raise exception 'FINANCE_REPAIR_SOURCE_ALREADY_POSTED'; end if;
  select * into ledgerrow from finance.ledger ledger
  where ledger.id=finance.ledger_id(p_scope,plannedcurrency) and ledger.state='active' for share;
  if ledgerrow.id is null then raise exception 'FINANCE_LEDGER_NOT_ACTIVE'; end if;
  periodid:=to_char(occurred_at at time zone ledgerrow.legal_timezone,'YYYY-MM');
  select target.state into periodstate from finance.period target
  where target.scope_id=p_scope and target.period=periodid for share;
  if periodstate is distinct from 'open' then raise exception 'FINANCE_PERIOD_NOT_OPEN'; end if;

  reference_type:=plannedreferencetype;
  reference_id:=plannedreferenceid;
  currency:=plannedcurrency;
  targettext:=jsonb_build_object('referenceType',reference_type,'referenceId',reference_id,
    'currency',currency,'description',description,'debitCode',debit_code,'debitKind',debit_kind,
    'creditCode',credit_code,'creditKind',credit_kind,'amountMinor',amount_minor,
    'occurredAt',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'))::text;
  reconciliation_version:=reconciliationrow.version;
  item_version:=itemrow.version;
  source_hash:=encode(public.digest(sourcetext,'sha256'),'hex');
  target_hash:=encode(public.digest(targettext,'sha256'),'hex');
  period:=periodid;
  return next;
end $function$;

create or replace function finance.submit_reconciliation_repair(
  p_repair text,p_scope text,p_actor text,p_idempotency text,p_expected_version bigint,p_preview_hash text,
  p_request_hash text
) returns jsonb language plpgsql volatile security definer
set search_path=finance,access,pg_temp as $function$
declare
  repair finance.reconciliationrepair%rowtype;
  plan record;
  changed bigint;
  submittedat timestamptz:=clock_timestamp();
begin
  if p_repair is null or p_repair='' or p_scope is null or p_scope='' or p_actor is null or p_actor=''
    or p_idempotency is null or p_idempotency='' or length(p_idempotency)>255
    or p_expected_version is null or p_expected_version<0
    or p_preview_hash is null or p_preview_hash!~'^[0-9a-f]{64}$'
    or p_request_hash is null or p_request_hash!~'^[0-9a-f]{64}$'
  then raise exception 'FINANCE_REPAIR_SUBMIT_INVALID'; end if;
  if current_setting('app.workload',true)<>'api'
    or current_setting('app.scope_id',true) is distinct from p_scope
    or current_setting('app.actor_id',true) is distinct from p_actor
    or not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_REPAIR_CONTEXT_INVALID'; end if;

  select * into repair from finance.reconciliationrepair
  where id=p_repair and scope_id=p_scope for update;
  if repair.id is null then raise exception 'FINANCE_REPAIR_NOT_FOUND'; end if;
  if repair.submit_idempotency=p_idempotency then
    if repair.submitted_by<>p_actor or repair.submit_expected_version<>p_expected_version
      or repair.preview_hash<>p_preview_hash
    then raise exception 'FINANCE_REPAIR_IDEMPOTENCY_MISMATCH'; end if;
    return finance.reconciliation_repair_receipt(p_repair,p_scope);
  end if;
  if repair.state<>'preview' or repair.version<>p_expected_version
    or repair.proposed_by<>p_actor or repair.preview_hash<>p_preview_hash
  then raise exception 'VERSION_CONFLICT'; end if;
  if repair.expires_at<=submittedat then raise exception 'FINANCE_REPAIR_PREVIEW_EXPIRED'; end if;
  perform finance.require_repair_action_proof('finance.reconciliationrepairs.submit',
    p_repair,p_scope,p_actor,p_idempotency,p_expected_version,p_request_hash);

  select * into plan from finance.reconciliation_repair_snapshot(
    repair.reconciliation_id,repair.item_id,p_scope);
  if plan.source_hash<>repair.source_hash or plan.target_hash<>repair.target_hash
    or plan.reconciliation_version<>repair.source_reconciliation_version
    or plan.item_version<>repair.source_item_version
  then raise exception 'FINANCE_REPAIR_SNAPSHOT_STALE'; end if;
  if not exists(
    select 1 from finance.reconciliationrepairline line where line.repair_id=repair.id
    group by line.repair_id having count(*)=2
      and sum(case line.side when 'debit' then line.amount_minor else -line.amount_minor end)=0
      and bool_and(line.amount_minor=plan.amount_minor and line.currency=plan.currency)
      and bool_or(line.side='debit' and line.account_code=plan.debit_code and line.account_kind=plan.debit_kind)
      and bool_or(line.side='credit' and line.account_code=plan.credit_code and line.account_kind=plan.credit_kind)
  ) then raise exception 'FINANCE_REPAIR_PLAN_STALE'; end if;

  update finance.reconciliationitem item set
    state='resolutionpending',resolution=jsonb_build_object(
      'kind','authoritative_repair','repair',repair.id,'previewHash',repair.preview_hash,
      'sourceHash',repair.source_hash,'targetHash',repair.target_hash),
    resolved_by=p_actor,resolved_at=submittedat,version=version+1
  where item.id=repair.item_id and item.reconciliation_id=repair.reconciliation_id
    and item.scope_id=p_scope and item.state='difference'
    and item.reason_code='INTERNAL_JOURNAL_MISSING' and item.version=repair.source_item_version;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'FINANCE_REPAIR_ITEM_STALE'; end if;
  update finance.reconciliation reconciliation set version=version+1,updated_at=submittedat
  where reconciliation.id=repair.reconciliation_id and reconciliation.scope_id=p_scope
    and reconciliation.state='difference' and reconciliation.version=repair.source_reconciliation_version;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'FINANCE_REPAIR_RECONCILIATION_STALE'; end if;
  update finance.reconciliationrepair set
    state='submitted',submitted_by=p_actor,submitted_at=submittedat,
    submitted_reconciliation_version=repair.source_reconciliation_version+1,
    submitted_item_version=repair.source_item_version+1,
    submit_idempotency=p_idempotency,submit_expected_version=p_expected_version,
    updated_at=submittedat,version=version+1
  where id=repair.id and scope_id=p_scope and state='preview' and version=p_expected_version;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'VERSION_CONFLICT'; end if;
  return finance.reconciliation_repair_receipt(p_repair,p_scope);
end $function$;

create or replace function finance.reverse_reconciliation_repair(
  p_repair text,p_scope text,p_actor text,p_idempotency text,p_expected_version bigint,p_reason text,
  p_request_hash text
) returns jsonb language plpgsql volatile security definer
set search_path=finance,access,public,pg_temp as $function$
declare
  repair finance.reconciliationrepair%rowtype;
  execution finance.reconciliationrepaireffect%rowtype;
  original finance.journal%rowtype;
  reversal finance.journal%rowtype;
  ledger finance.ledger%rowtype;
  reversalid text;
  reversalreference text;
  reversalperiod text;
  targethash char(64);
  receipthash char(64);
  changed bigint;
  reversedat timestamptz:=clock_timestamp();
begin
  if p_repair is null or p_repair='' or p_scope is null or p_scope='' or p_actor is null or p_actor=''
    or p_idempotency is null or p_idempotency='' or length(p_idempotency)>255
    or p_expected_version is null or p_expected_version<0
    or p_reason is null or p_reason='' or length(p_reason)>1000
    or p_request_hash is null or p_request_hash!~'^[0-9a-f]{64}$'
  then raise exception 'FINANCE_REPAIR_REVERSE_INVALID'; end if;
  if current_setting('app.workload',true)<>'api'
    or current_setting('app.scope_id',true) is distinct from p_scope
    or current_setting('app.actor_id',true) is distinct from p_actor
    or not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_REPAIR_CONTEXT_INVALID'; end if;
  select * into repair from finance.reconciliationrepair
  where id=p_repair and scope_id=p_scope for update;
  if repair.id is null then raise exception 'FINANCE_REPAIR_NOT_FOUND'; end if;
  if repair.reverse_idempotency=p_idempotency then
    if repair.reverse_expected_version<>p_expected_version or repair.reversed_by<>p_actor
      or repair.reverse_reason<>p_reason
    then raise exception 'FINANCE_REPAIR_IDEMPOTENCY_MISMATCH'; end if;
    return finance.reconciliation_repair_receipt(p_repair,p_scope);
  end if;
  if repair.state<>'executed' or repair.version<>p_expected_version
  then raise exception 'VERSION_CONFLICT'; end if;
  if p_actor=repair.proposed_by then raise exception 'FINANCE_REPAIR_FOUR_EYES_REQUIRED'; end if;
  if not exists(select 1 from finance.reconciliation reconciliation
      where reconciliation.id=repair.reconciliation_id and reconciliation.scope_id=p_scope
        and reconciliation.state in('balanced','difference') for update)
    or exists(select 1 from finance.settlement settlement
      where settlement.reconciliation_id=repair.reconciliation_id and settlement.scope_id=p_scope)
  then raise exception 'FINANCE_REPAIR_DOWNSTREAM_LOCKED'; end if;
  perform finance.require_repair_action_proof('finance.reconciliationrepairs.reverse',
    p_repair,p_scope,p_actor,p_idempotency,p_expected_version,p_request_hash);

  select * into execution from finance.reconciliationrepaireffect
  where repair_id=repair.id and scope_id=p_scope and kind='execute' for share;
  select * into original from finance.journal
  where id=execution.journal_id and scope_id=p_scope and state='posted' for update;
  if execution.id is null or original.id is null
    or execution.source_hash<>repair.source_hash or execution.target_hash<>repair.target_hash
    or not exists(select 1 from finance.reconciliationrepairline line where line.repair_id=repair.id
      group by line.repair_id having count(*)=2
        and sum(case line.side when 'debit' then line.amount_minor else -line.amount_minor end)=0)
    or exists(select 1 from finance.reconciliationrepairline line where line.repair_id=repair.id
      and not exists(select 1 from finance.entry entry join finance.account account on account.id=entry.account_id
        where entry.journal_id=original.id and account.scope_id=p_scope and account.currency=line.currency
          and account.code=line.account_code and account.kind=line.account_kind
          and entry.side=line.side and entry.amount_minor=line.amount_minor))
  then raise exception 'FINANCE_REPAIR_EXECUTION_STALE'; end if;
  select * into ledger from finance.ledger
  where id=finance.ledger_id(p_scope,original.currency) and state='active' for share;
  if ledger.id is null then raise exception 'FINANCE_LEDGER_NOT_ACTIVE'; end if;
  reversalperiod:=to_char(reversedat at time zone ledger.legal_timezone,'YYYY-MM');
  if not exists(select 1 from finance.period where scope_id=p_scope and period=reversalperiod
    and state='open' for share)
  then raise exception 'FINANCE_PERIOD_NOT_OPEN'; end if;

  reversalreference:=repair.id||':reverse';
  insert into finance.reconciliationrepairauthorization(
    transaction_id,repair_id,action,scope_id,reference_type,reference_id,journal_id
  ) values(txid_current(),repair.id,'reverse',p_scope,'finance.journal.reversal',reversalreference,original.id);
  reversalid:=finance.reverse(p_scope,original.id,reversalreference,p_reason,p_actor,reversedat);
  select * into reversal from finance.journal where id=reversalid and scope_id=p_scope and state='posted';
  if reversal.id is null or reversal.reversal_of<>original.id
    or reversal.reference_type<>'finance.journal.reversal' or reversal.reference_id<>reversalreference
    or reversal.currency<>original.currency or reversal.posted_at<>reversedat
    or (select count(*) from finance.entry entry where entry.journal_id=reversal.id)<>
      (select count(*) from finance.entry entry where entry.journal_id=original.id)
    or exists(select 1 from finance.entry source where source.journal_id=original.id and not exists(
      select 1 from finance.entry target where target.journal_id=reversal.id and target.account_id=source.account_id
        and target.side=case source.side when 'debit' then 'credit' else 'debit' end
        and target.amount_minor=source.amount_minor))
  then raise exception 'FINANCE_REPAIR_REVERSAL_MISMATCH'; end if;
  targethash:=reversal.source_hash;
  receipthash:=encode(public.digest(jsonb_build_object(
    'repair',repair.id,'kind','reverse','journal',reversal.id,'reversalOf',original.id,
    'sourceHash',execution.receipt_hash,'targetHash',targethash,'actor',p_actor,'reason',p_reason
  )::text,'sha256'),'hex');
  insert into finance.reconciliationrepaireffect(
    id,repair_id,scope_id,kind,journal_id,source_hash,target_hash,receipt_hash,
    actor_id,reason,occurred_at,created_at
  ) values(
    'repaireffect:'||substr(encode(public.digest(repair.id||':reverse','sha256'),'hex'),1,40),
    repair.id,p_scope,'reverse',reversal.id,execution.receipt_hash,targethash,receipthash,
    p_actor,p_reason,reversedat,reversedat
  );
  update finance.reconciliationitem set state='difference',reason_code='INTERNAL_JOURNAL_REVERSED',
    evidence=evidence||jsonb_build_object(
      'repair',repair.id,'repairReversalReceiptHash',receipthash,'reversalJournal',reversal.id,
      'reversalOf',original.id,'settlementEligible',false,'repairReversedAt',reversedat),
    resolution=null,resolved_by=null,resolved_at=null,approved_by=null,approved_at=null,version=version+1
  where id=repair.item_id and reconciliation_id=repair.reconciliation_id and scope_id=p_scope
    and state='matched' and reason_code is null and evidence->>'repair'=repair.id;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'FINANCE_REPAIR_ITEM_STALE'; end if;
  update finance.reconciliation set state='difference',version=version+1,updated_at=reversedat
  where id=repair.reconciliation_id and scope_id=p_scope;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'FINANCE_REPAIR_RECONCILIATION_STALE'; end if;
  update finance.reconciliationrepair set state='reversed',reversed_by=p_actor,reversed_at=reversedat,
    reverse_reason=p_reason,reverse_idempotency=p_idempotency,reverse_expected_version=p_expected_version,
    updated_at=reversedat,version=version+1
  where id=repair.id and scope_id=p_scope and state='executed' and version=p_expected_version;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'VERSION_CONFLICT'; end if;
  return finance.reconciliation_repair_receipt(p_repair,p_scope);
end $function$;

-- All repair facts are default-deny under RLS. Application access is only
-- through the five wrappers above; private snapshot/proof/journal markers stay
-- inaccessible. The reconciliation matcher keeps its existing shopjob write
-- path while the API's legacy raw item mutation path is removed.
alter table finance.reconciliationrepair enable row level security;
alter table finance.reconciliationrepairline enable row level security;
alter table finance.reconciliationrepaireffect enable row level security;
alter table finance.reconciliationrepairauthorization enable row level security;
alter table access.repairactionauthorization enable row level security;

revoke all on table finance.reconciliationrepair,finance.reconciliationrepairline,
  finance.reconciliationrepaireffect,finance.reconciliationrepairauthorization,
  access.repairactionauthorization
  from public,anon,authenticated,service_role,shopapp,shopjob;

revoke all on function
  finance.reconciliation_repair_receipt(text,text),
  finance.reconciliation_repair_snapshot(text,text,text),
  finance.require_repair_action_proof(text,text,text,text,text,bigint,text),
  finance.read_reconciliation_repair(text,text),
  finance.preview_reconciliation_repair(text,text,text,text,text,bigint,bigint,text,jsonb),
  finance.submit_reconciliation_repair(text,text,text,text,bigint,text,text),
  finance.decide_reconciliation_repair(text,text,text,text,bigint,text,text,jsonb,text),
  finance.reverse_reconciliation_repair(text,text,text,text,bigint,text,text),
  finance.guard_reconciliation_repair(),
  finance.reject_reconciliation_repair_fact_mutation(),
  finance.guard_repair_journal_write()
  from public,anon,authenticated,service_role,shopapp,shopjob;
grant execute on function
  finance.read_reconciliation_repair(text,text),
  finance.preview_reconciliation_repair(text,text,text,text,text,bigint,bigint,text,jsonb),
  finance.submit_reconciliation_repair(text,text,text,text,bigint,text,text),
  finance.decide_reconciliation_repair(text,text,text,text,bigint,text,text,jsonb,text),
  finance.reverse_reconciliation_repair(text,text,text,text,bigint,text,text)
  to shopapp;

revoke all on function finance.resource_scope(text),
  finance.assert_expected_version(text,text,text,bigint),
  access.issue_action_proof(text,text,text,text,text,text,text,text,bigint,text),
  access.consume_action_proof(text,text,text,text,text,text,text,text,bigint,text)
  from public,anon,authenticated,service_role,shopapp,shopjob;
grant execute on function finance.resource_scope(text) to shopapp,shopjob;
grant execute on function finance.assert_expected_version(text,text,text,bigint),
  access.issue_action_proof(text,text,text,text,text,text,text,text,bigint,text),
  access.consume_action_proof(text,text,text,text,text,text,text,text,bigint,text)
  to shopapp;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('finance.reconciliationrepairs.read','finance','GET','/api/v1/finance/reconciliation-repairs/{repairid}','1.0.0'),
  ('finance.reconciliationrepairs.preview','finance','POST','/api/v1/finance/reconciliations/{reconciliationid}/items/{itemid}/repairs/preview','1.0.0'),
  ('finance.reconciliationrepairs.submit','finance','POST','/api/v1/finance/reconciliation-repairs/{repairid}/submit','1.0.0'),
  ('finance.reconciliationrepairs.decide','finance','POST','/api/v1/finance/reconciliation-repairs/{repairid}/decide','1.0.0'),
  ('finance.reconciliationrepairs.reverse','finance','POST','/api/v1/finance/reconciliation-repairs/{repairid}/reverse','1.0.0');
insert into capability.capability(id,kind,name,version,status) values
  ('finance.reconciliationrepairs.read','operation','finance.reconciliationrepairs.read',1,'active'),
  ('finance.reconciliationrepairs.preview','operation','finance.reconciliationrepairs.preview',1,'active'),
  ('finance.reconciliationrepairs.submit','operation','finance.reconciliationrepairs.submit',1,'active'),
  ('finance.reconciliationrepairs.decide','operation','finance.reconciliationrepairs.decide',1,'active'),
  ('finance.reconciliationrepairs.reverse','operation','finance.reconciliationrepairs.reverse',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('finance.reconciliationrepairs.read','finance.reconciliationrepairs.read','finance.reconciliation.read','operator'),
  ('finance.reconciliationrepairs.preview','finance.reconciliationrepairs.preview','finance.reconciliation.manage','operator'),
  ('finance.reconciliationrepairs.submit','finance.reconciliationrepairs.submit','finance.reconciliation.manage','operator'),
  ('finance.reconciliationrepairs.decide','finance.reconciliationrepairs.decide','finance.reconciliation.manage','operator'),
  ('finance.reconciliationrepairs.reverse','finance.reconciliationrepairs.reverse','finance.reconciliation.manage','operator');

-- A repair operation is deployable anywhere its authoritative source read or
-- manage capability was already entitled. Preserve every entitlement fact;
-- only the capability and deterministic row identity change.
insert into capability.entitlement(
  id,scope_id,capability_id,state,quota,effective_at,expires_at,version
)
select 'entitlement:'||substr(encode(public.digest(
    source.id||':'||mapping.target_capability,'sha256'),'hex'),1,40),
  source.scope_id,mapping.target_capability,source.state,source.quota,
  source.effective_at,source.expires_at,source.version
from capability.entitlement source
join (values
  ('finance.reconciliations.read','finance.reconciliationrepairs.read'),
  ('finance.reconciliations.manage','finance.reconciliationrepairs.preview'),
  ('finance.reconciliations.manage','finance.reconciliationrepairs.submit'),
  ('finance.reconciliations.manage','finance.reconciliationrepairs.decide'),
  ('finance.reconciliations.manage','finance.reconciliationrepairs.reverse')
) mapping(source_capability,target_capability) on mapping.source_capability=source.capability_id;

insert into runtime.schemaversion(version,checksum)
values('20260828100000','3e49f4160601d5ffcc4bef3198c6fedf6069f8c4ed9a29602dba46e0a48901db');

do $assert$
declare target regclass;
begin
  foreach target in array array[
    'finance.reconciliationrepair'::regclass,
    'finance.reconciliationrepairline'::regclass,
    'finance.reconciliationrepaireffect'::regclass,
    'finance.reconciliationrepairauthorization'::regclass,
    'access.repairactionauthorization'::regclass
  ] loop
    if not exists(select 1 from pg_class where oid=target and relrowsecurity)
    then raise exception 'FINANCE_REPAIR_RLS_MISSING:%',target; end if;
  end loop;
  if to_regprocedure('finance.preview_reconciliation_repair(text,text,text,text,text,bigint,bigint,text,jsonb)') is null
    or to_regprocedure('finance.submit_reconciliation_repair(text,text,text,text,bigint,text,text)') is null
    or to_regprocedure('finance.decide_reconciliation_repair(text,text,text,text,bigint,text,text,jsonb,text)') is null
    or to_regprocedure('finance.read_reconciliation_repair(text,text)') is null
    or to_regprocedure('finance.reverse_reconciliation_repair(text,text,text,text,bigint,text,text)') is null
    or to_regprocedure('finance.require_repair_action_proof(text,text,text,text,text,bigint,text)') is null
  then raise exception 'FINANCE_REPAIR_FUNCTION_MISSING'; end if;
  if (select count(*) from runtime.operation where id like 'finance.reconciliationrepairs.%')<>5
    or (select count(*) from capability.operation where operation_id like 'finance.reconciliationrepairs.%')<>5
    or exists(
      select 1 from capability.entitlement source
      join (values
        ('finance.reconciliations.read','finance.reconciliationrepairs.read'),
        ('finance.reconciliations.manage','finance.reconciliationrepairs.preview'),
        ('finance.reconciliations.manage','finance.reconciliationrepairs.submit'),
        ('finance.reconciliations.manage','finance.reconciliationrepairs.decide'),
        ('finance.reconciliations.manage','finance.reconciliationrepairs.reverse')
      ) mapping(source_capability,target_capability) on mapping.source_capability=source.capability_id
      where not exists(select 1 from capability.entitlement target
        where target.scope_id=source.scope_id and target.capability_id=mapping.target_capability
          and target.state=source.state and target.quota is not distinct from source.quota
          and target.effective_at=source.effective_at and target.expires_at is not distinct from source.expires_at
          and target.version=source.version)
    )
  then raise exception 'FINANCE_REPAIR_CAPABILITY_REGISTRATION_INVALID'; end if;
  if has_table_privilege('shopapp','finance.reconciliationrepair','SELECT')
    or has_table_privilege('shopapp','finance.reconciliationrepairline','INSERT')
    or has_table_privilege('shopapp','finance.reconciliationrepaireffect','UPDATE')
    or has_table_privilege('shopapp','finance.reconciliationrepairauthorization','DELETE')
    or has_table_privilege('shopapp','access.repairactionauthorization','SELECT')
  then raise exception 'FINANCE_REPAIR_RAW_WRITE_BOUNDARY_OPEN'; end if;
  if not has_table_privilege('shopjob','finance.reconciliationitem','INSERT')
    or not has_table_privilege('shopjob','finance.reconciliationitem','UPDATE')
  then raise exception 'FINANCE_RECONCILIATION_MATCHER_PRIVILEGE_MISSING'; end if;
  if not has_function_privilege('shopapp',
      'finance.preview_reconciliation_repair(text,text,text,text,text,bigint,bigint,text,jsonb)','EXECUTE')
    or not has_function_privilege('shopapp',
      'finance.submit_reconciliation_repair(text,text,text,text,bigint,text,text)','EXECUTE')
    or not has_function_privilege('shopapp',
      'finance.decide_reconciliation_repair(text,text,text,text,bigint,text,text,jsonb,text)','EXECUTE')
    or not has_function_privilege('shopapp','finance.read_reconciliation_repair(text,text)','EXECUTE')
    or not has_function_privilege('shopapp',
      'finance.reverse_reconciliation_repair(text,text,text,text,bigint,text,text)','EXECUTE')
    or has_function_privilege('shopapp','finance.reconciliation_repair_snapshot(text,text,text)','EXECUTE')
    or has_function_privilege('shopapp',
      'finance.require_repair_action_proof(text,text,text,text,text,bigint,text)','EXECUTE')
  then raise exception 'FINANCE_REPAIR_FUNCTION_PRIVILEGE_INVALID'; end if;
  if not exists(select 1 from pg_trigger where tgname='finance_repair_journal_write' and not tgisinternal)
    or not exists(select 1 from runtime.schemaversion where version='20260828100000')
  then raise exception 'FINANCE_REPAIR_MIGRATION_INCOMPLETE'; end if;
end $assert$;

commit;
