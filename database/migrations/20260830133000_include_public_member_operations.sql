begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830132000') then
    raise exception 'PUBLIC_MEMBER_OPERATIONS_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830133000') then
    raise exception 'PUBLIC_MEMBER_OPERATIONS_ALREADY_APPLIED';
  end if;
end $precondition$;

create or replace function capability.membership_operations(p_membership_id text)
returns table(operation_id text) language sql stable security definer
set search_path=capability,access,organization,pg_temp as $function$
  with subject as (
    select membership.organization_id,
      case membership.client when 'operator' then 'console' else membership.client end target
    from access.membership membership
    where membership.id=p_membership_id and membership.status='active'
  ), permissions as materialized (
    select permission_code,effect from access.effective_permissions(p_membership_id)
  )
  select operation.operation_id
  from subject
  join capability.operation operation on operation.audience in('public',subject.target)
  where exists(
      select 1 from organization.unitclosure closure
      join capability.entitlement entitlement on entitlement.scope_id=closure.ancestor_id
        and entitlement.capability_id=operation.capability_id and entitlement.state='enabled'
        and entitlement.effective_at<=clock_timestamp()
        and (entitlement.expires_at is null or entitlement.expires_at>clock_timestamp())
      where closure.descendant_id=subject.organization_id)
    and (operation.permission_code is null or exists(
      select 1 from permissions permission
      where permission.permission_code=operation.permission_code and permission.effect='allow'))
  order by operation.operation_id
$function$;

select runtime.record_migration_evidence('20260830133000',
  (select count(*) from capability.operation where audience='public'),
  (select count(*) from capability.operation where audience='public'),0,0,
  'select membership.id,capability.membership_operations(membership.id) from access.membership membership where membership.status=''active'';',
  'select operation_id,audience from capability.operation where audience=''public'' order by operation_id;');
insert into runtime.schemaversion(version,checksum)
values('20260830133000',encode(public.digest('20260830133000_include_public_member_operations','sha256'),'hex'));

do $assert$ begin
  if exists(
    select 1
    from access.membership membership
    join capability.operation operation on operation.audience='public'
    where membership.status='active'
      and exists(
        select 1 from organization.unitclosure closure
        join capability.entitlement entitlement on entitlement.scope_id=closure.ancestor_id
          and entitlement.capability_id=operation.capability_id and entitlement.state='enabled'
          and entitlement.effective_at<=clock_timestamp()
          and (entitlement.expires_at is null or entitlement.expires_at>clock_timestamp())
        where closure.descendant_id=membership.organization_id)
      and (operation.permission_code is null or exists(
        select 1 from access.effective_permissions(membership.id) permission
        where permission.permission_code=operation.permission_code and permission.effect='allow'))
      and not exists(
        select 1 from capability.membership_operations(membership.id) available
        where available.operation_id=operation.operation_id)
  ) then
    raise exception 'PUBLIC_MEMBER_OPERATIONS_MISSING';
  end if;
  if exists(
    select 1
    from access.membership membership
    join lateral capability.membership_operations(membership.id) available on true
    join capability.operation operation on operation.operation_id=available.operation_id
    where membership.status='active'
      and operation.audience not in('public',case membership.client when 'operator' then 'console' else membership.client end)
  ) then
    raise exception 'PUBLIC_MEMBER_OPERATIONS_AUDIENCE_LEAK';
  end if;
end $assert$;

commit;
