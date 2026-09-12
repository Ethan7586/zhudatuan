do $contract$
declare
  operator_before jsonb;
  storefront_before jsonb;
begin
  select to_jsonb(membership) into operator_before from access.membership membership
    where membership.id='membership:operator';
  select to_jsonb(membership) into storefront_before from access.membership membership
    where membership.id='membership:storefront';

  if (select count(*) from identity.resolve_session(
      encode(public.digest('token-operator','sha256'),'hex'),'api.a.test'
    ) session where session.membership_id='membership:operator'
      and session.membership_client='operator'
      and session.governance_organization_id='tenant:a' and session.target='console')<>1 then
    raise exception 'ACTIVE_OPERATOR_SESSION_NOT_RESOLVED';
  end if;

  if not exists(select 1 from access.resolve_session_membership(
      'membership:operator','realm:a','operator','tenant:a'
    ) resolved where resolved.active and resolved.grants::text like '%admin.members.read%')
    or exists(select 1 from access.resolve_session_membership(
      'membership:operator','realm:a','operator','tenant:a'
    ) resolved where resolved.grants::text like '%catalog.listings.read%') then
    raise exception 'OPERATOR_PERMISSION_PROJECTION_INVALID';
  end if;

  if not exists(select 1 from access.resolve_session_membership(
      'membership:storefront','realm:a','storefront','mall:a'
    ) resolved where resolved.active and resolved.grants::text like '%catalog.listings.read%')
    or exists(select 1 from access.resolve_session_membership(
      'membership:storefront','realm:a','storefront','mall:a'
    ) resolved where resolved.grants::text like '%admin.members.read%') then
    raise exception 'STOREFRONT_PERMISSION_PROJECTION_INVALID';
  end if;

  if exists(select 1 from identity.resolve_session(
      encode(public.digest('token-operator','sha256'),'hex'),'api.b.test'))
    or exists(select 1 from identity.resolve_session(
      encode(public.digest('token-realm-b','sha256'),'hex'),'api.a.test'))
    or exists(select 1 from access.resolve_session_membership(
      'membership:operator','realm:b','operator','tenant:a')) then
    raise exception 'CROSS_REALM_PERMISSION_LEAK';
  end if;

  if exists(select 1 from identity.resolve_session(
      encode(public.digest('token-inactive','sha256'),'hex'),'api.a.test'))
    or exists(select 1 from access.resolve_session_membership(
      'membership:inactive','realm:a','storefront','mall:a')) then
    raise exception 'INACTIVE_MEMBERSHIP_CONSUMED';
  end if;

  if exists(select 1 from identity.resolve_session(
      encode(public.digest('token-organization-mismatch','sha256'),'hex'),'api.a.test'))
    or exists(select 1 from access.resolve_session_membership(
      'membership:operator','realm:a','operator','tenant:wrong'))
    or exists(select 1 from access.resolve_session_membership(
      'membership:operator','realm:a','storefront','tenant:a')) then
    raise exception 'CLIENT_OR_ORGANIZATION_MISMATCH_CONSUMED';
  end if;

  if not exists(select 1 from access.resolve_session_scope(
      'membership:operator','realm:a','operator','tenant:a','admin.members.read',null,'tenant:a'
    ) scope where scope.scope->>'id'='tenant:a')
    or exists(select 1 from access.resolve_session_scope(
      'membership:operator','realm:a','operator','tenant:wrong','admin.members.read',null,'tenant:a'))
    or not exists(select 1 from capability.session_membership_operations(
      'membership:operator','realm:a','operator','tenant:a'
    ) operation where operation.operation_id='admin.members.read')
    or exists(select 1 from capability.session_membership_operations(
      'membership:storefront','realm:a','storefront','mall:a'
    ) operation where operation.operation_id='admin.members.read') then
    raise exception 'SESSION_SCOPE_OR_CAPABILITY_BOUNDARY_INVALID';
  end if;

  if operator_before is distinct from (select to_jsonb(membership) from access.membership membership
      where membership.id='membership:operator')
    or storefront_before is distinct from (select to_jsonb(membership) from access.membership membership
      where membership.id='membership:storefront') then
    raise exception 'PERMISSION_READ_MUTATED_MEMBERSHIP';
  end if;
end
$contract$;
