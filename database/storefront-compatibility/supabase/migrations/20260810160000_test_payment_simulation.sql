-- TEST-ONLY payment simulation.  It never talks to an external payment provider.
-- Every persisted record carries test_simulation=true so it can be purged before
-- a production cut-over without being confused with a real money movement.

create table if not exists public.payment_simulations (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  enterprise_id text not null references public.enterprises(id),
  mall_id text not null references public.malls(id),
  user_id text not null references public.users(id),
  order_id text references public.orders(id),
  operation text not null check (operation in ('recharge', 'benefit_issue', 'mixed_payment')),
  channel text not null check (channel in ('wechat_mock', 'alipay_mock', 'unionpay_mock', 'bank_mock', 'voucher_mock', 'points_mock')),
  amount_cents bigint not null check (amount_cents > 0),
  status text not null check (status in ('succeeded', 'failed')),
  provider_trade_no text not null unique,
  idempotency_key text not null,
  test_simulation boolean not null default true check (test_simulation),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (mall_id, operation, idempotency_key)
);

create table if not exists public.test_points_wallets (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  enterprise_id text not null references public.enterprises(id),
  mall_id text not null references public.malls(id),
  user_id text not null references public.users(id),
  balance_points bigint not null default 0 check (balance_points >= 0),
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (mall_id, user_id)
);

create table if not exists public.test_point_ledgers (
  id text primary key,
  wallet_id text not null references public.test_points_wallets(id),
  user_id text not null references public.users(id),
  direction text not null check (direction in ('credit', 'debit')),
  points bigint not null check (points > 0),
  balance_after_points bigint not null check (balance_after_points >= 0),
  business_type text not null,
  business_id text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (wallet_id, idempotency_key)
);

create table if not exists public.test_vouchers (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  enterprise_id text not null references public.enterprises(id),
  mall_id text not null references public.malls(id),
  user_id text not null references public.users(id),
  voucher_code text not null unique,
  initial_cents bigint not null check (initial_cents > 0),
  remaining_cents bigint not null check (remaining_cents >= 0 and remaining_cents <= initial_cents),
  status text not null default 'active' check (status in ('active', 'used', 'expired', 'void')),
  expires_at timestamptz not null,
  test_simulation boolean not null default true check (test_simulation),
  issued_by_user_id text references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_simulations_owner on public.payment_simulations (tenant_id, mall_id, user_id, created_at desc);
create index if not exists idx_test_vouchers_owner on public.test_vouchers (tenant_id, mall_id, user_id, status, expires_at);

do $$
declare table_name text;
begin
  foreach table_name in array array['payment_simulations','test_points_wallets','test_point_ledgers','test_vouchers']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
  end loop;
end $$;

-- Complete the test roster: 5 storefront employees and 5 admin operators.
insert into public.users (id, tenant_id, enterprise_id, department_id, employee_no, display_name, email, identity_subject, status) values
  ('user-sim-employee-02', 'tenant-smart-wing', 'enterprise-demo', 'department-digital', 'SW_SIM_E02', '员工测试02', 'employee02.test@example.invalid', 'test:employee02', 'active'),
  ('user-sim-employee-03', 'tenant-smart-wing', 'enterprise-demo', 'department-digital', 'SW_SIM_E03', '员工测试03', 'employee03.test@example.invalid', 'test:employee03', 'active'),
  ('user-sim-employee-04', 'tenant-smart-wing', 'enterprise-demo', 'department-digital', 'SW_SIM_E04', '员工测试04', 'employee04.test@example.invalid', 'test:employee04', 'active'),
  ('user-sim-employee-05', 'tenant-smart-wing', 'enterprise-demo', 'department-digital', 'SW_SIM_E05', '员工测试05', 'employee05.test@example.invalid', 'test:employee05', 'active'),
  ('user-sim-admin-04', 'tenant-smart-wing', 'enterprise-demo', 'department-digital', 'SW_SIM_A04', '管理员测试04', 'admin04.test@example.invalid', 'test:admin04', 'active'),
  ('user-sim-admin-05', 'tenant-smart-wing', 'enterprise-demo', 'department-digital', 'SW_SIM_A05', '管理员测试05', 'admin05.test@example.invalid', 'test:admin05', 'active')
on conflict (id) do update set display_name = excluded.display_name, email = excluded.email, status = 'active', updated_at = now();

insert into public.members (id, user_id, primary_identifier, status) values
  ('member-sim-employee-02', 'user-sim-employee-02', 'test:employee02', 'active'),
  ('member-sim-employee-03', 'user-sim-employee-03', 'test:employee03', 'active'),
  ('member-sim-employee-04', 'user-sim-employee-04', 'test:employee04', 'active'),
  ('member-sim-employee-05', 'user-sim-employee-05', 'test:employee05', 'active'),
  ('member-sim-admin-04', 'user-sim-admin-04', 'test:admin04', 'active'),
  ('member-sim-admin-05', 'user-sim-admin-05', 'test:admin05', 'active')
on conflict (id) do update set user_id = excluded.user_id, primary_identifier = excluded.primary_identifier, status = 'active', updated_at = now();

insert into public.memberships (id, member_id, context_user_id, tenant_id, enterprise_id, mall_id, target, status) values
  ('membership-sim-employee-02', 'member-sim-employee-02', 'user-sim-employee-02', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', 'storefront', 'active'),
  ('membership-sim-employee-03', 'member-sim-employee-03', 'user-sim-employee-03', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', 'storefront', 'active'),
  ('membership-sim-employee-04', 'member-sim-employee-04', 'user-sim-employee-04', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', 'storefront', 'active'),
  ('membership-sim-employee-05', 'member-sim-employee-05', 'user-sim-employee-05', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', 'storefront', 'active'),
  ('membership-sim-admin-04', 'member-sim-admin-04', 'user-sim-admin-04', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', 'admin', 'active'),
  ('membership-sim-admin-05', 'member-sim-admin-05', 'user-sim-admin-05', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', 'admin', 'active')
on conflict (id) do update set status = 'active', updated_at = now();

insert into public.membership_roles (membership_id, role_id) values
  ('membership-sim-employee-02', 'role-employee'), ('membership-sim-employee-03', 'role-employee'),
  ('membership-sim-employee-04', 'role-employee'), ('membership-sim-employee-05', 'role-employee'),
  ('membership-sim-admin-04', 'role-mall-admin'), ('membership-sim-admin-05', 'role-enterprise-manager-v2')
on conflict (membership_id, role_id) do update set revoked_at = null, expires_at = null;

insert into public.membership_scopes (membership_id, scope_kind, resource_id) values
  ('membership-sim-employee-02', 'self', 'user-sim-employee-02'),
  ('membership-sim-employee-03', 'self', 'user-sim-employee-03'),
  ('membership-sim-employee-04', 'self', 'user-sim-employee-04'),
  ('membership-sim-employee-05', 'self', 'user-sim-employee-05'),
  ('membership-sim-admin-04', 'mall', 'mall-demo'),
  ('membership-sim-admin-05', 'enterprise', 'enterprise-demo'),
  ('membership-sim-admin-05', 'mall', 'mall-demo')
on conflict do nothing;

insert into public.member_login_aliases (provider, subject, member_id) values
  ('test', '员工测试02', 'member-sim-employee-02'), ('test', '员工测试03', 'member-sim-employee-03'),
  ('test', '员工测试04', 'member-sim-employee-04'), ('test', '员工测试05', 'member-sim-employee-05'),
  ('test', '管理员测试04', 'member-sim-admin-04'), ('test', '管理员测试05', 'member-sim-admin-05')
on conflict (provider, subject) do update set member_id = excluded.member_id;

-- The employee roster includes the existing 业主测试员 plus the four new accounts.
insert into public.welfare_accounts (id, tenant_id, enterprise_id, mall_id, user_id, account_type, balance_cents, status)
select 'acct-' || u.id || '-' || account_type, 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', u.id, account_type, 0, 'active'
from public.users u cross join (values ('welfare'::text), ('meal'::text)) x(account_type)
where u.id in ('user-test-storefront', 'user-sim-employee-02', 'user-sim-employee-03', 'user-sim-employee-04', 'user-sim-employee-05')
on conflict (mall_id, user_id, account_type) do update set status = 'active';

insert into public.test_points_wallets (id, tenant_id, enterprise_id, mall_id, user_id)
select 'points-' || u.id, 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', u.id
from public.users u
where u.id in ('user-test-storefront', 'user-sim-employee-02', 'user-sim-employee-03', 'user-sim-employee-04', 'user-sim-employee-05')
on conflict (mall_id, user_id) do nothing;

create or replace function public.api_simulation_wallet(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text
)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'testSimulation', true,
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'type', a.account_type, 'balanceCents', a.balance_cents) order by a.account_type)
      from public.welfare_accounts a where a.tenant_id = p_tenant_id and a.enterprise_id = p_enterprise_id and a.mall_id = p_mall_id and a.user_id = p_user_id), '[]'::jsonb),
    'points', coalesce((select w.balance_points from public.test_points_wallets w where w.tenant_id = p_tenant_id and w.enterprise_id = p_enterprise_id and w.mall_id = p_mall_id and w.user_id = p_user_id), 0),
    'vouchers', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'code', v.voucher_code, 'remainingCents', v.remaining_cents, 'status', v.status, 'expiresAt', v.expires_at) order by v.created_at desc)
      from public.test_vouchers v where v.tenant_id = p_tenant_id and v.enterprise_id = p_enterprise_id and v.mall_id = p_mall_id and v.user_id = p_user_id and v.status = 'active' and v.expires_at > now()), '[]'::jsonb),
    'recentSimulations', coalesce((select jsonb_agg(jsonb_build_object('operation', s.operation, 'channel', s.channel, 'amountCents', s.amount_cents, 'status', s.status, 'createdAt', s.created_at) order by s.created_at desc)
      from (select * from public.payment_simulations where tenant_id = p_tenant_id and mall_id = p_mall_id and user_id = p_user_id order by created_at desc limit 20) s), '[]'::jsonb)
  );
$$;

create or replace function public.api_simulate_recharge(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_account_type text, p_channel text, p_amount_cents bigint, p_idempotency_key text,
  p_request_hash text, p_request_id text, p_user_agent text, p_membership_id text, p_granted_via jsonb
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_existing public.idempotency_keys%rowtype; v_account public.welfare_accounts%rowtype; v_now timestamptz := clock_timestamp(); v_trade text; v_response jsonb;
begin
  if p_account_type not in ('welfare', 'meal') or p_channel not in ('wechat_mock','alipay_mock','unionpay_mock','bank_mock') or p_amount_cents <= 0 or p_amount_cents > 100000000 then raise exception 'INVALID_SIMULATION_RECHARGE'; end if;
  select * into v_existing from public.idempotency_keys where mall_id = p_mall_id and scope = 'simulation:recharge' and idempotency_key = p_idempotency_key and expires_at > now();
  if found then if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return v_existing.response_json; end if;
  select * into v_account from public.welfare_accounts where tenant_id = p_tenant_id and enterprise_id = p_enterprise_id and mall_id = p_mall_id and user_id = p_user_id and account_type = p_account_type for update;
  if not found or v_account.status <> 'active' then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  update public.welfare_accounts set balance_cents = balance_cents + p_amount_cents, version = version + 1, updated_at = v_now where id = v_account.id;
  v_trade := 'SIMR' || to_char(v_now, 'YYYYMMDDHH24MISSMS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.account_ledgers (id, tenant_id, mall_id, account_id, user_id, direction, amount_cents, balance_after_cents, business_type, business_id, idempotency_key, created_at)
    select gen_random_uuid()::text, p_tenant_id, p_mall_id, id, p_user_id, 'credit', p_amount_cents, balance_cents, 'simulation_recharge', v_trade, p_idempotency_key, v_now from public.welfare_accounts where id = v_account.id;
  insert into public.payment_simulations (id, tenant_id, enterprise_id, mall_id, user_id, operation, channel, amount_cents, status, provider_trade_no, idempotency_key, metadata, created_at)
    values (gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, 'recharge', p_channel, p_amount_cents, 'succeeded', v_trade, p_idempotency_key, jsonb_build_object('accountType', p_account_type, 'membershipId', p_membership_id), v_now);
  v_response := jsonb_build_object('testSimulation', true, 'operation', 'recharge', 'channel', p_channel, 'accountType', p_account_type, 'amountCents', p_amount_cents, 'providerTradeNo', v_trade, 'status', 'succeeded');
  insert into public.idempotency_keys values (p_tenant_id, p_mall_id, 'simulation:recharge', p_idempotency_key, p_request_hash, v_trade, v_response, v_now, v_now + interval '24 hours');
  insert into public.audit_logs (id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action, resource_type, resource_id, request_id, user_agent, after_json, created_at)
    values (gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, 'user', 'simulation.recharge.succeeded', 'payment_simulation', v_trade, p_request_id, left(coalesce(p_user_agent,''), 300), jsonb_build_object('testSimulation', true, 'channel', p_channel, 'amountCents', p_amount_cents, 'authorization', p_granted_via), v_now);
  return v_response;
end;
$$;

create or replace function public.api_simulate_issue_benefit(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_operator_user_id text, p_target_user_id text,
  p_instrument_type text, p_amount bigint, p_idempotency_key text, p_request_hash text, p_request_id text, p_user_agent text,
  p_membership_id text, p_granted_via jsonb
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_existing public.idempotency_keys%rowtype; v_now timestamptz := clock_timestamp(); v_trade text; v_voucher_id text; v_wallet public.test_points_wallets%rowtype; v_response jsonb;
begin
  if p_instrument_type not in ('voucher','points') or p_amount <= 0 or p_amount > 100000000 then raise exception 'INVALID_SIMULATION_BENEFIT'; end if;
  if not exists (select 1 from public.users where id = p_target_user_id and tenant_id = p_tenant_id and enterprise_id = p_enterprise_id and status = 'active') then raise exception 'SIMULATION_TARGET_NOT_FOUND'; end if;
  select * into v_existing from public.idempotency_keys where mall_id = p_mall_id and scope = 'simulation:benefit' and idempotency_key = p_idempotency_key and expires_at > now();
  if found then if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return v_existing.response_json; end if;
  v_trade := 'SIMB' || to_char(v_now, 'YYYYMMDDHH24MISSMS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  if p_instrument_type = 'voucher' then
    v_voucher_id := gen_random_uuid()::text;
    insert into public.test_vouchers (id, tenant_id, enterprise_id, mall_id, user_id, voucher_code, initial_cents, remaining_cents, expires_at, issued_by_user_id)
      values (v_voucher_id, p_tenant_id, p_enterprise_id, p_mall_id, p_target_user_id, 'SIM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), p_amount, p_amount, v_now + interval '90 days', p_operator_user_id);
  else
    select * into v_wallet from public.test_points_wallets where tenant_id = p_tenant_id and enterprise_id = p_enterprise_id and mall_id = p_mall_id and user_id = p_target_user_id for update;
    if not found then
      insert into public.test_points_wallets (id, tenant_id, enterprise_id, mall_id, user_id, balance_points) values (gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_target_user_id, 0) returning * into v_wallet;
    end if;
    update public.test_points_wallets set balance_points = balance_points + p_amount, version = version + 1, updated_at = v_now where id = v_wallet.id;
    insert into public.test_point_ledgers (id, wallet_id, user_id, direction, points, balance_after_points, business_type, business_id, idempotency_key, created_at)
      select gen_random_uuid()::text, id, p_target_user_id, 'credit', p_amount, balance_points, 'simulation_benefit_issue', v_trade, p_idempotency_key, v_now from public.test_points_wallets where id = v_wallet.id;
  end if;
  insert into public.payment_simulations (id, tenant_id, enterprise_id, mall_id, user_id, operation, channel, amount_cents, status, provider_trade_no, idempotency_key, metadata, created_at)
    values (gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_target_user_id, 'benefit_issue', case when p_instrument_type = 'voucher' then 'voucher_mock' else 'points_mock' end, p_amount, 'succeeded', v_trade, p_idempotency_key, jsonb_build_object('instrumentType', p_instrument_type, 'issuedBy', p_operator_user_id, 'membershipId', p_membership_id), v_now);
  v_response := jsonb_build_object('testSimulation', true, 'operation', 'benefit_issue', 'instrumentType', p_instrument_type, 'amount', p_amount, 'providerTradeNo', v_trade, 'voucherId', v_voucher_id, 'status', 'succeeded');
  insert into public.idempotency_keys values (p_tenant_id, p_mall_id, 'simulation:benefit', p_idempotency_key, p_request_hash, v_trade, v_response, v_now, v_now + interval '24 hours');
  insert into public.audit_logs (id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action, resource_type, resource_id, request_id, user_agent, after_json, created_at)
    values (gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_operator_user_id, 'admin', 'simulation.benefit.issue', 'payment_simulation', v_trade, p_request_id, left(coalesce(p_user_agent,''), 300), jsonb_build_object('testSimulation', true, 'targetUserId', p_target_user_id, 'instrumentType', p_instrument_type, 'amount', p_amount, 'authorization', p_granted_via), v_now);
  return v_response;
end;
$$;

revoke all on function public.api_simulation_wallet(text,text,text,text), public.api_simulate_recharge(text,text,text,text,text,text,bigint,text,text,text,text,text,jsonb), public.api_simulate_issue_benefit(text,text,text,text,text,text,bigint,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.api_simulation_wallet(text,text,text,text), public.api_simulate_recharge(text,text,text,text,text,text,bigint,text,text,text,text,text,jsonb), public.api_simulate_issue_benefit(text,text,text,text,text,text,bigint,text,text,text,text,text,jsonb) to service_role;

-- Vouchers and points are only accepted by the test-only mixed payment RPC
-- below. Keeping their channels explicit makes later reconciliation clear.
alter table public.payments drop constraint if exists payments_channel_check;
alter table public.payments add constraint payments_channel_check check (channel in ('welfare', 'meal', 'wechat', 'alipay', 'unionpay', 'bank', 'manual', 'voucher', 'points'));

create or replace function public.api_simulate_mixed_payment(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text, p_order_id text,
  p_welfare_cents bigint, p_meal_cents bigint, p_voucher_id text, p_voucher_cents bigint,
  p_points_cents bigint, p_external_channel text, p_external_cents bigint,
  p_idempotency_key text, p_request_hash text, p_request_id text, p_user_agent text,
  p_membership_id text, p_granted_via jsonb
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_existing public.idempotency_keys%rowtype; v_order public.orders%rowtype; v_account public.welfare_accounts%rowtype;
  v_voucher public.test_vouchers%rowtype; v_points public.test_points_wallets%rowtype; v_now timestamptz := clock_timestamp();
  v_payment_no text; v_payment_nos jsonb := '[]'::jsonb; v_response jsonb; v_changed integer; v_channel text; v_amount bigint; v_trade text;
begin
  if p_welfare_cents < 0 or p_meal_cents < 0 or p_voucher_cents < 0 or p_points_cents < 0 or p_external_cents < 0 or p_external_channel not in ('wechat_mock','alipay_mock','unionpay_mock','bank_mock') then raise exception 'INVALID_SIMULATION_PAYMENT'; end if;
  select * into v_existing from public.idempotency_keys where mall_id = p_mall_id and scope = 'simulation:mixed-payment' and idempotency_key = p_idempotency_key and expires_at > now();
  if found then if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return v_existing.response_json; end if;
  select * into v_order from public.orders where id = p_order_id and tenant_id = p_tenant_id and enterprise_id = p_enterprise_id and mall_id = p_mall_id and user_id = p_user_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'pending_payment' or v_order.paid_cents <> 0 then raise exception 'ORDER_NOT_PAYABLE'; end if;
  if p_welfare_cents + p_meal_cents + p_voucher_cents + p_points_cents + p_external_cents <> v_order.payable_cents then raise exception 'PAYMENT_TOTAL_MISMATCH'; end if;

  for v_channel, v_amount in select * from (values ('welfare'::text,p_welfare_cents),('meal'::text,p_meal_cents)) x(channel,amount) where amount > 0 loop
    select * into v_account from public.welfare_accounts where tenant_id = p_tenant_id and enterprise_id = p_enterprise_id and mall_id = p_mall_id and user_id = p_user_id and account_type = v_channel for update;
    if not found or v_account.status <> 'active' then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
    update public.welfare_accounts set balance_cents = balance_cents - v_amount, version = version + 1, updated_at = v_now where id = v_account.id and balance_cents >= v_amount;
    get diagnostics v_changed = row_count; if v_changed <> 1 then raise exception 'INSUFFICIENT_ACCOUNT_BALANCE'; end if;
    v_payment_no := 'SIMP' || to_char(v_now,'YYYYMMDDHH24MISSMS') || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    insert into public.account_ledgers (id,tenant_id,mall_id,account_id,user_id,direction,amount_cents,balance_after_cents,business_type,business_id,idempotency_key,created_at)
      select gen_random_uuid()::text,p_tenant_id,p_mall_id,id,p_user_id,'debit',v_amount,balance_cents,'simulation_order_payment',p_order_id,p_idempotency_key || ':' || v_channel,v_now from public.welfare_accounts where id=v_account.id;
    insert into public.payments (id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,amount_cents,provider_trade_no,idempotency_key,created_at,completed_at)
      values (gen_random_uuid()::text,v_payment_no,p_tenant_id,p_mall_id,p_user_id,p_order_id,v_channel,'succeeded',v_amount,'SIM-' || v_payment_no,p_idempotency_key || ':' || v_channel,v_now,v_now);
    v_payment_nos := v_payment_nos || jsonb_build_array(v_payment_no);
  end loop;
  if p_voucher_cents > 0 then
    if p_voucher_id is null then raise exception 'SIMULATION_VOUCHER_REQUIRED'; end if;
    select * into v_voucher from public.test_vouchers where id=p_voucher_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id and mall_id=p_mall_id and user_id=p_user_id and status='active' and expires_at>v_now for update;
    if not found or v_voucher.remaining_cents < p_voucher_cents then raise exception 'INSUFFICIENT_SIMULATION_VOUCHER'; end if;
    update public.test_vouchers set remaining_cents=remaining_cents-p_voucher_cents,status=case when remaining_cents-p_voucher_cents=0 then 'used' else 'active' end where id=v_voucher.id;
    v_payment_no := 'SIMP' || to_char(v_now,'YYYYMMDDHH24MISSMS') || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    insert into public.payments (id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,amount_cents,provider_trade_no,idempotency_key,created_at,completed_at) values (gen_random_uuid()::text,v_payment_no,p_tenant_id,p_mall_id,p_user_id,p_order_id,'voucher','succeeded',p_voucher_cents,'SIM-' || v_payment_no,p_idempotency_key || ':voucher',v_now,v_now);
    v_payment_nos := v_payment_nos || jsonb_build_array(v_payment_no);
  end if;
  if p_points_cents > 0 then
    select * into v_points from public.test_points_wallets where tenant_id=p_tenant_id and enterprise_id=p_enterprise_id and mall_id=p_mall_id and user_id=p_user_id for update;
    if not found or v_points.balance_points < p_points_cents then raise exception 'INSUFFICIENT_SIMULATION_POINTS'; end if;
    update public.test_points_wallets set balance_points=balance_points-p_points_cents,version=version+1,updated_at=v_now where id=v_points.id;
    insert into public.test_point_ledgers (id,wallet_id,user_id,direction,points,balance_after_points,business_type,business_id,idempotency_key,created_at) select gen_random_uuid()::text,id,p_user_id,'debit',p_points_cents,balance_points,'simulation_order_payment',p_order_id,p_idempotency_key || ':points',v_now from public.test_points_wallets where id=v_points.id;
    v_payment_no := 'SIMP' || to_char(v_now,'YYYYMMDDHH24MISSMS') || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    insert into public.payments (id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,amount_cents,provider_trade_no,idempotency_key,created_at,completed_at) values (gen_random_uuid()::text,v_payment_no,p_tenant_id,p_mall_id,p_user_id,p_order_id,'points','succeeded',p_points_cents,'SIM-' || v_payment_no,p_idempotency_key || ':points',v_now,v_now);
    v_payment_nos := v_payment_nos || jsonb_build_array(v_payment_no);
  end if;
  if p_external_cents > 0 then
    v_payment_no := 'SIMP' || to_char(v_now,'YYYYMMDDHH24MISSMS') || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    insert into public.payments (id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,amount_cents,provider_trade_no,idempotency_key,created_at,completed_at) values (gen_random_uuid()::text,v_payment_no,p_tenant_id,p_mall_id,p_user_id,p_order_id,replace(p_external_channel,'_mock',''),'succeeded',p_external_cents,'SIM-' || v_payment_no,p_idempotency_key || ':external',v_now,v_now);
    v_payment_nos := v_payment_nos || jsonb_build_array(v_payment_no);
  end if;
  update public.orders set paid_cents=payable_cents,status='paid',paid_at=v_now,updated_at=v_now where id=p_order_id;
  update public.sub_orders set status='paid',updated_at=v_now where tenant_id=p_tenant_id and mall_id=p_mall_id and parent_order_id=p_order_id;
  v_trade := 'SIMPAY' || to_char(v_now,'YYYYMMDDHH24MISSMS') || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.payment_simulations (id,tenant_id,enterprise_id,mall_id,user_id,order_id,operation,channel,amount_cents,status,provider_trade_no,idempotency_key,metadata,created_at) values (gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_user_id,p_order_id,'mixed_payment',p_external_channel,v_order.payable_cents,'succeeded',v_trade,p_idempotency_key,jsonb_build_object('welfareCents',p_welfare_cents,'mealCents',p_meal_cents,'voucherCents',p_voucher_cents,'pointsCents',p_points_cents,'externalCents',p_external_cents,'membershipId',p_membership_id),v_now);
  v_response := jsonb_build_object('testSimulation',true,'payment',jsonb_build_object('orderId',p_order_id,'orderNo',v_order.order_no,'status','succeeded','amountCents',v_order.payable_cents,'paymentNos',v_payment_nos));
  insert into public.idempotency_keys values (p_tenant_id,p_mall_id,'simulation:mixed-payment',p_idempotency_key,p_request_hash,p_order_id,v_response,v_now,v_now+interval '24 hours');
  insert into public.audit_logs (id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,created_at) values (gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_user_id,'user','simulation.mixed_payment.succeeded','order',p_order_id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('testSimulation',true,'paymentNos',v_payment_nos,'authorization',p_granted_via),v_now);
  return v_response;
end;
$$;

revoke all on function public.api_simulate_mixed_payment(text,text,text,text,text,bigint,bigint,text,bigint,bigint,text,bigint,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.api_simulate_mixed_payment(text,text,text,text,text,bigint,bigint,text,bigint,bigint,text,bigint,text,text,text,text,text,jsonb) to service_role;
