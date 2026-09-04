begin;

-- One statutory ledger and legal timezone per Scope/currency.  The current MVP
-- is CNY-only, but the key prevents a future currency from sharing balances.
create table finance.ledger(
  id text primary key,
  scope_id text not null,
  code text not null,
  name text not null,
  currency char(3) not null check(currency~'^[A-Z]{3}$'),
  legal_timezone text not null check(legal_timezone<>'' and length(legal_timezone)<=64),
  state text not null check(state in('active','closed')),
  version bigint not null default 0 check(version>=0),
  unique(scope_id,code,currency)
);

create or replace function finance.ledger_id(p_scope text,p_currency text)
returns text language sql immutable strict parallel safe as $function$
  select 'ledger:'||substr(encode(public.digest(p_scope||':general:'||p_currency,'sha256'::text),'hex'),1,40)
$function$;

with pairs as(
  select scope_id,currency from finance.account
  union select scope_id,currency from finance.statement
  union select scope_id,'CNY'::char(3) from finance.period
)
insert into finance.ledger(id,scope_id,code,name,currency,legal_timezone,state,version)
select finance.ledger_id(pair.scope_id,pair.currency),''
  ||pair.scope_id,'general','General ledger',pair.currency,
  coalesce((select organization.timezone from organization.organization
    where organization.id=pair.scope_id and organization.timezone<>''),'Asia/Shanghai'),
  'active',0
from pairs pair
on conflict(scope_id,code,currency) do nothing;

alter table finance.account add column ledger_id text;
update finance.account account
set ledger_id=finance.ledger_id(account.scope_id,account.currency);
alter table finance.account alter column ledger_id set not null;
alter table finance.account add constraint finance_account_ledger
  foreign key(ledger_id) references finance.ledger(id);

create or replace function finance.ensure_account(p_scope text,p_code text,p_currency text,p_kind text)
returns text language plpgsql volatile security definer set search_path=finance,organization,pg_temp as $function$
declare
  ledgerid text:=finance.ledger_id(p_scope,p_currency);
  accountid text:=finance.account_id(p_scope,p_code,p_currency);
  legaltimezone text;
begin
  if p_scope='' or p_code='' or p_currency<>'CNY'
    or p_kind not in('asset','liability','equity','income','expense')
  then raise exception 'FINANCE_ACCOUNT_CONTRACT_INVALID'; end if;
  if current_setting('app.workload',true)='api' and not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_SCOPE_FORBIDDEN'; end if;
  select coalesce((select organization.timezone from organization.organization
    where organization.id=p_scope and organization.timezone<>''),'Asia/Shanghai')
  into legaltimezone;
  perform clock_timestamp() at time zone legaltimezone;
  insert into finance.ledger(id,scope_id,code,name,currency,legal_timezone,state,version)
  values(ledgerid,p_scope,'general','General ledger',p_currency,legaltimezone,'active',0)
  on conflict(scope_id,code,currency) do nothing;
  if not exists(select 1 from finance.ledger where id=ledgerid and scope_id=p_scope
    and currency=p_currency and state='active')
  then raise exception 'FINANCE_LEDGER_NOT_ACTIVE'; end if;
  insert into finance.account(id,scope_id,code,currency,kind,status,ledger_id)
  values(accountid,p_scope,p_code,p_currency,p_kind,'active',ledgerid)
  on conflict(scope_id,code,currency) do update set status='active'
    where finance.account.kind=excluded.kind and finance.account.ledger_id=excluded.ledger_id;
  if not exists(select 1 from finance.account where id=accountid and scope_id=p_scope
    and code=p_code and currency=p_currency and kind=p_kind and ledger_id=ledgerid)
  then raise exception 'FINANCE_ACCOUNT_CONTRACT_MISMATCH'; end if;
  return accountid;
end $function$;

-- Every posting is attached to an immutable, versioned accounting-event rule.
create table finance.accountingeventrule(
  event_type text not null,
  version bigint not null check(version>0),
  recognition text not null,
  debit_roles text[] not null check(cardinality(debit_roles)>0),
  credit_roles text[] not null check(cardinality(credit_roles)>0),
  subledger_kind text check(subledger_kind in(
    'order_receivable','supplier_payable','channel_clearing','distribution_commission')),
  reversal_event text,
  effective_at timestamptz not null,
  primary key(event_type,version)
);

insert into finance.accountingeventrule(
  event_type,version,recognition,debit_roles,credit_roles,subledger_kind,reversal_event,effective_at
) values
  ('payment',1,'Legacy payment journal retained for audit',array['legacy_asset','legacy_liability','legacy_equity','legacy_income','legacy_expense'],array['legacy_asset','legacy_liability','legacy_equity','legacy_income','legacy_expense'],null,'finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('benefit_ledger',1,'Legacy benefit movement retained for audit',array['legacy_asset','legacy_liability','legacy_equity','legacy_income','legacy_expense'],array['legacy_asset','legacy_liability','legacy_equity','legacy_income','legacy_expense'],null,'finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('benefit.legacy',1,'Legacy benefit posting retained for audit',array['legacy_asset','legacy_liability','legacy_equity','legacy_income','legacy_expense'],array['legacy_asset','legacy_liability','legacy_equity','legacy_income','legacy_expense'],null,'finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('order.placed',1,'External-tender receivable accrual',array['order_receivable'],array['commerce_revenue'],'order_receivable','finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('payment.succeeded',1,'Captured external tender clears order receivable',array['channel_clearing'],array['order_receivable'],'channel_clearing','payment.refunded','1970-01-01T00:00:00Z'),
  ('payment.refunded',1,'External-tender refund reduces channel clearing',array['sales_return'],array['channel_clearing'],'channel_clearing','finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('payment.late.detected',1,'Late external capture is held for automatic refund',array['channel_clearing'],array['late_refund_payable'],'channel_clearing','payment.late.refunded','1970-01-01T00:00:00Z'),
  ('payment.late.refunded',1,'Automatic late refund clears its dedicated payable',array['late_refund_payable'],array['channel_clearing'],'channel_clearing','finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('finance.settlement.approved',1,'Freeze partner payable and platform fee',array['settlement_cost'],array['supplier_payable','platform_fee'],'supplier_payable','finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('finance.withdrawal.paid',1,'Provider-confirmed payout clears partner payable',array['supplier_payable'],array['cash'],'supplier_payable','finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('distribution.commission.accrued',1,'Accrue distribution commission payable',array['distribution_commission_expense'],array['distribution_commission_payable'],'distribution_commission','finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('benefit.grant',1,'Grant member benefit liability',array['benefit_expense'],array['benefit_liability'],null,'benefit.revoke','1970-01-01T00:00:00Z'),
  ('benefit.revoke',1,'Recover unused member benefit',array['benefit_liability'],array['benefit_recovery'],null,'finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('benefit.expire',1,'Recognize expired member benefit',array['benefit_liability'],array['benefit_expiry'],null,'finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('benefit.consume',1,'Consume member benefit tender',array['benefit_liability'],array['benefit_revenue'],null,'benefit.refund','1970-01-01T00:00:00Z'),
  ('benefit.refund',1,'Restore member benefit tender',array['sales_return'],array['benefit_liability'],null,'finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('voucher.issue',1,'Issue voucher liability',array['voucher_expense'],array['voucher_liability'],null,'finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('voucher.redeem',1,'Consume voucher tender',array['voucher_liability'],array['commerce_clearing'],null,'voucher.refund','1970-01-01T00:00:00Z'),
  ('voucher.refund',1,'Restore voucher tender',array['sales_return'],array['voucher_liability'],null,'finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('finance.journal.reversal',1,'Exact immutable reversal of a posted journal',array['original_credit'],array['original_debit'],null,null,'1970-01-01T00:00:00Z'),
  ('finance.journal.correction',1,'Replacement posting linked to an immutable source journal',array['corrected_debit'],array['corrected_credit'],null,'finance.journal.reversal','1970-01-01T00:00:00Z');

-- Convert an account contract to a semantic role before finance.post accepts
-- it. This makes the event matrix executable rather than descriptive only.
create or replace function finance.account_role(p_code text,p_kind text)
returns text language sql immutable strict parallel safe as $function$
  select case
    when p_code like 'order.receivable.%' and p_kind='asset' then 'order_receivable'
    when p_code='commerce.revenue' and p_kind='income' then 'commerce_revenue'
    when p_code like 'channel.clearing.%' and p_kind='asset' then 'channel_clearing'
    when p_code like 'late-refund.payable.%' and p_kind='liability' then 'late_refund_payable'
    when p_code in('commerce.refund','benefit.refund') and p_kind='expense' then 'sales_return'
    when p_code='settlement.cost' and p_kind='expense' then 'settlement_cost'
    when p_code like 'settlement.payable.%' and p_kind='liability' then 'supplier_payable'
    when p_code='platform.fee' and p_kind='income' then 'platform_fee'
    when p_code='cash' and p_kind='asset' then 'cash'
    when p_code='distribution.commission.expense' and p_kind='expense' then 'distribution_commission_expense'
    when p_code like 'distribution.commission.payable.%' and p_kind='liability' then 'distribution_commission_payable'
    when p_code='benefit.expense' and p_kind='expense' then 'benefit_expense'
    when p_code like 'benefit.%' and p_kind='liability' then 'benefit_liability'
    when p_code='benefit.recovery' and p_kind='income' then 'benefit_recovery'
    when p_code='benefit.expiry' and p_kind='income' then 'benefit_expiry'
    when p_code='commerce.benefit' and p_kind='income' then 'benefit_revenue'
    when p_code='voucher.issue' and p_kind='expense' then 'voucher_expense'
    when p_code like 'voucher.program.%' and p_kind='liability' then 'voucher_liability'
    when p_code='commerce.clearing' and p_kind='income' then 'commerce_clearing'
    when p_kind in('asset','liability','equity','income','expense') then 'legacy_'||p_kind
  end
$function$;

alter table finance.journal add column accounting_rule_version bigint not null default 1 check(accounting_rule_version>0);
alter table finance.journal add column reversal_of text references finance.journal(id);
alter table finance.journal add column correction_of text references finance.journal(id);
alter table finance.journal add column source_hash char(64);
alter table finance.journal add constraint finance_journal_single_relation
  check(num_nonnulls(reversal_of,correction_of)<=1);
create unique index finance_journal_single_reversal
  on finance.journal(reversal_of) where reversal_of is not null;
create unique index finance_journal_single_correction
  on finance.journal(correction_of) where correction_of is not null;
alter table finance.journal add constraint finance_journal_relation_type
  check((reference_type='finance.journal.reversal')=(reversal_of is not null)
    and (reference_type='finance.journal.correction')=(correction_of is not null));

-- This one-time legal-timezone normalization intentionally runs before the
-- replacement posting functions are installed.  The legacy append-only guard
-- must be suspended only for this migration-owned backfill; the surrounding
-- transaction restores it atomically on either success or rollback.
alter table finance.journal disable trigger finance_journal_immutable;
update finance.journal journal set period=to_char(journal.posted_at at time zone ledger.legal_timezone,'YYYY-MM')
from finance.ledger ledger where journal.state='posted' and journal.posted_at is not null
  and ledger.id=finance.ledger_id(journal.scope_id,journal.currency);
alter table finance.journal enable trigger finance_journal_immutable;

do $preflight$
begin
  if exists(
    select 1 from finance.journal journal
    left join finance.accountingeventrule rule on rule.event_type=journal.reference_type
      and rule.version=journal.accounting_rule_version
    where journal.state='posted' and rule.event_type is null
  ) then raise exception 'FINANCE_POSTED_JOURNAL_RULE_MISSING'; end if;
  if exists(
    select 1 from finance.journal journal left join finance.entry entry on entry.journal_id=journal.id
    where journal.state='posted'
    group by journal.id having journal.posted_at is null or count(entry.id)<2
      or coalesce(sum(case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end),0)<>0
  ) then raise exception 'FINANCE_POSTED_JOURNAL_UNBALANCED'; end if;
  if exists(
    select 1 from finance.journal journal join finance.entry entry on entry.journal_id=journal.id
    join finance.account account on account.id=entry.account_id
    where journal.state='posted' and (account.scope_id<>journal.scope_id or account.currency<>journal.currency)
  ) then raise exception 'FINANCE_POSTED_JOURNAL_SCOPE_CURRENCY_MISMATCH'; end if;
  if exists(select 1 from finance.settlementline where tax_minor>amount_minor)
    or exists(select 1 from finance.settlementadjustment where tax_minor>amount_minor)
  then raise exception 'FINANCE_SETTLEMENT_TAX_BASIS_INVALID'; end if;
end $preflight$;

alter table finance.journal add constraint finance_journal_accounting_rule
  foreign key(reference_type,accounting_rule_version)
  references finance.accountingeventrule(event_type,version);
alter table finance.settlementline add constraint finance_settlementline_tax_basis
  check(tax_minor<=amount_minor);
alter table finance.settlementadjustment add constraint finance_settlementadjustment_tax_basis
  check(tax_minor<=amount_minor);

-- Legal period bounds use the ledger timezone and a half-open instant range.
alter table finance.period add column ledger_id text;
alter table finance.period add column legal_timezone text;
alter table finance.period add column period_start_at timestamptz;
alter table finance.period add column period_end_at timestamptz;
update finance.period period set
  ledger_id=finance.ledger_id(period.scope_id,'CNY'),
  legal_timezone=(select ledger.legal_timezone from finance.ledger ledger
    where ledger.id=finance.ledger_id(period.scope_id,'CNY'));
update finance.period period set
  period_start_at=to_date(period.period||'-01','YYYY-MM-DD')::timestamp at time zone period.legal_timezone,
  period_end_at=(to_date(period.period||'-01','YYYY-MM-DD')+interval '1 month')::timestamp at time zone period.legal_timezone;
alter table finance.period alter column ledger_id set not null;
alter table finance.period alter column legal_timezone set not null;
alter table finance.period alter column period_start_at set not null;
alter table finance.period alter column period_end_at set not null;
alter table finance.period add constraint finance_period_ledger foreign key(ledger_id) references finance.ledger(id);
alter table finance.period add constraint finance_period_format check(period~'^[0-9]{4}-(0[1-9]|1[0-2])$');
alter table finance.period add constraint finance_period_bounds check(period_start_at<period_end_at);

-- Replace the ambiguous Scope-wide net statement with a versioned trial-balance
-- header plus immutable per-account lines. Legacy snapshots remain as replaced.
alter table finance.statement
  drop constraint if exists statement_scope_id_period_start_period_end_currency_state_key;
alter table finance.statement add column ledger_id text;
alter table finance.statement add column legal_timezone text;
alter table finance.statement add column period_start_at timestamptz;
alter table finance.statement add column period_end_at timestamptz;
alter table finance.statement add column opening_debit_minor bigint not null default 0 check(opening_debit_minor>=0);
alter table finance.statement add column opening_credit_minor bigint not null default 0 check(opening_credit_minor>=0);
alter table finance.statement add column closing_debit_minor bigint not null default 0 check(closing_debit_minor>=0);
alter table finance.statement add column closing_credit_minor bigint not null default 0 check(closing_credit_minor>=0);
alter table finance.statement add column account_count bigint not null default 0 check(account_count>=0);
alter table finance.statement add column source_hash char(64);
alter table finance.statement add column watermark timestamptz;
alter table finance.statement add column balanced boolean not null default false;
alter table finance.statement add column calculation_version bigint not null default 1 check(calculation_version>0);
update finance.statement statement set
  ledger_id=finance.ledger_id(statement.scope_id,statement.currency),
  legal_timezone=(select ledger.legal_timezone from finance.ledger ledger
    where ledger.id=finance.ledger_id(statement.scope_id,statement.currency));
update finance.statement statement set
  period_start_at=statement.period_start::timestamp at time zone statement.legal_timezone,
  period_end_at=(statement.period_end+1)::timestamp at time zone statement.legal_timezone,
  source_hash=encode(public.digest('legacy:'||statement.id,'sha256'),'hex');
update finance.statement set state='replaced' where calculation_version=1 and state in('draft','final');
alter table finance.statement alter column ledger_id set not null;
alter table finance.statement alter column legal_timezone set not null;
alter table finance.statement alter column period_start_at set not null;
alter table finance.statement alter column period_end_at set not null;
alter table finance.statement alter column source_hash set not null;
alter table finance.statement add constraint finance_statement_ledger foreign key(ledger_id) references finance.ledger(id);
alter table finance.statement add constraint finance_statement_bounds check(period_start_at<period_end_at);
create unique index finance_statement_active_period
  on finance.statement(ledger_id,period_start,period_end)
  where state in('draft','final');

create table finance.statementaccount(
  statement_id text not null references finance.statement(id),
  scope_id text not null,
  ledger_id text not null references finance.ledger(id),
  account_id text not null references finance.account(id),
  account_code text not null,
  account_kind text not null check(account_kind in('asset','liability','equity','income','expense')),
  opening_debit_minor bigint not null check(opening_debit_minor>=0),
  opening_credit_minor bigint not null check(opening_credit_minor>=0),
  period_debit_minor bigint not null check(period_debit_minor>=0),
  period_credit_minor bigint not null check(period_credit_minor>=0),
  closing_debit_minor bigint not null check(closing_debit_minor>=0),
  closing_credit_minor bigint not null check(closing_credit_minor>=0),
  source_hash char(64) not null,
  primary key(statement_id,account_id),
  check(opening_debit_minor=0 or opening_credit_minor=0),
  check(closing_debit_minor=0 or closing_credit_minor=0)
);

-- Explicit subledgers mirror only classified general-ledger entries and retain
-- their source entry. They never become an independently editable balance.
create table finance.subledger(
  id text primary key,
  scope_id text not null,
  ledger_id text not null references finance.ledger(id),
  kind text not null check(kind in(
    'order_receivable','supplier_payable','channel_clearing','distribution_commission')),
  subject_id text not null,
  currency char(3) not null,
  state text not null check(state in('active','closed')),
  created_at timestamptz not null,
  unique(ledger_id,kind,subject_id)
);

create table finance.subledgerentry(
  id text primary key,
  scope_id text not null,
  subledger_id text not null references finance.subledger(id),
  journal_id text not null references finance.journal(id),
  source_entry_id text not null unique references finance.entry(id),
  account_id text not null references finance.account(id),
  side text not null check(side in('debit','credit')),
  amount_minor bigint not null check(amount_minor>0),
  occurred_at timestamptz not null,
  source_hash char(64) not null
);

create or replace function finance.classify_subledger(p_code text)
returns table(kind text,subject_id text) language sql immutable strict parallel safe as $function$
  select case
      when p_code like 'order.receivable.%' then 'order_receivable'
      when p_code like 'settlement.payable.%' then 'supplier_payable'
      when p_code like 'channel.clearing.%' then 'channel_clearing'
      when p_code like 'distribution.commission.payable.%' then 'distribution_commission'
    end,
    case
      when p_code like 'order.receivable.%' then substr(p_code,length('order.receivable.')+1)
      when p_code like 'settlement.payable.%' then substr(p_code,length('settlement.payable.')+1)
      when p_code like 'channel.clearing.%' then substr(p_code,length('channel.clearing.')+1)
      when p_code like 'distribution.commission.payable.%' then substr(p_code,length('distribution.commission.payable.')+1)
    end
  where p_code like 'order.receivable.%'
    or p_code like 'settlement.payable.%'
    or p_code like 'channel.clearing.%'
    or p_code like 'distribution.commission.payable.%'
$function$;

create or replace function finance.capture_subledger(p_entry text)
returns void language plpgsql volatile security definer set search_path=finance,pg_temp as $function$
declare
  source record;
  classified record;
  subledgerid text;
begin
  select entry.id,entry.journal_id,entry.account_id,entry.side,entry.amount_minor,
    account.scope_id,account.ledger_id,account.code,account.currency,journal.posted_at
  into source from finance.entry entry
  join finance.account account on account.id=entry.account_id
  join finance.journal journal on journal.id=entry.journal_id
  where entry.id=p_entry and journal.state='posted';
  if source.id is null then raise exception 'FINANCE_SUBLEDGER_SOURCE_MISSING'; end if;
  select * into classified from finance.classify_subledger(source.code);
  if classified.kind is null or classified.subject_id is null or classified.subject_id='' then return; end if;
  subledgerid:='subledger:'||substr(encode(public.digest(
    source.ledger_id||':'||classified.kind||':'||classified.subject_id,'sha256'),'hex'),1,40);
  insert into finance.subledger(id,scope_id,ledger_id,kind,subject_id,currency,state,created_at)
  values(subledgerid,source.scope_id,source.ledger_id,classified.kind,classified.subject_id,
    source.currency,'active',clock_timestamp())
  on conflict(ledger_id,kind,subject_id) do nothing;
  insert into finance.subledgerentry(
    id,scope_id,subledger_id,journal_id,source_entry_id,account_id,side,amount_minor,occurred_at,source_hash
  ) values(
    'subledgerentry:'||substr(encode(public.digest(source.id,'sha256'),'hex'),1,40),
    source.scope_id,subledgerid,source.journal_id,source.id,source.account_id,source.side,
    source.amount_minor,source.posted_at,
    encode(public.digest(source.journal_id||':'||source.id||':'||source.side||':'||source.amount_minor,'sha256'),'hex')
  ) on conflict(source_entry_id) do nothing;
end $function$;

select finance.capture_subledger(entry.id)
from finance.entry entry
join finance.account account on account.id=entry.account_id
where exists(select 1 from finance.classify_subledger(account.code));

create or replace function finance.trial_balance_hash(p_scope text,p_currency text,p_period text)
returns char(64) language plpgsql stable security definer set search_path=finance,pg_temp as $function$
declare
  legaltimezone text;
  periodend timestamptz;
  result char(64);
begin
  if p_period!~'^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'FINANCE_PERIOD_INVALID'; end if;
  if current_setting('app.workload',true)='api' and not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_SCOPE_FORBIDDEN'; end if;
  select ledger.legal_timezone into legaltimezone from finance.ledger ledger
  where ledger.id=finance.ledger_id(p_scope,p_currency) and ledger.state='active';
  if legaltimezone is null then raise exception 'FINANCE_LEDGER_NOT_ACTIVE'; end if;
  periodend:=(to_date(p_period||'-01','YYYY-MM-DD')+interval '1 month')::timestamp at time zone legaltimezone;
  select encode(public.digest(coalesce(string_agg(
    journal.id||':'||journal.reference_type||':'||journal.reference_id||':'||
    to_char(journal.posted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||':'||
    entry.id||':'||entry.account_id||':'||entry.side||':'||entry.amount_minor,
    ',' order by journal.posted_at,journal.id,entry.id),''),'sha256'),'hex')
  into result
  from finance.journal journal
  join finance.entry entry on entry.journal_id=journal.id
  join finance.account account on account.id=entry.account_id
  where journal.scope_id=p_scope and journal.currency=p_currency and journal.state='posted'
    and account.ledger_id=finance.ledger_id(p_scope,p_currency)
    and journal.posted_at<periodend;
  return result;
end $function$;

create or replace function finance.refresh_trial_balance(
  p_scope text,p_currency text,p_period text,p_allow_closed boolean default false
) returns text language plpgsql volatile security definer set search_path=finance,pg_temp as $function$
declare
  ledgerrow finance.ledger%rowtype;
  periodstate text;
  periodstart timestamptz;
  periodend timestamptz;
  statementid text;
  statementstate text;
  sourcehash char(64);
  isbalanced boolean;
begin
  if p_period!~'^[0-9]{4}-(0[1-9]|1[0-2])$' or p_currency<>'CNY'
  then raise exception 'FINANCE_PERIOD_INVALID'; end if;
  if current_setting('app.workload',true)='api' and not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_SCOPE_FORBIDDEN'; end if;
  if current_setting('app.workload',true)='api' and p_allow_closed
  then raise exception 'FINANCE_PERIOD_OVERRIDE_FORBIDDEN'; end if;
  select * into ledgerrow from finance.ledger
  where id=finance.ledger_id(p_scope,p_currency) and state='active';
  if ledgerrow.id is null then raise exception 'FINANCE_LEDGER_NOT_ACTIVE'; end if;
  periodstart:=to_date(p_period||'-01','YYYY-MM-DD')::timestamp at time zone ledgerrow.legal_timezone;
  periodend:=(to_date(p_period||'-01','YYYY-MM-DD')+interval '1 month')::timestamp at time zone ledgerrow.legal_timezone;
  insert into finance.period(
    scope_id,period,state,ledger_id,legal_timezone,period_start_at,period_end_at
  ) values(
    p_scope,p_period,'open',ledgerrow.id,ledgerrow.legal_timezone,periodstart,periodend
  ) on conflict(scope_id,period) do nothing;
  select state into periodstate from finance.period
  where scope_id=p_scope and period=p_period for update;
  if periodstate<>'open' and not p_allow_closed then raise exception 'FINANCE_PERIOD_NOT_OPEN'; end if;
  statementid:='statement:'||substr(encode(public.digest(
    p_scope||':'||ledgerrow.id||':'||p_period||':trial:v2','sha256'),'hex'),1,40);
  select state into statementstate from finance.statement where id=statementid;
  if statementstate='final' and p_allow_closed then return statementid; end if;
  if statementstate is not null and statementstate<>'draft'
  then raise exception 'FINANCE_STATEMENT_IMMUTABLE'; end if;
  sourcehash:=finance.trial_balance_hash(p_scope,p_currency,p_period);
  insert into finance.statement(
    id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,credit_minor,closing_minor,
    state,generated_at,ledger_id,legal_timezone,period_start_at,period_end_at,
    opening_debit_minor,opening_credit_minor,closing_debit_minor,closing_credit_minor,
    account_count,source_hash,watermark,balanced,calculation_version
  ) values(
    statementid,p_scope,to_date(p_period||'-01','YYYY-MM-DD'),
    (to_date(p_period||'-01','YYYY-MM-DD')+interval '1 month'-interval '1 day')::date,
    p_currency,0,0,0,0,'draft',clock_timestamp(),ledgerrow.id,ledgerrow.legal_timezone,
    periodstart,periodend,0,0,0,0,0,sourcehash,null,false,2
  ) on conflict(id) do update set generated_at=clock_timestamp(),source_hash=excluded.source_hash,
    period_start_at=excluded.period_start_at,period_end_at=excluded.period_end_at
    where finance.statement.state='draft';
  delete from finance.statementaccount where statement_id=statementid;
  insert into finance.statementaccount(
    statement_id,scope_id,ledger_id,account_id,account_code,account_kind,
    opening_debit_minor,opening_credit_minor,period_debit_minor,period_credit_minor,
    closing_debit_minor,closing_credit_minor,source_hash
  )
  with balances as(
    select account.id,account.code,account.kind,
      coalesce(sum(case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end)
        filter(where journal.posted_at<periodstart),0)::bigint opening_balance,
      coalesce(sum(entry.amount_minor)
        filter(where journal.posted_at>=periodstart and journal.posted_at<periodend and entry.side='debit'),0)::bigint period_debit,
      coalesce(sum(entry.amount_minor)
        filter(where journal.posted_at>=periodstart and journal.posted_at<periodend and entry.side='credit'),0)::bigint period_credit,
      encode(public.digest(coalesce(string_agg(
        journal.id||':'||entry.id||':'||entry.side||':'||entry.amount_minor,
        ',' order by journal.posted_at,journal.id,entry.id)
        filter(where journal.posted_at<periodend),''),'sha256'),'hex') account_hash
    from finance.account account
    left join finance.entry entry on entry.account_id=account.id
    left join finance.journal journal on journal.id=entry.journal_id
      and journal.state='posted' and journal.posted_at<periodend
    where account.ledger_id=ledgerrow.id
    group by account.id,account.code,account.kind
  ), split as(
    select balances.*,(opening_balance+period_debit-period_credit)::bigint closing_balance
    from balances
  )
  select statementid,p_scope,ledgerrow.id,id,code,kind,
    greatest(opening_balance,0),greatest(-opening_balance,0),period_debit,period_credit,
    greatest(closing_balance,0),greatest(-closing_balance,0),account_hash
  from split
  where opening_balance<>0 or period_debit<>0 or period_credit<>0 or closing_balance<>0;
  update finance.statement statement set
    opening_minor=totals.opening_debit,
    debit_minor=totals.period_debit,
    credit_minor=totals.period_credit,
    closing_minor=totals.closing_debit,
    opening_debit_minor=totals.opening_debit,
    opening_credit_minor=totals.opening_credit,
    closing_debit_minor=totals.closing_debit,
    closing_credit_minor=totals.closing_credit,
    account_count=totals.account_count,
    source_hash=sourcehash,
    watermark=totals.watermark,
    balanced=totals.opening_debit=totals.opening_credit
      and totals.period_debit=totals.period_credit
      and totals.closing_debit=totals.closing_credit,
    generated_at=clock_timestamp()
  from (
    select
      coalesce(sum(line.opening_debit_minor),0)::bigint opening_debit,
      coalesce(sum(line.opening_credit_minor),0)::bigint opening_credit,
      coalesce(sum(line.period_debit_minor),0)::bigint period_debit,
      coalesce(sum(line.period_credit_minor),0)::bigint period_credit,
      coalesce(sum(line.closing_debit_minor),0)::bigint closing_debit,
      coalesce(sum(line.closing_credit_minor),0)::bigint closing_credit,
      count(*)::bigint account_count,
      (select max(journal.posted_at) from finance.journal journal
        where journal.scope_id=p_scope and journal.currency=p_currency
          and journal.state='posted' and journal.posted_at>=periodstart and journal.posted_at<periodend) watermark
    from finance.statementaccount line where line.statement_id=statementid
  ) totals
  where statement.id=statementid
  returning statement.balanced into isbalanced;
  if not coalesce(isbalanced,false) then raise exception 'FINANCE_TRIAL_BALANCE_UNBALANCED'; end if;
  return statementid;
end $function$;

create or replace function finance.subledger_consistent(p_scope text,p_currency text,p_period text)
returns boolean language plpgsql stable security definer set search_path=finance,pg_temp as $function$
declare
  legaltimezone text;
  periodstart timestamptz;
  periodend timestamptz;
  consistent boolean;
begin
  if current_setting('app.workload',true)='api' and not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_SCOPE_FORBIDDEN'; end if;
  select legal_timezone into legaltimezone from finance.ledger
    where id=finance.ledger_id(p_scope,p_currency);
  if legaltimezone is null then return false; end if;
  periodstart:=to_date(p_period||'-01','YYYY-MM-DD')::timestamp at time zone legaltimezone;
  periodend:=(to_date(p_period||'-01','YYYY-MM-DD')+interval '1 month')::timestamp at time zone legaltimezone;
  with classified as(
    select entry.id,entry.journal_id,entry.account_id,entry.side,entry.amount_minor,journal.posted_at
    from finance.entry entry
    join finance.account account on account.id=entry.account_id
    join finance.journal journal on journal.id=entry.journal_id
    where journal.scope_id=p_scope and journal.currency=p_currency and journal.state='posted'
      and journal.posted_at>=periodstart and journal.posted_at<periodend
      and exists(select 1 from finance.classify_subledger(account.code))
  )
  select not exists(
    select 1 from classified source left join finance.subledgerentry target
      on target.source_entry_id=source.id and target.journal_id=source.journal_id
      and target.account_id=source.account_id and target.side=source.side
      and target.amount_minor=source.amount_minor and target.occurred_at=source.posted_at
    where target.id is null
  ) and not exists(
    select 1 from finance.subledgerentry target
    join finance.journal journal on journal.id=target.journal_id
    left join classified source on source.id=target.source_entry_id
    where target.scope_id=p_scope and journal.posted_at>=periodstart and journal.posted_at<periodend
      and source.id is null
  ) into consistent;
  return coalesce(consistent,false);
end $function$;

create or replace function finance.period_control(
  p_scope text,p_currency text,p_period text,p_as_of timestamptz default clock_timestamp()
)
returns table(
  statement_id text,
  source_hash char(64),
  current_hash char(64),
  balanced boolean,
  subledger_consistent boolean,
  unresolved_differences bigint,
  unposted_journals bigint,
  uncertain_payouts bigint,
  unprocessed_finance_events bigint,
  incomplete_finance_jobs bigint,
  unsettled_approved_reconciliations bigint,
  missing_settlement_journals bigint,
  period_end_at timestamptz,
  close_eligible_at timestamptz,
  cutoff_reached boolean,
  ready boolean
) language plpgsql stable security definer set search_path=finance,pg_temp as $function$
begin
  if current_setting('app.workload',true)='api' and not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_SCOPE_FORBIDDEN'; end if;
  if p_as_of is null then raise exception 'FINANCE_PERIOD_INVALID'; end if;
  return query with selected_period as(
    select period.scope_id,period.period,period.ledger_id,period.legal_timezone,
      period.period_start_at,period.period_end_at,
      period.period_end_at+interval '15 minutes' close_eligible_at
    from finance.period period
    where period.scope_id=p_scope and period.period=p_period
      and period.ledger_id=finance.ledger_id(p_scope,p_currency)
  ), selected_statement as(
    select statement.id,statement.source_hash,statement.balanced
    from finance.statement statement
    where statement.ledger_id=finance.ledger_id(p_scope,p_currency)
      and to_char(statement.period_start,'YYYY-MM')=p_period
      and statement.state='draft' and statement.calculation_version=2
  ), period_reconciliations as materialized(
    select reconciliation.id,reconciliation.scope_id,reconciliation.partner_id,
      reconciliation.period,reconciliation.state
    from finance.reconciliation reconciliation
    join channel.statement provider_statement on provider_statement.id=reconciliation.statement_ref
      and provider_statement.scope_id=reconciliation.scope_id
      and provider_statement.provider=reconciliation.provider
      and provider_statement.partner_id=reconciliation.partner_id
      and provider_statement.sha256=reconciliation.statement_hash
    cross join selected_period period
    where reconciliation.scope_id=p_scope
      and provider_statement.period_start<=
        ((period.period_end_at at time zone period.legal_timezone)::date-1)
      and provider_statement.period_end>=
        (period.period_start_at at time zone period.legal_timezone)::date
  ), period_finance_events as materialized(
    select outbox.id,outbox.event_type,outbox.event_version,outbox.payload
    from runtime.outbox outbox cross join selected_period period
    where outbox.scope_id=p_scope
      and outbox.occurred_at>=period.period_start_at
      and outbox.occurred_at<period.period_end_at
      and outbox.event_type in(
        'order.placed','order.cancelled','payment.succeeded','payment.refunded',
        'payment.late.detected','payment.late.refunded','payment.autorefund.requested'
      )
  ), payable_settlements as materialized(
    select reconciliation.id reconciliation_id,settlement.id settlement_id,
      settlement.partner_id,settlement.amount_minor,settlement.fee_minor
    from period_reconciliations reconciliation
    join finance.settlement settlement on settlement.reconciliation_id=reconciliation.id
      and settlement.scope_id=reconciliation.scope_id
      and settlement.partner_id=reconciliation.partner_id
      and settlement.period=reconciliation.period
      and settlement.currency=p_currency
      and settlement.state in('payable','paid')
    where reconciliation.state='approved'
  ), expected_settlement_journals as materialized(
    select settlement.settlement_id||':partner' reference_id,
      settlement.amount_minor amount_minor,'Settlement liability accrual'::text description,
      ('settlement.payable.'||settlement.partner_id)::text credit_code,'liability'::text credit_kind
    from payable_settlements settlement
    union all
    select settlement.settlement_id||':platform',settlement.fee_minor,
      'Settlement platform fee','platform.fee','income'
    from payable_settlements settlement where settlement.fee_minor>0
  ), controls as(
    select
      (select count(*) from period_reconciliations reconciliation
        where reconciliation.state<>'approved')::bigint unresolved,
      (select count(*) from finance.journal journal
        where journal.scope_id=p_scope and journal.currency=p_currency
          and journal.period=p_period and journal.state='draft')::bigint unposted,
      (select count(*) from finance.withdrawal withdrawal
        join finance.settlement settlement on settlement.id=withdrawal.settlement_id
        join finance.reconciliation reconciliation on reconciliation.id=settlement.reconciliation_id
        join channel.statement provider_statement on provider_statement.id=reconciliation.statement_ref
        cross join selected_period period
        where withdrawal.scope_id=p_scope
          and provider_statement.period_start<=
            ((period.period_end_at at time zone period.legal_timezone)::date-1)
          and provider_statement.period_end>=
            (period.period_start_at at time zone period.legal_timezone)::date
          and withdrawal.state='uncertain')::bigint uncertain,
      (select count(*) from period_finance_events event
        where not exists(
          select 1 from runtime.inbox inbox
          where inbox.consumer='job:reconciliation' and inbox.event_id=event.id
            and inbox.event_type=event.event_type and inbox.event_version=event.event_version
            and inbox.payload=event.payload and inbox.processed_at is not null
        ))::bigint unprocessed_events,
      (select count(*) from runtime.job job
        where ((job.owner='reconciliation' and job.kind='reconciliation')
            or (job.owner='finance' and job.kind in('reconciliation','settlement')))
          and job.scope_id=p_scope and job.state<>'completed' and(
            exists(select 1 from period_finance_events event
              where event.id=job.payload->>'eventId' and job.kind='reconciliation')
            or exists(select 1 from period_reconciliations reconciliation
              where reconciliation.id=job.payload->>'reconciliation')
            or exists(select 1 from finance.settlement settlement
              join period_reconciliations reconciliation on reconciliation.id=settlement.reconciliation_id
              where settlement.scope_id=p_scope and settlement.id=job.payload->>'settlement')
            or exists(select 1 from finance.withdrawal withdrawal
              join finance.settlement settlement on settlement.id=withdrawal.settlement_id
              join period_reconciliations reconciliation on reconciliation.id=settlement.reconciliation_id
              where withdrawal.scope_id=p_scope and withdrawal.id=job.payload->>'withdrawal')
          ))::bigint incomplete_jobs,
      (select count(*) from period_reconciliations reconciliation
        where reconciliation.state='approved' and not exists(
          select 1 from payable_settlements settlement
          where settlement.reconciliation_id=reconciliation.id
        ))::bigint unsettled_reconciliations,
      (select count(*) from expected_settlement_journals expected
        cross join selected_period period where not exists(
          select 1 from finance.journal journal
          where journal.scope_id=p_scope and journal.currency=p_currency
            and journal.reference_type='finance.settlement.approved'
            and journal.reference_id=expected.reference_id
            and journal.period=p_period and journal.state='posted'
            and journal.posted_at>=period.period_start_at and journal.posted_at<period.period_end_at
            and journal.reversal_of is null and journal.correction_of is null
            and journal.source_hash=encode(public.digest(
              p_scope||':finance.settlement.approved:'||expected.reference_id||':'||p_currency||':'||
              expected.amount_minor||':'||expected.description||':settlement.cost:expense:'||
              expected.credit_code||':'||expected.credit_kind||':'||
              to_char(journal.posted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'),
              'sha256'),'hex')
            and (select count(*) from finance.entry entry where entry.journal_id=journal.id)=2
            and exists(select 1 from finance.entry entry
              join finance.account account on account.id=entry.account_id
              where entry.journal_id=journal.id and account.scope_id=p_scope
                and account.currency=p_currency and account.code='settlement.cost'
                and account.kind='expense' and entry.side='debit'
                and entry.amount_minor=expected.amount_minor)
            and exists(select 1 from finance.entry entry
              join finance.account account on account.id=entry.account_id
              where entry.journal_id=journal.id and account.scope_id=p_scope
                and account.currency=p_currency and account.code=expected.credit_code
                and account.kind=expected.credit_kind and entry.side='credit'
                and entry.amount_minor=expected.amount_minor)
            and not exists(select 1 from finance.journal related
              where related.state='posted'
                and (related.reversal_of=journal.id or related.correction_of=journal.id))
        ))::bigint missing_journals
  ), hashes as(
    select finance.trial_balance_hash(p_scope,p_currency,p_period) current_hash,
      finance.subledger_consistent(p_scope,p_currency,p_period) subledger_ok
  )
  select statement.id,statement.source_hash,hashes.current_hash,statement.balanced,hashes.subledger_ok,
    controls.unresolved,controls.unposted,controls.uncertain,controls.unprocessed_events,
    controls.incomplete_jobs,controls.unsettled_reconciliations,controls.missing_journals,
    period.period_end_at,period.close_eligible_at,
    p_as_of>=period.close_eligible_at,
    statement.balanced and hashes.subledger_ok and statement.source_hash=hashes.current_hash
      and controls.unresolved=0 and controls.unposted=0 and controls.uncertain=0
      and controls.unprocessed_events=0 and controls.incomplete_jobs=0
      and controls.unsettled_reconciliations=0 and controls.missing_journals=0
      and p_as_of>=period.close_eligible_at
  from selected_period period cross join selected_statement statement cross join controls cross join hashes;
end
$function$;

create or replace function finance.post(
  p_scope text,p_reference_type text,p_reference_id text,p_currency text,p_description text,
  p_debit_code text,p_debit_kind text,p_credit_code text,p_credit_kind text,p_amount bigint,
  p_occurred_at timestamptz default clock_timestamp()
) returns text language plpgsql volatile security definer set search_path=finance,pg_temp as $function$
declare
  debitid text;
  creditid text;
  ledgerrow finance.ledger%rowtype;
  periodid text;
  periodstate text;
  journalid text:='journal:'||substr(encode(public.digest(
    p_scope||':'||p_reference_type||':'||p_reference_id,'sha256'),'hex'),1,40);
  inserted text;
  ruleversion bigint;
  accountingrule finance.accountingeventrule%rowtype;
  debitrole text;
  creditrole text;
  expectedsourcehash char(64);
  debitentry text;
  creditentry text;
  existingid text;
begin
  if p_scope is null or p_scope='' or p_amount is null or p_amount<=0 or p_amount>9007199254740991
    or p_currency is null or p_currency<>'CNY'
    or p_reference_type is null or p_reference_type='' or p_reference_id is null or p_reference_id=''
    or p_description is null or p_description='' or p_occurred_at is null or length(p_description)>1000
  then raise exception 'FINANCE_POST_INVALID'; end if;
  if current_setting('app.workload',true)='api' and not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_SCOPE_FORBIDDEN'; end if;
  expectedsourcehash:=encode(public.digest(
    p_scope||':'||p_reference_type||':'||p_reference_id||':'||p_currency||':'||p_amount||':'||
    p_description||':'||p_debit_code||':'||p_debit_kind||':'||p_credit_code||':'||p_credit_kind||':'||
    to_char(p_occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'),
    'sha256'),'hex');
  select id into existingid from finance.journal
    where scope_id=p_scope and reference_type=p_reference_type and reference_id=p_reference_id for update;
  if existingid is not null then
    if not exists(
      select 1 from finance.journal journal where journal.id=journalid and journal.id=existingid
        and journal.scope_id=p_scope and journal.currency=p_currency and journal.state='posted'
        and journal.source_hash=expectedsourcehash
        and (select count(*) from finance.entry entry where entry.journal_id=journal.id)=2
        and exists(select 1 from finance.entry entry join finance.account account on account.id=entry.account_id
          where entry.journal_id=journal.id and account.scope_id=p_scope and account.currency=p_currency
            and account.code=p_debit_code and account.kind=p_debit_kind and entry.side='debit' and entry.amount_minor=p_amount)
        and exists(select 1 from finance.entry entry join finance.account account on account.id=entry.account_id
          where entry.journal_id=journal.id and account.scope_id=p_scope and account.currency=p_currency
            and account.code=p_credit_code and account.kind=p_credit_kind and entry.side='credit' and entry.amount_minor=p_amount)
    ) then raise exception 'FINANCE_IDEMPOTENCY_MISMATCH'; end if;
    return existingid;
  end if;
  select * into accountingrule from finance.accountingeventrule
    where event_type=p_reference_type and effective_at<=p_occurred_at
    order by version desc limit 1;
  ruleversion:=accountingrule.version;
  if ruleversion is null then raise exception 'FINANCE_ACCOUNTING_EVENT_UNSUPPORTED'; end if;
  debitrole:=finance.account_role(p_debit_code,p_debit_kind);
  creditrole:=finance.account_role(p_credit_code,p_credit_kind);
  if debitrole is null or creditrole is null
    or not (debitrole=any(accountingrule.debit_roles))
    or not (creditrole=any(accountingrule.credit_roles))
  then raise exception 'FINANCE_ACCOUNTING_EVENT_ACCOUNT_MISMATCH'; end if;
  debitid:=finance.ensure_account(p_scope,p_debit_code,p_currency,p_debit_kind);
  creditid:=finance.ensure_account(p_scope,p_credit_code,p_currency,p_credit_kind);
  if debitid=creditid then raise exception 'FINANCE_POST_SAME_ACCOUNT'; end if;
  select * into ledgerrow from finance.ledger
    where id=finance.ledger_id(p_scope,p_currency) and state='active';
  if ledgerrow.id is null then raise exception 'FINANCE_LEDGER_NOT_ACTIVE'; end if;
  periodid:=to_char(p_occurred_at at time zone ledgerrow.legal_timezone,'YYYY-MM');
  insert into finance.period(
    scope_id,period,state,ledger_id,legal_timezone,period_start_at,period_end_at
  ) values(
    p_scope,periodid,'open',ledgerrow.id,ledgerrow.legal_timezone,
    to_date(periodid||'-01','YYYY-MM-DD')::timestamp at time zone ledgerrow.legal_timezone,
    (to_date(periodid||'-01','YYYY-MM-DD')+interval '1 month')::timestamp at time zone ledgerrow.legal_timezone
  ) on conflict(scope_id,period) do nothing;
  select state into periodstate from finance.period
    where scope_id=p_scope and period=periodid for update;
  if periodstate<>'open' then raise exception 'FINANCE_PERIOD_NOT_OPEN'; end if;
  insert into finance.journal(
    id,scope_id,reference_type,reference_id,currency,period,state,description,posted_at,version,
    accounting_rule_version,source_hash
  ) values(
    journalid,p_scope,p_reference_type,p_reference_id,p_currency,periodid,'posted',p_description,p_occurred_at,0,
    ruleversion,expectedsourcehash
  ) on conflict(scope_id,reference_type,reference_id) do nothing returning id into inserted;
  if inserted is null then
    if not exists(
      select 1 from finance.journal journal where journal.id=journalid and journal.scope_id=p_scope
        and journal.currency=p_currency and journal.state='posted'
        and journal.accounting_rule_version=ruleversion
        and journal.source_hash=expectedsourcehash
        and (select count(*) from finance.entry entry where entry.journal_id=journal.id)=2
        and exists(select 1 from finance.entry where journal_id=journal.id
          and account_id=debitid and side='debit' and amount_minor=p_amount)
        and exists(select 1 from finance.entry where journal_id=journal.id
          and account_id=creditid and side='credit' and amount_minor=p_amount)
    ) then raise exception 'FINANCE_IDEMPOTENCY_MISMATCH'; end if;
    return journalid;
  end if;
  debitentry:='entry:'||substr(encode(public.digest(journalid||':debit','sha256'),'hex'),1,40);
  creditentry:='entry:'||substr(encode(public.digest(journalid||':credit','sha256'),'hex'),1,40);
  insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at) values
    (debitentry,journalid,debitid,'debit',p_amount,p_occurred_at),
    (creditentry,journalid,creditid,'credit',p_amount,p_occurred_at);
  perform finance.capture_subledger(debitentry);
  perform finance.capture_subledger(creditentry);
  if (select coalesce(sum(case when side='debit' then amount_minor else -amount_minor end),0)
      from finance.entry where journal_id=journalid)<>0
  then raise exception 'FINANCE_JOURNAL_UNBALANCED'; end if;
  perform finance.refresh_trial_balance(p_scope,p_currency,periodid,false);
  insert into runtime.outbox(
    id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at
  ) values(
    'event:'||substr(encode(public.digest('finance.entry.posted:'||journalid,'sha256'),'hex'),1,40),
    'finance.entry.posted',1,'journal',journalid,p_scope,
    jsonb_build_object(
      'journal',journalid,'referenceType',p_reference_type,'referenceId',p_reference_id,
      'amountMinor',p_amount,'currency',p_currency,'debit',p_debit_code,'credit',p_credit_code,
      'accountingRuleVersion',ruleversion
    ),journalid,p_occurred_at,clock_timestamp()
  ) on conflict(id) do nothing;
  return journalid;
end $function$;

create or replace function finance.reverse(
  p_scope text,p_journal text,p_reference_id text,p_reason text,p_actor text,
  p_occurred_at timestamptz default clock_timestamp()
) returns text language plpgsql volatile security definer set search_path=finance,pg_temp as $function$
declare
  original finance.journal%rowtype;
  ledgerrow finance.ledger%rowtype;
  periodid text;
  periodstate text;
  reversalid text:='journal:'||substr(encode(public.digest(
    p_scope||':finance.journal.reversal:'||p_reference_id,'sha256'),'hex'),1,40);
  inserted text;
  sourceentry record;
  targetentry text;
  existing finance.journal%rowtype;
  expectedsourcehash char(64);
begin
  if p_reference_id='' or p_reason='' or p_actor='' or p_occurred_at is null
  then raise exception 'FINANCE_REVERSAL_INVALID'; end if;
  if current_setting('app.workload',true)='api' and not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_SCOPE_FORBIDDEN'; end if;
  select * into original from finance.journal
    where id=p_journal and scope_id=p_scope and state='posted' for update;
  if original.id is null then raise exception 'FINANCE_REVERSAL_SOURCE_MISSING'; end if;
  expectedsourcehash:=encode(public.digest(original.id||':'||p_reference_id||':'||p_actor||':'||p_reason,'sha256'),'hex');
  select * into existing from finance.journal where reversal_of=original.id;
  if existing.id is not null then
    if existing.id<>reversalid or existing.reference_id<>p_reference_id or existing.scope_id<>p_scope
      or existing.currency<>original.currency or existing.state<>'posted' or existing.source_hash<>expectedsourcehash
      or (select count(*) from finance.entry where journal_id=existing.id)<>
        (select count(*) from finance.entry where journal_id=original.id)
      or exists(select 1 from finance.entry source where source.journal_id=original.id and not exists(
        select 1 from finance.entry target where target.journal_id=existing.id and target.account_id=source.account_id
          and target.side=case source.side when 'debit' then 'credit' else 'debit' end
          and target.amount_minor=source.amount_minor))
    then raise exception 'FINANCE_JOURNAL_ALREADY_REVERSED'; end if;
    return existing.id;
  end if;
  if exists(select 1 from finance.journal where correction_of=original.id)
  then raise exception 'FINANCE_JOURNAL_ALREADY_CORRECTED'; end if;
  select * into ledgerrow from finance.ledger
    where id=finance.ledger_id(p_scope,original.currency) and state='active';
  periodid:=to_char(p_occurred_at at time zone ledgerrow.legal_timezone,'YYYY-MM');
  insert into finance.period(
    scope_id,period,state,ledger_id,legal_timezone,period_start_at,period_end_at
  ) values(
    p_scope,periodid,'open',ledgerrow.id,ledgerrow.legal_timezone,
    to_date(periodid||'-01','YYYY-MM-DD')::timestamp at time zone ledgerrow.legal_timezone,
    (to_date(periodid||'-01','YYYY-MM-DD')+interval '1 month')::timestamp at time zone ledgerrow.legal_timezone
  ) on conflict(scope_id,period) do nothing;
  select state into periodstate from finance.period
    where scope_id=p_scope and period=periodid for update;
  if periodstate<>'open' then raise exception 'FINANCE_PERIOD_NOT_OPEN'; end if;
  insert into finance.journal(
    id,scope_id,reference_type,reference_id,currency,period,state,description,posted_at,version,
    accounting_rule_version,reversal_of,source_hash
  ) values(
    reversalid,p_scope,'finance.journal.reversal',p_reference_id,original.currency,periodid,'posted',
    'Reversal: '||left(p_reason,900),p_occurred_at,0,1,original.id,
    expectedsourcehash
  ) returning id into inserted;
  for sourceentry in
    select * from finance.entry where journal_id=original.id order by id
  loop
    targetentry:='entry:'||substr(encode(public.digest(
      inserted||':'||sourceentry.id,'sha256'),'hex'),1,40);
    insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at)
    values(targetentry,inserted,sourceentry.account_id,
      case sourceentry.side when 'debit' then 'credit' else 'debit' end,
      sourceentry.amount_minor,p_occurred_at);
    perform finance.capture_subledger(targetentry);
  end loop;
  if (select coalesce(sum(case when side='debit' then amount_minor else -amount_minor end),0)
      from finance.entry where journal_id=inserted)<>0
  then raise exception 'FINANCE_JOURNAL_UNBALANCED'; end if;
  perform finance.refresh_trial_balance(p_scope,original.currency,periodid,false);
  insert into runtime.outbox(
    id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at
  ) values(
    'event:'||substr(encode(public.digest('finance.entry.posted:'||inserted,'sha256'),'hex'),1,40),
    'finance.entry.posted',1,'journal',inserted,p_scope,
    jsonb_build_object(
      'journal',inserted,'referenceType','finance.journal.reversal','referenceId',p_reference_id,
      'reversalOf',original.id,'reason',p_reason,'actor',p_actor
    ),inserted,p_occurred_at,clock_timestamp()
  ) on conflict(id) do nothing;
  return inserted;
end $function$;

-- A correction is one append-only adjustment journal. It first neutralizes
-- every source entry exactly, then records the replacement debit/credit pair.
-- The replacement pair must satisfy the source event's original rule version;
-- the source journal and its entries are never updated or deleted.
create or replace function finance.correct(
  p_scope text,p_journal text,p_reference_id text,p_reason text,p_actor text,
  p_debit_code text,p_debit_kind text,p_credit_code text,p_credit_kind text,p_amount bigint,
  p_occurred_at timestamptz default clock_timestamp()
) returns text language plpgsql volatile security definer set search_path=finance,pg_temp as $function$
declare
  original finance.journal%rowtype;
  existing finance.journal%rowtype;
  accountingrule finance.accountingeventrule%rowtype;
  correctionruleversion bigint;
  ledgerrow finance.ledger%rowtype;
  periodid text;
  periodstate text;
  debitrole text;
  creditrole text;
  debitid text;
  creditid text;
  sourcecount bigint;
  sourcebalance numeric;
  sourcesafe boolean;
  sourceevidence char(64);
  expectedsourcehash char(64);
  correctionid text:='journal:'||substr(encode(public.digest(
    p_scope||':finance.journal.correction:'||p_reference_id,'sha256'),'hex'),1,40);
  inserted text;
  sourceentry record;
  targetentry text;
  replacementdebit text;
  replacementcredit text;
begin
  if p_scope is null or p_scope='' or p_journal is null or p_journal=''
    or p_reference_id is null or p_reference_id='' or p_reason is null or p_reason=''
    or p_actor is null or p_actor='' or p_occurred_at is null
    or p_debit_code is null or p_debit_code='' or p_credit_code is null or p_credit_code=''
    or p_amount is null or p_amount<=0 or p_amount>9007199254740991
    or length(p_reason)>900 or length(p_actor)>200
  then raise exception 'FINANCE_CORRECTION_INVALID'; end if;
  if current_setting('app.workload',true)='api' and not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_SCOPE_FORBIDDEN'; end if;

  -- The update lock serializes correction/reversal decisions for one source.
  select * into original from finance.journal
    where id=p_journal and scope_id=p_scope and state='posted' for update;
  if original.id is null then raise exception 'FINANCE_CORRECTION_SOURCE_MISSING'; end if;
  if original.posted_at is null or original.reversal_of is not null or original.correction_of is not null
    or original.reference_type in('finance.journal.reversal','finance.journal.correction')
  then raise exception 'FINANCE_CORRECTION_SOURCE_INVALID'; end if;
  if exists(select 1 from finance.journal where reversal_of=original.id)
  then raise exception 'FINANCE_CORRECTION_SOURCE_REVERSED'; end if;

  select * into accountingrule from finance.accountingeventrule
    where event_type=original.reference_type
      and version=original.accounting_rule_version
      and effective_at<=original.posted_at;
  if accountingrule.version is null
  then raise exception 'FINANCE_CORRECTION_SOURCE_RULE_MISSING'; end if;
  select version into correctionruleversion from finance.accountingeventrule
    where event_type='finance.journal.correction' and effective_at<=p_occurred_at
    order by version desc limit 1;
  if correctionruleversion is null
  then raise exception 'FINANCE_CORRECTION_RULE_MISSING'; end if;
  debitrole:=finance.account_role(p_debit_code,p_debit_kind);
  creditrole:=finance.account_role(p_credit_code,p_credit_kind);
  if debitrole is null or creditrole is null
    or not (debitrole=any(accountingrule.debit_roles))
    or not (creditrole=any(accountingrule.credit_roles))
  then raise exception 'FINANCE_ACCOUNTING_EVENT_ACCOUNT_MISMATCH'; end if;
  debitid:=finance.account_id(p_scope,p_debit_code,original.currency);
  creditid:=finance.account_id(p_scope,p_credit_code,original.currency);
  if debitid=creditid then raise exception 'FINANCE_CORRECTION_SAME_ACCOUNT'; end if;

  select count(*),
    coalesce(sum(case when entry.side='debit' then entry.amount_minor else -entry.amount_minor end),0),
    bool_and(entry.amount_minor between 1 and 9007199254740991),
    encode(public.digest(
      original.id||':'||original.reference_type||':'||original.reference_id||':'||original.currency||':'||
      original.period||':'||original.state||':'||original.description||':'||original.posted_at||':'||
      original.version||':'||original.accounting_rule_version||':'||coalesce(original.source_hash,'')||':'||
      coalesce(string_agg(entry.id||':'||entry.account_id||':'||entry.side||':'||entry.amount_minor,
        ',' order by entry.id),''),'sha256'),'hex')
  into sourcecount,sourcebalance,sourcesafe,sourceevidence
  from finance.entry entry where entry.journal_id=original.id;
  if sourcecount<2 or sourcebalance<>0 or sourcesafe is not true
    or exists(
      select 1 from finance.entry entry join finance.account account on account.id=entry.account_id
      where entry.journal_id=original.id
        and (account.scope_id<>p_scope or account.currency<>original.currency)
    )
  then raise exception 'FINANCE_CORRECTION_SOURCE_INVALID'; end if;

  expectedsourcehash:=encode(public.digest(
    p_scope||':'||original.id||':'||coalesce(original.source_hash,'')||':'||sourceevidence||':'||
    p_reference_id||':'||p_reason||':'||p_actor||':'||p_debit_code||':'||p_debit_kind||':'||
    p_credit_code||':'||p_credit_kind||':'||p_amount||':'||
    to_char(p_occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'),
    'sha256'),'hex');
  replacementdebit:='entry:'||substr(encode(public.digest(
    correctionid||':replacement:debit','sha256'),'hex'),1,40);
  replacementcredit:='entry:'||substr(encode(public.digest(
    correctionid||':replacement:credit','sha256'),'hex'),1,40);

  -- Exact retries return the existing authoritative result. A changed retry
  -- (including actor, reason, source evidence, accounts, amount or timestamp)
  -- fails closed instead of creating a second correction.
  select * into existing from finance.journal where correction_of=original.id;
  if existing.id is not null then
    if existing.id=correctionid
      and existing.reference_type='finance.journal.correction'
      and existing.reference_id=p_reference_id
      and existing.currency=original.currency and existing.state='posted'
      and existing.accounting_rule_version=correctionruleversion
      and existing.source_hash=expectedsourcehash
      and (select count(*) from finance.entry where journal_id=existing.id)=sourcecount+2
      and not exists(
        select 1 from finance.entry source
        where source.journal_id=original.id and not exists(
          select 1 from finance.entry target
          where target.journal_id=existing.id
            and target.id='entry:'||substr(encode(public.digest(
              existing.id||':reverse:'||source.id,'sha256'),'hex'),1,40)
            and target.account_id=source.account_id
            and target.side=case source.side when 'debit' then 'credit' else 'debit' end
            and target.amount_minor=source.amount_minor
        )
      )
      and exists(select 1 from finance.entry where id=replacementdebit
        and journal_id=existing.id and account_id=debitid and side='debit' and amount_minor=p_amount)
      and exists(select 1 from finance.entry where id=replacementcredit
        and journal_id=existing.id and account_id=creditid and side='credit' and amount_minor=p_amount)
    then return existing.id; end if;
    raise exception 'FINANCE_CORRECTION_IDEMPOTENCY_MISMATCH';
  end if;

  debitid:=finance.ensure_account(p_scope,p_debit_code,original.currency,p_debit_kind);
  creditid:=finance.ensure_account(p_scope,p_credit_code,original.currency,p_credit_kind);
  select * into ledgerrow from finance.ledger
    where id=finance.ledger_id(p_scope,original.currency) and state='active';
  if ledgerrow.id is null then raise exception 'FINANCE_LEDGER_NOT_ACTIVE'; end if;
  periodid:=to_char(p_occurred_at at time zone ledgerrow.legal_timezone,'YYYY-MM');
  insert into finance.period(
    scope_id,period,state,ledger_id,legal_timezone,period_start_at,period_end_at
  ) values(
    p_scope,periodid,'open',ledgerrow.id,ledgerrow.legal_timezone,
    to_date(periodid||'-01','YYYY-MM-DD')::timestamp at time zone ledgerrow.legal_timezone,
    (to_date(periodid||'-01','YYYY-MM-DD')+interval '1 month')::timestamp at time zone ledgerrow.legal_timezone
  ) on conflict(scope_id,period) do nothing;
  select state into periodstate from finance.period
    where scope_id=p_scope and period=periodid for update;
  if periodstate<>'open' then raise exception 'FINANCE_PERIOD_NOT_OPEN'; end if;

  insert into finance.journal(
    id,scope_id,reference_type,reference_id,currency,period,state,description,posted_at,version,
    accounting_rule_version,correction_of,source_hash
  ) values(
    correctionid,p_scope,'finance.journal.correction',p_reference_id,original.currency,periodid,'posted',
    'Correction: '||p_reason,p_occurred_at,0,correctionruleversion,original.id,expectedsourcehash
  ) on conflict do nothing returning id into inserted;
  if inserted is null then raise exception 'FINANCE_CORRECTION_IDEMPOTENCY_MISMATCH'; end if;

  for sourceentry in
    select * from finance.entry where journal_id=original.id order by id
  loop
    targetentry:='entry:'||substr(encode(public.digest(
      inserted||':reverse:'||sourceentry.id,'sha256'),'hex'),1,40);
    insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at)
    values(targetentry,inserted,sourceentry.account_id,
      case sourceentry.side when 'debit' then 'credit' else 'debit' end,
      sourceentry.amount_minor,p_occurred_at);
    perform finance.capture_subledger(targetentry);
  end loop;
  insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at) values
    (replacementdebit,inserted,debitid,'debit',p_amount,p_occurred_at),
    (replacementcredit,inserted,creditid,'credit',p_amount,p_occurred_at);
  perform finance.capture_subledger(replacementdebit);
  perform finance.capture_subledger(replacementcredit);
  if (select coalesce(sum(case when side='debit' then amount_minor else -amount_minor end),0)
      from finance.entry where journal_id=inserted)<>0
  then raise exception 'FINANCE_JOURNAL_UNBALANCED'; end if;
  perform finance.refresh_trial_balance(p_scope,original.currency,periodid,false);
  insert into runtime.outbox(
    id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at
  ) values(
    'event:'||substr(encode(public.digest('finance.entry.posted:'||inserted,'sha256'),'hex'),1,40),
    'finance.entry.posted',1,'journal',inserted,p_scope,
    jsonb_build_object(
      'journal',inserted,'referenceType','finance.journal.correction','referenceId',p_reference_id,
      'correctionOf',original.id,'correctedReferenceType',original.reference_type,
      'correctedAccountingRuleVersion',original.accounting_rule_version,
      'accountingRuleVersion',correctionruleversion,'sourceEvidence',sourceevidence,
      'amountMinor',p_amount,'currency',original.currency,'debit',p_debit_code,'credit',p_credit_code,
      'reason',p_reason,'actor',p_actor
    ),inserted,p_occurred_at,clock_timestamp()
  ) on conflict(id) do nothing;
  return inserted;
end $function$;

-- Settlement lines and splits are frozen accounting facts.  The worker and
-- command roles receive only purpose-built entry points; callers identify the
-- resource while this transaction derives every amount from locked sources.
create or replace function finance.freeze_settlement_facts(p_settlement text)
returns bigint language plpgsql volatile security definer
set search_path=finance,pg_temp as $function$
declare
  target finance.settlement%rowtype;
  policyrow finance.policy%rowtype;
  rulevalue jsonb;
  ruleid text;
  ruleversion bigint;
  rulehash text;
  basispoints integer;
  invoicebasis text;
  invoicetarget bigint;
  payablecount bigint;
  payablegross numeric;
  payablehash text;
  excludedcount bigint;
  excludedhash text;
  totalcount bigint;
  expectedcount bigint;
  expectedsplits integer;
begin
  if p_settlement is null or p_settlement=''
  then raise exception 'FINANCE_SETTLEMENT_FACT_RESOURCE_INVALID'; end if;
  if current_setting('app.workload',true) is distinct from 'jobs'
  then raise exception 'FINANCE_SETTLEMENT_JOB_WRITE_REQUIRED'; end if;

  select settlement.* into target
  from finance.settlement settlement
  join finance.reconciliation reconciliation
    on reconciliation.id=settlement.reconciliation_id
    and reconciliation.scope_id=settlement.scope_id
    and reconciliation.partner_id=settlement.partner_id
  where settlement.id=p_settlement and settlement.state='draft'
    and reconciliation.state='approved' and reconciliation.difference_minor=0
  for update of settlement,reconciliation;
  if target.id is null then raise exception 'FINANCE_SETTLEMENT_FACT_SOURCE_STALE'; end if;
  if current_setting('app.scope_id',true) is distinct from target.scope_id
  then raise exception 'FINANCE_SETTLEMENT_JOB_SCOPE_INVALID'; end if;

  select * into policyrow from finance.policy
  where scope_id=target.scope_id and kind='settlement' and state='active' for share;
  if policyrow.id is null then
    rulevalue:='{"basisPoints":0,"invoiceBasis":"gross"}'::jsonb;
    ruleid:='finance.policy.default.settlement';
    ruleversion:=1;
    rulehash:=encode(public.digest(
      'finance.policy.default.settlement:1:{"basisPoints":0,"invoiceBasis":"gross"}',
      'sha256'),'hex');
  else
    rulevalue:=policyrow.rule;
    ruleid:=policyrow.id;
    ruleversion:=policyrow.version;
    rulehash:=encode(public.digest(
      policyrow.id||':'||policyrow.version||':'||policyrow.rule::text,'sha256'),'hex');
  end if;
  basispoints:=coalesce((rulevalue->>'basisPoints')::integer,0);
  invoicebasis:=coalesce(rulevalue->>'invoiceBasis','gross');
  if basispoints not between 0 and 5000 or invoicebasis not in('gross','net')
  then raise exception 'FINANCE_SETTLEMENT_RULE_INVALID'; end if;

  select count(*)::bigint,
    coalesce(sum(case item.kind when 'refund' then -item.internal_minor else item.internal_minor end),0),
    encode(public.digest(coalesce(string_agg(item.id||':'||item.kind||':'||coalesce(item.internal_type,'')||':'||
      coalesce(item.internal_id,'')||':'||item.internal_minor||':'||item.state,',' order by item.id),''),'sha256'),'hex')
  into payablecount,payablegross,payablehash
  from finance.reconciliationitem item
  where item.reconciliation_id=target.reconciliation_id and item.state='matched'
    and item.reason_code is null
    and item.evidence->>'journalReferenceType' in('payment.succeeded','payment.refunded')
    and coalesce((item.evidence->>'settlementEligible')::boolean,false);
  select count(*)::bigint,
    encode(public.digest(coalesce(string_agg(item.id||':'||item.kind||':'||coalesce(item.internal_type,'')||':'||
      coalesce(item.internal_id,'')||':'||item.internal_minor||':'||item.state,',' order by item.id),''),'sha256'),'hex')
  into excludedcount,excludedhash
  from finance.reconciliationitem item
  where item.reconciliation_id=target.reconciliation_id and item.state='matched'
    and item.reason_code is null
    and item.evidence->>'journalReferenceType' in('payment.late.detected','payment.late.refunded')
    and not coalesce((item.evidence->>'settlementEligible')::boolean,false);
  select count(*)::bigint into totalcount from finance.reconciliationitem
  where reconciliation_id=target.reconciliation_id;

  if payablecount=0 or payablegross<=0 or payablegross>9007199254740991
    or totalcount<>payablecount+excludedcount
    or target.gross_minor is distinct from payablegross::bigint
    or target.fee_minor is distinct from
      floor(payablegross*basispoints::numeric/10000)::bigint
    or target.amount_minor is distinct from target.gross_minor-target.fee_minor
    or target.invoice_basis is distinct from invoicebasis
    or target.evidence->>'reconciliation' is distinct from target.reconciliation_id
    or (target.evidence#>>'{payableBasis,itemCount}')::bigint is distinct from payablecount
    or target.evidence#>>'{payableBasis,itemHash}' is distinct from payablehash
    or (target.evidence#>>'{payableBasis,grossMinor}')::numeric is distinct from payablegross
    or (target.evidence#>>'{excludedLateBasis,itemCount}')::bigint is distinct from excludedcount
    or target.evidence#>>'{excludedLateBasis,itemHash}' is distinct from excludedhash
    or target.evidence#>>'{settlementRule,id}' is distinct from ruleid
    or (target.evidence#>>'{settlementRule,version}')::bigint is distinct from ruleversion
    or target.evidence#>>'{settlementRule,hash}' is distinct from rulehash
    or target.evidence#>'{settlementRule,rule}' is distinct from rulevalue
    or (target.evidence#>>'{calculation,grossMinor}')::bigint is distinct from target.gross_minor
    or (target.evidence#>>'{calculation,feeMinor}')::bigint is distinct from target.fee_minor
    or (target.evidence#>>'{calculation,netMinor}')::bigint is distinct from target.amount_minor
    or (target.evidence#>>'{calculation,basisPoints}')::integer is distinct from basispoints
    or target.evidence#>>'{calculation,invoiceBasis}' is distinct from invoicebasis
  then raise exception 'FINANCE_SETTLEMENT_FACT_SOURCE_STALE'; end if;
  invoicetarget:=case invoicebasis when 'net' then target.amount_minor else target.gross_minor end;

  with source as(
    select item.id item_id,item.evidence->>'journalReferenceType' source_type,
      coalesce(item.internal_id,line.external_reference) source_id,item.internal_minor amount_minor,
      line.tax_minor,case item.kind when 'refund' then 'decrease' else 'increase' end direction
    from finance.reconciliationitem item
    join finance.statementline line on line.id=item.statement_line_id and line.kind=item.kind
    where item.reconciliation_id=target.reconciliation_id and item.state='matched'
      and item.reason_code is null and item.internal_minor>0
      and item.evidence->>'journalReferenceType' in('payment.succeeded','payment.refunded')
      and coalesce((item.evidence->>'settlementEligible')::boolean,false)
  ), positive as(
    select source.*,row_number() over(order by item_id) sequence,count(*) over() positive_count,
      floor(amount_minor::numeric*invoicetarget/sum(amount_minor) over()) base_invoice
    from source where direction='increase'
  ), allocated as(
    select positive.*,case when sequence=positive_count then invoicetarget-coalesce(sum(base_invoice) over(
      order by item_id rows between unbounded preceding and 1 preceding),0) else base_invoice end invoice_minor
    from positive
  )
  insert into finance.settlementline(
    id,settlement_id,reconciliation_item_id,scope_id,source_type,source_id,
    amount_minor,invoice_minor,tax_minor,direction,state,created_at
  )
  select 'settlementline:'||source.item_id,target.id,source.item_id,target.scope_id,
    source.source_type,source.source_id,source.amount_minor,
    coalesce(allocated.invoice_minor,0)::bigint,source.tax_minor,source.direction,'frozen',clock_timestamp()
  from source left join allocated on allocated.item_id=source.item_id
  on conflict(id) do nothing;

  with source as(
    select item.id item_id,item.evidence->>'journalReferenceType' source_type,
      coalesce(item.internal_id,line.external_reference) source_id,item.internal_minor amount_minor,
      line.tax_minor,case item.kind when 'refund' then 'decrease' else 'increase' end direction
    from finance.reconciliationitem item
    join finance.statementline line on line.id=item.statement_line_id and line.kind=item.kind
    where item.reconciliation_id=target.reconciliation_id and item.state='matched'
      and item.reason_code is null and item.internal_minor>0
      and item.evidence->>'journalReferenceType' in('payment.succeeded','payment.refunded')
      and coalesce((item.evidence->>'settlementEligible')::boolean,false)
  ), positive as(
    select source.*,row_number() over(order by item_id) sequence,count(*) over() positive_count,
      floor(amount_minor::numeric*invoicetarget/sum(amount_minor) over()) base_invoice
    from source where direction='increase'
  ), allocated as(
    select positive.*,case when sequence=positive_count then invoicetarget-coalesce(sum(base_invoice) over(
      order by item_id rows between unbounded preceding and 1 preceding),0) else base_invoice end invoice_minor
    from positive
  ), expected as(
    select 'settlementline:'||source.item_id id,source.item_id reconciliation_item_id,
      source.source_type,source.source_id,source.amount_minor,
      coalesce(allocated.invoice_minor,0)::bigint invoice_minor,source.tax_minor,source.direction
    from source left join allocated on allocated.item_id=source.item_id
  ), actual as(
    select id,reconciliation_item_id,source_type,source_id,amount_minor,invoice_minor,tax_minor,direction
    from finance.settlementline where settlement_id=target.id and adjustment_of is null
      and scope_id=target.scope_id and state='frozen'
  )
  select count(*)::bigint into expectedcount from expected;
  if expectedcount<>payablecount or exists(
    with source as(
      select item.id item_id,item.evidence->>'journalReferenceType' source_type,
        coalesce(item.internal_id,line.external_reference) source_id,item.internal_minor amount_minor,
        line.tax_minor,case item.kind when 'refund' then 'decrease' else 'increase' end direction
      from finance.reconciliationitem item
      join finance.statementline line on line.id=item.statement_line_id and line.kind=item.kind
      where item.reconciliation_id=target.reconciliation_id and item.state='matched'
        and item.reason_code is null and item.internal_minor>0
        and item.evidence->>'journalReferenceType' in('payment.succeeded','payment.refunded')
        and coalesce((item.evidence->>'settlementEligible')::boolean,false)
    ), positive as(
      select source.*,row_number() over(order by item_id) sequence,count(*) over() positive_count,
        floor(amount_minor::numeric*invoicetarget/sum(amount_minor) over()) base_invoice
      from source where direction='increase'
    ), allocated as(
      select positive.*,case when sequence=positive_count then invoicetarget-coalesce(sum(base_invoice) over(
        order by item_id rows between unbounded preceding and 1 preceding),0) else base_invoice end invoice_minor
      from positive
    ), expected as(
      select 'settlementline:'||source.item_id id,source.item_id reconciliation_item_id,
        source.source_type,source.source_id,source.amount_minor,
        coalesce(allocated.invoice_minor,0)::bigint invoice_minor,source.tax_minor,source.direction
      from source left join allocated on allocated.item_id=source.item_id
    ), actual as(
      select id,reconciliation_item_id,source_type,source_id,amount_minor,invoice_minor,tax_minor,direction
      from finance.settlementline where settlement_id=target.id and adjustment_of is null
        and scope_id=target.scope_id and state='frozen'
    )
    select 1 from expected full join actual using(id)
    where expected.id is null or actual.id is null
      or (expected.reconciliation_item_id,expected.source_type,expected.source_id,expected.amount_minor,
          expected.invoice_minor,expected.tax_minor,expected.direction)
        is distinct from
         (actual.reconciliation_item_id,actual.source_type,actual.source_id,actual.amount_minor,
          actual.invoice_minor,actual.tax_minor,actual.direction)
  ) then raise exception 'FINANCE_SETTLEMENT_LINE_FACT_MISMATCH'; end if;

  insert into finance.split(
    id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,basis_points,state,created_at
  ) values(
    'split:'||target.id||':partner',target.id,target.scope_id,'partner',target.partner_id,
    target.amount_minor,10000-basispoints,'frozen',clock_timestamp()
  ) on conflict(id) do nothing;
  if target.fee_minor>0 then
    insert into finance.split(
      id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,basis_points,state,created_at
    ) values(
      'split:'||target.id||':platform',target.id,target.scope_id,'platform','platform',
      target.fee_minor,basispoints,'frozen',clock_timestamp()
    ) on conflict(id) do nothing;
  end if;
  expectedsplits:=case when target.fee_minor>0 then 2 else 1 end;
  if (select count(*) from finance.split where settlement_id=target.id)<>expectedsplits
    or not exists(select 1 from finance.split where settlement_id=target.id
      and id='split:'||target.id||':partner' and scope_id=target.scope_id
      and beneficiary_type='partner' and beneficiary_id=target.partner_id
      and amount_minor=target.amount_minor and basis_points=10000-basispoints and state='frozen')
    or (target.fee_minor>0 and not exists(select 1 from finance.split where settlement_id=target.id
      and id='split:'||target.id||':platform' and scope_id=target.scope_id
      and beneficiary_type='platform' and beneficiary_id='platform'
      and amount_minor=target.fee_minor and basis_points=basispoints and state='frozen'))
  then raise exception 'FINANCE_SETTLEMENT_SPLIT_FACT_MISMATCH'; end if;
  return payablecount;
end $function$;

create or replace function finance.apply_settlement_adjustment_facts(p_adjustment text)
returns text language plpgsql volatile security definer
set search_path=finance,pg_temp as $function$
declare
  target record;
  policyrow finance.policy%rowtype;
  rulevalue jsonb;
  basispoints integer;
  invoicebasis text;
  delta bigint;
  priorgross bigint;
  priorfee bigint;
  priornet bigint;
  expectedinvoice bigint;
  existinggross numeric;
  approvedcount bigint;
  affected bigint;
  lineid text:='settlementline:'||p_adjustment;
begin
  if p_adjustment is null or p_adjustment=''
  then raise exception 'FINANCE_SETTLEMENT_ADJUSTMENT_RESOURCE_INVALID'; end if;
  select adjustment.id adjustment_id,adjustment.settlement_id,adjustment.settlement_line_id,
    adjustment.scope_id,adjustment.direction,adjustment.amount_minor adjustment_minor,
    adjustment.tax_minor adjustment_tax_minor,
    adjustment.requested_by,adjustment.approved_by,settlement.partner_id,settlement.gross_minor,
    settlement.fee_minor,settlement.amount_minor net_minor,settlement.invoice_basis,
    settlement.version settlement_version,settlement.evidence,line.reconciliation_item_id
  into target
  from finance.settlementadjustment adjustment
  join finance.settlement settlement on settlement.id=adjustment.settlement_id
    and settlement.scope_id=adjustment.scope_id
  join finance.settlementline line on line.id=adjustment.settlement_line_id
    and line.settlement_id=settlement.id and line.scope_id=settlement.scope_id
  where adjustment.id=p_adjustment and adjustment.state='approved'
    and adjustment.approved_by is not null and adjustment.approved_by<>adjustment.requested_by
    and settlement.state='draft' and line.adjustment_of is null and line.state='frozen'
  for update of adjustment,settlement,line;
  if target.adjustment_id is null
  then raise exception 'FINANCE_SETTLEMENT_ADJUSTMENT_FACT_STALE'; end if;
  if current_setting('app.workload',true) is distinct from 'api'
    or not access.scope_allowed(target.scope_id)
    or current_setting('app.actor_id',true) is distinct from target.approved_by
    or target.evidence->>'lastAdjustment' is distinct from target.adjustment_id
  then raise exception 'FINANCE_SETTLEMENT_ADJUSTMENT_CONTEXT_INVALID'; end if;

  select * into policyrow from finance.policy
  where scope_id=target.scope_id and kind='settlement' and state='active' for share;
  rulevalue:=case when policyrow.id is null
    then '{"basisPoints":0,"invoiceBasis":"gross"}'::jsonb else policyrow.rule end;
  basispoints:=coalesce((rulevalue->>'basisPoints')::integer,0);
  invoicebasis:=coalesce(rulevalue->>'invoiceBasis','gross');
  if basispoints not between 0 and 5000 or invoicebasis not in('gross','net')
  then raise exception 'FINANCE_SETTLEMENT_RULE_INVALID'; end if;
  delta:=case target.direction when 'increase' then target.adjustment_minor else -target.adjustment_minor end;
  priorgross:=target.gross_minor-delta;
  if priorgross<=0 or target.gross_minor<=0
    or target.fee_minor<>floor(target.gross_minor::numeric*basispoints/10000)::bigint
    or target.net_minor<>target.gross_minor-target.fee_minor
    or target.invoice_basis<>invoicebasis
  then raise exception 'FINANCE_SETTLEMENT_ADJUSTMENT_CALCULATION_STALE'; end if;
  priorfee:=floor(priorgross::numeric*basispoints/10000)::bigint;
  priornet:=priorgross-priorfee;
  expectedinvoice:=case invoicebasis when 'gross' then target.adjustment_minor
    else abs(target.net_minor-priornet) end;

  select coalesce(sum(case direction when 'decrease' then -amount_minor else amount_minor end),0)
  into existinggross from finance.settlementline
  where settlement_id=target.settlement_id and id<>lineid;
  select count(*)::bigint into approvedcount from finance.settlementadjustment
  where settlement_id=target.settlement_id and state='approved';
  if existinggross is distinct from priorgross::numeric
    or approvedcount is distinct from target.settlement_version
  then raise exception 'FINANCE_SETTLEMENT_ADJUSTMENT_SOURCE_STALE'; end if;

  insert into finance.settlementline(
    id,settlement_id,reconciliation_item_id,scope_id,source_type,source_id,
    amount_minor,invoice_minor,tax_minor,direction,state,adjustment_of,created_at
  ) values(
    lineid,target.settlement_id,target.reconciliation_item_id,target.scope_id,'adjustment',
    target.adjustment_id,target.adjustment_minor,expectedinvoice,target.adjustment_tax_minor,target.direction,
    'frozen',target.settlement_line_id,clock_timestamp()
  ) on conflict(id) do nothing;
  if not exists(select 1 from finance.settlementline where id=lineid
    and settlement_id=target.settlement_id and reconciliation_item_id=target.reconciliation_item_id
    and scope_id=target.scope_id and source_type='adjustment' and source_id=target.adjustment_id
    and amount_minor=target.adjustment_minor and invoice_minor=expectedinvoice
    and tax_minor=target.adjustment_tax_minor and direction=target.direction and state='frozen'
    and adjustment_of=target.settlement_line_id)
  then raise exception 'FINANCE_SETTLEMENT_ADJUSTMENT_LINE_MISMATCH'; end if;

  update finance.split set amount_minor=target.net_minor,basis_points=10000-basispoints
  where settlement_id=target.settlement_id and scope_id=target.scope_id
    and beneficiary_type='partner' and beneficiary_id=target.partner_id and state='frozen';
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'FINANCE_SETTLEMENT_ADJUSTMENT_SPLIT_MISMATCH'; end if;
  insert into finance.split(
    id,settlement_id,scope_id,beneficiary_type,beneficiary_id,amount_minor,basis_points,state,created_at
  ) values(
    'split:'||target.settlement_id||':platform',target.settlement_id,target.scope_id,
    'platform','platform',target.fee_minor,basispoints,'frozen',clock_timestamp()
  ) on conflict(settlement_id,beneficiary_type,beneficiary_id)
  do update set amount_minor=excluded.amount_minor,basis_points=excluded.basis_points
    where finance.split.state='frozen';
  if (select count(*) from finance.split where settlement_id=target.settlement_id)<>2
    or not exists(select 1 from finance.split where settlement_id=target.settlement_id
      and beneficiary_type='partner' and beneficiary_id=target.partner_id
      and amount_minor=target.net_minor and basis_points=10000-basispoints and state='frozen')
    or not exists(select 1 from finance.split where settlement_id=target.settlement_id
      and beneficiary_type='platform' and beneficiary_id='platform'
      and amount_minor=target.fee_minor and basis_points=basispoints and state='frozen')
  then raise exception 'FINANCE_SETTLEMENT_ADJUSTMENT_SPLIT_MISMATCH'; end if;
  return lineid;
end $function$;

create or replace function finance.mark_platform_settlement_split_paid(p_settlement text)
returns boolean language plpgsql volatile security definer
set search_path=finance,pg_temp as $function$
declare target finance.settlement%rowtype; platformcount bigint;
begin
  select * into target from finance.settlement where id=p_settlement and state='payable' for update;
  if target.id is null then raise exception 'FINANCE_SETTLEMENT_PLATFORM_SPLIT_STALE'; end if;
  if current_setting('app.workload',true) is distinct from 'api'
    or not access.scope_allowed(target.scope_id)
    or current_setting('app.actor_id',true) is distinct from target.approved_by
  then raise exception 'FINANCE_SETTLEMENT_PLATFORM_SPLIT_CONTEXT_INVALID'; end if;
  select count(*) into platformcount from finance.split
  where settlement_id=target.id and beneficiary_type='platform';
  if platformcount>1 or (target.fee_minor>0 and platformcount<>1)
    or exists(select 1 from finance.split where settlement_id=target.id and beneficiary_type='platform'
      and (scope_id<>target.scope_id or beneficiary_id<>'platform' or amount_minor<>target.fee_minor))
  then raise exception 'FINANCE_SETTLEMENT_PLATFORM_SPLIT_STALE'; end if;
  update finance.split set state='paid' where settlement_id=target.id
    and beneficiary_type='platform' and state='frozen';
  return true;
end $function$;

create or replace function finance.mark_partner_settlement_split_paid(p_settlement text)
returns boolean language plpgsql volatile security definer
set search_path=finance,pg_temp as $function$
declare target finance.settlement%rowtype; paidminor numeric; affected bigint;
begin
  select * into target from finance.settlement where id=p_settlement for update;
  if target.id is null then raise exception 'FINANCE_SETTLEMENT_PARTNER_SPLIT_STALE'; end if;
  if current_setting('app.workload',true) is distinct from 'jobs'
    or current_setting('app.scope_id',true) is distinct from target.scope_id
  then raise exception 'FINANCE_SETTLEMENT_PARTNER_SPLIT_CONTEXT_INVALID'; end if;
  if target.state<>'paid' then return false; end if;
  select coalesce(sum(amount_minor),0) into paidminor from finance.withdrawal
  where settlement_id=target.id and state='paid';
  if paidminor is distinct from target.amount_minor::numeric
    or not exists(select 1 from finance.split where settlement_id=target.id
      and scope_id=target.scope_id and beneficiary_type='partner'
      and beneficiary_id=target.partner_id and amount_minor=target.amount_minor
      and state in('frozen','paid'))
  then raise exception 'FINANCE_SETTLEMENT_PARTNER_SPLIT_STALE'; end if;
  update finance.split set state='paid' where settlement_id=target.id
    and beneficiary_type='partner' and beneficiary_id=target.partner_id and state='frozen';
  get diagnostics affected=row_count;
  if affected=0 and not exists(select 1 from finance.split where settlement_id=target.id
    and beneficiary_type='partner' and beneficiary_id=target.partner_id and state='paid')
  then raise exception 'FINANCE_SETTLEMENT_PARTNER_SPLIT_STALE'; end if;
  return true;
end $function$;

-- A posted journal must be balanced even if a privileged maintenance path
-- bypasses finance.post. Deferred checks allow journal then entries in one tx.
create or replace function finance.assert_posted_journal_balanced()
returns trigger language plpgsql set search_path=finance,pg_temp as $function$
declare
  target text;
  statevalue text;
  entrycount bigint;
  balance numeric;
begin
  if tg_table_name='journal' then target:=new.id;
  else target:=new.journal_id;
  end if;
  select state into statevalue from finance.journal where id=target;
  if statevalue='posted' then
    select count(*),coalesce(sum(case side when 'debit' then amount_minor else -amount_minor end),0)
    into entrycount,balance from finance.entry where journal_id=target;
    if entrycount<2 or balance<>0 then raise exception 'FINANCE_JOURNAL_UNBALANCED'; end if;
  end if;
  return new;
end $function$;
create constraint trigger finance_journal_posted_balance
after insert on finance.journal deferrable initially deferred
for each row execute function finance.assert_posted_journal_balanced();
create constraint trigger finance_entry_posted_balance
after insert on finance.entry deferrable initially deferred
for each row execute function finance.assert_posted_journal_balanced();

create or replace function finance.reject_final_statement_mutation()
returns trigger language plpgsql set search_path=finance,pg_temp as $function$
declare target_state text;
begin
  if tg_table_name='statement' then
    if old.state in('final','replaced') then raise exception 'FINANCE_STATEMENT_IMMUTABLE'; end if;
  else
    select state into target_state from finance.statement
      where id=coalesce(old.statement_id,new.statement_id);
    if target_state in('final','replaced') then raise exception 'FINANCE_STATEMENT_IMMUTABLE'; end if;
  end if;
  return coalesce(new,old);
end $function$;
create trigger finance_statement_immutable
before update or delete on finance.statement
for each row execute function finance.reject_final_statement_mutation();
create trigger finance_statementaccount_final_immutable
before insert or update or delete on finance.statementaccount
for each row execute function finance.reject_final_statement_mutation();
create trigger finance_accountingeventrule_immutable
before update or delete on finance.accountingeventrule
for each row execute function finance.reject_ledger_mutation();
create trigger finance_subledgerentry_immutable
before update or delete on finance.subledgerentry
for each row execute function finance.reject_ledger_mutation();

-- Rebuild authoritative trial balances without changing any historical journal.
do $backfill$
declare target record; statementid text;
begin
  for target in
    select distinct journal.scope_id,journal.currency,
      to_char(journal.posted_at at time zone ledger.legal_timezone,'YYYY-MM') period
    from finance.journal journal
    join finance.ledger ledger on ledger.id=finance.ledger_id(journal.scope_id,journal.currency)
    where journal.state='posted' and journal.posted_at is not null
    union
    select distinct statement.scope_id,statement.currency,
      to_char(statement.period_start,'YYYY-MM') period
    from finance.statement statement where statement.calculation_version=1
  loop
    statementid:=finance.refresh_trial_balance(
      target.scope_id,target.currency,target.period,true
    );
    if exists(select 1 from finance.period where scope_id=target.scope_id
      and period=target.period and state='closed')
    then
      update finance.statement set state='final',generated_at=clock_timestamp()
      where id=statementid and state='draft' and balanced;
    end if;
  end loop;
end $backfill$;

alter table finance.ledger enable row level security;
alter table finance.accountingeventrule enable row level security;
alter table finance.statementaccount enable row level security;
alter table finance.subledger enable row level security;
alter table finance.subledgerentry enable row level security;
create policy appscope on finance.ledger for select to shopapp
  using(access.scope_allowed(scope_id));
create policy jobscope on finance.ledger for select to shopjob using(true);
create policy appread on finance.accountingeventrule for select to shopapp using(true);
create policy jobread on finance.accountingeventrule for select to shopjob using(true);
create policy appscope on finance.statementaccount for select to shopapp
  using(access.scope_allowed(scope_id));
create policy jobscope on finance.statementaccount for select to shopjob using(true);
create policy appscope on finance.subledger for select to shopapp
  using(access.scope_allowed(scope_id));
create policy jobscope on finance.subledger for select to shopjob using(true);
create policy appscope on finance.subledgerentry for select to shopapp
  using(access.scope_allowed(scope_id));
create policy jobscope on finance.subledgerentry for select to shopjob using(true);

revoke all on table finance.ledger,finance.accountingeventrule,finance.statementaccount,
  finance.subledger,finance.subledgerentry from public,anon,authenticated,service_role,shopapp,shopjob;
grant select on table finance.ledger,finance.accountingeventrule,finance.statementaccount,
  finance.subledger,finance.subledgerentry to shopapp,shopjob;
revoke insert,update,delete on table finance.settlementline,finance.split from shopapp,shopjob;
revoke all on function
  finance.ledger_id(text,text),
  finance.ensure_account(text,text,text,text),
  finance.account_role(text,text),
  finance.classify_subledger(text),
  finance.capture_subledger(text),
  finance.trial_balance_hash(text,text,text),
  finance.refresh_trial_balance(text,text,text,boolean),
  finance.subledger_consistent(text,text,text),
  finance.period_control(text,text,text,timestamp with time zone),
  finance.post(text,text,text,text,text,text,text,text,text,bigint,timestamp with time zone),
  finance.reverse(text,text,text,text,text,timestamp with time zone),
  finance.correct(text,text,text,text,text,text,text,text,text,bigint,timestamp with time zone),
  finance.freeze_settlement_facts(text),
  finance.apply_settlement_adjustment_facts(text),
  finance.mark_platform_settlement_split_paid(text),
  finance.mark_partner_settlement_split_paid(text),
  finance.assert_posted_journal_balanced(),
  finance.reject_final_statement_mutation()
from public,anon,authenticated,service_role,shopapp,shopjob;
grant execute on function
  finance.ledger_id(text,text),
  finance.ensure_account(text,text,text,text),
  finance.account_role(text,text),
  finance.trial_balance_hash(text,text,text),
  finance.refresh_trial_balance(text,text,text,boolean),
  finance.subledger_consistent(text,text,text),
  finance.period_control(text,text,text,timestamp with time zone),
  finance.post(text,text,text,text,text,text,text,text,text,bigint,timestamp with time zone),
  finance.reverse(text,text,text,text,text,timestamp with time zone)
to shopapp,shopjob;
grant execute on function finance.freeze_settlement_facts(text),
  finance.mark_partner_settlement_split_paid(text) to shopjob;
grant execute on function finance.apply_settlement_adjustment_facts(text),
  finance.mark_platform_settlement_split_paid(text) to shopapp;

create index finance_account_ledger_code on finance.account(ledger_id,code,id);
create index finance_statementaccount_account on finance.statementaccount(account_id,statement_id);
create index finance_subledger_scope_kind on finance.subledger(scope_id,kind,subject_id);
create index finance_subledgerentry_period on finance.subledgerentry(scope_id,occurred_at,journal_id);

insert into runtime.schemaversion(version,checksum)
values('20260828093000','44cff09763297fbc11f2f569d976c160314395f1ea30f0f0ec03f94cd50ef88f');

do $assert$
begin
  if to_regclass('finance.statementaccount') is null
    or to_regclass('finance.subledgerentry') is null
    or to_regprocedure('finance.refresh_trial_balance(text,text,text,boolean)') is null
    or to_regprocedure('finance.reverse(text,text,text,text,text,timestamp with time zone)') is null
    or to_regprocedure('finance.correct(text,text,text,text,text,text,text,text,text,bigint,timestamp with time zone)') is null
    or to_regprocedure('finance.freeze_settlement_facts(text)') is null
    or to_regprocedure('finance.apply_settlement_adjustment_facts(text)') is null
    or to_regprocedure('finance.mark_platform_settlement_split_paid(text)') is null
    or to_regprocedure('finance.mark_partner_settlement_split_paid(text)') is null
  then raise exception 'FINANCE_ACCOUNTING_INTEGRITY_OBJECT_MISSING'; end if;
  if has_function_privilege('shopapp',
      'finance.correct(text,text,text,text,text,text,text,text,text,bigint,timestamp with time zone)','EXECUTE')
    or has_function_privilege('shopjob',
      'finance.correct(text,text,text,text,text,text,text,text,text,bigint,timestamp with time zone)','EXECUTE')
  then raise exception 'FINANCE_CORRECTION_BYPASSES_REVIEW'; end if;
  if has_table_privilege('shopapp','finance.settlementline','INSERT,UPDATE,DELETE')
    or has_table_privilege('shopjob','finance.settlementline','INSERT,UPDATE,DELETE')
    or has_table_privilege('shopapp','finance.split','INSERT,UPDATE,DELETE')
    or has_table_privilege('shopjob','finance.split','INSERT,UPDATE,DELETE')
    or not has_function_privilege('shopjob','finance.freeze_settlement_facts(text)','EXECUTE')
    or has_function_privilege('shopapp','finance.freeze_settlement_facts(text)','EXECUTE')
    or not has_function_privilege('shopapp','finance.apply_settlement_adjustment_facts(text)','EXECUTE')
    or has_function_privilege('shopjob','finance.apply_settlement_adjustment_facts(text)','EXECUTE')
    or not has_function_privilege('shopapp','finance.mark_platform_settlement_split_paid(text)','EXECUTE')
    or has_function_privilege('shopjob','finance.mark_platform_settlement_split_paid(text)','EXECUTE')
    or not has_function_privilege('shopjob','finance.mark_partner_settlement_split_paid(text)','EXECUTE')
    or has_function_privilege('shopapp','finance.mark_partner_settlement_split_paid(text)','EXECUTE')
  then raise exception 'FINANCE_SETTLEMENT_FACT_WRITE_BOUNDARY_INVALID'; end if;
  if not exists(
    select 1 from pg_catalog.pg_trigger trigger
    where trigger.tgrelid='finance.journal'::regclass
      and trigger.tgname='finance_journal_immutable'
      and not trigger.tgisinternal and trigger.tgenabled='O'
  ) then raise exception 'FINANCE_JOURNAL_IMMUTABILITY_TRIGGER_DISABLED'; end if;
  if exists(select journal_id from finance.entry group by journal_id
    having sum(case when side='debit' then amount_minor else -amount_minor end)<>0)
  then raise exception 'FINANCE_LEDGER_UNBALANCED'; end if;
  if exists(select 1 from finance.statement
    where calculation_version=2 and (not balanced
      or opening_debit_minor<>opening_credit_minor
      or debit_minor<>credit_minor
      or closing_debit_minor<>closing_credit_minor))
  then raise exception 'FINANCE_TRIAL_BALANCE_INVALID'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260828093000')
  then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
