begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831039000') then
    raise exception 'PERSONAL_ACCESS_GRANT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831040000') then
    raise exception 'PERSONAL_ACCESS_GRANT_ALREADY_APPLIED';
  end if;
end $precondition$;

drop policy appscope on access.scopegrant;
create policy appscope on access.scopegrant for all to shopapp using(
  access.scope_allowed(scope_id)
  or scope_kind='owner' and exists(
    select 1 from access.membership membership
    where membership.id=membership_id and membership.member_id=scope_id
      and access.scope_allowed(membership.organization_id)
  )
  or scope_kind='self' and exists(
    select 1 from access.membership membership
    where membership.id=membership_id and scope_id='self:'||membership.principal_id
      and access.scope_allowed(membership.organization_id)
  )
) with check(
  access.scope_allowed(scope_id)
  or scope_kind='owner' and exists(
    select 1 from access.membership membership
    where membership.id=membership_id and membership.member_id=scope_id
      and access.scope_allowed(membership.organization_id)
  )
  or scope_kind='self' and exists(
    select 1 from access.membership membership
    where membership.id=membership_id and scope_id='self:'||membership.principal_id
      and access.scope_allowed(membership.organization_id)
  )
);

do $verify$
declare policy_using text; policy_check text;
begin
  select qual,with_check into policy_using,policy_check from pg_policies
  where schemaname='access' and tablename='scopegrant' and policyname='appscope';
  if position('membership.member_id' in coalesce(policy_using,''))=0
      or position('membership.principal_id' in coalesce(policy_using,''))=0
      or position('membership.member_id' in coalesce(policy_check,''))=0
      or position('membership.principal_id' in coalesce(policy_check,''))=0 then
    raise exception 'PERSONAL_ACCESS_GRANT_POLICY_INCOMPLETE';
  end if;
end $verify$;

select runtime.record_migration_evidence('20260831040000',1,1,0,0,
  'select policyname,qual,with_check from pg_policies where schemaname=''access'' and tablename=''scopegrant'' order by policyname;',
  'select scope_kind,count(*) from access.scopegrant group by scope_kind order by scope_kind;');
insert into runtime.schemaversion(version,checksum)
values('20260831040000',encode(public.digest('20260831040000_scope_personal_access_grants','sha256'),'hex'));

commit;
