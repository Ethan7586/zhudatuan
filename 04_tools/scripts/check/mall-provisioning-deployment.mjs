import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const root = repositoryRoot;
const read = (path) => readFile(resolve(root, path), 'utf8');
const [main, runtime, moduleSource, operations, config, configTest, service, environment, caddy, delivery,
  migration, governanceMigration, runner, build, roleProvisioner, objectContract] = await Promise.all([
  read('01_core_hexin/services/commerce/src/entry/MallProvisioningApiMain.ts'),
  read('01_core_hexin/services/commerce/src/bootstrap/MallProvisioningApiRuntime.ts'),
  read('01_core_hexin/services/commerce/src/modules/provisioning/MallProvisioningModule.ts'),
  read('01_core_hexin/services/commerce/src/modules/provisioning/ProvisioningOperations.ts'),
  read('01_core_hexin/packages/config/src/MallProvisioningApiEnvironment.ts'),
  read('01_core_hexin/packages/config/src/MallProvisioningApiEnvironment.test.ts'),
  read('02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-mall-provisioning-api.service'),
  read('02_platform_pingtai/infrastructure/zhudatuan/aliyun/mall-provisioning-api.env.example'),
  read('02_platform_pingtai/infrastructure/zhudatuan/aliyun/Caddyfile'),
  read('02_platform_pingtai/infrastructure/zhudatuan/aliyun/delivery.yml'),
  read('02_platform_pingtai/database/supabase/migrations/20260902012000_zhudatuan_mall_provisioning_access.sql'),
  read('02_platform_pingtai/database/supabase/migrations/20260902132000_canonical_governance_context.sql'),
  read('01_core_hexin/services/commerce/src/foundation/infrastructure/RegistrationMigrationRunner.ts'),
  read('04_tools/scripts/build-commerce.mjs'),
  read('02_platform_pingtai/infrastructure/zhudatuan/aliyun/postgres-provision-mall-role.sh'),
  read('02_platform_pingtai/database/contracts/objects.yml'),
]);

for (const token of [
  'MallProvisioningRuntimeModule',
  'MallProvisioningModule',
  'MALL_PROVISIONING_RUNTIME_OPERATION_IDS',
  'MALL_PROVISIONING_OPERATION_IDS',
  "listen(bootstrapped.app, mallProvisioningApiPort(environment), '127.0.0.1')",
]) if (!main.includes(token)) throw new Error(`MALL_PROVISIONING_ENTRY_TOKEN_MISSING:${token}`);
for (const forbidden of ['COMMERCE_MODULES', 'ApiMain', 'PurchaseApi', 'WebBusinessApi']) {
  if (main.includes(forbidden)) throw new Error(`MALL_PROVISIONING_ENTRY_COUPLING_FORBIDDEN:${forbidden}`);
}
if (!moduleSource.includes("defineSelectedModule(\n  'provisioning'")
  || moduleSource.includes("['organization', 'catalog', 'experience']")) {
  throw new Error('MALL_PROVISIONING_SELECTED_MODULE_INVALID');
}
if (!operations.includes("'provisioning.malls.create'")
  || !operations.includes("'provisioning.malls.read'")
  || operations.match(/provisioning\.[a-z.]+/g)?.length !== 4) {
  throw new Error('MALL_PROVISIONING_OPERATION_SET_INVALID');
}

for (const token of [
  "current_user !== 'zhudatuanprovisioningapi'",
  "session_user !== 'zhudatuanprovisioningapi'",
  "not has_table_privilege(current_user,'identity.session'",
  "not has_schema_privilege(current_user,'ordering','USAGE')",
  "not has_schema_privilege(current_user,'payment','USAGE')",
  "not has_schema_privilege(current_user,'finance','USAGE')",
  'await assertMallProvisioningRuntimeCompatibility(pool)',
]) if (!runtime.includes(token)) throw new Error(`MALL_PROVISIONING_RUNTIME_TOKEN_MISSING:${token}`);

const configKeysBlock = config.match(/MALL_PROVISIONING_API_ENVIRONMENT_KEYS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\s*as const\)/)?.[1] ?? '';
const configKeys = [...configKeysBlock.matchAll(/'([A-Z][A-Z0-9_]*)'/g)].map((match) => match[1]);
assertExactSet(configKeys, [
  'MALL_PROVISIONING_API_PROFILE', 'API_PORT', 'API_BIND_HOST', 'APP_ENV', 'AUTH_MODE', 'SERVICE_VERSION',
  'API_ALLOWED_ORIGINS', 'DATABASE_API_CONNECTION_REF', 'SECRET_STORE_ENDPOINT', 'SECRET_STORE_BEARER_TOKEN',
], 'MALL_PROVISIONING_CONFIG_KEYS');
for (const token of ["MALL_PROVISIONING_API_PROFILE = 'mall-provisioning-only'", '!== 4325',
  "origins.join(',') !== 'https://console.zhudatuan.com'", 'KMS_ENDPOINT']) {
  if (token === 'KMS_ENDPOINT' ? !configTest.includes(token) : !config.includes(token)) {
    throw new Error(`MALL_PROVISIONING_CONFIG_BOUNDARY_MISSING:${token}`);
  }
}

for (const token of [
  'ConditionPathExists=/opt/zhudatuan/current/01_core_hexin/services/commerce/dist/MallProvisioningApiMain.js',
  'ConditionPathExists=/opt/zhudatuan/current/01_core_hexin/services/commerce/dist/MallProvisioningApiReadyMain.js',
  'Environment=MALL_PROVISIONING_API_PROFILE=mall-provisioning-only',
  'Environment=API_PORT=4325',
  'Environment=API_BIND_HOST=127.0.0.1',
  'EnvironmentFile=/opt/zhudatuan/shared/mall-provisioning-api.env',
  'ExecStart=/usr/bin/env MALL_PROVISIONING_API_PROFILE=mall-provisioning-only API_PORT=4325 API_BIND_HOST=127.0.0.1 /usr/bin/node 01_core_hexin/services/commerce/dist/MallProvisioningApiMain.js',
  'ExecStartPost=/usr/bin/env MALL_PROVISIONING_API_PROFILE=mall-provisioning-only API_PORT=4325 API_BIND_HOST=127.0.0.1 /usr/bin/node 01_core_hexin/services/commerce/dist/MallProvisioningApiReadyMain.js',
]) if (!service.includes(token)) throw new Error(`MALL_PROVISIONING_SYSTEMD_TOKEN_MISSING:${token}`);
if (service.includes('0.0.0.0') || service.includes('EnvironmentFile=-')) throw new Error('MALL_PROVISIONING_SYSTEMD_FAIL_OPEN');

const environmentKeys = environment.split(/\r?\n/).filter((line) => line && !line.startsWith('#'))
  .map((line) => line.slice(0, line.indexOf('=')));
assertExactSet(environmentKeys, [
  'APP_ENV', 'AUTH_MODE', 'SERVICE_VERSION', 'API_ALLOWED_ORIGINS', 'DATABASE_API_CONNECTION_REF',
  'SECRET_STORE_ENDPOINT', 'SECRET_STORE_BEARER_TOKEN', 'NODE_EXTRA_CA_CERTS',
], 'MALL_PROVISIONING_ENVIRONMENT_KEYS');
for (const token of ['API_ALLOWED_ORIGINS=https://console.zhudatuan.com',
  'DATABASE_API_CONNECTION_REF=zhudatuan/mall-provisioning/database/api',
  'SECRET_STORE_ENDPOINT=https://127.0.0.1:8543']) {
  if (!environment.includes(token)) throw new Error(`MALL_PROVISIONING_ENVIRONMENT_TOKEN_MISSING:${token}`);
}

if ((caddy.match(/path \/api\/v1\/provisioning\/malls/g) ?? []).length !== 3
  || (caddy.match(/reverse_proxy 127\.0\.0\.1:4325/g) ?? []).length !== 3
  || !caddy.includes('@mallProvisioningPreflight') || !caddy.includes('@mallProvisioningApi')
  || !caddy.includes('@mallProvisioningRead') || !caddy.includes('method GET')
  || !caddy.includes('path /api/v1/provisioning/malls/*')) {
  throw new Error('MALL_PROVISIONING_CADDY_ROUTE_INVALID');
}
for (const token of ['mallProvisioningApiPort: 4325', 'mallProvisioningApiProfile: mall-provisioning-only',
  'databaseRole: zhudatuanprovisioningapi', 'postgres-provision-mall-role.sh']) {
  if (!delivery.includes(token)) throw new Error(`MALL_PROVISIONING_DELIVERY_TOKEN_MISSING:${token}`);
}

for (const token of [
  "MallProvisioningApiMain: '01_core_hexin/services/commerce/src/entry/MallProvisioningApiMain.ts'",
  "MallProvisioningApiReadyMain: '01_core_hexin/services/commerce/src/entry/MallProvisioningApiReadyMain.ts'",
]) if (!build.includes(token)) throw new Error(`MALL_PROVISIONING_BUILD_ENTRY_MISSING:${token}`);

const marker = migration.match(/values\('20260902012000','([a-f0-9]{64})'\)/)?.[1];
const runtimeMarker = runtime.match(/MALL_PROVISIONING_SCHEMA_CHECKSUM = '([a-f0-9]{64})'/)?.[1];
if (!marker || marker === '0'.repeat(64)) throw new Error('MALL_PROVISIONING_SCHEMA_MARKER_DRIFT');
const normalized = createHash('sha256').update(migration.replaceAll(marker, '0'.repeat(64))).digest('hex');
if (normalized !== marker) throw new Error('MALL_PROVISIONING_SCHEMA_NORMALIZED_DIGEST_DRIFT');
const governanceMarker = governanceMigration.match(/values\('20260902132000','([a-f0-9]{64})'\)/)?.[1];
if (!governanceMarker || governanceMarker === '0'.repeat(64)) throw new Error('GOVERNANCE_SCHEMA_MARKER_MISSING');
const normalizedGovernance = createHash('sha256').update(governanceMigration.replaceAll(governanceMarker, '0'.repeat(64))).digest('hex');
if (normalizedGovernance !== governanceMarker) throw new Error('GOVERNANCE_SCHEMA_NORMALIZED_DIGEST_DRIFT');
const migrationFiles = (await readdir(resolve(root, '02_platform_pingtai/database/supabase/migrations')))
  .filter((name) => name.endsWith('.sql')).sort();
const runtimeVersion = runtime.match(/MALL_PROVISIONING_SCHEMA_VERSION = '(\d{14})'/)?.[1];
const runtimeMigrationFile = runtimeVersion
  ? migrationFiles.find((name) => name.startsWith(`${runtimeVersion}_`))
  : undefined;
const runtimeMigration = runtimeMigrationFile
  ? await read(`02_platform_pingtai/database/supabase/migrations/${runtimeMigrationFile}`)
  : '';
const recordedRuntimeMarker = runtimeVersion
  ? runtimeMigration.match(new RegExp(`values\\('${runtimeVersion}','([a-f0-9]{64})'\\)`))?.[1]
  : undefined;
if (!runtimeVersion || !runtimeMigrationFile || !runtimeMarker || runtimeMarker !== recordedRuntimeMarker
  || createHash('sha256').update(runtimeMigration.replaceAll(runtimeMarker, '0'.repeat(64))).digest('hex') !== runtimeMarker) {
  throw new Error('MALL_PROVISIONING_RUNTIME_SCHEMA_DRIFT');
}
const targetFile = migrationFiles.at(-1);
const targetVersion = targetFile?.slice(0, 14);
const targetSource = targetFile ? await read(`02_platform_pingtai/database/supabase/migrations/${targetFile}`) : '';
const targetMarker = targetVersion
  ? targetSource.match(new RegExp(`values\\('${targetVersion}','([a-f0-9]{64})'\\)`))?.[1]
  : undefined;
if (!targetFile || !targetVersion || !targetMarker || targetMarker === '0'.repeat(64)
  || !runner.includes(`REGISTRATION_TARGET_VERSION = '${targetVersion}'`)
  || !runner.includes(`REGISTRATION_TARGET_CHECKSUM = '${targetMarker}'`)
  || !runner.includes(`name='${targetFile}'`)) {
  throw new Error('MALL_PROVISIONING_MIGRATION_RUNNER_DRIFT');
}
const normalizedTarget = createHash('sha256')
  .update(targetSource.replaceAll(targetMarker, '0'.repeat(64))).digest('hex');
if (normalizedTarget !== targetMarker) throw new Error('MALL_PROVISIONING_TARGET_DIGEST_DRIFT');
for (const token of ['zhudatuanprovisioningapi', 'identity.resolve_session(text)', 'organization.organization',
  'catalog.pool', 'experience.application', "has_schema_privilege('zhudatuanprovisioningapi','finance','USAGE')"]) {
  if (!migration.includes(token)) throw new Error(`MALL_PROVISIONING_MIGRATION_BOUNDARY_MISSING:${token}`);
}
for (const token of ['ZHUDATUAN_EXPECTED_RDS_SERVER_ADDR', 'ZHUDATUAN_PROVISIONING_API_PASSWORD',
  "current_database()<>'zhudatuan_registration'", 'deployment.boundary',
  'create role zhudatuanprovisioningapi login password']) {
  if (!roleProvisioner.includes(token)) throw new Error(`MALL_PROVISIONING_ROLE_PROVISIONER_MISSING:${token}`);
}
if (roleProvisioner.includes('alter role zhudatuanprovisioningapi login password')) {
  throw new Error('MALL_PROVISIONING_ROLE_PROVISIONER_PASSWORD_ROTATION_FORBIDDEN');
}
if ((objectContract.match(/\.zhudatuanprovisioningapi(?:insert|select|update)?/g) ?? []).length !== 31) {
  throw new Error('MALL_PROVISIONING_POLICY_CONTRACT_INCOMPLETE');
}

console.log('mall provisioning deployment contract passed: operations=2 profile=selected role=dedicated port=4325 route=exact');

function assertExactSet(actual, expected, code) {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  if (left.length !== actual.length || JSON.stringify(left) !== JSON.stringify(right)) throw new Error(code);
}
