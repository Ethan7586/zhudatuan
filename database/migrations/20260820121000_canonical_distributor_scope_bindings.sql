-- Canonical distributor scope resource IDs are public.distributors.id. Repair
-- the earlier org-unit representation once, audit every changed binding, and
-- keep all authorization paths on the same fail-closed projection.

create or replace function public.validate_membership_scope()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare membership_row public.memberships%rowtype; is_valid boolean:=false;
begin
  select * into membership_row from public.memberships where id=new.membership_id;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if new.scope_kind='platform' then
    select exists(
      select 1 from public.org_units platform
      where platform.id=new.resource_id and platform.kind='platform' and platform.status='active'
        and exists(
          select 1 from public.membership_roles membership_role
          join public.roles role on role.id=membership_role.role_id
          where membership_role.membership_id=membership_row.id
            and membership_role.revoked_at is null
            and (membership_role.expires_at is null or membership_role.expires_at>now())
            and role.is_owner and role.status='active'
        )
    ) into is_valid;
    if not is_valid then raise exception 'PLATFORM_SCOPE_REQUIRES_OWNER'; end if;
  elsif new.scope_kind='distributor' then
    select exists(
      select 1 from public.distributors distributor
      join public.distributor_tenants relation on relation.distributor_id=distributor.id
      where distributor.id=new.resource_id and distributor.status='active'
        and relation.tenant_id=membership_row.tenant_id and relation.status='active'
        and relation.starts_at<=now() and (relation.ends_at is null or relation.ends_at>now())
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

-- Moving a role, scope or override between memberships invalidates both the
-- former and new authorization snapshots. The historical coalesce only
-- invalidated one side of an UPDATE.
create or replace function public.bump_membership_authz_version()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_old_membership_id text; v_new_membership_id text;
begin
  if tg_op<>'INSERT' then v_old_membership_id:=old.membership_id; end if;
  if tg_op<>'DELETE' then v_new_membership_id:=new.membership_id; end if;
  update public.memberships membership
  set authz_version=membership.authz_version+1,updated_at=now()
  where membership.id in (v_old_membership_id,v_new_membership_id);
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.bump_membership_authz_version()
from public,anon,authenticated;

-- Repair is deliberately rerunnable so its migration-time failure-closed
-- behavior can be contract-tested. A stale single distributor binding is kept
-- as a tombstone: deleting it while retaining lower scopes would turn those
-- lower scopes into independent authority. Ambiguous non-platform actors are
-- suspended and lose every scope; an active platform owner keeps only its
-- platform-authorized scopes.
create or replace function public.repair_canonical_distributor_scopes()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  audited_count integer:=0;
  duplicate_count integer:=0;
  converted_count integer:=0;
  conflict_count integer:=0;
  suspended_count integer:=0;
  removed_scope_count integer:=0;
begin
  with binding as (
    select scope.membership_id,scope.resource_id,
      coalesce(canonical.id,legacy.id) canonical_id,
      membership.tenant_id,membership.enterprise_id,membership.mall_id,
      exists(
        select 1 from public.distributors distributor
        join public.distributor_tenants relation on relation.distributor_id=distributor.id
        where distributor.id=coalesce(canonical.id,legacy.id)
          and distributor.status='active' and relation.tenant_id=membership.tenant_id
          and relation.status='active' and relation.starts_at<=now()
          and (relation.ends_at is null or relation.ends_at>now())
      ) binding_valid
    from public.membership_scopes scope
    join public.memberships membership on membership.id=scope.membership_id
    left join public.distributors canonical on canonical.id=scope.resource_id
    left join public.distributors legacy
      on legacy.org_unit_id=scope.resource_id and canonical.id is null
    where scope.scope_kind='distributor'
  )
  insert into public.audit_logs (
    id,tenant_id,enterprise_id,mall_id,actor_type,action,resource_type,resource_id,
    request_id,before_json,after_json,membership_id,granted_via,created_at
  )
  select gen_random_uuid()::text,binding.tenant_id,binding.enterprise_id,binding.mall_id,
    'system','membership.distributor_scope.canonicalized','membership',binding.membership_id,
    'migration-20260820121000',
    jsonb_build_object('kind','distributor','resourceId',binding.resource_id),
    case when binding.canonical_id is not null and binding.binding_valid then
      jsonb_build_object('kind','distributor','resourceId',binding.canonical_id,'outcome','converted')
    else jsonb_build_object('kind','distributor','resourceId',binding.resource_id,
      'outcome','retained_fail_closed') end,
    binding.membership_id,jsonb_build_object('source','repair_migration'),now()
  from binding
  where (
    binding.canonical_id is null or binding.resource_id<>binding.canonical_id
    or not binding.binding_valid
  ) and (
    binding.binding_valid or not exists(
      select 1 from public.audit_logs existing_audit
      where existing_audit.action='membership.distributor_scope.canonicalized'
        and existing_audit.request_id='migration-20260820121000'
        and existing_audit.membership_id=binding.membership_id
        and existing_audit.before_json->>'resourceId'=binding.resource_id
        and existing_audit.after_json->>'outcome'='retained_fail_closed'
    )
  );
  get diagnostics audited_count=row_count;

  delete from public.membership_scopes legacy
  using public.distributors distributor
  where legacy.scope_kind='distributor' and legacy.resource_id=distributor.org_unit_id
    and exists(
      select 1 from public.membership_scopes canonical
      where canonical.membership_id=legacy.membership_id
        and canonical.scope_kind='distributor' and canonical.resource_id=distributor.id
    );
  get diagnostics duplicate_count=row_count;

  update public.membership_scopes scope
  set resource_id=distributor.id
  from public.distributors distributor,public.memberships membership
  where scope.scope_kind='distributor' and scope.resource_id=distributor.org_unit_id
    and membership.id=scope.membership_id and distributor.status='active'
    and exists(
      select 1 from public.distributor_tenants relation
      where relation.distributor_id=distributor.id
        and relation.tenant_id=membership.tenant_id and relation.status='active'
        and relation.starts_at<=now()
        and (relation.ends_at is null or relation.ends_at>now())
    );
  get diagnostics converted_count=row_count;

  with conflict as (
    select scope.membership_id
    from public.membership_scopes scope
    where scope.scope_kind='distributor'
    group by scope.membership_id having count(distinct scope.resource_id)>1
  )
  insert into public.audit_logs (
    id,tenant_id,enterprise_id,mall_id,actor_type,action,resource_type,resource_id,
    request_id,before_json,after_json,membership_id,granted_via,created_at
  )
  select gen_random_uuid()::text,membership.tenant_id,membership.enterprise_id,membership.mall_id,
    'system','membership.distributor_scope.ambiguous_quarantined','membership',membership.id,
    'migration-20260820121000',jsonb_build_object('bindings',(
      select jsonb_agg(scope.resource_id order by scope.resource_id)
      from public.membership_scopes scope
      where scope.membership_id=membership.id and scope.scope_kind='distributor'
    )),jsonb_build_object('outcome',case when exists(
      select 1 from public.membership_scopes platform_scope
      join public.org_units platform on platform.id=platform_scope.resource_id
      join public.membership_roles membership_role
        on membership_role.membership_id=membership.id
      join public.roles role on role.id=membership_role.role_id
      where platform_scope.membership_id=membership.id
        and platform_scope.scope_kind='platform' and platform.kind='platform'
        and platform.status='active' and role.is_owner and role.status='active'
        and membership_role.revoked_at is null
        and (membership_role.expires_at is null or membership_role.expires_at>now())
    ) then 'platform_anchor_retained' else 'membership_suspended_scopes_removed' end),
    membership.id,jsonb_build_object('source','repair_migration'),now()
  from conflict join public.memberships membership on membership.id=conflict.membership_id;
  get diagnostics conflict_count=row_count;

  with conflict as (
    select scope.membership_id
    from public.membership_scopes scope
    where scope.scope_kind='distributor'
    group by scope.membership_id having count(distinct scope.resource_id)>1
  )
  update public.memberships membership set status='suspended'
  from conflict
  where membership.id=conflict.membership_id
    and membership.status not in ('suspended','offboarded','expired')
    and not exists(
      select 1 from public.membership_scopes platform_scope
      join public.org_units platform on platform.id=platform_scope.resource_id
      join public.membership_roles membership_role
        on membership_role.membership_id=membership.id
      join public.roles role on role.id=membership_role.role_id
      where platform_scope.membership_id=membership.id
        and platform_scope.scope_kind='platform' and platform.kind='platform'
        and platform.status='active' and role.is_owner and role.status='active'
        and membership_role.revoked_at is null
        and (membership_role.expires_at is null or membership_role.expires_at>now())
    );
  get diagnostics suspended_count=row_count;

  with conflict as (
    select scope.membership_id
    from public.membership_scopes scope
    where scope.scope_kind='distributor'
    group by scope.membership_id having count(distinct scope.resource_id)>1
  )
  delete from public.membership_scopes scope
  using conflict
  where scope.membership_id=conflict.membership_id
    and (
      scope.scope_kind='distributor'
      or not exists(
        select 1 from public.membership_scopes platform_scope
        join public.org_units platform on platform.id=platform_scope.resource_id
        join public.membership_roles membership_role
          on membership_role.membership_id=scope.membership_id
        join public.roles role on role.id=membership_role.role_id
        where platform_scope.membership_id=scope.membership_id
          and platform_scope.scope_kind='platform' and platform.kind='platform'
          and platform.status='active' and role.is_owner and role.status='active'
          and membership_role.revoked_at is null
          and (membership_role.expires_at is null or membership_role.expires_at>now())
      )
    );
  get diagnostics removed_scope_count=row_count;

  return jsonb_build_object(
    'audited',audited_count,'duplicatesRemoved',duplicate_count,
    'converted',converted_count,'conflicts',conflict_count,
    'membershipsSuspended',suspended_count,'scopesRemoved',removed_scope_count
  );
end;
$$;

revoke all on function public.repair_canonical_distributor_scopes()
from public,anon,authenticated,service_role;

select public.repair_canonical_distributor_scopes();

create unique index membership_scopes_one_distributor
on public.membership_scopes (membership_id) where scope_kind='distributor';

-- A distributor membership's lower scopes never become independent authority.
-- An active platform anchor supersedes it; otherwise a stale distributor
-- binding invalidates the complete membership until the relation is repaired.
create or replace function public.api_membership_distributor_anchor_valid(
  p_membership_id text
) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.memberships membership
    join public.members member on member.id=membership.member_id
      and member.user_id=membership.context_user_id and member.status='active'
    join public.users actor on actor.id=membership.context_user_id
      and actor.status='active'
    where membership.id=p_membership_id and membership.status='active'
      and (membership.expires_at is null or membership.expires_at>now())
      and case
        when exists(
          select 1 from public.membership_scopes scope
          where scope.membership_id=membership.id and scope.scope_kind='platform'
        ) then exists(
          select 1 from public.membership_scopes scope
          join public.org_units platform on platform.id=scope.resource_id
          join public.membership_roles membership_role
            on membership_role.membership_id=membership.id
          join public.roles role on role.id=membership_role.role_id
          where scope.membership_id=membership.id and scope.scope_kind='platform'
            and platform.kind='platform' and platform.status='active'
            and role.is_owner and role.status='active'
            and membership_role.revoked_at is null
            and (membership_role.expires_at is null or membership_role.expires_at>now())
        )
        when exists(
          select 1 from public.membership_scopes scope
          where scope.membership_id=membership.id and scope.scope_kind='distributor'
        ) then
          1=(select count(distinct scope.resource_id)
             from public.membership_scopes scope
             where scope.membership_id=membership.id and scope.scope_kind='distributor')
          and exists(
            select 1 from public.membership_scopes scope
            join public.distributors distributor on distributor.id=scope.resource_id
            join public.distributor_tenants relation
              on relation.distributor_id=distributor.id
            where scope.membership_id=membership.id and scope.scope_kind='distributor'
              and distributor.status='active' and relation.tenant_id=membership.tenant_id
              and relation.status='active' and relation.starts_at<=now()
              and (relation.ends_at is null or relation.ends_at>now())
          )
        else true
      end
  );
$$;
revoke all on function public.api_membership_distributor_anchor_valid(text)
from public,anon,authenticated;

create or replace function public.api_membership_actor_matches(
  p_membership_id text,p_actor_user_id text,p_target text
) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.api_membership_distributor_anchor_valid(p_membership_id) and exists(
    select 1 from public.memberships membership
    join public.members member on member.id=membership.member_id
    join public.users actor on actor.id=membership.context_user_id
    where membership.id=p_membership_id and membership.context_user_id=p_actor_user_id
      and membership.target=p_target and membership.status='active'
      and member.status='active' and actor.status='active'
      and (membership.expires_at is null or membership.expires_at>now())
  );
$$;
revoke all on function public.api_membership_actor_matches(text,text,text)
from public,anon,authenticated;

create or replace function public.api_membership_scope_allows(
  p_membership_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text
) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.api_membership_distributor_anchor_valid(p_membership_id) and exists (
    select 1 from public.memberships membership
    join public.members member on member.id=membership.member_id
    where membership.id=p_membership_id and membership.status='active'
      and member.status='active'
      and (membership.expires_at is null or membership.expires_at>now())
      and exists(
        select 1 from public.membership_scopes scope
        where scope.membership_id=membership.id and (
          (scope.scope_kind='platform' and exists(select 1 from public.org_units platform
            where platform.id=scope.resource_id and platform.kind='platform' and platform.status='active'))
          or (scope.scope_kind='tenant' and scope.resource_id=p_tenant_id)
          or (scope.scope_kind='enterprise' and scope.resource_id=p_enterprise_id)
          or (scope.scope_kind='mall' and scope.resource_id=p_mall_id)
          or (scope.scope_kind='distributor' and exists(
            select 1 from public.distributors distributor
            join public.distributor_tenants relation on relation.distributor_id=distributor.id
            where distributor.id=scope.resource_id and distributor.status='active'
              and relation.tenant_id=p_tenant_id and relation.status='active'
              and relation.starts_at<=now() and (relation.ends_at is null or relation.ends_at>now())
          ))
        )
      )
  );
$$;
revoke all on function public.api_membership_scope_allows(text,text,text,text)
from public,anon,authenticated;

create or replace function public.api_voucher_membership_scope_allows(
  p_membership_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text
) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.memberships membership
    where membership.id=p_membership_id and membership.target='admin'
      and membership.tenant_id=p_tenant_id
  ) and public.api_membership_scope_allows(
    p_membership_id,p_tenant_id,p_enterprise_id,p_mall_id
  );
$$;
revoke all on function public.api_voucher_membership_scope_allows(text,text,text,text)
from public,anon,authenticated;
grant execute on function public.api_voucher_membership_scope_allows(text,text,text,text)
to service_role;

create or replace function public.api_mall_application_actor_access(
  p_membership_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_require_enterprise boolean default false
) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.memberships membership
    where membership.id=p_membership_id and membership.target='admin'
      and membership.tenant_id=p_tenant_id and membership.enterprise_id=p_enterprise_id
  ) and public.api_membership_scope_allows(
    p_membership_id,p_tenant_id,p_enterprise_id,p_mall_id
  ) and (
    not p_require_enterprise or exists(
      select 1 from public.membership_scopes scope
      where scope.membership_id=p_membership_id and scope.scope_kind in (
        'platform','distributor','tenant','enterprise'
      )
    )
  );
$$;
revoke all on function public.api_mall_application_actor_access(text,text,text,text,boolean)
from public,anon,authenticated;

-- Hierarchy paths also carry business scope IDs. A missing, disabled or
-- detached distributor invalidates the complete path instead of omitting it.
create or replace function public.api_org_unit_scope_path(p_source_type text,p_source_id text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with nodes as (
    select path.depth,ancestor.kind,ancestor.id,ancestor.source_id,
      case
        when ancestor.kind='platform' then ancestor.status='active'
        when ancestor.kind='distributor' then distributor.id is not null
        else ancestor.source_id is not null
      end as valid,
      distributor.id as distributor_id
    from public.org_units resource
    join public.org_unit_closure path on path.descendant_id=resource.id
    join public.org_units ancestor on ancestor.id=path.ancestor_id
    left join public.distributors distributor on distributor.org_unit_id=ancestor.id
      and distributor.status='active' and (
        (resource.tenant_id is not null and exists(
          select 1 from public.distributor_tenants relation
          where relation.distributor_id=distributor.id and relation.tenant_id=resource.tenant_id
            and relation.status='active' and relation.starts_at<=now()
            and (relation.ends_at is null or relation.ends_at>now())
        )) or (resource.kind='distributor' and exists(
          select 1 from public.distributor_tenants relation
          where relation.distributor_id=distributor.id and relation.status='active'
            and relation.starts_at<=now() and (relation.ends_at is null or relation.ends_at>now())
        ))
      )
    where resource.source_type=p_source_type and resource.source_id=p_source_id
  )
  select case when coalesce(bool_or(not valid),false) then '[]'::jsonb
    else coalesce(jsonb_agg(jsonb_build_object('kind',kind,'resourceId',
      case when kind='platform' then id when kind='distributor' then distributor_id else source_id end
    ) order by depth desc),'[]'::jsonb) end from nodes;
$$;

create or replace function public.api_org_unit_scope_path_by_id(p_org_unit_id text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with nodes as (
    select path.depth,ancestor.kind,ancestor.id,ancestor.source_id,
      case
        when ancestor.kind='platform' then ancestor.status='active'
        when ancestor.kind='distributor' then distributor.id is not null
        else ancestor.source_id is not null
      end as valid,
      distributor.id as distributor_id
    from public.org_units resource
    join public.org_unit_closure path on path.descendant_id=resource.id
    join public.org_units ancestor on ancestor.id=path.ancestor_id
    left join public.distributors distributor on distributor.org_unit_id=ancestor.id
      and distributor.status='active' and (
        (resource.tenant_id is not null and exists(
          select 1 from public.distributor_tenants relation
          where relation.distributor_id=distributor.id and relation.tenant_id=resource.tenant_id
            and relation.status='active' and relation.starts_at<=now()
            and (relation.ends_at is null or relation.ends_at>now())
        )) or (resource.kind='distributor' and exists(
          select 1 from public.distributor_tenants relation
          where relation.distributor_id=distributor.id and relation.status='active'
            and relation.starts_at<=now() and (relation.ends_at is null or relation.ends_at>now())
        ))
      )
    where resource.id=p_org_unit_id
  )
  select case when coalesce(bool_or(not valid),false) then '[]'::jsonb
    else coalesce(jsonb_agg(jsonb_build_object('kind',kind,'resourceId',
      case when kind='platform' then id when kind='distributor' then distributor_id else source_id end
    ) order by depth desc),'[]'::jsonb) end from nodes;
$$;

revoke all on function public.api_org_unit_scope_path(text,text) from public,anon,authenticated;
revoke all on function public.api_org_unit_scope_path_by_id(text) from public,anon,authenticated;
grant execute on function public.api_org_unit_scope_path(text,text) to service_role;
grant execute on function public.api_org_unit_scope_path_by_id(text) to service_role;

create or replace function public.api_actor_can_grant_scope(
  p_actor_membership_id text,p_scope_kind text,p_resource_id text
) returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor public.memberships%rowtype; distributor_scope_count integer;
begin
  select membership.* into actor from public.memberships membership
  join public.members member on member.id=membership.member_id
  where membership.id=p_actor_membership_id and membership.target='admin'
    and membership.status='active' and member.status='active'
    and (membership.expires_at is null or membership.expires_at>now());
  if not found or p_scope_kind not in ('platform','tenant','distributor','enterprise','mall','supplier','brand','store','department','self') then return false; end if;
  if not public.api_membership_distributor_anchor_valid(actor.id) then return false; end if;
  if exists(select 1 from public.membership_scopes scope join public.org_units platform on platform.id=scope.resource_id
    where scope.membership_id=actor.id and scope.scope_kind='platform' and platform.kind='platform' and platform.status='active') then return true; end if;
  if p_scope_kind='platform' then return false; end if;
  select count(distinct scope.resource_id) into distributor_scope_count
  from public.membership_scopes scope where scope.membership_id=actor.id and scope.scope_kind='distributor';
  if p_scope_kind='distributor' then
    return distributor_scope_count=1 and exists(
      select 1 from public.membership_scopes scope
      join public.distributors distributor on distributor.id=scope.resource_id and distributor.status='active'
      join public.distributor_tenants relation on relation.distributor_id=distributor.id
      where scope.membership_id=actor.id and scope.scope_kind='distributor'
        and scope.resource_id=p_resource_id and relation.tenant_id=actor.tenant_id
        and relation.status='active' and relation.starts_at<=now()
        and (relation.ends_at is null or relation.ends_at>now())
    );
  end if;
  if exists(select 1 from public.membership_scopes scope
    where scope.membership_id=actor.id and scope.scope_kind=p_scope_kind and scope.resource_id=p_resource_id) then return true; end if;
  if distributor_scope_count=1 and exists(
    select 1 from public.membership_scopes scope
    join public.distributors distributor on distributor.id=scope.resource_id and distributor.status='active'
    join public.distributor_tenants relation on relation.distributor_id=distributor.id
    where scope.membership_id=actor.id and scope.scope_kind='distributor'
      and relation.tenant_id=actor.tenant_id and relation.status='active'
      and relation.starts_at<=now() and (relation.ends_at is null or relation.ends_at>now())
  ) then
    return case p_scope_kind
      when 'tenant' then p_resource_id=actor.tenant_id
      when 'enterprise' then exists(select 1 from public.enterprises e where e.id=p_resource_id and e.tenant_id=actor.tenant_id and e.status='active')
      when 'mall' then exists(select 1 from public.malls m where m.id=p_resource_id and m.tenant_id=actor.tenant_id and m.status='active')
      when 'supplier' then exists(select 1 from public.suppliers s where s.id=p_resource_id and s.tenant_id=actor.tenant_id and s.status<>'disabled')
      when 'brand' then exists(select 1 from public.brands b where b.id=p_resource_id and b.tenant_id=actor.tenant_id and b.status<>'disabled')
      when 'store' then exists(select 1 from public.stores s where s.id=p_resource_id and s.tenant_id=actor.tenant_id and s.status<>'disabled')
      when 'department' then exists(select 1 from public.departments d where d.id=p_resource_id and d.tenant_id=actor.tenant_id and d.enterprise_id=actor.enterprise_id)
      when 'self' then exists(select 1 from public.users u where u.id=p_resource_id and u.tenant_id=actor.tenant_id)
      else false end;
  end if;
  if exists(select 1 from public.membership_scopes scope where scope.membership_id=actor.id and scope.scope_kind='tenant' and scope.resource_id=actor.tenant_id) then
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
  if p_scope_kind='mall' and exists(select 1 from public.malls mall join public.membership_scopes scope on scope.membership_id=actor.id and scope.scope_kind='enterprise' and scope.resource_id=mall.enterprise_id where mall.id=p_resource_id) then return true; end if;
  if p_scope_kind='department' and exists(select 1 from public.departments department join public.membership_scopes scope on scope.membership_id=actor.id and scope.scope_kind='enterprise' and scope.resource_id=department.enterprise_id where department.id=p_resource_id) then return true; end if;
  if p_scope_kind='brand' and exists(select 1 from public.supplier_brand_bindings binding join public.membership_scopes scope on scope.membership_id=actor.id and scope.scope_kind='supplier' and scope.resource_id=binding.supplier_id where binding.brand_id=p_resource_id and binding.status='active') then return true; end if;
  if p_scope_kind='store' and exists(select 1 from public.brand_store_bindings binding join public.membership_scopes scope on scope.membership_id=actor.id and scope.scope_kind='brand' and scope.resource_id=binding.brand_id where binding.store_id=p_resource_id and binding.status='active') then return true; end if;
  return false;
end;
$$;

revoke all on function public.api_actor_can_grant_scope(text,text,text)
from public,anon,authenticated;
grant execute on function public.api_actor_can_grant_scope(text,text,text) to service_role;

-- The permission center must emit the same canonical IDs accepted by the
-- validator. Only distributors actively attached to the edited tenant appear.
create or replace function public.api_permission_command_center(
  p_actor_membership_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,
  p_include_pii boolean default false
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor public.memberships%rowtype;
begin
  select membership.* into actor from public.memberships membership
  join public.members member on member.id=membership.member_id
  where membership.id=p_actor_membership_id and membership.tenant_id=p_tenant_id
    and membership.enterprise_id=p_enterprise_id and membership.target='admin'
    and membership.status='active' and member.status='active'
    and (membership.expires_at is null or membership.expires_at>now());
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
      'distributor',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.name) from public.distributors d join public.distributor_tenants relation on relation.distributor_id=d.id where d.status='active' and relation.tenant_id=p_tenant_id and relation.status='active' and relation.starts_at<=now() and (relation.ends_at is null or relation.ends_at>now()) and public.api_actor_can_grant_scope(p_actor_membership_id,'distributor',d.id)),'[]'::jsonb),
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

revoke all on function public.api_permission_command_center(text,text,text,text,boolean)
from public,anon,authenticated;
grant execute on function public.api_permission_command_center(text,text,text,text,boolean)
to service_role;

create or replace function public.bump_distributor_relation_authz_versions()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare
  v_old_distributor_id text;
  v_old_tenant_id text;
  v_new_distributor_id text;
  v_new_tenant_id text;
begin
  if tg_op <> 'INSERT' then
    v_old_distributor_id:=old.distributor_id;
    v_old_tenant_id:=old.tenant_id;
  end if;
  if tg_op <> 'DELETE' then
    v_new_distributor_id:=new.distributor_id;
    v_new_tenant_id:=new.tenant_id;
  end if;
  update public.memberships membership
  set authz_version=membership.authz_version+1,updated_at=now()
  where exists(
    select 1 from public.membership_scopes scope
    where scope.membership_id=membership.id and scope.scope_kind='distributor'
      and (
        (membership.tenant_id=v_old_tenant_id and scope.resource_id=v_old_distributor_id)
        or (membership.tenant_id=v_new_tenant_id and scope.resource_id=v_new_distributor_id)
      )
  );
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists distributor_tenants_bump_authz on public.distributor_tenants;
create trigger distributor_tenants_bump_authz
after insert or update or delete on public.distributor_tenants
for each row execute function public.bump_distributor_relation_authz_versions();

create or replace function public.bump_distributor_status_authz_versions()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.status is distinct from old.status then
    update public.memberships membership
    set authz_version=membership.authz_version+1,updated_at=now()
    where exists(select 1 from public.membership_scopes scope
      where scope.membership_id=membership.id and scope.scope_kind='distributor'
        and scope.resource_id=new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists distributors_bump_authz on public.distributors;
create trigger distributors_bump_authz after update of status on public.distributors
for each row execute function public.bump_distributor_status_authz_versions();

revoke all on function public.bump_distributor_relation_authz_versions()
from public,anon,authenticated;
revoke all on function public.bump_distributor_status_authz_versions()
from public,anon,authenticated;

create or replace function public.api_resolve_membership_context(
  p_member_id text,p_membership_id text,p_target text
) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with resolved as (
    select membership.*,actor.employee_no,mall.code as mall_code
    from public.memberships membership
    join public.members member on member.id=membership.member_id
    join public.users actor on actor.id=membership.context_user_id
    join public.malls mall on mall.id=membership.mall_id
    where membership.id=p_membership_id and membership.member_id=p_member_id
      and membership.target=p_target and membership.status='active'
      and member.status='active' and actor.status='active'
      and (membership.expires_at is null or membership.expires_at>now())
      and public.api_membership_distributor_anchor_valid(membership.id)
  ), granted as (
    select distinct permission.code from resolved
    join public.membership_roles membership_role on membership_role.membership_id=resolved.id
    join public.roles role on role.id=membership_role.role_id and role.status='active'
    join public.role_permissions role_permission on role_permission.role_id=role.id
    join public.permissions permission on permission.id=role_permission.permission_id
    where membership_role.revoked_at is null
      and (membership_role.expires_at is null or membership_role.expires_at>now())
    union
    select permission.code from resolved
    join public.membership_permission_overrides permission_override on permission_override.membership_id=resolved.id
    join public.permissions permission on permission.id=permission_override.permission_id
    where permission_override.effect='allow' and permission_override.revoked_at is null
      and (permission_override.expires_at is null or permission_override.expires_at>now())
  ), denied as (
    select permission.code from resolved
    join public.membership_permission_overrides permission_override on permission_override.membership_id=resolved.id
    join public.permissions permission on permission.id=permission_override.permission_id
    where permission_override.effect='deny' and permission_override.revoked_at is null
      and (permission_override.expires_at is null or permission_override.expires_at>now())
  )
  select jsonb_build_object(
    'id',resolved.id,'memberId',resolved.member_id,'target',resolved.target,'status',resolved.status,
    'roleIds',coalesce((select jsonb_agg(role.id order by role.id) from public.membership_roles membership_role join public.roles role on role.id=membership_role.role_id and role.status='active' where membership_role.membership_id=resolved.id and membership_role.revoked_at is null and (membership_role.expires_at is null or membership_role.expires_at>now())),'[]'::jsonb),
    'permissions',coalesce((select jsonb_agg(granted.code order by granted.code) from granted where not exists(select 1 from denied where denied.code=granted.code)),'[]'::jsonb),
    'deniedPermissions',coalesce((select jsonb_agg(denied.code order by denied.code) from denied),'[]'::jsonb),
    'context',jsonb_strip_nulls(jsonb_build_object('tenantId',resolved.tenant_id,'enterpriseId',resolved.enterprise_id,'mallId',resolved.mall_id,'supplierId',resolved.supplier_id,'userId',resolved.context_user_id)),
    'scopeBindings',coalesce((select jsonb_agg(jsonb_build_object('kind',scope.scope_kind,'resourceId',scope.resource_id) order by scope.scope_kind,scope.resource_id)
      from public.membership_scopes scope where scope.membership_id=resolved.id and (
        (scope.scope_kind='platform' and exists(select 1 from public.org_units platform where platform.id=scope.resource_id and platform.kind='platform' and platform.status='active'))
        or (scope.scope_kind='distributor' and 1=(select count(distinct distributor_scope.resource_id) from public.membership_scopes distributor_scope where distributor_scope.membership_id=resolved.id and distributor_scope.scope_kind='distributor') and exists(select 1 from public.distributors distributor join public.distributor_tenants relation on relation.distributor_id=distributor.id where distributor.id=scope.resource_id and distributor.status='active' and relation.tenant_id=resolved.tenant_id and relation.status='active' and relation.starts_at<=now() and (relation.ends_at is null or relation.ends_at>now())))
        or scope.scope_kind not in ('platform','distributor')
      )),'[]'::jsonb),
    'expiresAt',resolved.expires_at,'authzVersion',resolved.authz_version,
    'actor',jsonb_build_object('tenantId',resolved.tenant_id,'enterpriseId',resolved.enterprise_id,'mallId',resolved.mall_id,'mallCode',resolved.mall_code,'userId',resolved.context_user_id,'employeeNo',resolved.employee_no)
  ) from resolved;
$$;

revoke all on function public.api_resolve_membership_context(text,text,text)
from public,anon,authenticated;
grant execute on function public.api_resolve_membership_context(text,text,text) to service_role;

create or replace function public.api_distributor_actor_has_permission(
  p_actor_membership_id text,p_permission_code text
) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  with actor as (
    select membership.id,membership.tenant_id
    from public.memberships membership join public.members member on member.id=membership.member_id
    where membership.id=p_actor_membership_id and membership.target='admin'
      and membership.status='active' and member.status='active'
      and (membership.expires_at is null or membership.expires_at>now())
  ), eligible as (
    select actor.id from actor where exists(
      select 1 from public.membership_scopes scope join public.org_units platform on platform.id=scope.resource_id
      where scope.membership_id=actor.id and scope.scope_kind='platform'
        and platform.kind='platform' and platform.status='active'
    ) or (
      1=(select count(distinct scope.resource_id) from public.membership_scopes scope where scope.membership_id=actor.id and scope.scope_kind='distributor')
      and exists(select 1 from public.membership_scopes scope
        join public.distributors distributor on distributor.id=scope.resource_id and distributor.status='active'
        join public.distributor_tenants relation on relation.distributor_id=distributor.id
        where scope.membership_id=actor.id and scope.scope_kind='distributor'
          and relation.tenant_id=actor.tenant_id and relation.status='active'
          and relation.starts_at<=now() and (relation.ends_at is null or relation.ends_at>now()))
    )
  ), granted as (
    select permission.code from eligible
    join public.membership_roles membership_role on membership_role.membership_id=eligible.id
    join public.roles role on role.id=membership_role.role_id and role.status='active'
    join public.role_permissions role_permission on role_permission.role_id=role.id
    join public.permissions permission on permission.id=role_permission.permission_id
    where membership_role.revoked_at is null and (membership_role.expires_at is null or membership_role.expires_at>now())
    union select permission.code from eligible
    join public.membership_permission_overrides permission_override on permission_override.membership_id=eligible.id
    join public.permissions permission on permission.id=permission_override.permission_id
    where permission_override.effect='allow' and permission_override.revoked_at is null
      and (permission_override.expires_at is null or permission_override.expires_at>now())
  ), denied as (
    select permission.code from eligible
    join public.membership_permission_overrides permission_override on permission_override.membership_id=eligible.id
    join public.permissions permission on permission.id=permission_override.permission_id
    where permission_override.effect='deny' and permission_override.revoked_at is null
      and (permission_override.expires_at is null or permission_override.expires_at>now())
  ) select exists(select 1 from granted where code=p_permission_code)
      and not exists(select 1 from denied where code=p_permission_code);
$$;

revoke all on function public.api_distributor_actor_has_permission(text,text)
from public,anon,authenticated;

create or replace function public.api_distributor_center(
  p_actor_membership_id text,p_actor_user_id text,p_distributor_id text,
  p_tenant_id text default null
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_month_start timestamptz:=date_trunc('month',timezone('Asia/Shanghai',now())) at time zone 'Asia/Shanghai';
  v_is_platform boolean; v_has_scope boolean; v_tenants jsonb; v_overview jsonb;
begin
  v_is_platform:=public.api_distributor_actor_is_platform(p_actor_membership_id,p_actor_user_id);
  select exists(
    select 1 from public.memberships membership
    join public.members member on member.id=membership.member_id
    join public.membership_scopes scope on scope.membership_id=membership.id
    join public.distributors distributor on distributor.id=scope.resource_id and distributor.status='active'
    join public.distributor_tenants relation on relation.distributor_id=distributor.id
    where membership.id=p_actor_membership_id and membership.context_user_id=p_actor_user_id
      and membership.target='admin' and membership.status='active' and member.status='active'
      and (membership.expires_at is null or membership.expires_at>now())
      and scope.scope_kind='distributor' and scope.resource_id=p_distributor_id
      and 1=(select count(distinct another.resource_id) from public.membership_scopes another where another.membership_id=membership.id and another.scope_kind='distributor')
      and relation.tenant_id=membership.tenant_id and relation.status='active'
      and relation.starts_at<=now() and (relation.ends_at is null or relation.ends_at>now())
  ) into v_has_scope;
  if (not v_is_platform and not v_has_scope)
     or not public.api_distributor_actor_has_permission(p_actor_membership_id,'distributor.read')
  then raise exception 'DISTRIBUTOR_SCOPE_FORBIDDEN'; end if;
  if not exists(select 1 from public.distributors where id=p_distributor_id and status<>'terminated')
  then raise exception 'DISTRIBUTOR_NOT_FOUND'; end if;
  if p_tenant_id is not null and not exists(select 1 from public.distributor_tenants
    where distributor_id=p_distributor_id and tenant_id=p_tenant_id and status='active'
      and starts_at<=now() and (ends_at is null or ends_at>now()))
  then raise exception 'DISTRIBUTOR_TENANT_NOT_FOUND'; end if;
  with tenant_metrics as (
    select tenant.id,tenant.name,tenant.status,relation.starts_at,
      mall_metrics.mall_count,order_metrics.order_count,order_metrics.gmv_cents
    from public.distributor_tenants relation join public.tenants tenant on tenant.id=relation.tenant_id
    left join lateral(select count(*)::integer mall_count from public.malls mall where mall.tenant_id=tenant.id and mall.status='active') mall_metrics on true
    left join lateral(select count(*)::integer order_count,greatest(0,coalesce(sum(paid_order.paid_cents-paid_order.refunded_cents),0))::bigint gmv_cents from (
      select orders.id,orders.paid_cents,coalesce((select sum(refund.amount_cents) from public.refunds refund where refund.order_id=orders.id and refund.status='succeeded'),0)::bigint refunded_cents
      from public.orders orders where orders.tenant_id=tenant.id and orders.paid_at>=v_month_start
    ) paid_order) order_metrics on true
    where relation.distributor_id=p_distributor_id and relation.status='active'
      and relation.starts_at<=now() and (relation.ends_at is null or relation.ends_at>now())
      and (p_tenant_id is null or tenant.id=p_tenant_id)
  ) select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'name',name,'status',status,'startsAt',starts_at,'activeMallCount',mall_count,
    'currentMonthOrderCount',order_count,'currentMonthGmvCents',gmv_cents,
    'configuration',jsonb_build_object('completedSteps',case when mall_count>0 then 1 else 0 end,'totalSteps',4,
      'mall',jsonb_build_object('status',case when mall_count>0 then 'ready' else 'notProvisioned' end),
      'branding',jsonb_build_object('status','notProvisioned'),'domain',jsonb_build_object('status','notProvisioned'),
      'payment',jsonb_build_object('status','notProvisioned'))
  ) order by starts_at desc),'[]'::jsonb) into v_tenants from tenant_metrics;
  select jsonb_build_object('tenantCount',count(*),
    'activeMallCount',coalesce(sum((item->>'activeMallCount')::integer),0),
    'currentMonthOrderCount',coalesce(sum((item->>'currentMonthOrderCount')::integer),0),
    'currentMonthGmvCents',coalesce(sum((item->>'currentMonthGmvCents')::bigint),0),
    'pendingCommission',jsonb_build_object('status','notProvisioned'))
  into v_overview from jsonb_array_elements(v_tenants) item;
  return jsonb_build_object('distributorId',p_distributor_id,'overview',v_overview,'tenants',v_tenants,
    'metricDefinition',jsonb_build_object('timezone','Asia/Shanghai','orderCount','本月已付款订单数','gmv','本月已付款订单实付金额减去其已成功退款金额'));
end;
$$;

revoke all on function public.api_distributor_center(text,text,text,text)
from public,anon,authenticated;
grant execute on function public.api_distributor_center(text,text,text,text) to service_role;
