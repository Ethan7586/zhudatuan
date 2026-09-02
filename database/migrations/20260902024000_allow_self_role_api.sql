begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260902023000') then
    raise exception 'SELF_ROLE_API_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902024000') then
    raise exception 'SELF_ROLE_API_ALREADY_APPLIED';
  end if;
end
$precondition$;

-- role:self is the single global, least-privilege session role that every
-- storefront membership receives. It is not an organization delegation role,
-- so an organization-only visibility predicate makes the fixed two-role grant
-- incomplete. Keep every other role scope-bound and expose only this immutable
-- system-role identity to the API workload.
drop policy appscope on access.role;
create policy appscope on access.role for all to shopapp using(
  access.scope_allowed(scope_id)
  or (id='role:self' and scope_id='self' and kind='system' and status='active')
) with check(
  access.scope_allowed(scope_id)
);

select runtime.record_migration_evidence(
  '20260902024000',
  (select count(*) from pg_policies where schemaname='access' and tablename='role' and policyname='appscope'),
  (select count(*) from access.role where id='role:self' and scope_id='self' and kind='system' and status='active'),
  0,0,
  'select policyname,cmd,qual,with_check from pg_policies where schemaname=''access'' and tablename=''role'' and policyname=''appscope'';',
  'select id,scope_id,kind,status from access.role where id=''role:self'';'
);

insert into runtime.schemaversion(version,checksum)
values(
  '20260902024000',
  encode(public.digest('20260902024000_allow_self_role_api','sha256'),'hex')
);

do $assert$
declare policy_using text;
declare policy_check text;
begin
  select qual,with_check into policy_using,policy_check
  from pg_policies where schemaname='access' and tablename='role' and policyname='appscope';
  if position('access.scope_allowed(scope_id)' in coalesce(policy_using,''))=0
    or position('role:self' in coalesce(policy_using,''))=0
    or position('scope_id' in coalesce(policy_using,''))=0
    or position('system' in coalesce(policy_using,''))=0
    or position('active' in coalesce(policy_using,''))=0
    or position('access.scope_allowed(scope_id)' in coalesce(policy_check,''))=0
    or position('role:self' in coalesce(policy_check,''))>0 then
    raise exception 'SELF_ROLE_API_POLICY_INVALID';
  end if;
  if not exists(select 1 from access.role where id='role:self' and scope_id='self' and kind='system' and status='active') then
    raise exception 'SELF_ROLE_API_ROLE_INVALID';
  end if;
end
$assert$;

commit;
