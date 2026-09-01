import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { Client } from 'pg';
import { parse } from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const ROOT = repositoryRoot;
const MIGRATIONS = join(ROOT, 'database', 'migrations');
const HISTORY = join(ROOT, 'database', 'contracts', 'history.json');
const OBJECTS = join(ROOT, 'database', 'contracts', 'objects.yml');
const CONTRACTS = join(ROOT, 'database', 'contracts', 'sql');
const REGISTRATION_BOUNDARY_RECONCILE = join(ROOT, 'infrastructure', 'zhudatuan', 'aliyun', 'postgres-reconcile-registration-boundary.sql');
const BOOTSTRAP = '20260817191000_bootstrap_ethan_platform_owner.sql';
const OWNER_RECONCILIATION = '20260820132000_platform_owner_reconciliation.sql';
const INVITATION_SCOPE = '20260821066000_resolve_invitation_scope.sql';
const REGISTRATION_BOOTSTRAP_REPAIR = '20260829040000_zhudatuan_registration_bootstrap_runtime_repair.sql';
const REGISTRATION_BOOTSTRAP_REPLAY_FUTURE_HEAD_ASSERTION =
  /\n  if exists\(select 1 from runtime\.schemaversion\n    where version>'20260828183000' and version<>'20260829040000'\) then\n    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_REPAIR_FUTURE_HEAD_INVALID';\n  end if;/;
const REGISTRATION_ASSERTION_OMISSIONS = new Map([
  [INVITATION_SCOPE, /\ndo \$assert\$ begin\n  if access\.resource_scope\('identity\.invitations\.create',[\s\S]*?\nend \$assert\$;\n/],
  ['20260821069000_add_store_management.sql', /\n  select id into membership from access\.membership[\s\S]*?STORE_CREATE_SCOPE_UNRESOLVED'; end if;\n/],
  ['20260821074000_grant_platform_owner_operations.sql', /\ndo \$assert\$[\s\S]*?\n\$assert\$;\n/],
  ['20260821075000_grant_platform_cardlibrary_read.sql', /\ndo \$assert\$[\s\S]*?\nend \$assert\$;\n/],
  ['20260821076000_grant_platform_cockpit_reads.sql', /\ndo \$assert\$[\s\S]*?\n\$assert\$;\n/],
  ['20260821078000_complete_experience_application.sql', /\n  if exists\(\n    select 1 from unnest\(required_operations\)[\s\S]*?PLATFORM_OWNER_EXPERIENCE_OPERATION_MISSING';\n  end if;\n/],
]);
const INVENTORY_CUTOVER = '20260820133000_inventory_single_source_cutover.sql';
const SECURE_STAGE = '20260821026000_backfill_domain_data.sql';
const PROVIDER_HARDCUT = '20260830150000_hardcut_provider_ids.sql';
const REPAIR_FILES = [
  '20260829100000_contract_v2_catalog.sql',
  '20260829101000_operation_idempotency.sql',
  '20260829102000_inbox_deduplication.sql',
  '20260829103000_outbox_delivery.sql',
  '20260829104000_job_lease_fencing.sql',
  '20260829105000_audit_hash_chain.sql',
  '20260829106000_finance_economic_leg.sql',
  '20260829107000_reporting_watermark.sql',
  '20260829108000_extension_registry.sql',
  '20260829109000_runtime_role_hardcut.sql',
  '20260829110000_add_identity_federation.sql',
  '20260829111000_secure_identity_federation.sql',
  '20260829112000_add_organization_directory.sql',
  '20260829113000_publish_navigation_identity_contract.sql',
  '20260829114000_grant_navigation_identity_access.sql',
  '20260829115000_add_navigation_read_functions.sql',
  '20260829116000_add_federation_cleanup_jobs.sql',
  '20260829117000_validate_federation_data.sql',
  '20260829118000_retire_compatibility_runtime.sql',
  '20260830100000_directory_sync_integrity.sql',
  '20260830101000_unify_access_policy.sql',
  '20260830102000_add_security_context.sql',
  '20260830103000_enforce_maker_checker.sql',
  '20260830104000_create_invitation_domain.sql',
  '20260830105000_publish_contract_v3.sql',
  '20260830106000_harden_invitation_lifecycle.sql',
  '20260830107000_bind_federation_auth_ticket.sql',
  '20260830108000_enforce_invitation_rls.sql',
  '20260830109000_complete_campaign_enrollment.sql',
  '20260830110000_publish_campaign_contract.sql',
  '20260830111000_generalize_identity_linkcase.sql',
  '20260830112000_publish_identity_link_contract.sql',
  '20260830113000_harden_invitation_rate_limits.sql',
  '20260830114000_enforce_invitation_key_readiness.sql',
  '20260830115000_separate_campaign_session.sql',
  '20260830120000_unify_membership_selection.sql',
  '20260830121000_publish_membership_selection_contract.sql',
  '20260830122000_harden_access_ownership.sql',
  '20260830123000_bind_access_membership_principal.sql',
  '20260830124000_harden_directory_provider_boundary.sql',
  '20260830125000_publish_access_override_contract.sql',
  '20260830126000_harden_preauth_invitation_shape.sql',
  '20260830127000_complete_invitation_audit_shape.sql',
  '20260830128000_complete_authorization_snapshot.sql',
  '20260830129000_publish_invitation_error_contract.sql',
  '20260830130000_bind_federation_link_transaction.sql',
  '20260830131000_hardcut_storefront_resource_scope.sql',
  '20260830132000_publish_shared_identity_audience.sql',
  '20260830133000_include_public_member_operations.sql',
  '20260830134000_split_invitation_permissions.sql',
  '20260830135000_hardcut_invitation_delegation_permissions.sql',
  '20260830136000_resolve_invitation_read_scope.sql',
  '20260830137000_publish_stepup_contract.sql',
  '20260830138000_publish_shared_member_profile.sql',
  '20260830139000_publish_shared_order_read.sql',
  '20260830140000_publish_cardlibrary_creation.sql',
  '20260830141000_publish_session_logout.sql',
  '20260830142000_publish_cardlibrary_version_policy.sql',
  '20260830143000_publish_cardlibrary_create_permission.sql',
  '20260830144000_create_referral_domain.sql',
  '20260830145000_secure_referral_domain.sql',
  '20260830146000_publish_referral_contract.sql',
  '20260830147000_create_finance_repair.sql',
  '20260830148000_publish_finance_repair_contract.sql',
  '20260830149000_publish_order_receipt.sql',
  '20260830150000_hardcut_provider_ids.sql',
  '20260830151000_publish_checkout_context.sql',
  '20260830152000_publish_mvp_authority.sql',
  '20260830153000_issue_action_proof.sql',
  '20260831010000_add_storefront_queries.sql',
  '20260831011000_hardcut_commerce_states.sql',
  '20260831012000_enforce_cart_checkout_versions.sql',
  '20260831013000_complete_payment_action.sql',
  '20260831014000_complete_aftersale_lifecycle.sql',
  '20260831015000_add_member_favorites.sql',
  '20260831016000_isolate_provider_workload.sql',
  '20260831017000_publish_storefront_contract.sql',
  '20260831018000_fix_stepup_session_resolution.sql',
  '20260831019000_register_catalog_product_read.sql',
  '20260831020000_resolve_catalog_product_scope.sql',
  '20260831021000_restore_invitation_catalog_scope.sql',
  '20260831022000_scope_product_commands_to_context.sql',
  '20260831023000_scope_catalog_products.sql',
  '20260831024000_enable_console_aftersale_read.sql',
  '20260831025000_grant_console_aftersale_read.sql',
  '20260831026000_align_catalog_product_contract.sql',
  '20260831027000_complete_member_access_workspace.sql',
  '20260831028000_resolve_managed_member_scope.sql',
  '20260831029000_enforce_storefront_domain_identity.sql',
  '20260831030000_publish_storefront_host_resolver.sql',
  '20260831031000_resolve_storefront_tenant_boundary.sql',
  '20260831032000_publish_storefront_binding_contract.sql',
  '20260831033000_publish_shared_support_audience.sql',
  '20260831034000_publish_storefront_voucher_boundary.sql',
  '20260831035000_publish_personal_voucher_permission.sql',
  '20260831036000_restore_invitation_read_scope.sql',
  '20260831037000_publish_invitation_scope_repair.sql',
  '20260831038000_allow_enrollment_challenge_claim.sql',
  '20260831039000_publish_enrollment_challenge_claim.sql',
  '20260831040000_scope_personal_access_grants.sql',
  '20260831041000_publish_personal_access_grants.sql',
  '20260831042000_allow_invitation_receipt_returning.sql',
  '20260831043000_publish_invitation_receipt_returning.sql',
  '20260831044000_restore_owner_voucher_delegation.sql',
  '20260831045000_publish_owner_voucher_delegation.sql',
  '20260831046000_publish_storefront_csrf_contract.sql',
  '20260901010000_move_address_to_member.sql',
  '20260901011000_resolve_payment_webhook_scope.sql',
  '20260901012000_resolve_access_role_scope.sql',
  '20260901013000_publish_mobile_challenge_contract.sql',
  '20260901014000_mall_storefront_entry.sql',
  '20260901015000_publish_mall_storefront_entry.sql',
  '20260901016000_publish_stepup_disable_contract.sql',
];
const HARD_CUT_CONTRACTS = [
  'contract_v3_catalog_contract.sql',
  'access_override_authorization_contract.sql',
  'invitation_security_contract.sql',
  'operation_idempotency_contract.sql',
  'inbox_deduplication_contract.sql',
  'outbox_delivery_contract.sql',
  'job_lease_fencing_contract.sql',
  'audit_hash_chain_contract.sql',
  'finance_economic_leg_contract.sql',
  'reporting_watermark_contract.sql',
  'extension_registry_contract.sql',
  'runtime_role_hardcut_contract.sql',
];

const mode = process.argv[2];
if (!['--check-inventory', '--schema-fresh', '--registration-fresh', '--environment-bootstrap', '--inventory-cutover-unsafe', '--postgres-fresh', '--mvp-kernel'].includes(mode)) {
  throw new Error('usage: database-contracts.mjs --check-inventory|--schema-fresh|--registration-fresh|--environment-bootstrap|--inventory-cutover-unsafe|--postgres-fresh|--mvp-kernel [URL]');
}
const replayRole = mode === '--postgres-fresh' ? process.argv[4] : undefined;
if (replayRole !== undefined && !/^[a-z][a-z0-9_]{2,62}$/.test(replayRole)) throw new Error('POSTGRES_FRESH_ROLE_INVALID');

const migrationFiles = (await readdir(MIGRATIONS)).filter((name) => name.endsWith('.sql')).sort();
const historyContract = JSON.parse(await readFile(HISTORY, 'utf8'));
await verifyInventory(migrationFiles, historyContract);
if (mode === '--check-inventory') {
  console.log(`migration inventory ok: historical=${historyContract.count} repair=${REPAIR_FILES.length} total=${migrationFiles.length}`);
  process.exit(0);
}

const database = await openDatabase();
try {
  await execute(
    database,
    `
    do $roles$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then
        create role anon nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
      end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then
        create role authenticated nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
      end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then
        create role service_role nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
      end if;
      if exists(select 1 from pg_roles where rolname in('anon','authenticated','service_role')
        and (rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls)) then
        raise exception 'DATABASE_REPLAY_ROLE_UNSAFE';
      end if;
    end $roles$;
  `,
    'database role bootstrap'
  );
  if (mode === '--registration-fresh') await installRegistrationReplayBoundary(database);
  if (replayRole !== undefined) await execute(database, `set role "${replayRole}"`, 'database migration role');
  await execute(
    database,
    `
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
  `,
    'database bootstrap'
  );
  let applied = 0;
  for (const name of migrationFiles) {
    if (mode === '--registration-fresh' && (name === BOOTSTRAP || name === OWNER_RECONCILIATION)) {
      await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0, 14), `environment-omitted:${name}`]);
      applied += 1;
      continue;
    }
    if (name === BOOTSTRAP) await seedBootstrapPrecondition(database);
    if (mode === '--inventory-cutover-unsafe' && name === INVENTORY_CUTOVER) {
      await seedUnsafeInventoryCutover(database);
      await assertUnsafeInventoryCutoverRejected(database, await readFile(join(MIGRATIONS, name), 'utf8'));
      console.log(`unsafe inventory cutover rejected atomically: migrations_before_cutover=${applied}`);
      process.exitCode = 0;
      break;
    }
    if (name === SECURE_STAGE) await stageFreshReplaySecrets(database);
    if (name === PROVIDER_HARDCUT) await seedProviderHardcutUpgrade(database);
    const source = await readFile(join(MIGRATIONS, name), 'utf8');
    const omission = REGISTRATION_ASSERTION_OMISSIONS.get(name);
    const sql = mode === '--registration-fresh' && omission ? omitExactEnvironmentAssertion(source, omission, name) : source;
    const elevatedRoleHardcut = replayRole !== undefined && name === '20260829109000_runtime_role_hardcut.sql';
    if (elevatedRoleHardcut) await execute(database, 'reset role', 'role hardcut elevation');
    try {
      await execute(database, sql, `migration ${name}`);
    } finally {
      if (elevatedRoleHardcut) await execute(database, `set role "${replayRole}"`, 'database migration role restore');
    }
    await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0, 14), name]);
    applied += 1;
  }
  if (mode !== '--inventory-cutover-unsafe') {
    if (replayRole !== undefined) await execute(database, 'reset role', 'database verification elevation');
    if (mode === '--registration-fresh') await reconcileRegistrationReplayBoundary(database);
    await verifyTarget(database);
    if (mode === '--mvp-kernel') {
      const { verifyMvpKernel } = await import('./mvp-kernel.mjs');
      await verifyMvpKernel(database);
    }
    console.log(`target schema replay passed: migrations=${applied} historical=${historyContract.count} repair=${REPAIR_FILES.length}`);
  }
} finally {
  await database.close();
}

async function openDatabase() {
  if (mode !== '--postgres-fresh') {
    // PGlite initializes only its default database. Build a tiny cluster image
    // first, then connect to the canonical registration database so database-
    // name boundaries are exercised instead of being skipped in replay.
    const cluster = new PGlite();
    await cluster.exec('create database zhudatuan_registration');
    const data = await cluster.dumpDataDir('none');
    await cluster.close();
    return new PGlite({ database: 'zhudatuan_registration', loadDataDir: data, extensions: { pgcrypto } });
  }
  const connectionString = process.argv[3];
  if (connectionString !== undefined && !/^postgres(?:ql)?:\/\//.test(connectionString)) throw new Error('POSTGRES_FRESH_URL_INVALID');
  const client = new Client({ ...(connectionString === undefined ? {} : { connectionString }), connectionTimeoutMillis: 5_000, statement_timeout: 120_000 });
  await client.connect();
  return Object.freeze({
    exec: async (sql) => {
      await client.query(sql);
    },
    query: (sql, parameters) => client.query(sql, parameters),
    close: () => client.end(),
  });
}

async function verifyInventory(files, history) {
  const duplicates = duplicateVersions(files);
  if (duplicates.size) throw new Error(`duplicate migration versions: ${JSON.stringify([...duplicates])}`);
  if (history.algorithm !== 'sha256' || history.count !== history.migrations.length || history.count !== 171 || history.migrations.at(-1)?.file.slice(0, 14) !== history.head) throw new Error('HISTORICAL_MIGRATION_MANIFEST_INVALID');
  const historical = files.filter((name) => name.slice(0, 14) <= history.head);
  if (JSON.stringify(historical) !== JSON.stringify(history.migrations.map((item) => item.file))) throw new Error('HISTORICAL_MIGRATION_FILESET_DRIFT');
  for (const item of history.migrations) {
    const digest = createHash('sha256')
      .update(await readFile(join(MIGRATIONS, item.file)))
      .digest('hex');
    if (digest !== item.sha256) throw new Error(`HISTORICAL_MIGRATION_HASH_DRIFT:${item.file}`);
  }
  const repair = files.filter((name) => name.slice(0, 14) > history.head);
  if (JSON.stringify(repair) !== JSON.stringify(REPAIR_FILES)) throw new Error(`REPAIR_MIGRATION_SEQUENCE_DRIFT:${JSON.stringify(repair)}`);
  await readFile(OBJECTS, 'utf8').catch(() => {
    throw new Error('DATABASE_OBJECT_CONTRACT_MISSING');
  });
}

function duplicateVersions(files) {
  const versions = new Map();
  for (const file of files) {
    const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file);
    if (!match) throw new Error(`INVALID_MIGRATION_FILENAME:${file}`);
    const existing = versions.get(match[1]) ?? [];
    existing.push(file);
    versions.set(match[1], existing);
  }
  return new Map([...versions].filter(([, names]) => names.length > 1));
}

function omitExactEnvironmentAssertion(source, assertion, file) {
  const matches = source.match(new RegExp(assertion.source, 'g'));
  if (matches?.length !== 1) throw new Error(`MIGRATION_ENVIRONMENT_ASSERTION_DRIFT:${file}`);
  return source.replace(assertion, '\n');
}

async function execute(database, sql, label) {
  try {
    await database.exec(sql);
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

async function seedBootstrapPrecondition(database) {
  await execute(
    database,
    `insert into public.users(id,tenant_id,enterprise_id,department_id,employee_no,display_name,email,status)
    values('user-fresh-replay-ethan','tenant-smart-wing','enterprise-demo','department-digital','SW_FRESH_REPLAY_ETHAN','Fresh Replay Ethan','fresh-replay@example.invalid','active');
    insert into public.members(id,user_id,primary_identifier,status) values('member-fresh-replay-ethan','user-fresh-replay-ethan','local_username:ethan','active');
    insert into public.member_login_aliases(provider,subject,member_id) values('local_username','ethan','member-fresh-replay-ethan');`,
    'bootstrap precondition'
  );
}

async function installRegistrationReplayBoundary(database) {
  const sentinel = 'registration-fresh-replay-sentinel-not-for-production';
  await execute(
    database,
    `create extension if not exists pgcrypto;
    create schema deployment;
    revoke all on schema deployment from public;
    create table deployment.boundary(
      id text primary key,database_name text not null,sentinel_hash char(64) not null check(sentinel_hash~'^[0-9a-f]{64}$'),
      created_at timestamptz not null default clock_timestamp()
    );
    insert into deployment.boundary(id,database_name,sentinel_hash)
    values('zhudatuan-registration-v1',current_database(),encode(public.digest('${sentinel}','sha256'),'hex'));
    create or replace function deployment.registration_bootstrap_boundary(p_sentinel text)
    returns boolean language sql stable security definer set search_path=pg_catalog,deployment,public as $function$
      select current_database()='zhudatuan_registration'
        and session_user='zhudatuanbootstrap'
        and exists(select 1 from deployment.boundary
          where id='zhudatuan-registration-v1' and database_name=current_database()
            and sentinel_hash=encode(public.digest(p_sentinel,'sha256'),'hex'))
    $function$;
    create or replace function deployment.is_independent_registration_database()
    returns boolean language sql stable security definer set search_path=pg_catalog,deployment as $function$
      select current_database()='zhudatuan_registration'
        and exists(select 1 from deployment.boundary
          where id='zhudatuan-registration-v1' and database_name=current_database())
    $function$;
    revoke all on deployment.boundary from public;
    revoke all on function deployment.registration_bootstrap_boundary(text) from public;
    revoke all on function deployment.is_independent_registration_database() from public;
  `,
    'registration replay boundary'
  );
}

async function reconcileRegistrationReplayBoundary(database) {
  // Model an existing volume initialized before shopmigration was added to
  // the nested SECURITY DEFINER boundary. The replay must exercise the exact
  // privileged reconciliation artifact used in production.
  await execute(
    database,
    `
    alter role zhudatuanbootstrap noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    alter role shopmigration noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    grant usage on schema deployment to zhudatuanbootstrap,shopmigration;
    revoke execute on function deployment.registration_bootstrap_boundary(text) from shopmigration;
    grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap;
    grant execute on function deployment.is_independent_registration_database() to shopmigration;
  `,
    'registration replay legacy boundary state'
  );
  const before = await database.query(`select
    has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE') bootstrap_allowed,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed`);
  if (JSON.stringify(before.rows[0]) !== JSON.stringify({ bootstrap_allowed: true, definer_allowed: false })) {
    throw new Error(`REGISTRATION_REPLAY_LEGACY_BOUNDARY_INVALID:${JSON.stringify(before.rows[0])}`);
  }
  await execute(database, await readFile(REGISTRATION_BOUNDARY_RECONCILE, 'utf8'), 'registration replay privileged boundary reconciliation');
  const after = await database.query(`select
    has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE') bootstrap_allowed,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed,
    has_function_privilege('shopmigration','deployment.is_independent_registration_database()','EXECUTE') migration_boundary_allowed`);
  if (
    JSON.stringify(after.rows[0]) !==
    JSON.stringify({
      bootstrap_allowed: true,
      definer_allowed: true,
      migration_boundary_allowed: true,
    })
  ) {
    throw new Error(`REGISTRATION_REPLAY_RECONCILED_BOUNDARY_INVALID:${JSON.stringify(after.rows[0])}`);
  }
}

async function stageFreshReplaySecrets(database) {
  await execute(
    database,
    `insert into runtime.vouchersecretstage(voucher_id,code_ciphertext,code_fingerprint,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(voucher_code,'sha256'),'base64'),encode(digest(lower(voucher_code),'sha256'),'hex'),'fixture-v1',created_at
    from public.vouchers on conflict(voucher_id) do nothing;
    insert into runtime.partneraddressstage(store_id,address_ciphertext,address_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(address_text,'sha256'),'base64'),encode(digest(lower(address_text),'sha256'),'hex'),'fixture-v1',created_at
    from public.stores where address_text is not null on conflict(store_id) do nothing;
    insert into runtime.distributorcontactstage(distributor_id,contact_ciphertext,contact_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(contact_json::text,'sha256'),'base64'),encode(digest(contact_json::text,'sha256'),'hex'),'fixture-v1',created_at
    from public.distributors where contact_json<>'{}'::jsonb on conflict(distributor_id) do nothing;`,
    'secure fixture stage'
  );
}

async function seedUnsafeInventoryCutover(database) {
  await execute(database, `do $$ begin update public.inventory set reserved_qty=greatest(reserved_qty,1); if not found then raise exception 'UNSAFE_INVENTORY_FIXTURE_MISSING'; end if; end $$;`, 'unsafe inventory fixture');
}

async function assertUnsafeInventoryCutoverRejected(database, sql) {
  try {
    await database.exec(sql);
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).includes('INVENTORY_CUTOVER_RECONCILIATION_REQUIRED')) throw error;
    if ((await database.query("select to_regclass('inventory.cutover_reviews') is not null as leaked")).rows[0].leaked) throw new Error('UNSAFE_INVENTORY_CUTOVER_PARTIAL_COMMIT');
    return;
  }
  throw new Error('UNSAFE_INVENTORY_CUTOVER_UNEXPECTEDLY_SUCCEEDED');
}

async function verifyTarget(database) {
  const operationContract = parse(await readFile(join(ROOT, 'packages', 'contract', 'definitions', 'operations.yml'), 'utf8'), { merge: true });
  const eventContract = parse(await readFile(join(ROOT, 'packages', 'contract', 'definitions', 'events.yml'), 'utf8'));
  const expectedOperations = Array.isArray(operationContract?.operations) ? operationContract.operations.length : -1;
  const expectedEvents = Array.isArray(eventContract?.events) ? eventContract.events.length : -1;
  const result = await database.query(`select
    (select count(*)::integer from runtime.operation) operations,
    (select count(*)::integer from runtime.event) events,
    (select count(*)::integer from pg_tables where schemaname='public') public_tables,
    (select count(*)::integer from supabase_migrations.schema_migrations) migrations`);
  const row = result.rows[0];
  if (row.operations !== expectedOperations || row.events !== expectedEvents || row.public_tables !== 0 || row.migrations !== migrationFiles.length) {
    const operationIds = operationContract.operations.map(({ id }) => id);
    const eventTypes = eventContract.events.map(({ id }) => id);
    const missingOperations = (await database.query('select expected id from unnest($1::text[]) expected where not exists(select 1 from runtime.operation actual where actual.id=expected) order by expected', [operationIds])).rows.map(
      ({ id }) => id
    );
    const extraOperations = (await database.query('select id from runtime.operation where not(id=any($1::text[])) order by id', [operationIds])).rows.map(({ id }) => id);
    const missingEvents = (await database.query('select expected type from unnest($1::text[]) expected where not exists(select 1 from runtime.event actual where actual.type=expected) order by expected', [eventTypes])).rows.map(
      ({ type }) => type
    );
    const extraEvents = (await database.query('select type from runtime.event where not(type=any($1::text[])) order by type', [eventTypes])).rows.map(({ type }) => type);
    throw new Error(`TARGET_CATALOG_INVALID:${JSON.stringify({ ...row, missingOperations, extraOperations, missingEvents, extraEvents })}`);
  }
  await verifyObjectContract(database);
  await verifyRls(database);
  await verifyAuditImmutability(database);
  await verifyMvpFusion(database);
  for (const contract of HARD_CUT_CONTRACTS) {
    await execute(database, await readFile(join(CONTRACTS, contract), 'utf8'), `hard-cut contract ${contract}`);
  }
}

async function seedProviderHardcutUpgrade(database) {
  const mappings = [
    ['private', 'supplier', 'local'],
    ['directcharge', 'charge', 'health'],
    ['tmallmarket', 'tmall', 'health'],
  ];
  for (const [legacy, replacement, health] of mappings) {
    const legacyContract = legacy + '.v1';
    const replacementContract = replacement + '.v1';
    const legacyManifest = providerManifest(legacy, legacyContract, health);
    const replacementManifest = providerManifest(replacement, replacementContract, health);
    await database.query(
      `insert into extension.contractversion(extension_id,contract_version,schema_hash,status) values
        ($1,$2,$3,'verified'),($4,$5,$6,'verified')`,
      [legacy, legacyContract, digest('contract:' + legacy), replacement, replacementContract, digest('contract:' + replacement)]
    );
    await database.query(
      `insert into extension.manifest(id,version,kind,contract_version,manifest,manifest_hash,signature,registered_at) values
        ($1,'1.0.0','channel',$2,$3::jsonb,$4,$5,clock_timestamp()),
        ($6,'1.0.0','channel',$7,$8::jsonb,$9,$5,clock_timestamp())`,
      [legacy, legacyContract, JSON.stringify(legacyManifest), digest('manifest:' + legacy), 'c2lnbmVkLW1hbmlmZXN0', replacement, replacementContract, JSON.stringify(replacementManifest), digest('manifest:' + replacement)]
    );
    const local = legacy === 'private';
    await database.query(
      `insert into extension.installation(id,extension_id,extension_version,scope_id,status,manifest,base_url,endpoints,secret_ref,health_operation,installed_at)
      values($1,$2,'1.0.0',$3,'enabled',$4::jsonb,$5,$6::jsonb,$7,$8,clock_timestamp())`,
      [
        'extension:hardcut:' + legacy,
        legacy,
        'scope:hardcut:' + legacy,
        JSON.stringify(legacyManifest),
        local ? null : 'https://' + legacy + '.example.invalid',
        local ? '{}' : '{"health":"/health"}',
        local ? null : 'provider/' + legacy,
        health,
      ]
    );
    await database.query(
      `insert into channel.connection(id,provider,scope_id,status,contract_version,secret_ref,configuration,
        connection_timeout_ms,response_timeout_ms,total_deadline_ms,max_concurrency,requests_per_second,max_attempts,
        failure_threshold,recovery_ms,region)
      values($1,$2,$3,'enabled',$4,$5,'{}',1000,3000,5000,2,10,2,3,1000,'cn-test')`,
      ['connection:hardcut:' + legacy, legacy, 'scope:hardcut:' + legacy, legacyContract, local ? null : 'provider/' + legacy]
    );
  }
}

function providerManifest(id, contractVersion, healthOperation) {
  return {
    id,
    kind: 'channel',
    version: '1.0.0',
    apiVersion: '2026-08-21',
    contractVersion,
    healthOperation,
    capabilities: ['Catalog'],
    permissions: [],
    configSchema: 'provider.' + id + '.v1',
    eventSubscriptions: [],
    secretRefs: healthOperation === 'local' ? [] : ['credential'],
    rateLimits: { requestsPerSecond: 10, maxConcurrency: 2 },
    timeout: { connectionMs: 1000, responseMs: 3000, totalMs: 5000 },
    retryPolicy: { maxAttempts: 2 },
    circuitPolicy: { failureThreshold: 3, recoveryMs: 1000 },
    webhookContract: null,
    signature: 'c2lnbmVkLW1hbmlmZXN0',
  };
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function verifyMvpFusion(database) {
  const result = await database.query(`select
    (select count(*)::integer from pg_tables where schemaname='referral' and tablename in(
      'setting','product','member','binding','commission','commissionmovement','recoverymovement','withdrawalclaim')) referral_tables,
    (select count(*)::integer from pg_tables where schemaname='finance' and tablename in('repairpreview','repair','repairmovement')) repair_tables,
    (select count(*)::integer from pg_tables where schemaname='ordering' and tablename='receipt') receipt_tables,
    (select count(*)::integer from runtime.mvpauthority) mvp_authorities,
    (select count(*)::integer from runtime.migrationevidence where migration='20260830150000'
      and source_rows=target_rows and source_rows>=9) hardcut_evidence,
    (select count(*)::integer from pg_constraint constraintinfo
      join pg_class source on source.oid=constraintinfo.conrelid join pg_namespace source_namespace on source_namespace.oid=source.relnamespace
      join pg_class target on target.oid=constraintinfo.confrelid join pg_namespace target_namespace on target_namespace.oid=target.relnamespace
      where constraintinfo.contype='f' and source_namespace.nspname='referral' and target_namespace.nspname<>'referral') referral_cross_fks,
    (select count(*)::integer from extension.installation where extension_id in('private','directcharge','tmallmarket')
      or manifest->>'id' in('private','directcharge','tmallmarket')) legacy_installations,
    (select count(*)::integer from extension.manifest where id in('private','directcharge','tmallmarket')) legacy_manifests,
    (select count(*)::integer from extension.registry where extension_id in('private','directcharge','tmallmarket')) legacy_registry,
    (select count(*)::integer from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace
      where namespace.nspname='channel' and procedure.proname in('private_enabled','pull_private_catalog','pull_private_stock',
        'submit_private_order','cancel_private_order','pull_private_tracking','submit_private_refund','build_private_statement')) legacy_functions,
    (select count(*)::integer from extension.installation where id like 'extension:hardcut:%'
      and extension_id in('supplier','charge','tmall') and manifest->>'id'=extension_id) migrated_installations,
    (select count(*)::integer from extension.registry where installation_id like 'extension:hardcut:%'
      and extension_id in('supplier','charge','tmall')) migrated_registry,
    (select count(*)::integer from channel.connection where id like 'connection:hardcut:%'
      and provider in('supplier','charge','tmall')) migrated_connections,
    (select count(*)::integer from finance.journal journal where journal.state='posted' and
      (select coalesce(sum(case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end),0)
       from finance.entry entry where entry.journal_id=journal.id)<>0) unbalanced_journals`);
  const row = result.rows[0];
  if (
    JSON.stringify(row) !==
    JSON.stringify({
      referral_tables: 8,
      repair_tables: 3,
      receipt_tables: 1,
      mvp_authorities: 5,
      hardcut_evidence: 1,
      referral_cross_fks: 0,
      legacy_installations: 0,
      legacy_manifests: 0,
      legacy_registry: 0,
      legacy_functions: 0,
      migrated_installations: 3,
      migrated_registry: 3,
      migrated_connections: 3,
      unbalanced_journals: 0,
    })
  ) {
    throw new Error(`MVP_FUSION_DATABASE_INVALID:${JSON.stringify(row)}`);
  }
}

async function verifyZhudatuanRuntimeReadinessRepair(database) {
  const contract = await database.query(`select checksum from runtime.schemaversion
    where version='20260821032000'`);
  if (contract.rows[0]?.checksum !== '83892ce3a42c15ab21703902380b63b6cc3352000d0c4c2a9df50b60347e383a') {
    throw new Error(`ZHUDATUAN_RUNTIME_CONTRACT_CHECKSUM_INVALID:${JSON.stringify(contract.rows)}`);
  }
  const expectations = [
    ['zhudatuanidentityapi', ['20260821032000', '20260821054000', '20260828170000']],
    ['zhudatuanidentityjob', ['20260821032000', '20260821054000', '20260828170000']],
    ['zhudatuanbootstrap', ['20260828170000']],
  ];
  for (const [role, versions] of expectations) {
    await database.exec(`begin; set local role ${role};`);
    try {
      const visible = await database.query('select array_agg(version order by version) versions from runtime.schemaversion');
      if (JSON.stringify(visible.rows[0]?.versions) !== JSON.stringify(versions)) {
        throw new Error(`ZHUDATUAN_SCHEMA_VERSION_RLS_INVALID:${role}:${JSON.stringify(visible.rows[0])}`);
      }
    } finally {
      await database.exec('rollback');
    }
  }
}

async function verifyZhudatuanBootstrapRuntimeRepair(database) {
  const canonicalOwnerRole = await database.query(`select id,scope_id,status from access.role
    where id='role-platform-owner-v2'`);
  if (
    JSON.stringify(canonicalOwnerRole.rows) !==
    JSON.stringify([
      {
        id: 'role-platform-owner-v2',
        scope_id: 'tenant-zhudatuan',
        status: 'active',
      },
    ])
  )
    throw new Error(`ZHUDATUAN_BOOTSTRAP_OWNER_ROLE_INVALID:${JSON.stringify(canonicalOwnerRole.rows)}`);
  await database.exec(`begin;
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version) values
      ('principal:bootstrap-rls-legacy','active',1,clock_timestamp(),clock_timestamp(),0),
      ('principal:bootstrap-rls-canonical','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version) values
      ('member:bootstrap-rls-legacy','principal:bootstrap-rls-legacy','Legacy RLS Fixture','active',clock_timestamp(),clock_timestamp(),0),
      ('member:bootstrap-rls-canonical','principal:bootstrap-rls-canonical','Canonical RLS Fixture','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at) values
      ('membership:bootstrap-rls-legacy','member:bootstrap-rls-legacy','mall-demo','storefront','active',1,clock_timestamp()),
      ('membership:bootstrap-rls-canonical','member:bootstrap-rls-canonical','mall-zhudatuan','storefront','active',1,clock_timestamp());
    insert into access.membershiprole(membership_id,role_id,effective_at) values
      ('membership:bootstrap-rls-legacy','role-zhudatuan-storefront-member',clock_timestamp()),
      ('membership:bootstrap-rls-canonical','role-zhudatuan-storefront-member',clock_timestamp());
    set local role zhudatuanbootstrap;`);
  try {
    const result = await database.query(`select
      has_table_privilege(current_user,'identity.principal','SELECT') principal_read,
      has_table_privilege(current_user,'access.membership','SELECT') membership_read,
      has_table_privilege(current_user,'access.membershiprole','SELECT') membership_role_read,
      has_table_privilege(current_user,'identity.invitation','SELECT,INSERT') invite_read_create,
      has_table_privilege(current_user,'identity.principal','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') principal_write,
      has_table_privilege(current_user,'access.membership','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') membership_write,
      has_table_privilege(current_user,'access.membershiprole','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') membership_role_write,
      has_table_privilege(current_user,'identity.invitation','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') invite_mutate,
      (select array_agg(id order by id) from access.role where id in(
        'role-platform-owner-v2','role-zhudatuan-storefront-member','role:self')) visible_roles,
      (select count(*)::integer from access.membershiprole assignment
        join access.membership membership on membership.id=assignment.membership_id
        where assignment.role_id='role-zhudatuan-storefront-member'
          and membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')) legacy_assignments,
      (select array_agg(membership_id order by membership_id) from access.membershiprole
        where membership_id in('membership:bootstrap-rls-legacy','membership:bootstrap-rls-canonical')) fixture_assignments,
      (select count(*)::integer from identity.invitation where status='active' and (
        id='invite-demo-employee-2026' or organization_id in('tenant-smart-wing','enterprise-demo','mall-demo'))) legacy_invites,
      (select count(*)::integer from identity.principal
        where id='principal:zhudatuan:owner:ethan:v1') fixed_owner_principals,
      (select count(*)::integer from access.membership
        where id='membership-platform-owner-ethan-v1'
          and organization_id='tenant-zhudatuan' and client='operator') fixed_owner_memberships`);
    const row = result.rows[0];
    if (
      JSON.stringify(row) !==
      JSON.stringify({
        principal_read: true,
        membership_read: true,
        membership_role_read: true,
        invite_read_create: true,
        principal_write: false,
        membership_write: false,
        membership_role_write: false,
        invite_mutate: false,
        visible_roles: ['role-platform-owner-v2', 'role-zhudatuan-storefront-member', 'role:self'],
        legacy_assignments: 1,
        fixture_assignments: ['membership:bootstrap-rls-legacy'],
        legacy_invites: 0,
        fixed_owner_principals: 0,
        fixed_owner_memberships: 0,
      })
    ) {
      const policies = await database.query(`select policyname,permissive,roles,qual from pg_policies
        where schemaname='access' and tablename='role' order by policyname`);
      throw new Error(`ZHUDATUAN_BOOTSTRAP_RUNTIME_ACCESS_INVALID:${JSON.stringify({ row, policies: policies.rows })}`);
    }
  } finally {
    await database.exec('rollback');
  }
  if (mode === '--registration-fresh') {
    const boundary = await database.query(`select
      has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE') bootstrap_allowed,
      has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed`);
    if (JSON.stringify(boundary.rows[0]) !== JSON.stringify({ bootstrap_allowed: true, definer_allowed: true })) {
      throw new Error(`ZHUDATUAN_BOOTSTRAP_DEFINER_BOUNDARY_INVALID:${JSON.stringify(boundary.rows[0])}`);
    }
  }
}

async function verifyZhudatuanPurchaseAccess(database) {
  await database.exec(`begin;
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values('principal:purchase-rls','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values('member:purchase-rls','principal:purchase-rls','Purchase RLS','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values('membership:purchase-rls','member:purchase-rls','mall-zhudatuan','storefront','active',1,clock_timestamp());
    insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,user_agent,
      device_label,assurance_level,expires_at,last_seen_at,created_at)
    values('session:purchase-rls','principal:purchase-rls','membership:purchase-rls','${'6'.repeat(64)}',1,1,
      'storefront','${'7'.repeat(64)}','purchase-rls','purchase-rls',1,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp());
    insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values
      ('risk:purchase-ancestor','tenant-zhudatuan','Purchase ancestor','draft',1,clock_timestamp()),
      ('risk:purchase-unrelated','scope:purchase-unrelated','Purchase unrelated','draft',1,clock_timestamp());
    set local role zhudatuanpurchaseapi;
    select set_config('app.membership_id','membership:purchase-rls',true),
      set_config('app.actor_id','principal:purchase-rls',true),set_config('app.scope_id','mall-zhudatuan',true);`);
  try {
    const scopes = await database.query(`select
      access.purchase_member_allowed('member:purchase-rls') member_allowed,
      access.purchase_mall_allowed('mall-zhudatuan') mall_allowed,
      access.purchase_risk_scope_allowed('tenant-zhudatuan') ancestor_allowed,
      access.purchase_risk_scope_allowed('scope:purchase-unrelated') unrelated_allowed,
      has_schema_privilege(current_user,'finance','USAGE') finance_usage,
      has_schema_privilege(current_user,'voucher','USAGE') voucher_usage`);
    if (
      JSON.stringify(scopes.rows[0]) !==
      JSON.stringify({
        member_allowed: true,
        mall_allowed: true,
        ancestor_allowed: true,
        unrelated_allowed: false,
        finance_usage: false,
        voucher_usage: false,
      })
    )
      throw new Error(`ZHUDATUAN_PURCHASE_SCOPE_INVALID:${JSON.stringify(scopes.rows[0])}`);
    const visible = await database.query("select array_agg(id order by id) ids from risk.policy where id like 'risk:purchase-%'");
    if (JSON.stringify(visible.rows[0]?.ids) !== JSON.stringify(['risk:purchase-ancestor'])) {
      throw new Error(`ZHUDATUAN_PURCHASE_RISK_RLS_INVALID:${JSON.stringify(visible.rows[0])}`);
    }
    for (const expression of [
      "access.purchase_member_scope('membership:purchase-rls','session:purchase-rls')",
      "benefit.purchase_available('membership:purchase-rls','session:purchase-rls',array['benefit:none']::text[])",
      "benefit.purchase_reserve('membership:purchase-rls','session:purchase-rls','order:guard','member:purchase-rls',array['benefit:none']::text[],array[1]::bigint[])",
    ]) {
      await database.exec('savepoint direct_purchase_session_guard');
      let rejected = false;
      try {
        await database.query(`select * from ${expression}`);
      } catch (error) {
        rejected = String(error instanceof Error ? error.message : error).includes('PURCHASE_SESSION_INVALID');
      }
      await database.exec('rollback to savepoint direct_purchase_session_guard');
      if (!rejected) throw new Error(`ZHUDATUAN_PURCHASE_SET_ROLE_HELPER_ALLOWED:${expression}`);
    }
  } finally {
    await database.exec('rollback');
  }
}

async function verifyZhudatuanWebBusinessAccess(database) {
  await database.exec(`begin;
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values('principal:web-business-rls','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values('member:web-business-rls','principal:web-business-rls','Web Business RLS','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values('membership:web-business-rls','member:web-business-rls','mall-zhudatuan','storefront','active',1,clock_timestamp());
    insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,user_agent,
      device_label,assurance_level,expires_at,last_seen_at,created_at)
    values('session:web-business-rls','principal:web-business-rls','membership:web-business-rls','${'4'.repeat(64)}',1,1,
      'storefront','${'5'.repeat(64)}','web-business-rls','web-business-rls',1,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp());
    insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values
      ('risk:web-business-ancestor','tenant-zhudatuan','Web ancestor','draft',1,clock_timestamp()),
      ('risk:web-business-unrelated','scope:web-business-unrelated','Web unrelated','draft',1,clock_timestamp());
    insert into access.decisionaudit(id,actor_id,operation,resource_id,scope_id,decision,reason,policy_version,trace_id,decided_at) values
      ('decision:web-business-member','principal:web-business-rls','member.profile.read',null,'member:web-business-rls','allow','fixture','1','trace:web-business-member',clock_timestamp()),
      ('decision:web-business-ancestor','principal:web-business-rls','catalog.listings.read',null,'tenant-zhudatuan','allow','fixture','1','trace:web-business-ancestor',clock_timestamp()),
      ('decision:web-business-unrelated','principal:web-business-rls','catalog.listings.read',null,'scope:web-business-unrelated','allow','fixture','1','trace:web-business-unrelated',clock_timestamp()),
      ('decision:web-business-other-actor','principal:web-business-other','catalog.listings.read',null,'tenant-zhudatuan','allow','fixture','1','trace:web-business-other',clock_timestamp());
    set local role zhudatuanwebapi;
    select set_config('app.membership_id','membership:web-business-rls',true),
      set_config('app.actor_id','principal:web-business-rls',true),set_config('app.scope_id','mall-zhudatuan',true);`);
  try {
    const scopes = await database.query(`select
      access.web_scope_allowed('tenant-zhudatuan') business_ancestor,
      access.web_risk_scope_allowed('member:web-business-rls') risk_member,
      access.web_risk_scope_allowed('mall-zhudatuan') risk_mall,
      access.web_risk_scope_allowed('tenant-zhudatuan') risk_ancestor,
      access.web_risk_scope_allowed('scope:web-business-unrelated') risk_unrelated`);
    if (
      JSON.stringify(scopes.rows[0]) !==
      JSON.stringify({
        business_ancestor: false,
        risk_member: true,
        risk_mall: true,
        risk_ancestor: true,
        risk_unrelated: false,
      })
    ) {
      throw new Error(`ZHUDATUAN_WEB_RISK_SCOPE_INVALID:${JSON.stringify(scopes.rows[0])}`);
    }
    const visible = await database.query("select array_agg(id order by id) ids from risk.policy where id like 'risk:web-business-%'");
    if (JSON.stringify(visible.rows[0]?.ids) !== JSON.stringify(['risk:web-business-ancestor'])) {
      throw new Error(`ZHUDATUAN_WEB_RISK_RLS_INVALID:${JSON.stringify(visible.rows[0])}`);
    }
    const decisions = await database.query("select array_agg(id order by id) ids from access.decisionaudit where id like 'decision:web-business-%'");
    if (JSON.stringify(decisions.rows[0]?.ids) !== JSON.stringify(['decision:web-business-ancestor', 'decision:web-business-member'])) {
      throw new Error(`ZHUDATUAN_WEB_DECISION_VELOCITY_RLS_INVALID:${JSON.stringify(decisions.rows[0])}`);
    }
    for (const expression of [
      "access.web_member_scope('membership:web-business-rls','session:web-business-rls')",
      "access.web_storefront_scope('membership:web-business-rls','session:web-business-rls')",
      "benefit.web_account_balance('membership:web-business-rls','session:web-business-rls')",
    ]) {
      await database.exec('savepoint direct_session_guard');
      let rejected = false;
      try {
        await database.query(`select * from ${expression}`);
      } catch (error) {
        rejected = String(error instanceof Error ? error.message : error).includes('WEB_');
      }
      await database.exec('rollback to savepoint direct_session_guard');
      if (!rejected) throw new Error(`ZHUDATUAN_WEB_SET_ROLE_HELPER_ALLOWED:${expression}`);
    }
  } finally {
    await database.exec('rollback');
  }
}

async function verifyZhudatuanRegistrationBaseline(database) {
  const beforeReplay = await zhudatuanRegistrationFingerprint(database);
  const baseline = await database.query(`select
    (select count(*)::integer from organization.organization
      where id in('tenant-zhudatuan','enterprise-zhudatuan','mall-zhudatuan') and status='active') organizations,
    (select count(*)::integer from identity.registrationpolicy
      where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp())) active_policies,
    (select count(*)::integer from identity.registrationpolicy
      where id='registration:zhudatuan:2026-08-28-v1'
        and terms_hash='207450deff7c7baece6af24957ff48adf3393532a5d37b6f8d369370253e557d'
        and retired_at is null) canonical_policy,
    (select count(*)::integer from identity.invitation
      where status='active' and (id='invite-demo-employee-2026'
        or organization_id in('tenant-smart-wing','enterprise-demo','mall-demo'))) legacy_invites,
    (select count(*)::integer from access.membership membership join member.profile profile on profile.id=membership.member_id
      join identity.principal principal on principal.id=profile.principal_id
      where membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
        and (membership.status in('active','invited') or profile.status='active' or principal.status='active')) legacy_employee_assignments,
    (select count(*)::integer from access.role
      where id='role-zhudatuan-storefront-member' and scope_id='mall-zhudatuan' and status='active') employee_role,
    (select count(*)::integer from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role-zhudatuan-storefront-member' and mapping.effect='allow' and permission.code in(
        'catalog.listing.read','pricing.offer.read','inventory.read','cart.read','cart.manage','checkout.create','order.create',
        'order.read','order.aftersale.apply','payment.create','benefit.read','voucher.binding.read','support.case.create',
        'observability.clienterror.create')) employee_permissions,
    (select count(*)::integer from audit.record
      where id='audit:zhudatuan:registration-baseline:v1' and action='identity.registration.baseline.established') audit_records`);
  const row = baseline.rows[0];
  if (JSON.stringify(row) !== JSON.stringify({ organizations: 3, active_policies: 1, canonical_policy: 1, legacy_invites: 0, legacy_employee_assignments: 0, employee_role: 1, employee_permissions: 14, audit_records: 1 })) {
    throw new Error(`ZHUDATUAN_REGISTRATION_BASELINE_INVALID:${JSON.stringify(row)}`);
  }
  await verifyPhoneAssuranceRevocation(database);
  await execute(database, await readFile(join(MIGRATIONS, '20260828170000_zhudatuan_registration_baseline.sql'), 'utf8'), 'idempotent zhudatuan registration baseline replay');
  const afterReplay = await zhudatuanRegistrationFingerprint(database);
  if (JSON.stringify(afterReplay) !== JSON.stringify(beforeReplay)) {
    throw new Error(`ZHUDATUAN_REGISTRATION_BASELINE_NOT_IDEMPOTENT:${JSON.stringify({ beforeReplay, afterReplay })}`);
  }
  // The historical baseline intentionally recreates its original policies.
  // Restore the immutable forward repair before any current-head ACL checks.
  const bootstrapRepair = await readFile(join(MIGRATIONS, REGISTRATION_BOOTSTRAP_REPAIR), 'utf8');
  await execute(database, omitExactEnvironmentAssertion(bootstrapRepair, REGISTRATION_BOOTSTRAP_REPLAY_FUTURE_HEAD_ASSERTION, REGISTRATION_BOOTSTRAP_REPAIR), 'idempotent zhudatuan registration bootstrap repair replay');
  await execute(database, await readFile(join(MIGRATIONS, '20260829054500_zhudatuan_identity_login_acl_repair.sql'), 'utf8'), 'idempotent zhudatuan identity login ACL repair replay');
}

async function verifyPhoneAssuranceRevocation(database) {
  const token = '7'.repeat(64);
  await database.exec(`begin;
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values('principal:registration-assurance-replay','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values('member:registration-assurance-replay','principal:registration-assurance-replay','Assurance Replay','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values('membership:registration-assurance-replay','member:registration-assurance-replay','mall-zhudatuan','storefront','active',1,clock_timestamp());
    insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,user_agent,
      device_label,assurance_level,expires_at,last_seen_at,created_at)
    values('session:registration-assurance-replay','principal:registration-assurance-replay','membership:registration-assurance-replay',
      '${token}',1,1,'storefront','${'8'.repeat(64)}','fresh-replay','fresh-replay',2,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp());
    insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
    values('assurance:registration-assurance-replay','principal:registration-assurance-replay','phone_otp',2,'${'9'.repeat(64)}',
      clock_timestamp(),clock_timestamp()+interval '1 hour');`);
  try {
    const active = await database.query('select assurance_level from identity.resolve_session($1)', [token]);
    if (active.rows[0]?.assurance_level !== 2) throw new Error(`PHONE_ASSURANCE_ACTIVE_INVALID:${JSON.stringify(active.rows)}`);
    await database.query("update identity.assurance set expires_at=clock_timestamp() where id='assurance:registration-assurance-replay'");
    const expired = await database.query('select assurance_level from identity.resolve_session($1)', [token]);
    if (expired.rows[0]?.assurance_level !== 1) throw new Error(`PHONE_ASSURANCE_REVOCATION_INVALID:${JSON.stringify(expired.rows)}`);
  } finally {
    await database.exec('rollback');
  }
}

async function zhudatuanRegistrationFingerprint(database) {
  const result = await database.query(`select
    (select coalesce(sum(version),0)::text from organization.organization
      where id in('tenant-zhudatuan','enterprise-zhudatuan','mall-zhudatuan')) organization_versions,
    (select coalesce(sum(version),0)::text from identity.registrationpolicy
      where id in('registration:2026-08-13','registration:zhudatuan:2026-08-28-v1')) policy_versions,
    (select coalesce(sum(version),0)::text from access.role where id='role-zhudatuan-storefront-member') role_versions,
    (select coalesce(sum(version),0)::text from identity.invitation
      where id='invite-demo-employee-2026') legacy_invitation_versions,
    (select count(*)::integer from audit.record where id like 'audit:zhudatuan:registration-baseline:%') audit_records,
    (select count(*)::integer from access.membership membership join member.profile profile on profile.id=membership.member_id
      join identity.principal principal on principal.id=profile.principal_id
      where membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
        and (membership.status in('active','invited') or profile.status='active' or principal.status='active')) unexpired_legacy_assignments`);
  return result.rows[0];
}

async function verifyExtensionLifecycle(database) {
  const hash = 'c'.repeat(64);
  const manifest = JSON.stringify({
    id: 'replayprovider',
    kind: 'channel',
    version: '1.0.0',
    apiVersion: '2026-08-21',
    contractVersion: 'replay.v1',
    healthOperation: 'local',
    capabilities: ['Catalog'],
    permissions: [],
    configSchema: 'replay.v1',
    eventSubscriptions: [],
    secretRefs: [],
    limits: { connectionTimeoutMs: 1, responseTimeoutMs: 1, totalDeadlineMs: 1, maxConcurrency: 1, requestsPerSecond: 1, maxAttempts: 1, failureThreshold: 1, recoveryMs: 100 },
    signature: 'c2lnbmVk',
  });
  await database.query(
    `insert into extension.manifest(id,version,kind,contract_version,manifest,manifest_hash,signature,registered_at)
    values('replayprovider','1.0.0','channel','replay.v1',$1::jsonb,$2,'c2lnbmVk',clock_timestamp());`,
    [manifest, hash]
  );
  await database.exec(`insert into extension.contractversion(extension_id,contract_version,schema_hash,status)
    values('replayprovider','replay.v1','${hash}','verified');
    insert into extension.installation(id,extension_id,extension_version,scope_id,status,manifest,base_url,endpoints,secret_ref,health_operation,installed_at)
    values('extension:replay-active','replayprovider','1.0.0','rls-scope-a','enabled','${manifest}'::jsonb,'https://replay.invalid','{"local":"/health"}','secret/replay','local',clock_timestamp()),
      ('extension:replay-candidate','replayprovider','1.0.0','rls-scope-a','testing','${manifest}'::jsonb,'https://replay.invalid','{"local":"/health"}','secret/replay','local',clock_timestamp());`);
  let uniqueRejected = false;
  try {
    await database.exec("update extension.installation set status='enabled' where id='extension:replay-candidate'");
  } catch (error) {
    if (
      !String(error instanceof Error ? error.message : error)
        .toLowerCase()
        .includes('unique')
    )
      throw error;
    uniqueRejected = true;
  }
  if (!uniqueRejected) throw new Error('EXTENSION_SINGLE_ACTIVE_CONSTRAINT_MISSING');
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),
    set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','extension-auditor',true);`);
  const visible = await database.query("select id from extension.load_installation('extension:replay-candidate','rls-scope-a')");
  const manifestVisible = await database.query("select count(*)::integer count from extension.manifest where id='replayprovider'");
  await database.exec('commit');
  if (visible.rows[0]?.id !== 'extension:replay-candidate' || manifestVisible.rows[0]?.count !== 1) throw new Error('EXTENSION_SCOPE_POLICY_INVALID');
  let mutationRejected = false;
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true);`);
  try {
    await database.query("update extension.manifest set signature='forged' where id='replayprovider'");
  } catch (error) {
    if (
      !String(error instanceof Error ? error.message : error)
        .toLowerCase()
        .includes('permission')
    )
      throw error;
    mutationRejected = true;
  }
  await database.exec('rollback');
  if (!mutationRejected) throw new Error('EXTENSION_MANIFEST_MUTATION_ALLOWED');
}

async function verifyAuditImmutability(database) {
  const hash = 'b'.repeat(64);
  await database.exec(`insert into audit.record(id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,
    evidence,trace_id,previous_hash,record_hash,recorded_at) values('audit:immutability','organization-platform-root','audit-test','system',
    'audit.test','audit','audit:immutability',null,null,'{}','audit:test',null,'${hash}',clock_timestamp());`);
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),
    set_config('app.scope_id','organization-platform-root',true);`);
  let rejected = false;
  let changed = 0;
  try {
    changed = (await database.query("update audit.record set action='mutated' where id='audit:immutability'")).rowCount ?? 0;
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).includes('AUDIT_IMMUTABLE')) throw error;
    rejected = true;
  }
  await database.exec('rollback');
  if (!rejected && changed !== 0) throw new Error('AUDIT_UPDATE_WAS_NOT_REJECTED');
  const unchanged = await database.query("select action from audit.record where id='audit:immutability'");
  if (unchanged.rows[0]?.action !== 'audit.test') throw new Error('AUDIT_UPDATE_IMMUTABILITY_INVALID');
  await database.exec(`begin; set local role shopjob; select set_config('app.workload','jobs',true);`);
  let deleteRejected = false;
  try {
    await database.query("delete from audit.record where id='audit:immutability'");
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).includes('AUDIT_IMMUTABLE')) throw error;
    deleteRejected = true;
  }
  await database.exec('rollback');
  const retained = await database.query("select count(*)::integer count from audit.record where id='audit:immutability'");
  if (!deleteRejected || retained.rows[0]?.count !== 1) throw new Error('AUDIT_PHYSICAL_DELETE_NOT_REJECTED');
}

async function verifyRls(database) {
  await database.exec(`insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values
    ('rls-policy-a','rls-scope-a','RLS A','draft',1,clock_timestamp()),('rls-policy-b','rls-scope-b','RLS B','draft',1,clock_timestamp());`);
  await database.exec(`begin; set local role shopapp;
    select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','rls-auditor',true);`);
  const visible = await database.query("select array_agg(id order by id) ids from risk.policy where id like 'rls-policy-%'");
  await database.exec('commit');
  if (JSON.stringify(visible.rows[0]?.ids) !== JSON.stringify(['rls-policy-a'])) throw new Error('RLS_SCOPE_READ_ISOLATION_INVALID');
  await database.exec(`begin; set local role shopapp;
    select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','rls-auditor',true);`);
  try {
    await database.query("insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values('rls-policy-forbidden','rls-scope-b','forbidden','draft',1,clock_timestamp())");
  } catch (error) {
    await database.exec('rollback');
    if (
      !String(error instanceof Error ? error.message : error)
        .toLowerCase()
        .includes('row-level security')
    )
      throw error;
    return;
  }
  await database.exec('rollback');
  throw new Error('RLS_SCOPE_WRITE_ISOLATION_INVALID');
}

async function verifyObjectContract(database) {
  const contract = parse(await readFile(OBJECTS, 'utf8'));
  const entries = Array.isArray(contract?.objects) ? contract.objects : [];
  const schemas = entries
    .filter((entry) => entry.kind === 'schema')
    .map((entry) => entry.id)
    .sort();
  const expected = new Map([
    ['schema', new Set(schemas)],
    ['table', new Set(entries.filter((entry) => entry.kind === 'table').map((entry) => entry.id))],
    ['view', new Set(entries.filter((entry) => entry.kind === 'view').map((entry) => entry.id))],
    ['function', new Set(entries.filter((entry) => entry.kind === 'function').map((entry) => entry.id))],
    ['trigger', new Set(entries.filter((entry) => entry.kind === 'trigger').map((entry) => entry.id))],
    ['policy', new Set(entries.filter((entry) => entry.kind === 'policy').map((entry) => entry.id))],
  ]);
  const schemaRows = await database.query(
    `select namespace.nspname id,namespace.nspowner::regrole::text owner
    from pg_namespace namespace where namespace.nspname=any($1::text[])`,
    [schemas]
  );
  const tableRows = await database.query(
    `select namespace.nspname||'.'||relation.relname id,relation.relrowsecurity rls,relation.relowner::regrole::text owner
    from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname=any($1::text[]) and relation.relkind in('r','p')`,
    [schemas]
  );
  const viewRows = await database.query(
    `select namespace.nspname||'.'||relation.relname id,relation.relowner::regrole::text owner from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname=any($1::text[]) and relation.relkind in('v','m')`,
    [schemas]
  );
  const functionRows = await database.query(
    `select namespace.nspname||'.'||procedure.proname id,replace(procedure.oid::regprocedure::text,' ','') signature,
      procedure.proowner::regrole::text owner from pg_proc procedure
    join pg_namespace namespace on namespace.oid=procedure.pronamespace where namespace.nspname=any($1::text[])`,
    [schemas]
  );
  const triggerRows = await database.query(
    `select namespace.nspname||'.'||relation.relname||'.'||trigger.tgname id from pg_trigger trigger
    join pg_class relation on relation.oid=trigger.tgrelid join pg_namespace namespace on namespace.oid=relation.relnamespace
    where not trigger.tgisinternal and namespace.nspname=any($1::text[])`,
    [schemas]
  );
  const policyRows = await database.query(`select schemaname||'.'||tablename||'.'||policyname id from pg_policies where schemaname=any($1::text[])`, [schemas]);
  const ownership = new Map([
    ...schemaRows.rows.map((row) => [`schema:${row.id}`, row.owner]),
    ...tableRows.rows.map((row) => [`table:${row.id}`, row.owner]),
    ...viewRows.rows.map((row) => [`view:${row.id}`, row.owner]),
    ...functionRows.rows.map((row) => [`function:${row.signature}`, row.owner]),
  ]);
  expected.set(
    'grant',
    new Set(
      entries
        .filter((entry) => entry.kind === 'grant')
        .filter((entry) => ownership.get(`${entry.objectType}:${entry.target}`) !== entry.role)
        .map((entry) => entry.id)
    )
  );
  compareSet(
    'schema',
    expected.get('schema'),
    schemaRows.rows.map((row) => row.id)
  );
  compareSet(
    'table',
    expected.get('table'),
    tableRows.rows.map((row) => row.id)
  );
  compareSet(
    'view',
    expected.get('view'),
    viewRows.rows.map((row) => row.id)
  );
  compareSet(
    'function',
    expected.get('function'),
    functionRows.rows.map((row) => row.id)
  );
  compareSet(
    'trigger',
    expected.get('trigger'),
    triggerRows.rows.map((row) => row.id)
  );
  compareSet(
    'policy',
    expected.get('policy'),
    policyRows.rows.map((row) => row.id)
  );
  if (tableRows.rows.some((row) => !row.rls)) throw new Error('DATABASE_OBJECT_RLS_DRIFT');

  const roleRows = await database.query(
    `with roles(role) as (values('shopapp'),('shopjob'),('shopmigration'),('shopread')),
    table_privilege(privilege) as (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')),
    schema_privilege(privilege) as (values('USAGE'),('CREATE')),
    schemas as (select namespace.nspname schema,namespace.nspowner::regrole::text owner
      from pg_namespace namespace where namespace.nspname=any($1::text[])),
    tables as (select schemaname,tablename,tableowner owner from pg_tables where schemaname=any($1::text[])),
    views as (select schemaname,viewname,viewowner owner from pg_views where schemaname=any($1::text[])),
    functions as (select procedure.oid,procedure.oid::regprocedure::text signature,procedure.proowner::regrole::text owner
      from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace where namespace.nspname=any($1::text[]))
    select role||':schema:'||schema||':'||lower(privilege) id from roles cross join schemas cross join schema_privilege
      where role<>owner and has_schema_privilege(role,schema,privilege)
    union all
    select role||':table:'||schemaname||'.'||tablename||':'||lower(privilege) from roles cross join tables cross join table_privilege
      where role<>owner and has_table_privilege(role,schemaname||'.'||tablename,privilege)
    union all
    select role||':view:'||schemaname||'.'||viewname||':'||lower(privilege) from roles cross join views cross join table_privilege
      where role<>owner and has_table_privilege(role,schemaname||'.'||viewname,privilege)
    union all
    select role||':function:'||replace(signature,' ','')||':execute' from roles cross join functions
      where role<>owner and has_function_privilege(role,oid,'EXECUTE')`,
    [schemas]
  );
  compareSet(
    'grant',
    expected.get('grant'),
    roleRows.rows.map((row) => row.id)
  );
}

function compareSet(kind, expected, actualValues) {
  const actual = new Set(actualValues);
  const missing = [...expected].filter((value) => !actual.has(value)).sort();
  const extra = [...actual].filter((value) => !expected.has(value)).sort();
  if (missing.length || extra.length) throw new Error(`DATABASE_OBJECT_${kind.toUpperCase()}_DRIFT:${JSON.stringify({ missing, extra })}`);
}
