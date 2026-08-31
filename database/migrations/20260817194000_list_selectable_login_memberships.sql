-- Password verification happens in commerce-api. This service-only RPC then
-- returns only the active identities belonging to that already verified member,
-- so one account can deliberately choose a storefront or admin workbench.
-- It does not issue a session and is not callable by browser roles.

create or replace function public.api_list_login_memberships(p_member_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with selectable as (
    select
      membership.id,
      membership.target,
      membership.status,
      membership.expires_at,
      tenant.name as tenant_name,
      enterprise.name as enterprise_name,
      mall.name as mall_name,
      exists (
        select 1
        from public.membership_scopes scope
        where scope.membership_id = membership.id
          and scope.scope_kind = 'platform'
      ) as has_platform_scope,
      exists (
        select 1
        from public.membership_scopes scope
        where scope.membership_id = membership.id
          and scope.scope_kind = 'tenant'
      ) as has_tenant_scope,
      exists (
        select 1
        from public.membership_scopes scope
        where scope.membership_id = membership.id
          and scope.scope_kind = 'enterprise'
      ) as has_enterprise_scope,
      exists (
        select 1
        from public.membership_scopes scope
        where scope.membership_id = membership.id
          and scope.scope_kind = 'supplier'
      ) as has_supplier_scope,
      coalesce((
        select string_agg(role.name, ' / ' order by role.sort_order, role.name)
        from public.membership_roles membership_role
        join public.roles role on role.id = membership_role.role_id
        where membership_role.membership_id = membership.id
          and membership_role.revoked_at is null
          and (membership_role.expires_at is null or membership_role.expires_at > now())
          and role.status = 'active'
      ), case when membership.target = 'admin' then '运营成员' else '员工会员' end) as role_name
    from public.memberships membership
    join public.members member on member.id = membership.member_id and member.status = 'active'
    join public.users user_row on user_row.id = membership.context_user_id and user_row.status = 'active'
    join public.tenants tenant on tenant.id = membership.tenant_id and tenant.status = 'active'
    left join public.enterprises enterprise on enterprise.id = membership.enterprise_id and enterprise.status = 'active'
    left join public.malls mall on mall.id = membership.mall_id and mall.status = 'active'
    where membership.member_id = p_member_id
      and membership.status = 'active'
      and (membership.expires_at is null or membership.expires_at > now())
  )
  select coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'id', id,
      'target', target,
      'status', status,
      'enterpriseName', case when has_platform_scope then tenant_name else coalesce(enterprise_name, tenant_name) end,
      'storeName', case
        when target = 'admin' and has_platform_scope then '智慧翼平台运营后台'
        when target = 'admin' then coalesce(mall_name || '运营后台', '智慧翼运营后台')
        else coalesce(mall_name, '智慧翼企业福利商城')
      end,
      'roleName', role_name,
      'dataScope', case
        when has_platform_scope then '平台级全部授权范围'
        when has_tenant_scope then '租户级授权范围'
        when has_enterprise_scope then '企业级授权范围'
        when has_supplier_scope then '供应商授权范围'
        when target = 'storefront' then '个人福利账户'
        else '商城级授权范围'
      end,
      'accountTypeLabel', case when target = 'storefront' then '福利账户' else null end,
      'subjectScope', case
        when has_platform_scope then '平台'
        when has_tenant_scope then '租户'
        when has_enterprise_scope then '企业'
        when has_supplier_scope then '供应商'
        when target = 'admin' then '商城'
        else null
      end,
      'expireAt', expires_at
    ))
    order by case when target = 'storefront' then 0 else 1 end, id
  ), '[]'::jsonb)
  from selectable;
$$;

revoke all on function public.api_list_login_memberships(text) from public, anon, authenticated;
grant execute on function public.api_list_login_memberships(text) to service_role;
