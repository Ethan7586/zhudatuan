-- Qualification governance: impact preview, four-eyes approval, immutable
-- version history, rollback source data, simulator support and manual employee facts.

insert into public.permissions(id,code,name,category,risk_level,is_mvp) values
  ('permission-employee-qualification-read','employee_qualification.read','查看员工福利资格事实','员工资格','low',true),
  ('permission-employee-qualification-manage','employee_qualification.manage','维护员工福利资格事实','员工资格','high',true),
  ('permission-qualification-approve','qualification.approve','审批高风险资格变更','员工资格','critical',true)
on conflict(code) do update set name=excluded.name,category=excluded.category,risk_level=excluded.risk_level,is_mvp=excluded.is_mvp;

insert into public.role_permissions(role_id,permission_id)
select role.id,permission.id from public.roles role cross join public.permissions permission
where role.is_owner and permission.code in ('employee_qualification.read','employee_qualification.manage','qualification.approve')
on conflict do nothing;

insert into public.roles(id,tenant_id,code,name,description,is_system,is_owner,is_editable,sort_order)
select 'role-qualification-approver',tenant.id,'qualification_approver','资格审批人','审批高风险员工资格变更；不拥有 Owner 身份',true,false,true,45
from public.tenants tenant where tenant.id='tenant-smart-wing'
on conflict(tenant_id,code) do update set name=excluded.name,description=excluded.description,is_owner=false,is_editable=true,sort_order=excluded.sort_order;

insert into public.role_permissions(role_id,permission_id)
select role.id,permission.id from public.roles role cross join public.permissions permission
where role.code='qualification_approver' and permission.code in ('commercial_resource.read','entitlement.read','purchase_limit.read','employee_qualification.read','qualification.approve')
on conflict do nothing;

-- Test roster only: admin001 is the second reviewer. Production memberships
-- receive this role only through an explicit Owner grant.
insert into public.membership_roles(membership_id,role_id,granted_by_membership_id)
select membership.id,role.id,'membership-test-owner-admin'
from public.memberships membership cross join public.roles role
where membership.id='membership-test-admin-001' and role.tenant_id=membership.tenant_id and role.code='qualification_approver'
  and exists(select 1 from public.memberships owner_membership where owner_membership.id='membership-test-owner-admin' and owner_membership.tenant_id=membership.tenant_id)
on conflict(membership_id,role_id) do update set granted_by_membership_id=excluded.granted_by_membership_id,revoked_at=null;

create table if not exists public.qualification_change_requests (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text not null references public.enterprises(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete cascade,
  config_kind text not null check (config_kind in ('catalog_pool','city_zone','entitlement_policy','purchase_limit','supplier_agreement','brand','store')),
  entity_id text,
  expected_version bigint not null check (expected_version >= 0),
  requested_status text not null check (requested_status in ('draft','active','disabled')),
  payload_json jsonb not null check (jsonb_typeof(payload_json)='object'),
  preview_json jsonb not null check (jsonb_typeof(preview_json)='object'),
  reason text not null check (length(trim(reason)) >= 4),
  risk_level text not null check (risk_level in ('elevated','high','critical')),
  status text not null default 'pending' check (status in ('pending','rejected','applied','stale','cancelled')),
  requested_by_user_id text not null references public.users(id) on delete restrict,
  requested_by_membership_id text not null references public.memberships(id) on delete restrict,
  reviewed_by_user_id text references public.users(id) on delete restrict,
  reviewed_by_membership_id text references public.memberships(id) on delete restrict,
  review_reason text,
  applied_result_json jsonb,
  idempotency_key text not null check (length(idempotency_key) between 8 and 120),
  request_hash text not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  applied_at timestamptz
);

create index if not exists qualification_change_requests_queue on public.qualification_change_requests(mall_id,status,created_at desc);
create unique index if not exists qualification_one_pending_change on public.qualification_change_requests(mall_id,config_kind,coalesce(entity_id,'new:'||request_hash)) where status='pending';
create unique index if not exists qualification_change_request_idempotency on public.qualification_change_requests(mall_id,requested_by_membership_id,idempotency_key);
alter table public.qualification_change_requests enable row level security;
revoke all on table public.qualification_change_requests from public,anon,authenticated;

create or replace function public.api_qualification_entity_version(p_tenant_id text,p_mall_id text,p_kind text,p_entity_id text)
returns bigint language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_version bigint;
begin
  if nullif(trim(coalesce(p_entity_id,'')),'') is null then return 0; end if;
  if p_kind='catalog_pool' then select version into v_version from public.catalog_pools where id=p_entity_id and tenant_id=p_tenant_id and owner_kind='mall' and owner_id=p_mall_id;
  elsif p_kind='city_zone' then select version into v_version from public.city_zones where id=p_entity_id and tenant_id=p_tenant_id and mall_id=p_mall_id;
  elsif p_kind='entitlement_policy' then select version into v_version from public.entitlement_policies where id=p_entity_id and tenant_id=p_tenant_id and mall_id=p_mall_id;
  elsif p_kind='purchase_limit' then select version into v_version from public.purchase_limit_templates where id=p_entity_id and tenant_id=p_tenant_id and mall_id=p_mall_id;
  elsif p_kind='supplier_agreement' then select version into v_version from public.mall_supplier_agreements where id=p_entity_id and tenant_id=p_tenant_id and mall_id=p_mall_id;
  elsif p_kind='brand' then select version into v_version from public.brands where id=p_entity_id and tenant_id=p_tenant_id;
  elsif p_kind='store' then select version into v_version from public.stores where id=p_entity_id and tenant_id=p_tenant_id;
  else raise exception 'QUALIFICATION_CONFIG_KIND_INVALID'; end if;
  return v_version;
end;
$$;

create or replace function public.api_qualification_change_preview(p_tenant_id text,p_enterprise_id text,p_mall_id text,p_kind text,p_entity_id text,p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_status text:=coalesce(p_payload->>'status','draft'); v_current_status text; v_employee_count integer:=0; v_sku_count integer:=0;
  v_requires boolean:=false; v_reasons text[]:='{}'; v_risk text:='elevated';
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or v_status not in ('draft','active','disabled') then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
  if p_kind in ('entitlement_policy','purchase_limit') then
    if jsonb_typeof(p_payload->'subjects') is distinct from 'array' or jsonb_typeof(p_payload->'resources') is distinct from 'array' then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    select count(distinct membership.context_user_id) into v_employee_count
    from public.memberships membership
    where membership.tenant_id=p_tenant_id and membership.enterprise_id=p_enterprise_id and membership.mall_id=p_mall_id
      and membership.target='storefront' and membership.status='active' and (membership.expires_at is null or membership.expires_at>now())
      and exists(select 1 from jsonb_array_elements(p_payload->'subjects') subject where public.api_qualification_subject_matches(subject->>'kind',subject->>'id',p_tenant_id,p_enterprise_id,membership.context_user_id,membership.id));
    select count(distinct sku.id) into v_sku_count from public.skus sku join public.products product on product.id=sku.product_id
    where sku.tenant_id=p_tenant_id and sku.mall_id=p_mall_id
      and exists(select 1 from jsonb_array_elements(p_payload->'resources') resource where public.api_qualification_resource_matches(resource->>'kind',resource->>'id',p_tenant_id,p_mall_id,product.id,sku.id));
  else
    select count(distinct context_user_id) into v_employee_count from public.memberships where tenant_id=p_tenant_id and enterprise_id=p_enterprise_id and mall_id=p_mall_id and target='storefront' and status='active';
    if p_kind='catalog_pool' and jsonb_typeof(p_payload->'skuIds')='array' then v_sku_count:=jsonb_array_length(p_payload->'skuIds');
    elsif p_kind='city_zone' and jsonb_typeof(p_payload->'resources')='array' then v_sku_count:=jsonb_array_length(p_payload->'resources');
    elsif p_kind='brand' and jsonb_typeof(p_payload->'productIds')='array' then v_sku_count:=jsonb_array_length(p_payload->'productIds');
    elsif p_kind='store' and jsonb_typeof(p_payload->'brandIds')='array' then v_sku_count:=jsonb_array_length(p_payload->'brandIds'); end if;
  end if;

  if nullif(trim(coalesce(p_entity_id,'')),'') is not null then
    if p_kind='catalog_pool' then select status into v_current_status from public.catalog_pools where id=p_entity_id and tenant_id=p_tenant_id and owner_kind='mall' and owner_id=p_mall_id;
    elsif p_kind='city_zone' then select status into v_current_status from public.city_zones where id=p_entity_id and tenant_id=p_tenant_id and mall_id=p_mall_id;
    elsif p_kind='entitlement_policy' then select status into v_current_status from public.entitlement_policies where id=p_entity_id and tenant_id=p_tenant_id and mall_id=p_mall_id;
    elsif p_kind='purchase_limit' then select status into v_current_status from public.purchase_limit_templates where id=p_entity_id and tenant_id=p_tenant_id and mall_id=p_mall_id;
    elsif p_kind='supplier_agreement' then select status into v_current_status from public.mall_supplier_agreements where id=p_entity_id and tenant_id=p_tenant_id and mall_id=p_mall_id;
    elsif p_kind='brand' then select status into v_current_status from public.brands where id=p_entity_id and tenant_id=p_tenant_id;
    elsif p_kind='store' then select status into v_current_status from public.stores where id=p_entity_id and tenant_id=p_tenant_id; end if;
  end if;
  if v_current_status='active' and v_status<>'active' then v_requires:=true; v_risk:='critical'; v_reasons:=array_append(v_reasons,'停用或转为草稿会立即撤销现有生效范围'); end if;
  if v_status='active' and p_kind in ('city_zone','purchase_limit') then v_requires:=true; v_risk:='high'; v_reasons:=array_append(v_reasons,case p_kind when 'city_zone' then '城市规则会改变员工可见或可买范围' else '限售规则会直接限制员工下单' end); end if;
  if v_status='active' and p_kind='entitlement_policy' and (p_payload->>'effect'='deny' or exists(select 1 from jsonb_array_elements(p_payload->'subjects') x where x->>'kind'='all') or exists(select 1 from jsonb_array_elements(p_payload->'resources') x where x->>'kind'='all')) then v_requires:=true; v_risk:=case when p_payload->>'effect'='deny' then 'critical' else 'high' end; v_reasons:=array_append(v_reasons,case when p_payload->>'effect'='deny' then '明确拒绝优先于任何允许规则' else '规则覆盖全部员工或全部商品' end); end if;
  if v_status='active' and p_kind='catalog_pool' and v_sku_count>=50 then v_requires:=true; v_risk:='high'; v_reasons:=array_append(v_reasons,'商品池一次影响 50 个及以上 SKU'); end if;
  if v_employee_count>=100 and v_status='active' then v_requires:=true; if v_risk='elevated' then v_risk:='high'; end if; v_reasons:=array_append(v_reasons,'预计影响 100 名及以上员工'); end if;
  return jsonb_build_object('requiresApproval',v_requires,'riskLevel',v_risk,'affectedEmployees',v_employee_count,'affectedSkus',v_sku_count,'currentStatus',v_current_status,'requestedStatus',v_status,'reasons',to_jsonb(v_reasons));
end;
$$;

create or replace function public.api_request_qualification_change(
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_actor_user_id text,p_actor_membership_id text,
  p_kind text,p_entity_id text,p_expected_version bigint,p_payload jsonb,p_reason text,p_idempotency_key text,p_request_hash text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_preview jsonb; v_id text:='qualification-change-'||gen_random_uuid()::text; v_existing public.qualification_change_requests%rowtype;
begin
  if length(trim(coalesce(p_reason,'')))<4 then raise exception 'QUALIFICATION_CHANGE_REASON_REQUIRED'; end if;
  if length(trim(coalesce(p_idempotency_key,'')))<8 or length(p_idempotency_key)>120 or length(trim(coalesce(p_request_hash,'')))<16 then raise exception 'IDEMPOTENCY_KEY_INVALID'; end if;
  if not exists(select 1 from public.memberships membership join public.users actor on actor.id=membership.context_user_id where membership.id=p_actor_membership_id and membership.context_user_id=p_actor_user_id and membership.tenant_id=p_tenant_id and membership.enterprise_id=p_enterprise_id and membership.mall_id=p_mall_id and membership.target='admin' and membership.status='active' and (membership.expires_at is null or membership.expires_at>now()) and actor.status='active') then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_mall_id||':qualification:approval:'||p_actor_membership_id||':'||p_idempotency_key,0));
  select * into v_existing from public.qualification_change_requests where mall_id=p_mall_id and requested_by_membership_id=p_actor_membership_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_hash<>p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('approvalRequired',true,'changeRequestId',v_existing.id,'status',v_existing.status,'preview',v_existing.preview_json);
  end if;
  if coalesce(public.api_qualification_entity_version(p_tenant_id,p_mall_id,p_kind,p_entity_id),-1)<>p_expected_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
  v_preview:=public.api_qualification_change_preview(p_tenant_id,p_enterprise_id,p_mall_id,p_kind,p_entity_id,p_payload);
  if not coalesce((v_preview->>'requiresApproval')::boolean,false) then raise exception 'QUALIFICATION_APPROVAL_NOT_REQUIRED'; end if;
  insert into public.qualification_change_requests(id,tenant_id,enterprise_id,mall_id,config_kind,entity_id,expected_version,requested_status,payload_json,preview_json,reason,risk_level,requested_by_user_id,requested_by_membership_id,idempotency_key,request_hash)
  values(v_id,p_tenant_id,p_enterprise_id,p_mall_id,p_kind,nullif(trim(coalesce(p_entity_id,'')),''),p_expected_version,p_payload->>'status',p_payload,v_preview,trim(p_reason),v_preview->>'riskLevel',p_actor_user_id,p_actor_membership_id,p_idempotency_key,p_request_hash);
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','qualification.change.request','qualification_change_request',v_id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('reason',trim(p_reason),'preview',v_preview,'kind',p_kind,'entityId',p_entity_id),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('approvalRequired',true,'changeRequestId',v_id,'status','pending','preview',v_preview);
exception when unique_violation then raise exception 'QUALIFICATION_APPROVAL_ALREADY_PENDING';
end;
$$;

create or replace function public.api_review_qualification_change(
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_actor_user_id text,p_actor_membership_id text,p_change_request_id text,p_decision text,p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_change public.qualification_change_requests%rowtype; v_result jsonb; v_current bigint; v_stale boolean:=false;
begin
  if p_decision not in ('approve','reject') or length(trim(coalesce(p_reason,'')))<4 then raise exception 'QUALIFICATION_REVIEW_INVALID'; end if;
  if not exists(
    select 1 from public.memberships membership join public.users actor on actor.id=membership.context_user_id
    where membership.id=p_actor_membership_id and membership.context_user_id=p_actor_user_id and membership.tenant_id=p_tenant_id and membership.enterprise_id=p_enterprise_id and membership.mall_id=p_mall_id and membership.target='admin' and membership.status='active' and (membership.expires_at is null or membership.expires_at>now()) and actor.status='active'
      and not exists(select 1 from public.membership_permission_overrides denied join public.permissions permission on permission.id=denied.permission_id where denied.membership_id=membership.id and permission.code='qualification.approve' and denied.effect='deny' and denied.revoked_at is null and (denied.expires_at is null or denied.expires_at>now()))
      and (exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.role_id=mr.role_id join public.permissions permission on permission.id=rp.permission_id where mr.membership_id=membership.id and mr.revoked_at is null and (mr.expires_at is null or mr.expires_at>now()) and permission.code='qualification.approve') or exists(select 1 from public.membership_permission_overrides allowed join public.permissions permission on permission.id=allowed.permission_id where allowed.membership_id=membership.id and permission.code='qualification.approve' and allowed.effect='allow' and allowed.revoked_at is null and (allowed.expires_at is null or allowed.expires_at>now())))
  ) then raise exception 'QUALIFICATION_APPROVER_INVALID'; end if;
  select * into v_change from public.qualification_change_requests where id=p_change_request_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id and mall_id=p_mall_id for update;
  if not found then raise exception 'QUALIFICATION_APPROVAL_NOT_FOUND'; end if;
  if v_change.status='applied' then return coalesce(v_change.applied_result_json,'{}')||jsonb_build_object('changeRequestId',v_change.id,'status','applied'); end if;
  if v_change.status<>'pending' then raise exception 'QUALIFICATION_APPROVAL_NOT_PENDING'; end if;
  if v_change.requested_by_membership_id=p_actor_membership_id or v_change.requested_by_user_id=p_actor_user_id then raise exception 'QUALIFICATION_SELF_APPROVAL_FORBIDDEN'; end if;
  if p_decision='reject' then
    update public.qualification_change_requests set status='rejected',reviewed_by_user_id=p_actor_user_id,reviewed_by_membership_id=p_actor_membership_id,review_reason=trim(p_reason),reviewed_at=now() where id=v_change.id;
    v_result:=jsonb_build_object('changeRequestId',v_change.id,'status','rejected');
  else
    v_current:=public.api_qualification_entity_version(p_tenant_id,p_mall_id,v_change.config_kind,coalesce(v_change.entity_id,''));
    if coalesce(v_current,-1)<>v_change.expected_version then
      v_stale:=true;
      v_result:=jsonb_build_object('changeRequestId',v_change.id,'status','stale','currentVersion',v_current);
      update public.qualification_change_requests set status='stale',reviewed_by_user_id=p_actor_user_id,reviewed_by_membership_id=p_actor_membership_id,review_reason=trim(p_reason),reviewed_at=now() where id=v_change.id;
    else
      v_result:=public.api_apply_qualification_config(p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,p_actor_membership_id,v_change.config_kind,coalesce(v_change.entity_id,''),v_change.expected_version,v_change.payload_json,v_change.reason||'；审批意见：'||trim(p_reason),'approval-'||v_change.id,v_change.request_hash,p_request_id,p_user_agent,p_granted_via||jsonb_build_object('changeRequestId',v_change.id,'requestedByMembershipId',v_change.requested_by_membership_id));
      update public.qualification_change_requests set status='applied',reviewed_by_user_id=p_actor_user_id,reviewed_by_membership_id=p_actor_membership_id,review_reason=trim(p_reason),reviewed_at=now(),applied_at=now(),applied_result_json=v_result where id=v_change.id;
      v_result:=v_result||jsonb_build_object('changeRequestId',v_change.id,'status','applied');
    end if;
  end if;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','qualification.change.'||p_decision,'qualification_change_request',v_change.id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('reason',trim(p_reason),'result',v_result),p_actor_membership_id,p_granted_via);
  return v_result;
end;
$$;

create or replace function public.api_qualification_history(p_tenant_id text,p_mall_id text,p_kind text,p_entity_id text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
select coalesce(jsonb_agg(jsonb_build_object('auditId',audit.id,'version',case when audit.after_json->>'version' ~ '^[0-9]+$' then (audit.after_json->>'version')::bigint else 0 end,'status',audit.after_json->>'status','config',audit.after_json->'config','reason',audit.after_json->>'changeReason','actorUserId',audit.actor_user_id,'actorMembershipId',audit.membership_id,'createdAt',audit.created_at) order by audit.created_at desc),'[]'::jsonb)
from public.audit_logs audit where audit.tenant_id=p_tenant_id and audit.mall_id=p_mall_id and audit.resource_type=p_kind and audit.resource_id=p_entity_id and audit.action='qualification.'||p_kind||'.save' and audit.after_json ? 'config';
$$;

create or replace function public.api_qualification_rollback_snapshot(p_tenant_id text,p_mall_id text,p_kind text,p_entity_id text,p_audit_id text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_config jsonb;
begin
  select audit.after_json->'config' into v_config from public.audit_logs audit
  where audit.id=p_audit_id and audit.tenant_id=p_tenant_id and audit.mall_id=p_mall_id
    and audit.resource_type=p_kind and audit.resource_id=p_entity_id
    and audit.action='qualification.'||p_kind||'.save' and audit.after_json ? 'config';
  if not found or jsonb_typeof(v_config) is distinct from 'object' then raise exception 'QUALIFICATION_HISTORY_NOT_FOUND'; end if;
  return v_config;
end;
$$;

create or replace function public.api_qualification_governance_center(p_tenant_id text,p_enterprise_id text,p_mall_id text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
select jsonb_build_object(
  'changeRequests',coalesce((select jsonb_agg(jsonb_build_object('id',request.id,'kind',request.config_kind,'entityId',request.entity_id,'expectedVersion',request.expected_version,'requestedStatus',request.requested_status,'reason',request.reason,'riskLevel',request.risk_level,'status',request.status,'preview',request.preview_json,'requesterName',requester.display_name,'requesterMembershipId',request.requested_by_membership_id,'reviewerName',reviewer.display_name,'reviewReason',request.review_reason,'createdAt',request.created_at,'reviewedAt',request.reviewed_at) order by case when request.status='pending' then 0 else 1 end,request.created_at desc) from (select * from public.qualification_change_requests where tenant_id=p_tenant_id and enterprise_id=p_enterprise_id and mall_id=p_mall_id order by created_at desc limit 50) request join public.users requester on requester.id=request.requested_by_user_id left join public.users reviewer on reviewer.id=request.reviewed_by_user_id),'[]'::jsonb),
  'employees',coalesce((select jsonb_agg(jsonb_build_object('userId',employee.id,'membershipId',employee.membership_id,'name',employee.display_name,'employeeNo',employee.employee_no,'departmentId',employee.department_id,'departmentName',employee.department_name,'cityCode',employee.city_code,'cityName',employee.city_name,'status',employee.qualification_status,'version',employee.profile_version,'tags',coalesce((select jsonb_agg(jsonb_build_object('code',tag.tag_code,'startsAt',tag.starts_at,'endsAt',tag.ends_at,'source',tag.source) order by tag.tag_code) from public.employee_qualification_tags tag where tag.user_id=employee.id),'[]'::jsonb)) order by employee.display_name) from (select distinct on (user_row.id) user_row.id,user_row.display_name,user_row.employee_no,user_row.department_id,department.name department_name,membership.id membership_id,profile.city_code,profile.city_name,coalesce(profile.status,'active') qualification_status,coalesce(profile.version,0) profile_version from public.memberships membership join public.users user_row on user_row.id=membership.context_user_id left join public.departments department on department.id=user_row.department_id left join public.employee_qualification_profiles profile on profile.user_id=user_row.id where membership.tenant_id=p_tenant_id and membership.enterprise_id=p_enterprise_id and membership.mall_id=p_mall_id and membership.target='storefront' and membership.status='active' and (membership.expires_at is null or membership.expires_at>now()) and user_row.status='active' order by user_row.id,membership.created_at) employee),'[]'::jsonb)
);
$$;

create or replace function public.api_update_employee_qualification(
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_actor_user_id text,p_actor_membership_id text,p_user_id text,p_expected_version bigint,p_city_code text,p_city_name text,p_status text,p_attributes jsonb,p_tags jsonb,p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_previous jsonb; v_version bigint; v_after jsonb;
begin
  if p_status not in ('active','disabled') or jsonb_typeof(p_attributes) is distinct from 'object' or jsonb_typeof(p_tags) is distinct from 'array' or length(trim(coalesce(p_reason,'')))<4 then raise exception 'EMPLOYEE_QUALIFICATION_INVALID'; end if;
  if not exists(select 1 from public.memberships where id=p_actor_membership_id and context_user_id=p_actor_user_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id and mall_id=p_mall_id and target='admin' and status='active' and (expires_at is null or expires_at>now())) then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  if not exists(select 1 from public.memberships membership join public.users user_row on user_row.id=membership.context_user_id where membership.context_user_id=p_user_id and membership.tenant_id=p_tenant_id and membership.enterprise_id=p_enterprise_id and membership.mall_id=p_mall_id and membership.target='storefront' and membership.status='active' and (membership.expires_at is null or membership.expires_at>now()) and user_row.status='active') then raise exception 'EMPLOYEE_QUALIFICATION_USER_NOT_FOUND'; end if;
  if exists(select 1 from jsonb_array_elements(p_tags) tag where length(trim(coalesce(tag->>'code','')))<1 or length(tag->>'code')>64 or tag->>'code' ~ '[[:space:],]') then raise exception 'EMPLOYEE_QUALIFICATION_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements(p_tags) tag where nullif(tag->>'startsAt','') is not null and (tag->>'startsAt')::timestamptz is null) or exists(select 1 from jsonb_array_elements(p_tags) tag where nullif(tag->>'endsAt','') is not null and (tag->>'endsAt')::timestamptz is null) then raise exception 'EMPLOYEE_QUALIFICATION_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements(p_tags) requested join public.employee_qualification_tags existing on existing.user_id=p_user_id and existing.tag_code=trim(requested->>'code') where existing.source<>'manual') then raise exception 'EMPLOYEE_QUALIFICATION_TAG_SOURCE_CONFLICT'; end if;
  select version,to_jsonb(profile) into v_version,v_previous from public.employee_qualification_profiles profile where user_id=p_user_id for update;
  v_previous:=coalesce(v_previous,'{}'::jsonb)||jsonb_build_object('tags',coalesce((select jsonb_agg(jsonb_build_object('code',tag_code,'startsAt',starts_at,'endsAt',ends_at,'source',source)) from public.employee_qualification_tags where user_id=p_user_id),'[]'::jsonb));
  if found then
    if p_expected_version<>v_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
    update public.employee_qualification_profiles set city_code=nullif(trim(coalesce(p_city_code,'')),''),city_name=nullif(trim(coalesce(p_city_name,'')),''),status=p_status,attributes_json=p_attributes,version=version+1,updated_at=now() where user_id=p_user_id returning version into v_version;
  else
    if p_expected_version<>0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
    insert into public.employee_qualification_profiles(tenant_id,user_id,city_code,city_name,status,attributes_json,version) values(p_tenant_id,p_user_id,nullif(trim(coalesce(p_city_code,'')),''),nullif(trim(coalesce(p_city_name,'')),''),p_status,p_attributes,1) returning version into v_version;
  end if;
  delete from public.employee_qualification_tags where user_id=p_user_id and source='manual';
  insert into public.employee_qualification_tags(tenant_id,user_id,tag_code,starts_at,ends_at,source)
  select p_tenant_id,p_user_id,trim(tag->>'code'),nullif(tag->>'startsAt','')::timestamptz,nullif(tag->>'endsAt','')::timestamptz,'manual' from jsonb_array_elements(p_tags) tag on conflict(user_id,tag_code) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at where employee_qualification_tags.source='manual';
  select to_jsonb(profile)||jsonb_build_object('tags',coalesce((select jsonb_agg(jsonb_build_object('code',tag_code,'startsAt',starts_at,'endsAt',ends_at,'source',source)) from public.employee_qualification_tags where user_id=p_user_id),'[]'::jsonb)) into v_after from public.employee_qualification_profiles profile where user_id=p_user_id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','qualification.employee.update','employee_qualification',p_user_id,p_request_id,left(coalesce(p_user_agent,''),300),v_previous,v_after||jsonb_build_object('changeReason',trim(p_reason)),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('userId',p_user_id,'version',v_version,'status',p_status);
end;
$$;

revoke all on function public.api_qualification_entity_version(text,text,text,text) from public,anon,authenticated;
revoke all on function public.api_qualification_change_preview(text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.api_request_qualification_change(text,text,text,text,text,text,text,bigint,jsonb,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.api_review_qualification_change(text,text,text,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.api_qualification_history(text,text,text,text) from public,anon,authenticated;
revoke all on function public.api_qualification_rollback_snapshot(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.api_qualification_governance_center(text,text,text) from public,anon,authenticated;
revoke all on function public.api_update_employee_qualification(text,text,text,text,text,text,bigint,text,text,text,jsonb,jsonb,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.api_qualification_entity_version(text,text,text,text) to service_role;
grant execute on function public.api_qualification_change_preview(text,text,text,text,text,jsonb) to service_role;
grant execute on function public.api_request_qualification_change(text,text,text,text,text,text,text,bigint,jsonb,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.api_review_qualification_change(text,text,text,text,text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.api_qualification_history(text,text,text,text) to service_role;
grant execute on function public.api_qualification_rollback_snapshot(text,text,text,text,text) to service_role;
grant execute on function public.api_qualification_governance_center(text,text,text) to service_role;
grant execute on function public.api_update_employee_qualification(text,text,text,text,text,text,bigint,text,text,text,jsonb,jsonb,text,text,text,jsonb) to service_role;
