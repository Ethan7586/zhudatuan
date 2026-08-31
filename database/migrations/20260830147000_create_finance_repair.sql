begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830146000') then raise exception 'FINANCE_REPAIR_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260830147000') then raise exception 'FINANCE_REPAIR_ALREADY_APPLIED'; end if;
end $precondition$;

alter table finance.policy add column name text;
alter table finance.policy add column "trigger" text;
alter table finance.policy add column entries jsonb;
alter table finance.policy add column effective_at timestamptz;
alter table finance.policy add column expires_at timestamptz;
alter table finance.policy add column updated_at timestamptz;
update finance.policy set name=kind,"trigger"=kind,entries='[]'::jsonb,effective_at=clock_timestamp(),updated_at=clock_timestamp()
where name is null;
alter table finance.policy alter column name set not null;
alter table finance.policy alter column "trigger" set not null;
alter table finance.policy alter column entries set not null;
alter table finance.policy alter column effective_at set not null;
alter table finance.policy alter column updated_at set not null;
alter table finance.policy add constraint finance_policy_entries_array check(jsonb_typeof(entries)='array') not valid;
alter table finance.policy add constraint finance_policy_period check(expires_at is null or expires_at>effective_at) not valid;
alter table finance.policy validate constraint finance_policy_entries_array;
alter table finance.policy validate constraint finance_policy_period;

alter table finance.statement add column version bigint not null default 1 check(version>0);
alter table invoice.profile add column title_masked text;
alter table invoice.profile add column taxid_masked text;
update invoice.profile set title_masked='***',taxid_masked='***************' where title_masked is null or taxid_masked is null;
alter table invoice.profile alter column title_masked set not null;
alter table invoice.profile alter column taxid_masked set not null;

create table finance.repairpreview(
  token_hash char(64) primary key check(token_hash~'^[0-9a-f]{64}$'),
  scope_id text not null,
  statement_id text not null,
  source_hash char(64) not null check(source_hash~'^[0-9a-f]{64}$'),
  source_version bigint not null check(source_version>0),
  preview_hash char(64) not null check(preview_hash~'^[0-9a-f]{64}$'),
  entries jsonb not null check(jsonb_typeof(entries)='array'),
  differences jsonb not null check(jsonb_typeof(differences)='array'),
  maker_id text not null,
  reason text not null check(length(reason) between 1 and 1000),
  expires_at timestamptz not null,
  created_at timestamptz not null,
  unique(scope_id,statement_id,preview_hash,maker_id)
);

create table finance.repair(
  id text primary key,
  scope_id text not null,
  statement_id text not null,
  status text not null check(status in('draft','submitted','approved','rejected','reversed')),
  source_hash char(64) not null check(source_hash~'^[0-9a-f]{64}$'),
  source_version bigint not null check(source_version>0),
  preview_hash char(64) not null check(preview_hash~'^[0-9a-f]{64}$'),
  differences jsonb not null check(jsonb_typeof(differences)='array'),
  entries jsonb not null check(jsonb_typeof(entries)='array'),
  maker_id text not null,
  checker_id text,
  reason text not null check(length(reason) between 1 and 1000),
  original_journal_id text,
  reversal_journal_id text,
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,statement_id,preview_hash),
  check(checker_id is null or checker_id<>maker_id),
  check((status in('draft','submitted') and checker_id is null and original_journal_id is null and reversal_journal_id is null)
    or (status='rejected' and checker_id is not null and original_journal_id is null and reversal_journal_id is null)
    or (status='approved' and checker_id is not null and original_journal_id is not null and reversal_journal_id is null)
    or (status='reversed' and checker_id is not null and original_journal_id is not null and reversal_journal_id is not null))
);

create table finance.repairmovement(
  id text primary key,
  movement_key text not null unique,
  repair_id text not null references finance.repair(id),
  scope_id text not null,
  previous_status text not null,
  next_status text not null,
  actor_id text not null,
  reason text not null check(length(reason) between 1 and 1000),
  journal_id text,
  created_at timestamptz not null
);

create or replace function finance.reject_repairmovement_mutation() returns trigger language plpgsql
set search_path=finance,pg_temp as $function$
begin raise exception 'FINANCE_REPAIR_MOVEMENT_APPEND_ONLY'; end $function$;
create trigger finance_repairmovement_immutable before update or delete on finance.repairmovement
for each row execute function finance.reject_repairmovement_mutation();

create or replace function finance.approve_repair(p_repair text,p_scope text,p_checker text,p_expected bigint,p_reason text)
returns text language plpgsql volatile security definer set search_path=finance,public,pg_temp as $function$
declare target finance.repair%rowtype; item jsonb; accountid text; debit bigint:=0; credit bigint:=0;
  journalid text; entryindex integer:=0; amount bigint; side text; currencycode text;
begin
  if session_user='shopapp' and not access.scope_allowed(p_scope) then raise exception 'AUTHORIZATION_DENIED'; end if;
  select * into target from finance.repair where id=p_repair and scope_id=p_scope and status='submitted'
    and maker_id<>p_checker and version=p_expected for update;
  if not found then raise exception 'FINANCE_REPAIR_CONFLICT'; end if;
  if jsonb_array_length(target.entries)=0 then raise exception 'FINANCE_REPAIR_EMPTY'; end if;
  for item in select value from jsonb_array_elements(target.entries) loop
    if jsonb_typeof(item)<>'object' or coalesce(item->>'account','')='' or coalesce(item->>'currency','')!~'^[A-Z]{3}$'
      or coalesce((item->>'debitMinor')::bigint,0)<0 or coalesce((item->>'creditMinor')::bigint,0)<0
      or (coalesce((item->>'debitMinor')::bigint,0)=0)=(coalesce((item->>'creditMinor')::bigint,0)=0) then
      raise exception 'FINANCE_REPAIR_ENTRY_INVALID';
    end if;
    debit:=debit+coalesce((item->>'debitMinor')::bigint,0);
    credit:=credit+coalesce((item->>'creditMinor')::bigint,0);
  end loop;
  if debit=0 or debit<>credit then raise exception 'FINANCE_JOURNAL_UNBALANCED'; end if;
  currencycode:=target.entries->0->>'currency';
  if exists(select 1 from jsonb_array_elements(target.entries) value where value->>'currency'<>currencycode) then
    raise exception 'FINANCE_REPAIR_CURRENCY_MISMATCH';
  end if;
  if exists(select 1 from finance.period where scope_id=p_scope and period=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM') and state='closed') then
    raise exception 'FINANCE_PERIOD_CLOSED';
  end if;
  journalid:='journal:'||substr(encode(public.digest(p_scope||':financerepair:'||p_repair,'sha256'),'hex'),1,40);
  insert into finance.journal(id,scope_id,reference_type,reference_id,currency,period,state,description,posted_at,version)
  values(journalid,p_scope,'financerepair',p_repair,currencycode,to_char(clock_timestamp() at time zone 'UTC','YYYY-MM'),
    'posted',p_reason,clock_timestamp(),0);
  for item in select value from jsonb_array_elements(target.entries) loop
    entryindex:=entryindex+1;
    select id into accountid from finance.account where scope_id=p_scope and code=item->>'account'
      and currency=item->>'currency' and status='active';
    if accountid is null then raise exception 'FINANCE_REPAIR_ACCOUNT_NOT_FOUND'; end if;
    if (item->>'debitMinor')::bigint>0 then amount:=(item->>'debitMinor')::bigint; side:='debit';
    else amount:=(item->>'creditMinor')::bigint; side:='credit'; end if;
    insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at)
    values('entry:'||substr(encode(public.digest(journalid||':'||entryindex::text,'sha256'),'hex'),1,40),journalid,accountid,side,amount,clock_timestamp());
  end loop;
  update finance.repair set status='approved',checker_id=p_checker,reason=p_reason,original_journal_id=journalid,
    version=version+1,updated_at=clock_timestamp() where id=p_repair;
  insert into finance.repairmovement(id,movement_key,repair_id,scope_id,previous_status,next_status,actor_id,reason,journal_id,created_at)
  values('repairmovement:'||substr(encode(public.digest(p_repair||':approved:'||(p_expected+1)::text,'sha256'),'hex'),1,40),
    'repair:'||p_repair||':approved:'||(p_expected+1)::text,p_repair,p_scope,'submitted','approved',p_checker,p_reason,journalid,clock_timestamp());
  return journalid;
end $function$;

create or replace function finance.reverse_repair(p_repair text,p_scope text,p_checker text,p_expected bigint,p_reason text)
returns text language plpgsql volatile security definer set search_path=finance,public,pg_temp as $function$
declare target finance.repair%rowtype; original finance.journal%rowtype; sourceentry record;
  journalid text; entryindex integer:=0;
begin
  if session_user='shopapp' and not access.scope_allowed(p_scope) then raise exception 'AUTHORIZATION_DENIED'; end if;
  select * into target from finance.repair where id=p_repair and scope_id=p_scope and status='approved'
    and maker_id<>p_checker and version=p_expected for update;
  if not found then raise exception 'FINANCE_REPAIR_CONFLICT'; end if;
  select * into original from finance.journal where id=target.original_journal_id and scope_id=p_scope and state='posted';
  if not found then raise exception 'FINANCE_REPAIR_JOURNAL_NOT_FOUND'; end if;
  if exists(select 1 from finance.period where scope_id=p_scope and period=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM') and state='closed') then
    raise exception 'FINANCE_PERIOD_CLOSED';
  end if;
  journalid:='journal:'||substr(encode(public.digest(p_scope||':financerepairreverse:'||p_repair,'sha256'),'hex'),1,40);
  insert into finance.journal(id,scope_id,reference_type,reference_id,currency,period,state,description,posted_at,version)
  values(journalid,p_scope,'financerepairreverse',p_repair,original.currency,to_char(clock_timestamp() at time zone 'UTC','YYYY-MM'),
    'posted',p_reason,clock_timestamp(),0);
  for sourceentry in select * from finance.entry where journal_id=original.id order by id loop
    entryindex:=entryindex+1;
    insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at)
    values('entry:'||substr(encode(public.digest(journalid||':'||entryindex::text,'sha256'),'hex'),1,40),journalid,
      sourceentry.account_id,case sourceentry.side when 'debit' then 'credit' else 'debit' end,sourceentry.amount_minor,clock_timestamp());
  end loop;
  update finance.repair set status='reversed',checker_id=p_checker,reason=p_reason,reversal_journal_id=journalid,
    version=version+1,updated_at=clock_timestamp() where id=p_repair;
  insert into finance.repairmovement(id,movement_key,repair_id,scope_id,previous_status,next_status,actor_id,reason,journal_id,created_at)
  values('repairmovement:'||substr(encode(public.digest(p_repair||':reversed:'||(p_expected+1)::text,'sha256'),'hex'),1,40),
    'repair:'||p_repair||':reversed:'||(p_expected+1)::text,p_repair,p_scope,'approved','reversed',p_checker,p_reason,journalid,clock_timestamp());
  return journalid;
end $function$;

revoke all on function finance.approve_repair(text,text,text,bigint,text),finance.reverse_repair(text,text,text,bigint,text) from public;
grant execute on function finance.approve_repair(text,text,text,bigint,text),finance.reverse_repair(text,text,text,bigint,text) to shopapp,shopjob;

alter table finance.repairpreview enable row level security;
alter table finance.repairpreview force row level security;
alter table finance.repair enable row level security;
alter table finance.repair force row level security;
alter table finance.repairmovement enable row level security;
alter table finance.repairmovement force row level security;
create policy appscope on finance.repairpreview for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on finance.repairpreview for all to shopjob using(true) with check(true);
create policy appscope on finance.repair for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on finance.repair for all to shopjob using(true) with check(true);
create policy appscope on finance.repairmovement for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy jobscope on finance.repairmovement for all to shopjob using(true) with check(true);
grant select,insert,update,delete on finance.repairpreview,finance.repair to shopapp,shopjob;
grant select,insert on finance.repairmovement to shopapp,shopjob;

create index finance_policy_scope_page on finance.policy(scope_id,id) include(name,state,"trigger",effective_at,expires_at,version);
create index finance_repair_scope_page on finance.repair(scope_id,id) include(statement_id,status,preview_hash,maker_id,checker_id,version);
create index finance_repair_statement on finance.repair(scope_id,statement_id,id);
create index finance_repairpreview_expiry on finance.repairpreview(expires_at,token_hash);
create index finance_repairmovement_case on finance.repairmovement(scope_id,repair_id,created_at,id);

insert into runtime.schemaversion(version,checksum)
values('20260830147000',encode(public.digest('20260830147000_create_finance_repair','sha256'),'hex'));

commit;
