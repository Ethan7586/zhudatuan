begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830143000') then
    raise exception 'REFERRAL_DOMAIN_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830144000') or exists(select 1 from pg_namespace where nspname='referral') then
    raise exception 'REFERRAL_DOMAIN_ALREADY_APPLIED';
  end if;
end $precondition$;

create schema if not exists referral;

create table referral.setting(
  id text primary key,
  scope_id text not null unique,
  enabled boolean not null,
  first_touch_days integer not null check(first_touch_days between 1 and 365),
  rate_basis_points integer not null check(rate_basis_points between 0 and 10000),
  minimum_withdrawal_minor bigint not null check(minimum_withdrawal_minor>0),
  currency char(3) not null check(currency~'^[A-Z]{3}$'),
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table referral.product(
  id text primary key,
  scope_id text not null,
  product_id text not null,
  enabled boolean not null,
  rate_basis_points integer not null check(rate_basis_points between 0 and 10000),
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,product_id)
);

create table referral.member(
  id text primary key,
  scope_id text not null,
  member_id text not null,
  display_name text not null check(length(display_name) between 1 and 200),
  mobile_masked text not null check(mobile_masked!~'[0-9]{7,}'),
  state text not null check(state in('applied','active','disqualified')),
  maker_id text not null,
  checker_id text,
  reason text not null check(length(reason) between 1 and 1000),
  applied_at timestamptz not null,
  approved_at timestamptz,
  disqualified_at timestamptz,
  version bigint not null check(version>0),
  unique(scope_id,member_id),
  check(checker_id is null or checker_id<>maker_id),
  check((state='applied' and approved_at is null and disqualified_at is null)
    or (state='active' and approved_at is not null and disqualified_at is null)
    or (state='disqualified' and approved_at is not null and disqualified_at is not null))
);

create table referral.binding(
  id text primary key,
  scope_id text not null,
  customer_id text not null,
  promoter_id text not null,
  token_fingerprint char(64) not null unique check(token_fingerprint~'^[0-9a-f]{64}$'),
  source text not null check(length(source) between 1 and 100),
  bound_at timestamptz not null,
  version bigint not null check(version>0),
  unique(scope_id,customer_id),
  check(customer_id<>promoter_id)
);

create table referral.commission(
  id text primary key,
  business_key text not null unique,
  scope_id text not null,
  order_id text not null,
  order_line_id text not null,
  product_id text not null,
  beneficiary_id text not null,
  base_minor bigint not null check(base_minor>=0),
  refunded_base_minor bigint not null check(refunded_base_minor between 0 and base_minor),
  amount_minor bigint not null check(amount_minor>=0),
  rate_basis_points integer not null check(rate_basis_points between 0 and 10000),
  currency char(3) not null check(currency~'^[A-Z]{3}$'),
  reversed_minor bigint not null check(reversed_minor between 0 and amount_minor),
  state text not null check(state in('pending','available','settled','reversed')),
  origin_event_id text not null,
  eligible_at timestamptz,
  settled_at timestamptz,
  settlement_journal_id text,
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,order_line_id,beneficiary_id),
  check((state='pending' and eligible_at is null and settled_at is null and settlement_journal_id is null)
    or (state='available' and eligible_at is not null and settled_at is null and settlement_journal_id is null)
    or (state='settled' and eligible_at is not null and settled_at is not null and settlement_journal_id is not null)
    or state='reversed')
);

create table referral.commissionmovement(
  id text primary key,
  movement_key text not null unique,
  scope_id text not null,
  commission_id text not null references referral.commission(id),
  refund_id text,
  direction text not null check(direction in('credit','debit')),
  base_minor bigint not null check(base_minor>=0),
  amount_minor bigint not null check(amount_minor>0),
  reason text not null check(length(reason) between 1 and 1000),
  event_id text not null,
  journal_id text,
  created_at timestamptz not null,
  check((direction='debit' and refund_id is not null) or direction='credit')
);

create table referral.recoverymovement(
  id text primary key,
  movement_key text not null unique,
  scope_id text not null,
  beneficiary_id text not null,
  source_type text not null check(source_type in('commission','withdrawal')),
  source_id text not null,
  previous_state text not null,
  next_state text not null,
  direction text not null check(direction in('credit','debit')),
  amount_minor bigint not null check(amount_minor>0),
  currency char(3) not null check(currency~'^[A-Z]{3}$'),
  actor_id text not null,
  reason text not null check(length(reason) between 1 and 1000),
  event_id text,
  journal_id text,
  created_at timestamptz not null
);

create table referral.withdrawalclaim(
  id text primary key,
  scope_id text not null,
  member_id text not null,
  amount_minor bigint not null check(amount_minor>0),
  currency char(3) not null check(currency~'^[A-Z]{3}$'),
  account_ref text not null check(length(account_ref) between 1 and 512),
  state text not null check(state in('requested','processing','paid','failed')),
  provider_reference text,
  failure_reason text,
  requested_at timestamptz not null,
  completed_at timestamptz,
  version bigint not null check(version>0),
  check((state in('requested','processing') and completed_at is null and failure_reason is null)
    or (state='paid' and completed_at is not null and provider_reference is not null and failure_reason is null)
    or (state='failed' and completed_at is not null and failure_reason is not null))
);

create index referral_product_scope_page on referral.product(scope_id,id) include(product_id,enabled,rate_basis_points,version);
create index referral_member_scope_page on referral.member(scope_id,id) include(member_id,state,version);
create index referral_binding_scope_page on referral.binding(scope_id,id) include(customer_id,promoter_id,bound_at,version);
create index referral_commission_beneficiary_page on referral.commission(scope_id,beneficiary_id,id) include(state,amount_minor,reversed_minor,currency,version);
create index referral_commission_order on referral.commission(scope_id,order_id,order_line_id,id) include(state,amount_minor,reversed_minor,version);
create index referral_commission_due on referral.commission(scope_id,eligible_at,id) include(beneficiary_id,amount_minor,reversed_minor,currency,version) where state='available';
create index referral_withdrawal_member_page on referral.withdrawalclaim(scope_id,member_id,id) include(state,amount_minor,currency,version);
create index referral_withdrawal_due on referral.withdrawalclaim(scope_id,requested_at,id) include(member_id,amount_minor,currency,version) where state='requested';
create index referral_commissionmovement_source on referral.commissionmovement(scope_id,commission_id,created_at,id);
create index referral_recoverymovement_source on referral.recoverymovement(scope_id,source_type,source_id,created_at,id);

insert into runtime.schemaversion(version,checksum)
values('20260830144000',encode(public.digest('20260830144000_create_referral_domain','sha256'),'hex'));

do $assert$ declare table_count integer; begin
  select count(*) into table_count from information_schema.tables where table_schema='referral'
    and table_name in('setting','product','member','binding','commission','commissionmovement','recoverymovement','withdrawalclaim');
  if table_count<>8 then raise exception 'REFERRAL_DOMAIN_TABLE_COUNT_INVALID'; end if;
end $assert$;

commit;
