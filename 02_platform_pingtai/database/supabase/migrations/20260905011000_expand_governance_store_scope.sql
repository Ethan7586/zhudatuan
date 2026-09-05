begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:expand-governance-store-scope:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'GOVERNANCE_STORE_SCOPE_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260905010000'
        and checksum='00b8152be9bdad8f8e3ccf97b2607f33a241e891a32340562a3f2b691023208d')
    or exists(select 1 from runtime.schemaversion where version>'20260905010000') then
    raise exception 'GOVERNANCE_STORE_SCOPE_PREDECESSOR_INVALID';
  end if;
  if to_regclass('partner.store') is null
    or to_regclass('organization.organization') is null
    or to_regclass('organization.unitclosure') is null then
    raise exception 'GOVERNANCE_STORE_SCOPE_DEPENDENCY_MISSING';
  end if;
end
$precondition$;

create or replace function access.canonical_governance_scope(
  p_scope_kind text,
  p_scope_id text,
  p_actor_id text,
  p_membership_id text
)
returns table(
  scope_kind text,
  semantic_id text,
  storage_id text,
  organization_id text
)
language sql
stable
security definer
set search_path=pg_catalog,pg_temp
as $function$
  with actor_context as materialized(
    select membership.member_id,membership.organization_id
    from access.membership membership
    join member.profile profile on profile.id=membership.member_id
      and profile.principal_id=p_actor_id and profile.status='active'
    join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
    where membership.id=p_membership_id and membership.status='active'
  ), candidates as(
    select 1 priority,'self'::text scope_kind,p_actor_id semantic_id,
      'self:'||p_actor_id storage_id,actor_context.organization_id
    from actor_context
    where p_scope_id in(p_actor_id,'self:'||p_actor_id)
      and (p_scope_kind is null or p_scope_kind='self')
    union all
    select 2,'owner',actor_context.member_id,actor_context.member_id,actor_context.organization_id
    from actor_context
    where p_scope_id in(actor_context.member_id,'owner:'||actor_context.member_id)
      and (p_scope_kind is null or p_scope_kind='owner')
    union all
    select 3,scope.kind,scope.id,scope.id,
      coalesce(case when scope.kind='tenant' then scope.id end,
        (select tenant.id from organization.unitclosure closure
          join organization.organization tenant on tenant.id=closure.ancestor_id and tenant.kind='tenant'
          where closure.descendant_id=scope.id order by closure.depth asc limit 1),scope.id)
    from organization.organization scope
    where scope.id=p_scope_id and scope.status='active'
      and (p_scope_kind is null or p_scope_kind=scope.kind)
    union all
    select 4,'store',store.id,store.id,
      coalesce((select tenant.id from organization.unitclosure closure
        join organization.organization tenant on tenant.id=closure.ancestor_id and tenant.kind='tenant'
        where closure.descendant_id=store.mall_id order by closure.depth asc limit 1),store.mall_id)
    from actor_context
    join partner.store store on store.id=p_scope_id
    join organization.organization mall on mall.id=store.mall_id and mall.status='active'
    where p_scope_kind is null or p_scope_kind='store'
  )
  select candidates.scope_kind,candidates.semantic_id,candidates.storage_id,candidates.organization_id
  from candidates order by candidates.priority limit 1
$function$;

insert into runtime.schemaversion(version,checksum)
values('20260905011000','dc927a85fe33c2141e6584c41a557fad546a8114785afa6e3bf80a064381f617');

do $assert$
begin
  if position('partner.store' in pg_get_functiondef('access.canonical_governance_scope(text,text,text,text)'::regprocedure))=0
    or not exists(select 1 from runtime.schemaversion
      where version='20260905011000'
        and checksum='dc927a85fe33c2141e6584c41a557fad546a8114785afa6e3bf80a064381f617') then
    raise exception 'GOVERNANCE_STORE_SCOPE_INCOMPLETE';
  end if;
end
$assert$;

commit;
