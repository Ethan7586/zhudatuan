begin;

select pg_advisory_xact_lock(hashtext('identity:senior-administrator-invitation-projection:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260913014500'
        and checksum='75e0c2a57031b82c0746f18500153394d67efbac05324cb35dc86a05bff015be')
    or exists(select 1 from runtime.schemaversion where version>'20260913014500') then
    raise exception 'SENIOR_ADMINISTRATOR_INVITATION_PROJECTION_PREDECESSOR_INVALID';
  end if;
  if to_regprocedure('access.resolve_governance(text,text,text,text)') is null then
    raise exception 'SENIOR_ADMINISTRATOR_GOVERNANCE_RESOLVER_MISSING';
  end if;
end
$precondition$;

alter table access.membership add column operator_display_name text;

update access.membership membership
set operator_display_name=case
  when profile.display_name ~ '^L([0-9]|10|11)消费者[0-9]{4}$' then
    case
      when exists(select 1 from access.membershiprole assignment
        where assignment.membership_id=membership.id
          and assignment.role_id like 'role-senior-administrator-v1:%'
          and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))
        then '高级管理员 · '||coalesce(nullif(right(profile.mobile_masked,4),''),right(profile.display_name,4))
      else '管理员 · '||coalesce(nullif(right(profile.mobile_masked,4),''),right(profile.display_name,4))
    end
  else profile.display_name
end
from member.profile profile
where membership.member_id=profile.id and membership.client='operator';

create or replace function access.resolve_governance(
  p_membership_id text,
  p_actor_id text,
  p_scope_kind text,
  p_scope_id text
)
returns table(
  governance_level text,
  is_exact_owner boolean,
  actor_membership_id text,
  actor_principal_id text,
  organization_id text,
  owner_membership_id text,
  scope_kind text,
  scope_semantic_id text,
  scope_storage_id text,
  scope_organization_id text,
  resolved_at timestamptz
)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  with decision_time as materialized(select statement_timestamp() resolved_at),
  actor_context as materialized(
    select membership.id membership_id,profile.principal_id,membership.organization_id,membership.client
    from decision_time
    join access.membership membership on membership.id=p_membership_id and membership.status='active'
    join member.profile profile on profile.id=membership.member_id
      and profile.principal_id=p_actor_id and profile.status='active'
    join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  ), authoritative_owner as materialized(
    select owner.membership_id,profile.principal_id
    from decision_time
    join access.platformowner owner on owner.singleton=true and owner.state='active'
    join access.membership membership on membership.id=owner.membership_id and membership.status='active'
    join member.profile profile on profile.id=membership.member_id and profile.status='active'
    join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
    where exists(select 1 from access.membershiprole assignment
      where assignment.membership_id=owner.membership_id
        and assignment.role_id='role-platform-owner-v2'
        and assignment.effective_at<=decision_time.resolved_at
        and (assignment.expires_at is null or assignment.expires_at>decision_time.resolved_at))
  ), senior_administrator as materialized(
    select actor_context.membership_id
    from actor_context
    cross join decision_time
    where actor_context.client='operator' and exists(
      select 1 from access.membershiprole assignment
      join access.role role on role.id=assignment.role_id and role.status='active'
      join organization.unitclosure senior_scope on senior_scope.ancestor_id=role.scope_id
        and senior_scope.descendant_id=actor_context.organization_id
      where assignment.membership_id=actor_context.membership_id
        and assignment.role_id='role-senior-administrator-v1:'||role.scope_id
        and assignment.effective_at<=decision_time.resolved_at
        and (assignment.expires_at is null or assignment.expires_at>decision_time.resolved_at)
    )
  ), canonical_scope as materialized(
    select normalized.*
    from actor_context
    cross join lateral access.canonical_governance_scope(
      p_scope_kind,p_scope_id,actor_context.principal_id,actor_context.membership_id) normalized
  )
  select case
      when authoritative_owner.membership_id=actor_context.membership_id
        and authoritative_owner.principal_id=actor_context.principal_id then 'owner'
      when senior_administrator.membership_id=actor_context.membership_id then 'senior_administrator'
      when actor_context.client='operator' then 'administrator'
      else 'member'
    end governance_level,
    coalesce(authoritative_owner.membership_id=actor_context.membership_id
      and authoritative_owner.principal_id=actor_context.principal_id,false) is_exact_owner,
    actor_context.membership_id,actor_context.principal_id,actor_context.organization_id,
    authoritative_owner.membership_id,canonical_scope.scope_kind,canonical_scope.semantic_id,
    canonical_scope.storage_id,canonical_scope.organization_id,decision_time.resolved_at
  from decision_time
  cross join actor_context
  cross join canonical_scope
  left join authoritative_owner on true
  left join senior_administrator on true
$function$;

insert into runtime.schemaversion(version,checksum)
values('20260913015500','572125b5e38fa541f9f90b202280fa1c38797dbf0dad5ae99dad691a7e0e54cf');

do $assert$
begin
  if not exists(select 1 from information_schema.columns
      where table_schema='access' and table_name='membership' and column_name='operator_display_name')
    or not exists(select 1 from runtime.schemaversion where version='20260913015500'
      and checksum='572125b5e38fa541f9f90b202280fa1c38797dbf0dad5ae99dad691a7e0e54cf') then
    raise exception 'SENIOR_ADMINISTRATOR_INVITATION_PROJECTION_INCOMPLETE';
  end if;
end
$assert$;

commit;
