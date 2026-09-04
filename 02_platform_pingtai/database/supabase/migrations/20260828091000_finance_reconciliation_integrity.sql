begin;

do $$
begin
  if exists(select 1 from finance.statementline where kind not in('payment','refund')) then
    raise exception 'FINANCE_RECONCILIATION_UNSUPPORTED_STATEMENT_KIND';
  end if;
  if exists(
    select 1 from finance.reconciliationitem item join finance.statementline line on line.id=item.statement_line_id
    where item.internal_type is not null and item.internal_id is not null
    group by item.reconciliation_id,line.kind,item.internal_type,item.internal_id having count(*)>1
  ) then
    raise exception 'FINANCE_RECONCILIATION_INTERNAL_FACT_DUPLICATE';
  end if;
  if exists(select 1 from finance.reconciliation
    where debit_minor not between -9007199254740991 and 9007199254740991
      or credit_minor not between -9007199254740991 and 9007199254740991
      or difference_minor not between -9007199254740991 and 9007199254740991
      or difference_minor<>debit_minor-credit_minor)
  then raise exception 'FINANCE_RECONCILIATION_PARENT_AMOUNT_INVALID'; end if;
end $$;

alter table finance.statementline drop constraint statementline_kind_check;
alter table finance.statementline add constraint statementline_kind_check
  check(kind in('payment','refund'));
alter table finance.statementline add constraint finance_statementline_safe_minor
  check(amount_minor<=9007199254740991 and tax_minor<=9007199254740991);

alter table finance.reconciliation drop constraint if exists reconciliation_provider_period_statement_hash_key;
alter table finance.reconciliation add constraint finance_reconciliation_scope_statement_hash
  unique(scope_id,provider,period,statement_hash);
alter table finance.reconciliation add constraint finance_reconciliation_scope_statement
  unique(scope_id,statement_ref);
alter table finance.reconciliation add constraint finance_reconciliation_statement
  foreign key(statement_ref) references channel.statement(id);
alter table finance.reconciliation add constraint finance_reconciliation_safe_minor
  check(debit_minor between -9007199254740991 and 9007199254740991
    and credit_minor between -9007199254740991 and 9007199254740991
    and difference_minor between -9007199254740991 and 9007199254740991
    and difference_minor=debit_minor-credit_minor);

create or replace function finance.validate_reconciliation_statement()
returns trigger language plpgsql set search_path=finance,channel,pg_temp as $function$
declare source channel.statement%rowtype;
begin
  select * into source from channel.statement where id=new.statement_ref;
  if source.id is null or source.scope_id<>new.scope_id or source.provider<>new.provider
    or source.partner_id<>new.partner_id or source.sha256<>new.statement_hash
    or new.period<>source.period_start::text||'/'||source.period_end::text
  then raise exception 'FINANCE_RECONCILIATION_STATEMENT_MISMATCH'; end if;
  return new;
end $function$;
create trigger finance_reconciliation_statement_contract
before insert or update of scope_id,provider,partner_id,period,statement_ref,statement_hash
on finance.reconciliation for each row execute function finance.validate_reconciliation_statement();

alter table finance.reconciliationitem add column kind text;
update finance.reconciliationitem item set kind=line.kind,
  evidence=item.evidence||jsonb_build_object('kind',line.kind,'source','provider_statement')
from finance.statementline line where line.id=item.statement_line_id;
alter table finance.reconciliationitem alter column kind set not null;
alter table finance.reconciliationitem add constraint reconciliationitem_kind_check
  check(kind in('payment','refund'));
alter table finance.reconciliationitem alter column statement_line_id drop not null;
alter table finance.reconciliationitem add constraint reconciliationitem_source_check
  check(statement_line_id is not null or (internal_type is not null and internal_id is not null));
alter table finance.reconciliationitem add constraint reconciliationitem_amount_check
  check(external_minor between 0 and 9007199254740991 and internal_minor between 0 and 9007199254740991
    and difference_minor=external_minor-internal_minor);
alter table finance.reconciliationitem add constraint reconciliationitem_matched_check
  check(state<>'matched' or (difference_minor=0 and reason_code is null));

create unique index finance_reconciliationitem_internal_fact
  on finance.reconciliationitem(reconciliation_id,kind,internal_type,internal_id)
  where internal_type is not null and internal_id is not null;

insert into runtime.schemaversion(version,checksum)
values('20260828091000','0c3061ffe2ab528d217bff54b9c33d58f9765a3a396727c39871f043b6c503e3');

do $assert$
begin
  if not exists(select 1 from pg_constraint where conname='finance_reconciliation_safe_minor')
    or not exists(select 1 from pg_constraint where conname='reconciliationitem_amount_check')
    or not exists(select 1 from pg_indexes where schemaname='finance'
      and indexname='finance_reconciliationitem_internal_fact')
  then raise exception 'FINANCE_RECONCILIATION_INTEGRITY_OBJECT_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260828091000')
  then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
