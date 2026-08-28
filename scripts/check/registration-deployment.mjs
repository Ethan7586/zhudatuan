import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFile(resolve(root, path), 'utf8');

const [deliverySource, buildSource, packageSource, serviceSource, environmentSource, bootstrapSource, predecessorMigrationSource, migrationSource, runnerSource, postgresInitSource, reconciliationSource] = await Promise.all([
  read('infrastructure/zhudatuan/aliyun/delivery.yml'),
  read('scripts/build-commerce.mjs'),
  read('package.json'),
  read('infrastructure/zhudatuan/aliyun/systemd/zhudatuan-registration-bootstrap.service'),
  read('infrastructure/zhudatuan/aliyun/registration-bootstrap.env.example'),
  read('tools/seed/src/BootstrapRegistration.ts'),
  read('database/supabase/migrations/20260829040000_zhudatuan_registration_bootstrap_runtime_repair.sql'),
  read('database/supabase/migrations/20260829054500_zhudatuan_identity_login_acl_repair.sql'),
  read('services/commerce/src/foundation/infrastructure/RegistrationMigrationRunner.ts'),
  read('infrastructure/zhudatuan/aliyun/postgres-init-registration.sh'),
  read('infrastructure/zhudatuan/aliyun/postgres-reconcile-registration-boundary.sql'),
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
if (!postgresInitSource.includes('grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap,shopmigration;')) {
  throw new Error('REGISTRATION_BOOTSTRAP_DEFINER_BOUNDARY_GRANT_MISSING');
}
for (const token of [
  "current_database()<>'zhudatuan_registration'",
  "not coalesce((select rolsuper from pg_roles where rolname=current_user),false)",
  "owner.rolsuper",
  "function.prosecdef",
  "function.provolatile='s'",
  "session_user\\s*=\\s*'zhudatuanbootstrap'",
  "cross join lateral aclexplode",
  "grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap,shopmigration;",
  "grant execute on function deployment.is_independent_registration_database() to shopmigration;",
  "ZHUDATUAN_REGISTRATION_BOOTSTRAP_BOUNDARY_ACL_DRIFT",
  "ZHUDATUAN_REGISTRATION_MIGRATION_BOUNDARY_ACL_DRIFT",
]) {
  if (!reconciliationSource.includes(token)) {
    throw new Error(`REGISTRATION_BOUNDARY_RECONCILIATION_GUARD_MISSING:${token}`);
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

const migrationMarker = migrationSource.match(/values\('20260829054500','([a-f0-9]{64})'\)/)?.[1];
const runnerMarker = runnerSource.match(/REGISTRATION_TARGET_CHECKSUM = '([a-f0-9]{64})'/)?.[1];
if (!migrationMarker || migrationMarker === '0'.repeat(64) || migrationMarker !== runnerMarker) {
  throw new Error('IDENTITY_LOGIN_ACL_SCHEMA_MARKER_DRIFT');
}
const normalizedDigest = createHash('sha256')
  .update(migrationSource.replaceAll(migrationMarker, '0'.repeat(64)))
  .digest('hex');
if (normalizedDigest !== migrationMarker) throw new Error('IDENTITY_LOGIN_ACL_NORMALIZED_DIGEST_DRIFT');
if (!runnerSource.includes("REGISTRATION_TARGET_VERSION = '20260829054500'") || !runnerSource.includes("name='20260829054500_zhudatuan_identity_login_acl_repair.sql'")) {
  throw new Error('IDENTITY_LOGIN_ACL_RUNNER_TARGET_INVALID');
}

process.stdout.write('registration deployment checks passed\n');
