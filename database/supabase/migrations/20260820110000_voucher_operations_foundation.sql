-- Formal voucher operations foundation.
--
-- This migration intentionally creates a new production domain. It never reads
-- or promotes public.test_vouchers / payment_simulations, which remain test-only.
-- The first production slice is an electronic stored-value voucher with partial
-- redemption. Amounts are always integer cents.
--
-- This unpublished candidate was assigned a unique 2026-08-20 version after
-- repository history proved that 20260817110000 already belonged to the
-- universal storefront migration. Production migration history remains an
-- independent deployment gate and is not inferred by this filename.

insert into public.permissions (id, code, name) values
  ('permission-voucher-read-mvp', 'voucher.read', '查看卡券数据'),
  ('permission-voucher-program-manage-v1', 'voucher.program.manage', '管理卡券规则'),
  ('permission-voucher-card-pool-manage-v1', 'voucher.card_pool.manage', '管理卡号库'),
  ('permission-voucher-reserve-create-v1', 'voucher.reserve.create', '创建备券申请'),
  ('permission-voucher-reserve-approve-v1', 'voucher.reserve.approve', '审批备券申请'),
  ('permission-voucher-issue-mvp', 'voucher.issue', '发行卡券'),
  ('permission-voucher-status-manage-v1', 'voucher.status.manage', '变更卡券状态'),
  ('permission-voucher-redeem-v1', 'voucher.redeem', '核销卡券'),
  ('permission-voucher-redemption-reverse-v1', 'voucher.redemption.reverse', '冲正卡券核销'),
  ('permission-voucher-reconcile-v1', 'voucher.reconcile', '卡券财务对账'),
  ('permission-voucher-audit-read-v1', 'voucher.audit.read', '查看卡券审计')
on conflict (id) do update set code = excluded.code, name = excluded.name;

insert into public.roles (id, tenant_id, code, name) values
  ('role-voucher-platform-admin-v1', 'tenant-smart-wing', 'voucher_platform_admin', '卡券平台管理员'),
  ('role-voucher-enterprise-manager-v1', 'tenant-smart-wing', 'voucher_enterprise_manager', '卡券企业福利经理'),
  ('role-voucher-approver-v1', 'tenant-smart-wing', 'voucher_approver', '卡券审批人'),
  ('role-voucher-mall-operator-v1', 'tenant-smart-wing', 'voucher_mall_operator', '卡券商城运营'),
  ('role-voucher-store-operator-v1', 'tenant-smart-wing', 'voucher_store_operator', '卡券门店操作员'),
  ('role-voucher-finance-v1', 'tenant-smart-wing', 'voucher_finance', '卡券财务人员'),
  ('role-voucher-auditor-v1', 'tenant-smart-wing', 'voucher_auditor', '卡券审计人员')
on conflict (id) do update set code = excluded.code, name = excluded.name;

insert into public.role_permissions (role_id, permission_id)
select grants.role_id, p.id
from (
  values
    ('role-voucher-platform-admin-v1', 'voucher.read'),
    ('role-voucher-platform-admin-v1', 'voucher.program.manage'),
    ('role-voucher-platform-admin-v1', 'voucher.card_pool.manage'),
    ('role-voucher-platform-admin-v1', 'voucher.audit.read'),
    ('role-voucher-enterprise-manager-v1', 'voucher.read'),
    ('role-voucher-enterprise-manager-v1', 'voucher.reserve.create'),
    ('role-voucher-approver-v1', 'voucher.read'),
    ('role-voucher-approver-v1', 'voucher.reserve.approve'),
    ('role-voucher-mall-operator-v1', 'voucher.read'),
    ('role-voucher-mall-operator-v1', 'voucher.issue'),
    ('role-voucher-mall-operator-v1', 'voucher.status.manage'),
    ('role-voucher-store-operator-v1', 'voucher.read'),
    ('role-voucher-store-operator-v1', 'voucher.redeem'),
    ('role-voucher-finance-v1', 'voucher.read'),
    ('role-voucher-finance-v1', 'voucher.redemption.reverse'),
    ('role-voucher-finance-v1', 'voucher.reconcile'),
    ('role-voucher-auditor-v1', 'voucher.read'),
    ('role-voucher-auditor-v1', 'voucher.audit.read')
) as grants(role_id, permission_code)
join public.permissions p on p.code = grants.permission_code
on conflict do nothing;

create table public.voucher_programs (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  product_id text references public.products(id) on delete restrict,
  program_code text not null,
  name text not null check (char_length(name) between 1 and 160),
  instrument_type text not null check (instrument_type = 'stored_value'),
  denomination_cents bigint not null check (denomination_cents > 0),
  default_valid_days integer not null check (default_valid_days between 1 and 3650),
  redemption_policy text not null default 'partial' check (redemption_policy = 'partial'),
  status text not null default 'draft' check (status in ('draft', 'active', 'suspended', 'retired')),
  rule_version integer not null default 1 check (rule_version > 0),
  created_by_user_id text references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, mall_id, program_code)
);

create table public.voucher_card_pools (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  pool_code text not null,
  code_prefix text not null check (code_prefix ~ '^[A-Z0-9]{2,20}$'),
  next_sequence bigint not null default 1 check (next_sequence > 0),
  status text not null default 'active' check (status in ('active', 'suspended', 'exhausted')),
  created_by_user_id text references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, pool_code),
  unique (tenant_id, code_prefix)
);

create table public.voucher_reserve_requests (
  id text primary key,
  request_no text not null unique,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  voucher_program_id text not null references public.voucher_programs(id) on delete restrict,
  requested_quantity integer not null check (requested_quantity between 1 and 1000000),
  requested_value_cents bigint not null check (requested_value_cents > 0),
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'cancelled', 'fulfilled')),
  requested_by_user_id text not null references public.users(id) on delete restrict,
  submitted_at timestamptz,
  resolved_at timestamptz,
  resolved_by_user_id text references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.voucher_approval_actions (
  id text primary key,
  reserve_request_id text not null references public.voucher_reserve_requests(id) on delete restrict,
  approval_node integer not null check (approval_node > 0),
  decision text not null check (decision in ('approved', 'rejected')),
  reason text not null check (char_length(reason) between 1 and 500),
  evidence text check (char_length(evidence) <= 2000),
  actor_user_id text not null references public.users(id) on delete restrict,
  actor_membership_id text not null references public.memberships(id) on delete restrict,
  granted_via jsonb not null,
  request_id text not null,
  created_at timestamptz not null default now(),
  unique (reserve_request_id, approval_node)
);

create table public.voucher_issue_batches (
  id text primary key,
  batch_no text not null unique,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  reserve_request_id text not null unique references public.voucher_reserve_requests(id) on delete restrict,
  voucher_program_id text not null references public.voucher_programs(id) on delete restrict,
  card_pool_id text references public.voucher_card_pools(id) on delete restrict,
  issued_quantity integer not null check (issued_quantity between 1 and 1000000),
  issued_value_cents bigint not null check (issued_value_cents > 0),
  status text not null default 'draft' check (status in ('draft', 'issuing', 'issued', 'failed', 'closed')),
  issued_by_user_id text references public.users(id) on delete restrict,
  issued_by_membership_id text references public.memberships(id) on delete restrict,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vouchers (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  voucher_program_id text not null references public.voucher_programs(id) on delete restrict,
  issue_batch_id text not null references public.voucher_issue_batches(id) on delete restrict,
  voucher_code text not null unique,
  card_no text unique,
  bound_user_id text references public.users(id) on delete restrict,
  initial_cents bigint not null check (initial_cents > 0),
  remaining_cents bigint not null check (remaining_cents between 0 and initial_cents),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'disabled', 'redeemed', 'expired', 'void')),
  expires_at timestamptz not null,
  activated_at timestamptz,
  redeemed_at timestamptz,
  voided_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.voucher_status_events (
  id text primary key,
  voucher_id text not null references public.vouchers(id) on delete restrict,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  operation text not null check (operation in ('issue', 'activate', 'disable', 'extend', 'void', 'expire', 'redeem', 'reverse_redemption')),
  status_before text,
  status_after text not null,
  expires_at_before timestamptz,
  expires_at_after timestamptz,
  reason text not null check (char_length(reason) between 1 and 500),
  evidence text check (char_length(evidence) <= 2000),
  actor_user_id text references public.users(id) on delete restrict,
  actor_membership_id text references public.memberships(id) on delete restrict,
  granted_via jsonb not null,
  request_id text not null,
  created_at timestamptz not null default now()
);

create table public.voucher_redemptions (
  id text primary key,
  redemption_no text not null unique,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  voucher_id text not null references public.vouchers(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  remaining_before_cents bigint not null check (remaining_before_cents >= 0),
  remaining_after_cents bigint not null check (remaining_after_cents >= 0 and remaining_after_cents < remaining_before_cents),
  merchant_reference text not null check (char_length(merchant_reference) between 1 and 160),
  operator_user_id text not null references public.users(id) on delete restrict,
  operator_membership_id text not null references public.memberships(id) on delete restrict,
  granted_via jsonb not null,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 120),
  request_hash text not null,
  request_id text not null,
  created_at timestamptz not null default now(),
  unique (mall_id, idempotency_key),
  unique (voucher_id, merchant_reference)
);

create table public.voucher_redemption_reversals (
  id text primary key,
  reversal_no text not null unique,
  redemption_id text not null unique references public.voucher_redemptions(id) on delete restrict,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'reversed')),
  reason text not null check (char_length(reason) between 1 and 500),
  requested_by_user_id text not null references public.users(id) on delete restrict,
  approved_by_user_id text references public.users(id) on delete restrict,
  approved_by_membership_id text references public.memberships(id) on delete restrict,
  granted_via jsonb,
  request_id text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- A void never silently returns value to an enterprise balance. The remaining
-- value is frozen here and becomes a finance-owned reconciliation item.
create table public.voucher_void_balance_holds (
  id text primary key,
  voucher_id text not null unique references public.vouchers(id) on delete restrict,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'open' check (status in ('open', 'reconciled')),
  void_reason text not null check (char_length(void_reason) between 1 and 500),
  voided_by_user_id text not null references public.users(id) on delete restrict,
  voided_by_membership_id text not null references public.memberships(id) on delete restrict,
  void_granted_via jsonb not null,
  void_request_id text not null,
  reconciliation_reference text check (char_length(reconciliation_reference) between 1 and 160),
  reconciliation_note text check (char_length(reconciliation_note) between 1 and 500),
  reconciled_by_user_id text references public.users(id) on delete restrict,
  reconciled_by_membership_id text references public.memberships(id) on delete restrict,
  reconciliation_granted_via jsonb,
  reconciliation_request_id text,
  created_at timestamptz not null default now(),
  reconciled_at timestamptz,
  check (
    (status = 'open' and reconciliation_reference is null and reconciliation_note is null and reconciled_by_user_id is null and reconciled_by_membership_id is null and reconciliation_granted_via is null and reconciliation_request_id is null and reconciled_at is null)
    or
    (status = 'reconciled' and reconciliation_reference is not null and reconciliation_note is not null and reconciled_by_user_id is not null and reconciled_by_membership_id is not null and reconciliation_granted_via is not null and reconciliation_request_id is not null and reconciled_at is not null)
  )
);

create index idx_voucher_programs_scope on public.voucher_programs (tenant_id, enterprise_id, mall_id, status);
create index idx_voucher_reserves_scope on public.voucher_reserve_requests (tenant_id, enterprise_id, mall_id, status, created_at desc);
create index idx_voucher_batches_scope on public.voucher_issue_batches (tenant_id, enterprise_id, mall_id, status, created_at desc);
create index idx_vouchers_scope on public.vouchers (tenant_id, enterprise_id, mall_id, status, expires_at, created_at desc);
create index idx_vouchers_batch on public.vouchers (issue_batch_id, created_at desc);
create index idx_voucher_events_voucher on public.voucher_status_events (voucher_id, created_at desc);
create index idx_voucher_redemptions_scope on public.voucher_redemptions (tenant_id, enterprise_id, mall_id, created_at desc);
create index idx_voucher_redemptions_voucher on public.voucher_redemptions (voucher_id, created_at desc);
create index idx_voucher_void_holds_scope on public.voucher_void_balance_holds (tenant_id, enterprise_id, mall_id, status, created_at desc);
create unique index idx_voucher_void_holds_reconciliation_reference on public.voucher_void_balance_holds (mall_id, reconciliation_reference)
where reconciliation_reference is not null;
create index idx_voucher_audit_scope on public.audit_logs (tenant_id, enterprise_id, mall_id, created_at desc)
where action like 'voucher.%';

create trigger voucher_approval_actions_immutable before update or delete on public.voucher_approval_actions
for each row execute function public.reject_immutable_change();
create trigger voucher_status_events_immutable before update or delete on public.voucher_status_events
for each row execute function public.reject_immutable_change();
create trigger voucher_redemptions_immutable before update or delete on public.voucher_redemptions
for each row execute function public.reject_immutable_change();
create trigger voucher_redemption_reversals_immutable before update or delete on public.voucher_redemption_reversals
for each row execute function public.reject_immutable_change();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'voucher_programs', 'voucher_card_pools', 'voucher_reserve_requests',
    'voucher_approval_actions', 'voucher_issue_batches', 'vouchers',
    'voucher_status_events', 'voucher_redemptions', 'voucher_redemption_reversals', 'voucher_void_balance_holds'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
  end loop;
end $$;

-- Database-side list filtering is deliberately derived from the membership that
-- commerce-api resolved from the signed host-only session. It never accepts a
-- caller supplied tenant, enterprise or mall ID.
create or replace function public.api_voucher_membership_scope_allows(
  p_membership_id text,
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships membership
    join public.members member on member.id = membership.member_id
    where membership.id = p_membership_id
      and membership.target = 'admin'
      and membership.status = 'active'
      and member.status = 'active'
      and membership.tenant_id = p_tenant_id
      and (membership.expires_at is null or membership.expires_at > now())
      and exists (
        select 1
        from public.membership_scopes scope
        where scope.membership_id = membership.id
          and (
            (scope.scope_kind = 'tenant' and scope.resource_id = p_tenant_id)
            or (scope.scope_kind = 'enterprise' and scope.resource_id = p_enterprise_id)
            or (scope.scope_kind = 'mall' and scope.resource_id = p_mall_id)
          )
      )
  );
$$;

-- The worker obtains both identifiers from the same signed membership context,
-- but the write RPCs also verify this relationship as a database-side guard.
create or replace function public.api_voucher_membership_actor_matches(
  p_membership_id text,
  p_operator_user_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships membership
    join public.members member on member.id = membership.member_id
    where membership.id = p_membership_id
      and membership.target = 'admin'
      and membership.status = 'active'
      and member.status = 'active'
      and membership.context_user_id = p_operator_user_id
      and (membership.expires_at is null or membership.expires_at > now())
  );
$$;

create or replace function public.api_voucher_programs_scoped(
  p_membership_id text,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  id text, program_code text, name text, denomination_cents bigint,
  default_valid_days integer, redemption_policy text, status text,
  enterprise_id text, mall_id text, updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select program.id, program.program_code, program.name, program.denomination_cents,
         program.default_valid_days, program.redemption_policy, program.status,
         program.enterprise_id, program.mall_id, program.updated_at
  from public.voucher_programs program
  where public.api_voucher_membership_scope_allows(p_membership_id, program.tenant_id, program.enterprise_id, program.mall_id)
  order by program.updated_at desc, program.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.api_voucher_reserves_scoped(
  p_membership_id text,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  id text, request_no text, voucher_program_id text, program_name text,
  requested_quantity integer, requested_value_cents bigint, status text,
  enterprise_id text, mall_id text, requested_by_user_id text, created_at timestamptz, updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select reserve.id, reserve.request_no, reserve.voucher_program_id, program.name,
         reserve.requested_quantity, reserve.requested_value_cents, reserve.status,
         reserve.enterprise_id, reserve.mall_id, reserve.requested_by_user_id,
         reserve.created_at, reserve.updated_at
  from public.voucher_reserve_requests reserve
  join public.voucher_programs program on program.id = reserve.voucher_program_id
  where public.api_voucher_membership_scope_allows(p_membership_id, reserve.tenant_id, reserve.enterprise_id, reserve.mall_id)
  order by reserve.created_at desc, reserve.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.api_voucher_batches_scoped(
  p_membership_id text,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  id text, batch_no text, reserve_request_id text, voucher_program_id text,
  issued_quantity integer, issued_value_cents bigint, status text,
  enterprise_id text, mall_id text, issued_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select batch.id, batch.batch_no, batch.reserve_request_id, batch.voucher_program_id,
         batch.issued_quantity, batch.issued_value_cents, batch.status,
         batch.enterprise_id, batch.mall_id, batch.issued_at, batch.created_at
  from public.voucher_issue_batches batch
  where public.api_voucher_membership_scope_allows(p_membership_id, batch.tenant_id, batch.enterprise_id, batch.mall_id)
  order by batch.created_at desc, batch.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.api_vouchers_scoped(
  p_membership_id text,
  p_query text default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  id text, voucher_code text, card_no text, program_name text, status text,
  initial_cents bigint, remaining_cents bigint, expires_at timestamptz,
  bound_user_id text, issue_batch_id text, enterprise_id text, mall_id text, version bigint, updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select voucher.id, voucher.voucher_code, voucher.card_no, program.name, effective.status,
         voucher.initial_cents, voucher.remaining_cents, voucher.expires_at,
         voucher.bound_user_id, voucher.issue_batch_id, voucher.enterprise_id,
         voucher.mall_id, voucher.version, voucher.updated_at
  from public.vouchers voucher
  join public.voucher_programs program on program.id = voucher.voucher_program_id
  cross join lateral (
    select case when voucher.status in ('inactive', 'active', 'disabled') and voucher.expires_at <= now() then 'expired' else voucher.status end as status
  ) effective
  where public.api_voucher_membership_scope_allows(p_membership_id, voucher.tenant_id, voucher.enterprise_id, voucher.mall_id)
    and (p_status is null or effective.status = p_status)
    and (
      p_query is null
      or voucher.voucher_code ilike '%' || p_query || '%'
      or coalesce(voucher.card_no, '') ilike '%' || p_query || '%'
      or program.name ilike '%' || p_query || '%'
    )
  order by voucher.updated_at desc, voucher.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.api_voucher_detail_scoped(
  p_membership_id text,
  p_voucher_id text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', voucher.id,
    'voucherCode', voucher.voucher_code,
    'cardNo', voucher.card_no,
    'programId', voucher.voucher_program_id,
    'programName', program.name,
    'issueBatchId', voucher.issue_batch_id,
    'status', case when voucher.status in ('inactive', 'active', 'disabled') and voucher.expires_at <= now() then 'expired' else voucher.status end,
    'initialCents', voucher.initial_cents,
    'remainingCents', voucher.remaining_cents,
    'expiresAt', voucher.expires_at,
    'boundUserId', voucher.bound_user_id,
    'enterpriseId', voucher.enterprise_id,
    'mallId', voucher.mall_id,
    'version', voucher.version,
    'updatedAt', voucher.updated_at
  )
  from public.vouchers voucher
  join public.voucher_programs program on program.id = voucher.voucher_program_id
  where voucher.id = p_voucher_id
    and public.api_voucher_membership_scope_allows(p_membership_id, voucher.tenant_id, voucher.enterprise_id, voucher.mall_id);
$$;

create or replace function public.api_voucher_redemptions_scoped(
  p_membership_id text,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  id text, redemption_no text, voucher_id text, voucher_code text,
  amount_cents bigint, remaining_before_cents bigint, remaining_after_cents bigint,
  merchant_reference text, operator_user_id text, enterprise_id text, mall_id text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select redemption.id, redemption.redemption_no, redemption.voucher_id, voucher.voucher_code,
         redemption.amount_cents, redemption.remaining_before_cents, redemption.remaining_after_cents,
         redemption.merchant_reference, redemption.operator_user_id, redemption.enterprise_id,
         redemption.mall_id, redemption.created_at
  from public.voucher_redemptions redemption
  join public.vouchers voucher on voucher.id = redemption.voucher_id
  where public.api_voucher_membership_scope_allows(p_membership_id, redemption.tenant_id, redemption.enterprise_id, redemption.mall_id)
  order by redemption.created_at desc, redemption.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.api_voucher_overview_scoped(p_membership_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with scoped_vouchers as (
    select voucher.remaining_cents, voucher.updated_at,
           case when voucher.status in ('inactive', 'active', 'disabled') and voucher.expires_at <= now() then 'expired' else voucher.status end as status
    from public.vouchers voucher
    where public.api_voucher_membership_scope_allows(p_membership_id, voucher.tenant_id, voucher.enterprise_id, voucher.mall_id)
  )
  select jsonb_build_object(
    'activeVoucherCount', count(*) filter (where status = 'active'),
    'inactiveVoucherCount', count(*) filter (where status = 'inactive'),
    'disabledVoucherCount', count(*) filter (where status = 'disabled'),
    'redeemedVoucherCount', count(*) filter (where status = 'redeemed'),
    'remainingValueCents', coalesce(sum(remaining_cents) filter (where status in ('inactive', 'active', 'disabled')), 0),
    'updatedAt', max(updated_at)
  )
  from scoped_vouchers;
$$;

create or replace function public.api_voucher_audit_scoped(
  p_membership_id text,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  id text, action text, resource_type text, resource_id text, request_id text,
  actor_user_id text, membership_id text, granted_via jsonb, created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select audit.id, audit.action, audit.resource_type, audit.resource_id, audit.request_id,
         audit.actor_user_id, audit.membership_id, audit.granted_via, audit.created_at
  from public.audit_logs audit
  where audit.action like 'voucher.%'
    and public.api_voucher_membership_scope_allows(p_membership_id, audit.tenant_id, audit.enterprise_id, audit.mall_id)
  order by audit.created_at desc, audit.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.api_voucher_void_holds_scoped(
  p_membership_id text,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  id text, voucher_id text, voucher_code text, amount_cents bigint, status text,
  void_reason text, reconciliation_reference text, reconciliation_note text,
  created_at timestamptz, reconciled_at timestamptz, enterprise_id text, mall_id text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select hold.id, hold.voucher_id, voucher.voucher_code, hold.amount_cents, hold.status,
         hold.void_reason, hold.reconciliation_reference, hold.reconciliation_note,
         hold.created_at, hold.reconciled_at, hold.enterprise_id, hold.mall_id
  from public.voucher_void_balance_holds hold
  join public.vouchers voucher on voucher.id = hold.voucher_id
  where public.api_voucher_membership_scope_allows(p_membership_id, hold.tenant_id, hold.enterprise_id, hold.mall_id)
  order by case when hold.status = 'open' then 0 else 1 end, hold.created_at desc, hold.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.api_voucher_void_hold_authorization_scope(p_void_hold_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('tenant_id', hold.tenant_id, 'enterprise_id', hold.enterprise_id, 'mall_id', hold.mall_id)
  from public.voucher_void_balance_holds hold where hold.id = p_void_hold_id;
$$;

create or replace function public.api_voucher_authorization_scope(p_voucher_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'tenant_id', voucher.tenant_id,
    'enterprise_id', voucher.enterprise_id,
    'mall_id', voucher.mall_id,
    'user_id', voucher.bound_user_id
  )
  from public.vouchers voucher
  where voucher.id = p_voucher_id;
$$;

revoke all on function public.api_voucher_membership_scope_allows(text, text, text, text) from public, anon, authenticated;
revoke all on function public.api_voucher_membership_actor_matches(text, text) from public, anon, authenticated;
revoke all on function public.api_voucher_programs_scoped(text, integer, integer) from public, anon, authenticated;
revoke all on function public.api_voucher_reserves_scoped(text, integer, integer) from public, anon, authenticated;
revoke all on function public.api_voucher_batches_scoped(text, integer, integer) from public, anon, authenticated;
revoke all on function public.api_vouchers_scoped(text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.api_voucher_detail_scoped(text, text) from public, anon, authenticated;
revoke all on function public.api_voucher_redemptions_scoped(text, integer, integer) from public, anon, authenticated;
revoke all on function public.api_voucher_overview_scoped(text) from public, anon, authenticated;
revoke all on function public.api_voucher_audit_scoped(text, integer, integer) from public, anon, authenticated;
revoke all on function public.api_voucher_void_holds_scoped(text, integer, integer) from public, anon, authenticated;
revoke all on function public.api_voucher_authorization_scope(text) from public, anon, authenticated;

grant execute on function public.api_voucher_membership_scope_allows(text, text, text, text) to service_role;
grant execute on function public.api_voucher_membership_actor_matches(text, text) to service_role;
grant execute on function public.api_voucher_programs_scoped(text, integer, integer) to service_role;
grant execute on function public.api_voucher_reserves_scoped(text, integer, integer) to service_role;
grant execute on function public.api_voucher_batches_scoped(text, integer, integer) to service_role;
grant execute on function public.api_vouchers_scoped(text, text, text, integer, integer) to service_role;
grant execute on function public.api_voucher_detail_scoped(text, text) to service_role;
grant execute on function public.api_voucher_redemptions_scoped(text, integer, integer) to service_role;
grant execute on function public.api_voucher_overview_scoped(text) to service_role;
grant execute on function public.api_voucher_audit_scoped(text, integer, integer) to service_role;
grant execute on function public.api_voucher_void_holds_scoped(text, integer, integer) to service_role;
grant execute on function public.api_voucher_authorization_scope(text) to service_role;

create or replace function public.api_voucher_program_authorization_scope(p_voucher_program_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('tenant_id', program.tenant_id, 'enterprise_id', program.enterprise_id, 'mall_id', program.mall_id)
  from public.voucher_programs program where program.id = p_voucher_program_id;
$$;

create or replace function public.api_voucher_reserve_authorization_scope(p_reserve_request_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('tenant_id', reserve.tenant_id, 'enterprise_id', reserve.enterprise_id, 'mall_id', reserve.mall_id, 'user_id', reserve.requested_by_user_id)
  from public.voucher_reserve_requests reserve where reserve.id = p_reserve_request_id;
$$;

create or replace function public.api_voucher_redemption_authorization_scope(p_redemption_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('tenant_id', redemption.tenant_id, 'enterprise_id', redemption.enterprise_id, 'mall_id', redemption.mall_id)
  from public.voucher_redemptions redemption where redemption.id = p_redemption_id;
$$;

create or replace function public.api_voucher_code_authorization_scope(p_voucher_code text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('id', voucher.id, 'tenant_id', voucher.tenant_id, 'enterprise_id', voucher.enterprise_id, 'mall_id', voucher.mall_id, 'user_id', voucher.bound_user_id)
  from public.vouchers voucher where voucher.voucher_code = p_voucher_code;
$$;

create or replace function public.api_create_voucher_reserve_authorized(
  p_membership_id text,
  p_operator_user_id text,
  p_voucher_program_id text,
  p_quantity integer,
  p_reason text,
  p_idempotency_key text,
  p_request_hash text,
  p_request_id text,
  p_user_agent text,
  p_granted_via jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.idempotency_keys%rowtype;
  v_program public.voucher_programs%rowtype;
  v_request_id text := gen_random_uuid()::text;
  v_request_no text := 'VR' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_now timestamptz := clock_timestamp();
  v_value_cents bigint;
  v_response jsonb;
begin
  if p_quantity < 1 or p_quantity > 1000000 or char_length(trim(p_reason)) not between 1 and 500
     or char_length(trim(coalesce(p_idempotency_key, ''))) not between 1 and 120 or char_length(trim(coalesce(p_request_hash, ''))) = 0 then
    raise exception 'INVALID_VOUCHER_RESERVE_INPUT';
  end if;
  if not public.api_voucher_membership_actor_matches(p_membership_id, p_operator_user_id) then raise exception 'VOUCHER_OPERATOR_NOT_AUTHORIZED'; end if;
  select * into v_program from public.voucher_programs where id = p_voucher_program_id for share;
  if not found or v_program.status <> 'active' or not public.api_voucher_membership_scope_allows(p_membership_id, v_program.tenant_id, v_program.enterprise_id, v_program.mall_id) then
    raise exception 'VOUCHER_PROGRAM_NOT_AVAILABLE';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_program.mall_id || ':voucher:reserve:create:' || p_idempotency_key));
  select * into v_existing from public.idempotency_keys
    where mall_id = v_program.mall_id and scope = 'voucher:reserve:create' and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;
  v_value_cents := v_program.denomination_cents * p_quantity;

  insert into public.voucher_reserve_requests (
    id, request_no, tenant_id, enterprise_id, mall_id, voucher_program_id,
    requested_quantity, requested_value_cents, reason, status, requested_by_user_id, submitted_at, created_at, updated_at
  ) values (
    v_request_id, v_request_no, v_program.tenant_id, v_program.enterprise_id, v_program.mall_id, v_program.id,
    p_quantity, v_value_cents, trim(p_reason), 'submitted', p_operator_user_id, v_now, v_now, v_now
  );
  v_response := jsonb_build_object('reserveRequest', jsonb_build_object(
    'id', v_request_id, 'requestNo', v_request_no, 'status', 'submitted',
    'requestedQuantity', p_quantity, 'requestedValueCents', v_value_cents, 'createdAt', v_now
  ), 'requestId', p_request_id);
  insert into public.idempotency_keys values (
    v_program.tenant_id, v_program.mall_id, 'voucher:reserve:create', p_idempotency_key,
    p_request_hash, v_request_id, v_response, v_now, v_now + interval '24 hours'
  );
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json, membership_id, granted_via, created_at
  ) values (
    gen_random_uuid()::text, v_program.tenant_id, v_program.enterprise_id, v_program.mall_id, p_operator_user_id, 'admin', 'voucher.reserve.submitted',
    'voucher_reserve_request', v_request_id, p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('requestNo', v_request_no, 'quantity', p_quantity, 'valueCents', v_value_cents, 'reason', trim(p_reason)),
    p_membership_id, p_granted_via, v_now
  );
  return v_response;
end;
$$;

create or replace function public.api_decide_voucher_reserve_authorized(
  p_membership_id text,
  p_operator_user_id text,
  p_reserve_request_id text,
  p_decision text,
  p_reason text,
  p_evidence text,
  p_idempotency_key text,
  p_request_hash text,
  p_request_id text,
  p_user_agent text,
  p_granted_via jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.idempotency_keys%rowtype;
  v_reserve public.voucher_reserve_requests%rowtype;
  v_now timestamptz := clock_timestamp();
  v_response jsonb;
begin
  if p_decision not in ('approved', 'rejected') or char_length(trim(p_reason)) not between 1 and 500
     or char_length(trim(coalesce(p_idempotency_key, ''))) not between 1 and 120 or char_length(trim(coalesce(p_request_hash, ''))) = 0 then
    raise exception 'INVALID_VOUCHER_APPROVAL_INPUT';
  end if;
  if not public.api_voucher_membership_actor_matches(p_membership_id, p_operator_user_id) then raise exception 'VOUCHER_OPERATOR_NOT_AUTHORIZED'; end if;
  select * into v_reserve from public.voucher_reserve_requests where id = p_reserve_request_id for update;
  if not found or not public.api_voucher_membership_scope_allows(p_membership_id, v_reserve.tenant_id, v_reserve.enterprise_id, v_reserve.mall_id) then raise exception 'VOUCHER_RESERVE_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_reserve.mall_id || ':voucher:reserve:decision:' || p_idempotency_key));
  select * into v_existing from public.idempotency_keys
    where mall_id = v_reserve.mall_id and scope = 'voucher:reserve:decision' and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;
  if v_reserve.status <> 'submitted' then raise exception 'VOUCHER_RESERVE_NOT_PENDING'; end if;
  if exists (select 1 from public.voucher_approval_actions where reserve_request_id = v_reserve.id and approval_node = 1) then raise exception 'VOUCHER_RESERVE_ALREADY_DECIDED'; end if;

  insert into public.voucher_approval_actions (
    id, reserve_request_id, approval_node, decision, reason, evidence,
    actor_user_id, actor_membership_id, granted_via, request_id, created_at
  ) values (
    gen_random_uuid()::text, v_reserve.id, 1, p_decision, trim(p_reason), nullif(trim(coalesce(p_evidence, '')), ''),
    p_operator_user_id, p_membership_id, p_granted_via, p_request_id, v_now
  );
  update public.voucher_reserve_requests
    set status = p_decision, resolved_at = v_now, resolved_by_user_id = p_operator_user_id, updated_at = v_now
    where id = v_reserve.id;
  v_response := jsonb_build_object('reserveRequest', jsonb_build_object('id', v_reserve.id, 'requestNo', v_reserve.request_no, 'status', p_decision, 'resolvedAt', v_now), 'requestId', p_request_id);
  insert into public.idempotency_keys values (v_reserve.tenant_id, v_reserve.mall_id, 'voucher:reserve:decision', p_idempotency_key, p_request_hash, v_reserve.id, v_response, v_now, v_now + interval '24 hours');
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, before_json, after_json, membership_id, granted_via, created_at
  ) values (
    gen_random_uuid()::text, v_reserve.tenant_id, v_reserve.enterprise_id, v_reserve.mall_id, p_operator_user_id, 'admin', 'voucher.reserve.' || p_decision,
    'voucher_reserve_request', v_reserve.id, p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('status', 'submitted'), jsonb_build_object('status', p_decision, 'reason', trim(p_reason), 'evidence', nullif(trim(coalesce(p_evidence, '')), '')),
    p_membership_id, p_granted_via, v_now
  );
  return v_response;
end;
$$;

create or replace function public.api_issue_voucher_batch_authorized(
  p_membership_id text,
  p_operator_user_id text,
  p_reserve_request_id text,
  p_card_pool_id text,
  p_idempotency_key text,
  p_request_hash text,
  p_request_id text,
  p_user_agent text,
  p_granted_via jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.idempotency_keys%rowtype;
  v_reserve public.voucher_reserve_requests%rowtype;
  v_program public.voucher_programs%rowtype;
  v_pool public.voucher_card_pools%rowtype;
  v_batch_id text := gen_random_uuid()::text;
  v_batch_no text := 'VB' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_start_sequence bigint;
  v_now timestamptz := clock_timestamp();
  v_expires_at timestamptz;
  v_response jsonb;
begin
  if char_length(trim(coalesce(p_idempotency_key, ''))) not between 1 and 120 or char_length(trim(coalesce(p_request_hash, ''))) = 0 then raise exception 'INVALID_VOUCHER_ISSUE_INPUT'; end if;
  if not public.api_voucher_membership_actor_matches(p_membership_id, p_operator_user_id) then raise exception 'VOUCHER_OPERATOR_NOT_AUTHORIZED'; end if;
  select * into v_reserve from public.voucher_reserve_requests where id = p_reserve_request_id for update;
  if not found or not public.api_voucher_membership_scope_allows(p_membership_id, v_reserve.tenant_id, v_reserve.enterprise_id, v_reserve.mall_id) then raise exception 'VOUCHER_RESERVE_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_reserve.mall_id || ':voucher:issue:' || p_idempotency_key));
  select * into v_existing from public.idempotency_keys
    where mall_id = v_reserve.mall_id and scope = 'voucher:issue' and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;
  if v_reserve.status <> 'approved' then raise exception 'VOUCHER_RESERVE_NOT_APPROVED'; end if;
  select * into v_program from public.voucher_programs where id = v_reserve.voucher_program_id for share;
  if not found or v_program.status <> 'active' then raise exception 'VOUCHER_PROGRAM_NOT_AVAILABLE'; end if;
  if v_reserve.requested_value_cents <> v_reserve.requested_quantity * v_program.denomination_cents then raise exception 'VOUCHER_RESERVE_VALUE_MISMATCH'; end if;
  if p_card_pool_id is not null then
    select * into v_pool from public.voucher_card_pools where id = p_card_pool_id for update;
    if not found or v_pool.tenant_id <> v_reserve.tenant_id or v_pool.status <> 'active' then raise exception 'VOUCHER_CARD_POOL_NOT_AVAILABLE'; end if;
    v_start_sequence := v_pool.next_sequence;
  end if;
  v_expires_at := v_now + make_interval(days => v_program.default_valid_days);
  insert into public.voucher_issue_batches (
    id, batch_no, tenant_id, enterprise_id, mall_id, reserve_request_id, voucher_program_id, card_pool_id,
    issued_quantity, issued_value_cents, status, issued_by_user_id, issued_by_membership_id, created_at, updated_at
  ) values (
    v_batch_id, v_batch_no, v_reserve.tenant_id, v_reserve.enterprise_id, v_reserve.mall_id, v_reserve.id, v_program.id, p_card_pool_id,
    v_reserve.requested_quantity, v_reserve.requested_value_cents, 'issuing', p_operator_user_id, p_membership_id, v_now, v_now
  );
  if p_card_pool_id is not null then
    update public.voucher_card_pools set next_sequence = v_start_sequence + v_reserve.requested_quantity, updated_at = v_now where id = v_pool.id;
  end if;
  insert into public.vouchers (
    id, tenant_id, enterprise_id, mall_id, voucher_program_id, issue_batch_id,
    voucher_code, card_no, initial_cents, remaining_cents, status, expires_at, created_at, updated_at
  )
  select gen_random_uuid()::text, v_reserve.tenant_id, v_reserve.enterprise_id, v_reserve.mall_id, v_program.id, v_batch_id,
         case when p_card_pool_id is null then 'SWV-' else v_pool.code_prefix || '-' end || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)),
         case when p_card_pool_id is null then null else 'NO.' || v_pool.code_prefix || lpad((v_start_sequence + sequence_value)::text, 12, '0') end,
         v_program.denomination_cents, v_program.denomination_cents, 'inactive', v_expires_at, v_now, v_now
  from generate_series(0, v_reserve.requested_quantity - 1) as sequence_value;
  insert into public.voucher_status_events (
    id, voucher_id, tenant_id, enterprise_id, mall_id, operation, status_after,
    expires_at_after, reason, actor_user_id, actor_membership_id, granted_via, request_id, created_at
  )
  select gen_random_uuid()::text, voucher.id, voucher.tenant_id, voucher.enterprise_id, voucher.mall_id, 'issue', 'inactive',
         voucher.expires_at, 'approved reserve issuance', p_operator_user_id, p_membership_id, p_granted_via, p_request_id, v_now
  from public.vouchers voucher where voucher.issue_batch_id = v_batch_id;
  update public.voucher_issue_batches set status = 'issued', issued_at = v_now, updated_at = v_now where id = v_batch_id;
  update public.voucher_reserve_requests set status = 'fulfilled', updated_at = v_now where id = v_reserve.id;
  v_response := jsonb_build_object('issueBatch', jsonb_build_object('id', v_batch_id, 'batchNo', v_batch_no, 'status', 'issued', 'issuedQuantity', v_reserve.requested_quantity, 'expiresAt', v_expires_at), 'requestId', p_request_id);
  insert into public.idempotency_keys values (v_reserve.tenant_id, v_reserve.mall_id, 'voucher:issue', p_idempotency_key, p_request_hash, v_batch_id, v_response, v_now, v_now + interval '24 hours');
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json, membership_id, granted_via, created_at
  ) values (
    gen_random_uuid()::text, v_reserve.tenant_id, v_reserve.enterprise_id, v_reserve.mall_id, p_operator_user_id, 'admin', 'voucher.batch.issued',
    'voucher_issue_batch', v_batch_id, p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('batchNo', v_batch_no, 'reserveRequestId', v_reserve.id, 'quantity', v_reserve.requested_quantity, 'valueCents', v_reserve.requested_value_cents),
    p_membership_id, p_granted_via, v_now
  );
  return v_response;
end;
$$;

create or replace function public.api_change_voucher_status_authorized(
  p_membership_id text,
  p_operator_user_id text,
  p_voucher_id text,
  p_operation text,
  p_extension_days integer,
  p_expected_version bigint,
  p_reason text,
  p_evidence text,
  p_idempotency_key text,
  p_request_hash text,
  p_request_id text,
  p_user_agent text,
  p_granted_via jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.idempotency_keys%rowtype;
  v_voucher public.vouchers%rowtype;
  v_before_status text;
  v_after_status text;
  v_before_expires_at timestamptz;
  v_after_expires_at timestamptz;
  v_void_hold_id text;
  v_now timestamptz := clock_timestamp();
  v_response jsonb;
begin
  if p_operation not in ('activate', 'disable', 'extend', 'void') or char_length(trim(p_reason)) not between 1 and 500
     or char_length(trim(coalesce(p_idempotency_key, ''))) not between 1 and 120 or char_length(trim(coalesce(p_request_hash, ''))) = 0 then
    raise exception 'INVALID_VOUCHER_STATUS_INPUT';
  end if;
  if not public.api_voucher_membership_actor_matches(p_membership_id, p_operator_user_id) then raise exception 'VOUCHER_OPERATOR_NOT_AUTHORIZED'; end if;
  select * into v_voucher from public.vouchers where id = p_voucher_id for update;
  if not found or not public.api_voucher_membership_scope_allows(p_membership_id, v_voucher.tenant_id, v_voucher.enterprise_id, v_voucher.mall_id) then raise exception 'VOUCHER_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_voucher.mall_id || ':voucher:status:' || p_idempotency_key));
  select * into v_existing from public.idempotency_keys
    where mall_id = v_voucher.mall_id and scope = 'voucher:status' and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;
  if v_voucher.status in ('inactive', 'active', 'disabled') and v_voucher.expires_at <= v_now then raise exception 'VOUCHER_EXPIRED'; end if;
  if v_voucher.version <> p_expected_version then raise exception 'VOUCHER_VERSION_CONFLICT'; end if;
  v_before_status := v_voucher.status;
  v_before_expires_at := v_voucher.expires_at;
  v_after_status := v_before_status;
  v_after_expires_at := v_before_expires_at;
  if p_operation = 'activate' then
    if v_before_status not in ('inactive', 'disabled') or v_before_expires_at <= v_now then raise exception 'VOUCHER_NOT_ACTIVATABLE'; end if;
    v_after_status := 'active';
  elsif p_operation = 'disable' then
    if v_before_status <> 'active' then raise exception 'VOUCHER_NOT_DISABLEABLE'; end if;
    v_after_status := 'disabled';
  elsif p_operation = 'extend' then
    if v_before_status not in ('inactive', 'active', 'disabled') or p_extension_days not between 1 and 3650 then raise exception 'VOUCHER_NOT_EXTENDABLE'; end if;
    v_after_expires_at := v_before_expires_at + make_interval(days => p_extension_days);
  elsif p_operation = 'void' then
    if v_before_status not in ('inactive', 'active', 'disabled') or v_voucher.remaining_cents = 0 then raise exception 'VOUCHER_NOT_VOIDABLE'; end if;
    v_after_status := 'void';
  end if;
  update public.vouchers set status = v_after_status, expires_at = v_after_expires_at,
    activated_at = case when p_operation = 'activate' then v_now else activated_at end,
    voided_at = case when p_operation = 'void' then v_now else voided_at end,
    version = version + 1, updated_at = v_now where id = v_voucher.id;
  if p_operation = 'void' then
    v_void_hold_id := gen_random_uuid()::text;
    insert into public.voucher_void_balance_holds (
      id, voucher_id, tenant_id, enterprise_id, mall_id, amount_cents, status, void_reason,
      voided_by_user_id, voided_by_membership_id, void_granted_via, void_request_id, created_at
    ) values (
      v_void_hold_id, v_voucher.id, v_voucher.tenant_id, v_voucher.enterprise_id, v_voucher.mall_id, v_voucher.remaining_cents, 'open', trim(p_reason),
      p_operator_user_id, p_membership_id, p_granted_via, p_request_id, v_now
    );
  end if;
  insert into public.voucher_status_events (
    id, voucher_id, tenant_id, enterprise_id, mall_id, operation, status_before, status_after,
    expires_at_before, expires_at_after, reason, evidence, actor_user_id, actor_membership_id, granted_via, request_id, created_at
  ) values (
    gen_random_uuid()::text, v_voucher.id, v_voucher.tenant_id, v_voucher.enterprise_id, v_voucher.mall_id, p_operation, v_before_status, v_after_status,
    v_before_expires_at, v_after_expires_at, trim(p_reason), nullif(trim(coalesce(p_evidence, '')), ''), p_operator_user_id, p_membership_id, p_granted_via, p_request_id, v_now
  );
  v_response := jsonb_build_object('voucher', jsonb_build_object('id', v_voucher.id, 'status', v_after_status, 'expiresAt', v_after_expires_at, 'version', v_voucher.version + 1), 'voidBalanceHoldId', v_void_hold_id, 'requestId', p_request_id);
  insert into public.idempotency_keys values (v_voucher.tenant_id, v_voucher.mall_id, 'voucher:status', p_idempotency_key, p_request_hash, v_voucher.id, v_response, v_now, v_now + interval '24 hours');
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, before_json, after_json, membership_id, granted_via, created_at
  ) values (
    gen_random_uuid()::text, v_voucher.tenant_id, v_voucher.enterprise_id, v_voucher.mall_id, p_operator_user_id, 'admin', 'voucher.status.' || p_operation,
    'voucher', v_voucher.id, p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('status', v_before_status, 'expiresAt', v_before_expires_at, 'version', v_voucher.version),
    jsonb_build_object('status', v_after_status, 'expiresAt', v_after_expires_at, 'version', v_voucher.version + 1, 'reason', trim(p_reason), 'voidBalanceHoldId', v_void_hold_id),
    p_membership_id, p_granted_via, v_now
  );
  return v_response;
end;
$$;

create or replace function public.api_redeem_voucher_authorized(
  p_membership_id text,
  p_operator_user_id text,
  p_voucher_id text,
  p_amount_cents bigint,
  p_merchant_reference text,
  p_idempotency_key text,
  p_request_hash text,
  p_request_id text,
  p_user_agent text,
  p_granted_via jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.idempotency_keys%rowtype;
  v_voucher public.vouchers%rowtype;
  v_redemption_id text := gen_random_uuid()::text;
  v_redemption_no text := 'VX' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_after_cents bigint;
  v_after_status text;
  v_now timestamptz := clock_timestamp();
  v_response jsonb;
begin
  if p_amount_cents <= 0 or char_length(trim(coalesce(p_merchant_reference, ''))) not between 1 and 160
     or char_length(trim(coalesce(p_idempotency_key, ''))) not between 1 and 120 or char_length(trim(coalesce(p_request_hash, ''))) = 0 then
    raise exception 'INVALID_VOUCHER_REDEMPTION_INPUT';
  end if;
  if not public.api_voucher_membership_actor_matches(p_membership_id, p_operator_user_id) then raise exception 'VOUCHER_OPERATOR_NOT_AUTHORIZED'; end if;
  select * into v_voucher from public.vouchers where id = p_voucher_id for update;
  if not found or not public.api_voucher_membership_scope_allows(p_membership_id, v_voucher.tenant_id, v_voucher.enterprise_id, v_voucher.mall_id) then raise exception 'VOUCHER_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_voucher.mall_id || ':voucher:redeem:' || p_idempotency_key));
  select * into v_existing from public.idempotency_keys
    where mall_id = v_voucher.mall_id and scope = 'voucher:redeem' and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;
  if v_voucher.status <> 'active' then raise exception 'VOUCHER_NOT_REDEEMABLE'; end if;
  if v_voucher.expires_at <= v_now then raise exception 'VOUCHER_EXPIRED'; end if;
  if v_voucher.remaining_cents < p_amount_cents then raise exception 'VOUCHER_INSUFFICIENT_BALANCE'; end if;
  if exists (select 1 from public.voucher_redemptions where voucher_id = v_voucher.id and merchant_reference = trim(p_merchant_reference)) then
    raise exception 'VOUCHER_MERCHANT_REFERENCE_DUPLICATE';
  end if;
  v_after_cents := v_voucher.remaining_cents - p_amount_cents;
  v_after_status := case when v_after_cents = 0 then 'redeemed' else 'active' end;
  update public.vouchers set remaining_cents = v_after_cents, status = v_after_status,
    redeemed_at = case when v_after_status = 'redeemed' then v_now else redeemed_at end,
    version = version + 1, updated_at = v_now where id = v_voucher.id;
  insert into public.voucher_redemptions (
    id, redemption_no, tenant_id, enterprise_id, mall_id, voucher_id, amount_cents,
    remaining_before_cents, remaining_after_cents, merchant_reference, operator_user_id, operator_membership_id,
    granted_via, idempotency_key, request_hash, request_id, created_at
  ) values (
    v_redemption_id, v_redemption_no, v_voucher.tenant_id, v_voucher.enterprise_id, v_voucher.mall_id, v_voucher.id, p_amount_cents,
    v_voucher.remaining_cents, v_after_cents, nullif(trim(coalesce(p_merchant_reference, '')), ''), p_operator_user_id, p_membership_id,
    p_granted_via, p_idempotency_key, p_request_hash, p_request_id, v_now
  );
  insert into public.voucher_status_events (
    id, voucher_id, tenant_id, enterprise_id, mall_id, operation, status_before, status_after,
    expires_at_before, expires_at_after, reason, actor_user_id, actor_membership_id, granted_via, request_id, created_at
  ) values (
    gen_random_uuid()::text, v_voucher.id, v_voucher.tenant_id, v_voucher.enterprise_id, v_voucher.mall_id, 'redeem', v_voucher.status, v_after_status,
    v_voucher.expires_at, v_voucher.expires_at, 'store redemption ' || v_redemption_no, p_operator_user_id, p_membership_id, p_granted_via, p_request_id, v_now
  );
  v_response := jsonb_build_object('redemption', jsonb_build_object('id', v_redemption_id, 'redemptionNo', v_redemption_no, 'voucherId', v_voucher.id, 'amountCents', p_amount_cents, 'remainingCents', v_after_cents, 'voucherStatus', v_after_status, 'createdAt', v_now), 'requestId', p_request_id);
  insert into public.idempotency_keys values (v_voucher.tenant_id, v_voucher.mall_id, 'voucher:redeem', p_idempotency_key, p_request_hash, v_redemption_id, v_response, v_now, v_now + interval '24 hours');
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, before_json, after_json, membership_id, granted_via, created_at
  ) values (
    gen_random_uuid()::text, v_voucher.tenant_id, v_voucher.enterprise_id, v_voucher.mall_id, p_operator_user_id, 'admin', 'voucher.redeemed',
    'voucher_redemption', v_redemption_id, p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('voucherId', v_voucher.id, 'remainingCents', v_voucher.remaining_cents, 'status', v_voucher.status),
    jsonb_build_object('amountCents', p_amount_cents, 'remainingCents', v_after_cents, 'status', v_after_status, 'redemptionNo', v_redemption_no),
    p_membership_id, p_granted_via, v_now
  );
  return v_response;
end;
$$;

create or replace function public.api_reverse_voucher_redemption_authorized(
  p_membership_id text,
  p_operator_user_id text,
  p_redemption_id text,
  p_reason text,
  p_idempotency_key text,
  p_request_hash text,
  p_request_id text,
  p_user_agent text,
  p_granted_via jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.idempotency_keys%rowtype;
  v_redemption public.voucher_redemptions%rowtype;
  v_voucher public.vouchers%rowtype;
  v_reversal_id text := gen_random_uuid()::text;
  v_reversal_no text := 'VRV' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_after_cents bigint;
  v_now timestamptz := clock_timestamp();
  v_response jsonb;
begin
  if char_length(trim(p_reason)) not between 1 and 500
     or char_length(trim(coalesce(p_idempotency_key, ''))) not between 1 and 120 or char_length(trim(coalesce(p_request_hash, ''))) = 0 then
    raise exception 'INVALID_VOUCHER_REVERSAL_INPUT';
  end if;
  if not public.api_voucher_membership_actor_matches(p_membership_id, p_operator_user_id) then raise exception 'VOUCHER_OPERATOR_NOT_AUTHORIZED'; end if;
  select * into v_redemption from public.voucher_redemptions where id = p_redemption_id for update;
  if not found or not public.api_voucher_membership_scope_allows(p_membership_id, v_redemption.tenant_id, v_redemption.enterprise_id, v_redemption.mall_id) then raise exception 'VOUCHER_REDEMPTION_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_redemption.mall_id || ':voucher:redemption:reverse:' || p_idempotency_key));
  select * into v_existing from public.idempotency_keys
    where mall_id = v_redemption.mall_id and scope = 'voucher:redemption:reverse' and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;
  if exists (select 1 from public.voucher_redemption_reversals where redemption_id = v_redemption.id) then raise exception 'VOUCHER_REDEMPTION_ALREADY_REVERSED'; end if;
  select * into v_voucher from public.vouchers where id = v_redemption.voucher_id for update;
  if not found or v_voucher.status in ('expired', 'void', 'disabled') or v_voucher.expires_at <= v_now then raise exception 'VOUCHER_REDEMPTION_NOT_REVERSIBLE'; end if;
  v_after_cents := v_voucher.remaining_cents + v_redemption.amount_cents;
  if v_after_cents > v_voucher.initial_cents then raise exception 'VOUCHER_REVERSAL_BALANCE_CONFLICT'; end if;
  update public.vouchers set remaining_cents = v_after_cents, status = 'active', redeemed_at = null, version = version + 1, updated_at = v_now where id = v_voucher.id;
  insert into public.voucher_redemption_reversals (
    id, reversal_no, redemption_id, tenant_id, enterprise_id, mall_id, amount_cents,
    status, reason, requested_by_user_id, approved_by_user_id, approved_by_membership_id, granted_via, request_id, created_at, resolved_at
  ) values (
    v_reversal_id, v_reversal_no, v_redemption.id, v_redemption.tenant_id, v_redemption.enterprise_id, v_redemption.mall_id, v_redemption.amount_cents,
    'reversed', trim(p_reason), p_operator_user_id, p_operator_user_id, p_membership_id, p_granted_via, p_request_id, v_now, v_now
  );
  insert into public.voucher_status_events (
    id, voucher_id, tenant_id, enterprise_id, mall_id, operation, status_before, status_after,
    expires_at_before, expires_at_after, reason, actor_user_id, actor_membership_id, granted_via, request_id, created_at
  ) values (
    gen_random_uuid()::text, v_voucher.id, v_voucher.tenant_id, v_voucher.enterprise_id, v_voucher.mall_id, 'reverse_redemption', v_voucher.status, 'active',
    v_voucher.expires_at, v_voucher.expires_at, trim(p_reason), p_operator_user_id, p_membership_id, p_granted_via, p_request_id, v_now
  );
  v_response := jsonb_build_object('reversal', jsonb_build_object('id', v_reversal_id, 'reversalNo', v_reversal_no, 'redemptionId', v_redemption.id, 'amountCents', v_redemption.amount_cents, 'remainingCents', v_after_cents, 'status', 'reversed'), 'requestId', p_request_id);
  insert into public.idempotency_keys values (v_redemption.tenant_id, v_redemption.mall_id, 'voucher:redemption:reverse', p_idempotency_key, p_request_hash, v_reversal_id, v_response, v_now, v_now + interval '24 hours');
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, before_json, after_json, membership_id, granted_via, created_at
  ) values (
    gen_random_uuid()::text, v_redemption.tenant_id, v_redemption.enterprise_id, v_redemption.mall_id, p_operator_user_id, 'admin', 'voucher.redemption.reversed',
    'voucher_redemption', v_redemption.id, p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('remainingCents', v_voucher.remaining_cents, 'redemptionNo', v_redemption.redemption_no),
    jsonb_build_object('remainingCents', v_after_cents, 'reversalNo', v_reversal_no, 'reason', trim(p_reason)),
    p_membership_id, p_granted_via, v_now
  );
  return v_response;
end;
$$;

create or replace function public.api_reconcile_voucher_void_hold_authorized(
  p_membership_id text,
  p_operator_user_id text,
  p_void_hold_id text,
  p_reconciliation_reference text,
  p_reconciliation_note text,
  p_idempotency_key text,
  p_request_hash text,
  p_request_id text,
  p_user_agent text,
  p_granted_via jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.idempotency_keys%rowtype;
  v_hold public.voucher_void_balance_holds%rowtype;
  v_now timestamptz := clock_timestamp();
  v_response jsonb;
begin
  if char_length(trim(coalesce(p_reconciliation_reference, ''))) not between 1 and 160
     or char_length(trim(coalesce(p_reconciliation_note, ''))) not between 1 and 500
     or char_length(trim(coalesce(p_idempotency_key, ''))) not between 1 and 120
     or char_length(trim(coalesce(p_request_hash, ''))) = 0 then
    raise exception 'INVALID_VOUCHER_RECONCILIATION_INPUT';
  end if;
  if not public.api_voucher_membership_actor_matches(p_membership_id, p_operator_user_id) then raise exception 'VOUCHER_OPERATOR_NOT_AUTHORIZED'; end if;
  select * into v_hold from public.voucher_void_balance_holds where id = p_void_hold_id for update;
  if not found or not public.api_voucher_membership_scope_allows(p_membership_id, v_hold.tenant_id, v_hold.enterprise_id, v_hold.mall_id) then raise exception 'VOUCHER_VOID_HOLD_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_hold.mall_id || ':voucher:void:reconcile:' || p_idempotency_key));
  select * into v_existing from public.idempotency_keys
    where mall_id = v_hold.mall_id and scope = 'voucher:void:reconcile' and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;
  if v_hold.status <> 'open' then raise exception 'VOUCHER_VOID_HOLD_NOT_OPEN'; end if;
  if exists (select 1 from public.voucher_void_balance_holds where mall_id = v_hold.mall_id and reconciliation_reference = trim(p_reconciliation_reference) and id <> v_hold.id) then
    raise exception 'VOUCHER_RECONCILIATION_REFERENCE_DUPLICATE';
  end if;
  update public.voucher_void_balance_holds
    set status = 'reconciled', reconciliation_reference = trim(p_reconciliation_reference), reconciliation_note = trim(p_reconciliation_note),
        reconciled_by_user_id = p_operator_user_id, reconciled_by_membership_id = p_membership_id,
        reconciliation_granted_via = p_granted_via, reconciliation_request_id = p_request_id, reconciled_at = v_now
    where id = v_hold.id;
  v_response := jsonb_build_object('voidBalanceHold', jsonb_build_object('id', v_hold.id, 'voucherId', v_hold.voucher_id, 'amountCents', v_hold.amount_cents, 'status', 'reconciled', 'reconciliationReference', trim(p_reconciliation_reference), 'reconciledAt', v_now), 'requestId', p_request_id);
  insert into public.idempotency_keys values (v_hold.tenant_id, v_hold.mall_id, 'voucher:void:reconcile', p_idempotency_key, p_request_hash, v_hold.id, v_response, v_now, v_now + interval '24 hours');
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, before_json, after_json, membership_id, granted_via, created_at
  ) values (
    gen_random_uuid()::text, v_hold.tenant_id, v_hold.enterprise_id, v_hold.mall_id, p_operator_user_id, 'admin', 'voucher.void_balance.reconciled',
    'voucher_void_balance_hold', v_hold.id, p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('status', 'open', 'amountCents', v_hold.amount_cents),
    jsonb_build_object('status', 'reconciled', 'amountCents', v_hold.amount_cents, 'reconciliationReference', trim(p_reconciliation_reference), 'reconciliationNote', trim(p_reconciliation_note)),
    p_membership_id, p_granted_via, v_now
  );
  return v_response;
end;
$$;

revoke all on function public.api_voucher_program_authorization_scope(text) from public, anon, authenticated;
revoke all on function public.api_voucher_reserve_authorization_scope(text) from public, anon, authenticated;
revoke all on function public.api_voucher_redemption_authorization_scope(text) from public, anon, authenticated;
revoke all on function public.api_voucher_code_authorization_scope(text) from public, anon, authenticated;
revoke all on function public.api_voucher_void_hold_authorization_scope(text) from public, anon, authenticated;
revoke all on function public.api_create_voucher_reserve_authorized(text, text, text, integer, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.api_decide_voucher_reserve_authorized(text, text, text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.api_issue_voucher_batch_authorized(text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.api_change_voucher_status_authorized(text, text, text, text, integer, bigint, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.api_redeem_voucher_authorized(text, text, text, bigint, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.api_reverse_voucher_redemption_authorized(text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.api_reconcile_voucher_void_hold_authorized(text, text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.api_voucher_program_authorization_scope(text) to service_role;
grant execute on function public.api_voucher_reserve_authorization_scope(text) to service_role;
grant execute on function public.api_voucher_redemption_authorization_scope(text) to service_role;
grant execute on function public.api_voucher_code_authorization_scope(text) to service_role;
grant execute on function public.api_voucher_void_hold_authorization_scope(text) to service_role;
grant execute on function public.api_create_voucher_reserve_authorized(text, text, text, integer, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.api_decide_voucher_reserve_authorized(text, text, text, text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.api_issue_voucher_batch_authorized(text, text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.api_change_voucher_status_authorized(text, text, text, text, integer, bigint, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.api_redeem_voucher_authorized(text, text, text, bigint, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.api_reverse_voucher_redemption_authorized(text, text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.api_reconcile_voucher_void_hold_authorized(text, text, text, text, text, text, text, text, text, jsonb) to service_role;
