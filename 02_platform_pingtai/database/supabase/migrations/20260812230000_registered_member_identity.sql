-- Real member registration and local credentials.
-- Public registration is deliberately constrained to an active storefront
-- employee invitation. It can never mint an admin or platform-owner role.

create table if not exists public.member_credentials (
  member_id text primary key references public.members(id) on delete restrict,
  password_hash text not null check (length(password_hash) between 40 and 1024),
  phone_cipher jsonb not null,
  must_reset_password boolean not null default false,
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.phone_verification_challenges (
  id uuid primary key,
  phone_subject text not null,
  phone_masked text not null,
  purpose text not null check (purpose in ('registration')),
  code_hash text not null,
  ip_hash text not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists phone_verification_challenges_phone_recent
on public.phone_verification_challenges (phone_subject, created_at desc);
create index if not exists phone_verification_challenges_ip_recent
on public.phone_verification_challenges (ip_hash, created_at desc);

create table if not exists public.membership_registration_invites (
  id text primary key,
  code_hash text not null unique,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete restrict,
  department_id text references public.departments(id) on delete restrict,
  role_id text not null references public.roles(id) on delete restrict,
  target text not null check (target = 'storefront'),
  allowed_phone_subject text,
  max_uses integer not null check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0 and use_count <= max_uses),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'disabled', 'expired')),
  created_by_membership_id text references public.memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

-- Non-production demo invitation. Real tenants receive random, short-lived
-- invitations through the member administration workflow.
insert into public.membership_registration_invites (
  id, code_hash, tenant_id, enterprise_id, mall_id, department_id, role_id,
  target, max_uses, expires_at
) values (
  'invite-demo-employee-2026',
  encode(digest('SW-DEMO-EMPLOYEE-2026', 'sha256'), 'base64'),
  'tenant-smart-wing', 'enterprise-demo', 'mall-demo', 'department-digital',
  'role-employee', 'storefront', 500, '2027-12-31T15:59:59Z'
) on conflict (id) do update set
  expires_at = excluded.expires_at,
  status = 'active';

create or replace function public.api_create_registration_challenge(
  p_challenge_id uuid,
  p_phone_subject text,
  p_phone_masked text,
  p_code_hash text,
  p_ip_hash text,
  p_expires_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.phone_verification_challenges
  where created_at < now() - interval '7 days';
  if p_expires_at <= now() or p_expires_at > now() + interval '10 minutes' then
    return false;
  end if;
  if (select count(*) from public.phone_verification_challenges
      where phone_subject = p_phone_subject and created_at > now() - interval '15 minutes') >= 5 then
    return false;
  end if;
  if (select count(*) from public.phone_verification_challenges
      where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 20 then
    return false;
  end if;
  insert into public.phone_verification_challenges (
    id, phone_subject, phone_masked, purpose, code_hash, ip_hash, expires_at
  ) values (
    p_challenge_id, p_phone_subject, p_phone_masked, 'registration',
    p_code_hash, p_ip_hash, p_expires_at
  );
  return true;
end;
$$;

create or replace function public.api_register_storefront_member(
  p_challenge_id uuid,
  p_phone_subject text,
  p_code_hash text,
  p_phone_masked text,
  p_phone_cipher jsonb,
  p_password_hash text,
  p_display_name text,
  p_invite_code_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  challenge public.phone_verification_challenges%rowtype;
  invitation record;
  new_user_id text := 'user-registration-' || gen_random_uuid()::text;
  new_member_id text := 'member-registration-' || gen_random_uuid()::text;
  new_membership_id text := 'membership-registration-' || gen_random_uuid()::text;
  new_employee_no text := 'REG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
begin
  select * into challenge from public.phone_verification_challenges
  where id = p_challenge_id and phone_subject = p_phone_subject
    and purpose = 'registration' and consumed_at is null and expires_at > now()
    and attempts < 5
  for update;
  if not found then return jsonb_build_object('status', 'invalid_code'); end if;

  if challenge.code_hash <> p_code_hash then
    update public.phone_verification_challenges set attempts = least(attempts + 1, 5)
    where id = p_challenge_id;
    return jsonb_build_object('status', 'invalid_code');
  end if;

  if exists (select 1 from public.member_login_aliases where provider = 'local_phone' and subject = p_phone_subject) then
    update public.phone_verification_challenges set consumed_at = now()
    where id = p_challenge_id;
    return jsonb_build_object('status', 'account_exists');
  end if;

  select i.* into invitation
  from public.membership_registration_invites i
  join public.roles r on r.id = i.role_id and r.tenant_id = i.tenant_id
  join public.enterprises e on e.id = i.enterprise_id and e.tenant_id = i.tenant_id
  join public.malls mall on mall.id = i.mall_id
    and mall.tenant_id = i.tenant_id and mall.enterprise_id = i.enterprise_id
  left join public.departments d on d.id = i.department_id
    and d.tenant_id = i.tenant_id and d.enterprise_id = i.enterprise_id
  where i.code_hash = p_invite_code_hash
    and i.status = 'active' and i.target = 'storefront'
    and r.code = 'employee'
    and (i.department_id is null or d.id is not null)
    and i.starts_at <= now() and i.expires_at > now()
    and i.use_count < i.max_uses
    and (i.allowed_phone_subject is null or i.allowed_phone_subject = p_phone_subject)
  for update of i;
  if not found then
    update public.phone_verification_challenges set attempts = least(attempts + 1, 5)
    where id = p_challenge_id;
    return jsonb_build_object('status', 'invalid_invite');
  end if;

  begin
    insert into public.users (
      id, tenant_id, enterprise_id, department_id, employee_no, display_name,
      mobile_masked, identity_subject, status
    ) values (
      new_user_id, invitation.tenant_id, invitation.enterprise_id,
      invitation.department_id, new_employee_no, p_display_name,
      p_phone_masked, 'local_phone:' || p_phone_subject, 'active'
    );
    insert into public.members (id, user_id, primary_identifier, status)
    values (new_member_id, new_user_id, 'local_phone:' || p_phone_subject, 'active');
    insert into public.member_login_aliases (provider, subject, member_id)
    values ('local_phone', p_phone_subject, new_member_id);
    insert into public.member_credentials (member_id, password_hash, phone_cipher)
    values (new_member_id, p_password_hash, p_phone_cipher);
    insert into public.memberships (
      id, member_id, context_user_id, tenant_id, enterprise_id, mall_id, target, status
    ) values (
      new_membership_id, new_member_id, new_user_id, invitation.tenant_id,
      invitation.enterprise_id, invitation.mall_id, 'storefront', 'active'
    );
    insert into public.membership_roles (membership_id, role_id)
    values (new_membership_id, invitation.role_id);
    insert into public.membership_scopes (membership_id, scope_kind, resource_id)
    values (new_membership_id, 'self', new_user_id);
    insert into public.welfare_accounts (
      id, tenant_id, enterprise_id, mall_id, user_id, account_type, balance_cents
    ) values (
      'account-registration-' || gen_random_uuid()::text, invitation.tenant_id,
      invitation.enterprise_id, invitation.mall_id, new_user_id, 'welfare', 0
    );
  exception when unique_violation then
    return jsonb_build_object('status', 'account_exists');
  end;

  update public.phone_verification_challenges set consumed_at = now()
  where id = p_challenge_id;
  update public.membership_registration_invites set use_count = use_count + 1
  where id = invitation.id;
  return jsonb_build_object(
    'status', 'active', 'memberId', new_member_id,
    'membershipId', new_membership_id, 'employeeNo', new_employee_no
  );
end;
$$;

create or replace function public.api_registered_login_candidate(p_phone_subject text, p_target text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'memberId', m.id,
    'membershipId', ms.id,
    'passwordHash', c.password_hash,
    'mustResetPassword', c.must_reset_password
  )
  from public.member_login_aliases a
  join public.members m on m.id = a.member_id and m.status = 'active'
  join public.member_credentials c on c.member_id = m.id
  join public.memberships ms on ms.member_id = m.id
    and ms.target = p_target and ms.status = 'active'
    and (ms.expires_at is null or ms.expires_at > now())
  where a.provider = 'local_phone' and a.subject = p_phone_subject
  order by ms.created_at
  limit 1;
$$;

revoke all on table public.member_credentials from public, anon, authenticated;
revoke all on table public.phone_verification_challenges from public, anon, authenticated;
revoke all on table public.membership_registration_invites from public, anon, authenticated;
alter table public.member_credentials enable row level security;
alter table public.phone_verification_challenges enable row level security;
alter table public.membership_registration_invites enable row level security;

revoke all on function public.api_create_registration_challenge(uuid,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.api_register_storefront_member(uuid,text,text,text,jsonb,text,text,text) from public, anon, authenticated;
revoke all on function public.api_registered_login_candidate(text,text) from public, anon, authenticated;
grant execute on function public.api_create_registration_challenge(uuid,text,text,text,text,timestamptz) to service_role;
grant execute on function public.api_register_storefront_member(uuid,text,text,text,jsonb,text,text,text) to service_role;
grant execute on function public.api_registered_login_candidate(text,text) to service_role;
