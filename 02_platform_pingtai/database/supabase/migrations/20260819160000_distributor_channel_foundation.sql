-- D1 distributor foundation: platform provisioning, tenant attachment and
-- privacy-preserving aggregate reads. Existing org hierarchy remains the
-- source of truth; no member or order detail is exposed by these RPCs.

insert into public.permissions (id, code, name, category, risk_level, is_mvp) values
  ('permission-distributor-read', 'distributor.read', '查看分销商', '分销', 'low', true),
  ('permission-distributor-manage', 'distributor.manage', '管理分销商', '分销', 'critical', true),
  ('permission-distributor-tenant-attach', 'distributor.tenant.attach', '挂载租户到分销商', '分销', 'critical', true)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  risk_level = excluded.risk_level,
  is_mvp = excluded.is_mvp;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
join public.permissions permission on permission.code in (
  'distributor.read', 'distributor.manage', 'distributor.tenant.attach'
)
where role.code = 'platform_owner'
on conflict do nothing;

create table if not exists public.distributors (
  id text primary key,
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9_-]{2,39}$'),
  name text not null check (length(trim(name)) between 2 and 120),
  org_unit_id text not null unique references public.org_units(id) on delete restrict,
  contact_json jsonb not null default '{}'::jsonb check (jsonb_typeof(contact_json) = 'object'),
  settlement_mode text not null default 'manual' check (settlement_mode in ('manual', 'service_provider')),
  status text not null default 'draft' check (status in ('draft', 'active', 'suspended', 'terminated')),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.distributor_tenants (
  distributor_id text not null references public.distributors(id) on delete restrict,
  tenant_id text not null references public.tenants(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  agreement_evidence_json jsonb not null default '{}'::jsonb check (jsonb_typeof(agreement_evidence_json) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'active', 'expired', 'terminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (distributor_id, tenant_id),
  check (ends_at is null or ends_at > starts_at)
);

create unique index if not exists distributor_tenants_one_active_owner
on public.distributor_tenants (tenant_id) where status = 'active';
create index if not exists distributor_tenants_active_lookup
on public.distributor_tenants (distributor_id, status, starts_at);
create index if not exists orders_distributor_monthly_metrics
on public.orders (tenant_id, paid_at) where paid_at is not null;
create index if not exists refunds_distributor_net_gmv
on public.refunds (order_id, status) include (amount_cents);

create table if not exists public.distributor_operation_keys (
  actor_membership_id text not null references public.memberships(id) on delete restrict,
  action text not null,
  idempotency_key text not null,
  request_hash text not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_membership_id, action, idempotency_key)
);

revoke all on table public.distributors, public.distributor_tenants, public.distributor_operation_keys
from public, anon, authenticated;
alter table public.distributors enable row level security;
alter table public.distributor_tenants enable row level security;
alter table public.distributor_operation_keys enable row level security;

create or replace function public.api_distributor_actor_has_permission(
  p_actor_membership_id text,
  p_permission_code text
) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  with actor as (
    select membership.id
    from public.memberships membership
    where membership.id = p_actor_membership_id
      and membership.target = 'admin'
      and membership.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
  ), granted as (
    select permission.code
    from actor
    join public.membership_roles membership_role on membership_role.membership_id = actor.id
    join public.roles role on role.id = membership_role.role_id and role.status = 'active'
    join public.role_permissions role_permission on role_permission.role_id = role.id
    join public.permissions permission on permission.id = role_permission.permission_id
    where membership_role.revoked_at is null
      and (membership_role.expires_at is null or membership_role.expires_at > now())
    union
    select permission.code
    from actor
    join public.membership_permission_overrides override on override.membership_id = actor.id
    join public.permissions permission on permission.id = override.permission_id
    where override.effect = 'allow' and override.revoked_at is null
      and (override.expires_at is null or override.expires_at > now())
  ), denied as (
    select permission.code
    from actor
    join public.membership_permission_overrides override on override.membership_id = actor.id
    join public.permissions permission on permission.id = override.permission_id
    where override.effect = 'deny' and override.revoked_at is null
      and (override.expires_at is null or override.expires_at > now())
  )
  select exists(select 1 from granted where code = p_permission_code)
    and not exists(select 1 from denied where code = p_permission_code);
$$;

create or replace function public.api_distributor_actor_is_platform(
  p_actor_membership_id text,
  p_actor_user_id text
) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.memberships membership
    join public.membership_scopes scope on scope.membership_id = membership.id
    join public.org_units platform on platform.id = scope.resource_id
    where membership.id = p_actor_membership_id
      and membership.context_user_id = p_actor_user_id
      and membership.target = 'admin'
      and membership.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
      and scope.scope_kind = 'platform'
      and platform.kind = 'platform'
      and platform.status = 'active'
  );
$$;

create or replace function public.api_platform_create_distributor(
  p_actor_membership_id text,
  p_actor_user_id text,
  p_code text,
  p_name text,
  p_contact_json jsonb,
  p_settlement_mode text,
  p_metadata_json jsonb,
  p_reason text,
  p_idempotency_key text,
  p_request_hash text,
  p_request_id text,
  p_user_agent text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor public.memberships%rowtype;
  v_platform public.org_units%rowtype;
  v_distributor_id text := gen_random_uuid()::text;
  v_org_unit_id text := 'org-distributor-' || gen_random_uuid()::text;
  v_code text := lower(trim(coalesce(p_code, '')));
  v_response jsonb;
  v_existing public.distributor_operation_keys%rowtype;
begin
  if not public.api_distributor_actor_is_platform(p_actor_membership_id, p_actor_user_id)
     or not public.api_distributor_actor_has_permission(p_actor_membership_id, 'distributor.manage') then
    raise exception 'DISTRIBUTOR_PLATFORM_SCOPE_REQUIRED';
  end if;
  if v_code !~ '^[a-z0-9][a-z0-9_-]{2,39}$'
     or length(trim(coalesce(p_name, ''))) not between 2 and 120
     or coalesce(p_settlement_mode, '') not in ('manual', 'service_provider')
     or jsonb_typeof(coalesce(p_contact_json, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_metadata_json, '{}'::jsonb)) <> 'object'
     or length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'DISTRIBUTOR_INPUT_INVALID';
  end if;
  if length(trim(coalesce(p_idempotency_key, ''))) not between 8 and 120
     or length(trim(coalesce(p_request_hash, ''))) < 16 then
    raise exception 'IDEMPOTENCY_KEY_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_actor_membership_id || ':create-distributor:' || p_idempotency_key));
  select * into v_existing from public.distributor_operation_keys
  where actor_membership_id = p_actor_membership_id
    and action = 'create_distributor'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;

  if exists(select 1 from public.distributors where code = v_code) then
    raise exception 'DISTRIBUTOR_CODE_CONFLICT';
  end if;
  select * into v_actor from public.memberships where id = p_actor_membership_id;
  select platform.* into v_platform
  from public.membership_scopes scope
  join public.org_units platform on platform.id = scope.resource_id
  where scope.membership_id = p_actor_membership_id and scope.scope_kind = 'platform'
  order by scope.created_at limit 1;

  insert into public.org_units (
    id, tenant_id, parent_id, kind, code, name, source_type, source_id, status
  ) values (
    v_org_unit_id, null, v_platform.id, 'distributor', v_code, trim(p_name),
    'distributor', v_distributor_id, 'active'
  );
  insert into public.distributors (
    id, code, name, org_unit_id, contact_json, settlement_mode, status, metadata_json
  ) values (
    v_distributor_id, v_code, trim(p_name), v_org_unit_id,
    coalesce(p_contact_json, '{}'::jsonb), p_settlement_mode, 'active',
    coalesce(p_metadata_json, '{}'::jsonb)
  );
  v_response := jsonb_build_object(
    'distributor', jsonb_build_object(
      'id', v_distributor_id, 'code', v_code, 'name', trim(p_name),
      'orgUnitId', v_org_unit_id, 'status', 'active', 'settlementMode', p_settlement_mode
    )
  );
  insert into public.distributor_operation_keys values (
    p_actor_membership_id, 'create_distributor', p_idempotency_key, p_request_hash, v_response, now()
  );
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json, membership_id, granted_via
  ) values (
    gen_random_uuid()::text, v_actor.tenant_id, v_actor.enterprise_id, v_actor.mall_id,
    p_actor_user_id, 'admin', 'distributor.created', 'distributor', v_distributor_id,
    p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('code', v_code, 'name', trim(p_name), 'reason', trim(p_reason)),
    p_actor_membership_id,
    jsonb_build_object('permission', 'distributor.manage', 'scope', 'platform')
  );
  return v_response;
end;
$$;

create or replace function public.api_platform_attach_tenant_to_distributor(
  p_actor_membership_id text,
  p_actor_user_id text,
  p_distributor_id text,
  p_tenant_id text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_agreement_evidence_json jsonb,
  p_reason text,
  p_idempotency_key text,
  p_request_hash text,
  p_request_id text,
  p_user_agent text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor public.memberships%rowtype;
  v_distributor public.distributors%rowtype;
  v_tenant public.tenants%rowtype;
  v_tenant_node public.org_units%rowtype;
  v_starts_at timestamptz := coalesce(p_starts_at, now());
  v_existing public.distributor_operation_keys%rowtype;
  v_response jsonb;
begin
  if not public.api_distributor_actor_is_platform(p_actor_membership_id, p_actor_user_id)
     or not public.api_distributor_actor_has_permission(p_actor_membership_id, 'distributor.tenant.attach') then
    raise exception 'DISTRIBUTOR_PLATFORM_SCOPE_REQUIRED';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 4
     or jsonb_typeof(coalesce(p_agreement_evidence_json, '{}'::jsonb)) <> 'object'
     or length(trim(coalesce(p_idempotency_key, ''))) not between 8 and 120
     or length(trim(coalesce(p_request_hash, ''))) < 16
     or (p_ends_at is not null and p_ends_at <= v_starts_at) then
    raise exception 'DISTRIBUTOR_TENANT_ATTACHMENT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_actor_membership_id || ':attach-tenant:' || p_idempotency_key));
  select * into v_existing from public.distributor_operation_keys
  where actor_membership_id = p_actor_membership_id
    and action = 'attach_tenant'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;

  select * into v_distributor from public.distributors
  where id = p_distributor_id and status in ('draft', 'active') for update;
  if not found then raise exception 'DISTRIBUTOR_NOT_FOUND'; end if;
  select * into v_tenant from public.tenants where id = p_tenant_id and status = 'active';
  if not found then raise exception 'DISTRIBUTOR_TENANT_NOT_FOUND'; end if;
  select * into v_tenant_node from public.org_units
  where source_type = 'tenant' and source_id = p_tenant_id for update;
  if not found then raise exception 'DISTRIBUTOR_TENANT_ORG_UNIT_NOT_FOUND'; end if;
  if exists (
    select 1 from public.distributor_tenants relation
    where relation.tenant_id = p_tenant_id and relation.status = 'active'
      and relation.distributor_id <> p_distributor_id
  ) then raise exception 'TENANT_ALREADY_ATTACHED_TO_DISTRIBUTOR'; end if;

  insert into public.distributor_tenants (
    distributor_id, tenant_id, starts_at, ends_at, agreement_evidence_json, status
  ) values (
    p_distributor_id, p_tenant_id, v_starts_at, p_ends_at,
    coalesce(p_agreement_evidence_json, '{}'::jsonb), 'active'
  ) on conflict (distributor_id, tenant_id) do update set
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    agreement_evidence_json = excluded.agreement_evidence_json,
    status = 'active',
    updated_at = now();

  update public.org_units set parent_id = v_distributor.org_unit_id, updated_at = now()
  where id = v_tenant_node.id and parent_id is distinct from v_distributor.org_unit_id;
  if not exists (
    select 1 from public.org_unit_closure
    where ancestor_id = v_distributor.org_unit_id and descendant_id = v_tenant_node.id and depth = 1
  ) then raise exception 'DISTRIBUTOR_HIERARCHY_REBUILD_FAILED'; end if;

  v_response := jsonb_build_object(
    'attachment', jsonb_build_object(
      'distributorId', p_distributor_id, 'tenantId', p_tenant_id, 'status', 'active',
      'startsAt', v_starts_at, 'endsAt', p_ends_at
    )
  );
  insert into public.distributor_operation_keys values (
    p_actor_membership_id, 'attach_tenant', p_idempotency_key, p_request_hash, v_response, now()
  );
  select * into v_actor from public.memberships where id = p_actor_membership_id;
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, before_json, after_json,
    membership_id, granted_via
  ) values (
    gen_random_uuid()::text, v_actor.tenant_id, v_actor.enterprise_id, v_actor.mall_id,
    p_actor_user_id, 'admin', 'distributor.tenant.attached', 'tenant', p_tenant_id,
    p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('previousParentOrgUnitId', v_tenant_node.parent_id),
    jsonb_build_object('distributorId', p_distributor_id, 'reason', trim(p_reason)),
    p_actor_membership_id,
    jsonb_build_object('permission', 'distributor.tenant.attach', 'scope', 'platform')
  );
  return v_response;
end;
$$;

create or replace function public.api_platform_distributors(
  p_actor_membership_id text,
  p_actor_user_id text
) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.api_distributor_actor_is_platform(p_actor_membership_id, p_actor_user_id)
     or not public.api_distributor_actor_has_permission(p_actor_membership_id, 'distributor.read') then
    raise exception 'DISTRIBUTOR_PLATFORM_SCOPE_REQUIRED';
  end if;
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', distributor.id, 'code', distributor.code, 'name', distributor.name,
        'status', distributor.status, 'settlementMode', distributor.settlement_mode,
        'tenantCount', (select count(*) from public.distributor_tenants relation
          where relation.distributor_id = distributor.id and relation.status = 'active'),
        'createdAt', distributor.created_at
      ) order by distributor.created_at desc)
      from public.distributors distributor
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.api_distributor_center(
  p_actor_membership_id text,
  p_actor_user_id text,
  p_distributor_id text,
  p_tenant_id text default null
) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_month_start timestamptz := date_trunc('month', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai';
  v_is_platform boolean;
  v_has_scope boolean;
  v_tenants jsonb;
  v_overview jsonb;
begin
  v_is_platform := public.api_distributor_actor_is_platform(p_actor_membership_id, p_actor_user_id);
  select exists (
    select 1 from public.memberships membership
    join public.membership_scopes scope on scope.membership_id = membership.id
    where membership.id = p_actor_membership_id
      and membership.context_user_id = p_actor_user_id
      and membership.target = 'admin' and membership.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
      and scope.scope_kind = 'distributor' and scope.resource_id = p_distributor_id
  ) into v_has_scope;
  if (not v_is_platform and not v_has_scope)
     or not public.api_distributor_actor_has_permission(p_actor_membership_id, 'distributor.read') then
    raise exception 'DISTRIBUTOR_SCOPE_FORBIDDEN';
  end if;
  if not exists(select 1 from public.distributors where id = p_distributor_id and status <> 'terminated') then
    raise exception 'DISTRIBUTOR_NOT_FOUND';
  end if;
  if p_tenant_id is not null and not exists (
    select 1 from public.distributor_tenants
    where distributor_id = p_distributor_id and tenant_id = p_tenant_id and status = 'active'
  ) then raise exception 'DISTRIBUTOR_TENANT_NOT_FOUND'; end if;

  with tenant_metrics as (
    select tenant.id, tenant.name, tenant.status, relation.starts_at,
      mall_metrics.mall_count,
      order_metrics.order_count,
      order_metrics.gmv_cents
    from public.distributor_tenants relation
    join public.tenants tenant on tenant.id = relation.tenant_id
    left join lateral (
      select count(*)::integer mall_count
      from public.malls mall where mall.tenant_id = tenant.id and mall.status = 'active'
    ) mall_metrics on true
    left join lateral (
      select count(*)::integer order_count,
        greatest(0, coalesce(sum(paid_order.paid_cents - paid_order.refunded_cents), 0))::bigint gmv_cents
      from (
        select orders.id, orders.paid_cents,
          coalesce((select sum(refund.amount_cents) from public.refunds refund
            where refund.order_id = orders.id and refund.status = 'succeeded'), 0)::bigint refunded_cents
        from public.orders orders
        where orders.tenant_id = tenant.id and orders.paid_at >= v_month_start
      ) paid_order
    ) order_metrics on true
    where relation.distributor_id = p_distributor_id and relation.status = 'active'
      and (p_tenant_id is null or tenant.id = p_tenant_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'status', status, 'startsAt', starts_at,
    'activeMallCount', mall_count, 'currentMonthOrderCount', order_count,
    'currentMonthGmvCents', gmv_cents,
    'configuration', jsonb_build_object(
      'completedSteps', case when mall_count > 0 then 1 else 0 end,
      'totalSteps', 4,
      'mall', jsonb_build_object('status', case when mall_count > 0 then 'ready' else 'notProvisioned' end),
      'branding', jsonb_build_object('status', 'notProvisioned'),
      'domain', jsonb_build_object('status', 'notProvisioned'),
      'payment', jsonb_build_object('status', 'notProvisioned')
    )
  ) order by starts_at desc), '[]'::jsonb) into v_tenants from tenant_metrics;

  select jsonb_build_object(
    'tenantCount', count(*),
    'activeMallCount', coalesce(sum((item->>'activeMallCount')::integer), 0),
    'currentMonthOrderCount', coalesce(sum((item->>'currentMonthOrderCount')::integer), 0),
    'currentMonthGmvCents', coalesce(sum((item->>'currentMonthGmvCents')::bigint), 0),
    'pendingCommission', jsonb_build_object('status', 'notProvisioned')
  ) into v_overview from jsonb_array_elements(v_tenants) item;

  return jsonb_build_object(
    'distributorId', p_distributor_id,
    'overview', v_overview,
    'tenants', v_tenants,
    'metricDefinition', jsonb_build_object(
      'timezone', 'Asia/Shanghai',
      'orderCount', '本月已付款订单数',
      'gmv', '本月已付款订单实付金额减去其已成功退款金额'
    )
  );
end;
$$;

revoke all on function public.api_distributor_actor_has_permission(text, text) from public, anon, authenticated;
revoke all on function public.api_distributor_actor_is_platform(text, text) from public, anon, authenticated;
revoke all on function public.api_platform_create_distributor(text, text, text, text, jsonb, text, jsonb, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.api_platform_attach_tenant_to_distributor(text, text, text, text, timestamptz, timestamptz, jsonb, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.api_platform_distributors(text, text) from public, anon, authenticated;
revoke all on function public.api_distributor_center(text, text, text, text) from public, anon, authenticated;

grant execute on function public.api_platform_create_distributor(text, text, text, text, jsonb, text, jsonb, text, text, text, text, text) to service_role;
grant execute on function public.api_platform_attach_tenant_to_distributor(text, text, text, text, timestamptz, timestamptz, jsonb, text, text, text, text, text) to service_role;
grant execute on function public.api_platform_distributors(text, text) to service_role;
grant execute on function public.api_distributor_center(text, text, text, text) to service_role;
