import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { Client } from 'pg';
import { parse } from 'yaml';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { verifyFinanceAccountingIntegrity } from './finance-accounting-integrity.mjs';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { verifyFinanceAccountingIntegrity } from './finance-accounting-integrity.mjs';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const ROOT = repositoryRoot;
const MIGRATIONS = join(ROOT, 'database', 'supabase', 'migrations');
const HISTORY = join(ROOT, 'database', 'contracts', 'history.json');
const OBJECTS = join(ROOT, 'database', 'contracts', 'objects.yml');
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
const REGISTRATION_MIGRATION_RUNNER = join(ROOT, 'services', 'commerce', 'src', 'foundation', 'infrastructure', 'RegistrationMigrationRunner.ts');
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
const REGISTRATION_MIGRATION_RUNNER = join(ROOT, 'services', 'commerce', 'src', 'foundation', 'infrastructure', 'RegistrationMigrationRunner.ts');
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
const BOOTSTRAP = '20260817191000_bootstrap_ethan_platform_owner.sql';
const INVENTORY_CUTOVER = '20260820133000_inventory_single_source_cutover.sql';
const SECURE_STAGE = '20260821026000_backfill_domain_data.sql';
const REPAIR_FILES = [
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  '20260821010000_assert_source_head.sql',
  '20260821011000_create_domain_schemas.sql',
  '20260821012000_create_runtime_control.sql',
  '20260821013000_create_identity_access.sql',
  '20260821014000_create_organization_partner.sql',
  '20260821015000_create_capability_member.sql',
  '20260821016000_create_qualification.sql',
  '20260821017000_create_catalog_pricing.sql',
  '20260821018000_create_inventory_experience.sql',
  '20260821019000_create_cart_checkout_order.sql',
  '20260821020000_create_fulfillment_verification.sql',
  '20260821021000_create_payment_voucher_benefit.sql',
  '20260821022000_create_finance_channel.sql',
  '20260821023000_create_support_notification.sql',
  '20260821024000_create_reporting_risk_audit.sql',
  '20260821025000_create_extension.sql',
  '20260821026000_backfill_domain_data.sql',
  '20260821027000_reconcile_domain_data.sql',
  '20260821028000_build_domain_indexes.sql',
  '20260821029000_publish_domain_contract.sql',
  '20260821030000_revoke_public_access.sql',
  '20260821031000_drop_legacy_objects.sql',
  '20260821032000_assert_target_head.sql',
  '20260821033000_complete_experience_publication.sql',
  '20260821034000_add_storefront_offer_read.sql',
  '20260821035000_add_auth_ticket_exchange.sql',
  '20260821036000_add_invitation_terms_read.sql',
  '20260821037000_add_member_journey.sql',
  '20260821038000_add_keyset_indexes.sql',
  '20260821039000_checkout_atomic_order.sql',
  '20260821040000_payment_recovery.sql',
  '20260821041000_voucher_lifecycle.sql',
  '20260821042000_benefit_lifecycle.sql',
<<<<<<< HEAD
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  '20260821010000_assert_source_head.sql','20260821011000_create_domain_schemas.sql','20260821012000_create_runtime_control.sql',
  '20260821013000_create_identity_access.sql','20260821014000_create_organization_partner.sql','20260821015000_create_capability_member.sql',
  '20260821016000_create_qualification.sql','20260821017000_create_catalog_pricing.sql','20260821018000_create_inventory_experience.sql',
  '20260821019000_create_cart_checkout_order.sql','20260821020000_create_fulfillment_verification.sql','20260821021000_create_payment_voucher_benefit.sql',
  '20260821022000_create_finance_channel.sql','20260821023000_create_support_notification.sql','20260821024000_create_reporting_risk_audit.sql',
  '20260821025000_create_extension.sql','20260821026000_backfill_domain_data.sql','20260821027000_reconcile_domain_data.sql',
  '20260821028000_build_domain_indexes.sql','20260821029000_publish_domain_contract.sql','20260821030000_revoke_public_access.sql',
  '20260821031000_drop_legacy_objects.sql','20260821032000_assert_target_head.sql','20260821033000_complete_experience_publication.sql',
  '20260821034000_add_storefront_offer_read.sql','20260821035000_add_auth_ticket_exchange.sql',
  '20260821036000_add_invitation_terms_read.sql','20260821037000_add_member_journey.sql','20260821038000_add_keyset_indexes.sql',
  '20260821039000_checkout_atomic_order.sql','20260821040000_payment_recovery.sql','20260821041000_voucher_lifecycle.sql','20260821042000_benefit_lifecycle.sql',
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  '20260821043000_finance_lifecycle.sql',
  '20260821044000_channel_lifecycle.sql',
  '20260821045000_channel_scope_mapping.sql',
  '20260821046000_support_lifecycle.sql',
  '20260821047000_notification_lifecycle.sql',
  '20260821048000_reporting_lifecycle.sql',
  '20260821049000_risk_lifecycle.sql',
  '20260821050000_audit_lifecycle.sql',
  '20260821051000_extension_lifecycle.sql',
  '20260821052000_import_lifecycle.sql',
  '20260821053000_complete_batch_imports.sql',
  '20260821054000_move_membership_owner.sql',
  '20260821055000_isolate_wechat_payment_applications.sql',
  '20260821056000_authorize_member_data_scope.sql',
  '20260821057000_resolve_payment_webhook_scope.sql',
  '20260821058000_align_member_operations.sql',
  '20260821059000_reconcile_contract_head.sql',
  '20260821060000_rebind_membership_functions.sql',
  '20260821061000_normalize_membership_scopes.sql',
  '20260821062000_publish_error_contract.sql',
  '20260821063000_finalize_error_contract.sql',
  '20260821064000_add_client_error_telemetry.sql',
  '20260821065000_add_invitation_lifecycle.sql',
  '20260821066000_resolve_invitation_scope.sql',
  '20260821067000_add_session_management.sql',
  '20260821068000_add_member_benefit_ledger.sql',
  '20260821069000_add_store_management.sql',
  '20260821070000_repair_decision_audit_scope.sql',
  '20260821071000_grant_store_administration.sql',
  '20260821072000_add_console_member_commands.sql',
  '20260821073000_publish_console_contract.sql',
  '20260821074000_grant_platform_owner_operations.sql',
  '20260821075000_grant_platform_cardlibrary_read.sql',
  '20260821076000_grant_platform_cockpit_reads.sql',
  '20260821077000_add_reporting_cockpit.sql',
  '20260821078000_complete_experience_application.sql',
  '20260821079000_resolve_experience_version_scope.sql',
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  '20260821080000_restore_member_scope_authorization.sql',
  '20260828091000_finance_reconciliation_integrity.sql',
  '20260828092000_finance_security_boundaries.sql',
  '20260828093000_finance_accounting_integrity.sql',
  '20260828094000_finance_invoice_issue_integrity.sql',
  '20260828095000_payment_provider_time_evidence.sql',
  '20260828100000_finance_reconciliation_repair_workflow.sql',
  '20260828170000_zhudatuan_registration_baseline.sql',
  '20260828173000_zhudatuan_web_business_access.sql',
  '20260828180000_zhudatuan_purchase_access.sql',
  '20260828183000_zhudatuan_runtime_readiness_repair.sql',
  '20260829040000_zhudatuan_registration_bootstrap_runtime_repair.sql',
  '20260829054500_zhudatuan_identity_login_acl_repair.sql',
  '20260829060000_zhudatuan_operator_invitation_registration.sql',
  '20260829105000_create_referral_foundation.sql',
  '20260829190000_reconcile_runtime_contract_head.sql',
  '20260829200000_owner_identity_reset_foundation.sql',
  '20260829201000_reconcile_current_contract_checksum.sql',
  '20260829210000_owner_operator_coverage.sql',
  '20260829211000_platform_owner_transfer.sql',
  '20260829212000_owner_runtime_boundary_hardening.sql',
  '20260829213000_reconcile_contract_identity_checksum.sql',
  '20260829214000_owner_personal_scope_and_invoice_scope.sql',
  '20260829215000_restore_invoice_request_operator_boundary.sql',
  '20260829216000_owner_capability_exactness.sql',
  '20260829217000_scope_hint_resource_precedence.sql',
  '20260830100000_finance_configurable_policy_workflow.sql',
  '20260830101000_console_support_boundary.sql',
  '20260830102000_grant_runtime_digest.sql',
  '20260830103000_identity_runtime_contract_visibility.sql',
  '20260830104000_business_runtime_role_matrix.sql',
  '20260830105000_business_runtime_schema_visibility.sql',
  '20260831100000_identity_finance_read_boundary.sql',
  '20260831110000_identity_distribution_channel_voucher_read_boundary.sql',
  '20260831120000_identity_reporting_read_boundary.sql',
  '20260831130000_identity_console_tail_read_boundary.sql',
  '20260831140000_identity_registration_profile_acl_repair.sql',
<<<<<<< HEAD
];

const mode = process.argv[2];
if (!['--check-inventory', '--schema-fresh', '--environment-bootstrap', '--inventory-cutover-unsafe', '--postgres-fresh', '--mvp-kernel'].includes(mode)) {
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  '20260821080000_restore_member_scope_authorization.sql',
>>>>>>> 65499ddc (chore: finalize main baseline and restore API boundaries)
];

const mode = process.argv[2];
if (!['--check-inventory','--schema-fresh','--environment-bootstrap','--inventory-cutover-unsafe','--postgres-fresh','--mvp-kernel'].includes(mode)) {
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
];

const mode = process.argv[2];
if (!['--check-inventory', '--schema-fresh', '--environment-bootstrap', '--inventory-cutover-unsafe', '--postgres-fresh', '--mvp-kernel'].includes(mode)) {
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  throw new Error('usage: database-contracts.mjs --check-inventory|--schema-fresh|--environment-bootstrap|--inventory-cutover-unsafe|--postgres-fresh|--mvp-kernel [URL]');
}
const replayRole = mode === '--postgres-fresh' ? process.argv[4] : undefined;
if (replayRole !== undefined && !/^[a-z][a-z0-9_]{2,62}$/.test(replayRole)) throw new Error('POSTGRES_FRESH_ROLE_INVALID');

const migrationFiles = (await readdir(MIGRATIONS)).filter((name) => name.endsWith('.sql')).sort();
await verifyInventory(migrationFiles);
if (mode === '--check-inventory') {
  console.log(`migration inventory ok: historical=94 repair=${REPAIR_FILES.length} total=${migrationFiles.length}`);
  process.exit(0);
}

const database = await openDatabase();
try {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  await execute(
    database,
    `
    create role anon nologin noinherit; create role authenticated nologin noinherit; create role service_role nologin noinherit;
  `,
    'database role bootstrap'
  );
<<<<<<< HEAD
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
    if (name === BOOTSTRAP) await seedBootstrapPrecondition(database);
    if (name === '20260829200000_owner_identity_reset_foundation.sql') await seedOwnerBoundaryFixture(database);
    if (mode === '--inventory-cutover-unsafe' && name === INVENTORY_CUTOVER) {
      await seedUnsafeInventoryCutover(database);
      await assertUnsafeInventoryCutoverRejected(database, await readFile(join(MIGRATIONS, name), 'utf8'));
=======
  await execute(database, `
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
  `, 'database role bootstrap');
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
    if (name === BOOTSTRAP) await seedBootstrapPrecondition(database);
    if (name === '20260829200000_owner_identity_reset_foundation.sql') await seedOwnerBoundaryFixture(database);
    if (mode === '--inventory-cutover-unsafe' && name === INVENTORY_CUTOVER) {
      await seedUnsafeInventoryCutover(database);
<<<<<<< HEAD
      await assertUnsafeInventoryCutoverRejected(database, await readFile(join(MIGRATIONS,name),'utf8'));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      await assertUnsafeInventoryCutoverRejected(database, await readFile(join(MIGRATIONS, name), 'utf8'));
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  await execute(database, `
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
  `, 'database role bootstrap');
  if (replayRole !== undefined) await execute(database, `set role "${replayRole}"`, 'database migration role');
  await execute(database, `
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
  `, 'database bootstrap');
  let applied = 0;
  for (const name of migrationFiles) {
    if (name === BOOTSTRAP) await seedBootstrapPrecondition(database);
    if (mode === '--inventory-cutover-unsafe' && name === INVENTORY_CUTOVER) {
      await seedUnsafeInventoryCutover(database);
      await assertUnsafeInventoryCutoverRejected(database, await readFile(join(MIGRATIONS,name),'utf8'));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      console.log(`unsafe inventory cutover rejected atomically: migrations_before_cutover=${applied}`);
      process.exitCode = 0;
      break;
    }
    if (name === SECURE_STAGE) await stageFreshReplaySecrets(database);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    await execute(database, await readFile(join(MIGRATIONS, name), 'utf8'), `migration ${name}`);
    await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0, 14), name]);
=======
    await execute(database, await readFile(join(MIGRATIONS,name),'utf8'), `migration ${name}`);
    await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0,14),name]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    await execute(database, await readFile(join(MIGRATIONS, name), 'utf8'), `migration ${name}`);
    await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0, 14), name]);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    await execute(database, await readFile(join(MIGRATIONS,name),'utf8'), `migration ${name}`);
    await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0,14),name]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    applied += 1;
  }
  if (mode !== '--inventory-cutover-unsafe') {
    await verifyTarget(database);
    if (mode === '--mvp-kernel') {
      const { verifyMvpKernel } = await import('./mvp-kernel.mjs');
      await verifyMvpKernel(database);
    }
    console.log(`target schema replay passed: migrations=${applied} historical=94 repair=${REPAIR_FILES.length}`);
  }
} finally {
  await database.close();
}

async function openDatabase() {
  if (mode !== '--postgres-fresh') return new PGlite({ extensions: { pgcrypto } });
  const connectionString = process.argv[3];
  if (connectionString !== undefined && !/^postgres(?:ql)?:\/\//.test(connectionString)) throw new Error('POSTGRES_FRESH_URL_INVALID');
  const client = new Client({ ...(connectionString === undefined ? {} : { connectionString }), connectionTimeoutMillis: 5_000, statement_timeout: 120_000 });
  await client.connect();
  return Object.freeze({
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    exec: async (sql) => {
      await client.query(sql);
    },
=======
    exec: async (sql) => { await client.query(sql); },
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    exec: async (sql) => {
      await client.query(sql);
    },
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    exec: async (sql) => { await client.query(sql); },
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    query: (sql, parameters) => client.query(sql, parameters),
    close: () => client.end(),
  });
}

async function verifyInventory(files) {
  const duplicates = duplicateVersions(files);
  if (duplicates.size) throw new Error(`duplicate migration versions: ${JSON.stringify([...duplicates])}`);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const history = JSON.parse(await readFile(HISTORY, 'utf8'));
  if (history.algorithm !== 'sha256' || history.count !== 94 || history.migrations.length !== 94) throw new Error('HISTORICAL_MIGRATION_MANIFEST_INVALID');
  const historical = files.filter((name) => name.slice(0, 14) <= history.head);
  if (JSON.stringify(historical) !== JSON.stringify(history.migrations.map((item) => item.file))) throw new Error('HISTORICAL_MIGRATION_FILESET_DRIFT');
<<<<<<< HEAD
  for (const item of history.migrations) {
    const digest = createHash('sha256')
      .update(await readFile(join(MIGRATIONS, item.file)))
      .digest('hex');
    if (digest !== item.sha256) throw new Error(`HISTORICAL_MIGRATION_HASH_DRIFT:${item.file}`);
  }
  const repair = files.filter((name) => name.slice(0, 14) > history.head);
  if (JSON.stringify(repair) !== JSON.stringify(REPAIR_FILES)) throw new Error(`REPAIR_MIGRATION_SEQUENCE_DRIFT:${JSON.stringify(repair)}`);
  const targetFile = files.at(-1);
  const targetVersion = targetFile?.slice(0, 14);
  const targetSource = targetFile ? await readFile(join(MIGRATIONS, targetFile), 'utf8') : '';
  const targetMarker = targetSource.match(new RegExp(`values\\('${targetVersion}','([a-f0-9]{64})'\\)`))?.[1];
  if (!targetFile || !targetVersion || !targetMarker) throw new Error('REGISTRATION_MIGRATION_TARGET_INVALID');
  const normalizedTargetDigest = createHash('sha256').update(targetSource.replaceAll(targetMarker, '0'.repeat(64))).digest('hex');
  if (normalizedTargetDigest !== targetMarker) throw new Error(`REGISTRATION_MIGRATION_TARGET_DIGEST_DRIFT:${targetFile}`);
  const runner = await readFile(REGISTRATION_MIGRATION_RUNNER, 'utf8');
  if (!runner.includes(`REGISTRATION_TARGET_VERSION = '${targetVersion}'`)
    || !runner.includes(`REGISTRATION_TARGET_CHECKSUM = '${targetMarker}'`)
    || !runner.includes(`name='${targetFile}'`)) throw new Error(`REGISTRATION_MIGRATION_RUNNER_TARGET_DRIFT:${targetFile}`);
  await readFile(OBJECTS, 'utf8').catch(() => {
    throw new Error('DATABASE_OBJECT_CONTRACT_MISSING');
  });
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  const history = JSON.parse(await readFile(HISTORY,'utf8'));
  if (history.algorithm!=='sha256' || history.count!==94 || history.migrations.length!==94) throw new Error('HISTORICAL_MIGRATION_MANIFEST_INVALID');
  const historical = files.filter((name)=>name.slice(0,14)<=history.head);
  if (JSON.stringify(historical)!==JSON.stringify(history.migrations.map((item)=>item.file))) throw new Error('HISTORICAL_MIGRATION_FILESET_DRIFT');
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  for (const item of history.migrations) {
    const digest = createHash('sha256')
      .update(await readFile(join(MIGRATIONS, item.file)))
      .digest('hex');
    if (digest !== item.sha256) throw new Error(`HISTORICAL_MIGRATION_HASH_DRIFT:${item.file}`);
  }
<<<<<<< HEAD
  const repair = files.filter((name)=>name.slice(0,14)>history.head);
  if (JSON.stringify(repair)!==JSON.stringify(REPAIR_FILES)) throw new Error(`REPAIR_MIGRATION_SEQUENCE_DRIFT:${JSON.stringify(repair)}`);
  await readFile(OBJECTS,'utf8').catch(()=>{ throw new Error('DATABASE_OBJECT_CONTRACT_MISSING'); });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const repair = files.filter((name) => name.slice(0, 14) > history.head);
  if (JSON.stringify(repair) !== JSON.stringify(REPAIR_FILES)) throw new Error(`REPAIR_MIGRATION_SEQUENCE_DRIFT:${JSON.stringify(repair)}`);
  const targetFile = files.at(-1);
  const targetVersion = targetFile?.slice(0, 14);
  const targetSource = targetFile ? await readFile(join(MIGRATIONS, targetFile), 'utf8') : '';
  const targetMarker = targetSource.match(new RegExp(`values\\('${targetVersion}','([a-f0-9]{64})'\\)`))?.[1];
  if (!targetFile || !targetVersion || !targetMarker) throw new Error('REGISTRATION_MIGRATION_TARGET_INVALID');
  const normalizedTargetDigest = createHash('sha256').update(targetSource.replaceAll(targetMarker, '0'.repeat(64))).digest('hex');
  if (normalizedTargetDigest !== targetMarker) throw new Error(`REGISTRATION_MIGRATION_TARGET_DIGEST_DRIFT:${targetFile}`);
  const runner = await readFile(REGISTRATION_MIGRATION_RUNNER, 'utf8');
  if (!runner.includes(`REGISTRATION_TARGET_VERSION = '${targetVersion}'`)
    || !runner.includes(`REGISTRATION_TARGET_CHECKSUM = '${targetMarker}'`)
    || !runner.includes(`name='${targetFile}'`)) throw new Error(`REGISTRATION_MIGRATION_RUNNER_TARGET_DRIFT:${targetFile}`);
  await readFile(OBJECTS, 'utf8').catch(() => {
    throw new Error('DATABASE_OBJECT_CONTRACT_MISSING');
  });
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  for (const item of history.migrations) {
    const digest = createHash('sha256').update(await readFile(join(MIGRATIONS,item.file))).digest('hex');
    if (digest!==item.sha256) throw new Error(`HISTORICAL_MIGRATION_HASH_DRIFT:${item.file}`);
  }
  const repair = files.filter((name)=>name.slice(0,14)>history.head);
  if (JSON.stringify(repair)!==JSON.stringify(REPAIR_FILES)) throw new Error(`REPAIR_MIGRATION_SEQUENCE_DRIFT:${JSON.stringify(repair)}`);
  await readFile(OBJECTS,'utf8').catch(()=>{ throw new Error('DATABASE_OBJECT_CONTRACT_MISSING'); });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

function duplicateVersions(files) {
  const versions = new Map();
  for (const file of files) {
    const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file);
    if (!match) throw new Error(`INVALID_MIGRATION_FILENAME:${file}`);
    const existing = versions.get(match[1]) ?? [];
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    existing.push(file);
    versions.set(match[1], existing);
  }
  return new Map([...versions].filter(([, names]) => names.length > 1));
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

async function seedOwnerBoundaryFixture(database) {
  await execute(database, `
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values('principal:zhudatuan:owner:ethan:v1','active',1,clock_timestamp(),clock_timestamp(),0)
    on conflict(id) do update set status='active';
    insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,rotated_at,created_at)
    values('credential:password:zhudatuan-owner-ethan:v1','principal:zhudatuan:owner:ethan:v1','password',
      encode(digest('fresh-replay-owner','sha256'),'hex'),'fixture-owner-secret','active',clock_timestamp(),clock_timestamp())
    on conflict(id) do update set status='active';
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values('member:zhudatuan:owner:ethan:v1','principal:zhudatuan:owner:ethan:v1','Fresh Replay Owner','active',clock_timestamp(),clock_timestamp(),0)
    on conflict(id) do update set status='active',principal_id=excluded.principal_id;
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values('membership-platform-owner-ethan-v1','member:zhudatuan:owner:ethan:v1','tenant-zhudatuan','operator','active',1,clock_timestamp())
    on conflict(id) do update set member_id=excluded.member_id,organization_id=excluded.organization_id,client='operator',status='active';
    delete from access.membershiprole where membership_id='membership-platform-owner-ethan-v1'
      and role_id in('role-platform-owner-v2','role:self');
    insert into access.membershiprole(membership_id,role_id,effective_at) values
      ('membership-platform-owner-ethan-v1','role-platform-owner-v2','1970-01-01T00:00:00Z'),
      ('membership-platform-owner-ethan-v1','role:self','1970-01-01T00:00:00Z');
    insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
      ('scope:membership-platform-owner-ethan-v1:platform','membership-platform-owner-ethan-v1','platform','organization-platform-root','organization-platform-root','allow','1970-01-01T00:00:00Z',1),
      ('scope:membership-platform-owner-ethan-v1:tenant','membership-platform-owner-ethan-v1','tenant','tenant-zhudatuan','tenant-zhudatuan','allow','1970-01-01T00:00:00Z',1),
      ('scope:membership-platform-owner-ethan-v1:self','membership-platform-owner-ethan-v1','self','self:principal:zhudatuan:owner:ethan:v1','self:principal:zhudatuan:owner:ethan:v1','allow','1970-01-01T00:00:00Z',1)
    on conflict do nothing;
    do $$ begin
      if not exists(select 1 from access.membership membership join access.membershiprole assignment
        on assignment.membership_id=membership.id and assignment.role_id='role-platform-owner-v2'
        where membership.id='membership-platform-owner-ethan-v1' and membership.status='active'
          and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))
      then raise exception 'OWNER_BOUNDARY_FIXTURE_SEED_FAILED'; end if;
    end $$;`, 'owner boundary fixture');
}

async function stageFreshReplaySecrets(database) {
  await execute(
    database,
    `insert into runtime.vouchersecretstage(voucher_id,code_ciphertext,code_fingerprint,key_version,staged_at)
=======
    existing.push(file); versions.set(match[1],existing);
=======
    existing.push(file);
    versions.set(match[1], existing);
>>>>>>> 018b2a71 (chore(release): capture current production source)
  }
  return new Map([...versions].filter(([, names]) => names.length > 1));
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

async function seedOwnerBoundaryFixture(database) {
  await execute(database, `
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values('principal:zhudatuan:owner:ethan:v1','active',1,clock_timestamp(),clock_timestamp(),0)
    on conflict(id) do update set status='active';
    insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,rotated_at,created_at)
    values('credential:password:zhudatuan-owner-ethan:v1','principal:zhudatuan:owner:ethan:v1','password',
      encode(digest('fresh-replay-owner','sha256'),'hex'),'fixture-owner-secret','active',clock_timestamp(),clock_timestamp())
    on conflict(id) do update set status='active';
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values('member:zhudatuan:owner:ethan:v1','principal:zhudatuan:owner:ethan:v1','Fresh Replay Owner','active',clock_timestamp(),clock_timestamp(),0)
    on conflict(id) do update set status='active',principal_id=excluded.principal_id;
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values('membership-platform-owner-ethan-v1','member:zhudatuan:owner:ethan:v1','tenant-zhudatuan','operator','active',1,clock_timestamp())
    on conflict(id) do update set member_id=excluded.member_id,organization_id=excluded.organization_id,client='operator',status='active';
    delete from access.membershiprole where membership_id='membership-platform-owner-ethan-v1'
      and role_id in('role-platform-owner-v2','role:self');
    insert into access.membershiprole(membership_id,role_id,effective_at) values
      ('membership-platform-owner-ethan-v1','role-platform-owner-v2','1970-01-01T00:00:00Z'),
      ('membership-platform-owner-ethan-v1','role:self','1970-01-01T00:00:00Z');
    insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
      ('scope:membership-platform-owner-ethan-v1:platform','membership-platform-owner-ethan-v1','platform','organization-platform-root','organization-platform-root','allow','1970-01-01T00:00:00Z',1),
      ('scope:membership-platform-owner-ethan-v1:tenant','membership-platform-owner-ethan-v1','tenant','tenant-zhudatuan','tenant-zhudatuan','allow','1970-01-01T00:00:00Z',1),
      ('scope:membership-platform-owner-ethan-v1:self','membership-platform-owner-ethan-v1','self','self:principal:zhudatuan:owner:ethan:v1','self:principal:zhudatuan:owner:ethan:v1','allow','1970-01-01T00:00:00Z',1)
    on conflict do nothing;
    do $$ begin
      if not exists(select 1 from access.membership membership join access.membershiprole assignment
        on assignment.membership_id=membership.id and assignment.role_id='role-platform-owner-v2'
        where membership.id='membership-platform-owner-ethan-v1' and membership.status='active'
          and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))
      then raise exception 'OWNER_BOUNDARY_FIXTURE_SEED_FAILED'; end if;
    end $$;`, 'owner boundary fixture');
}

async function stageFreshReplaySecrets(database) {
<<<<<<< HEAD
  await execute(database, `insert into runtime.vouchersecretstage(voucher_id,code_ciphertext,code_fingerprint,key_version,staged_at)
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  await execute(
    database,
    `insert into runtime.vouchersecretstage(voucher_id,code_ciphertext,code_fingerprint,key_version,staged_at)
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    existing.push(file); versions.set(match[1],existing);
  }
  return new Map([...versions].filter(([,names])=>names.length>1));
}

async function execute(database,sql,label) {
  try { await database.exec(sql); }
  catch (error) { throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`,{cause:error}); }
}

async function seedBootstrapPrecondition(database) {
  await execute(database, `insert into public.users(id,tenant_id,enterprise_id,department_id,employee_no,display_name,email,status)
    values('user-fresh-replay-ethan','tenant-smart-wing','enterprise-demo','department-digital','SW_FRESH_REPLAY_ETHAN','Fresh Replay Ethan','fresh-replay@example.invalid','active');
    insert into public.members(id,user_id,primary_identifier,status) values('member-fresh-replay-ethan','user-fresh-replay-ethan','local_username:ethan','active');
    insert into public.member_login_aliases(provider,subject,member_id) values('local_username','ethan','member-fresh-replay-ethan');`,'bootstrap precondition');
}

async function stageFreshReplaySecrets(database) {
  await execute(database, `insert into runtime.vouchersecretstage(voucher_id,code_ciphertext,code_fingerprint,key_version,staged_at)
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    select id,'fixturekms:v1:'||encode(digest(voucher_code,'sha256'),'base64'),encode(digest(lower(voucher_code),'sha256'),'hex'),'fixture-v1',created_at
    from public.vouchers on conflict(voucher_id) do nothing;
    insert into runtime.partneraddressstage(store_id,address_ciphertext,address_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(address_text,'sha256'),'base64'),encode(digest(lower(address_text),'sha256'),'hex'),'fixture-v1',created_at
    from public.stores where address_text is not null on conflict(store_id) do nothing;
    insert into runtime.distributorcontactstage(distributor_id,contact_ciphertext,contact_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(contact_json::text,'sha256'),'base64'),encode(digest(contact_json::text,'sha256'),'hex'),'fixture-v1',created_at
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
    from public.distributors where contact_json<>'{}'::jsonb on conflict(distributor_id) do nothing;`,'secure fixture stage');
=======
    from public.distributors where contact_json<>'{}'::jsonb on conflict(distributor_id) do nothing;`,
    'secure fixture stage'
  );
>>>>>>> 018b2a71 (chore(release): capture current production source)
}

async function seedUnsafeInventoryCutover(database) {
  await execute(database, `do $$ begin update public.inventory set reserved_qty=greatest(reserved_qty,1); if not found then raise exception 'UNSAFE_INVENTORY_FIXTURE_MISSING'; end if; end $$;`, 'unsafe inventory fixture');
}

<<<<<<< HEAD
=======
    from public.distributors where contact_json<>'{}'::jsonb on conflict(distributor_id) do nothing;`,'secure fixture stage');
}

async function seedUnsafeInventoryCutover(database) {
  await execute(database, `do $$ begin update public.inventory set reserved_qty=greatest(reserved_qty,1); if not found then raise exception 'UNSAFE_INVENTORY_FIXTURE_MISSING'; end if; end $$;`,'unsafe inventory fixture');
}

>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
async function assertUnsafeInventoryCutoverRejected(database,sql) {
  try { await database.exec(sql); }
  catch (error) {
    if (!String(error instanceof Error?error.message:error).includes('INVENTORY_CUTOVER_RECONCILIATION_REQUIRED')) throw error;
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
async function assertUnsafeInventoryCutoverRejected(database, sql) {
  try {
    await database.exec(sql);
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).includes('INVENTORY_CUTOVER_RECONCILIATION_REQUIRED')) throw error;
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    if ((await database.query("select to_regclass('inventory.cutover_reviews') is not null as leaked")).rows[0].leaked) throw new Error('UNSAFE_INVENTORY_CUTOVER_PARTIAL_COMMIT');
    return;
  }
  throw new Error('UNSAFE_INVENTORY_CUTOVER_UNEXPECTEDLY_SUCCEEDED');
}

async function verifyTarget(database) {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  const operationContract = parse(await readFile(join(ROOT, 'packages', 'contract', 'definitions', 'operations.yml'), 'utf8'));
  const eventContract = parse(await readFile(join(ROOT, 'packages', 'contract', 'definitions', 'events.yml'), 'utf8'));
=======
  const operationContract = parse(await readFile(join(ROOT,'packages','contract','definitions','operations.yml'),'utf8'));
  const eventContract = parse(await readFile(join(ROOT,'packages','contract','definitions','events.yml'),'utf8'));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const operationContract = parse(await readFile(join(ROOT, 'packages', 'contract', 'definitions', 'operations.yml'), 'utf8'));
  const eventContract = parse(await readFile(join(ROOT, 'packages', 'contract', 'definitions', 'events.yml'), 'utf8'));
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  const operationContract = parse(await readFile(join(ROOT,'packages','contract','definitions','operations.yml'),'utf8'));
  const eventContract = parse(await readFile(join(ROOT,'packages','contract','definitions','events.yml'),'utf8'));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  const expectedOperations = Array.isArray(operationContract?.operations) ? operationContract.operations.length : -1;
  const expectedEvents = Array.isArray(eventContract?.events) ? eventContract.events.length : -1;
  const result = await database.query(`select
    (select count(*)::integer from runtime.operation) operations,
    (select count(*)::integer from runtime.event) events,
    (select count(*)::integer from pg_tables where schemaname='public') public_tables,
    (select count(*)::integer from supabase_migrations.schema_migrations) migrations`);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  const row = result.rows[0];
  if (row.operations !== expectedOperations || row.events !== expectedEvents || row.public_tables !== 0 || row.migrations !== migrationFiles.length) throw new Error(`TARGET_CATALOG_INVALID:${JSON.stringify(row)}`);
  await verifyFinanceAccountingIntegrity(database);
  await verifyObjectContract(database);
  await verifyRls(database);
  await verifyRuntimeSchemaVisibility(database);
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  const row=result.rows[0];
  if (row.operations!==expectedOperations || row.events!==expectedEvents || row.public_tables!==0 || row.migrations!==migrationFiles.length) throw new Error(`TARGET_CATALOG_INVALID:${JSON.stringify(row)}`);
  await verifyObjectContract(database);
  await verifyRls(database);
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const row = result.rows[0];
  if (row.operations !== expectedOperations || row.events !== expectedEvents || row.public_tables !== 0 || row.migrations !== migrationFiles.length) throw new Error(`TARGET_CATALOG_INVALID:${JSON.stringify(row)}`);
  await verifyFinanceAccountingIntegrity(database);
  await verifyObjectContract(database);
  await verifyRls(database);
  await verifyRuntimeSchemaVisibility(database);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  await verifyAuditImmutability(database);
  await verifyExperiencePublication(database);
  await verifyExtensionLifecycle(database);
}

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
async function verifyRuntimeSchemaVisibility(database) {
  const expectations = new Map([
    ['zhudatuanidentityapi', ['20260821032000', '20260821054000', '20260828170000', '20260829060000']],
    ['zhudatuanidentityjob', ['20260821032000', '20260821054000', '20260828170000']],
    ['zhudatuanwebapi', ['20260821032000', '20260821054000', '20260828170000', '20260828173000', '20260828180000']],
    ['zhudatuanpurchaseapi', ['20260821032000', '20260821054000', '20260828170000', '20260828173000', '20260828180000']],
  ]);
  for (const [role, expectedVersions] of expectations) {
    await database.exec(`begin; set local role ${role};`);
    try {
      const visible = await database.query('select version,checksum from runtime.schemaversion order by version');
      const versions = visible.rows.map((row) => row.version);
      const contract = visible.rows.find((row) => row.version === '20260821032000');
      if (JSON.stringify(versions) !== JSON.stringify(expectedVersions)
        || contract?.checksum !== 'd7e499c9530d8c7ab46cfb4bc30b4ad17cd39a9c16b9d444ac4a1927f25eae79') {
        throw new Error(`RUNTIME_SCHEMA_VISIBILITY_INVALID:${role}:${JSON.stringify(visible.rows)}`);
      }
    } finally {
      await database.exec('rollback');
    }
  }
}

<<<<<<< HEAD
async function verifyExtensionLifecycle(database) {
  const hash = 'c'.repeat(64);
  const manifest = JSON.stringify({
    id: 'replayprovider',
    kind: 'channel',
    priority: 1,
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
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
async function verifyExtensionLifecycle(database) {
  const hash='c'.repeat(64);
  const manifest=JSON.stringify({id:'replayprovider',kind:'channel',priority:1,version:'1.0.0',apiVersion:'2026-08-21',
    contractVersion:'replay.v1',healthOperation:'local',capabilities:['Catalog'],permissions:[],configSchema:'replay.v1',
    eventSubscriptions:[],secretRefs:[],limits:{connectionTimeoutMs:1,responseTimeoutMs:1,totalDeadlineMs:1,maxConcurrency:1,
      requestsPerSecond:1,maxAttempts:1,failureThreshold:1,recoveryMs:100},signature:'c2lnbmVk'});
  await database.query(`insert into extension.manifest(id,version,kind,contract_version,manifest,manifest_hash,signature,registered_at)
    values('replayprovider','1.0.0','channel','replay.v1',$1::jsonb,$2,'c2lnbmVk',clock_timestamp());`,[manifest,hash]);
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
async function verifyExtensionLifecycle(database) {
  const hash = 'c'.repeat(64);
  const manifest = JSON.stringify({
    id: 'replayprovider',
    kind: 'channel',
    priority: 1,
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
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  await database.exec(`insert into extension.contractversion(extension_id,contract_version,schema_hash,status)
    values('replayprovider','replay.v1','${hash}','verified');
    insert into extension.installation(id,extension_id,extension_version,scope_id,status,manifest,base_url,endpoints,secret_ref,health_operation,installed_at)
    values('extension:replay-active','replayprovider','1.0.0','rls-scope-a','enabled','${manifest}'::jsonb,'https://replay.invalid','{"local":"/health"}','secret/replay','local',clock_timestamp()),
      ('extension:replay-candidate','replayprovider','1.0.0','rls-scope-a','testing','${manifest}'::jsonb,'https://replay.invalid','{"local":"/health"}','secret/replay','local',clock_timestamp());`);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
<<<<<<< HEAD
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
=======
  let uniqueRejected=false;
  try { await database.exec("update extension.installation set status='enabled' where id='extension:replay-candidate'"); }
  catch (error) { if (!String(error instanceof Error?error.message:error).toLowerCase().includes('unique')) throw error; uniqueRejected=true; }
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  if (!uniqueRejected) throw new Error('EXTENSION_SINGLE_ACTIVE_CONSTRAINT_MISSING');
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),
    set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','extension-auditor',true);`);
  const visible = await database.query("select id from extension.load_installation('extension:replay-candidate','rls-scope-a')");
  const manifestVisible = await database.query("select count(*)::integer count from extension.manifest where id='replayprovider'");
  await database.exec('commit');
  if (visible.rows[0]?.id !== 'extension:replay-candidate' || manifestVisible.rows[0]?.count !== 1) throw new Error('EXTENSION_SCOPE_POLICY_INVALID');
  let mutationRejected = false;
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true);`);
<<<<<<< HEAD
  try { await database.query("update extension.manifest set signature='forged' where id='replayprovider'"); }
  catch (error) { if (!String(error instanceof Error?error.message:error).toLowerCase().includes('permission')) throw error; mutationRejected=true; }
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
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
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  let uniqueRejected=false;
  try { await database.exec("update extension.installation set status='enabled' where id='extension:replay-candidate'"); }
  catch (error) { if (!String(error instanceof Error?error.message:error).toLowerCase().includes('unique')) throw error; uniqueRejected=true; }
  if (!uniqueRejected) throw new Error('EXTENSION_SINGLE_ACTIVE_CONSTRAINT_MISSING');
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),
    set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','extension-auditor',true);`);
  const visible=await database.query("select id from extension.load_installation('extension:replay-candidate','rls-scope-a')");
  const manifestVisible=await database.query("select count(*)::integer count from extension.manifest where id='replayprovider'");
  await database.exec('commit');
  if (visible.rows[0]?.id!=='extension:replay-candidate' || manifestVisible.rows[0]?.count!==1) throw new Error('EXTENSION_SCOPE_POLICY_INVALID');
  let mutationRejected=false;
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true);`);
  try { await database.query("update extension.manifest set signature='forged' where id='replayprovider'"); }
  catch (error) { if (!String(error instanceof Error?error.message:error).toLowerCase().includes('permission')) throw error; mutationRejected=true; }
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  await database.exec('rollback');
  if (!mutationRejected) throw new Error('EXTENSION_MANIFEST_MUTATION_ALLOWED');
}

async function verifyAuditImmutability(database) {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  const hash = 'b'.repeat(64);
=======
  const hash='b'.repeat(64);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const hash = 'b'.repeat(64);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  const hash='b'.repeat(64);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  await database.exec(`insert into audit.record(id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,
    evidence,trace_id,previous_hash,record_hash,recorded_at) values('audit:immutability','organization-platform-root','audit-test','system',
    'audit.test','audit','audit:immutability',null,null,'{}','audit:test',null,'${hash}',clock_timestamp());`);
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),
    set_config('app.scope_id','organization-platform-root',true);`);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  let rejected = false;
  let changed = 0;
  try {
    changed = (await database.query("update audit.record set action='mutated' where id='audit:immutability'")).rowCount ?? 0;
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).includes('AUDIT_IMMUTABLE')) throw error;
    rejected = true;
<<<<<<< HEAD
  }
  await database.exec('rollback');
  if (!rejected && changed !== 0) throw new Error('AUDIT_UPDATE_WAS_NOT_REJECTED');
  const unchanged = await database.query("select action from audit.record where id='audit:immutability'");
  if (unchanged.rows[0]?.action !== 'audit.test') throw new Error('AUDIT_UPDATE_IMMUTABILITY_INVALID');
  await database.exec(`begin; set local role shopjob; select set_config('app.workload','jobs',true),set_config('app.audit_archive','true',true);
    delete from audit.record where id='audit:immutability'; commit;`);
  const deleted = await database.query("select count(*)::integer count from audit.record where id='audit:immutability'");
  if (deleted.rows[0]?.count !== 0) throw new Error('AUDIT_ARCHIVE_DELETE_INVALID');
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  let rejected=false; let changed=0;
  try { changed=(await database.query("update audit.record set action='mutated' where id='audit:immutability'")).rowCount ?? 0; }
  catch (error) {
    if (!String(error instanceof Error?error.message:error).includes('AUDIT_IMMUTABLE')) throw error;
    rejected=true;
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  }
  await database.exec('rollback');
  if (!rejected && changed !== 0) throw new Error('AUDIT_UPDATE_WAS_NOT_REJECTED');
  const unchanged = await database.query("select action from audit.record where id='audit:immutability'");
  if (unchanged.rows[0]?.action !== 'audit.test') throw new Error('AUDIT_UPDATE_IMMUTABILITY_INVALID');
  await database.exec(`begin; set local role shopjob; select set_config('app.workload','jobs',true),set_config('app.audit_archive','true',true);
    delete from audit.record where id='audit:immutability'; commit;`);
<<<<<<< HEAD
  const deleted=await database.query("select count(*)::integer count from audit.record where id='audit:immutability'");
  if (deleted.rows[0]?.count!==0) throw new Error('AUDIT_ARCHIVE_DELETE_INVALID');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const deleted = await database.query("select count(*)::integer count from audit.record where id='audit:immutability'");
  if (deleted.rows[0]?.count !== 0) throw new Error('AUDIT_ARCHIVE_DELETE_INVALID');
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  }
  await database.exec('rollback');
  if (!rejected && changed!==0) throw new Error('AUDIT_UPDATE_WAS_NOT_REJECTED');
  const unchanged=await database.query("select action from audit.record where id='audit:immutability'");
  if (unchanged.rows[0]?.action!=='audit.test') throw new Error('AUDIT_UPDATE_IMMUTABILITY_INVALID');
  await database.exec(`begin; set local role shopjob; select set_config('app.workload','jobs',true),set_config('app.audit_archive','true',true);
    delete from audit.record where id='audit:immutability'; commit;`);
  const deleted=await database.query("select count(*)::integer count from audit.record where id='audit:immutability'");
  if (deleted.rows[0]?.count!==0) throw new Error('AUDIT_ARCHIVE_DELETE_INVALID');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

async function verifyExperiencePublication(database) {
  const hash = 'a'.repeat(64);
  await database.exec(`insert into experience.application(id,scope_id,code,public_slug,name,status,created_at,updated_at) values
    ('application:publication-audit','scope-publication-audit','PUBLICATION_AUDIT','publication-audit','Publication audit','active',clock_timestamp(),clock_timestamp());
    insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at) values
    ('version:publication-audit','application:publication-audit',1,'2','{"version":2,"application":"application:publication-audit","pages":[{"id":"home","path":"/","blocks":[]}]}',
      '${hash}','valid','publication audit fixture','audit',clock_timestamp());
    update experience.application set head_version_id='version:publication-audit' where id='application:publication-audit';
    insert into experience.release(id,application_id,version_id,state,effective_at,published_by) values
    ('release:publication-audit','application:publication-audit','version:publication-audit','active',clock_timestamp(),'audit');
    insert into experience.binding(application_id,domain,mall_id,pool_id) values
    ('application:publication-audit','audit.invalid','mall:publication-audit','pool:publication-audit');
    insert into experience.publication(id,release_id,application_id,version_id,content_hash,object_key,object_ref,object_hash,object_size,state,staged_at,published_at) values
    ('publication:audit','release:publication-audit','application:publication-audit','version:publication-audit','${hash}',
      'experience/application:publication-audit/${hash}.json','object:publication-audit','${hash}',1,'active',clock_timestamp(),clock_timestamp());`);
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),set_config('app.scope_id','public:experience',true);`);
  const direct = await database.query("select count(*)::integer count from experience.publication where id='publication:audit'");
  const published = await database.query("select release,version,hash,object_key from experience.read_published('mall:publication-audit')");
  await database.exec('commit');
  if (direct.rows[0]?.count !== 0 || published.rows[0]?.release !== 'release:publication-audit' || published.rows[0]?.hash !== hash) {
    throw new Error('EXPERIENCE_PUBLICATION_SECURITY_INVALID');
  }
}

async function verifyRls(database) {
  await database.exec(`insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values
    ('rls-policy-a','rls-scope-a','RLS A','draft',1,clock_timestamp()),('rls-policy-b','rls-scope-b','RLS B','draft',1,clock_timestamp());`);
  await database.exec(`begin; set local role shopapp;
    select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','rls-auditor',true);`);
  const visible = await database.query("select array_agg(id order by id) ids from risk.policy where id like 'rls-policy-%'");
  await database.exec('commit');
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  if (JSON.stringify(visible.rows[0]?.ids) !== JSON.stringify(['rls-policy-a'])) throw new Error('RLS_SCOPE_READ_ISOLATION_INVALID');
=======
  if (JSON.stringify(visible.rows[0]?.ids)!==JSON.stringify(['rls-policy-a'])) throw new Error('RLS_SCOPE_READ_ISOLATION_INVALID');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  if (JSON.stringify(visible.rows[0]?.ids) !== JSON.stringify(['rls-policy-a'])) throw new Error('RLS_SCOPE_READ_ISOLATION_INVALID');
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  if (JSON.stringify(visible.rows[0]?.ids)!==JSON.stringify(['rls-policy-a'])) throw new Error('RLS_SCOPE_READ_ISOLATION_INVALID');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  await database.exec(`begin; set local role shopapp;
    select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','rls-auditor',true);`);
  try {
    await database.query("insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values('rls-policy-forbidden','rls-scope-b','forbidden','draft',1,clock_timestamp())");
  } catch (error) {
    await database.exec('rollback');
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    if (
      !String(error instanceof Error ? error.message : error)
        .toLowerCase()
        .includes('row-level security')
    )
      throw error;
<<<<<<< HEAD
=======
    if (!String(error instanceof Error ? error.message : error).toLowerCase().includes('row-level security')) throw error;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    if (!String(error instanceof Error ? error.message : error).toLowerCase().includes('row-level security')) throw error;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    return;
  }
  await database.exec('rollback');
  throw new Error('RLS_SCOPE_WRITE_ISOLATION_INVALID');
}

async function verifyObjectContract(database) {
  const contract = parse(await readFile(OBJECTS, 'utf8'));
  const entries = Array.isArray(contract?.objects) ? contract.objects : [];
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const schemas = entries
    .filter((entry) => entry.kind === 'schema')
    .map((entry) => entry.id)
    .sort();
<<<<<<< HEAD
=======
  const schemas = entries.filter((entry) => entry.kind === 'schema').map((entry) => entry.id).sort();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  const schemas = entries.filter((entry) => entry.kind === 'schema').map((entry) => entry.id).sort();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  const expected = new Map([
    ['schema', new Set(schemas)],
    ['table', new Set(entries.filter((entry) => entry.kind === 'table').map((entry) => entry.id))],
    ['view', new Set(entries.filter((entry) => entry.kind === 'view').map((entry) => entry.id))],
    ['function', new Set(entries.filter((entry) => entry.kind === 'function').map((entry) => entry.id))],
    ['trigger', new Set(entries.filter((entry) => entry.kind === 'trigger').map((entry) => entry.id))],
    ['policy', new Set(entries.filter((entry) => entry.kind === 'policy').map((entry) => entry.id))],
    ['grant', new Set(entries.filter((entry) => entry.kind === 'grant').map((entry) => entry.id))],
  ]);
  const schemaRows = await database.query('select schema_name id from information_schema.schemata where schema_name=any($1::text[])', [schemas]);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  const tableRows = await database.query(
    `select namespace.nspname||'.'||relation.relname id,relation.relrowsecurity rls
    from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname=any($1::text[]) and relation.relkind in('r','p')`,
    [schemas]
  );
  const viewRows = await database.query(
    `select namespace.nspname||'.'||relation.relname id from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname=any($1::text[]) and relation.relkind in('v','m')`,
    [schemas]
  );
  const functionRows = await database.query(
    `select namespace.nspname||'.'||procedure.proname id from pg_proc procedure
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
=======
  const tableRows = await database.query(`select namespace.nspname||'.'||relation.relname id,relation.relrowsecurity rls
=======
  const tableRows = await database.query(
    `select namespace.nspname||'.'||relation.relname id,relation.relrowsecurity rls
>>>>>>> 018b2a71 (chore(release): capture current production source)
    from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname=any($1::text[]) and relation.relkind in('r','p')`,
    [schemas]
  );
  const viewRows = await database.query(
    `select namespace.nspname||'.'||relation.relname id from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname=any($1::text[]) and relation.relkind in('v','m')`,
    [schemas]
  );
  const functionRows = await database.query(
    `select namespace.nspname||'.'||procedure.proname id from pg_proc procedure
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

<<<<<<< HEAD
  const roleRows = await database.query(`with roles(role) as (values('shopapp'),('shopjob'),('shopmigration'),('shopread')),
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const roleRows = await database.query(
    `with roles(role) as (values('shopapp'),('shopjob'),('shopmigration'),('shopread')),
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  const tableRows = await database.query(`select namespace.nspname||'.'||relation.relname id,relation.relrowsecurity rls
    from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname=any($1::text[]) and relation.relkind in('r','p')`, [schemas]);
  const viewRows = await database.query(`select namespace.nspname||'.'||relation.relname id from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname=any($1::text[]) and relation.relkind in('v','m')`, [schemas]);
  const functionRows = await database.query(`select namespace.nspname||'.'||procedure.proname id from pg_proc procedure
    join pg_namespace namespace on namespace.oid=procedure.pronamespace where namespace.nspname=any($1::text[])`, [schemas]);
  const triggerRows = await database.query(`select namespace.nspname||'.'||relation.relname||'.'||trigger.tgname id from pg_trigger trigger
    join pg_class relation on relation.oid=trigger.tgrelid join pg_namespace namespace on namespace.oid=relation.relnamespace
    where not trigger.tgisinternal and namespace.nspname=any($1::text[])`, [schemas]);
  const policyRows = await database.query(`select schemaname||'.'||tablename||'.'||policyname id from pg_policies where schemaname=any($1::text[])`, [schemas]);
  compareSet('schema', expected.get('schema'), schemaRows.rows.map((row) => row.id));
  compareSet('table', expected.get('table'), tableRows.rows.map((row) => row.id));
  compareSet('view', expected.get('view'), viewRows.rows.map((row) => row.id));
  compareSet('function', expected.get('function'), functionRows.rows.map((row) => row.id));
  compareSet('trigger', expected.get('trigger'), triggerRows.rows.map((row) => row.id));
  compareSet('policy', expected.get('policy'), policyRows.rows.map((row) => row.id));
  if (tableRows.rows.some((row) => !row.rls)) throw new Error('DATABASE_OBJECT_RLS_DRIFT');

  const roleRows = await database.query(`with roles(role) as (values('shopapp'),('shopjob'),('shopmigration'),('shopread')),
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      where role<>owner and has_function_privilege(role,oid,'EXECUTE')`,
    [schemas]
  );
  compareSet(
    'grant',
    expected.get('grant'),
    roleRows.rows.map((row) => row.id)
  );
<<<<<<< HEAD
=======
      where role<>owner and has_function_privilege(role,oid,'EXECUTE')`, [schemas]);
  compareSet('grant', expected.get('grant'), roleRows.rows.map((row) => row.id));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
      where role<>owner and has_function_privilege(role,oid,'EXECUTE')`, [schemas]);
  compareSet('grant', expected.get('grant'), roleRows.rows.map((row) => row.id));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

function compareSet(kind, expected, actualValues) {
  const actual = new Set(actualValues);
  const missing = [...expected].filter((value) => !actual.has(value)).sort();
  const extra = [...actual].filter((value) => !expected.has(value)).sort();
  if (missing.length || extra.length) throw new Error(`DATABASE_OBJECT_${kind.toUpperCase()}_DRIFT:${JSON.stringify({ missing, extra })}`);
}
