begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904030500') then
    raise exception 'FINANCE_REPAIR_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260904030600') then
    raise exception 'FINANCE_REPAIR_COMPLETION_ALREADY_APPLIED';
  end if;
  if exists(select 1 from finance.repair) then
    raise exception 'FINANCE_REPAIR_HARD_CUT_REQUIRES_EMPTY_REPAIR_SET';
  end if;
end
$precondition$;

create temporary table finance_repair_before on commit drop as
select (select count(*) from finance.repair)::bigint repairs,
  (select count(*) from finance.repairmovement)::bigint movements,
  (select count(*) from finance.journal)::bigint journals,
  (select count(*) from finance.entry)::bigint entries,
  (select coalesce(sum(amount_minor),0) from finance.entry)::numeric minor;

drop function finance.approve_repair(text,text,text,bigint,text);
drop function finance.reverse_repair(text,text,text,bigint,text);
drop table finance.repairpreview;

do $constraints$
declare item record;
begin
  for item in select conname from pg_constraint where conrelid='finance.repair'::regclass and contype='c' loop
    execute format('alter table finance.repair drop constraint %I',item.conname);
  end loop;
end
$constraints$;

alter table finance.repair drop column original_journal_id;
alter table finance.repair drop column reversal_journal_id;
alter table finance.repair add column source_journal_id text not null references finance.journal(id);
alter table finance.repair add column source_journal_hash char(64) not null;
alter table finance.repair add column source_journal_debit_minor bigint not null;
alter table finance.repair add column approval_instance_id text not null references approval.instances(id);
alter table finance.repair add column approval_amount_minor bigint not null;
alter table finance.repair add column approval_proof_id text unique references approval.proofs(id);
alter table finance.repair add column source_reversal_journal_id text unique references finance.journal(id);
alter table finance.repair add column replacement_journal_id text unique references finance.journal(id);
alter table finance.repair add column rollback_journal_id text unique references finance.journal(id);
alter table finance.repair add column decision_reason text;
alter table finance.repair add column reverse_reason text;
alter table finance.repair add column reversed_by text;
alter table finance.repair add column decided_at timestamptz;
alter table finance.repair add column reversed_at timestamptz;
alter table finance.repair add constraint finance_repair_status check(status in('submitted','approved','rejected','reversed'));
alter table finance.repair add constraint finance_repair_source_hash check(source_hash~'^[0-9a-f]{64}$' and source_journal_hash~'^[0-9a-f]{64}$');
alter table finance.repair add constraint finance_repair_amount check(source_journal_debit_minor>0 and approval_amount_minor>=source_journal_debit_minor);
alter table finance.repair add constraint finance_repair_reason check(length(reason) between 1 and 1000 and (decision_reason is null or length(decision_reason) between 1 and 1000) and (reverse_reason is null or length(reverse_reason) between 1 and 1000));
alter table finance.repair add constraint finance_repair_separation check(checker_id is null or checker_id<>maker_id);
alter table finance.repair add constraint finance_repair_state check(
  (status='submitted' and checker_id is null and approval_proof_id is null and source_reversal_journal_id is null and replacement_journal_id is null and rollback_journal_id is null and decision_reason is null and reverse_reason is null and reversed_by is null and decided_at is null and reversed_at is null)
  or (status='rejected' and checker_id is not null and approval_proof_id is null and source_reversal_journal_id is null and replacement_journal_id is null and rollback_journal_id is null and decision_reason is not null and reverse_reason is null and reversed_by is null and decided_at is not null and reversed_at is null)
  or (status='approved' and checker_id is not null and approval_proof_id is not null and source_reversal_journal_id is not null and replacement_journal_id is not null and rollback_journal_id is null and decision_reason is not null and reverse_reason is null and reversed_by is null and decided_at is not null and reversed_at is null)
  or (status='reversed' and checker_id is not null and approval_proof_id is not null and source_reversal_journal_id is not null and replacement_journal_id is not null and rollback_journal_id is not null and decision_reason is not null and reverse_reason is not null and reversed_by is not null and decided_at is not null and reversed_at is not null));
alter table finance.repair add constraint finance_repair_approval_unique unique(approval_instance_id);
create unique index finance_repair_active_source on finance.repair(scope_id,source_journal_id) where status in('submitted','approved');

alter table finance.repairmovement drop column journal_id;
alter table finance.repairmovement add column journal_ids text[] not null default '{}'::text[];
alter table finance.repairmovement add column evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object');

create or replace function finance.journal_hash(p_journal text,p_scope text)
returns text language sql stable security definer set search_path=finance,public,pg_temp as $function$
  select encode(public.digest(
    journal.id||chr(31)||journal.scope_id||chr(31)||journal.reference_type||chr(31)||journal.reference_id||chr(31)||
    journal.currency||chr(31)||journal.period||chr(31)||journal.state||chr(31)||
    coalesce(string_agg(entry.id||chr(30)||entry.account_id||chr(30)||entry.side||chr(30)||entry.amount_minor::text,chr(29) order by entry.id),'')
  ,'sha256'),'hex')
  from finance.journal journal left join finance.entry entry on entry.journal_id=journal.id
  where journal.id=p_journal and journal.scope_id=p_scope
    and (session_user<>'shopapp' or access.scope_allowed(p_scope)) group by journal.id
$function$;

create or replace function finance.append_repair_journal(
  p_id text,p_scope text,p_reference_type text,p_reference_id text,p_currency text,p_description text,p_entries jsonb
) returns text language plpgsql volatile security definer set search_path=finance,public,pg_temp as $function$
declare debit bigint; credit bigint; entrycount integer; currentperiod text;
begin
  if p_id!~'^journal:' or p_scope is null or p_scope='' or p_reference_type!~'^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$'
    or p_reference_id is null or p_reference_id='' or p_currency<>'CNY' or length(p_description) not between 1 and 1000
    or jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries) not between 2 and 2000 then
    raise exception 'FINANCE_REPAIR_JOURNAL_INVALID';
  end if;
  select count(*)::integer,
    coalesce(sum(case when item->>'side'='debit' then (item->>'amountMinor')::bigint else 0 end),0),
    coalesce(sum(case when item->>'side'='credit' then (item->>'amountMinor')::bigint else 0 end),0)
  into entrycount,debit,credit from jsonb_array_elements(p_entries) item
  where jsonb_typeof(item)='object' and item->>'side' in('debit','credit') and coalesce(item->>'accountId','')<>''
    and coalesce(item->>'amountMinor','')~'^[1-9][0-9]*$';
  if entrycount<>jsonb_array_length(p_entries) or debit<=0 or debit<>credit then raise exception 'FINANCE_JOURNAL_UNBALANCED'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_entries) item left join finance.account account
      on account.id=item->>'accountId' and account.scope_id=p_scope and account.currency=p_currency and account.status='active'
    where account.id is null
  ) then raise exception 'FINANCE_REPAIR_ACCOUNT_NOT_FOUND'; end if;
  currentperiod:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM');
  if exists(select 1 from finance.period where scope_id=p_scope and period=currentperiod and state='closed') then raise exception 'FINANCE_PERIOD_CLOSED'; end if;
  insert into finance.journal(id,scope_id,reference_type,reference_id,currency,period,state,description,posted_at,version)
  values(p_id,p_scope,p_reference_type,p_reference_id,p_currency,currentperiod,'posted',p_description,clock_timestamp(),0);
  insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at)
  select 'entry:'||substr(encode(public.digest(p_id||':'||ordinality::text,'sha256'),'hex'),1,40),p_id,
    item->>'accountId',item->>'side',(item->>'amountMinor')::bigint,clock_timestamp()
  from jsonb_array_elements(p_entries) with ordinality source(item,ordinality);
  return p_id;
end
$function$;

create or replace function finance.approve_repair(p_repair text,p_scope text,p_checker text,p_expected bigint,p_reason text,p_proof text)
returns text language plpgsql volatile security definer set search_path=finance,approval,public,pg_temp as $function$
declare target finance.repair%rowtype; source finance.journal%rowtype; sourceentries jsonb; replacemententries jsonb;
  sourcereversal text; replacement text; actualdebit bigint; proofchecker text;
begin
  if session_user='shopapp' and not access.scope_allowed(p_scope) then raise exception 'AUTHORIZATION_DENIED'; end if;
  select * into target from finance.repair where id=p_repair and scope_id=p_scope and status='submitted'
    and maker_id<>p_checker and version=p_expected for update;
  if not found then raise exception 'FINANCE_REPAIR_CONFLICT'; end if;
  select proof.checker_id into proofchecker from approval.proofs proof join approval.instances instance on instance.id=proof.instance_id
  where proof.id=p_proof and proof.instance_id=target.approval_instance_id and proof.scope_id=p_scope and proof.subject_kind='financerepair'
    and proof.subject_id=p_repair and proof.subject_version=p_expected and proof.action='finance.repair.apply'
    and proof.evidence_hash=target.preview_hash and proof.amount_minor=target.approval_amount_minor and proof.currency='CNY'
    and proof.constraints=jsonb_build_object('statementId',target.statement_id,'sourceHash',target.source_hash,'sourceVersion',target.source_version,
      'sourceJournalId',target.source_journal_id,'sourceJournalHash',target.source_journal_hash)
    and proof.consumed_at is not null and proof.consumer_operation='finance.reconciliationrepairs.decide'
    and instance.state='approved';
  if proofchecker is null or proofchecker<>p_checker then raise exception 'APPROVAL_PROOF_INVALID'; end if;
  select * into source from finance.journal where id=target.source_journal_id and scope_id=p_scope and state='posted' for share;
  if not found or finance.journal_hash(source.id,p_scope)<>target.source_journal_hash then raise exception 'FINANCE_REPAIR_HASH_MISMATCH'; end if;
  select coalesce(sum(amount_minor) filter(where side='debit'),0) into actualdebit from finance.entry where journal_id=source.id;
  if actualdebit<>target.source_journal_debit_minor then raise exception 'FINANCE_REPAIR_HASH_MISMATCH'; end if;
  select jsonb_agg(jsonb_build_object('accountId',entry.account_id,'side',case entry.side when 'debit' then 'credit' else 'debit' end,
    'amountMinor',entry.amount_minor) order by entry.id) into sourceentries from finance.entry entry where entry.journal_id=source.id;
  select jsonb_agg(jsonb_build_object('accountId',account.id,'side',case when (item->>'debitMinor')::bigint>0 then 'debit' else 'credit' end,
    'amountMinor',greatest((item->>'debitMinor')::bigint,(item->>'creditMinor')::bigint)) order by ordinality)
  into replacemententries from jsonb_array_elements(target.entries) with ordinality proposed(item,ordinality)
  join finance.account account on account.scope_id=p_scope and account.code=item->>'account' and account.currency=item->>'currency' and account.status='active';
  if replacemententries is null or jsonb_array_length(replacemententries)<>jsonb_array_length(target.entries) then raise exception 'FINANCE_REPAIR_ACCOUNT_NOT_FOUND'; end if;
  sourcereversal:='journal:'||substr(encode(public.digest(p_scope||':financerepair:sourcereversal:'||p_repair,'sha256'),'hex'),1,40);
  replacement:='journal:'||substr(encode(public.digest(p_scope||':financerepair:replacement:'||p_repair,'sha256'),'hex'),1,40);
  perform finance.append_repair_journal(sourcereversal,p_scope,'finance.repair.sourcereversal',p_repair,source.currency,p_reason,sourceentries);
  perform finance.append_repair_journal(replacement,p_scope,'finance.repair.replacement',p_repair,source.currency,p_reason,replacemententries);
  update finance.repair set status='approved',checker_id=p_checker,approval_proof_id=p_proof,decision_reason=p_reason,
    source_reversal_journal_id=sourcereversal,replacement_journal_id=replacement,decided_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp()
  where id=p_repair;
  insert into finance.repairmovement(id,movement_key,repair_id,scope_id,previous_status,next_status,actor_id,reason,journal_ids,evidence,created_at)
  values('repairmovement:'||substr(encode(public.digest(p_repair||':approved:'||(p_expected+1)::text,'sha256'),'hex'),1,40),
    'repair:'||p_repair||':approved:'||(p_expected+1)::text,p_repair,p_scope,'submitted','approved',p_checker,p_reason,
    array[sourcereversal,replacement],jsonb_build_object('approvalProofId',p_proof,'sourceJournalId',source.id),clock_timestamp());
  return replacement;
end
$function$;

create or replace function finance.reject_repair(p_repair text,p_scope text,p_checker text,p_expected bigint,p_reason text)
returns text language plpgsql volatile security definer set search_path=finance,approval,public,pg_temp as $function$
declare target finance.repair%rowtype;
begin
  if session_user='shopapp' and not access.scope_allowed(p_scope) then raise exception 'AUTHORIZATION_DENIED'; end if;
  select * into target from finance.repair where id=p_repair and scope_id=p_scope and status='submitted'
    and maker_id<>p_checker and version=p_expected for update;
  if not found then raise exception 'FINANCE_REPAIR_CONFLICT'; end if;
  if not exists(
    select 1 from approval.instances instance join approval.decisions decision on decision.instance_id=instance.id
    where instance.id=target.approval_instance_id and instance.scope_id=p_scope and instance.state='rejected'
      and instance.subject_kind='financerepair' and instance.subject_id=p_repair and instance.subject_version=p_expected
      and instance.action='finance.repair.apply' and instance.evidence_hash=target.preview_hash
      and instance.amount_minor=target.approval_amount_minor and instance.currency='CNY'
      and decision.outcome='rejected' and decision.actor_id=p_checker
  ) then raise exception 'APPROVAL_PROOF_INVALID'; end if;
  update finance.repair set status='rejected',checker_id=p_checker,decision_reason=p_reason,decided_at=clock_timestamp(),
    version=version+1,updated_at=clock_timestamp() where id=p_repair;
  insert into finance.repairmovement(id,movement_key,repair_id,scope_id,previous_status,next_status,actor_id,reason,journal_ids,evidence,created_at)
  values('repairmovement:'||substr(encode(public.digest(p_repair||':rejected:'||(p_expected+1)::text,'sha256'),'hex'),1,40),
    'repair:'||p_repair||':rejected:'||(p_expected+1)::text,p_repair,p_scope,'submitted','rejected',p_checker,p_reason,'{}'::text[],
    jsonb_build_object('approvalInstanceId',target.approval_instance_id),clock_timestamp());
  return p_repair;
end
$function$;

create or replace function finance.reverse_repair(p_repair text,p_scope text,p_checker text,p_expected bigint,p_reason text)
returns text language plpgsql volatile security definer set search_path=finance,public,pg_temp as $function$
declare target finance.repair%rowtype; rollbackentries jsonb; rollback text; currencycode text;
begin
  if session_user='shopapp' and not access.scope_allowed(p_scope) then raise exception 'AUTHORIZATION_DENIED'; end if;
  select * into target from finance.repair where id=p_repair and scope_id=p_scope and status='approved'
    and maker_id<>p_checker and version=p_expected for update;
  if not found then raise exception 'FINANCE_REPAIR_CONFLICT'; end if;
  select min(journal.currency),jsonb_agg(jsonb_build_object('accountId',entry.account_id,
    'side',case entry.side when 'debit' then 'credit' else 'debit' end,'amountMinor',entry.amount_minor)
    order by journal.id,entry.id) into currencycode,rollbackentries
  from finance.journal journal join finance.entry entry on entry.journal_id=journal.id
  where journal.scope_id=p_scope and journal.state='posted' and journal.id in(target.source_reversal_journal_id,target.replacement_journal_id)
  having count(distinct journal.id)=2 and min(journal.currency)=max(journal.currency);
  if rollbackentries is null then raise exception 'FINANCE_REPAIR_JOURNAL_NOT_FOUND'; end if;
  rollback:='journal:'||substr(encode(public.digest(p_scope||':financerepair:rollback:'||p_repair,'sha256'),'hex'),1,40);
  perform finance.append_repair_journal(rollback,p_scope,'finance.repair.rollback',p_repair,currencycode,p_reason,rollbackentries);
  update finance.repair set status='reversed',reversed_by=p_checker,reverse_reason=p_reason,rollback_journal_id=rollback,
    reversed_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp() where id=p_repair;
  insert into finance.repairmovement(id,movement_key,repair_id,scope_id,previous_status,next_status,actor_id,reason,journal_ids,evidence,created_at)
  values('repairmovement:'||substr(encode(public.digest(p_repair||':reversed:'||(p_expected+1)::text,'sha256'),'hex'),1,40),
    'repair:'||p_repair||':reversed:'||(p_expected+1)::text,p_repair,p_scope,'approved','reversed',p_checker,p_reason,
    array[rollback],jsonb_build_object('sourceReversalJournalId',target.source_reversal_journal_id,'replacementJournalId',target.replacement_journal_id),clock_timestamp());
  return rollback;
end
$function$;

create or replace function finance.guard_repair_proposal()
returns trigger language plpgsql set search_path=finance,approval,pg_temp as $function$
begin
  if tg_op='INSERT' then
    if new.status<>'submitted' or new.version<>1 or new.checker_id is not null
      or not exists(
        select 1 from approval.instances instance where instance.id=new.approval_instance_id and instance.scope_id=new.scope_id
          and instance.state='pending' and instance.subject_kind='financerepair' and instance.subject_id=new.id
          and instance.subject_version=new.version and instance.action='finance.repair.apply' and instance.evidence_hash=new.preview_hash
          and instance.amount_minor=new.approval_amount_minor and instance.currency='CNY' and instance.requester_id=new.maker_id
      ) then raise exception 'FINANCE_REPAIR_SUBMISSION_INVALID'; end if;
    return new;
  end if;
  if new.scope_id<>old.scope_id or new.statement_id<>old.statement_id or new.source_hash<>old.source_hash
    or new.source_version<>old.source_version or new.preview_hash<>old.preview_hash or new.differences<>old.differences
    or new.entries<>old.entries or new.maker_id<>old.maker_id or new.reason<>old.reason
    or new.source_journal_id<>old.source_journal_id or new.source_journal_hash<>old.source_journal_hash
    or new.source_journal_debit_minor<>old.source_journal_debit_minor or new.approval_instance_id<>old.approval_instance_id
    or new.approval_amount_minor<>old.approval_amount_minor then raise exception 'FINANCE_REPAIR_PROPOSAL_IMMUTABLE'; end if;
  if not (old.status='submitted' and new.status in('approved','rejected') or old.status='approved' and new.status='reversed') then
    raise exception 'FINANCE_REPAIR_TRANSITION_INVALID';
  end if;
  return new;
end
$function$;
create trigger finance_repair_proposal_immutable before insert or update on finance.repair
for each row execute function finance.guard_repair_proposal();

revoke all on function finance.journal_hash(text,text),finance.append_repair_journal(text,text,text,text,text,text,jsonb),
  finance.approve_repair(text,text,text,bigint,text,text),finance.reject_repair(text,text,text,bigint,text),
  finance.reverse_repair(text,text,text,bigint,text) from public;
grant execute on function finance.journal_hash(text,text),finance.approve_repair(text,text,text,bigint,text,text),
  finance.reject_repair(text,text,text,bigint,text),finance.reverse_repair(text,text,text,bigint,text) to shopapp,shopjob;
revoke update,delete on finance.repair from shopapp,shopjob;
revoke all on finance.repair,finance.repairmovement from shopprovider;
drop policy providerscope on finance.repair;
drop policy providerscope on finance.repairmovement;

select runtime.record_migration_evidence('20260904030600',before.repairs+before.movements+before.journals+before.entries,
  after.repairs+after.movements+after.journals+after.entries,before.minor,after.minor,
  'select status,count(*) from finance.repair group by status order by status;',
  'select repair.id from finance.repair repair left join approval.instances approval on approval.id=repair.approval_instance_id where approval.id is null or repair.status in(''approved'',''reversed'') and (repair.source_reversal_journal_id is null or repair.replacement_journal_id is null);')
from finance_repair_before before cross join (
  select (select count(*) from finance.repair)::bigint repairs,(select count(*) from finance.repairmovement)::bigint movements,
    (select count(*) from finance.journal)::bigint journals,(select count(*) from finance.entry)::bigint entries,
    (select coalesce(sum(amount_minor),0) from finance.entry)::numeric minor
) after;

insert into runtime.schemaversion(version,checksum)
values('20260904030600',encode(public.digest('20260904030600_complete_finance_repair','sha256'),'hex'));

do $assert$
begin
  if to_regclass('finance.repairpreview') is not null then raise exception 'FINANCE_REPAIR_PREVIEW_TABLE_REMAINS'; end if;
  if to_regprocedure('finance.approve_repair(text,text,text,bigint,text,text)') is null
    or to_regprocedure('finance.reject_repair(text,text,text,bigint,text)') is null
    or to_regprocedure('finance.reverse_repair(text,text,text,bigint,text)') is null
    or to_regprocedure('finance.journal_hash(text,text)') is null then raise exception 'FINANCE_REPAIR_FUNCTION_MISSING'; end if;
  if (select count(*) from pg_trigger where tgrelid='finance.repair'::regclass and tgname='finance_repair_proposal_immutable' and not tgisinternal)<>1 then
    raise exception 'FINANCE_REPAIR_IMMUTABILITY_MISSING';
  end if;
  if has_function_privilege('public','finance.approve_repair(text,text,text,bigint,text,text)','EXECUTE')
    or not has_function_privilege('shopapp','finance.approve_repair(text,text,text,bigint,text,text)','EXECUTE') then
    raise exception 'FINANCE_REPAIR_FUNCTION_PRIVILEGE_INVALID';
  end if;
end
$assert$;

commit;
