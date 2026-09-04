-- Identity assurance is separate from authorization. A member may have a
-- valid employee membership while still lacking the verified factor required
-- for money-moving operations.

create table if not exists public.member_identity_assurances (
  member_id text primary key references public.members(id) on delete restrict,
  account_authenticated_at timestamptz not null,
  phone_verified_at timestamptz,
  phone_verification_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((phone_verified_at is null) = (phone_verification_method is null))
);

insert into public.member_identity_assurances (
  member_id, account_authenticated_at, created_at, updated_at
)
select id, created_at, created_at, now()
from public.members
on conflict (member_id) do nothing;

update public.member_identity_assurances assurance
set phone_verified_at = alias.created_at,
    phone_verification_method = 'sms_otp',
    updated_at = now()
from (
  select member_id, min(created_at) as created_at
  from public.member_login_aliases
  where provider = 'local_phone'
  group by member_id
) alias
where assurance.member_id = alias.member_id
  and assurance.phone_verified_at is null;

create or replace function public.sync_new_member_identity_assurance()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.member_identity_assurances (
    member_id, account_authenticated_at, created_at, updated_at
  ) values (new.id, new.created_at, new.created_at, now())
  on conflict (member_id) do nothing;
  return new;
end;
$$;

drop trigger if exists members_identity_assurance_after_insert on public.members;
create trigger members_identity_assurance_after_insert
after insert on public.members
for each row execute function public.sync_new_member_identity_assurance();

create or replace function public.sync_phone_identity_assurance()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare affected_member_id text;
begin
  if tg_op <> 'DELETE' and new.provider = 'local_phone' then
    insert into public.member_identity_assurances (
      member_id, account_authenticated_at, phone_verified_at,
      phone_verification_method, created_at, updated_at
    )
    select new.member_id, member.created_at, now(), 'sms_otp', now(), now()
    from public.members member where member.id = new.member_id
    on conflict (member_id) do update set
      phone_verified_at = excluded.phone_verified_at,
      phone_verification_method = excluded.phone_verification_method,
      updated_at = now();
  end if;

  if tg_op <> 'INSERT' and old.provider = 'local_phone' then
    affected_member_id := old.member_id;
    if tg_op = 'DELETE' or new.provider <> 'local_phone' or new.member_id <> old.member_id then
      update public.member_identity_assurances
      set phone_verified_at = null, phone_verification_method = null, updated_at = now()
      where member_id = affected_member_id
        and not exists (
          select 1 from public.member_login_aliases
          where provider = 'local_phone' and member_id = affected_member_id
        );
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists member_login_alias_phone_assurance on public.member_login_aliases;
create trigger member_login_alias_phone_assurance
after insert or update or delete on public.member_login_aliases
for each row execute function public.sync_phone_identity_assurance();

create or replace function public.api_member_assurance(p_member_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'level', case when assurance.phone_verified_at is null then 'account' else 'phone' end,
    'accountAuthenticated', true,
    'accountAuthenticatedAt', assurance.account_authenticated_at,
    'phoneVerified', assurance.phone_verified_at is not null,
    'phoneVerifiedAt', assurance.phone_verified_at,
    'phoneVerificationMethod', assurance.phone_verification_method,
    'paymentEligible', assurance.phone_verified_at is not null,
    'restrictedCapabilities', case
      when assurance.phone_verified_at is null
        then jsonb_build_array('order.create', 'payment.execute')
      else '[]'::jsonb
    end
  )
  from public.member_identity_assurances assurance
  where assurance.member_id = p_member_id;
$$;

create or replace function public.api_member_phone_verified(
  p_membership_id text,
  p_user_id text
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(exists(
    select 1
    from public.memberships membership
    join public.members member on member.id = membership.member_id and member.status = 'active'
    join public.member_identity_assurances assurance
      on assurance.member_id = member.id and assurance.phone_verified_at is not null
    where membership.id = p_membership_id
      and membership.context_user_id = p_user_id
      and membership.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
  ), false);
$$;

create or replace function public.api_account_security_center(
  p_member_id text, p_current_session_id uuid
) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'hasLocalCredential', credential.member_id is not null,
    'phoneMasked', user_record.mobile_masked,
    'passwordChangedAt', credential.password_changed_at,
    'assuranceLevel', case when assurance.phone_verified_at is null then 'account' else 'phone' end,
    'accountAuthenticated', assurance.member_id is not null,
    'accountAuthenticatedAt', assurance.account_authenticated_at,
    'phoneVerified', assurance.phone_verified_at is not null,
    'phoneVerifiedAt', assurance.phone_verified_at,
    'paymentEligible', assurance.phone_verified_at is not null,
    'restrictedCapabilities', case
      when assurance.phone_verified_at is null
        then jsonb_build_array('order.create', 'payment.execute')
      else '[]'::jsonb
    end,
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', session.id, 'target', session.target, 'deviceLabel', session.device_label,
      'createdAt', session.created_at, 'lastSeenAt', session.last_seen_at,
      'expiresAt', session.expires_at, 'current', session.id = p_current_session_id
    ) order by (session.id = p_current_session_id) desc, session.last_seen_at desc)
    from public.auth_sessions session
    where session.member_id = member.id and session.revoked_at is null
      and session.expires_at > now()), '[]'::jsonb)
  )
  from public.members member
  join public.users user_record on user_record.id = member.user_id
  left join public.member_credentials credential on credential.member_id = member.id
  left join public.member_identity_assurances assurance on assurance.member_id = member.id
  where member.id = p_member_id;
$$;

create or replace function public.api_create_order_authorized(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_items jsonb, p_recipient_cipher jsonb, p_recipient_city text, p_idempotency_key text,
  p_request_hash text, p_request_id text, p_user_agent text,
  p_membership_id text, p_granted_via jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_result jsonb; v_order_id text; v_qualification jsonb; v_existing public.idempotency_keys%rowtype;
begin
  if not public.api_member_phone_verified(p_membership_id, p_user_id) then
    raise exception 'PHONE_VERIFICATION_REQUIRED';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then raise exception 'INVALID_ORDER_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id || ':' || p_mall_id || ':order:create:' || p_idempotency_key, 0
  ));
  select * into v_existing from public.idempotency_keys
  where mall_id = p_mall_id and scope = 'order:create'
    and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;
  v_qualification := public.api_assert_order_qualification(
    p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_membership_id, p_items, p_recipient_city
  );
  v_result := public.api_create_order(
    p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_items, p_recipient_cipher,
    p_idempotency_key, p_request_hash, p_request_id, p_user_agent
  );
  v_order_id := v_result #>> '{order,id}';
  if v_order_id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  update public.orders set qualification_evidence_json = v_qualification where id = v_order_id;
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json,
    membership_id, granted_via, created_at
  )
  select gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id,
    p_user_id, 'user', 'order.create.authorized', 'order', v_order_id,
    p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('idempotencyKey', p_idempotency_key, 'qualification', v_qualification),
    p_membership_id, p_granted_via, now()
  where not exists (
    select 1 from public.audit_logs
    where resource_id = v_order_id and action = 'order.create.authorized'
      and after_json ->> 'idempotencyKey' = p_idempotency_key
  );
  return v_result || jsonb_build_object('qualification', v_qualification);
end;
$$;

create or replace function public.api_pay_internal_authorized(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_order_id text, p_welfare_cents bigint, p_meal_cents bigint,
  p_idempotency_key text, p_request_hash text, p_request_id text, p_user_agent text,
  p_membership_id text, p_granted_via jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  if not public.api_member_phone_verified(p_membership_id, p_user_id) then
    raise exception 'PHONE_VERIFICATION_REQUIRED';
  end if;
  v_result := public.api_pay_internal(
    p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_order_id,
    p_welfare_cents, p_meal_cents, p_idempotency_key, p_request_hash,
    p_request_id, p_user_agent
  );
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json,
    membership_id, granted_via, created_at
  )
  select gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id,
    p_user_id, 'user', 'payment.internal.authorized', 'order', p_order_id,
    p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('idempotencyKey', p_idempotency_key),
    p_membership_id, p_granted_via, now()
  where not exists (
    select 1 from public.audit_logs
    where resource_id = p_order_id and action = 'payment.internal.authorized'
      and after_json ->> 'idempotencyKey' = p_idempotency_key
  );
  return v_result;
end;
$$;

revoke all on table public.member_identity_assurances from public, anon, authenticated;
alter table public.member_identity_assurances enable row level security;
revoke all on function public.sync_new_member_identity_assurance() from public, anon, authenticated;
revoke all on function public.sync_phone_identity_assurance() from public, anon, authenticated;
revoke all on function public.api_member_assurance(text) from public, anon, authenticated;
revoke all on function public.api_member_phone_verified(text,text) from public, anon, authenticated;
revoke all on function public.api_account_security_center(text,uuid) from public, anon, authenticated;
revoke all on function public.api_create_order_authorized(text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.api_pay_internal_authorized(text,text,text,text,text,bigint,bigint,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.api_member_assurance(text) to service_role;
grant execute on function public.api_member_phone_verified(text,text) to service_role;
grant execute on function public.api_account_security_center(text,uuid) to service_role;
grant execute on function public.api_create_order_authorized(text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.api_pay_internal_authorized(text,text,text,text,text,bigint,bigint,text,text,text,text,text,jsonb) to service_role;

-- The raw mutation RPCs are implementation details of the guarded wrappers.
-- Prevent application credentials from skipping assurance and qualification.
revoke execute on function public.api_create_order(text,text,text,text,jsonb,jsonb,text,text,text,text) from service_role;
revoke execute on function public.api_pay_internal(text,text,text,text,text,bigint,bigint,text,text,text,text) from service_role;
