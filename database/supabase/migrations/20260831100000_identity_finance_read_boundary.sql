begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:identity-finance-read-boundary:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'IDENTITY_FINANCE_READ_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260830105000'
      and checksum='b6ee9a1f1a8591f9efdf4c8c2362b9aa32a16b3ce018321df97669a56e6fcaaf') then
    raise exception 'IDENTITY_FINANCE_READ_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260830105000') then
    raise exception 'IDENTITY_FINANCE_READ_FUTURE_HEAD_INVALID';
  end if;
  if to_regrole('zhudatuanidentityapi') is null
    or array_position(array[
      to_regclass('finance.account'),to_regclass('finance.entry'),to_regclass('finance.journal'),
      to_regclass('finance.statement'),to_regclass('finance.statementaccount'),to_regclass('finance.reconciliation'),
      to_regclass('finance.reconciliationitem'),to_regclass('finance.settlement'),to_regclass('finance.settlementline'),
      to_regclass('finance.split'),to_regclass('finance.settlementadjustment'),to_regclass('finance.withdrawal')
    ],null) is not null then
    raise exception 'IDENTITY_FINANCE_READ_RELATION_MISSING';
  end if;
end
$precondition$;

grant usage on schema finance to zhudatuanidentityapi;
grant select on table
  finance.account,finance.entry,finance.journal,finance.statement,finance.statementaccount,
  finance.reconciliation,finance.reconciliationitem,finance.settlement,finance.settlementline,
  finance.split,finance.settlementadjustment,finance.withdrawal
to zhudatuanidentityapi;

revoke insert,update,delete,truncate,references,trigger on table
  finance.account,finance.entry,finance.journal,finance.statement,finance.statementaccount,
  finance.reconciliation,finance.reconciliationitem,finance.settlement,finance.settlementline,
  finance.split,finance.settlementadjustment,finance.withdrawal
from zhudatuanidentityapi;

create policy identityread on finance.account for select to zhudatuanidentityapi
  using(access.scope_allowed(scope_id));
create policy identityread on finance.entry for select to zhudatuanidentityapi using(exists(
  select 1 from finance.account account where account.id=entry.account_id and access.scope_allowed(account.scope_id)));
create policy identityread on finance.journal for select to zhudatuanidentityapi using(exists(
  select 1 from finance.entry entry join finance.account account on account.id=entry.account_id
  where entry.journal_id=journal.id and access.scope_allowed(account.scope_id)));
create policy identityread on finance.statement for select to zhudatuanidentityapi
  using(access.scope_allowed(scope_id));
create policy identityread on finance.statementaccount for select to zhudatuanidentityapi
  using(access.scope_allowed(scope_id));
create policy identityread on finance.reconciliation for select to zhudatuanidentityapi
  using(access.scope_allowed(scope_id));
create policy identityread on finance.reconciliationitem for select to zhudatuanidentityapi
  using(access.scope_allowed(scope_id));
create policy identityread on finance.settlement for select to zhudatuanidentityapi
  using(access.scope_allowed(scope_id));
create policy identityread on finance.settlementline for select to zhudatuanidentityapi
  using(access.scope_allowed(scope_id));
create policy identityread on finance.split for select to zhudatuanidentityapi
  using(access.scope_allowed(scope_id));
create policy identityread on finance.settlementadjustment for select to zhudatuanidentityapi
  using(access.scope_allowed(scope_id));
create policy identityread on finance.withdrawal for select to zhudatuanidentityapi
  using(access.scope_allowed(scope_id));

insert into runtime.schemaversion(version,checksum)
values('20260831100000','c8e4d4025f5ccd56065db538fb5a64623a1b487e327c3831fa1fc2267b142ff0');

do $assert$
declare relation_name text;
begin
  if not has_schema_privilege('zhudatuanidentityapi','finance','USAGE') then
    raise exception 'IDENTITY_FINANCE_READ_SCHEMA_USAGE_INVALID';
  end if;
  foreach relation_name in array array[
    'finance.account','finance.entry','finance.journal','finance.statement','finance.statementaccount',
    'finance.reconciliation','finance.reconciliationitem','finance.settlement','finance.settlementline',
    'finance.split','finance.settlementadjustment','finance.withdrawal'
  ] loop
    if not has_table_privilege('zhudatuanidentityapi',relation_name,'SELECT')
      or has_table_privilege('zhudatuanidentityapi',relation_name,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception 'IDENTITY_FINANCE_READ_TABLE_ACL_INVALID:%',relation_name;
    end if;
  end loop;
  if (select count(*) from pg_policies where schemaname='finance'
      and policyname='identityread' and cmd='SELECT'
      and 'zhudatuanidentityapi'=any(roles::text[]))<>12 then
    raise exception 'IDENTITY_FINANCE_READ_POLICY_INVALID';
  end if;
end
$assert$;

commit;
