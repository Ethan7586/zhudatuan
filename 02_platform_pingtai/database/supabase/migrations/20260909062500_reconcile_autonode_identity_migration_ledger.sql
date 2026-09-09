begin;

select pg_advisory_xact_lock(hashtext('sfl:reconcile-autonode-identity-migration-ledger:v1'));

do $reconcile$
declare
  v_name text;
  v_statements text[];
  v_expected_statements constant text[] := array[
    'profile=registration-only/v1',
    'source_sha256=64537e9bbe5e9fc9022fe76f9a34e03b273ab12be07ba7e94128adb72a8d452c',
    'executed_sha256=64537e9bbe5e9fc9022fe76f9a34e03b273ab12be07ba7e94128adb72a8d452c',
    'reason=append-only post-history migration executed byte-for-byte'
  ]::text[];
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'AUTONODE_IDENTITY_LEDGER_RECONCILIATION_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260909062000'
        and checksum='3fd8550c8331373bce69345128c464f331fcc0ca57d873621091905641c1e638')
    or exists(select 1 from runtime.schemaversion where version>'20260909062000')
    or to_regclass('identity.nodeprovisioning') is null
    or to_regprocedure('identity.provision_node_realm(jsonb)') is null
    or to_regprocedure('identity.disable_node_realm(text)') is null
    or has_function_privilege('public','identity.provision_node_realm(jsonb)','execute')
    or has_function_privilege('public','identity.disable_node_realm(text)','execute')
    or not has_function_privilege('zhudatuanprovisioningapi','identity.provision_node_realm(jsonb)','execute')
    or not has_function_privilege('zhudatuanprovisioningapi','identity.disable_node_realm(text)','execute')
    or has_table_privilege('zhudatuanprovisioningapi','identity.nodeprovisioning','select,insert,update,delete')
    or not exists(select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname='identity' and relation.relname='nodeprovisioning' and relation.relrowsecurity) then
    raise exception 'AUTONODE_IDENTITY_LEDGER_RECONCILIATION_SOURCE_INVALID';
  end if;

  select name,statements into v_name,v_statements
  from supabase_migrations.schema_migrations
  where version='20260909062000';
  if found then
    if v_name<>'20260909062000_provision_autonode_identity_realm.sql'
      or (v_statements is distinct from v_expected_statements
        and not (coalesce(cardinality(v_statements),0)=0
          and not (current_database()='zhudatuan_registration' and current_user='shopmigration'))) then
      raise exception 'AUTONODE_IDENTITY_LEDGER_RECONCILIATION_CONFLICT';
    end if;
  else
    insert into supabase_migrations.schema_migrations(version,statements,name)
    values(
      '20260909062000',
      v_expected_statements,
      '20260909062000_provision_autonode_identity_realm.sql'
    );
  end if;
end
$reconcile$;

insert into runtime.schemaversion(version,checksum)
values('20260909062500','1dac0e1d1a329ea966975df812bffbe076155c9aa7d8f9da88d3350f23604ed3');

do $assert$
begin
  if not exists(select 1 from supabase_migrations.schema_migrations
      where version='20260909062000'
        and name='20260909062000_provision_autonode_identity_realm.sql'
        and (statements=array[
            'profile=registration-only/v1',
            'source_sha256=64537e9bbe5e9fc9022fe76f9a34e03b273ab12be07ba7e94128adb72a8d452c',
            'executed_sha256=64537e9bbe5e9fc9022fe76f9a34e03b273ab12be07ba7e94128adb72a8d452c',
            'reason=append-only post-history migration executed byte-for-byte'
          ]::text[]
          or (coalesce(cardinality(statements),0)=0
            and not (current_database()='zhudatuan_registration' and current_user='shopmigration'))))
    or not exists(select 1 from runtime.schemaversion
      where version='20260909062500'
        and checksum='1dac0e1d1a329ea966975df812bffbe076155c9aa7d8f9da88d3350f23604ed3') then
    raise exception 'AUTONODE_IDENTITY_LEDGER_RECONCILIATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
