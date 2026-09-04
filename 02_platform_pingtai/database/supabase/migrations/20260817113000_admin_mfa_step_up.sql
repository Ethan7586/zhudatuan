-- Server-side TOTP step-up foundation for high-risk admin operations.
-- MFA secrets are encrypted by commerce-api with PII_ENCRYPTION_KEY before
-- insertion. They are never selectable by browser roles or returned by HTTP.

create table public.admin_mfa_factors (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  user_id text not null references public.users(id) on delete restrict,
  factor_type text not null check (factor_type = 'totp'),
  secret_ciphertext text not null check (char_length(secret_ciphertext) between 32 and 8192),
  label text not null default 'Authenticator app' check (char_length(label) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'disabled', 'revoked')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, factor_type)
);

create table public.admin_step_up_challenges (
  id text primary key,
  membership_id text not null references public.memberships(id) on delete restrict,
  user_id text not null references public.users(id) on delete restrict,
  session_id text not null check (char_length(session_id) between 16 and 160),
  factor_id text not null references public.admin_mfa_factors(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'verified', 'locked', 'expired')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  request_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create index idx_admin_mfa_factor_active on public.admin_mfa_factors (user_id, status);
create index idx_admin_step_up_challenge_session on public.admin_step_up_challenges (membership_id, user_id, session_id, status, expires_at desc);

alter table public.admin_mfa_factors enable row level security;
alter table public.admin_step_up_challenges enable row level security;
revoke all on table public.admin_mfa_factors, public.admin_step_up_challenges from public, anon, authenticated;

create or replace function public.api_admin_step_up_identity_matches(
  p_membership_id text,
  p_user_id text
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
    join public.users actor on actor.id = membership.context_user_id
    where membership.id = p_membership_id
      and membership.context_user_id = p_user_id
      and membership.target = 'admin'
      and membership.status = 'active'
      and member.status = 'active'
      and actor.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
  );
$$;

create or replace function public.api_admin_step_up_start(
  p_membership_id text,
  p_user_id text,
  p_session_id text,
  p_request_id text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_factor public.admin_mfa_factors%rowtype;
  v_existing public.admin_step_up_challenges%rowtype;
  v_challenge_id text := gen_random_uuid()::text;
  v_now timestamptz := clock_timestamp();
  v_expires_at timestamptz := v_now + interval '5 minutes';
begin
  if char_length(trim(coalesce(p_session_id, ''))) not between 16 and 160 then raise exception 'STEP_UP_SESSION_INVALID'; end if;
  if not public.api_admin_step_up_identity_matches(p_membership_id, p_user_id) then raise exception 'STEP_UP_IDENTITY_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtext(p_session_id || ':admin:step-up'));

  select * into v_existing
  from public.admin_step_up_challenges challenge
  where challenge.membership_id = p_membership_id and challenge.user_id = p_user_id and challenge.session_id = p_session_id
    and challenge.status = 'pending' and challenge.expires_at > v_now
  order by challenge.created_at desc
  limit 1
  for update;
  if found then
    select * into v_factor from public.admin_mfa_factors where id = v_existing.factor_id and status = 'active';
    if not found then raise exception 'STEP_UP_FACTOR_NOT_CONFIGURED'; end if;
    return jsonb_build_object('challengeId', v_existing.id, 'method', 'totp', 'expiresAt', v_existing.expires_at, 'secretCiphertext', v_factor.secret_ciphertext);
  end if;

  select * into v_factor
  from public.admin_mfa_factors factor
  where factor.user_id = p_user_id and factor.factor_type = 'totp' and factor.status = 'active'
  for share;
  if not found then raise exception 'STEP_UP_FACTOR_NOT_CONFIGURED'; end if;

  insert into public.admin_step_up_challenges (
    id, membership_id, user_id, session_id, factor_id, status, attempts, request_id, created_at, expires_at, updated_at
  ) values (
    v_challenge_id, p_membership_id, p_user_id, p_session_id, v_factor.id, 'pending', 0, p_request_id, v_now, v_expires_at, v_now
  );
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json, membership_id, created_at
  )
  select gen_random_uuid()::text, membership.tenant_id, membership.enterprise_id, membership.mall_id, p_user_id, 'admin', 'admin.step_up.challenge.created',
         'admin_step_up_challenge', v_challenge_id, p_request_id, left(coalesce(p_user_agent, ''), 300),
         jsonb_build_object('factorType', 'totp', 'expiresAt', v_expires_at), p_membership_id, v_now
  from public.memberships membership where membership.id = p_membership_id;
  return jsonb_build_object('challengeId', v_challenge_id, 'method', 'totp', 'expiresAt', v_expires_at, 'secretCiphertext', v_factor.secret_ciphertext);
end;
$$;

create or replace function public.api_admin_step_up_verification_material(
  p_membership_id text,
  p_user_id text,
  p_session_id text,
  p_challenge_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge public.admin_step_up_challenges%rowtype;
  v_factor public.admin_mfa_factors%rowtype;
begin
  if not public.api_admin_step_up_identity_matches(p_membership_id, p_user_id) then raise exception 'STEP_UP_IDENTITY_INVALID'; end if;
  select * into v_challenge from public.admin_step_up_challenges
    where id = p_challenge_id and membership_id = p_membership_id and user_id = p_user_id and session_id = p_session_id
      and status = 'pending' and expires_at > clock_timestamp();
  if not found then raise exception 'STEP_UP_CHALLENGE_INVALID'; end if;
  select * into v_factor from public.admin_mfa_factors where id = v_challenge.factor_id and status = 'active';
  if not found then raise exception 'STEP_UP_FACTOR_NOT_CONFIGURED'; end if;
  return jsonb_build_object('secretCiphertext', v_factor.secret_ciphertext);
end;
$$;

create or replace function public.api_admin_step_up_record_failure(
  p_membership_id text,
  p_user_id text,
  p_session_id text,
  p_challenge_id text,
  p_request_id text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge public.admin_step_up_challenges%rowtype;
  v_now timestamptz := clock_timestamp();
  v_attempts integer;
  v_locked boolean;
begin
  if not public.api_admin_step_up_identity_matches(p_membership_id, p_user_id) then raise exception 'STEP_UP_IDENTITY_INVALID'; end if;
  select * into v_challenge from public.admin_step_up_challenges where id = p_challenge_id for update;
  if not found or v_challenge.membership_id <> p_membership_id or v_challenge.user_id <> p_user_id or v_challenge.session_id <> p_session_id then raise exception 'STEP_UP_CHALLENGE_INVALID'; end if;
  if v_challenge.status <> 'pending' then raise exception 'STEP_UP_CHALLENGE_INVALID'; end if;
  if v_challenge.expires_at <= v_now then
    update public.admin_step_up_challenges set status = 'expired', updated_at = v_now where id = v_challenge.id;
    raise exception 'STEP_UP_CHALLENGE_EXPIRED';
  end if;
  v_attempts := v_challenge.attempts + 1;
  v_locked := v_attempts >= 5;
  update public.admin_step_up_challenges
    set attempts = v_attempts, status = case when v_locked then 'locked' else 'pending' end, updated_at = v_now
    where id = v_challenge.id;
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json, membership_id, created_at
  )
  select gen_random_uuid()::text, membership.tenant_id, membership.enterprise_id, membership.mall_id, p_user_id, 'admin', 'admin.step_up.challenge.failed',
         'admin_step_up_challenge', v_challenge.id, p_request_id, left(coalesce(p_user_agent, ''), 300),
         jsonb_build_object('attempts', v_attempts, 'locked', v_locked), p_membership_id, v_now
  from public.memberships membership where membership.id = p_membership_id;
  return jsonb_build_object('locked', v_locked, 'attemptsRemaining', greatest(0, 5 - v_attempts));
end;
$$;

create or replace function public.api_admin_step_up_complete(
  p_membership_id text,
  p_user_id text,
  p_session_id text,
  p_challenge_id text,
  p_request_id text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge public.admin_step_up_challenges%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if not public.api_admin_step_up_identity_matches(p_membership_id, p_user_id) then raise exception 'STEP_UP_IDENTITY_INVALID'; end if;
  select * into v_challenge from public.admin_step_up_challenges where id = p_challenge_id for update;
  if not found or v_challenge.membership_id <> p_membership_id or v_challenge.user_id <> p_user_id or v_challenge.session_id <> p_session_id then raise exception 'STEP_UP_CHALLENGE_INVALID'; end if;
  if v_challenge.status <> 'pending' then raise exception 'STEP_UP_CHALLENGE_INVALID'; end if;
  if v_challenge.expires_at <= v_now then
    update public.admin_step_up_challenges set status = 'expired', updated_at = v_now where id = v_challenge.id;
    raise exception 'STEP_UP_CHALLENGE_EXPIRED';
  end if;
  update public.admin_step_up_challenges set status = 'verified', verified_at = v_now, updated_at = v_now where id = v_challenge.id;
  update public.admin_mfa_factors set last_verified_at = v_now, updated_at = v_now where id = v_challenge.factor_id;
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json, membership_id, created_at
  )
  select gen_random_uuid()::text, membership.tenant_id, membership.enterprise_id, membership.mall_id, p_user_id, 'admin', 'admin.step_up.challenge.verified',
         'admin_step_up_challenge', v_challenge.id, p_request_id, left(coalesce(p_user_agent, ''), 300),
         jsonb_build_object('verifiedAt', v_now), p_membership_id, v_now
  from public.memberships membership where membership.id = p_membership_id;
  return jsonb_build_object('verifiedAt', v_now);
end;
$$;

revoke all on function public.api_admin_step_up_identity_matches(text, text) from public, anon, authenticated;
revoke all on function public.api_admin_step_up_start(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.api_admin_step_up_verification_material(text, text, text, text) from public, anon, authenticated;
revoke all on function public.api_admin_step_up_record_failure(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.api_admin_step_up_complete(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.api_admin_step_up_identity_matches(text, text) to service_role;
grant execute on function public.api_admin_step_up_start(text, text, text, text, text) to service_role;
grant execute on function public.api_admin_step_up_verification_material(text, text, text, text) to service_role;
grant execute on function public.api_admin_step_up_record_failure(text, text, text, text, text, text) to service_role;
grant execute on function public.api_admin_step_up_complete(text, text, text, text, text, text) to service_role;
