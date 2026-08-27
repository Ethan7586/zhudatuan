-- Storefront identity must come from the authenticated member, never from a
-- browser demo profile. This RPC returns only fields safe for the member's own
-- storefront header and profile screen.
create or replace function public.api_storefront_member_profile(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'displayName', user_row.display_name,
    'employeeNo', user_row.employee_no,
    'departmentName', department.name,
    'phoneMasked', user_row.mobile_masked
  )
  from public.users user_row
  left join public.departments department
    on department.id = user_row.department_id
   and department.tenant_id = user_row.tenant_id
   and department.enterprise_id = user_row.enterprise_id
  where user_row.id = p_user_id
    and user_row.tenant_id = p_tenant_id
    and user_row.enterprise_id = p_enterprise_id
    and user_row.status = 'active'
    and exists (
      select 1
      from public.malls mall
      where mall.id = p_mall_id
        and mall.tenant_id = p_tenant_id
        and mall.enterprise_id = p_enterprise_id
    );
$$;

revoke all on function public.api_storefront_member_profile(text,text,text,text)
from public, anon, authenticated;
grant execute on function public.api_storefront_member_profile(text,text,text,text)
to service_role;

notify pgrst, 'reload schema';
