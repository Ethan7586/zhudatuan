-- WeChat Mini Program identity binding and direct-merchant payment closure.
--
-- Security invariants:
--   * An AppID + OpenID is never auto-bound to a Member, including when a
--     UnionID matches. Binding consumes a short-lived opaque challenge and is
--     only performed by the authenticated server path.
--   * Storefront order reads are always scoped to the active membership owner.
--   * WeChat payment creation is serialized and idempotent per order.
--   * Provider observations are append-only. A verified notification or query
--     can transition money state once; retries return the recorded result.
--   * Private keys, API v3 keys, raw decrypted payer payloads and raw OpenIDs
--     never enter payment audit tables.

create table if not exists public.member_wechat_identities (
  id uuid primary key default gen_random_uuid(),
  app_id text not null check (length(app_id) between 6 and 64),
  open_id text not null check (length(open_id) between 6 and 128),
  union_id text check (union_id is null or length(union_id) between 6 and 128),
  member_id text references public.members(id) on delete restrict,
  membership_id text references public.memberships(id) on delete restrict,
  bound_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, open_id),
  check (
    (member_id is null and membership_id is null and bound_at is null)
    or (member_id is not null and membership_id is not null and bound_at is not null)
  )
);

create unique index if not exists member_wechat_identity_one_app_membership
on public.member_wechat_identities (app_id, membership_id)
where membership_id is not null and revoked_at is null;

create index if not exists member_wechat_identity_union_lookup
on public.member_wechat_identities (union_id)
where union_id is not null and revoked_at is null;

create table if not exists public.wechat_binding_challenges (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.member_wechat_identities(id) on delete restrict,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),
  check (consumed_at is null or consumed_at >= created_at)
);

create index if not exists wechat_binding_challenge_active_lookup
on public.wechat_binding_challenges (identity_id, expires_at desc)
where consumed_at is null;

create table if not exists public.wechat_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_id text not null unique references public.payments(id) on delete restrict,
  order_id text not null unique references public.orders(id) on delete restrict,
  identity_id uuid not null references public.member_wechat_identities(id) on delete restrict,
  created_by_membership_id text not null references public.memberships(id) on delete restrict,
  app_id text not null check (length(app_id) between 6 and 64),
  mch_id text not null check (length(mch_id) between 6 and 64),
  out_trade_no text not null unique
    check (length(out_trade_no) between 6 and 32 and out_trade_no ~ '^[A-Za-z0-9_\-|*]+$'),
  description text not null check (length(description) between 1 and 127),
  amount_total bigint not null check (amount_total > 0),
  currency text not null default 'CNY' check (currency = 'CNY'),
  payer_openid_hash text not null check (payer_openid_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'created' check (
    status in ('created','prepay_ready','prepay_failed','processing','succeeded','closed','failed')
  ),
  prepay_id text,
  prepay_expires_at timestamptz,
  provider_request_id text,
  transaction_id text unique,
  provider_trade_state text,
  last_error_code text,
  last_query_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((prepay_id is null and prepay_expires_at is null) or (prepay_id is not null and prepay_expires_at is not null))
);

create index if not exists wechat_payment_attempt_status_lookup
on public.wechat_payment_attempts (status, updated_at);

create table if not exists public.wechat_payment_observations (
  provider_event_key text primary key check (length(provider_event_key) between 1 and 200),
  source text not null check (source in ('notification','query')),
  provider_event_id text not null check (length(provider_event_id) between 1 and 160),
  event_type text not null check (length(event_type) between 1 and 80),
  resource_type text not null check (length(resource_type) between 1 and 80),
  attempt_id uuid references public.wechat_payment_attempts(id) on delete restrict,
  app_id text not null,
  mch_id text not null,
  out_trade_no text not null,
  transaction_id text,
  trade_state text not null,
  success_time timestamptz,
  amount_total bigint not null check (amount_total >= 0),
  payer_openid_hash text check (payer_openid_hash is null or payer_openid_hash ~ '^[0-9a-f]{64}$'),
  evidence_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence_json) = 'object' and octet_length(evidence_json::text) <= 8192),
  evidence_digest text not null check (evidence_digest ~ '^[0-9a-f]{64}$'),
  request_id text not null check (length(request_id) between 1 and 160),
  outcome text not null check (outcome in ('applied','recorded','rejected','reconciliation_required')),
  reason_code text,
  received_at timestamptz not null default now()
);

create index if not exists wechat_payment_observation_trade_lookup
on public.wechat_payment_observations (out_trade_no, received_at desc);

create table if not exists public.wechat_payment_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  topic text not null check (topic in (
    'order.payment_succeeded','order.payment_terminal','order.payment_reconciliation_required'
  )),
  order_id text not null references public.orders(id) on delete restrict,
  payment_id text not null references public.payments(id) on delete restrict,
  attempt_id uuid not null references public.wechat_payment_attempts(id) on delete restrict,
  payload_json jsonb not null check (jsonb_typeof(payload_json) = 'object'),
  status text not null default 'pending' check (status in ('pending','processing','delivered','dead_letter')),
  delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wechat_payment_outbox_delivery_lookup
on public.wechat_payment_outbox (status, available_at, created_at);

create trigger wechat_payment_observations_immutable
before update or delete on public.wechat_payment_observations
for each row execute function public.reject_immutable_change();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'member_wechat_identities','wechat_binding_challenges','wechat_payment_attempts',
    'wechat_payment_observations','wechat_payment_outbox'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
  end loop;
end $$;

create or replace function public.api_resolve_wechat_identity(
  p_app_id text,
  p_open_id text
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'memberId', wechat_identity.member_id,
    'membershipId', wechat_identity.membership_id
  )
  from public.member_wechat_identities wechat_identity
  join public.members member
    on member.id = wechat_identity.member_id and member.status = 'active'
  join public.memberships membership
    on membership.id = wechat_identity.membership_id
   and membership.member_id = wechat_identity.member_id
   and membership.target = 'storefront'
   and membership.status = 'active'
   and (membership.expires_at is null or membership.expires_at > now())
  join public.users user_row
    on user_row.id = membership.context_user_id and user_row.status = 'active'
  where wechat_identity.app_id = p_app_id
    and wechat_identity.open_id = p_open_id
    and wechat_identity.revoked_at is null;
$$;

create or replace function public.api_create_wechat_binding_challenge(
  p_app_id text,
  p_open_id text,
  p_union_id text,
  p_expires_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  identity_id uuid;
  challenge_id uuid := gen_random_uuid();
begin
  if length(trim(coalesce(p_app_id,''))) not between 6 and 64
    or length(trim(coalesce(p_open_id,''))) not between 6 and 128
    or (p_union_id is not null and length(trim(p_union_id)) not between 6 and 128)
    or p_expires_at <= now()
    or p_expires_at > now() + interval '10 minutes' then
    return null;
  end if;

  insert into public.member_wechat_identities (app_id,open_id,union_id)
  values (trim(p_app_id),trim(p_open_id),nullif(trim(p_union_id),''))
  on conflict (app_id,open_id) do update set
    union_id = coalesce(member_wechat_identities.union_id,excluded.union_id),
    updated_at = now()
  where member_wechat_identities.revoked_at is null
    and (
      member_wechat_identities.union_id is null
      or excluded.union_id is null
      or member_wechat_identities.union_id = excluded.union_id
    )
  returning id into identity_id;

  if identity_id is null then
    return null;
  end if;

  insert into public.wechat_binding_challenges (id,identity_id,expires_at)
  values (challenge_id,identity_id,p_expires_at);
  return challenge_id;
end;
$$;

create or replace function public.api_bind_wechat_identity(
  p_challenge_id uuid,
  p_member_id text,
  p_membership_id text,
  p_request_id text,
  p_user_agent text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  challenge public.wechat_binding_challenges%rowtype;
  identity_row public.member_wechat_identities%rowtype;
  membership public.memberships%rowtype;
begin
  if length(trim(coalesce(p_request_id,''))) not between 1 and 160 then
    return false;
  end if;

  select * into challenge
  from public.wechat_binding_challenges
  where id = p_challenge_id
  for update;
  if not found or challenge.consumed_at is not null or challenge.expires_at <= now() then
    return false;
  end if;

  -- A valid challenge is one-time even when the attempted binding is rejected.
  update public.wechat_binding_challenges set consumed_at = now()
  where id = challenge.id;

  select * into membership
  from public.memberships
  where id = p_membership_id
    and member_id = p_member_id
    and target = 'storefront'
    and status = 'active'
    and (expires_at is null or expires_at > now());
  if not found or not exists (
    select 1 from public.members where id = p_member_id and status = 'active'
  ) or not exists (
    select 1 from public.users where id = membership.context_user_id and status = 'active'
  ) then
    return false;
  end if;

  select * into identity_row
  from public.member_wechat_identities
  where id = challenge.identity_id and revoked_at is null
  for update;
  if not found then return false; end if;
  if identity_row.member_id is not null and (
    identity_row.member_id <> p_member_id or identity_row.membership_id <> p_membership_id
  ) then
    return false;
  end if;
  if identity_row.union_id is not null and exists (
    select 1 from public.member_wechat_identities other
    where other.union_id = identity_row.union_id
      and other.revoked_at is null
      and other.member_id is not null
      and other.member_id <> p_member_id
  ) then
    return false;
  end if;

  begin
    update public.member_wechat_identities set
      member_id = p_member_id,
      membership_id = p_membership_id,
      bound_at = coalesce(bound_at,now()),
      updated_at = now()
    where id = identity_row.id;
  exception when unique_violation then
    return false;
  end;

  insert into public.audit_logs (
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
    resource_type,resource_id,request_id,user_agent,after_json,membership_id,created_at
  ) values (
    gen_random_uuid()::text,membership.tenant_id,membership.enterprise_id,
    membership.mall_id,membership.context_user_id,'user','member.wechat_identity_bound',
    'member_wechat_identity',identity_row.id::text,trim(p_request_id),
    left(coalesce(p_user_agent,''),300),
    jsonb_build_object('appId',identity_row.app_id,'membershipId',p_membership_id),
    p_membership_id,now()
  );
  return true;
end;
$$;

create or replace function public.api_wechat_payment_attempt_payload(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'attemptId',attempt.id,
    'paymentId',attempt.payment_id,
    'orderId',attempt.order_id,
    'orderNo',attempt.out_trade_no,
    'totalCents',attempt.amount_total,
    'currency',attempt.currency,
    'openid',wechat_identity.open_id,
    'productNames',coalesce((
      select jsonb_agg(item.product_name_snapshot order by item.id)
      from public.order_items item where item.order_id = attempt.order_id
    ),'[]'::jsonb),
    'description',attempt.description,
    'existingPrepayId',attempt.prepay_id,
    'existingExpiresAt',attempt.prepay_expires_at,
    'status',attempt.status
  )
  from public.wechat_payment_attempts attempt
  join public.member_wechat_identities wechat_identity on wechat_identity.id = attempt.identity_id
  where attempt.id = p_attempt_id;
$$;

create or replace function public.api_create_wechat_prepay_attempt(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text,
  p_order_id text,
  p_app_id text,
  p_mch_id text,
  p_idempotency_key text,
  p_request_hash text,
  p_request_id text,
  p_user_agent text,
  p_membership_id text,
  p_granted_via jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  order_row public.orders%rowtype;
  identity_row public.member_wechat_identities%rowtype;
  existing_key public.idempotency_keys%rowtype;
  existing_attempt public.wechat_payment_attempts%rowtype;
  attempt_id uuid := gen_random_uuid();
  payment_id text := 'payment-wechat-' || gen_random_uuid()::text;
  payment_no text := 'WXP' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')
    || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  total_cents bigint;
  description text;
  response jsonb;
begin
  if length(trim(coalesce(p_idempotency_key,''))) not between 8 and 120
    or length(trim(coalesce(p_request_hash,''))) < 16
    or length(trim(coalesce(p_request_id,''))) not between 1 and 160
    or length(trim(coalesce(p_app_id,''))) not between 6 and 64
    or length(trim(coalesce(p_mch_id,''))) not between 6 and 64
    or jsonb_typeof(coalesce(p_granted_via,'{}'::jsonb)) <> 'object' then
    raise exception 'WECHAT_PREPAY_INPUT_INVALID';
  end if;

  if not exists (
    select 1 from public.memberships membership
    join public.members member on member.id = membership.member_id and member.status = 'active'
    join public.users user_row
      on user_row.id = membership.context_user_id and user_row.status = 'active'
    where membership.id = p_membership_id
      and membership.member_id = member.id
      and membership.context_user_id = p_user_id
      and membership.tenant_id = p_tenant_id
      and membership.enterprise_id = p_enterprise_id
      and membership.mall_id = p_mall_id
      and membership.target = 'storefront'
      and membership.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
  ) then
    raise exception 'STOREFRONT_MEMBERSHIP_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id || ':' || p_mall_id || ':payment:wechat:' || p_order_id,0
  ));

  select * into existing_key from public.idempotency_keys
  where mall_id = p_mall_id and scope = 'payment:wechat:prepay'
    and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if existing_key.request_hash <> p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return public.api_wechat_payment_attempt_payload(existing_key.resource_id::uuid);
  end if;

  select * into order_row from public.orders
  where id = p_order_id
    and tenant_id = p_tenant_id
    and enterprise_id = p_enterprise_id
    and mall_id = p_mall_id
    and user_id = p_user_id
  for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.status <> 'pending_payment' then raise exception 'ORDER_NOT_PAYABLE'; end if;
  if order_row.order_no !~ '^[A-Za-z0-9_\-|*]{6,32}$' then
    raise exception 'WECHAT_OUT_TRADE_NO_INVALID';
  end if;

  total_cents := order_row.payable_cents - order_row.paid_cents;
  if total_cents <= 0 then raise exception 'ORDER_NOT_PAYABLE'; end if;

  select * into identity_row from public.member_wechat_identities wechat_identity
  where wechat_identity.app_id = p_app_id
    and wechat_identity.member_id = (
      select membership.member_id from public.memberships membership
      where membership.id = p_membership_id
    )
    and wechat_identity.membership_id = p_membership_id
    and wechat_identity.revoked_at is null;
  if not found then raise exception 'WECHAT_IDENTITY_NOT_BOUND'; end if;

  select * into existing_attempt from public.wechat_payment_attempts
  where order_id = order_row.id;
  if found then
    if existing_attempt.app_id <> p_app_id
      or existing_attempt.mch_id <> p_mch_id
      or existing_attempt.identity_id <> identity_row.id
      or existing_attempt.amount_total <> total_cents then
      raise exception 'WECHAT_PAYMENT_ATTEMPT_CONFLICT';
    end if;
    response := public.api_wechat_payment_attempt_payload(existing_attempt.id);
    insert into public.idempotency_keys (
      tenant_id,mall_id,scope,idempotency_key,request_hash,resource_id,response_json,created_at,expires_at
    ) values (
      p_tenant_id,p_mall_id,'payment:wechat:prepay',p_idempotency_key,p_request_hash,
      existing_attempt.id::text,response,now(),now()+interval '24 hours'
    );
    return response;
  end if;

  select left('智慧翼福利商城-' || string_agg(item.product_name_snapshot,'、' order by item.id),127)
  into description
  from public.order_items item where item.order_id = order_row.id;
  if description is null then raise exception 'ORDER_ITEMS_NOT_FOUND'; end if;

  insert into public.payments (
    id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,
    amount_cents,idempotency_key,created_at
  ) values (
    payment_id,payment_no,p_tenant_id,p_mall_id,p_user_id,order_row.id,'wechat','created',
    total_cents,p_idempotency_key || ':wechat',now()
  );

  insert into public.wechat_payment_attempts (
    id,payment_id,order_id,identity_id,created_by_membership_id,app_id,mch_id,
    out_trade_no,description,amount_total,payer_openid_hash
  ) values (
    attempt_id,payment_id,order_row.id,identity_row.id,p_membership_id,p_app_id,p_mch_id,
    order_row.order_no,description,total_cents,encode(digest(identity_row.open_id,'sha256'),'hex')
  );

  response := public.api_wechat_payment_attempt_payload(attempt_id);
  insert into public.idempotency_keys (
    tenant_id,mall_id,scope,idempotency_key,request_hash,resource_id,response_json,created_at,expires_at
  ) values (
    p_tenant_id,p_mall_id,'payment:wechat:prepay',p_idempotency_key,p_request_hash,
    attempt_id::text,response,now(),now()+interval '24 hours'
  );
  insert into public.audit_logs (
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
    resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via,created_at
  ) values (
    gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_user_id,'user',
    'payment.wechat_prepay_created','payment',payment_id,p_request_id,
    left(coalesce(p_user_agent,''),300),
    jsonb_build_object('orderId',order_row.id,'attemptId',attempt_id,'amountCents',total_cents),
    p_membership_id,coalesce(p_granted_via,'{}'::jsonb),now()
  );
  return response;
end;
$$;

create or replace function public.api_record_wechat_prepay_result(
  p_attempt_id uuid,
  p_prepay_id text,
  p_expires_at timestamptz,
  p_provider_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare attempt public.wechat_payment_attempts%rowtype;
begin
  if length(trim(coalesce(p_prepay_id,''))) not between 1 and 256
    or p_expires_at <= now() or p_expires_at > now()+interval '2 hours 5 minutes'
    or length(coalesce(p_provider_request_id,'')) > 160 then
    raise exception 'WECHAT_PREPAY_RESULT_INVALID';
  end if;
  select * into attempt from public.wechat_payment_attempts
  where id = p_attempt_id for update;
  if not found then raise exception 'WECHAT_PAYMENT_ATTEMPT_NOT_FOUND'; end if;
  if attempt.status = 'succeeded' then
    return public.api_wechat_payment_attempt_payload(attempt.id);
  end if;
  update public.wechat_payment_attempts set
    status = 'prepay_ready',prepay_id = p_prepay_id,
    prepay_expires_at = p_expires_at,provider_request_id = nullif(p_provider_request_id,''),
    last_error_code = null,updated_at = now()
  where id = attempt.id;
  update public.payments set status = 'processing'
  where id = attempt.payment_id and status in ('created','processing');
  return public.api_wechat_payment_attempt_payload(attempt.id);
end;
$$;

create or replace function public.api_mark_wechat_prepay_failed(
  p_attempt_id uuid,
  p_error_code text,
  p_request_id text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if length(trim(coalesce(p_error_code,''))) not between 1 and 120
    or length(trim(coalesce(p_request_id,''))) not between 1 and 160 then
    return false;
  end if;
  update public.wechat_payment_attempts set
    status = 'prepay_failed',last_error_code = trim(p_error_code),updated_at = now()
  where id = p_attempt_id and status in ('created','prepay_ready','prepay_failed','processing');
  return found;
end;
$$;

create or replace function public.api_apply_wechat_payment_observation(
  p_source text,
  p_provider_event_key text,
  p_provider_event_id text,
  p_event_type text,
  p_resource_type text,
  p_app_id text,
  p_mch_id text,
  p_out_trade_no text,
  p_transaction_id text,
  p_trade_state text,
  p_success_time timestamptz,
  p_amount_total bigint,
  p_payer_openid_hash text,
  p_evidence_json jsonb,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  attempt public.wechat_payment_attempts%rowtype;
  payment public.payments%rowtype;
  order_row public.orders%rowtype;
  existing public.wechat_payment_observations%rowtype;
  outcome text := 'recorded';
  reason text;
  applied boolean := false;
  next_paid bigint;
  topic text;
begin
  if p_source not in ('notification','query')
    or length(trim(coalesce(p_provider_event_key,''))) not between 1 and 200
    or length(trim(coalesce(p_provider_event_id,''))) not between 1 and 160
    or length(trim(coalesce(p_event_type,''))) not between 1 and 80
    or length(trim(coalesce(p_resource_type,''))) not between 1 and 80
    or length(trim(coalesce(p_app_id,''))) not between 6 and 64
    or length(trim(coalesce(p_mch_id,''))) not between 6 and 64
    or length(trim(coalesce(p_request_id,''))) not between 1 and 160
    or p_trade_state not in ('SUCCESS','REFUND','NOTPAY','CLOSED','REVOKED','USERPAYING','PAYERROR')
    or p_amount_total < 0
    or (p_payer_openid_hash is not null and p_payer_openid_hash !~ '^[0-9a-f]{64}$')
    or jsonb_typeof(coalesce(p_evidence_json,'{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_evidence_json,'{}'::jsonb)::text) > 8192
    or lower(coalesce(p_evidence_json,'{}'::jsonb)::text) like '%"openid"%' then
    raise exception 'WECHAT_PAYMENT_OBSERVATION_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'wechat-payment-observation:' || p_provider_event_key,0
  ));
  select * into existing from public.wechat_payment_observations
  where provider_event_key = p_provider_event_key;
  if found then
    return jsonb_build_object(
      'applied',false,'duplicate',true,
      'orderId',(select order_id from public.wechat_payment_attempts where id=existing.attempt_id),
      'paymentId',(select payment_id from public.wechat_payment_attempts where id=existing.attempt_id),
      'outcome',existing.outcome,'reasonCode',existing.reason_code
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'wechat-payment-trade:' || coalesce(p_out_trade_no,''),0
  ));
  select * into attempt from public.wechat_payment_attempts
  where out_trade_no = p_out_trade_no for update;

  if not found then
    outcome := 'rejected'; reason := 'attempt_not_found';
  elsif attempt.app_id <> p_app_id then
    outcome := 'rejected'; reason := 'app_id_mismatch';
  elsif attempt.mch_id <> p_mch_id then
    outcome := 'rejected'; reason := 'mch_id_mismatch';
  elsif attempt.amount_total <> p_amount_total then
    outcome := 'rejected'; reason := 'amount_mismatch';
  elsif p_payer_openid_hash is not null and attempt.payer_openid_hash <> p_payer_openid_hash then
    outcome := 'rejected'; reason := 'payer_mismatch';
  elsif p_trade_state = 'SUCCESS' and p_payer_openid_hash is null then
    outcome := 'rejected'; reason := 'payer_evidence_missing';
  elsif p_trade_state = 'SUCCESS' and (
    length(trim(coalesce(p_transaction_id,''))) = 0 or p_success_time is null
  ) then
    outcome := 'rejected'; reason := 'success_evidence_missing';
  end if;

  if attempt.id is not null and outcome <> 'rejected' then
    select * into payment from public.payments where id = attempt.payment_id for update;
    select * into order_row from public.orders where id = attempt.order_id for update;

    if p_source = 'query' then
      update public.wechat_payment_attempts set last_query_at = now(),updated_at = now()
      where id = attempt.id;
    end if;

    if p_trade_state = 'SUCCESS' then
      if exists (
        select 1 from public.wechat_payment_attempts other
        where other.transaction_id = p_transaction_id and other.id <> attempt.id
      ) then
        outcome := 'rejected'; reason := 'transaction_id_conflict';
      elsif payment.status = 'succeeded' then
        if payment.provider_trade_no is distinct from p_transaction_id then
          outcome := 'rejected'; reason := 'transaction_id_mismatch';
        else
          outcome := 'recorded'; reason := 'payment_already_succeeded';
        end if;
      else
        update public.wechat_payment_attempts set
          status = 'succeeded',transaction_id = p_transaction_id,
          provider_trade_state = p_trade_state,last_error_code = null,
          completed_at = coalesce(completed_at,p_success_time),updated_at = now()
        where id = attempt.id;
        update public.payments set
          status = 'succeeded',provider_trade_no = p_transaction_id,
          completed_at = coalesce(completed_at,p_success_time)
        where id = payment.id;

        next_paid := order_row.paid_cents + payment.amount_cents;
        if next_paid <= order_row.payable_cents and order_row.status = 'pending_payment' then
          update public.orders set
            paid_cents = next_paid,
            paid_at = case when next_paid = payable_cents then coalesce(paid_at,p_success_time) else paid_at end,
            status = case when next_paid = payable_cents then 'paid' else status end,
            updated_at = now()
          where id = order_row.id;
          outcome := 'applied'; applied := true; topic := 'order.payment_succeeded';
        else
          update public.orders set
            status = 'refund_pending',updated_at = now()
          where id = order_row.id and status not in ('refund_pending','refunded');
          outcome := 'reconciliation_required'; reason := 'order_state_or_amount_conflict';
          applied := true; topic := 'order.payment_reconciliation_required';
        end if;
      end if;
    elsif p_trade_state in ('CLOSED','REVOKED','PAYERROR') then
      if payment.status <> 'succeeded' then
        update public.wechat_payment_attempts set
          status = case when p_trade_state in ('CLOSED','REVOKED') then 'closed' else 'failed' end,
          provider_trade_state = p_trade_state,last_error_code = lower(p_trade_state),updated_at = now()
        where id = attempt.id;
        update public.payments set
          status = case when p_trade_state in ('CLOSED','REVOKED') then 'closed' else 'failed' end
        where id = payment.id;
        outcome := 'applied'; applied := true; topic := 'order.payment_terminal';
      else
        outcome := 'recorded'; reason := 'payment_already_succeeded';
      end if;
    elsif p_trade_state in ('USERPAYING','NOTPAY') then
      if payment.status <> 'succeeded' then
        update public.wechat_payment_attempts set
          status = case when p_trade_state='USERPAYING' then 'processing' else status end,
          provider_trade_state = p_trade_state,updated_at = now()
        where id = attempt.id;
        update public.payments set
          status = case when p_trade_state='USERPAYING' then 'processing' else status end
        where id = payment.id;
      end if;
      outcome := 'recorded';
    else
      -- REFUND is evidence only. The refund ledger remains the authority for
      -- refund state and must reconcile the amount separately.
      outcome := 'recorded'; reason := 'refund_requires_reconciliation';
    end if;
  end if;

  insert into public.wechat_payment_observations (
    provider_event_key,source,provider_event_id,event_type,resource_type,attempt_id,
    app_id,mch_id,out_trade_no,transaction_id,trade_state,success_time,amount_total,
    payer_openid_hash,evidence_json,evidence_digest,request_id,outcome,reason_code
  ) values (
    p_provider_event_key,p_source,p_provider_event_id,p_event_type,p_resource_type,attempt.id,
    p_app_id,p_mch_id,p_out_trade_no,nullif(p_transaction_id,''),p_trade_state,p_success_time,
    p_amount_total,p_payer_openid_hash,coalesce(p_evidence_json,'{}'::jsonb),
    encode(digest(coalesce(p_evidence_json,'{}'::jsonb)::text,'sha256'),'hex'),
    p_request_id,outcome,reason
  );

  if topic is not null then
    insert into public.wechat_payment_outbox (
      event_key,topic,order_id,payment_id,attempt_id,payload_json
    ) values (
      p_provider_event_key || ':' || topic,topic,attempt.order_id,attempt.payment_id,attempt.id,
      jsonb_build_object(
        'orderId',attempt.order_id,'paymentId',attempt.payment_id,'attemptId',attempt.id,
        'outTradeNo',attempt.out_trade_no,'transactionId',p_transaction_id,
        'tradeState',p_trade_state,'amountCents',p_amount_total,'outcome',outcome
      )
    ) on conflict (event_key) do nothing;
  end if;

  if applied then
    insert into public.audit_logs (
      id,tenant_id,enterprise_id,mall_id,actor_type,action,resource_type,
      resource_id,request_id,after_json,created_at
    ) select
      gen_random_uuid()::text,order_row.tenant_id,order_row.enterprise_id,order_row.mall_id,
      'system','payment.wechat_observation_applied','payment',attempt.payment_id,p_request_id,
      jsonb_build_object(
        'source',p_source,'tradeState',p_trade_state,'outcome',outcome,
        'providerEventId',p_provider_event_id
      ),now();
  end if;

  return jsonb_build_object(
    'applied',applied,'duplicate',false,'orderId',attempt.order_id,
    'paymentId',attempt.payment_id,'outcome',outcome,'reasonCode',reason
  );
end;
$$;

create or replace function public.api_apply_wechat_payment_notification(
  p_notification_id text,
  p_event_type text,
  p_resource_type text,
  p_app_id text,
  p_mch_id text,
  p_out_trade_no text,
  p_transaction_id text,
  p_trade_state text,
  p_success_time timestamptz,
  p_amount_total bigint,
  p_payer_openid_hash text,
  p_raw_summary jsonb,
  p_request_id text
) returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.api_apply_wechat_payment_observation(
    'notification','notification:' || p_notification_id,p_notification_id,
    p_event_type,p_resource_type,p_app_id,p_mch_id,p_out_trade_no,p_transaction_id,
    p_trade_state,p_success_time,p_amount_total,p_payer_openid_hash,p_raw_summary,p_request_id
  );
$$;

create or replace function public.api_apply_wechat_payment_query(
  p_query_key text,
  p_app_id text,
  p_mch_id text,
  p_out_trade_no text,
  p_transaction_id text,
  p_trade_state text,
  p_success_time timestamptz,
  p_amount_total bigint,
  p_payer_openid_hash text,
  p_raw_summary jsonb,
  p_request_id text
) returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.api_apply_wechat_payment_observation(
    'query','query:' || p_query_key,p_query_key,'QUERY.TRANSACTION','transaction',
    p_app_id,p_mch_id,p_out_trade_no,p_transaction_id,p_trade_state,p_success_time,
    p_amount_total,p_payer_openid_hash,p_raw_summary,p_request_id
  );
$$;

create or replace function public.api_wechat_payment_status(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text,
  p_membership_id text,
  p_order_id text
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'orderId',orders.id,'orderNo',orders.order_no,'orderStatus',orders.status,
    'paymentStatus',coalesce(attempt.status,'not_started'),
    'paidAt',orders.paid_at,'providerTradeNo',payment.provider_trade_no,
    'totalCents',coalesce(attempt.amount_total,orders.payable_cents-orders.paid_cents),
    'prepayExpiresAt',attempt.prepay_expires_at,'lastQueryAt',attempt.last_query_at,
    'needsQuery',coalesce(
      attempt.status in ('prepay_ready','processing')
        and (attempt.last_query_at is null or attempt.last_query_at < now()-interval '15 seconds'),
      false
    )
  )
  from public.orders orders
  join public.memberships membership
    on membership.id = p_membership_id
   and membership.context_user_id = p_user_id
   and membership.tenant_id = p_tenant_id
   and membership.enterprise_id = p_enterprise_id
   and membership.mall_id = p_mall_id
   and membership.target = 'storefront'
   and membership.status = 'active'
   and (membership.expires_at is null or membership.expires_at > now())
  join public.members member
    on member.id = membership.member_id and member.status = 'active'
  join public.users user_row
    on user_row.id = membership.context_user_id and user_row.status = 'active'
  left join public.wechat_payment_attempts attempt on attempt.order_id = orders.id
  left join public.payments payment on payment.id = attempt.payment_id
  where orders.id = p_order_id
    and orders.tenant_id = p_tenant_id
    and orders.enterprise_id = p_enterprise_id
    and orders.mall_id = p_mall_id
    and orders.user_id = p_user_id;
$$;

create or replace function public.api_order_detail_by_no(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text,
  p_membership_id text,
  p_order_no text
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id',orders.id,'orderNo',orders.order_no,'status',orders.status,
    'goodsAmountCents',orders.goods_amount_cents,'discountCents',orders.discount_cents,
    'payableCents',orders.payable_cents,'paidCents',orders.paid_cents,
    'createdAt',orders.created_at,'paidAt',orders.paid_at,'updatedAt',orders.updated_at,
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',item.id,'productId',item.product_id,'skuId',item.sku_id,
        'name',item.product_name_snapshot,'specs',item.specs_snapshot_json,
        'unitPriceCents',item.unit_price_cents,'quantity',item.quantity,
        'lineAmountCents',item.line_amount_cents
      ) order by item.id)
      from public.order_items item where item.order_id = orders.id
    ),'[]'::jsonb),
    'wechatPayment',(
      select jsonb_build_object(
        'status',attempt.status,'amountCents',attempt.amount_total,
        'prepayExpiresAt',attempt.prepay_expires_at,
        'providerTradeNo',payment.provider_trade_no
      )
      from public.wechat_payment_attempts attempt
      join public.payments payment on payment.id = attempt.payment_id
      where attempt.order_id = orders.id
    )
  )
  from public.orders orders
  join public.memberships membership
    on membership.id = p_membership_id
   and membership.context_user_id = p_user_id
   and membership.tenant_id = p_tenant_id
   and membership.enterprise_id = p_enterprise_id
   and membership.mall_id = p_mall_id
   and membership.target = 'storefront'
   and membership.status = 'active'
   and (membership.expires_at is null or membership.expires_at > now())
  join public.members member
    on member.id = membership.member_id and member.status = 'active'
  join public.users user_row
    on user_row.id = membership.context_user_id and user_row.status = 'active'
  where orders.order_no = p_order_no
    and orders.tenant_id = p_tenant_id
    and orders.enterprise_id = p_enterprise_id
    and orders.mall_id = p_mall_id
    and orders.user_id = p_user_id;
$$;

create or replace function public.api_claim_wechat_payment_outbox(
  p_worker_id text,
  p_limit integer default 20
) returns table (
  id uuid, event_key text, topic text, payload_json jsonb, delivery_attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if length(trim(coalesce(p_worker_id,''))) not between 1 and 120 then
    return;
  end if;
  return query
  with claimable as (
    select outbox.id from public.wechat_payment_outbox outbox
    where (
      outbox.status = 'pending'
      or (outbox.status = 'processing' and outbox.locked_at < now()-interval '2 minutes')
    ) and outbox.available_at <= now()
    order by outbox.created_at
    for update skip locked
    limit least(greatest(p_limit,1),100)
  )
  update public.wechat_payment_outbox outbox set
    status = 'processing',delivery_attempts = delivery_attempts+1,
    locked_at = now(),locked_by = p_worker_id,updated_at = now()
  from claimable where outbox.id = claimable.id
  returning outbox.id,outbox.event_key,outbox.topic,outbox.payload_json,outbox.delivery_attempts;
end;
$$;

create or replace function public.api_complete_wechat_payment_outbox(
  p_event_id uuid,
  p_worker_id text,
  p_succeeded boolean,
  p_error_code text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.wechat_payment_outbox set
    status = case
      when p_succeeded then 'delivered'
      when delivery_attempts >= 12 then 'dead_letter'
      else 'pending'
    end,
    delivered_at = case when p_succeeded then now() else null end,
    available_at = case
      when p_succeeded then available_at
      else now() + make_interval(
        secs => least(3600.0,30.0*power(2.0,least(delivery_attempts,7)))::double precision
      )
    end,
    last_error_code = case when p_succeeded then null else left(coalesce(p_error_code,'delivery_failed'),120) end,
    locked_at = null,locked_by = null,updated_at = now()
  where id = p_event_id and status = 'processing' and locked_by = p_worker_id;
  return found;
end;
$$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'api_resolve_wechat_identity(text,text)',
    'api_create_wechat_binding_challenge(text,text,text,timestamptz)',
    'api_bind_wechat_identity(uuid,text,text,text,text)',
    'api_wechat_payment_attempt_payload(uuid)',
    'api_create_wechat_prepay_attempt(text,text,text,text,text,text,text,text,text,text,text,text,jsonb)',
    'api_record_wechat_prepay_result(uuid,text,timestamptz,text)',
    'api_mark_wechat_prepay_failed(uuid,text,text)',
    'api_apply_wechat_payment_observation(text,text,text,text,text,text,text,text,text,text,timestamptz,bigint,text,jsonb,text)',
    'api_apply_wechat_payment_notification(text,text,text,text,text,text,text,text,timestamptz,bigint,text,jsonb,text)',
    'api_apply_wechat_payment_query(text,text,text,text,text,text,timestamptz,bigint,text,jsonb,text)',
    'api_wechat_payment_status(text,text,text,text,text,text)',
    'api_order_detail_by_no(text,text,text,text,text,text)',
    'api_claim_wechat_payment_outbox(text,integer)',
    'api_complete_wechat_payment_outbox(uuid,text,boolean,text)'
  ] loop
    execute 'revoke all on function public.'||signature||' from public,anon,authenticated';
  end loop;
end $$;

grant execute on function public.api_resolve_wechat_identity(text,text) to service_role;
grant execute on function public.api_create_wechat_binding_challenge(text,text,text,timestamptz) to service_role;
grant execute on function public.api_bind_wechat_identity(uuid,text,text,text,text) to service_role;
grant execute on function public.api_create_wechat_prepay_attempt(text,text,text,text,text,text,text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.api_record_wechat_prepay_result(uuid,text,timestamptz,text) to service_role;
grant execute on function public.api_mark_wechat_prepay_failed(uuid,text,text) to service_role;
grant execute on function public.api_apply_wechat_payment_notification(text,text,text,text,text,text,text,text,timestamptz,bigint,text,jsonb,text) to service_role;
grant execute on function public.api_apply_wechat_payment_query(text,text,text,text,text,text,timestamptz,bigint,text,jsonb,text) to service_role;
grant execute on function public.api_wechat_payment_status(text,text,text,text,text,text) to service_role;
grant execute on function public.api_order_detail_by_no(text,text,text,text,text,text) to service_role;
grant execute on function public.api_claim_wechat_payment_outbox(text,integer) to service_role;
grant execute on function public.api_complete_wechat_payment_outbox(uuid,text,boolean,text) to service_role;

notify pgrst, 'reload schema';
