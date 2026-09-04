-- The protected platform Owner must carry a real platform hierarchy binding.
-- A platform binding is never valid for an ordinary membership.

create or replace function public.validate_membership_scope()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare membership_row public.memberships%rowtype; is_valid boolean:=false;
begin
  select * into membership_row from public.memberships where id=new.membership_id;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if new.scope_kind='platform' then
    select exists(
      select 1 from public.org_units o
      where o.id=new.resource_id and o.kind='platform' and o.status='active'
        and exists(
          select 1 from public.membership_roles mr
          join public.roles r on r.id=mr.role_id
          where mr.membership_id=membership_row.id and mr.revoked_at is null
            and (mr.expires_at is null or mr.expires_at>now()) and r.is_owner and r.status='active'
        )
    ) into is_valid;
    if not is_valid then raise exception 'PLATFORM_SCOPE_REQUIRES_OWNER'; end if;
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

insert into public.membership_scopes(membership_id,scope_kind,resource_id)
select distinct membership.id,'platform',platform.id
from public.memberships membership
join public.membership_roles membership_role on membership_role.membership_id=membership.id
join public.roles role on role.id=membership_role.role_id
cross join public.org_units platform
where membership.target='admin' and membership.status='active'
  and membership_role.revoked_at is null and (membership_role.expires_at is null or membership_role.expires_at>now())
  and role.is_owner and role.status='active'
  and platform.kind='platform' and platform.status='active'
on conflict(membership_id,scope_kind,resource_id) do nothing;
