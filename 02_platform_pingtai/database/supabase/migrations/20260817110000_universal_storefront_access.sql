-- Any active back-office member may also shop with the same credentials.
-- The storefront membership is deliberately separate and always constrained
-- to the person's own account. No admin role or broad resource scope is ever
-- copied into the shopping identity.

begin;

create or replace function public.ensure_storefront_membership_for_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  storefront_membership_id text := 'membership-storefront-for-' || new.id;
  employee_role_id text;
begin
  if new.target <> 'admin' or new.context_user_id is null then
    return new;
  end if;

  insert into public.memberships (
    id, member_id, context_user_id, tenant_id, enterprise_id, mall_id,
    supplier_id, target, status, expires_at
  )
  select
    storefront_membership_id, new.member_id, new.context_user_id,
    new.tenant_id, new.enterprise_id, new.mall_id, new.supplier_id,
    'storefront', new.status, new.expires_at
  where not exists (
    select 1
    from public.memberships storefront
    where storefront.member_id = new.member_id
      and storefront.target = 'storefront'
      and storefront.tenant_id = new.tenant_id
      and storefront.enterprise_id is not distinct from new.enterprise_id
      and storefront.mall_id is not distinct from new.mall_id
      and storefront.supplier_id is not distinct from new.supplier_id
      and storefront.context_user_id is not distinct from new.context_user_id
  )
  on conflict (id) do nothing;

  select storefront.id into storefront_membership_id
  from public.memberships storefront
  where storefront.member_id = new.member_id
    and storefront.target = 'storefront'
    and storefront.tenant_id = new.tenant_id
    and storefront.enterprise_id is not distinct from new.enterprise_id
    and storefront.mall_id is not distinct from new.mall_id
    and storefront.supplier_id is not distinct from new.supplier_id
    and storefront.context_user_id is not distinct from new.context_user_id
  order by storefront.created_at, storefront.id
  limit 1;

  select role.id into employee_role_id
  from public.roles role
  where role.tenant_id = new.tenant_id and role.code = 'employee'
  order by role.id
  limit 1;

  if storefront_membership_id is not null and employee_role_id is not null then
    insert into public.membership_roles (membership_id, role_id)
    values (storefront_membership_id, employee_role_id)
    on conflict (membership_id, role_id) do update
      set revoked_at = null, expires_at = null;
  end if;

  if storefront_membership_id is not null then
    insert into public.membership_scopes (membership_id, scope_kind, resource_id)
    values (storefront_membership_id, 'self', new.context_user_id)
    on conflict do nothing;
  end if;

  -- Match a normal registered customer's initial wallet state without
  -- granting money or unfreezing an existing account.
  if new.enterprise_id is not null and new.mall_id is not null then
    insert into public.welfare_accounts (
      id, tenant_id, enterprise_id, mall_id, user_id, account_type, balance_cents, status
    ) values (
      'account-storefront-for-' || new.id, new.tenant_id, new.enterprise_id,
      new.mall_id, new.context_user_id, 'welfare', 0, 'active'
    )
    on conflict (mall_id, user_id, account_type) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_ensure_storefront_for_admin on public.memberships;
create trigger memberships_ensure_storefront_for_admin
after insert on public.memberships
for each row execute function public.ensure_storefront_membership_for_admin();

-- Backfill existing operators with the same least-privileged membership.
insert into public.memberships (
  id, member_id, context_user_id, tenant_id, enterprise_id, mall_id,
  supplier_id, target, status, expires_at
)
select
  'membership-storefront-for-' || admin.id,
  admin.member_id,
  admin.context_user_id,
  admin.tenant_id,
  admin.enterprise_id,
  admin.mall_id,
  admin.supplier_id,
  'storefront',
  admin.status,
  admin.expires_at
from public.memberships admin
where admin.target = 'admin'
  and admin.context_user_id is not null
  and not exists (
    select 1
    from public.memberships storefront
    where storefront.member_id = admin.member_id
      and storefront.target = 'storefront'
      and storefront.tenant_id = admin.tenant_id
      and storefront.enterprise_id is not distinct from admin.enterprise_id
      and storefront.mall_id is not distinct from admin.mall_id
      and storefront.supplier_id is not distinct from admin.supplier_id
      and storefront.context_user_id is not distinct from admin.context_user_id
  )
on conflict (id) do nothing;

insert into public.membership_roles (membership_id, role_id)
select storefront.id, employee_role.id
from public.memberships storefront
join public.memberships admin
  on storefront.id = 'membership-storefront-for-' || admin.id
join public.roles employee_role
  on employee_role.tenant_id = storefront.tenant_id and employee_role.code = 'employee'
where storefront.target = 'storefront'
  and admin.target = 'admin'
on conflict (membership_id, role_id) do update
  set revoked_at = null, expires_at = null;

insert into public.membership_scopes (membership_id, scope_kind, resource_id)
select storefront.id, 'self', storefront.context_user_id
from public.memberships storefront
join public.memberships admin
  on storefront.id = 'membership-storefront-for-' || admin.id
where storefront.target = 'storefront'
  and admin.target = 'admin'
  and storefront.context_user_id is not null
on conflict do nothing;

insert into public.welfare_accounts (
  id, tenant_id, enterprise_id, mall_id, user_id, account_type, balance_cents, status
)
select
  'account-storefront-for-' || admin.id,
  storefront.tenant_id,
  storefront.enterprise_id,
  storefront.mall_id,
  storefront.context_user_id,
  'welfare',
  0,
  'active'
from public.memberships storefront
join public.memberships admin
  on storefront.id = 'membership-storefront-for-' || admin.id
where storefront.target = 'storefront'
  and admin.target = 'admin'
  and storefront.context_user_id is not null
  and storefront.enterprise_id is not null
  and storefront.mall_id is not null
on conflict (mall_id, user_id, account_type) do nothing;

-- A credential is resolved once, then all of its active entrances are returned.
-- This is generic account behaviour: no test aliases, balance top-ups, or
-- phone-verification overrides are introduced here.
create or replace function public.api_local_login_candidate(
  p_provider text, p_subject text, p_target text default null
) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'memberId', member.id,
    'membershipId', selected.id,
    'target', selected.target,
    'passwordHash', credential.password_hash,
    'mustResetPassword', credential.must_reset_password,
    'entrances', coalesce((
      select jsonb_agg(
        jsonb_build_object('target', entrance.target, 'membershipId', entrance.id)
        order by case when entrance.target = 'storefront' then 0 else 1 end, entrance.created_at, entrance.id
      )
      from public.memberships entrance
      where entrance.member_id = member.id
        and entrance.status = 'active'
        and (entrance.expires_at is null or entrance.expires_at > now())
    ), '[]'::jsonb)
  )
  from public.member_login_aliases alias
  join public.members member on member.id = alias.member_id and member.status = 'active'
  join public.member_credentials credential on credential.member_id = member.id
  cross join lateral (
    select membership.id, membership.target
    from public.memberships membership
    where membership.member_id = member.id
      and membership.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
      and (p_target is null or membership.target = p_target)
    order by case when membership.target = 'storefront' then 0 else 1 end, membership.created_at, membership.id
    limit 1
  ) selected
  where alias.provider = p_provider and alias.subject = p_subject;
$$;

create or replace function public.api_member_entrances(p_member_id text)
returns table(target text, membership_id text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select membership.target, membership.id
  from public.memberships membership
  where membership.member_id = p_member_id
    and membership.status = 'active'
    and (membership.expires_at is null or membership.expires_at > now())
  order by case when membership.target = 'storefront' then 0 else 1 end, membership.created_at, membership.id;
$$;

revoke all on function public.api_member_entrances(text) from public, anon, authenticated;
grant execute on function public.api_member_entrances(text) to service_role;

commit;
