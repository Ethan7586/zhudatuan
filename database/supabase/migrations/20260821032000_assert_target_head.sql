begin;

do $block$
declare expected text[]:=array['access','audit','benefit','capability','cart','catalog','channel','checkout','experience','extension','finance','fulfillment','identity','inventory','invoice','marketing','member','notification','ordering','organization','partner','payment','pricing','qualification','reporting','risk','runtime','support','verification','voucher'];
declare actual text[];
begin
  select array_agg(schema_name order by schema_name) into actual from information_schema.schemata where schema_name=any(expected);
  if actual is distinct from expected then raise exception 'TARGET_SCHEMA_SET_MISMATCH: %',actual; end if;
  if (select count(*) from runtime.operation)<>154 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if (select count(*) from runtime.event)<>22 then raise exception 'EVENT_REGISTRY_COUNT_MISMATCH'; end if;
  if (select count(*) from capability.operation)<>(select count(*) from runtime.operation) then raise exception 'CAPABILITY_OPERATION_DRIFT'; end if;
  if exists(select 1 from pg_tables where schemaname='public') then raise exception 'PUBLIC_BUSINESS_TABLE_REMAINS'; end if;
  if exists(select 1 from pg_tables where schemaname='inventory' and tablename in('commands','cutover_records','cutover_reviews','movements','observations','reservations','stock_items','sync_states')) then raise exception 'LEGACY_INVENTORY_TABLE_REMAINS'; end if;
  if to_regclass('runtime.vouchersecretstage') is not null then raise exception 'VOUCHER_STAGE_REMAINS'; end if;
  if to_regclass('runtime.partneraddressstage') is not null or to_regclass('runtime.distributorcontactstage') is not null then raise exception 'PII_STAGE_REMAINS'; end if;
  if to_regclass('runtime.wechatidentitystage') is not null then raise exception 'WECHAT_IDENTITY_STAGE_REMAINS'; end if;
  if exists(select 1 from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace where namespace.nspname='public' and procedure.proname like 'api\_%' escape '\') then raise exception 'LEGACY_PUBLIC_FUNCTION_REMAINS'; end if;
  if exists(select 1 from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace where namespace.nspname=any(expected) and procedure.proname='execute') then raise exception 'GENERIC_DOMAIN_EXECUTE_FORBIDDEN'; end if;
  if exists(select 1 from information_schema.role_table_grants where grantee in('PUBLIC','anon','authenticated','service_role') and table_schema=any(expected)) then raise exception 'BROAD_TABLE_GRANT_REMAINS'; end if;
  if exists(select 1 from information_schema.role_routine_grants where grantee in('PUBLIC','anon','authenticated','service_role') and specific_schema=any(expected)) then raise exception 'BROAD_FUNCTION_GRANT_REMAINS'; end if;
  if exists(select 1 from pg_roles where rolname in('shopapp','shopjob','shopmigration','shopread') and rolbypassrls) then raise exception 'APPLICATION_ROLE_BYPASSRLS'; end if;
  if exists(select 1 from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace where namespace.nspname=any(expected) and procedure.prosecdef and not exists(select 1 from unnest(coalesce(procedure.proconfig,array[]::text[])) setting where setting like 'search_path=%')) then raise exception 'SECURITY_DEFINER_SEARCH_PATH_UNSET'; end if;
  if exists(select 1 from pg_tables target join pg_class relation on relation.relname=target.tablename join pg_namespace namespace on namespace.oid=relation.relnamespace and namespace.nspname=target.schemaname
    where target.schemaname=any(expected) and not relation.relrowsecurity) then raise exception 'TARGET_TABLE_RLS_DISABLED'; end if;
  if exists(select 1 from identity.credential where provider='alias.test') then raise exception 'TEST_IDENTITY_REMAINS'; end if;
  if exists(select 1 from runtime.reconciliationevidence where difference<>0) or exists(select 1 from runtime.reconciliationhash where source_hash<>target_hash) then raise exception 'RECONCILIATION_EVIDENCE_INVALID'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821032000' and checksum~'^[0-9a-f]{64}$') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $block$;

commit;
