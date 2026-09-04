-- Close every service-role administration surface over the canonical
-- distributor authorization anchor.  Public API wrappers lock the actor and
-- its distributor relation before any business read or write; the original
-- business implementations become owner-only primitives.

create or replace function public.api_lock_membership_actor(
  p_membership_id text,
  p_actor_user_id text,
  p_target text,
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text
) returns boolean
language plpgsql volatile security definer
set search_path=public,pg_temp as $$
declare
  v_member_id text;
  v_scope_allowed boolean;
begin
  select membership.member_id into v_member_id
  from public.memberships membership
  join public.members member
    on member.id=membership.member_id
   and member.user_id=membership.context_user_id
   and member.status='active'
  join public.users actor
    on actor.id=membership.context_user_id
   and actor.status='active'
  where membership.id=p_membership_id
    and membership.context_user_id=p_actor_user_id
    and membership.target=p_target
    and membership.tenant_id=p_tenant_id
    and (p_enterprise_id is null or membership.enterprise_id=p_enterprise_id)
    and (p_mall_id is null or membership.mall_id=p_mall_id)
    and membership.status='active'
    and (membership.expires_at is null or membership.expires_at>now())
  for share of membership,member,actor;
  if not found then return false; end if;

  -- Lock both the binding and the authority rows.  Distributor suspension or
  -- relation expiry therefore serializes with the command that relies on it.
  perform 1 from public.membership_scopes scope
  where scope.membership_id=p_membership_id
  order by scope.scope_kind,scope.resource_id
  for share;
  perform 1
  from public.membership_scopes scope
  join public.distributors distributor on distributor.id=scope.resource_id
  where scope.membership_id=p_membership_id and scope.scope_kind='distributor'
  order by distributor.id
  for share of distributor;
  perform 1
  from public.membership_scopes scope
  join public.distributor_tenants relation
    on relation.distributor_id=scope.resource_id
   and relation.tenant_id=p_tenant_id
  where scope.membership_id=p_membership_id and scope.scope_kind='distributor'
  order by relation.distributor_id,relation.tenant_id
  for share of relation;

  if not public.api_membership_distributor_anchor_valid(p_membership_id) then
    return false;
  end if;
  v_scope_allowed:=public.api_membership_scope_allows(
    p_membership_id,p_tenant_id,p_enterprise_id,p_mall_id
  );
  if p_target='storefront' then
    v_scope_allowed:=v_scope_allowed or exists(
      select 1 from public.membership_scopes scope
      where scope.membership_id=p_membership_id
        and scope.scope_kind='self' and scope.resource_id=p_actor_user_id
    );
  end if;
  return coalesce(v_scope_allowed,false);
end;
$$;

revoke all on function public.api_lock_membership_actor(text,text,text,text,text,text)
from public,anon,authenticated,service_role;

create or replace function public.internal_anchor_has_permissions(
  p_membership_id text,p_permission_codes text[],p_require_all boolean default true
) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select case
    when coalesce(cardinality(p_permission_codes),0)=0 then false
    when p_require_all then not exists(
      select 1 from unnest(p_permission_codes) code
      where not public.api_membership_has_permission(p_membership_id,code)
    )
    else exists(
      select 1 from unnest(p_permission_codes) code
      where public.api_membership_has_permission(p_membership_id,code)
    )
  end;
$$;

create or replace function public.internal_qualification_manage_permission(p_kind text)
returns text language sql immutable security definer set search_path=public,pg_temp as $$
  select case
    when p_kind in ('catalog_pool','supplier_agreement','brand','store') then 'commercial_resource.manage'
    when p_kind in ('city_zone','entitlement_policy') then 'entitlement.manage'
    when p_kind='purchase_limit' then 'purchase_limit.manage'
  end;
$$;

create or replace function public.internal_qualification_read_permissions(p_kind text)
returns text[] language sql immutable security definer set search_path=public,pg_temp as $$
  select case
    when p_kind in ('catalog_pool','supplier_agreement','brand','store')
      then array['commercial_resource.read','commercial_resource.manage']::text[]
    when p_kind in ('city_zone','entitlement_policy')
      then array['entitlement.read','entitlement.manage']::text[]
    when p_kind='purchase_limit'
      then array['purchase_limit.read','purchase_limit.manage']::text[]
    else '{}'::text[]
  end;
$$;

revoke all on function public.internal_anchor_has_permissions(text,text[],boolean)
from public,anon,authenticated,service_role;
revoke all on function public.internal_qualification_manage_permission(text)
from public,anon,authenticated,service_role;
revoke all on function public.internal_qualification_read_permissions(text)
from public,anon,authenticated,service_role;

-- Permission command center and membership administration.
alter function public.api_permission_command_center(text,text,text,text,boolean)
rename to internal_anchor_permission_command_center;
revoke all on function public.internal_anchor_permission_command_center(text,text,text,text,boolean)
from public,anon,authenticated,service_role;

create or replace function public.api_permission_command_center(
  p_actor_membership_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_include_pii boolean default false
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_actor_user_id text;
begin
  select context_user_id into v_actor_user_id from public.memberships
  where id=p_actor_membership_id;
  if v_actor_user_id is null or not public.api_lock_membership_actor(
       p_actor_membership_id,v_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.internal_anchor_has_permissions(
       p_actor_membership_id,array['member.read','role.read'],true
     ) or (p_include_pii and not public.api_membership_has_permission(
       p_actor_membership_id,'member.pii.read'
     )) then return null; end if;
  return public.internal_anchor_permission_command_center(
    p_actor_membership_id,p_tenant_id,p_enterprise_id,p_mall_id,p_include_pii
  );
end;
$$;

alter function public.api_update_membership_access(
  text,text,text,text,text,text,text[],jsonb,text[],text,text,text,jsonb
) rename to internal_anchor_update_membership_access;
revoke all on function public.internal_anchor_update_membership_access(
  text,text,text,text,text,text,text[],jsonb,text[],text,text,text,jsonb
) from public,anon,authenticated,service_role;

create or replace function public.api_update_membership_access(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_target_membership_id text,p_role_ids text[],p_scopes jsonb,p_denied_permission_codes text[],
  p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.internal_anchor_has_permissions(
       p_actor_membership_id,array['role.grant','scope.grant'],true
     ) then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  return public.internal_anchor_update_membership_access(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,p_mall_id,
    p_target_membership_id,p_role_ids,p_scopes,p_denied_permission_codes,
    p_reason,p_request_id,p_user_agent,p_granted_via
  );
end;
$$;

alter function public.api_update_membership_status(
  text,text,text,text,text,text,text,text,text,text,jsonb
) rename to internal_anchor_update_membership_status;
revoke all on function public.internal_anchor_update_membership_status(
  text,text,text,text,text,text,text,text,text,text,jsonb
) from public,anon,authenticated,service_role;

create or replace function public.api_update_membership_status(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_target_membership_id text,p_status text,p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_permission text;
begin
  v_permission:=case when p_status='offboarded' then 'member.offboard' else 'member.disable' end;
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,v_permission)
  then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  return public.internal_anchor_update_membership_status(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,p_mall_id,
    p_target_membership_id,p_status,p_reason,p_request_id,p_user_agent,p_granted_via
  );
end;
$$;

alter function public.api_record_step_up(text,text,text,text,text,text,text)
rename to internal_anchor_record_step_up;
revoke all on function public.internal_anchor_record_step_up(text,text,text,text,text,text,text)
from public,anon,authenticated,service_role;

create or replace function public.api_record_step_up(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,
  p_enterprise_id text,p_mall_id text,p_request_id text,p_user_agent text
) returns boolean language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.api_lock_membership_actor(
    p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
  ) then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  return public.internal_anchor_record_step_up(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,p_mall_id,
    p_request_id,p_user_agent
  );
end;
$$;

revoke all on function public.api_permission_command_center(text,text,text,text,boolean)
from public,anon,authenticated;
revoke all on function public.api_update_membership_access(
  text,text,text,text,text,text,text[],jsonb,text[],text,text,text,jsonb
) from public,anon,authenticated;
revoke all on function public.api_update_membership_status(
  text,text,text,text,text,text,text,text,text,text,jsonb
) from public,anon,authenticated;
revoke all on function public.api_record_step_up(text,text,text,text,text,text,text)
from public,anon,authenticated;
grant execute on function public.api_permission_command_center(text,text,text,text,boolean) to service_role;
grant execute on function public.api_update_membership_access(
  text,text,text,text,text,text,text[],jsonb,text[],text,text,text,jsonb
) to service_role;
grant execute on function public.api_update_membership_status(
  text,text,text,text,text,text,text,text,text,text,jsonb
) to service_role;
grant execute on function public.api_record_step_up(text,text,text,text,text,text,text) to service_role;

-- Member operations center.
alter function public.api_member_operations_center(text,text,text,text,boolean,boolean,boolean)
rename to internal_anchor_member_operations_center;
revoke all on function public.internal_anchor_member_operations_center(text,text,text,text,boolean,boolean,boolean)
from public,anon,authenticated,service_role;

create or replace function public.api_member_operations_center(
  p_actor_membership_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_include_pii boolean default false,p_include_history boolean default false,
  p_include_import_errors boolean default false
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_actor_user_id text;
begin
  select context_user_id into v_actor_user_id from public.memberships where id=p_actor_membership_id;
  if v_actor_user_id is null or not public.api_lock_membership_actor(
       p_actor_membership_id,v_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,'member.read')
     or (p_include_pii and not public.api_membership_has_permission(p_actor_membership_id,'member.pii.read'))
     or (p_include_history and not public.api_membership_has_permission(p_actor_membership_id,'audit.read'))
     or (p_include_import_errors and not public.api_membership_has_permission(p_actor_membership_id,'member.import'))
  then return null; end if;
  return public.internal_anchor_member_operations_center(
    p_actor_membership_id,p_tenant_id,p_enterprise_id,p_mall_id,
    p_include_pii,p_include_history,p_include_import_errors
  );
end;
$$;

alter function public.api_create_membership_invite(
  text,text,text,text,text,text,text,integer,timestamptz,text,text,jsonb
) rename to internal_anchor_create_membership_invite;
revoke all on function public.internal_anchor_create_membership_invite(
  text,text,text,text,text,text,text,integer,timestamptz,text,text,jsonb
) from public,anon,authenticated,service_role;

create or replace function public.api_create_membership_invite(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_label text,p_code_hash text,p_max_uses integer,p_expires_at timestamptz,
  p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,'member.invite')
  then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  return public.internal_anchor_create_membership_invite(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,p_mall_id,
    p_label,p_code_hash,p_max_uses,p_expires_at,p_request_id,p_user_agent,p_granted_via
  );
end;
$$;

alter function public.api_disable_membership_invite(
  text,text,text,text,text,text,text,text,text,jsonb
) rename to internal_anchor_disable_membership_invite;
revoke all on function public.internal_anchor_disable_membership_invite(
  text,text,text,text,text,text,text,text,text,jsonb
) from public,anon,authenticated,service_role;

create or replace function public.api_disable_membership_invite(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_invite_id text,p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,'member.invite')
  then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  return public.internal_anchor_disable_membership_invite(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,p_mall_id,
    p_invite_id,p_reason,p_request_id,p_user_agent,p_granted_via
  );
end;
$$;

alter function public.api_admin_create_member(
  text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb
) rename to internal_anchor_admin_create_member;
revoke all on function public.internal_anchor_admin_create_member(
  text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb
) from public,anon,authenticated,service_role;

create or replace function public.api_admin_create_member(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_username text,p_password_hash text,p_display_name text,p_employee_no text,p_email text,p_department_id text,
  p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,'member.invite')
  then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  return public.internal_anchor_admin_create_member(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,p_mall_id,
    p_username,p_password_hash,p_display_name,p_employee_no,p_email,p_department_id,
    p_request_id,p_user_agent,p_granted_via
  );
end;
$$;

alter function public.api_update_member_profile(
  text,text,text,text,text,text,text,text,text,text,text,text,jsonb
) rename to internal_anchor_update_member_profile;
revoke all on function public.internal_anchor_update_member_profile(
  text,text,text,text,text,text,text,text,text,text,text,text,jsonb
) from public,anon,authenticated,service_role;

create or replace function public.api_update_member_profile(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_target_membership_id text,p_display_name text,p_email text,p_department_id text,p_reason text,
  p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,'member.update')
  then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  return public.internal_anchor_update_member_profile(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,p_mall_id,
    p_target_membership_id,p_display_name,p_email,p_department_id,p_reason,
    p_request_id,p_user_agent,p_granted_via
  );
end;
$$;

alter function public.api_record_member_import(
  text,text,text,text,text,text,integer,integer,jsonb
) rename to internal_anchor_record_member_import;
revoke all on function public.internal_anchor_record_member_import(
  text,text,text,text,text,text,integer,integer,jsonb
) from public,anon,authenticated,service_role;

create or replace function public.api_record_member_import(
  p_job_id text,p_actor_membership_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_source_name text,p_total_rows integer,p_success_rows integer,p_errors jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_actor_user_id text;
begin
  select context_user_id into v_actor_user_id from public.memberships where id=p_actor_membership_id;
  if v_actor_user_id is null or not public.api_lock_membership_actor(
       p_actor_membership_id,v_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,'member.import')
  then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  return public.internal_anchor_record_member_import(
    p_job_id,p_actor_membership_id,p_tenant_id,p_enterprise_id,p_mall_id,
    p_source_name,p_total_rows,p_success_rows,p_errors
  );
end;
$$;

alter function public.api_initial_change_local_password(text,text,text,text)
rename to internal_anchor_initial_change_local_password;
revoke all on function public.internal_anchor_initial_change_local_password(text,text,text,text)
from public,anon,authenticated,service_role;

create or replace function public.api_initial_change_local_password(
  p_member_id text,p_password_hash text,p_request_id text,p_user_agent text
) returns boolean language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_membership public.memberships%rowtype;
begin
  select membership.* into v_membership
  from public.memberships membership
  where membership.member_id=p_member_id and membership.target='storefront'
  order by membership.created_at
  limit 1;
  if not found or not public.api_lock_membership_actor(
    v_membership.id,v_membership.context_user_id,'storefront',v_membership.tenant_id,
    v_membership.enterprise_id,v_membership.mall_id
  ) then return false; end if;
  return public.internal_anchor_initial_change_local_password(
    p_member_id,p_password_hash,p_request_id,p_user_agent
  );
end;
$$;

revoke all on function public.api_member_operations_center(text,text,text,text,boolean,boolean,boolean)
from public,anon,authenticated;
revoke all on function public.api_create_membership_invite(
  text,text,text,text,text,text,text,integer,timestamptz,text,text,jsonb
) from public,anon,authenticated;
revoke all on function public.api_disable_membership_invite(
  text,text,text,text,text,text,text,text,text,jsonb
) from public,anon,authenticated;
revoke all on function public.api_admin_create_member(
  text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb
) from public,anon,authenticated;
revoke all on function public.api_update_member_profile(
  text,text,text,text,text,text,text,text,text,text,text,text,jsonb
) from public,anon,authenticated;
revoke all on function public.api_record_member_import(
  text,text,text,text,text,text,integer,integer,jsonb
) from public,anon,authenticated;
revoke all on function public.api_initial_change_local_password(text,text,text,text)
from public,anon,authenticated;
grant execute on function public.api_member_operations_center(text,text,text,text,boolean,boolean,boolean) to service_role;
grant execute on function public.api_create_membership_invite(
  text,text,text,text,text,text,text,integer,timestamptz,text,text,jsonb
) to service_role;
grant execute on function public.api_disable_membership_invite(
  text,text,text,text,text,text,text,text,text,jsonb
) to service_role;
grant execute on function public.api_admin_create_member(
  text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb
) to service_role;
grant execute on function public.api_update_member_profile(
  text,text,text,text,text,text,text,text,text,text,text,text,jsonb
) to service_role;
grant execute on function public.api_record_member_import(
  text,text,text,text,text,text,integer,integer,jsonb
) to service_role;
grant execute on function public.api_initial_change_local_password(text,text,text,text) to service_role;

-- Custom role center.  Permission ceilings, Owner protection and audit remain
-- inside the original implementations; these wrappers add the locked anchor.
alter function public.api_custom_role_center(text,text)
rename to internal_anchor_custom_role_center;
revoke all on function public.internal_anchor_custom_role_center(text,text)
from public,anon,authenticated,service_role;

create or replace function public.api_custom_role_center(
  p_actor_membership_id text,p_tenant_id text
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_actor public.memberships%rowtype;
begin
  select * into v_actor from public.memberships where id=p_actor_membership_id;
  if not found or not public.api_lock_membership_actor(
       p_actor_membership_id,v_actor.context_user_id,'admin',p_tenant_id,
       v_actor.enterprise_id,v_actor.mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,'role.read')
  then return null; end if;
  return public.internal_anchor_custom_role_center(p_actor_membership_id,p_tenant_id);
end;
$$;

alter function public.api_create_custom_role(
  text,text,text,text,text,text,text,text,text[],text,text,text,text,jsonb
) rename to internal_anchor_create_custom_role;
revoke all on function public.internal_anchor_create_custom_role(
  text,text,text,text,text,text,text,text,text[],text,text,text,text,jsonb
) from public,anon,authenticated,service_role;

create or replace function public.api_create_custom_role(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_code text,p_name text,p_description text,p_permission_codes text[],p_source_role_id text,
  p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,'role.create')
  then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  return public.internal_anchor_create_custom_role(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,p_mall_id,
    p_code,p_name,p_description,p_permission_codes,p_source_role_id,
    p_reason,p_request_id,p_user_agent,p_granted_via
  );
end;
$$;

alter function public.api_update_custom_role(
  text,text,text,text,text,text,text,text,text[],text,text,text,jsonb
) rename to internal_anchor_update_custom_role;
revoke all on function public.internal_anchor_update_custom_role(
  text,text,text,text,text,text,text,text,text[],text,text,text,jsonb
) from public,anon,authenticated,service_role;

create or replace function public.api_update_custom_role(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_role_id text,p_name text,p_description text,p_permission_codes text[],p_reason text,
  p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,'role.update')
  then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  return public.internal_anchor_update_custom_role(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,p_mall_id,
    p_role_id,p_name,p_description,p_permission_codes,p_reason,
    p_request_id,p_user_agent,p_granted_via
  );
end;
$$;

alter function public.api_set_custom_role_status(
  text,text,text,text,text,text,text,text,text,text,jsonb
) rename to internal_anchor_set_custom_role_status;
revoke all on function public.internal_anchor_set_custom_role_status(
  text,text,text,text,text,text,text,text,text,text,jsonb
) from public,anon,authenticated,service_role;

create or replace function public.api_set_custom_role_status(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_role_id text,p_status text,p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_permission text;
begin
  v_permission:=case when p_status='disabled' then 'role.delete' else 'role.update' end;
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,v_permission)
  then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  return public.internal_anchor_set_custom_role_status(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_enterprise_id,p_mall_id,
    p_role_id,p_status,p_reason,p_request_id,p_user_agent,p_granted_via
  );
end;
$$;

revoke all on function public.api_custom_role_center(text,text) from public,anon,authenticated;
revoke all on function public.api_create_custom_role(
  text,text,text,text,text,text,text,text,text[],text,text,text,text,jsonb
) from public,anon,authenticated;
revoke all on function public.api_update_custom_role(
  text,text,text,text,text,text,text,text,text[],text,text,text,jsonb
) from public,anon,authenticated;
revoke all on function public.api_set_custom_role_status(
  text,text,text,text,text,text,text,text,text,text,jsonb
) from public,anon,authenticated;
grant execute on function public.api_custom_role_center(text,text) to service_role;
grant execute on function public.api_create_custom_role(
  text,text,text,text,text,text,text,text,text[],text,text,text,text,jsonb
) to service_role;
grant execute on function public.api_update_custom_role(
  text,text,text,text,text,text,text,text,text[],text,text,text,jsonb
) to service_role;
grant execute on function public.api_set_custom_role_status(
  text,text,text,text,text,text,text,text,text,text,jsonb
) to service_role;

-- Qualification write model.
alter function public.api_apply_qualification_config(
  text,text,text,text,text,text,text,bigint,jsonb,text,text,text,text,text,jsonb
) rename to internal_anchor_apply_qualification_config;
revoke all on function public.internal_anchor_apply_qualification_config(
  text,text,text,text,text,text,text,bigint,jsonb,text,text,text,text,text,jsonb
) from public,anon,authenticated,service_role;

create or replace function public.api_apply_qualification_config(
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_actor_user_id text,p_actor_membership_id text,
  p_kind text,p_entity_id text,p_expected_version bigint,p_payload jsonb,p_reason text,
  p_idempotency_key text,p_request_hash text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_permission text:=public.internal_qualification_manage_permission(p_kind);
begin
  if v_permission is null or not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,v_permission)
  then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  return public.internal_anchor_apply_qualification_config(
    p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,p_actor_membership_id,
    p_kind,p_entity_id,p_expected_version,p_payload,p_reason,p_idempotency_key,
    p_request_hash,p_request_id,p_user_agent,p_granted_via
  );
end;
$$;

alter function public.api_request_qualification_change(
  text,text,text,text,text,text,text,bigint,jsonb,text,text,text,text,text,jsonb
) rename to internal_anchor_request_qualification_change;
revoke all on function public.internal_anchor_request_qualification_change(
  text,text,text,text,text,text,text,bigint,jsonb,text,text,text,text,text,jsonb
) from public,anon,authenticated,service_role;

create or replace function public.api_request_qualification_change(
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_actor_user_id text,p_actor_membership_id text,
  p_kind text,p_entity_id text,p_expected_version bigint,p_payload jsonb,p_reason text,
  p_idempotency_key text,p_request_hash text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_permission text:=public.internal_qualification_manage_permission(p_kind);
begin
  if v_permission is null or not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,v_permission)
  then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  return public.internal_anchor_request_qualification_change(
    p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,p_actor_membership_id,
    p_kind,p_entity_id,p_expected_version,p_payload,p_reason,p_idempotency_key,
    p_request_hash,p_request_id,p_user_agent,p_granted_via
  );
end;
$$;

alter function public.api_update_employee_qualification(
  text,text,text,text,text,text,bigint,text,text,text,jsonb,jsonb,text,text,text,jsonb
) rename to internal_anchor_update_employee_qualification;
revoke all on function public.internal_anchor_update_employee_qualification(
  text,text,text,text,text,text,bigint,text,text,text,jsonb,jsonb,text,text,text,jsonb
) from public,anon,authenticated,service_role;

create or replace function public.api_update_employee_qualification(
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_actor_user_id text,p_actor_membership_id text,
  p_user_id text,p_expected_version bigint,p_city_code text,p_city_name text,p_status text,
  p_attributes jsonb,p_tags jsonb,p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(
       p_actor_membership_id,'employee_qualification.manage'
     ) then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  return public.internal_anchor_update_employee_qualification(
    p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,p_actor_membership_id,
    p_user_id,p_expected_version,p_city_code,p_city_name,p_status,p_attributes,p_tags,
    p_reason,p_request_id,p_user_agent,p_granted_via
  );
end;
$$;

-- Approval is kept as one public command so its application step can call the
-- owner-only primitive without widening direct configuration permission.
create or replace function public.api_review_qualification_change(
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_actor_user_id text,p_actor_membership_id text,
  p_change_request_id text,p_decision text,p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare
  v_change public.qualification_change_requests%rowtype;
  v_result jsonb;
  v_current bigint;
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,'qualification.approve')
  then raise exception 'QUALIFICATION_APPROVER_INVALID'; end if;
  if p_decision not in ('approve','reject') or length(trim(coalesce(p_reason,'')))<4
  then raise exception 'QUALIFICATION_REVIEW_INVALID'; end if;
  select * into v_change from public.qualification_change_requests
  where id=p_change_request_id and tenant_id=p_tenant_id
    and enterprise_id=p_enterprise_id and mall_id=p_mall_id
  for update;
  if not found then raise exception 'QUALIFICATION_APPROVAL_NOT_FOUND'; end if;
  if v_change.status='applied' then
    return coalesce(v_change.applied_result_json,'{}')||jsonb_build_object(
      'changeRequestId',v_change.id,'status','applied'
    );
  end if;
  if v_change.status<>'pending' then raise exception 'QUALIFICATION_APPROVAL_NOT_PENDING'; end if;
  if v_change.requested_by_membership_id=p_actor_membership_id
     or v_change.requested_by_user_id=p_actor_user_id
  then raise exception 'QUALIFICATION_SELF_APPROVAL_FORBIDDEN'; end if;
  if p_decision='reject' then
    update public.qualification_change_requests
    set status='rejected',reviewed_by_user_id=p_actor_user_id,
      reviewed_by_membership_id=p_actor_membership_id,review_reason=trim(p_reason),reviewed_at=now()
    where id=v_change.id;
    v_result:=jsonb_build_object('changeRequestId',v_change.id,'status','rejected');
  else
    v_current:=public.api_qualification_entity_version(
      p_tenant_id,p_mall_id,v_change.config_kind,coalesce(v_change.entity_id,'')
    );
    if coalesce(v_current,-1)<>v_change.expected_version then
      v_result:=jsonb_build_object(
        'changeRequestId',v_change.id,'status','stale','currentVersion',v_current
      );
      update public.qualification_change_requests
      set status='stale',reviewed_by_user_id=p_actor_user_id,
        reviewed_by_membership_id=p_actor_membership_id,review_reason=trim(p_reason),reviewed_at=now()
      where id=v_change.id;
    else
      v_result:=public.internal_anchor_apply_qualification_config(
        p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,p_actor_membership_id,
        v_change.config_kind,coalesce(v_change.entity_id,''),v_change.expected_version,
        v_change.payload_json,v_change.reason||'；审批意见：'||trim(p_reason),
        'approval-'||v_change.id,v_change.request_hash,p_request_id,p_user_agent,
        p_granted_via||jsonb_build_object(
          'changeRequestId',v_change.id,
          'requestedByMembershipId',v_change.requested_by_membership_id
        )
      );
      update public.qualification_change_requests
      set status='applied',reviewed_by_user_id=p_actor_user_id,
        reviewed_by_membership_id=p_actor_membership_id,review_reason=trim(p_reason),
        reviewed_at=now(),applied_at=now(),applied_result_json=v_result
      where id=v_change.id;
      v_result:=v_result||jsonb_build_object(
        'changeRequestId',v_change.id,'status','applied'
      );
    end if;
  end if;
  insert into public.audit_logs(
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
    resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via
  ) values(
    gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,
    'admin','qualification.change.'||p_decision,'qualification_change_request',
    v_change.id,p_request_id,left(coalesce(p_user_agent,''),300),
    jsonb_build_object('reason',trim(p_reason),'result',v_result),
    p_actor_membership_id,p_granted_via
  );
  return v_result;
end;
$$;

-- Six actor-less qualification primitives are no longer service endpoints.
-- Their authorized counterparts accept the complete actor and scope tuple.
create or replace function public.api_qualification_center_authorized(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.internal_anchor_has_permissions(p_actor_membership_id,array[
       'commercial_resource.read','commercial_resource.manage','entitlement.read',
       'entitlement.manage','purchase_limit.read','purchase_limit.manage',
       'employee_qualification.read','employee_qualification.manage','qualification.approve'
     ],false) then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  return public.api_qualification_center(p_tenant_id,p_mall_id);
end;
$$;

create or replace function public.api_qualification_entity_version_authorized(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,
  p_mall_id text,p_kind text,p_entity_id text
) returns bigint language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.internal_anchor_has_permissions(
       p_actor_membership_id,public.internal_qualification_read_permissions(p_kind),false
     ) then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  return public.api_qualification_entity_version(p_tenant_id,p_mall_id,p_kind,p_entity_id);
end;
$$;

create or replace function public.api_qualification_change_preview_authorized(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,
  p_mall_id text,p_kind text,p_entity_id text,p_payload jsonb
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_permission text:=public.internal_qualification_manage_permission(p_kind);
begin
  if v_permission is null or not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,v_permission)
  then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  return public.api_qualification_change_preview(
    p_tenant_id,p_enterprise_id,p_mall_id,p_kind,p_entity_id,p_payload
  );
end;
$$;

create or replace function public.api_qualification_history_authorized(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,
  p_mall_id text,p_kind text,p_entity_id text
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.internal_anchor_has_permissions(
       p_actor_membership_id,public.internal_qualification_read_permissions(p_kind),false
     ) then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  return public.api_qualification_history(p_tenant_id,p_mall_id,p_kind,p_entity_id);
end;
$$;

create or replace function public.api_qualification_rollback_snapshot_authorized(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,
  p_mall_id text,p_kind text,p_entity_id text,p_audit_id text
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_permission text:=public.internal_qualification_manage_permission(p_kind);
begin
  if v_permission is null or not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,v_permission)
  then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  return public.api_qualification_rollback_snapshot(
    p_tenant_id,p_mall_id,p_kind,p_entity_id,p_audit_id
  );
end;
$$;

create or replace function public.api_qualification_governance_center_authorized(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.internal_anchor_has_permissions(p_actor_membership_id,array[
       'commercial_resource.manage','entitlement.manage','purchase_limit.manage',
       'employee_qualification.read','employee_qualification.manage','qualification.approve'
     ],false) then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  return public.api_qualification_governance_center(p_tenant_id,p_enterprise_id,p_mall_id);
end;
$$;

revoke all on function public.api_qualification_center(text,text)
from public,anon,authenticated,service_role;
revoke all on function public.api_qualification_entity_version(text,text,text,text)
from public,anon,authenticated,service_role;
revoke all on function public.api_qualification_change_preview(text,text,text,text,text,jsonb)
from public,anon,authenticated,service_role;
revoke all on function public.api_qualification_history(text,text,text,text)
from public,anon,authenticated,service_role;
revoke all on function public.api_qualification_rollback_snapshot(text,text,text,text,text)
from public,anon,authenticated,service_role;
revoke all on function public.api_qualification_governance_center(text,text,text)
from public,anon,authenticated,service_role;

revoke all on function public.api_apply_qualification_config(
  text,text,text,text,text,text,text,bigint,jsonb,text,text,text,text,text,jsonb
) from public,anon,authenticated;
revoke all on function public.api_request_qualification_change(
  text,text,text,text,text,text,text,bigint,jsonb,text,text,text,text,text,jsonb
) from public,anon,authenticated;
revoke all on function public.api_review_qualification_change(
  text,text,text,text,text,text,text,text,text,text,jsonb
) from public,anon,authenticated;
revoke all on function public.api_update_employee_qualification(
  text,text,text,text,text,text,bigint,text,text,text,jsonb,jsonb,text,text,text,jsonb
) from public,anon,authenticated;
revoke all on function public.api_qualification_center_authorized(text,text,text,text,text)
from public,anon,authenticated;
revoke all on function public.api_qualification_entity_version_authorized(text,text,text,text,text,text,text)
from public,anon,authenticated;
revoke all on function public.api_qualification_change_preview_authorized(text,text,text,text,text,text,text,jsonb)
from public,anon,authenticated;
revoke all on function public.api_qualification_history_authorized(text,text,text,text,text,text,text)
from public,anon,authenticated;
revoke all on function public.api_qualification_rollback_snapshot_authorized(text,text,text,text,text,text,text,text)
from public,anon,authenticated;
revoke all on function public.api_qualification_governance_center_authorized(text,text,text,text,text)
from public,anon,authenticated;

grant execute on function public.api_apply_qualification_config(
  text,text,text,text,text,text,text,bigint,jsonb,text,text,text,text,text,jsonb
) to service_role;
grant execute on function public.api_request_qualification_change(
  text,text,text,text,text,text,text,bigint,jsonb,text,text,text,text,text,jsonb
) to service_role;
grant execute on function public.api_review_qualification_change(
  text,text,text,text,text,text,text,text,text,text,jsonb
) to service_role;
grant execute on function public.api_update_employee_qualification(
  text,text,text,text,text,text,bigint,text,text,text,jsonb,jsonb,text,text,text,jsonb
) to service_role;
grant execute on function public.api_qualification_center_authorized(text,text,text,text,text) to service_role;
grant execute on function public.api_qualification_entity_version_authorized(text,text,text,text,text,text,text) to service_role;
grant execute on function public.api_qualification_change_preview_authorized(text,text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.api_qualification_history_authorized(text,text,text,text,text,text,text) to service_role;
grant execute on function public.api_qualification_rollback_snapshot_authorized(text,text,text,text,text,text,text,text) to service_role;
grant execute on function public.api_qualification_governance_center_authorized(text,text,text,text,text) to service_role;

-- Step-up and voucher commands inherit the same locked identity predicate.
create or replace function public.api_admin_step_up_identity_matches(
  p_membership_id text,p_user_id text
) returns boolean language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_membership public.memberships%rowtype;
begin
  select * into v_membership from public.memberships where id=p_membership_id;
  if not found then return false; end if;
  return public.api_lock_membership_actor(
    p_membership_id,p_user_id,'admin',v_membership.tenant_id,
    v_membership.enterprise_id,v_membership.mall_id
  );
end;
$$;

create or replace function public.api_voucher_membership_actor_matches(
  p_membership_id text,p_operator_user_id text
) returns boolean language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_membership public.memberships%rowtype;
begin
  select * into v_membership from public.memberships where id=p_membership_id;
  if not found then return false; end if;
  return public.api_lock_membership_actor(
    p_membership_id,p_operator_user_id,'admin',v_membership.tenant_id,
    v_membership.enterprise_id,v_membership.mall_id
  );
end;
$$;

revoke all on function public.api_admin_step_up_identity_matches(text,text)
from public,anon,authenticated;
revoke all on function public.api_voucher_membership_actor_matches(text,text)
from public,anon,authenticated;
grant execute on function public.api_admin_step_up_identity_matches(text,text) to service_role;
grant execute on function public.api_voucher_membership_actor_matches(text,text) to service_role;

-- Session creation is an authentication primitive, not an authorization
-- shortcut.  The selected membership must still own a live locked anchor.
alter function public.api_create_auth_session(
  uuid,text,text,text,text,text,text,timestamptz
) rename to internal_anchor_create_auth_session;
revoke all on function public.internal_anchor_create_auth_session(
  uuid,text,text,text,text,text,text,timestamptz
) from public,anon,authenticated,service_role;

create or replace function public.api_create_auth_session(
  p_session_id uuid,p_member_id text,p_membership_id text,p_target text,
  p_ip_hash text,p_user_agent text,p_device_label text,p_expires_at timestamptz
) returns boolean language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_membership public.memberships%rowtype;
begin
  select * into v_membership from public.memberships
  where id=p_membership_id and member_id=p_member_id and target=p_target;
  if not found or not public.api_lock_membership_actor(
    p_membership_id,v_membership.context_user_id,p_target,v_membership.tenant_id,
    v_membership.enterprise_id,v_membership.mall_id
  ) then return false; end if;
  return public.internal_anchor_create_auth_session(
    p_session_id,p_member_id,p_membership_id,p_target,p_ip_hash,p_user_agent,
    p_device_label,p_expires_at
  );
end;
$$;

revoke all on function public.api_create_auth_session(
  uuid,text,text,text,text,text,text,timestamptz
) from public,anon,authenticated;
grant execute on function public.api_create_auth_session(
  uuid,text,text,text,text,text,text,timestamptz
) to service_role;

-- Password verification may enumerate only memberships whose current
-- server-side authorization anchor is valid.  Expired distributor relations
-- disappear before a session can be selected or created.
create or replace function public.api_list_login_memberships(p_member_id text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with selectable as (
    select
      membership.id,membership.target,membership.status,membership.expires_at,
      tenant.name as tenant_name,enterprise.name as enterprise_name,mall.name as mall_name,
      exists(select 1 from public.membership_scopes scope
        where scope.membership_id=membership.id and scope.scope_kind='platform') as has_platform_scope,
      exists(select 1 from public.membership_scopes scope
        where scope.membership_id=membership.id and scope.scope_kind='distributor') as has_distributor_scope,
      exists(select 1 from public.membership_scopes scope
        where scope.membership_id=membership.id and scope.scope_kind='tenant') as has_tenant_scope,
      exists(select 1 from public.membership_scopes scope
        where scope.membership_id=membership.id and scope.scope_kind='enterprise') as has_enterprise_scope,
      exists(select 1 from public.membership_scopes scope
        where scope.membership_id=membership.id and scope.scope_kind='supplier') as has_supplier_scope,
      coalesce((
        select string_agg(role.name,' / ' order by role.sort_order,role.name)
        from public.membership_roles membership_role
        join public.roles role on role.id=membership_role.role_id
        where membership_role.membership_id=membership.id
          and membership_role.revoked_at is null
          and (membership_role.expires_at is null or membership_role.expires_at>now())
          and role.status='active'
      ),case when membership.target='admin' then '运营成员' else '员工会员' end) as role_name
    from public.memberships membership
    join public.members member
      on member.id=membership.member_id
     and member.user_id=membership.context_user_id
     and member.status='active'
    join public.users user_row
      on user_row.id=membership.context_user_id and user_row.status='active'
    join public.tenants tenant on tenant.id=membership.tenant_id and tenant.status='active'
    left join public.enterprises enterprise
      on enterprise.id=membership.enterprise_id and enterprise.status='active'
    left join public.malls mall on mall.id=membership.mall_id and mall.status='active'
    where membership.member_id=p_member_id
      and membership.status='active'
      and (membership.expires_at is null or membership.expires_at>now())
      and public.api_membership_distributor_anchor_valid(membership.id)
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id',id,'target',target,'status',status,
    'enterpriseName',case when has_platform_scope then tenant_name else coalesce(enterprise_name,tenant_name) end,
    'storeName',case
      when target='admin' and has_platform_scope then '智慧翼平台运营后台'
      when target='admin' then coalesce(mall_name||'运营后台','智慧翼运营后台')
      else coalesce(mall_name,'智慧翼企业福利商城') end,
    'roleName',role_name,
    'dataScope',case
      when has_platform_scope then '平台级全部授权范围'
      when has_distributor_scope then '分销商授权范围'
      when has_tenant_scope then '租户级授权范围'
      when has_enterprise_scope then '企业级授权范围'
      when has_supplier_scope then '供应商授权范围'
      when target='storefront' then '个人福利账户'
      else '商城级授权范围' end,
    'accountTypeLabel',case when target='storefront' then '福利账户' end,
    'subjectScope',case
      when has_platform_scope then '平台'
      when has_distributor_scope then '分销商'
      when has_tenant_scope then '租户'
      when has_enterprise_scope then '企业'
      when has_supplier_scope then '供应商'
      when target='admin' then '商城' end,
    'expireAt',expires_at
  )) order by case when target='storefront' then 0 else 1 end,id),'[]'::jsonb)
  from selectable;
$$;

revoke all on function public.api_list_login_memberships(text)
from public,anon,authenticated;
grant execute on function public.api_list_login_memberships(text) to service_role;
