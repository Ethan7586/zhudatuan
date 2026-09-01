import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFile(resolve(root, path), 'utf8');

const [deliverySource, buildSource, packageSource, serviceSource, environmentSource, bootstrapSource, predecessorMigrationSource, runnerSource, postgresInitSource, reconciliationSource, databaseAuditSource,postgresInitFixtureSource] = await Promise.all([
  read('infrastructure/zhudatuan/aliyun/delivery.yml'),
  read('scripts/build-commerce.mjs'),
  read('package.json'),
  read('infrastructure/zhudatuan/aliyun/systemd/zhudatuan-registration-bootstrap.service'),
  read('infrastructure/zhudatuan/aliyun/registration-bootstrap.env.example'),
  read('tools/seed/src/BootstrapRegistration.ts'),
  read('database/supabase/migrations/20260829040000_zhudatuan_registration_bootstrap_runtime_repair.sql'),
  read('services/commerce/src/foundation/infrastructure/RegistrationMigrationRunner.ts'),
  read('infrastructure/zhudatuan/aliyun/postgres-init-registration.sh'),
  read('infrastructure/zhudatuan/aliyun/postgres-reconcile-registration-boundary.sql'),
  read('scripts/audit/database-contracts.mjs'),
  read('scripts/audit/postgres-init-registration.pg16-fixture.mjs'),
]);

const delivery = parse(deliverySource);
const reconciliation = delivery?.oneShots?.registrationBoundaryReconcile;
const expectedReconciliation = {
  artifact: 'infrastructure/zhudatuan/aliyun/postgres-reconcile-registration-boundary.sql',
  invocation: 'docker-compose-psql-stdin',
  databaseRole: 'cluster-owner',
  before: ['registrationBootstrap', 'ownerBootstrap'],
  runtimeRoles: ['zhudatuanbootstrap', 'shopmigration'],
  publicRuntimeRole: 'forbidden',
};
if (JSON.stringify(reconciliation) !== JSON.stringify(expectedReconciliation)) {
  throw new Error(`REGISTRATION_BOUNDARY_RECONCILIATION_DELIVERY_INVALID:${JSON.stringify(reconciliation)}`);
}
const oneShot = delivery?.oneShots?.registrationBootstrap;
const expectedOneShot = {
  artifact: 'services/commerce/dist/BootstrapRegistration.js',
  process: 'zhudatuan-registration-bootstrap.service',
  service: 'infrastructure/zhudatuan/aliyun/systemd/zhudatuan-registration-bootstrap.service',
  environment: 'infrastructure/zhudatuan/aliyun/registration-bootstrap.env.example',
  output: '/opt/zhudatuan/shared/registration-bootstrap/registration-invitation.json',
  databaseRole: 'zhudatuanbootstrap',
  publicOperatorRole: 'forbidden',
};
if (JSON.stringify(oneShot) !== JSON.stringify(expectedOneShot)) {
  throw new Error(`REGISTRATION_BOOTSTRAP_DELIVERY_INVALID:${JSON.stringify(oneShot)}`);
}

if (!buildSource.includes("BootstrapRegistration: 'tools/seed/src/BootstrapRegistration.ts'")) {
  throw new Error('REGISTRATION_BOOTSTRAP_BUILD_ENTRY_MISSING');
}
const packageJson = JSON.parse(packageSource);
if (packageJson.scripts?.['bootstrap:registration:production'] !== 'node services/commerce/dist/BootstrapRegistration.js') {
  throw new Error('REGISTRATION_BOOTSTRAP_PRODUCTION_COMMAND_INVALID');
}

for (const token of [
  'ConditionPathExists=/opt/zhudatuan/current/services/commerce/dist/BootstrapRegistration.js',
  'ConditionPathExists=/opt/zhudatuan/shared/registration-bootstrap.env',
  'ConditionPathIsDirectory=/opt/zhudatuan/shared/registration-bootstrap',
  'EnvironmentFile=/opt/zhudatuan/shared/registration-bootstrap.env',
  'ExecStart=/usr/bin/node services/commerce/dist/BootstrapRegistration.js',
  'User=zhudatuan',
  'Group=zhudatuan',
  'UMask=0077',
  'NoNewPrivileges=true',
  'ProtectSystem=strict',
  'ReadOnlyPaths=/opt/zhudatuan/current /opt/zhudatuan/shared',
  'ReadWritePaths=/opt/zhudatuan/shared/registration-bootstrap',
]) {
  if (!serviceSource.includes(token)) throw new Error(`REGISTRATION_BOOTSTRAP_SERVICE_BOUNDARY_MISSING:${token}`);
}
if (serviceSource.includes('--import tsx') || serviceSource.includes('tools/seed/src/BootstrapRegistration.ts')) {
  throw new Error('REGISTRATION_BOOTSTRAP_RUNTIME_COMPILATION_FORBIDDEN');
}
if (!environmentSource.includes('ZHUDATUAN_REGISTRATION_BOOTSTRAP_OUTPUT=/opt/zhudatuan/shared/registration-bootstrap/registration-invitation.json')) {
  throw new Error('REGISTRATION_BOOTSTRAP_OUTPUT_BOUNDARY_INVALID');
}
if (/\bfor\s+update\b/i.test(bootstrapSource)) {
  throw new Error('REGISTRATION_BOOTSTRAP_DIRECT_UPDATE_PRIVILEGE_FORBIDDEN');
}
for (const token of [
  '\\getenv expected_server_addr ZHUDATUAN_EXPECTED_RDS_SERVER_ADDR',
  '\\getenv database_sentinel ZHUDATUAN_DATABASE_SENTINEL',
  '\\getenv shopmigration_password SHOPMIGRATION_PASSWORD',
  'ZHUDATUAN_RDS_INIT_POSTGRES_VERSION_INVALID',
  'ZHUDATUAN_RDS_INIT_SERVER_ADDRESS_INVALID',
  'ZHUDATUAN_RDS_INIT_PRISTINE_TARGET_REQUIRED',
  'ZHUDATUAN_RDS_INIT_EXISTING_TARGET_INVALID',
  'set local role zhudatuanregistrationboundary;',
  'alter role anon nologin password null noinherit;',
  'on conflict(id) do nothing;',
  'grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap,shopmigration;',
  'ZHUDATUAN_RDS_INIT_BOUNDARY_MEMBERSHIP_REMAINS',
]) {
  if (!postgresInitSource.includes(token)) {
    throw new Error(`REGISTRATION_BOOTSTRAP_DEFINER_BOUNDARY_MISSING:${token}`);
  }
}
if ((postgresInitSource.match(/\bexec \/usr\/bin\/psql\b/g)??[]).length!==1
  || /--set[^\n]*(?:password|sentinel)/i.test(postgresInitSource)
  || /on conflict\s*\([^)]*\)\s*do update/i.test(postgresInitSource)
  || /alter role[^;\n]*nosuperuser/i.test(postgresInitSource)) {
  throw new Error('REGISTRATION_RDS_INIT_TRANSACTION_OR_SECRET_BOUNDARY_INVALID');
}
const targetGuardEnd = postgresInitSource.indexOf('$target_guard$;');
for (const token of ['create extension if not exists pgcrypto','create role anon','alter database %I owner to shopmigration','create schema if not exists deployment']) {
  if (targetGuardEnd<0 || postgresInitSource.indexOf(token)<=targetGuardEnd) {
    throw new Error(`REGISTRATION_RDS_INIT_DDL_PRECEDES_TARGET_GUARD:${token}`);
  }
}
for (const forbidden of [
  'create_compatibility_role zhudatuanregistrationboundary',
  'alter function deployment.registration_bootstrap_boundary(text) owner to zhudatuanregistrationboundary;',
  'alter function deployment.is_independent_registration_database() owner to zhudatuanregistrationboundary;',
]) {
  if (postgresInitSource.includes(forbidden)) throw new Error(`REGISTRATION_BOOTSTRAP_PREMATURE_BOUNDARY_OWNER:${forbidden}`);
}
for (const token of [
  "current_database()<>'zhudatuan_registration'",
  "to_regrole('pg_rds_superuser')",
  "pg_has_role(authority,rds_superuser,'MEMBER')",
  "boundary_owner_name constant text := 'zhudatuanregistrationboundary'",
  'ZHUDATUAN_REGISTRATION_BOUNDARY_OWNER_MISSING',
  "alter role %I nologin password null noinherit",
  'create role %I nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls',
  "member=boundary_owner",
  "roleid=boundary_owner",
  "alter function deployment.registration_bootstrap_boundary(text) owner to %I",
  "alter function deployment.is_independent_registration_database() owner to %I",
  'ZHUDATUAN_REGISTRATION_BOUNDARY_OWNER_FINAL_STATE_INVALID',
  "function.prosecdef",
  "function.provolatile='s'",
  "session_user\\s*=\\s*'zhudatuanbootstrap'",
  "cross join lateral aclexplode",
  "encode(pg_catalog.sha256(pg_catalog.convert_to(p_sentinel,'UTF8')),'hex')",
  "set search_path=pg_catalog,deployment as $function$",
  "has_schema_privilege('zhudatuanregistrationboundary','public','USAGE')",
  "has_schema_privilege('zhudatuanregistrationboundary','public','CREATE')",
  'ZHUDATUAN_REGISTRATION_BOUNDARY_PUBLIC_FUNCTION_ACL_INVALID',
  "grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap,shopmigration;",
  "grant execute on function deployment.is_independent_registration_database() to shopmigration;",
  'create or replace function deployment.runtime_database_boundary()',
  'set local role zhudatuanregistrationboundary;',
  'reset role;',
  'grant execute on function deployment.runtime_database_boundary()',
  'ZHUDATUAN_RUNTIME_DATABASE_BOUNDARY_ACL_DRIFT',
  "ZHUDATUAN_REGISTRATION_BOOTSTRAP_BOUNDARY_ACL_DRIFT",
  "ZHUDATUAN_REGISTRATION_MIGRATION_BOUNDARY_ACL_DRIFT",
]) {
  if (!reconciliationSource.includes(token)) {
    throw new Error(`REGISTRATION_BOUNDARY_RECONCILIATION_GUARD_MISSING:${token}`);
  }
}
const initBootstrapBoundary = postgresInitSource.match(
  /create or replace function deployment\.registration_bootstrap_boundary\(p_sentinel text\)[\s\S]*?\$function\$;/,
)?.[0]??'';
const boundaryRoleStart = reconciliationSource.indexOf('set local role zhudatuanregistrationboundary;');
const reconciledBootstrapBoundary = (boundaryRoleStart < 0 ? '' : reconciliationSource.slice(boundaryRoleStart)).match(
  /(create or replace function deployment\.registration_bootstrap_boundary\(p_sentinel text\)[\s\S]*?\$function\$;)/,
)?.[1]??'';
for (const [label,source] of [
  ['init',initBootstrapBoundary],
  ['reconciliation',reconciledBootstrapBoundary],
]) {
  if (!source.includes("set search_path=pg_catalog,deployment as $function$")
    || !source.includes("encode(pg_catalog.sha256(pg_catalog.convert_to(p_sentinel,'UTF8')),'hex')")
    || /\bpublic\s*\./i.test(source)) {
    throw new Error(`REGISTRATION_BOOTSTRAP_PUBLIC_SCHEMA_DEPENDENCY:${label}`);
  }
}
for (const forbidden of [
  'grant usage on schema public to %I',
  'grant execute on function public.digest(text,text) to %I',
]) {
  if (reconciliationSource.includes(forbidden)) {
    throw new Error(`REGISTRATION_BOUNDARY_PUBLIC_PRIVILEGE_GRANT_FORBIDDEN:${forbidden}`);
  }
}
for (const token of [
  'positive=2','wrong-address=1','nonempty=1','wrong-sentinel=1','zero-mutation=3',
  'assertSnapshot(pristine','assertSnapshot(nonempty','assertSnapshot(initialized',
  "proof!=='t|shopmigration|0|1|14'",'POSTGRES_INIT_FIXTURE_SECRET_OUTPUT',
]) {
  if (!postgresInitFixtureSource.includes(token)) {
    throw new Error(`REGISTRATION_RDS_INIT_PG16_FIXTURE_GUARD_MISSING:${token}`);
  }
}
for (const token of [
  "mode === '--registration-boundary-postgres'",
  "current_setting('allow_system_table_mods')",
  'local-disposable-fixture',
  'set session authorization registration_boundary_outsider',
  'ZHUDATUAN_REGISTRATION_BOUNDARY_RECONCILE_AUTHORITY_INVALID',
  'set session authorization rds_boundary_admin',
  'RDS-like registration boundary idempotent reconciliation',
  'REGISTRATION_BOUNDARY_FIRST_PASS_CANONICAL_INVALID',
  'REGISTRATION_BOUNDARY_LEGACY_UPGRADE_FIXTURE_INVALID',
  'boundary_public_usage:false',
  'boundary_digest_execute:false',
  "['public-digest','select public.digest",
  'legacy-upgrade=1',
  'owner_memberships:0',
]) {
  if (!databaseAuditSource.includes(token)) {
    throw new Error(`REGISTRATION_BOUNDARY_POSTGRES_REPLAY_GUARD_MISSING:${token}`);
  }
}

const predecessorMarker = predecessorMigrationSource.match(/values\('20260829040000','([a-f0-9]{64})'\)/)?.[1];
if (!predecessorMarker || predecessorMarker === '0'.repeat(64)) {
  throw new Error('REGISTRATION_BOOTSTRAP_SCHEMA_MARKER_DRIFT');
}
const normalizedPredecessorDigest = createHash('sha256')
  .update(predecessorMigrationSource.replaceAll(predecessorMarker, '0'.repeat(64)))
  .digest('hex');
if (normalizedPredecessorDigest !== predecessorMarker) throw new Error('REGISTRATION_BOOTSTRAP_NORMALIZED_DIGEST_DRIFT');

const migrationFiles = (await readdir(resolve(root, 'database/supabase/migrations')))
  .filter((name) => name.endsWith('.sql'))
  .sort();
const targetFile = migrationFiles.at(-1);
const targetVersion = targetFile?.slice(0, 14);
const migrationSource = targetFile ? await read(`database/supabase/migrations/${targetFile}`) : '';
const migrationMarker = targetVersion
  ? migrationSource.match(new RegExp(`values\\('${targetVersion}','([a-f0-9]{64})'\\)`))?.[1]
  : undefined;
const runnerVersion = runnerSource.match(/REGISTRATION_TARGET_VERSION = '([0-9]{14})'/)?.[1];
const runnerMarker = runnerSource.match(/REGISTRATION_TARGET_CHECKSUM = '([a-f0-9]{64})'/)?.[1];
if (!targetFile || !targetVersion || runnerVersion !== targetVersion
  || !migrationMarker || migrationMarker === '0'.repeat(64) || migrationMarker !== runnerMarker) {
  throw new Error('REGISTRATION_TARGET_SCHEMA_MARKER_DRIFT');
}
const normalizedDigest = createHash('sha256')
  .update(migrationSource.replaceAll(migrationMarker, '0'.repeat(64)))
  .digest('hex');
if (normalizedDigest !== migrationMarker) throw new Error('REGISTRATION_TARGET_NORMALIZED_DIGEST_DRIFT');
if (!runnerSource.includes(`name='${targetFile}'`)) {
  throw new Error('REGISTRATION_RUNNER_TARGET_INVALID');
}

process.stdout.write('registration deployment checks passed\n');
