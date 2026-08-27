-- Custom role lifecycle and the remaining server-validated data scopes.
-- Owner stays unique and immutable; custom roles can never mint Owner status.

alter table public.roles add column if not exists status text not null default 'active';
alter table public.roles add column if not exists created_by_membership_id text references public.memberships(id) on delete restrict;
alter table public.roles add column if not exists created_at timestamptz not null default now();
alter table public.roles add column if not exists updated_at timestamptz not null default now();
alter table public.roles drop constraint if exists roles_status_check;
alter table public.roles add constraint roles_status_check check (status in ('active','disabled'));
create index if not exists roles_tenant_status_sort on public.roles(tenant_id,status,sort_order,name);

create or replace function public.validate_membership_scope()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare membership_row public.memberships%rowtype; is_valid boolean:=false;
begin
  select * into membership_row from public.memberships where id=new.membership_id;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if new.scope_kind='platform' then
    select exists(select 1 from public.org_units o where o.id=new.resource_id and o.kind='platform' and o.status='active') into is_valid;
  elsif new.scope_kind='distributor' then
    select exists(
      select 1 from public.org_units distributor
      join public.org_unit_closure path on path.ancestor_id=distributor.id
      join public.org_units tenant_node on tenant_node.id=path.descendant_id
      where distributor.id=new.resource_id and distributor.kind='distributor' and distributor.status='active'
        and tenant_node.source_type='tenant' and tenant_node.source_id=membership_row.tenant_id
    ) into is_valid;
  elsif new.scope_kind='tenant' then is_valid:=new.resource_id=membership_row.tenant_id;
  elsif new.scope_kind='enterprise' then select exists(select 1 from public.enterprises e where e.id=new.resource_id and e.tenant_id=membership_row.tenant_id) into is_valid;
  elsif new.scope_kind='mall' then select exists(select 1 from public.malls m where m.id=new.resource_id and m.tenant_id=membership_row.tenant_id) into is_valid;
  elsif new.scope_kind='supplier' then select exists(select 1 from public.suppliers s where s.id=new.resource_id and s.tenant_id=membership_row.tenant_id) into is_valid;
  elsif new.scope_kind='brand' then select exists(select 1 from public.brands b where b.id=new.resource_id and b.tenant_id=membership_row.tenant_id and b.status<>'disabled') into is_valid;
  elsif new.scope_kind='store' then select exists(select 1 from public.stores s where s.id=new.resource_id and s.tenant_id=membership_row.tenant_id and s.status<>'disabled') into is_valid;
  elsif new.scope_kind='department' then select exists(select 1 from public.departments d where d.id=new.resource_id and d.tenant_id=membership_row.tenant_id and d.enterprise_id=membership_row.enterprise_id) into is_valid;
  elsif new.scope_kind='self' then is_valid:=new.resource_id=membership_row.context_user_id;
  end if;
  if not coalesce(is_valid,false) then raise exception 'MEMBERSHIP_SCOPE_OUTSIDE_TENANT'; end if;
  return new;
end;
$$;

create or replace function public.api_actor_can_grant_scope(p_actor_membership_id text,p_scope_kind text,p_resource_id text)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor public.memberships%rowtype;
begin
  select * into actor from public.memberships where id=p_actor_membership_id and target='admin' and status='active';
  if not found or p_scope_kind not in ('platform','tenant','distributor','enterprise','mall','supplier','brand','store','department','self') then return false; end if;
  if exists(select 1 from public.membership_scopes s where s.membership_id=actor.id and s.scope_kind=p_scope_kind and s.resource_id=p_resource_id) then return true; end if;
  if exists(select 1 from public.membership_scopes s where s.membership_id=actor.id and s.scope_kind='platform') then return true; end if;
  if p_scope_kind in ('platform','distributor') then return false; end if;
  if exists(select 1 from public.membership_scopes s where s.membership_id=actor.id and s.scope_kind='distributor'
    and exists(select 1 from public.org_unit_closure path join public.org_units tenant_node on tenant_node.id=path.descendant_id
      where path.ancestor_id=s.resource_id and tenant_node.source_type='tenant' and tenant_node.source_id=actor.tenant_id)) then return true; end if;
  if exists(select 1 from public.membership_scopes s where s.membership_id=actor.id and s.scope_kind='tenant' and s.resource_id=actor.tenant_id) then
    return case p_scope_kind
      when 'tenant' then p_resource_id=actor.tenant_id
      when 'enterprise' then exists(select 1 from public.enterprises e where e.id=p_resource_id and e.tenant_id=actor.tenant_id)
      when 'mall' then exists(select 1 from public.malls m where m.id=p_resource_id and m.tenant_id=actor.tenant_id)
      when 'supplier' then exists(select 1 from public.suppliers s where s.id=p_resource_id and s.tenant_id=actor.tenant_id)
      when 'brand' then exists(select 1 from public.brands b where b.id=p_resource_id and b.tenant_id=actor.tenant_id and b.status<>'disabled')
      when 'store' then exists(select 1 from public.stores s where s.id=p_resource_id and s.tenant_id=actor.tenant_id and s.status<>'disabled')
      when 'department' then exists(select 1 from public.departments d where d.id=p_resource_id and d.tenant_id=actor.tenant_id)
      when 'self' then exists(select 1 from public.users u where u.id=p_resource_id and u.tenant_id=actor.tenant_id)
      else false end;
  end if;
  if p_scope_kind='mall' and exists(select 1 from public.malls m join public.membership_scopes s on s.membership_id=actor.id and s.scope_kind='enterprise' and s.resource_id=m.enterprise_id where m.id=p_resource_id) then return true; end if;
  if p_scope_kind='department' and exists(select 1 from public.departments d join public.membership_scopes s on s.membership_id=actor.id and s.scope_kind='enterprise' and s.resource_id=d.enterprise_id where d.id=p_resource_id) then return true; end if;
  if p_scope_kind='brand' and exists(select 1 from public.supplier_brand_bindings sb join public.membership_scopes s on s.membership_id=actor.id and s.scope_kind='supplier' and s.resource_id=sb.supplier_id where sb.brand_id=p_resource_id and sb.status='active') then return true; end if;
  if p_scope_kind='store' and exists(select 1 from public.brand_store_bindings bs join public.membership_scopes s on s.membership_id=actor.id and s.scope_kind='brand' and s.resource_id=bs.brand_id where bs.store_id=p_resource_id and bs.status='active') then return true; end if;
  return false;
end;
$$;

create or replace function public.api_custom_role_center(p_actor_membership_id text,p_tenant_id text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor public.memberships%rowtype; actor_is_owner boolean;
begin
  select * into actor from public.memberships where id=p_actor_membership_id and tenant_id=p_tenant_id and target='admin' and status='active';
  if not found then return null; end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=actor.id and mr.revoked_at is null and r.is_owner) into actor_is_owner;
  return jsonb_build_object(
    'roles',coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'code',r.code,'name',r.name,'description',r.description,'status',r.status,
      'isSystem',r.is_system,'isOwner',r.is_owner,'isEditable',r.is_editable,
      'assignmentCount',(select count(*) from public.membership_roles mr where mr.role_id=r.id and mr.revoked_at is null and (mr.expires_at is null or mr.expires_at>now())),
      'permissions',coalesce((select jsonb_agg(p.code order by p.code) from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=r.id),'[]'::jsonb),
      'createdAt',r.created_at,'updatedAt',r.updated_at
    ) order by case when r.status='active' then 0 else 1 end,r.sort_order,r.name) from public.roles r where r.tenant_id=p_tenant_id),'[]'::jsonb),
    'permissions',coalesce((select jsonb_agg(jsonb_build_object(
      'code',p.code,'name',p.name,'category',p.category,'risk',p.risk_level,'mvp',p.is_mvp,
      'grantable',actor_is_owner or (exists(select 1 from public.membership_roles mr join public.roles ar on ar.id=mr.role_id and ar.status='active' join public.role_permissions rp on rp.role_id=ar.id where mr.membership_id=actor.id and mr.revoked_at is null and rp.permission_id=p.id)
        and not exists(select 1 from public.membership_permission_overrides deny where deny.membership_id=actor.id and deny.permission_id=p.id and deny.effect='deny' and deny.revoked_at is null and (deny.expires_at is null or deny.expires_at>now())))
    ) order by p.category,p.code) from public.permissions p),'[]'::jsonb)
  );
end;
$$;

create or replace function public.api_create_custom_role(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_code text,p_name text,p_description text,p_permission_codes text[],p_source_role_id text,
  p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.memberships%rowtype; source_role public.roles%rowtype; actor_is_owner boolean; role_id text:='role-custom-'||gen_random_uuid()::text; requested text[];
begin
  select * into actor from public.memberships where id=p_actor_membership_id and context_user_id=p_actor_user_id and tenant_id=p_tenant_id and target='admin' and status='active';
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if lower(trim(coalesce(p_code,''))) !~ '^[a-z][a-z0-9_]{2,39}$' or length(trim(coalesce(p_name,''))) not between 2 and 60 or length(coalesce(p_description,''))>300 or length(trim(coalesce(p_reason,'')))<4 then raise exception 'CUSTOM_ROLE_INPUT_INVALID'; end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=actor.id and mr.revoked_at is null and r.is_owner) into actor_is_owner;
  if p_source_role_id is not null then
    select * into source_role from public.roles where id=p_source_role_id and tenant_id=p_tenant_id and status='active';
    if not found then raise exception 'ROLE_NOT_FOUND'; end if;
    if source_role.is_owner then raise exception 'OWNER_ROLE_PROTECTED'; end if;
    select coalesce(array_agg(p.code order by p.code),'{}') into requested from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=source_role.id;
  else requested:=coalesce(p_permission_codes,'{}'); end if;
  if cardinality(requested)>100 or exists(select 1 from unnest(requested) code where not exists(select 1 from public.permissions p where p.code=code)) then raise exception 'PERMISSION_NOT_FOUND'; end if;
  if not actor_is_owner and exists(select 1 from public.permissions p where p.code=any(requested) and not (
    exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.role_id=r.id where mr.membership_id=actor.id and mr.revoked_at is null and rp.permission_id=p.id)
    and not exists(select 1 from public.membership_permission_overrides deny where deny.membership_id=actor.id and deny.permission_id=p.id and deny.effect='deny' and deny.revoked_at is null and (deny.expires_at is null or deny.expires_at>now()))
  )) then raise exception 'ROLE_GRANT_EXCEEDS_ACTOR'; end if;
  begin
    insert into public.roles(id,tenant_id,code,name,description,is_system,is_owner,is_editable,sort_order,status,created_by_membership_id)
    values(role_id,p_tenant_id,lower(trim(p_code)),trim(p_name),trim(coalesce(p_description,'')),false,false,true,200,'active',actor.id);
  exception when unique_violation then raise exception 'ROLE_CODE_CONFLICT'; end;
  insert into public.role_permissions(role_id,permission_id) select role_id,p.id from public.permissions p where p.code=any(requested);
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','role.custom.created','role',role_id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('code',lower(trim(p_code)),'name',trim(p_name),'permissions',requested,'sourceRoleId',p_source_role_id,'reason',trim(p_reason)),actor.id,p_granted_via);
  return jsonb_build_object('id',role_id,'code',lower(trim(p_code)),'name',trim(p_name),'status','active','permissions',to_jsonb(requested));
end;
$$;

create or replace function public.api_update_custom_role(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_role_id text,p_name text,p_description text,p_permission_codes text[],p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.memberships%rowtype; target_role public.roles%rowtype; actor_is_owner boolean; requested text[]:=coalesce(p_permission_codes,'{}'); before_permissions text[];
begin
  select * into actor from public.memberships where id=p_actor_membership_id and context_user_id=p_actor_user_id and tenant_id=p_tenant_id and target='admin' and status='active';
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  select * into target_role from public.roles where id=p_role_id and tenant_id=p_tenant_id for update;
  if not found then raise exception 'ROLE_NOT_FOUND'; end if;
  if target_role.is_owner then raise exception 'OWNER_ROLE_PROTECTED'; end if;
  if target_role.is_system or not target_role.is_editable then raise exception 'SYSTEM_ROLE_READ_ONLY'; end if;
  if exists(select 1 from public.membership_roles mr where mr.membership_id=actor.id and mr.role_id=target_role.id and mr.revoked_at is null) then raise exception 'SELF_ROLE_MUTATION_FORBIDDEN'; end if;
  if length(trim(coalesce(p_name,''))) not between 2 and 60 or length(coalesce(p_description,''))>300 or length(trim(coalesce(p_reason,'')))<4 or cardinality(requested)>100 then raise exception 'CUSTOM_ROLE_INPUT_INVALID'; end if;
  if exists(select 1 from unnest(requested) code where not exists(select 1 from public.permissions p where p.code=code)) then raise exception 'PERMISSION_NOT_FOUND'; end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=actor.id and mr.revoked_at is null and r.is_owner) into actor_is_owner;
  if not actor_is_owner and exists(select 1 from public.permissions p where p.code=any(requested) and not (
    exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.role_id=r.id where mr.membership_id=actor.id and mr.revoked_at is null and rp.permission_id=p.id)
    and not exists(select 1 from public.membership_permission_overrides deny where deny.membership_id=actor.id and deny.permission_id=p.id and deny.effect='deny' and deny.revoked_at is null and (deny.expires_at is null or deny.expires_at>now()))
  )) then raise exception 'ROLE_GRANT_EXCEEDS_ACTOR'; end if;
  select coalesce(array_agg(p.code order by p.code),'{}') into before_permissions from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=target_role.id;
  update public.roles set name=trim(p_name),description=trim(coalesce(p_description,'')),updated_at=now() where id=target_role.id;
  delete from public.role_permissions where role_id=target_role.id;
  insert into public.role_permissions(role_id,permission_id) select target_role.id,p.id from public.permissions p where p.code=any(requested);
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','role.custom.updated','role',target_role.id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('name',target_role.name,'description',target_role.description,'permissions',before_permissions),jsonb_build_object('name',trim(p_name),'description',trim(coalesce(p_description,'')),'permissions',requested,'reason',trim(p_reason)),actor.id,p_granted_via);
  return jsonb_build_object('id',target_role.id,'status',target_role.status,'permissions',to_jsonb(requested));
end;
$$;

create or replace function public.api_set_custom_role_status(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_role_id text,p_status text,p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.memberships%rowtype; target_role public.roles%rowtype; affected integer:=0;
begin
  select * into actor from public.memberships where id=p_actor_membership_id and context_user_id=p_actor_user_id and tenant_id=p_tenant_id and target='admin' and status='active';
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  select * into target_role from public.roles where id=p_role_id and tenant_id=p_tenant_id for update;
  if not found then raise exception 'ROLE_NOT_FOUND'; end if;
  if target_role.is_owner then raise exception 'OWNER_ROLE_PROTECTED'; end if;
  if target_role.is_system or not target_role.is_editable then raise exception 'SYSTEM_ROLE_READ_ONLY'; end if;
  if p_status not in ('active','disabled') or length(trim(coalesce(p_reason,'')))<4 then raise exception 'CUSTOM_ROLE_STATUS_INVALID'; end if;
  if p_status='disabled' and exists(select 1 from public.membership_roles mr where mr.membership_id=actor.id and mr.role_id=target_role.id and mr.revoked_at is null) then raise exception 'SELF_ROLE_MUTATION_FORBIDDEN'; end if;
  if p_status='disabled' then
    update public.membership_roles set revoked_at=now() where role_id=target_role.id and revoked_at is null;
    get diagnostics affected=row_count;
  end if;
  update public.roles set status=p_status,updated_at=now() where id=target_role.id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin',case when p_status='disabled' then 'role.custom.disabled' else 'role.custom.enabled' end,'role',target_role.id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('status',target_role.status),jsonb_build_object('status',p_status,'revokedAssignments',affected,'reason',trim(p_reason)),actor.id,p_granted_via);
  return jsonb_build_object('id',target_role.id,'status',p_status,'revokedAssignments',affected);
end;
$$;

-- Active roles only may be newly assigned. Every requested scope must be
-- inside the actor's server-derived ceiling; the trigger validates it again
-- against the target membership before insertion.
create or replace function public.api_update_membership_access(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_target_membership_id text,p_role_ids text[],p_scopes jsonb,p_denied_permission_codes text[],
  p_reason text,p_request_id text,p_user_agent text,p_granted_via jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_membership public.memberships%rowtype; scope_item jsonb; target_is_owner boolean; actor_is_owner boolean; requested_role_id text; permission_id text;
begin
  if length(trim(coalesce(p_reason,'')))<4 then raise exception 'ACCESS_CHANGE_REASON_REQUIRED'; end if;
  if p_target_membership_id=p_actor_membership_id then raise exception 'SELF_ACCESS_MUTATION_FORBIDDEN'; end if;
  if jsonb_typeof(coalesce(p_scopes,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_scopes,'[]'::jsonb))<1 then raise exception 'MEMBERSHIP_SCOPE_OUTSIDE_TENANT'; end if;
  select * into target_membership from public.memberships where id=p_target_membership_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id for update;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=target_membership.id and mr.revoked_at is null and r.is_owner) into target_is_owner;
  if target_is_owner then raise exception 'OWNER_MEMBERSHIP_PROTECTED'; end if;
  if exists(select 1 from unnest(coalesce(p_role_ids,'{}')) requested where not exists(select 1 from public.roles r where r.id=requested and r.tenant_id=p_tenant_id and r.status='active')) then raise exception 'ROLE_NOT_FOUND'; end if;
  if exists(select 1 from public.roles r where r.id=any(coalesce(p_role_ids,'{}')) and r.is_owner) then raise exception 'OWNER_ROLE_PROTECTED'; end if;
  if exists(select 1 from unnest(coalesce(p_denied_permission_codes,'{}')) requested where not exists(select 1 from public.permissions p where p.code=requested)) then raise exception 'PERMISSION_NOT_FOUND'; end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=p_actor_membership_id and mr.revoked_at is null and r.is_owner) into actor_is_owner;
  if not actor_is_owner and not (public.api_actor_can_grant_scope(p_actor_membership_id,'enterprise',target_membership.enterprise_id) or public.api_actor_can_grant_scope(p_actor_membership_id,'mall',target_membership.mall_id)) then raise exception 'TARGET_MEMBERSHIP_OUTSIDE_ACTOR_SCOPE'; end if;
  if not actor_is_owner and exists(select 1 from public.roles requested_role join public.role_permissions requested_grant on requested_grant.role_id=requested_role.id where requested_role.id=any(coalesce(p_role_ids,'{}')) and (
    not exists(select 1 from public.membership_roles actor_role join public.roles ar on ar.id=actor_role.role_id and ar.status='active' join public.role_permissions actor_grant on actor_grant.role_id=ar.id where actor_role.membership_id=p_actor_membership_id and actor_role.revoked_at is null and actor_grant.permission_id=requested_grant.permission_id)
    or exists(select 1 from public.membership_permission_overrides actor_deny where actor_deny.membership_id=p_actor_membership_id and actor_deny.permission_id=requested_grant.permission_id and actor_deny.effect='deny' and actor_deny.revoked_at is null and (actor_deny.expires_at is null or actor_deny.expires_at>now()))
  )) then raise exception 'ROLE_GRANT_EXCEEDS_ACTOR'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_scopes,'[]'::jsonb)) requested_scope where not public.api_actor_can_grant_scope(p_actor_membership_id,requested_scope->>'kind',requested_scope->>'resourceId')) then raise exception 'SCOPE_GRANT_EXCEEDS_ACTOR'; end if;
  update public.membership_roles set revoked_at=now() where membership_id=target_membership.id and revoked_at is null;
  foreach requested_role_id in array coalesce(p_role_ids,'{}') loop
    insert into public.membership_roles(membership_id,role_id,granted_by_membership_id,granted_at,expires_at,revoked_at)
    values(target_membership.id,requested_role_id,p_actor_membership_id,now(),null,null)
    on conflict on constraint membership_roles_pkey do update set granted_by_membership_id=excluded.granted_by_membership_id,granted_at=now(),expires_at=null,revoked_at=null;
  end loop;
  delete from public.membership_scopes where membership_id=target_membership.id;
  for scope_item in select value from jsonb_array_elements(coalesce(p_scopes,'[]'::jsonb)) loop insert into public.membership_scopes(membership_id,scope_kind,resource_id) values(target_membership.id,scope_item->>'kind',scope_item->>'resourceId'); end loop;
  update public.membership_permission_overrides set revoked_at=now() where membership_id=target_membership.id and effect='deny' and revoked_at is null;
  for permission_id in select p.id from public.permissions p where p.code=any(coalesce(p_denied_permission_codes,'{}')) loop
    insert into public.membership_permission_overrides(membership_id,permission_id,effect,granted_by_membership_id,reason,revoked_at) values(target_membership.id,permission_id,'deny',p_actor_membership_id,trim(p_reason),null)
    on conflict on constraint membership_permission_overrides_pkey do update set effect='deny',granted_by_membership_id=p_actor_membership_id,reason=trim(p_reason),expires_at=null,revoked_at=null,created_at=now();
  end loop;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','membership.access.updated','membership',target_membership.id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('roleIds',coalesce(p_role_ids,'{}'),'scopes',coalesce(p_scopes,'[]'::jsonb),'deniedPermissions',coalesce(p_denied_permission_codes,'{}'),'reason',trim(p_reason)),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('membershipId',target_membership.id,'authzVersion',(select authz_version from public.memberships where id=target_membership.id));
end;
$$;

-- Add role status plus every currently grantable scope kind to the existing
-- command-center response without exposing global resources to tenant-only actors.
create or replace function public.api_permission_command_center(
  p_actor_membership_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,p_include_pii boolean default false
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor public.memberships%rowtype;
begin
  select * into actor from public.memberships where id=p_actor_membership_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id and target='admin' and status='active';
  if not found then return null; end if;
  return jsonb_build_object(
    'members',coalesce((select jsonb_agg(jsonb_build_object(
      'membershipId',ms.id,'memberId',ms.member_id,'displayName',u.display_name,'employeeNo',u.employee_no,
      'email',case when p_include_pii then u.email else null end,'mobileMasked',case when p_include_pii then u.mobile_masked else null end,
      'target',ms.target,'status',ms.status,'authzVersion',ms.authz_version,'isSelf',ms.id=p_actor_membership_id,
      'isOwner',exists(select 1 from public.membership_roles omr join public.roles owner_role on owner_role.id=omr.role_id where omr.membership_id=ms.id and omr.revoked_at is null and owner_role.is_owner),
      'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'name',r.name) order by r.sort_order,r.name) from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=ms.id and mr.revoked_at is null and r.status='active' and (mr.expires_at is null or mr.expires_at>now())),'[]'::jsonb),
      'scopes',coalesce((select jsonb_agg(jsonb_build_object('kind',s.scope_kind,'resourceId',s.resource_id) order by s.scope_kind,s.resource_id) from public.membership_scopes s where s.membership_id=ms.id),'[]'::jsonb),
      'deniedPermissions',coalesce((select jsonb_agg(p.code order by p.code) from public.membership_permission_overrides mpo join public.permissions p on p.id=mpo.permission_id where mpo.membership_id=ms.id and mpo.effect='deny' and mpo.revoked_at is null and (mpo.expires_at is null or mpo.expires_at>now())),'[]'::jsonb)
    ) order by u.display_name) from public.memberships ms join public.members m on m.id=ms.member_id join public.users u on u.id=m.user_id
      where ms.tenant_id=p_tenant_id and ms.enterprise_id=p_enterprise_id and (ms.mall_id is null or ms.mall_id=p_mall_id)
        and (public.api_actor_can_grant_scope(p_actor_membership_id,'enterprise',ms.enterprise_id) or public.api_actor_can_grant_scope(p_actor_membership_id,'mall',ms.mall_id) or ms.id=p_actor_membership_id)),'[]'::jsonb),
    'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'name',r.name,'description',r.description,'status',r.status,'isSystem',r.is_system,'isOwner',r.is_owner,'isEditable',r.is_editable,'permissions',coalesce((select jsonb_agg(p.code order by p.code) from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=r.id),'[]'::jsonb)) order by r.sort_order,r.name) from public.roles r where r.tenant_id=p_tenant_id),'[]'::jsonb),
    'permissions',coalesce((select jsonb_agg(jsonb_build_object('code',p.code,'name',p.name,'category',p.category,'risk',p.risk_level,'mvp',p.is_mvp) order by p.category,p.code) from public.permissions p),'[]'::jsonb),
    'scopeOptions',jsonb_build_object(
      'platform',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name)) from public.org_units o where o.kind='platform' and o.status='active' and public.api_actor_can_grant_scope(p_actor_membership_id,'platform',o.id)),'[]'::jsonb),
      'distributor',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name)) from public.org_units o where o.kind='distributor' and o.status='active' and public.api_actor_can_grant_scope(p_actor_membership_id,'distributor',o.id)),'[]'::jsonb),
      'tenant',case when public.api_actor_can_grant_scope(p_actor_membership_id,'tenant',p_tenant_id) then jsonb_build_array(jsonb_build_object('id',p_tenant_id,'name','Smart Wing 安全租户')) else '[]'::jsonb end,
      'enterprise',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name) order by e.name) from public.enterprises e where e.tenant_id=p_tenant_id and public.api_actor_can_grant_scope(p_actor_membership_id,'enterprise',e.id)),'[]'::jsonb),
      'mall',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name) order by m.name) from public.malls m where m.tenant_id=p_tenant_id and public.api_actor_can_grant_scope(p_actor_membership_id,'mall',m.id)),'[]'::jsonb),
      'supplier',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name) from public.suppliers s where s.tenant_id=p_tenant_id and public.api_actor_can_grant_scope(p_actor_membership_id,'supplier',s.id)),'[]'::jsonb),
      'brand',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.name) from public.brands b where b.tenant_id=p_tenant_id and b.status<>'disabled' and public.api_actor_can_grant_scope(p_actor_membership_id,'brand',b.id)),'[]'::jsonb),
      'store',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name) from public.stores s where s.tenant_id=p_tenant_id and s.status<>'disabled' and public.api_actor_can_grant_scope(p_actor_membership_id,'store',s.id)),'[]'::jsonb),
      'department',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.name) from public.departments d where d.tenant_id=p_tenant_id and public.api_actor_can_grant_scope(p_actor_membership_id,'department',d.id)),'[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.api_actor_can_grant_scope(text,text,text) from public,anon,authenticated;
revoke all on function public.api_custom_role_center(text,text) from public,anon,authenticated;
revoke all on function public.api_create_custom_role(text,text,text,text,text,text,text,text,text[],text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.api_update_custom_role(text,text,text,text,text,text,text,text,text[],text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.api_set_custom_role_status(text,text,text,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.api_actor_can_grant_scope(text,text,text) to service_role;
grant execute on function public.api_custom_role_center(text,text) to service_role;
grant execute on function public.api_create_custom_role(text,text,text,text,text,text,text,text,text[],text,text,text,text,jsonb) to service_role;
grant execute on function public.api_update_custom_role(text,text,text,text,text,text,text,text,text[],text,text,text,jsonb) to service_role;
grant execute on function public.api_set_custom_role_status(text,text,text,text,text,text,text,text,text,text,jsonb) to service_role;
