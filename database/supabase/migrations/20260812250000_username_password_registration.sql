-- Username/password registration without requiring a phone number. Phone,
-- WeChat and enterprise identity aliases can be attached to the same Member
-- later; this path can only create an ordinary storefront employee.

create table if not exists public.username_registration_attempts (
  ip_hash text primary key,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists member_login_aliases_one_username_per_member
on public.member_login_aliases (member_id) where provider = 'local_username';

create or replace function public.api_username_registration_allowed(p_ip_hash text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when length(coalesce(p_ip_hash, '')) not between 10 and 256 then false
    when attempt.blocked_until > now() then false
    when attempt.window_started_at >= now() - interval '1 hour'
      and attempt.attempt_count >= 10 then false
    else true
  end
  from (select 1) seed
  left join public.username_registration_attempts attempt on attempt.ip_hash = p_ip_hash;
$$;

create or replace function public.api_register_username_member(
  p_username text,
  p_password_hash text,
  p_display_name text,
  p_invite_code_hash text,
  p_ip_hash text,
  p_request_id text,
  p_user_agent text,
  p_terms_version text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  registration_attempt public.username_registration_attempts%rowtype;
  invitation record;
  normalized_username text := lower(trim(p_username));
  new_user_id text := 'user-registration-' || gen_random_uuid()::text;
  new_member_id text := 'member-registration-' || gen_random_uuid()::text;
  new_membership_id text := 'membership-registration-' || gen_random_uuid()::text;
  new_employee_no text := 'REG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
begin
  if normalized_username !~ '^[a-z][a-z0-9._-]{3,31}$'
    or length(p_password_hash) not between 40 and 1024
    or length(trim(p_display_name)) not between 1 and 60
    or length(trim(p_request_id)) not between 1 and 160
    or length(coalesce(p_ip_hash, '')) not between 10 and 256
    or p_terms_version <> '2026-08-13' then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  delete from public.username_registration_attempts
  where updated_at < now() - interval '7 days';

  insert into public.username_registration_attempts (
    ip_hash, attempt_count, window_started_at, blocked_until, updated_at
  ) values (
    p_ip_hash, 1, now(), null, now()
  )
  on conflict (ip_hash) do update set
    attempt_count = case
      when username_registration_attempts.window_started_at < now() - interval '1 hour' then 1
      else username_registration_attempts.attempt_count + 1
    end,
    window_started_at = case
      when username_registration_attempts.window_started_at < now() - interval '1 hour' then now()
      else username_registration_attempts.window_started_at
    end,
    blocked_until = case
      when username_registration_attempts.blocked_until > now() then username_registration_attempts.blocked_until
      when username_registration_attempts.window_started_at >= now() - interval '1 hour'
        and username_registration_attempts.attempt_count + 1 > 10 then now() + interval '1 hour'
      else null
    end,
    updated_at = now()
  returning * into registration_attempt;

  if registration_attempt.blocked_until > now() then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  if normalized_username in (
    'admin', 'administrator', 'root', 'system', 'owner', 'support',
    'security', 'smartwing', 'hbbtzn'
  ) or exists (
    select 1 from public.member_login_aliases
    where provider = 'test' and lower(subject) = normalized_username
  ) then
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
    and i.allowed_phone_subject is null
    and r.code = 'employee' and not r.is_owner
    and (i.department_id is null or d.id is not null)
    and i.starts_at <= now() and i.expires_at > now()
    and i.use_count < i.max_uses
  for update of i;
  if not found then
    return jsonb_build_object('status', 'invalid_invite');
  end if;

  if exists (
    select 1 from public.member_login_aliases
    where provider = 'local_username' and subject = normalized_username
  ) then
    return jsonb_build_object('status', 'account_exists');
  end if;

  begin
    insert into public.users (
      id, tenant_id, enterprise_id, department_id, employee_no, display_name,
      identity_subject, status
    ) values (
      new_user_id, invitation.tenant_id, invitation.enterprise_id,
      invitation.department_id, new_employee_no, trim(p_display_name),
      'local_username:' || normalized_username, 'active'
    );
    insert into public.members (id, user_id, primary_identifier, status)
    values (new_member_id, new_user_id, 'local_username:' || normalized_username, 'active');
    insert into public.member_login_aliases (provider, subject, member_id)
    values ('local_username', normalized_username, new_member_id);
    insert into public.member_credentials (member_id, password_hash, phone_cipher)
    values (new_member_id, p_password_hash, '{"version":1,"kind":"unbound"}'::jsonb);
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

  update public.membership_registration_invites
  set use_count = use_count + 1 where id = invitation.id;
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, ip_hash, user_agent, after_json,
    membership_id, created_at
  ) values (
    gen_random_uuid()::text, invitation.tenant_id, invitation.enterprise_id,
    invitation.mall_id, new_user_id, 'user', 'member.self_registered',
    'membership', new_membership_id, p_request_id, p_ip_hash,
    left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object(
      'method', 'username_password', 'termsVersion', p_terms_version,
      'roleCode', 'employee', 'phoneBound', false, 'wechatBound', false
    ), new_membership_id, now()
  );

  return jsonb_build_object(
    'status', 'active', 'memberId', new_member_id,
    'membershipId', new_membership_id, 'employeeNo', new_employee_no,
    'username', normalized_username
  );
end;
$$;

revoke all on table public.username_registration_attempts from public, anon, authenticated;
alter table public.username_registration_attempts enable row level security;
revoke all on function public.api_username_registration_allowed(text)
from public, anon, authenticated;
revoke all on function public.api_register_username_member(text,text,text,text,text,text,text,text)
from public, anon, authenticated;
grant execute on function public.api_username_registration_allowed(text)
to service_role;
grant execute on function public.api_register_username_member(text,text,text,text,text,text,text,text)
to service_role;
