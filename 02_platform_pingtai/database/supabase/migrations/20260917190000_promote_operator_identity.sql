begin;

-- The identity runtime can insert registration rows but cannot update active OP roles or versions.
-- Keep the existing senior promotion in one transaction without widening its table privileges.
create function access.promote_administrator(
  p_actor_membership_id text,p_target_membership_id text,p_role_id text,
  p_actor_scope_kind text,p_actor_scope_id text,p_assignment_scope_id text,
  p_scope_source text,p_expected_access_version bigint
) returns table(changed boolean,access_version bigint)
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare
  actor record;
  target record;
  assignment_scope jsonb;
  assignment_path text;
  role_scope text;
  changed_at timestamptz;
  inserted_scope bigint := 0;
  inserted_role bigint := 0;
begin
  select membership.realm_id,membership.organization_id,
      governance.governance_level,governance.scope_organization_id
    into actor
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id
  cross join lateral access.resolve_authoritative_governance(
    membership.id,profile.principal_id,p_actor_scope_kind,p_actor_scope_id) governance
  where membership.id=p_actor_membership_id and membership.client='operator' and membership.status='active';
  if not found or actor.governance_level<>'owner' then
    raise exception 'OWNER_REQUIRED_FOR_SENIOR_ADMINISTRATOR';
  end if;

  select membership.id,membership.realm_id,membership.organization_id,membership.access_version,
      access.scope_object(membership.organization_id) membership_scope,
      exists(select 1 from access.platformowner owner where owner.singleton=true and owner.state='active'
        and owner.membership_id=membership.id) is_owner
    into target
  from access.membership membership
  where membership.id=p_target_membership_id and membership.client='operator' and membership.status='active'
  for update of membership;
  if not found then raise exception 'ADMINISTRATOR_NOT_ACTIVE'; end if;
  if actor.realm_id is null or target.realm_id is distinct from actor.realm_id
    or target.organization_id is distinct from actor.organization_id
    or actor.scope_organization_id is distinct from coalesce(
      target.membership_scope->>'tenant',target.membership_scope->>'id') then
    raise exception 'MANAGEMENT_PERMISSION_REALM_MISMATCH';
  end if;
  if target.realm_id<>'realm:l1' then raise exception 'MANAGEMENT_PERMISSION_REALM_MISMATCH'; end if;
  if target.is_owner then raise exception 'OWNER_ROLE_LEVEL_IMMUTABLE'; end if;
  if target.access_version<>p_expected_access_version then raise exception 'VERSION_CONFLICT'; end if;

  select role.scope_id into role_scope from access.role role
  where role.id=p_role_id and role.status='active'
    and role.id='role-senior-administrator-v1:'||role.scope_id
    and role.scope_id=actor.scope_organization_id
    and exists(select 1 from organization.unitclosure boundary
      where boundary.ancestor_id=role.scope_id and boundary.descendant_id=target.organization_id);
  if not found then raise exception 'ROLE_ASSIGNMENT_NOT_AVAILABLE'; end if;
  assignment_scope:=access.scope_object(p_assignment_scope_id);
  if assignment_scope is null or p_scope_source not in('direct','inherited')
    or not exists(select 1 from organization.unitclosure boundary
      where (boundary.ancestor_id=p_assignment_scope_id and boundary.descendant_id=target.organization_id)
        or (boundary.ancestor_id=target.organization_id and boundary.descendant_id=p_assignment_scope_id)) then
    raise exception 'CANNOT_GRANT_UNOWNED_SCOPE';
  end if;
  select concat_ws('/',string_agg(ancestor.value->>'id','/' order by ancestor.ordinality),p_assignment_scope_id)
    into assignment_path
  from jsonb_array_elements(assignment_scope->'path') with ordinality ancestor(value,ordinality);
  changed_at:=clock_timestamp();
  perform set_config('app.operator_promotion_membership_id',target.id,true);

  if p_scope_source='inherited' then
    if not exists(select 1 from access.scopegrant scopegrant
      where scopegrant.membership_id=target.id and scopegrant.scope_kind=assignment_scope->>'kind'
        and scopegrant.scope_id=p_assignment_scope_id and scopegrant.effect='allow'
        and scopegrant.access_version>0 and scopegrant.access_version<=target.access_version
        and scopegrant.effective_at<=changed_at
        and (scopegrant.expires_at is null or scopegrant.expires_at>changed_at)) then
      raise exception 'INHERITED_SCOPE_NOT_FOUND';
    end if;
  else
    insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,expires_at,access_version)
    select 'scope:'||gen_random_uuid()::text,target.id,assignment_scope->>'kind',p_assignment_scope_id,
      assignment_path,'allow',changed_at,null,target.access_version+1
    where not exists(select 1 from access.scopegrant existing
      where existing.membership_id=target.id and existing.scope_kind=assignment_scope->>'kind'
        and existing.scope_id=p_assignment_scope_id and existing.effect='allow'
        and existing.effective_at<=changed_at and (existing.expires_at is null or existing.expires_at>changed_at));
    get diagnostics inserted_scope=row_count;
  end if;

  insert into access.membershiprole(
    membership_id,role_id,effective_at,expires_at,delegated_by,
    assigned_scope_kind,assigned_scope_id,assigned_scope_path,scope_source)
  select target.id,p_role_id,changed_at,null,p_actor_membership_id,
    assignment_scope->>'kind',p_assignment_scope_id,assignment_path,p_scope_source
  where not exists(select 1 from access.membershiprole existing
    where existing.membership_id=target.id and existing.role_id=p_role_id
      and coalesce(existing.assigned_scope_id,p_assignment_scope_id)=p_assignment_scope_id
      and existing.effective_at<=changed_at and (existing.expires_at is null or existing.expires_at>changed_at));
  get diagnostics inserted_role=row_count;

  changed:=inserted_scope>0 or inserted_role>0;
  if changed then
    update access.membership membership
      set access_version=membership.access_version+1,
        operator_display_name=case
          when coalesce(membership.operator_display_name,profile.display_name) ~ '^(高级管理员|管理员) · .+$'
            or profile.display_name ~ '^L([0-9]|10|11)消费者[0-9]{4}$'
            then '高级管理员 · '||case
              when profile.mobile_masked ~ '[0-9]{4}$' then right(profile.mobile_masked,4)
              else right(profile.display_name,4) end
          else coalesce(membership.operator_display_name,profile.display_name) end
      from member.profile profile where membership.id=target.id and membership.member_id=profile.id
        and membership.client='operator' and membership.status='active'
        and membership.access_version=p_expected_access_version
      returning membership.access_version into access_version;
    if not found then raise exception 'VERSION_CONFLICT'; end if;
  else
    access_version:=target.access_version;
  end if;
  perform set_config('app.operator_promotion_membership_id','',true);
  return next;
end
$function$;

revoke all on function access.promote_administrator(text,text,text,text,text,text,text,bigint) from public;
grant execute on function access.promote_administrator(text,text,text,text,text,text,text,bigint) to zhudatuanidentityapi;

-- Registration rows still run the original guard. Only the delegated role
-- and versioned scope written by the promotion function skip that guard.
-- Direct identity-api inserts with the same marker remain denied by RLS.
drop trigger protect_zhudatuan_registration_membershiprole_write on access.membershiprole;
create trigger protect_zhudatuan_registration_membershiprole_write
before insert on access.membershiprole for each row
when (not (
  new.delegated_by is not null
  and new.membership_id=nullif(current_setting('app.operator_promotion_membership_id',true),'')
)) execute function access.protect_zhudatuan_registration_access_write();

drop trigger protect_zhudatuan_registration_scopegrant_write on access.scopegrant;
create trigger protect_zhudatuan_registration_scopegrant_write
before insert on access.scopegrant for each row
when (not (
  new.access_version>1
  and new.membership_id=nullif(current_setting('app.operator_promotion_membership_id',true),'')
)) execute function access.protect_zhudatuan_registration_access_write();

insert into runtime.schemaversion(version,checksum)
values('20260917190000',encode(public.digest('promote-operator-identity:v1','sha256'),'hex'));

commit;
