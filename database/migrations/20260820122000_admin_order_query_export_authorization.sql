-- Order-management reads must re-validate the membership, actor, permission,
-- tracked session evidence and scope at the database boundary. Export rows and
-- their audit record are produced in one transaction.

update public.permissions
set risk_level = 'critical'
where code = 'order.export' and risk_level <> 'critical';

create or replace function public.api_admin_order_management_scope_allows(
  p_membership_id text,
  p_operator_user_id text,
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text
) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.enterprises enterprise
    join public.malls mall
      on mall.enterprise_id = enterprise.id
     and mall.tenant_id = enterprise.tenant_id
    where enterprise.id = p_enterprise_id
      and enterprise.tenant_id = p_tenant_id
      and mall.id = p_mall_id
      and mall.status = 'active'
      and enterprise.status = 'active'
  ) and (
    (
      p_user_id is null
      and public.api_membership_scope_allows(
        p_membership_id, p_tenant_id, p_enterprise_id, p_mall_id
      )
    )
    or (
      p_user_id = p_operator_user_id
      and exists (
        select 1
        from public.memberships membership
        join public.membership_scopes scope
          on scope.membership_id = membership.id
         and scope.scope_kind = 'self'
         and scope.resource_id = membership.context_user_id
        where membership.id = p_membership_id
          and membership.context_user_id = p_operator_user_id
          and membership.tenant_id = p_tenant_id
          and membership.enterprise_id = p_enterprise_id
          and membership.mall_id = p_mall_id
      )
    )
  );
$$;

create or replace function public.api_admin_order_management_page_authorized(
  p_page_type text,
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text,
  p_keyword text,
  p_status text,
  p_created_from timestamptz,
  p_created_to timestamptz,
  p_sort text,
  p_limit integer,
  p_offset integer,
  p_operator_user_id text,
  p_membership_id text,
  p_granted_via jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_permission_code text;
begin
  v_permission_code := case p_page_type
    when 'orders' then 'order.read'
    when 'after_sales' then 'aftersale.read'
    else null
  end;
  if v_permission_code is null
     or p_sort is null
     or p_sort not in ('created_at_desc', 'created_at_asc', 'payable_desc', 'payable_asc')
     or p_limit is null or p_limit not between 1 and 100
     or p_offset is null or p_offset < 0
     or length(coalesce(p_keyword, '')) > 100
     or length(coalesce(p_status, '')) > 40
     or (p_created_from is not null and p_created_to is not null and p_created_from >= p_created_to)
  then raise exception 'INVALID_ADMIN_ORDER_QUERY'; end if;

  if not public.api_membership_actor_matches(
    p_membership_id, p_operator_user_id, 'admin'
  ) then raise exception 'ADMIN_ORDER_QUERY_NOT_AUTHORIZED'; end if;
  if not public.api_membership_has_permission(
    p_membership_id, v_permission_code
  ) then raise exception 'ADMIN_ORDER_QUERY_NOT_AUTHORIZED'; end if;
  if not public.api_authorization_evidence_matches(
    p_granted_via, p_membership_id, v_permission_code, false
  ) then raise exception 'ADMIN_ORDER_QUERY_NOT_AUTHORIZED'; end if;
  if not public.api_admin_order_management_scope_allows(
    p_membership_id, p_operator_user_id, p_tenant_id, p_enterprise_id,
    p_mall_id, p_user_id
  ) then raise exception 'ADMIN_ORDER_QUERY_SCOPE_FORBIDDEN'; end if;

  if p_page_type = 'orders' then
    return public.api_admin_order_page(
      p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_keyword,
      p_status, p_created_from, p_created_to, p_sort, p_limit, p_offset
    );
  end if;
  return public.api_admin_after_sale_page(
    p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_keyword,
    p_status, p_created_from, p_created_to, p_sort, p_limit, p_offset
  );
end;
$$;

create or replace function public.api_admin_order_management_export_authorized(
  p_export_type text,
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text,
  p_keyword text,
  p_status text,
  p_created_from timestamptz,
  p_created_to timestamptz,
  p_sort text,
  p_operator_user_id text,
  p_membership_id text,
  p_granted_via jsonb,
  p_request_id text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_rows jsonb;
  v_row_count integer;
  v_outcome text;
  v_filters jsonb;
  v_read_permission text;
begin
  v_read_permission := case p_export_type
    when 'orders' then 'order.read'
    when 'after_sales' then 'aftersale.read'
    else null
  end;
  if p_export_type is null or p_export_type not in ('orders', 'after_sales')
     or p_sort is null
     or p_sort not in ('created_at_desc', 'created_at_asc', 'payable_desc', 'payable_asc')
     or length(coalesce(p_keyword, '')) > 100
     or length(coalesce(p_status, '')) > 40
     or length(trim(coalesce(p_request_id, ''))) < 1
     or length(p_request_id) > 160
     or (p_created_from is not null and p_created_to is not null and p_created_from >= p_created_to)
  then raise exception 'INVALID_ADMIN_ORDER_EXPORT'; end if;

  if not public.api_membership_actor_matches(
    p_membership_id, p_operator_user_id, 'admin'
  ) then raise exception 'ADMIN_ORDER_EXPORT_NOT_AUTHORIZED'; end if;
  if not public.api_membership_has_permission(
    p_membership_id, 'order.export'
  ) then raise exception 'ADMIN_ORDER_EXPORT_NOT_AUTHORIZED'; end if;
  if not public.api_membership_has_permission(
    p_membership_id, v_read_permission
  ) then raise exception 'ADMIN_ORDER_EXPORT_NOT_AUTHORIZED'; end if;
  if not public.api_authorization_evidence_matches(
    p_granted_via, p_membership_id, 'order.export', true
  ) then raise exception 'ADMIN_ORDER_EXPORT_NOT_AUTHORIZED'; end if;
  if not public.api_admin_order_management_scope_allows(
    p_membership_id, p_operator_user_id, p_tenant_id, p_enterprise_id,
    p_mall_id, p_user_id
  ) then raise exception 'ADMIN_ORDER_EXPORT_SCOPE_FORBIDDEN'; end if;

  if p_export_type = 'orders' then
    v_rows := public.api_admin_order_export(
      p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_keyword,
      p_status, p_created_from, p_created_to, p_sort
    );
  else
    v_rows := public.api_admin_after_sale_export(
      p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_keyword,
      p_status, p_created_from, p_created_to, p_sort
    );
  end if;
  if jsonb_typeof(v_rows) is distinct from 'array'
  then raise exception 'ADMIN_ORDER_EXPORT_RESULT_INVALID'; end if;

  v_row_count := jsonb_array_length(v_rows);
  v_outcome := case when v_row_count > 5000
    then 'rejected_too_large' else 'completed' end;
  v_filters := jsonb_strip_nulls(jsonb_build_object(
    'keyword', p_keyword,
    'status', p_status,
    'createdFrom', p_created_from,
    'createdTo', p_created_to,
    'sort', p_sort,
    'outcome', v_outcome
  ));
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type,
    action, resource_type, request_id, after_json, membership_id,
    granted_via, created_at
  ) values (
    gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id,
    p_operator_user_id, 'admin', 'order.export', p_export_type, p_request_id,
    jsonb_build_object('filters', v_filters, 'rowCount', v_row_count),
    p_membership_id, p_granted_via, now()
  );
  return v_rows;
end;
$$;

revoke all on function public.api_admin_order_page(
  text,text,text,text,text,text,timestamptz,timestamptz,text,integer,integer
) from public,anon,authenticated,service_role;
revoke all on function public.api_admin_after_sale_page(
  text,text,text,text,text,text,timestamptz,timestamptz,text,integer,integer
) from public,anon,authenticated,service_role;
revoke all on function public.api_admin_order_export(
  text,text,text,text,text,text,timestamptz,timestamptz,text
) from public,anon,authenticated,service_role;
revoke all on function public.api_admin_after_sale_export(
  text,text,text,text,text,text,timestamptz,timestamptz,text
) from public,anon,authenticated,service_role;
revoke all on function public.api_record_order_export_audit(
  text,text,text,text,text,jsonb,integer,text,text,jsonb
) from public,anon,authenticated,service_role;
revoke all on function public.api_admin_order_management_scope_allows(
  text,text,text,text,text,text
) from public,anon,authenticated,service_role;
revoke all on function public.api_admin_order_management_page_authorized(
  text,text,text,text,text,text,text,timestamptz,timestamptz,text,integer,
  integer,text,text,jsonb
) from public,anon,authenticated;
revoke all on function public.api_admin_order_management_export_authorized(
  text,text,text,text,text,text,text,timestamptz,timestamptz,text,text,text,
  jsonb,text
) from public,anon,authenticated;
grant execute on function public.api_admin_order_management_page_authorized(
  text,text,text,text,text,text,text,timestamptz,timestamptz,text,integer,
  integer,text,text,jsonb
) to service_role;
grant execute on function public.api_admin_order_management_export_authorized(
  text,text,text,text,text,text,text,timestamptz,timestamptz,text,text,text,
  jsonb,text
) to service_role;
