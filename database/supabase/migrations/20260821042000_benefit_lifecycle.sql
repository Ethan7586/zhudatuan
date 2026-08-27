begin;

create or replace function finance.account_id(p_scope text,p_code text,p_currency text)
returns text language sql immutable strict parallel safe as $function$
  select 'account:'||substr(encode(public.digest(p_scope||':'||p_code||':'||p_currency,'sha256'::text),'hex'),1,40)
$function$;

create or replace function finance.ensure_account(p_scope text,p_code text,p_currency text,p_kind text)
returns text language plpgsql volatile security definer set search_path=finance,pg_temp as $function$
declare accountid text:=finance.account_id(p_scope,p_code,p_currency);
begin
  insert into finance.account(id,scope_id,code,currency,kind,status) values(accountid,p_scope,p_code,p_currency,p_kind,'active')
    on conflict(scope_id,code,currency) do update set status='active'
    where finance.account.kind=excluded.kind;
  if not exists(select 1 from finance.account where id=accountid and scope_id=p_scope and code=p_code and currency=p_currency and kind=p_kind)
    then raise exception 'FINANCE_ACCOUNT_CONTRACT_MISMATCH'; end if;
  return accountid;
end $function$;

alter table finance.journal add column scope_id text;
update finance.journal journal set scope_id=coalesce((select min(account.scope_id) from finance.entry entry
  join finance.account account on account.id=entry.account_id where entry.journal_id=journal.id),'organization-platform-root');
alter table finance.journal alter column scope_id set not null;
alter table finance.journal drop constraint journal_reference_type_reference_id_key;
alter table finance.journal add unique(scope_id,reference_type,reference_id);

create or replace function finance.post(
  p_scope text,p_reference_type text,p_reference_id text,p_currency text,p_description text,
  p_debit_code text,p_debit_kind text,p_credit_code text,p_credit_kind text,p_amount bigint,p_occurred_at timestamptz default clock_timestamp()
) returns text language plpgsql volatile security definer set search_path=finance,pg_temp as $function$
declare debitid text; creditid text; periodid text:=to_char(p_occurred_at at time zone 'UTC','YYYY-MM');
  journalid text:='journal:'||substr(encode(public.digest(p_scope||':'||p_reference_type||':'||p_reference_id,'sha256'::text),'hex'),1,40); inserted text;
begin
  if p_amount<=0 or p_currency!~'^[A-Z]{3}$' or p_reference_type='' or p_reference_id='' then raise exception 'FINANCE_POST_INVALID'; end if;
  if exists(select 1 from finance.period where scope_id=p_scope and period=to_char(p_occurred_at at time zone 'UTC','YYYY-MM') and state='closed')
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
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
    values('event:'||substr(encode(public.digest('finance.entry.posted:'||journalid,'sha256'::text),'hex'),1,40),'finance.entry.posted',1,
      'journal',journalid,p_scope,jsonb_build_object('journal',journalid,'referenceType',p_reference_type,'referenceId',p_reference_id,
        'amountMinor',p_amount,'currency',p_currency,'debit',p_debit_code,'credit',p_credit_code),journalid,p_occurred_at,clock_timestamp())
    on conflict(id) do nothing;
  return journalid;
end $function$;

revoke all on function finance.account_id(text,text,text),finance.ensure_account(text,text,text,text),
  finance.post(text,text,text,text,text,text,text,text,text,bigint,timestamp with time zone) from public;
grant execute on function finance.account_id(text,text,text),finance.ensure_account(text,text,text,text),
  finance.post(text,text,text,text,text,text,text,text,text,bigint,timestamp with time zone) to shopapp,shopjob;

alter table benefit.account add column finance_account_id text;
update benefit.account account set finance_account_id=finance.ensure_account(account.scope_id,'benefit.'||account.id,account.currency,'liability');
alter table benefit.account alter column finance_account_id set not null;
alter table benefit.account add unique(finance_account_id);
alter table benefit.account add foreign key(finance_account_id) references finance.account(id);

create table benefit.planversion(
  plan_id text not null references benefit.plan(id),
  version bigint not null check(version>=0),
  name text not null,
  kind text not null check(kind in('welfare','meal','allowance')),
  currency char(3) not null,
  state text not null check(state in('draft','active','paused','retired')),
  changed_by text not null,
  changed_at timestamptz not null,
  primary key(plan_id,version)
);
insert into benefit.planversion(plan_id,version,name,kind,currency,state,changed_by,changed_at)
select id,version,name,kind,currency,state,'migration',clock_timestamp() from benefit.plan;

alter table benefit.budget add column reserved_minor bigint not null default 0;
update benefit.budget budget set granted_minor=coalesce((select sum(item.amount_minor) from benefit.grantitem item
  join benefit.grantbatch batch on batch.id=item.batch_id where batch.budget_id=budget.id and item.state='granted'),0);
update benefit.budget budget set reserved_minor=coalesce((select sum(item.amount_minor) from benefit.grantitem item
  join benefit.grantbatch batch on batch.id=item.batch_id where batch.budget_id=budget.id and batch.state in('approved','running') and item.state='queued'),0);
alter table benefit.budget add constraint benefit_budget_reserved_check
  check(reserved_minor>=0 and granted_minor>=0 and reserved_minor+granted_minor<=total_minor);

alter table benefit.grantbatch drop constraint grantbatch_state_check;
alter table benefit.grantbatch add constraint grantbatch_state_check
  check(state in('submitted','approved','rejected','scheduled','running','paused','completed','failed','cancelled','revoking','revoked'));
alter table benefit.grantbatch add column plan_version bigint;
alter table benefit.grantbatch add column effective_at timestamptz;
alter table benefit.grantbatch add column expires_at timestamptz;
alter table benefit.grantbatch add column timezone text;
alter table benefit.grantbatch add column snapshot_hash char(64);
alter table benefit.grantbatch add column pause_reason text;
update benefit.grantbatch batch set plan_version=plan.version,effective_at=batch.created_at,
  timezone=coalesce((select timezone from organization.organization where id=plan.scope_id),'Asia/Shanghai'),
  snapshot_hash=(select encode(digest(coalesce(string_agg(item.member_id||':'||item.amount_minor,',' order by item.member_id),''),'sha256'),'hex')
    from benefit.grantitem item where item.batch_id=batch.id)
  from benefit.plan plan where plan.id=batch.plan_id;
alter table benefit.grantbatch alter column plan_version set not null;
alter table benefit.grantbatch alter column effective_at set not null;
alter table benefit.grantbatch alter column timezone set not null;
alter table benefit.grantbatch alter column snapshot_hash set not null;
alter table benefit.grantbatch add foreign key(plan_id,plan_version) references benefit.planversion(plan_id,version);
alter table benefit.grantbatch add check(expires_at is null or expires_at>effective_at);

alter table benefit.grantitem drop constraint grantitem_state_check;
alter table benefit.grantitem add constraint grantitem_state_check
  check(state in('queued','scheduled','granted','failed','skipped','revoking','revoked','expired'));

create table benefit.lot(
  id text primary key,
  account_id text not null references benefit.account(id),
  batch_id text not null references benefit.grantbatch(id),
  member_id text not null,
  total_minor bigint not null check(total_minor>0),
  remaining_minor bigint not null check(remaining_minor>=0 and remaining_minor<=total_minor),
  state text not null check(state in('pending','active','consumed','expired','revoked')),
  effective_at timestamptz not null,
  expires_at timestamptz,
  origin text not null default 'grant' check(origin in('grant','refund')),
  version bigint not null default 0,
  check(expires_at is null or expires_at>effective_at)
);
create unique index benefit_lot_grant on benefit.lot(account_id,batch_id) where origin='grant';
create table benefit.lotmovement(
  id text primary key,
  lot_id text not null references benefit.lot(id),
  kind text not null check(kind in('grant','consume','refund','expire','revoke')),
  amount_minor bigint not null check(amount_minor>0),
  reference_type text not null,
  reference_id text not null,
  source_id text references benefit.lotmovement(id),
  occurred_at timestamptz not null,
  unique(lot_id,kind,reference_type,reference_id)
);
create table benefit.action(
  id text primary key,
  batch_id text not null references benefit.grantbatch(id),
  action text not null check(action in('pause','resume','cancel','revoke')),
  actor_id text not null,
  reason text not null,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  occurred_at timestamptz not null
);
create table benefit.reminder(
  id text primary key,
  lot_id text not null references benefit.lot(id),
  kind text not null check(kind='expiry'),
  scheduled_at timestamptz not null,
  sent_at timestamptz not null,
  unique(lot_id,kind)
);

alter table support.case add column reference_type text check(reference_type in('benefitlot'));
alter table support.case add column reference_id text;
alter table support.case add column reference_evidence jsonb;
alter table support.case add check((reference_type is null and reference_id is null and reference_evidence is null)
  or (reference_type is not null and reference_id is not null and jsonb_typeof(reference_evidence)='object'));

insert into benefit.lot(id,account_id,batch_id,member_id,total_minor,remaining_minor,state,effective_at,expires_at,version)
select 'lot:'||entry.id,entry.account_id,entry.reference_id,account.member_id,entry.amount_minor,entry.amount_minor,'active',entry.occurred_at,null,0
from benefit.entry entry join benefit.account account on account.id=entry.account_id
where entry.kind='grant' and entry.amount_minor>0 and exists(select 1 from benefit.grantbatch where id=entry.reference_id)
on conflict(id) do nothing;
insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
select 'movement:'||lot.id,lot.id,'grant',lot.total_minor,'grantbatch',lot.batch_id,lot.effective_at from benefit.lot lot on conflict do nothing;

do $migrate$ declare legacy record; begin
  for legacy in select entry.*,account.scope_id,account.currency,account.finance_account_id from benefit.entry entry
    join benefit.account account on account.id=entry.account_id order by entry.occurred_at,entry.id
  loop
    if legacy.amount_minor>0 then
      perform finance.post(legacy.scope_id,'benefit.legacy',legacy.id,legacy.currency,'Legacy benefit credit',
        'benefit.expense','expense','benefit.'||legacy.account_id,'liability',legacy.amount_minor,legacy.occurred_at);
    else
      perform finance.post(legacy.scope_id,'benefit.legacy',legacy.id,legacy.currency,'Legacy benefit debit',
        'benefit.'||legacy.account_id,'liability','benefit.clearing','income',-legacy.amount_minor,legacy.occurred_at);
    end if;
  end loop;
end $migrate$;
drop table benefit.entry;

create view benefit.balance with(security_invoker=true) as
select account.id account_id,coalesce(sum(case when entry.side='credit' then entry.amount_minor else -entry.amount_minor end)
  filter(where journal.state='posted'),0)::bigint balance_minor
from benefit.account account left join finance.entry entry on entry.account_id=account.finance_account_id
left join finance.journal journal on journal.id=entry.journal_id group by account.id;
grant select on benefit.balance to shopapp,shopjob;

alter table benefit.planversion enable row level security;
alter table benefit.lot enable row level security;
alter table benefit.lotmovement enable row level security;
alter table benefit.action enable row level security;
alter table benefit.reminder enable row level security;
create policy appscope on benefit.planversion for all to shopapp
  using(exists(select 1 from benefit.plan plan where plan.id=plan_id and access.scope_allowed(plan.scope_id)))
  with check(exists(select 1 from benefit.plan plan where plan.id=plan_id and access.scope_allowed(plan.scope_id)));
create policy jobscope on benefit.planversion for all to shopjob using(true) with check(true);
create policy appscope on benefit.lot for all to shopapp
  using(exists(select 1 from benefit.account account where account.id=account_id and access.scope_allowed(account.scope_id)))
  with check(exists(select 1 from benefit.account account where account.id=account_id and access.scope_allowed(account.scope_id)));
create policy jobscope on benefit.lot for all to shopjob using(true) with check(true);
create policy appscope on benefit.lotmovement for all to shopapp
  using(exists(select 1 from benefit.lot lot join benefit.account account on account.id=lot.account_id where lot.id=lot_id and access.scope_allowed(account.scope_id)))
  with check(exists(select 1 from benefit.lot lot join benefit.account account on account.id=lot.account_id where lot.id=lot_id and access.scope_allowed(account.scope_id)));
create policy jobscope on benefit.lotmovement for all to shopjob using(true) with check(true);
create policy appscope on benefit.action for all to shopapp
  using(exists(select 1 from benefit.grantbatch batch join benefit.plan plan on plan.id=batch.plan_id where batch.id=batch_id and access.scope_allowed(plan.scope_id)))
  with check(exists(select 1 from benefit.grantbatch batch join benefit.plan plan on plan.id=batch.plan_id where batch.id=batch_id and access.scope_allowed(plan.scope_id)));
create policy jobscope on benefit.action for all to shopjob using(true) with check(true);
create policy appscope on benefit.reminder for select to shopapp using(exists(select 1 from benefit.lot lot join benefit.account account
  on account.id=lot.account_id where lot.id=lot_id and access.scope_allowed(account.scope_id)));
create policy jobscope on benefit.reminder for all to shopjob using(true) with check(true);
grant select,insert,update,delete on benefit.planversion,benefit.lot,benefit.lotmovement,benefit.action to shopapp,shopjob;
grant select,insert,update,delete on benefit.reminder to shopapp;
grant select,insert,update,delete on benefit.reminder to shopjob;

create index benefit_plan_scope_read on benefit.plan(scope_id,id);
create index benefit_budget_plan_read on benefit.budget(plan_id,period,id);
create index benefit_batch_plan_read on benefit.grantbatch(plan_id,created_at desc,id desc);
create index benefit_item_work on benefit.grantitem(batch_id,state,member_id);
create index benefit_lot_account_expiry on benefit.lot(account_id,state,effective_at,expires_at,id);
create index benefit_lot_expiry on benefit.lot(state,effective_at,expires_at,id);
create index benefit_movement_reference on benefit.lotmovement(reference_type,reference_id,lot_id);
create index benefit_action_batch on benefit.action(batch_id,occurred_at,id);
create index benefit_reminder_schedule on benefit.reminder(scheduled_at,lot_id);
create index support_case_reference on support.case(reference_type,reference_id) where reference_id is not null;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('benefit.plans.read','benefit','GET','/api/v1/benefits/plans','1.0.0'),
  ('benefit.plans.manage','benefit','PUT','/api/v1/benefits/plans/{planid}','1.0.0'),
  ('benefit.budgets.read','benefit','GET','/api/v1/benefits/budgets','1.0.0'),
  ('benefit.budgets.manage','benefit','PUT','/api/v1/benefits/budgets/{budgetid}','1.0.0'),
  ('benefit.grants.read','benefit','GET','/api/v1/benefits/grants','1.0.0'),
  ('benefit.grants.control','benefit','POST','/api/v1/benefits/grants/{batchid}/control','1.0.0'),
  ('benefit.grants.revoke','benefit','POST','/api/v1/benefits/grants/{batchid}/revoke','1.0.0'),
  ('benefit.lots.read','benefit','GET','/api/v1/benefits/lots','1.0.0');
insert into access.permission(id,code,risk,status) values
  ('permission:44b3ce75dbff95536f69e3c0','benefit.plan.read','low','active'),
  ('permission:c5ffb2f80fe80bdd2ace8b54','benefit.plan.manage','high','active'),
  ('permission:aa227f8a3162ee2b106aba3a','benefit.budget.read','high','active'),
  ('permission:0fb790ceafead5be0611b9e9','benefit.budget.manage','critical','active'),
  ('permission:cf7a744cde70cb9911c1b807','benefit.grant.read','high','active'),
  ('permission:dee85d50cad380025e68de4d','benefit.grant.control','critical','active'),
  ('permission:3857734d7d5ee4916d112aa0','benefit.revoke','critical','active'),
  ('permission:728eeab46485162cfc365719','benefit.lot.read','high','active');
insert into capability.capability(id,kind,name,version,status) values
  ('benefit.plans.read','operation','benefit.plans.read',1,'active'),
  ('benefit.plans.manage','operation','benefit.plans.manage',1,'active'),
  ('benefit.budgets.read','operation','benefit.budgets.read',1,'active'),
  ('benefit.budgets.manage','operation','benefit.budgets.manage',1,'active'),
  ('benefit.grants.read','operation','benefit.grants.read',1,'active'),
  ('benefit.grants.control','operation','benefit.grants.control',1,'active'),
  ('benefit.grants.revoke','operation','benefit.grants.revoke',1,'active'),
  ('benefit.lots.read','operation','benefit.lots.read',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('benefit.plans.read','benefit.plans.read','benefit.plan.read','operator'),
  ('benefit.plans.manage','benefit.plans.manage','benefit.plan.manage','operator'),
  ('benefit.budgets.read','benefit.budgets.read','benefit.budget.read','operator'),
  ('benefit.budgets.manage','benefit.budgets.manage','benefit.budget.manage','operator'),
  ('benefit.grants.read','benefit.grants.read','benefit.grant.read','operator'),
  ('benefit.grants.control','benefit.grants.control','benefit.grant.control','operator'),
  ('benefit.grants.revoke','benefit.grants.revoke','benefit.revoke','operator'),
  ('benefit.lots.read','benefit.lots.read','benefit.lot.read','operator');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,0
from capability.capability capability where capability.id in('benefit.plans.read','benefit.plans.manage','benefit.budgets.read','benefit.budgets.manage',
  'benefit.grants.read','benefit.grants.control','benefit.grants.revoke','benefit.lots.read');

insert into runtime.event(type,version,owner,schema_ref) values
  ('benefit.expired',1,'benefit','contract://events/benefit.expired/v1'),
  ('benefit.expiry.reminded',1,'benefit','contract://events/benefit.expiry.reminded/v1'),
  ('benefit.revoked',1,'benefit','contract://events/benefit.revoked/v1'),
  ('benefit.grant.failed',1,'benefit','contract://events/benefit.grant.failed/v1'),
  ('benefit.revoke.failed',1,'benefit','contract://events/benefit.revoke.failed/v1'),
  ('benefit.expiry.failed',1,'benefit','contract://events/benefit.expiry.failed/v1');

insert into runtime.schemaversion(version,checksum)
values('20260821042000','8d75962d03983744809af6544154c6ba5d8f7f8ace182ebcf50ad6c64ea2d5dd');

do $assert$
begin
  if (select count(*) from runtime.operation)<>172 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if exists(select 1 from information_schema.tables where table_schema='benefit' and table_name='entry')
    then raise exception 'LEGACY_BENEFIT_ENTRY_STILL_PRESENT'; end if;
  if not exists(select 1 from information_schema.views where table_schema='benefit' and table_name='balance')
    then raise exception 'BENEFIT_FINANCE_PROJECTION_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821042000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
