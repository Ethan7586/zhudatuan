-- Hierarchical organization scopes without removing the existing tenant,
-- enterprise, mall and department fast-path columns.

create table if not exists public.org_units (
  id text primary key,
  tenant_id text references public.tenants(id) on delete restrict,
  parent_id text references public.org_units(id) on delete restrict,
  kind text not null check (kind in ('platform','tenant','distributor','enterprise','mall','department')),
  code text not null,
  name text not null,
  source_type text,
  source_id text,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'platform' and tenant_id is null and parent_id is null) or kind <> 'platform'),
  check (kind in ('platform','distributor') or tenant_id is not null),
  check ((source_type is null and source_id is null) or (source_type is not null and source_id is not null))
);

create unique index if not exists org_units_one_platform_root
on public.org_units ((kind)) where kind = 'platform';

create unique index if not exists org_units_source_mapping
on public.org_units (source_type, source_id) where source_type is not null and source_id is not null;

create unique index if not exists org_units_sibling_code
on public.org_units (tenant_id, parent_id, kind, code) nulls not distinct;

create index if not exists org_units_parent_lookup on public.org_units (parent_id, kind, status);
create index if not exists org_units_tenant_lookup on public.org_units (tenant_id, kind, status);

create table if not exists public.org_unit_closure (
  ancestor_id text not null references public.org_units(id) on delete cascade,
  descendant_id text not null references public.org_units(id) on delete cascade,
  depth integer not null check (depth >= 0),
  primary key (ancestor_id, descendant_id),
  check ((depth = 0 and ancestor_id = descendant_id) or (depth > 0 and ancestor_id <> descendant_id))
);

create index if not exists org_unit_closure_descendant_lookup
on public.org_unit_closure (descendant_id, depth, ancestor_id);

create or replace function public.validate_org_unit_parent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  parent_row public.org_units%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('public.org_unit_hierarchy'));
  if new.kind = 'platform' then
    if new.parent_id is not null or new.tenant_id is not null then raise exception 'PLATFORM_ORG_UNIT_MUST_BE_GLOBAL_ROOT'; end if;
    return new;
  end if;

  if new.parent_id is null then raise exception 'ORG_UNIT_PARENT_REQUIRED'; end if;
  if new.parent_id = new.id then raise exception 'ORG_UNIT_CYCLE'; end if;
  select * into parent_row from public.org_units where id = new.parent_id;
  if not found then raise exception 'ORG_UNIT_PARENT_NOT_FOUND'; end if;

  if exists (
    select 1 from public.org_unit_closure
    where ancestor_id = new.id and descendant_id = new.parent_id
  ) then raise exception 'ORG_UNIT_CYCLE'; end if;

  if new.kind = 'tenant' and parent_row.kind not in ('platform','distributor') then raise exception 'ORG_UNIT_PARENT_KIND_INVALID'; end if;
  if new.kind = 'distributor' and parent_row.kind <> 'platform' then raise exception 'ORG_UNIT_PARENT_KIND_INVALID'; end if;
  if new.kind = 'enterprise' and parent_row.kind <> 'tenant' then raise exception 'ORG_UNIT_PARENT_KIND_INVALID'; end if;
  if new.kind = 'mall' and parent_row.kind <> 'enterprise' then raise exception 'ORG_UNIT_PARENT_KIND_INVALID'; end if;
  if new.kind = 'department' and parent_row.kind not in ('enterprise','department') then raise exception 'ORG_UNIT_PARENT_KIND_INVALID'; end if;

  if new.kind <> 'distributor' and new.tenant_id is null then raise exception 'ORG_UNIT_TENANT_REQUIRED'; end if;
  if parent_row.tenant_id is not null and parent_row.tenant_id <> new.tenant_id then raise exception 'ORG_UNIT_TENANT_MISMATCH'; end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.rebuild_org_unit_closure()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.org_unit_hierarchy'));
  delete from public.org_unit_closure;
  insert into public.org_unit_closure (ancestor_id, descendant_id, depth)
  with recursive ancestry as (
    select unit.id ancestor_id, unit.id descendant_id, 0 depth
    from public.org_units unit
    union all
    select ancestry.ancestor_id, child.id, ancestry.depth + 1
    from ancestry
    join public.org_units child on child.parent_id = ancestry.descendant_id
  )
  select ancestor_id, descendant_id, min(depth)
  from ancestry
  group by ancestor_id, descendant_id;
  return null;
end;
$$;

drop trigger if exists org_units_validate_parent on public.org_units;
create trigger org_units_validate_parent
before insert or update of tenant_id, parent_id, kind on public.org_units
for each row execute function public.validate_org_unit_parent();

drop trigger if exists org_units_rebuild_closure_insert on public.org_units;
create trigger org_units_rebuild_closure_insert
after insert on public.org_units
for each statement execute function public.rebuild_org_unit_closure();

drop trigger if exists org_units_rebuild_closure_move on public.org_units;
create trigger org_units_rebuild_closure_move
after update of parent_id on public.org_units
for each statement execute function public.rebuild_org_unit_closure();

drop trigger if exists org_units_rebuild_closure_delete on public.org_units;
create trigger org_units_rebuild_closure_delete
after delete on public.org_units
for each statement execute function public.rebuild_org_unit_closure();

insert into public.org_units (id, tenant_id, parent_id, kind, code, name, source_type, source_id)
values ('org-platform-smart-wing', null, null, 'platform', 'smart-wing', '智慧翼平台', null, null)
on conflict (id) do update set name = excluded.name, updated_at = now();

insert into public.org_units (id, tenant_id, parent_id, kind, code, name, source_type, source_id, status)
select 'org-tenant-' || t.id, t.id, 'org-platform-smart-wing', 'tenant', t.code, t.name, 'tenant', t.id, t.status
from public.tenants t
on conflict (source_type, source_id) where source_type is not null and source_id is not null
do update set code = excluded.code, name = excluded.name, status = excluded.status, updated_at = now();

-- The technical tenant node stays between a distributor and its enterprises.
-- Moving the tenant node under a future distributor preserves every existing
-- enterprise and descendant edge while keeping the security boundary visible.
insert into public.org_units (id, tenant_id, parent_id, kind, code, name, source_type, source_id, status)
select 'org-enterprise-' || e.id, e.tenant_id, tenant_node.id, 'enterprise', e.code, e.name, 'enterprise', e.id, e.status
from public.enterprises e
join public.org_units tenant_node on tenant_node.source_type = 'tenant' and tenant_node.source_id = e.tenant_id
on conflict (source_type, source_id) where source_type is not null and source_id is not null
do update set tenant_id = excluded.tenant_id, parent_id = excluded.parent_id, code = excluded.code, name = excluded.name, status = excluded.status, updated_at = now();

insert into public.org_units (id, tenant_id, parent_id, kind, code, name, source_type, source_id, status)
select 'org-mall-' || m.id, m.tenant_id, enterprise_node.id, 'mall', m.code, m.name, 'mall', m.id, m.status
from public.malls m
join public.org_units enterprise_node on enterprise_node.source_type = 'enterprise' and enterprise_node.source_id = m.enterprise_id
on conflict (source_type, source_id) where source_type is not null and source_id is not null
do update set tenant_id = excluded.tenant_id, parent_id = excluded.parent_id, code = excluded.code, name = excluded.name, status = excluded.status, updated_at = now();

-- Insert department nodes first, then connect nested departments after every
-- source row has a stable mapping.
insert into public.org_units (id, tenant_id, parent_id, kind, code, name, source_type, source_id)
select 'org-department-' || d.id, d.tenant_id, enterprise_node.id, 'department', d.code, d.name, 'department', d.id
from public.departments d
join public.org_units enterprise_node on enterprise_node.source_type = 'enterprise' and enterprise_node.source_id = d.enterprise_id
on conflict (source_type, source_id) where source_type is not null and source_id is not null
do update set tenant_id = excluded.tenant_id, code = excluded.code, name = excluded.name, updated_at = now();

do $$
begin
  if exists (
    with recursive department_path as (
      select department.id origin_id, department.parent_id, array[department.id] visited, false has_cycle
      from public.departments department
      union all
      select department_path.origin_id, parent.parent_id, department_path.visited || parent.id,
        parent.id = any(department_path.visited)
      from department_path
      join public.departments parent on parent.id = department_path.parent_id
      where not department_path.has_cycle
    )
    select 1 from department_path where has_cycle
  ) then raise exception 'DEPARTMENT_HIERARCHY_CYCLE'; end if;
end;
$$;

update public.org_units child_node
set parent_id = parent_node.id, updated_at = now()
from public.departments child_department
join public.org_units parent_node on parent_node.source_type = 'department' and parent_node.source_id = child_department.parent_id
where child_node.source_type = 'department'
  and child_node.source_id = child_department.id
  and child_department.parent_id is not null
  and child_node.parent_id is distinct from parent_node.id;

-- Return a server-derived root-to-resource path. Existing business IDs remain
-- the scope resource IDs; global platform/distributor nodes use their node ID.
create or replace function public.api_org_unit_scope_path(p_source_type text, p_source_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', ancestor.kind,
    'resourceId', case when ancestor.kind in ('platform','distributor') then ancestor.id else ancestor.source_id end
  ) order by path.depth desc), '[]'::jsonb)
  from public.org_units resource
  join public.org_unit_closure path on path.descendant_id = resource.id
  join public.org_units ancestor on ancestor.id = path.ancestor_id
  where resource.source_type = p_source_type and resource.source_id = p_source_id;
$$;

-- A global node does not have a legacy source row, so expose the same path by
-- node ID for platform and future distributor scope validation.
create or replace function public.api_org_unit_scope_path_by_id(p_org_unit_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', ancestor.kind,
    'resourceId', case when ancestor.kind in ('platform','distributor') then ancestor.id else ancestor.source_id end
  ) order by path.depth desc), '[]'::jsonb)
  from public.org_unit_closure path
  join public.org_units ancestor on ancestor.id = path.ancestor_id
  where path.descendant_id = p_org_unit_id;
$$;

-- Resource authorization lookups now include the database-derived hierarchy
-- path. Legacy flat scope fields are returned unchanged for rollback safety.
create or replace function public.api_order_authorization_scope(p_order_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'tenant_id', o.tenant_id,
    'enterprise_id', o.enterprise_id,
    'mall_id', o.mall_id,
    'user_id', o.user_id,
    'org_unit_path', public.api_org_unit_scope_path('mall', o.mall_id)
  )
  from public.orders o
  where o.id = p_order_id;
$$;

create or replace function public.api_after_sale_authorization_scope(p_after_sale_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'tenant_id', o.tenant_id,
    'enterprise_id', o.enterprise_id,
    'mall_id', o.mall_id,
    'user_id', o.user_id,
    'org_unit_path', public.api_org_unit_scope_path('mall', o.mall_id)
  )
  from public.after_sales after_sale
  join public.orders o on o.id = after_sale.order_id
  where after_sale.id = p_after_sale_id;
$$;

create or replace function public.api_product_authorization_scope(p_product_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'tenant_id', product.tenant_id,
    'mall_id', product.mall_id,
    'supplier_id', product.supplier_id,
    'org_unit_path', public.api_org_unit_scope_path('mall', product.mall_id)
  )
  from public.products product
  where product.id = p_product_id;
$$;

-- Extend scope validation only for hierarchy kinds that now have real rows.
create or replace function public.validate_membership_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare membership_row public.memberships%rowtype; is_valid boolean := false;
begin
  select * into membership_row from public.memberships where id = new.membership_id;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;

  if new.scope_kind in ('platform','distributor') then
    raise exception 'MEMBERSHIP_SCOPE_KIND_RESERVED';
  elsif new.scope_kind = 'tenant' then is_valid := new.resource_id = membership_row.tenant_id;
  elsif new.scope_kind = 'enterprise' then
    select exists(select 1 from public.enterprises e where e.id = new.resource_id and e.tenant_id = membership_row.tenant_id) into is_valid;
  elsif new.scope_kind = 'mall' then
    select exists(select 1 from public.malls m where m.id = new.resource_id and m.tenant_id = membership_row.tenant_id) into is_valid;
  elsif new.scope_kind = 'supplier' then
    select exists(select 1 from public.suppliers s where s.id = new.resource_id and s.tenant_id = membership_row.tenant_id) into is_valid;
  elsif new.scope_kind = 'department' then
    select exists(select 1 from public.departments d where d.id = new.resource_id and d.tenant_id = membership_row.tenant_id and d.enterprise_id = membership_row.enterprise_id) into is_valid;
  elsif new.scope_kind = 'self' then is_valid := new.resource_id = membership_row.context_user_id;
  elsif new.scope_kind in ('brand','store') then raise exception 'MEMBERSHIP_SCOPE_KIND_RESERVED';
  end if;
  if not coalesce(is_valid, false) then raise exception 'MEMBERSHIP_SCOPE_OUTSIDE_TENANT'; end if;
  return new;
end;
$$;

alter table public.membership_scopes drop constraint if exists membership_scopes_scope_kind_check;
alter table public.membership_scopes add constraint membership_scopes_scope_kind_check
check (scope_kind in ('platform','tenant','distributor','enterprise','mall','supplier','brand','store','department','self'));

-- Changing a role's permission set invalidates every active session carrying
-- that role. Membership-specific role/scope/deny changes already have their
-- own authz_version triggers.
create or replace function public.bump_role_membership_authz_versions()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.memberships membership
  set authz_version = membership.authz_version + 1, updated_at = now()
  where exists (
    select 1 from public.membership_roles membership_role
    where membership_role.membership_id = membership.id
      and membership_role.role_id in (coalesce(new.role_id, old.role_id), coalesce(old.role_id, new.role_id))
      and membership_role.revoked_at is null
      and (membership_role.expires_at is null or membership_role.expires_at > now())
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists role_permissions_bump_membership_versions on public.role_permissions;
create trigger role_permissions_bump_membership_versions
after insert or update or delete on public.role_permissions
for each row execute function public.bump_role_membership_authz_versions();

revoke all on table public.org_units, public.org_unit_closure from public, anon, authenticated;
alter table public.org_units enable row level security;
alter table public.org_unit_closure enable row level security;
revoke all on function public.api_org_unit_scope_path(text, text) from public, anon, authenticated;
revoke all on function public.api_org_unit_scope_path_by_id(text) from public, anon, authenticated;
grant execute on function public.api_org_unit_scope_path(text, text) to service_role;
grant execute on function public.api_org_unit_scope_path_by_id(text) to service_role;
revoke all on function public.api_order_authorization_scope(text) from public, anon, authenticated;
revoke all on function public.api_after_sale_authorization_scope(text) from public, anon, authenticated;
revoke all on function public.api_product_authorization_scope(text) from public, anon, authenticated;
grant execute on function public.api_order_authorization_scope(text) to service_role;
grant execute on function public.api_after_sale_authorization_scope(text) to service_role;
grant execute on function public.api_product_authorization_scope(text) to service_role;
