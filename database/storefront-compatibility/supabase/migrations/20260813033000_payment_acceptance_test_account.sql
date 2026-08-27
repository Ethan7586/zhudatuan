-- TEST ENVIRONMENT ONLY: prepare one employee account for end-to-end checkout
-- acceptance. This is simulated welfare money, never an external payment
-- provider balance. buyer002 intentionally stays phone-unverified with empty
-- wallets so the identity-assurance payment block remains testable.

do $$
begin
  if not exists (
    select 1 from public.members where id = 'member-test-buyer-001'
  ) then
    raise notice 'buyer001 test fixture is absent; payment acceptance seed skipped';
    return;
  end if;

  update public.users
  set mobile_masked = '199****1001', updated_at = now()
  where id = 'user-test-buyer-001';

  insert into public.member_identity_assurances (
    member_id, account_authenticated_at, phone_verified_at,
    phone_verification_method, created_at, updated_at
  )
  select
    member.id,
    member.created_at,
    now(),
    'test_fixture',
    member.created_at,
    now()
  from public.members member
  where member.id = 'member-test-buyer-001'
  on conflict (member_id) do update set
    phone_verified_at = excluded.phone_verified_at,
    phone_verification_method = excluded.phone_verification_method,
    updated_at = now();

  insert into public.welfare_accounts (
    id, tenant_id, enterprise_id, mall_id, user_id,
    account_type, balance_cents, status
  ) values
    ('acct-user-test-buyer-001-welfare', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', 'user-test-buyer-001', 'welfare', 500000, 'active'),
    ('acct-user-test-buyer-001-meal', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', 'user-test-buyer-001', 'meal', 100000, 'active')
  on conflict (mall_id, user_id, account_type) do update set
    balance_cents = greatest(welfare_accounts.balance_cents, excluded.balance_cents),
    status = 'active',
    updated_at = now();
end;
$$;
