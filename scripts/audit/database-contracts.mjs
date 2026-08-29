import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { Client } from 'pg';
import { parse } from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const ROOT = repositoryRoot;
const MIGRATIONS = join(ROOT, 'database', 'supabase', 'migrations');
const HISTORY = join(ROOT, 'database', 'contracts', 'history.json');
const OBJECTS = join(ROOT, 'database', 'contracts', 'objects.yml');
const SANDBOX_CATALOG = join(ROOT, 'tools', 'seed', 'src', 'SandboxCatalogDatabase.sql');
const REGISTRATION_BOUNDARY_RECONCILE = join(
  ROOT,
  'infrastructure',
  'zhudatuan',
  'aliyun',
  'postgres-reconcile-registration-boundary.sql',
);
const BOOTSTRAP = '20260817191000_bootstrap_ethan_platform_owner.sql';
const OWNER_RECONCILIATION = '20260820132000_platform_owner_reconciliation.sql';
const INVITATION_SCOPE = '20260821066000_resolve_invitation_scope.sql';
const REGISTRATION_BOOTSTRAP_REPAIR = '20260829040000_zhudatuan_registration_bootstrap_runtime_repair.sql';
const REGISTRATION_BOOTSTRAP_REPLAY_FUTURE_HEAD_ASSERTION = /\n  if exists\(select 1 from runtime\.schemaversion\n    where version>'20260828183000' and version<>'20260829040000'\) then\n    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_REPAIR_FUTURE_HEAD_INVALID';\n  end if;/;
const IDENTITY_LOGIN_ACL_REPAIR = '20260829054500_zhudatuan_identity_login_acl_repair.sql';
const IDENTITY_LOGIN_ACL_REPLAY_FUTURE_HEAD_ASSERTION = /\n  if exists\(select 1 from runtime\.schemaversion\n    where version>'20260829040000' and version<>'20260829054500'\) then\n    raise exception 'ZHUDATUAN_IDENTITY_LOGIN_ACL_FUTURE_HEAD_INVALID';\n  end if;/;
const OPERATOR_INVITATION_REGISTRATION = '20260829060000_zhudatuan_operator_invitation_registration.sql';
const OPERATOR_INVITATION_CONTRACT = join(ROOT,'database','supabase','tests','zhudatuan_operator_invitation_registration_contract.sql');
const REGISTRATION_ASSERTION_OMISSIONS = new Map([
  [INVITATION_SCOPE,/\ndo \$assert\$ begin\n  if access\.resource_scope\('identity\.invitations\.create',[\s\S]*?\nend \$assert\$;\n/],
  ['20260821069000_add_store_management.sql',/\n  select id into membership from access\.membership[\s\S]*?STORE_CREATE_SCOPE_UNRESOLVED'; end if;\n/],
  ['20260821074000_grant_platform_owner_operations.sql',/\ndo \$assert\$[\s\S]*?\n\$assert\$;\n/],
  ['20260821075000_grant_platform_cardlibrary_read.sql',/\ndo \$assert\$[\s\S]*?\nend \$assert\$;\n/],
  ['20260821076000_grant_platform_cockpit_reads.sql',/\ndo \$assert\$[\s\S]*?\n\$assert\$;\n/],
  ['20260821078000_complete_experience_application.sql',/\n  if exists\(\n    select 1 from unnest\(required_operations\)[\s\S]*?PLATFORM_OWNER_EXPERIENCE_OPERATION_MISSING';\n  end if;\n/],
]);
const INVENTORY_CUTOVER = '20260820133000_inventory_single_source_cutover.sql';
const SECURE_STAGE = '20260821026000_backfill_domain_data.sql';
const REPAIR_FILES = [
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
  '20260821080000_restore_member_scope_authorization.sql',
  '20260828170000_zhudatuan_registration_baseline.sql',
  '20260828173000_zhudatuan_web_business_access.sql',
  '20260828180000_zhudatuan_purchase_access.sql',
  '20260828183000_zhudatuan_runtime_readiness_repair.sql',
  '20260829040000_zhudatuan_registration_bootstrap_runtime_repair.sql',
  '20260829054500_zhudatuan_identity_login_acl_repair.sql',
  '20260829060000_zhudatuan_operator_invitation_registration.sql',
];

const mode = process.argv[2];
if (!['--check-inventory','--schema-fresh','--registration-fresh','--registration-boundary-postgres','--environment-bootstrap','--inventory-cutover-unsafe','--postgres-fresh','--mvp-kernel'].includes(mode)) {
  throw new Error('usage: database-contracts.mjs --check-inventory|--schema-fresh|--registration-fresh|--registration-boundary-postgres|--environment-bootstrap|--inventory-cutover-unsafe|--postgres-fresh|--mvp-kernel [URL]');
}
const replayRole = mode === '--postgres-fresh' ? process.argv[4] : undefined;
if (replayRole !== undefined && !/^[a-z][a-z0-9_]{2,62}$/.test(replayRole)) throw new Error('POSTGRES_FRESH_ROLE_INVALID');
if (mode === '--registration-boundary-postgres' && process.argv[4] !== 'local-disposable-fixture') {
  throw new Error('REGISTRATION_BOUNDARY_POSTGRES_FIXTURE_CONFIRMATION_REQUIRED');
}

const migrationFiles = (await readdir(MIGRATIONS)).filter((name) => name.endsWith('.sql')).sort();
await verifyInventory(migrationFiles);
if (mode === '--check-inventory') {
  console.log(`migration inventory ok: historical=94 repair=${REPAIR_FILES.length} total=${migrationFiles.length}`);
  process.exit(0);
}

if (mode === '--registration-boundary-postgres') {
  const database = await openDatabase();
  try {
    await verifyRegistrationBoundaryOnPostgres(database);
  } finally {
    await database.close();
  }
  console.log('registration boundary PostgreSQL replay passed: rds-like-deny=1 rds-like-allow=2');
  process.exit(0);
}

const database = await openDatabase();
try {
  await execute(database, `
    create role anon nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    create role authenticated nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    create role service_role nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  `, 'database role bootstrap');
  if (mode === '--registration-fresh') await installRegistrationReplayBoundary(database);
  if (replayRole !== undefined) await execute(database, `set role "${replayRole}"`, 'database migration role');
  await execute(database, `
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
  `, 'database bootstrap');
  let applied = 0;
  for (const name of migrationFiles) {
    if (mode === '--registration-fresh' && (name === BOOTSTRAP || name === OWNER_RECONCILIATION)) {
      await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)',
        [name.slice(0,14),`environment-omitted:${name}`]);
      applied += 1;
      continue;
    }
    if (name === BOOTSTRAP) await seedBootstrapPrecondition(database);
    if (mode === '--inventory-cutover-unsafe' && name === INVENTORY_CUTOVER) {
      await seedUnsafeInventoryCutover(database);
      await assertUnsafeInventoryCutoverRejected(database, await readFile(join(MIGRATIONS,name),'utf8'));
      console.log(`unsafe inventory cutover rejected atomically: migrations_before_cutover=${applied}`);
      process.exitCode = 0;
      break;
    }
    if (name === SECURE_STAGE) await stageFreshReplaySecrets(database);
    const source = await readFile(join(MIGRATIONS,name),'utf8');
    const omission=REGISTRATION_ASSERTION_OMISSIONS.get(name);
    const sql = mode==='--registration-fresh' && omission
      ? omitExactEnvironmentAssertion(source,omission,name)
      : source;
    await execute(database, sql, `migration ${name}`);
    await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0,14),name]);
    applied += 1;
  }
  if (mode !== '--inventory-cutover-unsafe') {
    if (mode === '--registration-fresh') await reconcileRegistrationReplayBoundary(database);
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
  if (mode !== '--postgres-fresh' && mode !== '--registration-boundary-postgres') {
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
  if (mode === '--registration-boundary-postgres' && connectionString === undefined) {
    throw new Error('REGISTRATION_BOUNDARY_POSTGRES_URL_REQUIRED');
  }
  const client = new Client({ ...(connectionString === undefined ? {} : { connectionString }), connectionTimeoutMillis: 5_000, statement_timeout: 120_000 });
  await client.connect();
  return Object.freeze({
    exec: async (sql) => { await client.query(sql); },
    query: (sql, parameters) => client.query(sql, parameters),
    close: () => client.end(),
  });
}

async function verifyInventory(files) {
  const duplicates = duplicateVersions(files);
  if (duplicates.size) throw new Error(`duplicate migration versions: ${JSON.stringify([...duplicates])}`);
  const history = JSON.parse(await readFile(HISTORY,'utf8'));
  if (history.algorithm!=='sha256' || history.count!==94 || history.migrations.length!==94) throw new Error('HISTORICAL_MIGRATION_MANIFEST_INVALID');
  const historical = files.filter((name)=>name.slice(0,14)<=history.head);
  if (JSON.stringify(historical)!==JSON.stringify(history.migrations.map((item)=>item.file))) throw new Error('HISTORICAL_MIGRATION_FILESET_DRIFT');
  for (const item of history.migrations) {
    const digest = createHash('sha256').update(await readFile(join(MIGRATIONS,item.file))).digest('hex');
    if (digest!==item.sha256) throw new Error(`HISTORICAL_MIGRATION_HASH_DRIFT:${item.file}`);
  }
  const repair = files.filter((name)=>name.slice(0,14)>history.head);
  if (JSON.stringify(repair)!==JSON.stringify(REPAIR_FILES)) throw new Error(`REPAIR_MIGRATION_SEQUENCE_DRIFT:${JSON.stringify(repair)}`);
  await readFile(OBJECTS,'utf8').catch(()=>{ throw new Error('DATABASE_OBJECT_CONTRACT_MISSING'); });
}

function duplicateVersions(files) {
  const versions = new Map();
  for (const file of files) {
    const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file);
    if (!match) throw new Error(`INVALID_MIGRATION_FILENAME:${file}`);
    const existing = versions.get(match[1]) ?? [];
    existing.push(file); versions.set(match[1],existing);
  }
  return new Map([...versions].filter(([,names])=>names.length>1));
}

function omitExactEnvironmentAssertion(source,assertion,file) {
  const matches=source.match(new RegExp(assertion.source,'g'));
  if (matches?.length!==1) throw new Error(`MIGRATION_ENVIRONMENT_ASSERTION_DRIFT:${file}`);
  return source.replace(assertion,'\n');
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

async function installRegistrationReplayBoundary(database) {
  const sentinel='registration-fresh-replay-sentinel-not-for-production';
  await execute(database, `create extension if not exists pgcrypto;
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
  `,'registration replay boundary');
}

async function verifyRegistrationBoundaryOnPostgres(database) {
  const retiredRoles = [
    'shopapp','shopmigration','shopread','zhudatuanbootstrap','zhudatuanwebapi',
    'zhudatuanpurchaseapi','zhudatuansandboxbootstrap',
  ];
  const runtimeRoles = ['shopjob','zhudatuanidentityapi','zhudatuanidentityjob'];
  const boundaryRoles = ['anon','authenticated','service_role','zhudatuanregistrationboundary'];
  const fixtureRoles = [
    'registration_rds_superuser_fixture','pg_rds_superuser','rds_boundary_admin','registration_boundary_outsider',
    ...retiredRoles,...runtimeRoles,...boundaryRoles,
  ];
  const preflight = (await database.query(`select current_database() database_name,
    current_setting('allow_system_table_mods') system_table_mods,
    coalesce((select rolsuper from pg_roles where rolname=current_user),false) authority_super,
    to_regnamespace('deployment') is not null deployment_exists`)).rows[0];
  const existingRoles = (await database.query(
    'select rolname from pg_roles where rolname=any($1::text[]) order by rolname',[fixtureRoles],
  )).rows.map((row)=>row.rolname);
  if (JSON.stringify(preflight)!==JSON.stringify({
    database_name:'zhudatuan_registration',system_table_mods:'on',authority_super:true,deployment_exists:false,
  }) || existingRoles.length!==0) {
    throw new Error(`REGISTRATION_BOUNDARY_POSTGRES_FIXTURE_UNSAFE:${JSON.stringify({preflight,existingRoles})}`);
  }

  await execute(database, `
    create extension pgcrypto;
    create role registration_rds_superuser_fixture nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    update pg_authid set rolname='pg_rds_superuser' where rolname='registration_rds_superuser_fixture';
    create role rds_boundary_admin nologin nosuperuser nocreatedb createrole noinherit noreplication nobypassrls;
    create role registration_boundary_outsider nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role shopapp nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuanbootstrap nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role shopmigration nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role shopread nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuanwebapi nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuanpurchaseapi nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuansandboxbootstrap nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role shopjob login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuanidentityapi login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuanidentityjob login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role anon nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role authenticated nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role service_role nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuanregistrationboundary nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    grant pg_rds_superuser to rds_boundary_admin;
    alter database zhudatuan_registration owner to shopmigration;
    create schema deployment authorization rds_boundary_admin;
    create schema access authorization rds_boundary_admin;
    create schema runtime authorization rds_boundary_admin;
    revoke all on schema deployment from public;
    revoke all on schema access from public;
    revoke all on schema runtime from public;
    set session authorization rds_boundary_admin;
    create table deployment.boundary(
      id text primary key,database_name text not null,sentinel_hash char(64) not null check(sentinel_hash~'^[0-9a-f]{64}$'),
      created_at timestamptz not null default clock_timestamp()
    );
    insert into deployment.boundary(id,database_name,sentinel_hash)
    values('zhudatuan-registration-v1',current_database(),encode(public.digest('rds-like-replay-sentinel','sha256'),'hex'));
    create function deployment.registration_bootstrap_boundary(p_sentinel text)
    returns boolean language sql stable security definer set search_path=pg_catalog,deployment,public as $function$
      select current_database()='zhudatuan_registration'
        and session_user='zhudatuanbootstrap'
        and exists(select 1 from deployment.boundary
          where id='zhudatuan-registration-v1' and database_name=current_database()
            and sentinel_hash=encode(public.digest(p_sentinel,'sha256'),'hex'))
    $function$;
    create function deployment.is_independent_registration_database()
    returns boolean language sql stable security definer set search_path=pg_catalog,deployment as $function$
      select current_database()='zhudatuan_registration'
        and exists(select 1 from deployment.boundary
          where id='zhudatuan-registration-v1' and database_name=current_database())
    $function$;
    create table access.role(id text primary key,scope_id text not null,status text not null);
    create table access.membership(id text primary key,client text not null,status text not null);
    create table access.membershiprole(
      membership_id text not null,role_id text not null,effective_at timestamptz not null,expires_at timestamptz
    );
    create table runtime.schemaversion(version text primary key,checksum char(64) not null);
    alter table access.role enable row level security;
    alter table access.membership enable row level security;
    alter table access.membershiprole enable row level security;
    alter table runtime.schemaversion enable row level security;
    insert into access.role(id,scope_id,status)
    values('role-platform-owner-v2','tenant-zhudatuan','active');
    insert into access.membership(id,client,status)
    values('membership-platform-owner-fixture','operator','active');
    insert into access.membershiprole(membership_id,role_id,effective_at,expires_at)
    values('membership-platform-owner-fixture','role-platform-owner-v2',clock_timestamp()-interval '1 hour',null);
    insert into runtime.schemaversion(version,checksum)
    values('20260829060000','b1e238eb8de569b0de9d1d2766620e1f661268d2f9260e646208d4f24715b37a');
    revoke all on deployment.boundary from public;
    revoke all on function deployment.registration_bootstrap_boundary(text) from public;
    revoke all on function deployment.is_independent_registration_database() from public;
    grant usage on schema deployment to zhudatuanbootstrap,shopmigration;
    grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap;
    grant execute on function deployment.is_independent_registration_database() to shopmigration;
    reset session authorization;
  `,'registration boundary PostgreSQL fixture');

  const reconciliation = await readFile(REGISTRATION_BOUNDARY_RECONCILE,'utf8');
  const before = (await database.query(`select
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.registration_bootstrap_boundary(text)'::regprocedure) bootstrap_owner,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed,
    (select count(*)::integer from pg_auth_members membership join pg_roles owner
      on owner.oid in(membership.roleid,membership.member)
      where owner.rolname='zhudatuanregistrationboundary') owner_memberships`)).rows[0];
  await database.exec('set session authorization registration_boundary_outsider');
  try {
    await database.exec(reconciliation);
    throw new Error('REGISTRATION_BOUNDARY_UNPRIVILEGED_RECONCILE_UNEXPECTEDLY_SUCCEEDED');
  } catch (error) {
    if (!String(error instanceof Error?error.message:error).includes('ZHUDATUAN_REGISTRATION_BOUNDARY_RECONCILE_AUTHORITY_INVALID')) throw error;
  } finally {
    await database.exec('rollback');
    await database.exec('reset session authorization');
  }
  const afterDenied = (await database.query(`select
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.registration_bootstrap_boundary(text)'::regprocedure) bootstrap_owner,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed,
    (select count(*)::integer from pg_auth_members membership join pg_roles owner
      on owner.oid in(membership.roleid,membership.member)
      where owner.rolname='zhudatuanregistrationboundary') owner_memberships`)).rows[0];
  if (JSON.stringify(afterDenied)!==JSON.stringify(before)) {
    throw new Error(`REGISTRATION_BOUNDARY_UNPRIVILEGED_RECONCILE_LEAKED:${JSON.stringify({before,afterDenied})}`);
  }

  for (const label of [
    'RDS-like registration boundary reconciliation',
    'RDS-like registration boundary idempotent reconciliation',
  ]) {
    // Aliyun's pg_rds_superuser account can SET ROLE to an ordinary account
    // without a catalog membership.  Vanilla PG16 has no such predefined-role
    // behavior, so inject one disposable SET/ADMIN edge with the RDS authority
    // as grantor.  The reviewed reconciliation must remove it before commit.
    await execute(database, `
      grant zhudatuanregistrationboundary to rds_boundary_admin with admin true,inherit false,set true;
      update pg_auth_members set grantor=(select oid from pg_roles where rolname='rds_boundary_admin')
        where roleid=(select oid from pg_roles where rolname='zhudatuanregistrationboundary')
          and member=(select oid from pg_roles where rolname='rds_boundary_admin');
    `,`${label} fixture RDS SET capability`);
    await database.exec('set session authorization rds_boundary_admin');
    try {
      await execute(database,reconciliation,label);
    } finally {
      await database.exec('rollback');
      await database.exec('reset session authorization');
    }
    const boundaryMemberships = (await database.query(`select count(*)::integer memberships
      from pg_auth_members membership join pg_roles role
        on role.oid in(membership.roleid,membership.member)
      where role.rolname='zhudatuanregistrationboundary'`)).rows[0].memberships;
    if (boundaryMemberships!==0) {
      throw new Error(`REGISTRATION_BOUNDARY_POSTGRES_MEMBERSHIP_LEAK:${JSON.stringify({label,boundaryMemberships})}`);
    }
  }
  const finalState = (await database.query(`select
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.registration_bootstrap_boundary(text)'::regprocedure) bootstrap_owner,
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.is_independent_registration_database()'::regprocedure) migration_owner,
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.runtime_database_boundary()'::regprocedure) runtime_owner,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed,
    (select count(*)::integer from (values('shopjob'),('zhudatuanidentityapi'),('zhudatuanidentityjob')) expected(role_name)
      where has_function_privilege(expected.role_name,'deployment.runtime_database_boundary()','EXECUTE')) runtime_execute_count,
    (select count(*)::integer from (values('registration_boundary_outsider'),('shopapp'),('shopmigration'),
        ('shopread'),('zhudatuanbootstrap'),('zhudatuanwebapi'),('zhudatuanpurchaseapi'),
        ('zhudatuansandboxbootstrap')) denied(role_name)
      where has_function_privilege(denied.role_name,'deployment.runtime_database_boundary()','EXECUTE')) denied_execute_count,
    (select count(*)::integer from pg_auth_members membership join pg_roles owner
      on owner.oid in(membership.roleid,membership.member)
      where owner.rolname='zhudatuanregistrationboundary') owner_memberships,
    (select not rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole and not rolinherit
      and not rolreplication and not rolbypassrls from pg_roles
      where rolname='zhudatuanregistrationboundary') owner_restricted`)).rows[0];
  if (JSON.stringify(finalState)!==JSON.stringify({
    bootstrap_owner:'zhudatuanregistrationboundary',migration_owner:'zhudatuanregistrationboundary',
    runtime_owner:'zhudatuanregistrationboundary',definer_allowed:true,runtime_execute_count:3,
    denied_execute_count:0,owner_memberships:0,owner_restricted:true,
  })) throw new Error(`REGISTRATION_BOUNDARY_POSTGRES_FINAL_STATE_INVALID:${JSON.stringify(finalState)}`);

  const healthyBoundary = {
    active_platform_owner_count:1,migration_head_valid:true,retired_roles_valid:true,runtime_roles_valid:true,
    boundary_roles_valid:true,retired_membership_count:0,
    registration_boundary_owner:'zhudatuanregistrationboundary',
    migration_boundary_owner:'zhudatuanregistrationboundary',
    runtime_boundary_owner:'zhudatuanregistrationboundary',database_owner:'shopmigration',
  };
  for (const role of runtimeRoles) {
    await database.exec(`set session authorization "${role}"`);
    try {
      const boundary = (await database.query('select * from deployment.runtime_database_boundary()')).rows[0];
      if (JSON.stringify(boundary)!==JSON.stringify(healthyBoundary)) {
        throw new Error(`REGISTRATION_RUNTIME_DATABASE_BOUNDARY_INVALID:${JSON.stringify({role,boundary})}`);
      }
    } finally {
      await database.exec('reset session authorization');
    }
  }
  for (const role of ['registration_boundary_outsider',...retiredRoles]) {
    await database.exec(`set session authorization "${role}"`);
    let denied = false;
    try {
      await database.query('select * from deployment.runtime_database_boundary()');
    } catch (error) {
      if (!String(error instanceof Error?error.message:error).includes('permission denied')) throw error;
      denied = true;
    } finally {
      await database.exec('reset session authorization');
    }
    if (!denied) throw new Error(`REGISTRATION_RUNTIME_DATABASE_BOUNDARY_UNEXPECTEDLY_ALLOWED:${role}`);
  }

  await database.exec('set session authorization zhudatuanbootstrap');
  const bootstrapCall = (await database.query(
    'select deployment.registration_bootstrap_boundary($1) sentinel_valid',['rds-like-replay-sentinel'],
  )).rows[0];
  await database.exec('reset session authorization');
  await database.exec('set session authorization shopmigration');
  const migrationCall = (await database.query(`select
    deployment.registration_bootstrap_boundary('rds-like-replay-sentinel') bootstrap_direct,
    deployment.is_independent_registration_database() migration_boundary`)).rows[0];
  await database.exec('reset session authorization');
  if (JSON.stringify({bootstrapCall,migrationCall})!==JSON.stringify({
    bootstrapCall:{sentinel_valid:true},migrationCall:{bootstrap_direct:false,migration_boundary:true},
  })) throw new Error(`REGISTRATION_BOUNDARY_POSTGRES_CALL_CHAIN_INVALID:${JSON.stringify({bootstrapCall,migrationCall})}`);
}

async function reconcileRegistrationReplayBoundary(database) {
  // Model an existing volume initialized before shopmigration was added to
  // the nested SECURITY DEFINER boundary. The replay must exercise the exact
  // privileged reconciliation artifact used in production.
  await execute(database, `
    alter role zhudatuanbootstrap noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    alter role shopmigration noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    grant usage on schema deployment to zhudatuanbootstrap,shopmigration;
    revoke execute on function deployment.registration_bootstrap_boundary(text) from shopmigration;
    grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap;
    grant execute on function deployment.is_independent_registration_database() to shopmigration;
  `,'registration replay legacy boundary state');
  const before = await database.query(`select
    has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE') bootstrap_allowed,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed`);
  if (JSON.stringify(before.rows[0])!==JSON.stringify({bootstrap_allowed:true,definer_allowed:false})) {
    throw new Error(`REGISTRATION_REPLAY_LEGACY_BOUNDARY_INVALID:${JSON.stringify(before.rows[0])}`);
  }
  const reconciliation = await readFile(REGISTRATION_BOUNDARY_RECONCILE,'utf8');
  await execute(database,reconciliation,'registration replay privileged boundary reconciliation');
  await execute(database,reconciliation,'registration replay idempotent boundary reconciliation');
  const after = await database.query(`select
    has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE') bootstrap_allowed,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed,
    has_function_privilege('shopmigration','deployment.is_independent_registration_database()','EXECUTE') migration_boundary_allowed,
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.registration_bootstrap_boundary(text)'::regprocedure) bootstrap_owner,
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.is_independent_registration_database()'::regprocedure) migration_owner,
    (select count(*)::integer from pg_auth_members membership join pg_roles owner
      on owner.oid in(membership.roleid,membership.member)
      where owner.rolname='zhudatuanregistrationboundary') owner_memberships`);
  if (JSON.stringify(after.rows[0])!==JSON.stringify({
    bootstrap_allowed:true,definer_allowed:true,migration_boundary_allowed:true,
    bootstrap_owner:'zhudatuanregistrationboundary',migration_owner:'zhudatuanregistrationboundary',owner_memberships:0,
  })) {
    throw new Error(`REGISTRATION_REPLAY_RECONCILED_BOUNDARY_INVALID:${JSON.stringify(after.rows[0])}`);
  }
}

async function stageFreshReplaySecrets(database) {
  await execute(database, `insert into runtime.vouchersecretstage(voucher_id,code_ciphertext,code_fingerprint,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(voucher_code,'sha256'),'base64'),encode(digest(lower(voucher_code),'sha256'),'hex'),'fixture-v1',created_at
    from public.vouchers on conflict(voucher_id) do nothing;
    insert into runtime.partneraddressstage(store_id,address_ciphertext,address_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(address_text,'sha256'),'base64'),encode(digest(lower(address_text),'sha256'),'hex'),'fixture-v1',created_at
    from public.stores where address_text is not null on conflict(store_id) do nothing;
    insert into runtime.distributorcontactstage(distributor_id,contact_ciphertext,contact_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(contact_json::text,'sha256'),'base64'),encode(digest(contact_json::text,'sha256'),'hex'),'fixture-v1',created_at
    from public.distributors where contact_json<>'{}'::jsonb on conflict(distributor_id) do nothing;`,'secure fixture stage');
}

async function seedUnsafeInventoryCutover(database) {
  await execute(database, `do $$ begin update public.inventory set reserved_qty=greatest(reserved_qty,1); if not found then raise exception 'UNSAFE_INVENTORY_FIXTURE_MISSING'; end if; end $$;`,'unsafe inventory fixture');
}

async function assertUnsafeInventoryCutoverRejected(database,sql) {
  try { await database.exec(sql); }
  catch (error) {
    if (!String(error instanceof Error?error.message:error).includes('INVENTORY_CUTOVER_RECONCILIATION_REQUIRED')) throw error;
    if ((await database.query("select to_regclass('inventory.cutover_reviews') is not null as leaked")).rows[0].leaked) throw new Error('UNSAFE_INVENTORY_CUTOVER_PARTIAL_COMMIT');
    return;
  }
  throw new Error('UNSAFE_INVENTORY_CUTOVER_UNEXPECTEDLY_SUCCEEDED');
}

async function verifyTarget(database) {
  const operationContract = parse(await readFile(join(ROOT,'packages','contract','definitions','operations.yml'),'utf8'));
  const eventContract = parse(await readFile(join(ROOT,'packages','contract','definitions','events.yml'),'utf8'));
  const expectedOperations = Array.isArray(operationContract?.operations) ? operationContract.operations.length : -1;
  const expectedEvents = Array.isArray(eventContract?.events) ? eventContract.events.length : -1;
  const result = await database.query(`select
    (select count(*)::integer from runtime.operation) operations,
    (select count(*)::integer from runtime.event) events,
    (select count(*)::integer from pg_tables where schemaname='public') public_tables,
    (select count(*)::integer from supabase_migrations.schema_migrations) migrations`);
  const row=result.rows[0];
  if (row.operations!==expectedOperations || row.events!==expectedEvents || row.public_tables!==0 || row.migrations!==migrationFiles.length) throw new Error(`TARGET_CATALOG_INVALID:${JSON.stringify(row)}`);
  await verifyObjectContract(database);
  await verifyRls(database);
  await verifyAuditImmutability(database);
  await verifyZhudatuanRegistrationBaseline(database);
  await execute(database,await readFile(OPERATOR_INVITATION_CONTRACT,'utf8'),'zhudatuan operator invitation registration contract');
  await verifyZhudatuanRuntimeReadinessRepair(database);
  await verifyZhudatuanBootstrapRuntimeRepair(database);
  await verifyZhudatuanWebBusinessAccess(database);
  await verifyZhudatuanPurchaseAccess(database);
  await verifySandboxCatalogBootstrap(database);
  await verifyExperiencePublication(database);
  await verifyExtensionLifecycle(database);
  // This must remain last: PGlite cannot reset SESSION AUTHORIZATION. The
  // registration replay uses the canonical database name and sentinel, so it
  // can exercise the real direct-login one-shot boundaries before close.
  if (mode === '--registration-fresh') await verifySandboxMemberBootstraps(database);
}

async function verifyZhudatuanRuntimeReadinessRepair(database) {
  const contract = await database.query(`select checksum from runtime.schemaversion
    where version='20260821032000'`);
  if (contract.rows[0]?.checksum!=='83892ce3a42c15ab21703902380b63b6cc3352000d0c4c2a9df50b60347e383a') {
    throw new Error(`ZHUDATUAN_RUNTIME_CONTRACT_CHECKSUM_INVALID:${JSON.stringify(contract.rows)}`);
  }
  const expectations = [
    ['zhudatuanidentityapi',['20260821032000','20260821054000','20260828170000']],
    ['zhudatuanidentityjob',['20260821032000','20260821054000','20260828170000']],
    ['zhudatuanbootstrap',['20260828170000']],
  ];
  for (const [role,versions] of expectations) {
    await database.exec(`begin; set local role ${role};`);
    try {
      const visible = await database.query('select array_agg(version order by version) versions from runtime.schemaversion');
      if (JSON.stringify(visible.rows[0]?.versions)!==JSON.stringify(versions)) {
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
  if (JSON.stringify(canonicalOwnerRole.rows)!==JSON.stringify([{
    id:'role-platform-owner-v2',scope_id:'tenant-zhudatuan',status:'active',
  }])) throw new Error(`ZHUDATUAN_BOOTSTRAP_OWNER_ROLE_INVALID:${JSON.stringify(canonicalOwnerRole.rows)}`);
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
      has_table_privilege(current_user,'member.invite','SELECT,INSERT') invite_read_create,
      has_table_privilege(current_user,'identity.principal','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') principal_write,
      has_table_privilege(current_user,'access.membership','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') membership_write,
      has_table_privilege(current_user,'access.membershiprole','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') membership_role_write,
      has_table_privilege(current_user,'member.invite','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') invite_mutate,
      (select array_agg(id order by id) from access.role where id in(
        'role-platform-owner-v2','role-zhudatuan-storefront-member','role:self')) visible_roles,
      (select count(*)::integer from access.membershiprole assignment
        join access.membership membership on membership.id=assignment.membership_id
        where assignment.role_id='role-zhudatuan-storefront-member'
          and membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')) legacy_assignments,
      (select array_agg(membership_id order by membership_id) from access.membershiprole
        where membership_id in('membership:bootstrap-rls-legacy','membership:bootstrap-rls-canonical')) fixture_assignments,
      (select count(*)::integer from member.invite where status='active' and (
        id='invite-demo-employee-2026' or organization_id in('tenant-smart-wing','enterprise-demo','mall-demo'))) legacy_invites,
      (select count(*)::integer from identity.principal
        where id='principal:zhudatuan:owner:ethan:v1') fixed_owner_principals,
      (select count(*)::integer from access.membership
        where id='membership-platform-owner-ethan-v1'
          and organization_id='tenant-zhudatuan' and client='operator') fixed_owner_memberships`);
    const row = result.rows[0];
    if (JSON.stringify(row)!==JSON.stringify({
      principal_read:true,membership_read:true,membership_role_read:true,invite_read_create:true,
      principal_write:false,membership_write:false,membership_role_write:false,invite_mutate:false,
      visible_roles:['role-platform-owner-v2','role-zhudatuan-storefront-member','role:self'],
      legacy_assignments:1,fixture_assignments:['membership:bootstrap-rls-legacy'],legacy_invites:0,
      fixed_owner_principals:0,fixed_owner_memberships:0,
    })) {
      const policies = await database.query(`select policyname,permissive,roles,qual from pg_policies
        where schemaname='access' and tablename='role' order by policyname`);
      throw new Error(`ZHUDATUAN_BOOTSTRAP_RUNTIME_ACCESS_INVALID:${JSON.stringify({row,policies:policies.rows})}`);
    }
  } finally {
    await database.exec('rollback');
  }
  if (mode==='--registration-fresh') {
    const boundary = await database.query(`select
      has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE') bootstrap_allowed,
      has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed`);
    if (JSON.stringify(boundary.rows[0])!==JSON.stringify({bootstrap_allowed:true,definer_allowed:true})) {
      throw new Error(`ZHUDATUAN_BOOTSTRAP_DEFINER_BOUNDARY_INVALID:${JSON.stringify(boundary.rows[0])}`);
    }
  }
}

async function verifySandboxMemberBootstraps(database) {
  const sentinel='registration-fresh-replay-sentinel-not-for-production';
  await database.exec(`
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values('principal:sandbox-member-bootstrap','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values('member:sandbox-member-bootstrap','principal:sandbox-member-bootstrap','Sandbox Bootstrap','active',
      clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values('membership:sandbox-member-bootstrap','member:sandbox-member-bootstrap','mall-zhudatuan','storefront','active',1,
      clock_timestamp());
    insert into access.membershiprole(membership_id,role_id,effective_at,expires_at,delegated_by)
    values('membership:sandbox-member-bootstrap','role-zhudatuan-storefront-member',clock_timestamp(),null,
      'registration-fresh-replay');
    set session authorization zhudatuansandboxbootstrap;`);
  const boundary=await database.query(`select current_database() database_name,current_user,session_user,
    deployment.sandbox_catalog_bootstrap_boundary($1) sentinel_valid,
    has_schema_privilege(current_user,'benefit','USAGE') benefit_usage,
    has_schema_privilege(current_user,'finance','USAGE') finance_usage`,[sentinel]);
  if (JSON.stringify(boundary.rows[0])!==JSON.stringify({
    database_name:'zhudatuan_registration',current_user:'zhudatuansandboxbootstrap',session_user:'zhudatuansandboxbootstrap',
    sentinel_valid:true,benefit_usage:false,finance_usage:false,
  })) throw new Error(`SANDBOX_MEMBER_BOOTSTRAP_BOUNDARY_INVALID:${JSON.stringify(boundary.rows[0])}`);
  for (let replay=0;replay<2;replay+=1) {
    const qualification=await database.query(
      'select deployment.sandbox_member_qualification_bootstrap($1,$2) result',
      [sentinel,'membership:sandbox-member-bootstrap'],
    );
    const result=qualification.rows[0]?.result;
    if (!result || result.membership!=='membership:sandbox-member-bootstrap'
      || result.member!=='member:sandbox-member-bootstrap' || result.scope!=='mall-zhudatuan'
      || result.status!=='active' || result.version!==1 || result.benefitAmountGranted!==false) {
      throw new Error(`SANDBOX_QUALIFICATION_REPLAY_INVALID:${JSON.stringify(result??null)}`);
    }
  }
  for (let replay=0;replay<2;replay+=1) {
    const welfare=await database.query(
      'select deployment.sandbox_member_welfare_bootstrap($1,$2,$3,$4,$5) result',
      [sentinel,'membership:sandbox-member-bootstrap',500,'CNY','OWNER_APPROVES_ONE_EXPLICIT_SANDBOX_WELFARE_GRANT'],
    );
    const result=welfare.rows[0]?.result;
    if (!result || result.membership!=='membership:sandbox-member-bootstrap'
      || result.member!=='member:sandbox-member-bootstrap' || result.scope!=='mall-zhudatuan'
      || result.amountMinor!==500 || result.currency!=='CNY' || result.expiresInDays!==30
      || result.sandboxOnly!==true || typeof result.account!=='string' || typeof result.batch!=='string') {
      throw new Error(`SANDBOX_WELFARE_REPLAY_INVALID:${JSON.stringify(result??null)}`);
    }
  }
  let conflict=false;
  try {
    await database.query('select deployment.sandbox_member_welfare_bootstrap($1,$2,$3,$4,$5)',
      [sentinel,'membership:sandbox-member-bootstrap',501,'CNY','OWNER_APPROVES_ONE_EXPLICIT_SANDBOX_WELFARE_GRANT']);
  } catch (error) {
    conflict=String(error instanceof Error?error.message:error).includes('SANDBOX_WELFARE_AMOUNT_CONFLICT');
  }
  if (!conflict) throw new Error('SANDBOX_WELFARE_DIFFERENT_AMOUNT_NOT_REJECTED');
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
    const scopes=await database.query(`select
      access.purchase_member_allowed('member:purchase-rls') member_allowed,
      access.purchase_mall_allowed('mall-zhudatuan') mall_allowed,
      access.purchase_risk_scope_allowed('tenant-zhudatuan') ancestor_allowed,
      access.purchase_risk_scope_allowed('scope:purchase-unrelated') unrelated_allowed,
      has_schema_privilege(current_user,'finance','USAGE') finance_usage,
      has_schema_privilege(current_user,'voucher','USAGE') voucher_usage`);
    if (JSON.stringify(scopes.rows[0])!==JSON.stringify({
      member_allowed:true,mall_allowed:true,ancestor_allowed:true,unrelated_allowed:false,
      finance_usage:false,voucher_usage:false,
    })) throw new Error(`ZHUDATUAN_PURCHASE_SCOPE_INVALID:${JSON.stringify(scopes.rows[0])}`);
    const visible=await database.query("select array_agg(id order by id) ids from risk.policy where id like 'risk:purchase-%'");
    if (JSON.stringify(visible.rows[0]?.ids)!==JSON.stringify(['risk:purchase-ancestor'])) {
      throw new Error(`ZHUDATUAN_PURCHASE_RISK_RLS_INVALID:${JSON.stringify(visible.rows[0])}`);
    }
    for (const expression of [
      "access.purchase_member_scope('membership:purchase-rls','session:purchase-rls')",
      "benefit.purchase_available('membership:purchase-rls','session:purchase-rls',array['benefit:none']::text[])",
      "benefit.purchase_reserve('membership:purchase-rls','session:purchase-rls','order:guard','member:purchase-rls',array['benefit:none']::text[],array[1]::bigint[])",
    ]) {
      await database.exec('savepoint direct_purchase_session_guard');
      let rejected=false;
      try { await database.query(`select * from ${expression}`); }
      catch (error) { rejected=String(error instanceof Error?error.message:error).includes('PURCHASE_SESSION_INVALID'); }
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
    const scopes=await database.query(`select
      access.web_scope_allowed('tenant-zhudatuan') business_ancestor,
      access.web_risk_scope_allowed('member:web-business-rls') risk_member,
      access.web_risk_scope_allowed('mall-zhudatuan') risk_mall,
      access.web_risk_scope_allowed('tenant-zhudatuan') risk_ancestor,
      access.web_risk_scope_allowed('scope:web-business-unrelated') risk_unrelated`);
    if (JSON.stringify(scopes.rows[0])!==JSON.stringify({
      business_ancestor:false,risk_member:true,risk_mall:true,risk_ancestor:true,risk_unrelated:false,
    })) {
      throw new Error(`ZHUDATUAN_WEB_RISK_SCOPE_INVALID:${JSON.stringify(scopes.rows[0])}`);
    }
    const visible=await database.query("select array_agg(id order by id) ids from risk.policy where id like 'risk:web-business-%'");
    if (JSON.stringify(visible.rows[0]?.ids)!==JSON.stringify(['risk:web-business-ancestor'])) {
      throw new Error(`ZHUDATUAN_WEB_RISK_RLS_INVALID:${JSON.stringify(visible.rows[0])}`);
    }
    const decisions=await database.query("select array_agg(id order by id) ids from access.decisionaudit where id like 'decision:web-business-%'");
    if (JSON.stringify(decisions.rows[0]?.ids)!==JSON.stringify([
      'decision:web-business-ancestor','decision:web-business-member',
    ])) {
      throw new Error(`ZHUDATUAN_WEB_DECISION_VELOCITY_RLS_INVALID:${JSON.stringify(decisions.rows[0])}`);
    }
    for (const expression of [
      "access.web_member_scope('membership:web-business-rls','session:web-business-rls')",
      "access.web_storefront_scope('membership:web-business-rls','session:web-business-rls')",
      "benefit.web_account_balance('membership:web-business-rls','session:web-business-rls')",
    ]) {
      await database.exec('savepoint direct_session_guard');
      let rejected=false;
      try { await database.query(`select * from ${expression}`); }
      catch (error) { rejected=String(error instanceof Error?error.message:error).includes('WEB_'); }
      await database.exec('rollback to savepoint direct_session_guard');
      if (!rejected) throw new Error(`ZHUDATUAN_WEB_SET_ROLE_HELPER_ALLOWED:${expression}`);
    }
  } finally {
    await database.exec('rollback');
  }
}

async function verifySandboxCatalogBootstrap(database) {
  const sql = await readFile(SANDBOX_CATALOG,'utf8');
  await database.exec(`begin; set local role zhudatuansandboxbootstrap;
    select pg_advisory_xact_lock(hashtext('zhudatuan:sandbox-catalog:v1'));
    select pg_advisory_xact_lock(hashtextextended('audit:mall-zhudatuan',0));`);
  try {
    await execute(database,sql,'sandbox catalog first replay');
    await execute(database,sql,'sandbox catalog idempotent replay');
    const result=await database.query(`select
      (select count(*)::integer from experience.application where id='application:zhudatuan:sandbox:v1') applications,
      (select count(*)::integer from experience.release where id='release:zhudatuan:sandbox:v1' and state='active') releases,
      (select count(*)::integer from experience.publication where id='publication:zhudatuan:sandbox:v1' and state='active') publications,
      (select count(*)::integer from catalog.product where id='product:zhudatuan:sandbox:welcome') products,
      (select count(*)::integer from catalog.sku where id='sku:zhudatuan:sandbox:welcome') skus,
      (select count(*)::integer from catalog.listing where id='listing:zhudatuan:sandbox:welcome') listings,
      (select count(*)::integer from pricing.price where id='price:zhudatuan:sandbox:welcome') prices,
      (select count(*)::integer from inventory.stockitem where id='stock:zhudatuan:sandbox:welcome') stocks,
      (select count(*)::integer from audit.record
        where id in('audit:zhudatuan:sandbox-catalog:v1','audit:zhudatuan:sandbox-publication:v1')) audits`);
    if (JSON.stringify(result.rows[0])!==JSON.stringify({
      applications:1,releases:1,publications:1,products:1,skus:1,listings:1,prices:1,stocks:1,audits:2,
    })) {
      throw new Error(`SANDBOX_CATALOG_REPLAY_INVALID:${JSON.stringify(result.rows[0])}`);
    }
  } finally {
    await database.exec('rollback');
  }
  const leaked=await database.query("select count(*)::integer count from catalog.product where id='product:zhudatuan:sandbox:welcome'");
  if (leaked.rows[0]?.count!==0) throw new Error('SANDBOX_CATALOG_REPLAY_LEAKED');
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
    (select count(*)::integer from member.invite
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
  const row=baseline.rows[0];
  if (JSON.stringify(row)!==JSON.stringify({ organizations:3,active_policies:1,canonical_policy:1,legacy_invites:0,legacy_employee_assignments:0,
    employee_role:1,employee_permissions:14,audit_records:1 })) {
    throw new Error(`ZHUDATUAN_REGISTRATION_BASELINE_INVALID:${JSON.stringify(row)}`);
  }
  await verifyPhoneAssuranceRevocation(database);
  await execute(database, await readFile(join(MIGRATIONS,'20260828170000_zhudatuan_registration_baseline.sql'),'utf8'),
    'idempotent zhudatuan registration baseline replay');
  const afterReplay = await zhudatuanRegistrationFingerprint(database);
  if (JSON.stringify(afterReplay)!==JSON.stringify(beforeReplay)) {
    throw new Error(`ZHUDATUAN_REGISTRATION_BASELINE_NOT_IDEMPOTENT:${JSON.stringify({ beforeReplay,afterReplay })}`);
  }
  // The historical baseline intentionally recreates its original policies.
  // Restore the immutable forward repair before any current-head ACL checks.
  const bootstrapRepair = await readFile(join(MIGRATIONS,REGISTRATION_BOOTSTRAP_REPAIR),'utf8');
  await execute(database,
    omitExactEnvironmentAssertion(bootstrapRepair,REGISTRATION_BOOTSTRAP_REPLAY_FUTURE_HEAD_ASSERTION,REGISTRATION_BOOTSTRAP_REPAIR),
    'idempotent zhudatuan registration bootstrap repair replay');
  const identityLoginAclRepair = await readFile(join(MIGRATIONS,IDENTITY_LOGIN_ACL_REPAIR),'utf8');
  await execute(database,
    omitExactEnvironmentAssertion(identityLoginAclRepair,IDENTITY_LOGIN_ACL_REPLAY_FUTURE_HEAD_ASSERTION,IDENTITY_LOGIN_ACL_REPAIR),
    'idempotent zhudatuan identity login ACL repair replay');
  await execute(database,
    await readFile(join(MIGRATIONS,OPERATOR_INVITATION_REGISTRATION),'utf8'),
    'idempotent zhudatuan operator invitation registration replay');
}

async function verifyPhoneAssuranceRevocation(database) {
  const token='7'.repeat(64);
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
    const active=await database.query('select assurance_level from identity.resolve_session($1)',[token]);
    if (active.rows[0]?.assurance_level!==2) throw new Error(`PHONE_ASSURANCE_ACTIVE_INVALID:${JSON.stringify(active.rows)}`);
    await database.query("update identity.assurance set expires_at=clock_timestamp() where id='assurance:registration-assurance-replay'");
    const expired=await database.query('select assurance_level from identity.resolve_session($1)',[token]);
    if (expired.rows[0]?.assurance_level!==1) throw new Error(`PHONE_ASSURANCE_REVOCATION_INVALID:${JSON.stringify(expired.rows)}`);
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
    (select coalesce(sum(version),0)::text from member.invite
      where id='invite-demo-employee-2026') legacy_invitation_versions,
    (select count(*)::integer from audit.record where id like 'audit:zhudatuan:registration-baseline:%') audit_records,
    (select count(*)::integer from access.membership membership join member.profile profile on profile.id=membership.member_id
      join identity.principal principal on principal.id=profile.principal_id
      where membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
        and (membership.status in('active','invited') or profile.status='active' or principal.status='active')) unexpired_legacy_assignments`);
  return result.rows[0];
}

async function verifyExtensionLifecycle(database) {
  const hash='c'.repeat(64);
  const manifest=JSON.stringify({id:'replayprovider',kind:'channel',priority:1,version:'1.0.0',apiVersion:'2026-08-21',
    contractVersion:'replay.v1',healthOperation:'local',capabilities:['Catalog'],permissions:[],configSchema:'replay.v1',
    eventSubscriptions:[],secretRefs:[],limits:{connectionTimeoutMs:1,responseTimeoutMs:1,totalDeadlineMs:1,maxConcurrency:1,
      requestsPerSecond:1,maxAttempts:1,failureThreshold:1,recoveryMs:100},signature:'c2lnbmVk'});
  await database.query(`insert into extension.manifest(id,version,kind,contract_version,manifest,manifest_hash,signature,registered_at)
    values('replayprovider','1.0.0','channel','replay.v1',$1::jsonb,$2,'c2lnbmVk',clock_timestamp());`,[manifest,hash]);
  await database.exec(`insert into extension.contractversion(extension_id,contract_version,schema_hash,status)
    values('replayprovider','replay.v1','${hash}','verified');
    insert into extension.installation(id,extension_id,extension_version,scope_id,status,manifest,base_url,endpoints,secret_ref,health_operation,installed_at)
    values('extension:replay-active','replayprovider','1.0.0','rls-scope-a','enabled','${manifest}'::jsonb,'https://replay.invalid','{"local":"/health"}','secret/replay','local',clock_timestamp()),
      ('extension:replay-candidate','replayprovider','1.0.0','rls-scope-a','testing','${manifest}'::jsonb,'https://replay.invalid','{"local":"/health"}','secret/replay','local',clock_timestamp());`);
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
  await database.exec('rollback');
  if (!mutationRejected) throw new Error('EXTENSION_MANIFEST_MUTATION_ALLOWED');
}

async function verifyAuditImmutability(database) {
  const hash='b'.repeat(64);
  await database.exec(`insert into audit.record(id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,
    evidence,trace_id,previous_hash,record_hash,recorded_at) values('audit:immutability','organization-platform-root','audit-test','system',
    'audit.test','audit','audit:immutability',null,null,'{}','audit:test',null,'${hash}',clock_timestamp());`);
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),
    set_config('app.scope_id','organization-platform-root',true);`);
  let rejected=false; let changed=0;
  try { changed=(await database.query("update audit.record set action='mutated' where id='audit:immutability'")).rowCount ?? 0; }
  catch (error) {
    if (!String(error instanceof Error?error.message:error).includes('AUDIT_IMMUTABLE')) throw error;
    rejected=true;
  }
  await database.exec('rollback');
  if (!rejected && changed!==0) throw new Error('AUDIT_UPDATE_WAS_NOT_REJECTED');
  const unchanged=await database.query("select action from audit.record where id='audit:immutability'");
  if (unchanged.rows[0]?.action!=='audit.test') throw new Error('AUDIT_UPDATE_IMMUTABILITY_INVALID');
  await database.exec(`begin; set local role shopjob; select set_config('app.workload','jobs',true),set_config('app.audit_archive','true',true);
    delete from audit.record where id='audit:immutability'; commit;`);
  const deleted=await database.query("select count(*)::integer count from audit.record where id='audit:immutability'");
  if (deleted.rows[0]?.count!==0) throw new Error('AUDIT_ARCHIVE_DELETE_INVALID');
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
  if (JSON.stringify(visible.rows[0]?.ids)!==JSON.stringify(['rls-policy-a'])) throw new Error('RLS_SCOPE_READ_ISOLATION_INVALID');
  await database.exec(`begin; set local role shopapp;
    select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','rls-auditor',true);`);
  try {
    await database.query("insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values('rls-policy-forbidden','rls-scope-b','forbidden','draft',1,clock_timestamp())");
  } catch (error) {
    await database.exec('rollback');
    if (!String(error instanceof Error ? error.message : error).toLowerCase().includes('row-level security')) throw error;
    return;
  }
  await database.exec('rollback');
  throw new Error('RLS_SCOPE_WRITE_ISOLATION_INVALID');
}

async function verifyObjectContract(database) {
  const contract = parse(await readFile(OBJECTS, 'utf8'));
  const entries = Array.isArray(contract?.objects) ? contract.objects : [];
  const schemas = entries.filter((entry) => entry.kind === 'schema').map((entry) => entry.id).sort();
  const expected = new Map([
    ['schema', new Set(schemas)],
    ['table', new Set(entries.filter((entry) => entry.kind === 'table').map((entry) => entry.id))],
    ['view', new Set(entries.filter((entry) => entry.kind === 'view').map((entry) => entry.id))],
    ['function', new Set(entries.filter((entry) => entry.kind === 'function').map((entry) => entry.id))],
    ['trigger', new Set(entries.filter((entry) => entry.kind === 'trigger').map((entry) => entry.id))],
    ['policy', new Set(entries.filter((entry) => entry.kind === 'policy').map((entry) => entry.id))],
    ['grant', new Set(entries.filter((entry) => entry.kind === 'grant').map((entry) => entry.id))],
  ]);
  if (mode === '--registration-fresh') {
    for (const id of [
      'access.membership.zhudatuanregistrationboundary_runtime_guard',
      'access.membershiprole.zhudatuanregistrationboundary_runtime_guard',
      'access.role.zhudatuanregistrationboundary_runtime_guard',
      'runtime.schemaversion.zhudatuanregistrationboundary_runtime_guard',
    ]) expected.get('policy').add(id);
  }
  const schemaRows = await database.query('select schema_name id from information_schema.schemata where schema_name=any($1::text[])', [schemas]);
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
      where role<>owner and has_function_privilege(role,oid,'EXECUTE')`, [schemas]);
  compareSet('grant', expected.get('grant'), roleRows.rows.map((row) => row.id));
}

function compareSet(kind, expected, actualValues) {
  const actual = new Set(actualValues);
  const missing = [...expected].filter((value) => !actual.has(value)).sort();
  const extra = [...actual].filter((value) => !expected.has(value)).sort();
  if (missing.length || extra.length) throw new Error(`DATABASE_OBJECT_${kind.toUpperCase()}_DRIFT:${JSON.stringify({ missing, extra })}`);
}
