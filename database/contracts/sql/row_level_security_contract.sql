begin;

do $contract$
declare violation text;
begin
  select namespace.nspname||'.'||relation.relname into violation
  from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
  where namespace.nspname in(select schema_name from runtime.moduleauthority union all select 'invoice')
    and relation.relkind in('r','p') and(not relation.relrowsecurity or not relation.relforcerowsecurity)
  order by namespace.nspname,relation.relname limit 1;
  if violation is not null then raise exception 'IDEAL_RLS_DISABLED:%',violation; end if;

  select namespace.nspname||'.'||relation.relname into violation
  from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
  where namespace.nspname in(select schema_name from runtime.moduleauthority union all select 'invoice')
    and relation.relkind in('r','p') and not exists(
      select 1 from pg_policy policy where policy.polrelid=relation.oid and policy.polname='moduleowner'
    )
  order by namespace.nspname,relation.relname limit 1;
  if violation is not null then raise exception 'IDEAL_OWNER_POLICY_MISSING:%',violation; end if;

  if has_schema_privilege('public','runtime','usage')
    or exists(
      select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname in(select schema_name from runtime.moduleauthority union all select 'invoice')
        and relation.relkind in('r','p','v','m','S')
        and has_table_privilege('public',relation.oid,'select')
    ) then raise exception 'IDEAL_PUBLIC_PRIVILEGE_PRESENT'; end if;

  if exists(select 1 from pg_roles where rolname in('shopapp','shopjob','shopread') and rolbypassrls)
    then raise exception 'IDEAL_RUNTIME_ROLE_BYPASSES_RLS'; end if;
end
$contract$;

rollback;
