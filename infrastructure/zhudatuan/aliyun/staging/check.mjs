import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const directory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(directory, '../../../..');
const require = createRequire(import.meta.url);
const identityProcesses = require(resolve(directory, 'ecosystem.identity-sms.config.cjs'));
const fullProcesses = require(resolve(directory, 'ecosystem.full.config.cjs'));

const files = Object.fromEntries(
  await Promise.all(
    [
      'Caddyfile.identity-sms',
      'Caddyfile.full',
      'delivery.yml',
      'artifacts.yml',
      'identity-registration-api.env.example',
      'identity-notification-jobs.env.example',
      'full-identity-registration-api.env.example',
      'full-jobs.env.example',
      'full-internal-runtime.env.example',
      'full-migration.env.example',
      'full-owner-bootstrap.env.example',
      'zhudatuan-staging-full-internal-runtime.service',
    ].map(async (name) => [name, await readFile(resolve(directory, name), 'utf8')])
  )
);
const delivery = parseYaml(files['delivery.yml']);
const artifacts = parseYaml(files['artifacts.yml']);
const identityCaddy = files['Caddyfile.identity-sms'];
const fullCaddy = files['Caddyfile.full'];
const environments = Object.fromEntries(
  Object.entries(files)
    .filter(([name]) => name.endsWith('.env.example'))
    .map(([name, source]) => [name, parseEnvironment(source)])
);

assert.deepEqual(identityProcesses.apps.map(({ name }) => name).sort(), ['zhudatuan-staging-identity-api', 'zhudatuan-staging-identity-notification-jobs']);
assert.deepEqual(fullProcesses.apps.map(({ name }) => name).sort(), ['zhudatuan-staging-full-identity-api', 'zhudatuan-staging-full-jobs']);

const identityApi = process(identityProcesses, 'zhudatuan-staging-identity-api');
const identityJobs = process(identityProcesses, 'zhudatuan-staging-identity-notification-jobs');
const fullApi = process(fullProcesses, 'zhudatuan-staging-full-identity-api');
const fullJobs = process(fullProcesses, 'zhudatuan-staging-full-jobs');
assertProcess(identityApi, '/opt/zhudatuan-staging/current', '/var/log/zhudatuan-staging/');
assertProcess(identityJobs, '/opt/zhudatuan-staging/current', '/var/log/zhudatuan-staging/');
assertProcess(fullApi, '/opt/zhudatuan-staging-full/current', '/var/log/zhudatuan-staging-full/');
assertProcess(fullJobs, '/opt/zhudatuan-staging-full/current', '/var/log/zhudatuan-staging-full/');

for (const token of [
  'APP_ENV=test',
  'AUTH_MODE=membership',
  'IDENTITY_REGISTRATION_API_PROFILE=registration-only',
  'API_PORT=4421',
  'API_BIND_HOST=127.0.0.1',
  '--env-file=/opt/zhudatuan-staging/shared/identity-registration-api.env',
  'services/commerce/dist/IdentityRegistrationApiMain.js',
])
  assert.ok(identityApi.args.includes(token), `identity API process token missing: ${token}`);
for (const token of ['APP_ENV=production', 'JOB_RUNTIME_PROFILE=identity-notification-only', '--env-file=/opt/zhudatuan-staging/shared/identity-notification-jobs.env', 'services/commerce/dist/IdentityNotificationJobsOnlyMain.js'])
  assert.ok(identityJobs.args.includes(token), `identity Jobs process token missing: ${token}`);
for (const token of [
  'APP_ENV=test',
  'AUTH_MODE=membership',
  'IDENTITY_REGISTRATION_API_PROFILE=registration-only',
  'API_PORT=4431',
  'API_BIND_HOST=127.0.0.1',
  '--env-file=/opt/zhudatuan-staging-full/shared/full-identity-registration-api.env',
  'services/commerce/dist/IdentityRegistrationApiMain.js',
])
  assert.ok(fullApi.args.includes(token), `full API process token missing: ${token}`);
for (const token of ['APP_ENV=production', 'JOB_RUNTIME_PROFILE=full', '--env-file=/opt/zhudatuan-staging-full/shared/full-jobs.env', 'services/commerce/dist/JobsMain.js'])
  assert.ok(fullJobs.args.includes(token), `full Jobs process token missing: ${token}`);
assert.ok(!fullJobs.args.includes('services/commerce/dist/IdentityNotificationJobsOnlyMain.js'));

assertCaddy(identityCaddy, {
  hosts: ['ZHUDATUAN_STAGING_ACCOUNTS_HOST', 'ZHUDATUAN_STAGING_CONSOLE_HOST', 'ZHUDATUAN_STAGING_API_HOST'],
  root: '/opt/zhudatuan-staging/current',
  upstream: '127.0.0.1:4421',
});
assertCaddy(fullCaddy, {
  hosts: ['ZHUDATUAN_STAGING_FULL_ACCOUNTS_HOST', 'ZHUDATUAN_STAGING_FULL_CONSOLE_HOST', 'ZHUDATUAN_STAGING_FULL_API_HOST'],
  root: '/opt/zhudatuan-staging-full/current',
  upstream: '127.0.0.1:4431',
});
assert.ok(!identityCaddy.includes('127.0.0.1:4431'));
assert.ok(!fullCaddy.includes('127.0.0.1:4421'));

assert.equal(delivery.version, 2);
assert.equal(delivery.deploymentState, 'blocked-awaiting-external-prerequisites');
assert.equal(delivery.productionTrafficPercent, 0);
assert.equal(delivery.productionDataAccess, 'forbidden');
assert.deepEqual(Object.keys(delivery.profiles).sort(), ['full', 'identity-sms']);
assert.equal(delivery.profiles['identity-sms'].selection, 'optional');
assert.equal(delivery.profiles.full.selection, 'owner-approved-target');
assert.equal(delivery.profiles.full.deployable, false);
assert.equal(delivery.profiles.full.runtime.identityApi.port, 4431);
assert.equal(delivery.profiles.full.runtime.jobs.artifact, 'services/commerce/dist/JobsMain.js');
assert.equal(delivery.profiles.full.runtime.jobs.implementationSource, 'services/commerce/src/entry/FullJobsMain.ts');
assert.equal(delivery.profiles.full.runtime.internalRuntime.artifact, 'services/commerce/dist/InternalRuntimeMain.js');
assert.equal(delivery.profiles.full.runtime.internalRuntime.readinessArtifact, 'services/commerce/dist/InternalRuntimeReadyMain.js');
assert.equal(delivery.profiles.full.runtime.internalRuntime.capability, 'secret-store-and-kms-only');
assert.equal(delivery.profiles.full.runtime.internalRuntime.secretStorePort, 8643);
assert.equal(delivery.profiles.full.runtime.internalRuntime.kmsPort, 8644);
assert.equal(delivery.profiles.full.dependencies.redis.connectionRef, 'zhudatuan/staging/full/redis/jobs');
assert.equal(delivery.profiles.full.dependencies.redis.productionEndpointReuse, 'forbidden');
assert.equal(delivery.profiles.full.dependencies.secretStore.bearerMode, 'one-shared-full-staging-runtime-token');
assert.equal(delivery.profiles.full.dependencies.kms.bearerMode, 'one-shared-full-staging-runtime-token');
assert.equal(delivery.profiles.full.dependencies.kms.secretStoreAndKmsTokensMustDiffer, true);
assert.equal(delivery.profiles.full.dependencies.objectStore.providedByInternalRuntime, false);
assert.deepEqual(delivery.oneShots.executionOrder, ['migration', 'registrationBoundaryReconcile', 'stagingOwnerBootstrap']);
assert.equal(delivery.oneShots.migration.artifact, 'services/commerce/dist/MigrationMain.js');
assert.equal(delivery.oneShots.stagingOwnerBootstrap.artifact, 'services/commerce/dist/BootstrapStagingOwner.js');
assert.equal(delivery.oneShots.registrationBootstrap.state, 'forbidden');
assert.equal(delivery.prerequisites.externalResourcesVerified, false);
assert.equal(delivery.prerequisites.loopbackProxy.databaseListener, '127.0.0.1:55442');
assert.equal(delivery.prerequisites.loopbackProxy.productionUpstream, 'forbidden');
assert.equal(delivery.prerequisites.internalRuntime.secretStoreListener, 'https://127.0.0.1:8643');
assert.equal(delivery.prerequisites.internalRuntime.kmsListener, 'https://127.0.0.1:8644');
assert.equal(delivery.prerequisites.internalRuntime.formalRuntimeAccess, 'forbidden');
assert.equal(delivery.routes.invitationAuthorization.wildcardDelete, 'forbidden');
assert.deepEqual(
  delivery.routes.publicIdentityAllowlist.filter(({ path }) => path === '/api/v1/identity/invitations'),
  [{ method: 'POST', path: '/api/v1/identity/invitations' }]
);
assert.deepEqual(
  delivery.routes.publicIdentityAllowlist.filter(({ pathRegex }) => pathRegex),
  [{ method: 'DELETE', pathRegex: '^/api/v1/identity/invitations/[^/]+$' }]
);
assert.deepEqual(delivery.routes.invitationPreflightAllowlist, [
  { method: 'OPTIONS', path: '/api/v1/identity/invitations' },
  { method: 'OPTIONS', pathRegex: '^/api/v1/identity/invitations/[^/]+$' },
]);

assert.equal(artifacts.state, 'inventory-only-not-provisioning-evidence');
const artifactsById = new Map(artifacts.releaseArtifacts.map((entry) => [entry.id, entry]));
assert.equal(artifactsById.get('fullJobs').artifact, 'services/commerce/dist/JobsMain.js');
assert.equal(artifactsById.get('fullJobs').bundledImplementation, 'services/commerce/src/entry/FullJobsMain.ts');
for (const id of ['internalRuntime', 'internalRuntimeReadiness', 'internalSecretStore', 'internalKms', 'migration', 'stagingOwnerBootstrap']) assert.ok(artifactsById.has(id), `artifact missing: ${id}`);
assert.equal(artifacts.explicitExclusions.find(({ artifact }) => artifact.endsWith('/FullJobsMain.js')).reason, 'no standalone build artifact; FullJobsMain.ts is bundled into JobsMain.js');
assert.ok(artifacts.explicitExclusions.some(({ artifact }) => artifact.endsWith('/BootstrapRegistration.js')));
assert.ok(artifacts.explicitExclusions.some(({ artifact }) => artifact.endsWith('/LocalObjectsMain.js')));

assertKeys(environments['identity-registration-api.env.example'], [
  'API_ALLOWED_ORIGINS',
  'AUTH_RETURN_TARGETS',
  'DATABASE_API_CONNECTION_REF',
  'IDENTITY_KEY_REF',
  'KMS_BEARER_TOKEN',
  'KMS_ENDPOINT',
  'NODE_EXTRA_CA_CERTS',
  'SECRET_STORE_BEARER_TOKEN',
  'SECRET_STORE_ENDPOINT',
  'SERVICE_VERSION',
  'SESSION_KEY_REF',
]);
assertKeys(environments['identity-notification-jobs.env.example'], [
  'DATABASE_JOB_CONNECTION_REF',
  'IDENTITY_NOTIFICATION_CONFIG_REF',
  'JOB_WORKER_ID',
  'KMS_BEARER_TOKEN',
  'KMS_ENDPOINT',
  'NODE_EXTRA_CA_CERTS',
  'SECRET_STORE_BEARER_TOKEN',
  'SECRET_STORE_ENDPOINT',
  'SERVICE_VERSION',
]);
assertKeys(environments['full-identity-registration-api.env.example'], [
  'API_ALLOWED_ORIGINS',
  'AUTH_RETURN_TARGETS',
  'DATABASE_API_CONNECTION_REF',
  'IDENTITY_KEY_REF',
  'KMS_BEARER_TOKEN',
  'KMS_ENDPOINT',
  'NODE_EXTRA_CA_CERTS',
  'SECRET_STORE_BEARER_TOKEN',
  'SECRET_STORE_ENDPOINT',
  'SERVICE_VERSION',
  'SESSION_KEY_REF',
]);
assertKeys(environments['full-jobs.env.example'], [
  'DATABASE_JOB_CONNECTION_REF',
  'EXTENSION_MANIFEST_KEY_REF',
  'INVOICE_CONFIG_REF',
  'JOB_WORKER_ID',
  'KMS_BEARER_TOKEN',
  'KMS_ENDPOINT',
  'NODE_EXTRA_CA_CERTS',
  'NOTIFICATION_CONFIG_REF',
  'OBJECT_STORE_ENDPOINT',
  'OBJECT_STORE_TOKEN_REF',
  'PAYOUT_CONFIG_REF',
  'REDIS_CONNECTION_REF',
  'SECRET_STORE_BEARER_TOKEN',
  'SECRET_STORE_ENDPOINT',
  'SERVICE_VERSION',
  'WECHAT_APPLICATION_CONFIG_REF',
  'WECHAT_PAYMENT_CONFIG_REF',
]);
assertKeys(environments['full-internal-runtime.env.example'], [
  'LOCAL_KMS_BEARER_TOKEN',
  'LOCAL_KMS_MASTER_KEY',
  'LOCAL_KMS_PORT',
  'LOCAL_SECRETS_FILE',
  'LOCAL_SECRETS_PORT',
  'LOCAL_SECRET_STORE_BEARER_TOKEN',
  'LOCAL_TLS_CERT_FILE',
  'LOCAL_TLS_KEY_FILE',
  'NODE_EXTRA_CA_CERTS',
]);
assertKeys(environments['full-migration.env.example'], [
  'KMS_BEARER_TOKEN',
  'KMS_ENDPOINT',
  'MIGRATION_APPROVAL',
  'MIGRATION_DATABASE_CONNECTION_REF',
  'MIGRATION_DIRECTORY',
  'MIGRATION_DISTRIBUTOR_KEY_REF',
  'MIGRATION_IDENTITY_KEY_REF',
  'MIGRATION_PARTNER_KEY_REF',
  'MIGRATION_SOURCE_SNAPSHOT_REF',
  'MIGRATION_VOUCHER_KEY_REF',
  'NODE_EXTRA_CA_CERTS',
  'SECRET_STORE_BEARER_TOKEN',
  'SECRET_STORE_ENDPOINT',
]);
assertKeys(environments['full-owner-bootstrap.env.example'], [
  'APP_ENV',
  'IDENTITY_KEY_REF',
  'NODE_EXTRA_CA_CERTS',
  'SECRET_STORE_BEARER_TOKEN',
  'SECRET_STORE_ENDPOINT',
  'ZHUDATUAN_OWNER_BOOTSTRAP_ACTOR',
  'ZHUDATUAN_OWNER_BOOTSTRAP_CONFIRM',
  'ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_NAME',
  'ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL',
  'ZHUDATUAN_OWNER_BOOTSTRAP_RECEIPT_REF',
  'ZHUDATUAN_OWNER_BOOTSTRAP_SENTINEL',
  'ZHUDATUAN_OWNER_PASSWORD_REF',
]);

const bearerValues = Object.values(environments).flatMap((environment) =>
  Object.entries(environment)
    .filter(([key]) => key.endsWith('BEARER_TOKEN'))
    .map(([, value]) => value)
);
for (const value of bearerValues) assert.match(value, /^[A-Za-z0-9_-]{43,512}$/);
const fullApiEnvironment = environments['full-identity-registration-api.env.example'];
const fullJobsEnvironment = environments['full-jobs.env.example'];
const fullMigrationEnvironment = environments['full-migration.env.example'];
const fullOwnerEnvironment = environments['full-owner-bootstrap.env.example'];
const fullInternalRuntimeEnvironment = environments['full-internal-runtime.env.example'];
const expectedFullCatalogKeys = [fullApiEnvironment, fullJobsEnvironment, fullMigrationEnvironment, fullOwnerEnvironment].flatMap((environment) =>
  Object.entries(environment)
    .filter(([key]) => key.endsWith('_REF') && key !== 'MIGRATION_SOURCE_SNAPSHOT_REF')
    .map(([, value]) => value)
);
assert.deepEqual([...delivery.profiles.full.dependencies.secretStore.catalogKeys].sort(), [...new Set(expectedFullCatalogKeys)].sort(), 'full-secrets catalog inventory must exactly cover every workload Secret ref');
const sharedSecretStoreBearer = fullInternalRuntimeEnvironment.LOCAL_SECRET_STORE_BEARER_TOKEN;
const sharedKmsBearer = fullInternalRuntimeEnvironment.LOCAL_KMS_BEARER_TOKEN;
for (const value of [fullApiEnvironment.SECRET_STORE_BEARER_TOKEN, fullJobsEnvironment.SECRET_STORE_BEARER_TOKEN, fullMigrationEnvironment.SECRET_STORE_BEARER_TOKEN, fullOwnerEnvironment.SECRET_STORE_BEARER_TOKEN]) {
  assert.equal(value, sharedSecretStoreBearer, 'full workloads must share the single InternalRuntime Secret Store bearer');
}
for (const value of [fullApiEnvironment.KMS_BEARER_TOKEN, fullJobsEnvironment.KMS_BEARER_TOKEN, fullMigrationEnvironment.KMS_BEARER_TOKEN]) {
  assert.equal(value, sharedKmsBearer, 'full workloads must share the single InternalRuntime KMS bearer');
}
assert.notEqual(sharedSecretStoreBearer, sharedKmsBearer, 'Secret Store and KMS bearers must differ');
const identityBearers = [
  environments['identity-registration-api.env.example'].SECRET_STORE_BEARER_TOKEN,
  environments['identity-registration-api.env.example'].KMS_BEARER_TOKEN,
  environments['identity-notification-jobs.env.example'].SECRET_STORE_BEARER_TOKEN,
  environments['identity-notification-jobs.env.example'].KMS_BEARER_TOKEN,
];
assert.equal(new Set(identityBearers).size, identityBearers.length, 'identity-sms placeholder bearers must differ');

for (const name of Object.keys(environments).filter((candidate) => candidate.startsWith('full-'))) {
  const environment = environments[name];
  for (const [key, value] of Object.entries(environment).filter(([key]) => key.endsWith('_REF') && key !== 'MIGRATION_SOURCE_SNAPSHOT_REF')) {
    assert.ok(value.startsWith('zhudatuan/staging/full/'), `${name}:${key} escapes full staging namespace`);
  }
  assert.ok(environment.NODE_EXTRA_CA_CERTS.startsWith('/opt/zhudatuan-staging-full/'), `${name} CA path is not profile-isolated`);
}
assert.match(environments['full-migration.env.example'].MIGRATION_SOURCE_SNAPSHOT_REF, /^replace-with-/);
assert.match(fullOwnerEnvironment.ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL, /@127\.0\.0\.1:55442\/zhudatuan_registration$/);
assert.equal(fullOwnerEnvironment.SECRET_STORE_ENDPOINT, 'https://127.0.0.1:8643');
assert.notEqual(fullOwnerEnvironment.ZHUDATUAN_OWNER_BOOTSTRAP_RECEIPT_REF, fullOwnerEnvironment.ZHUDATUAN_OWNER_PASSWORD_REF);
for (const environment of [fullApiEnvironment, fullJobsEnvironment, fullMigrationEnvironment]) {
  assert.equal(environment.SECRET_STORE_ENDPOINT, 'https://127.0.0.1:8643');
  assert.equal(environment.KMS_ENDPOINT, 'https://127.0.0.1:8644');
}
assert.equal(fullInternalRuntimeEnvironment.LOCAL_SECRETS_PORT, '8643');
assert.equal(fullInternalRuntimeEnvironment.LOCAL_KMS_PORT, '8644');
assert.equal(fullInternalRuntimeEnvironment.LOCAL_SECRETS_FILE, '/opt/zhudatuan-staging-full/shared/full-secrets.json');
assert.match(fullInternalRuntimeEnvironment.LOCAL_KMS_MASTER_KEY, /^REPLACE_/);
assert.match(fullJobsEnvironment.OBJECT_STORE_ENDPOINT, /\.invalid$/);

const internalRuntimeService = files['zhudatuan-staging-full-internal-runtime.service'];
for (const token of [
  'Environment=APP_ENV=production',
  'Environment=LOCAL_RUNTIME_PROFILE=registration-only',
  'EnvironmentFile=/opt/zhudatuan-staging-full/shared/full-internal-runtime.env',
  'ExecStart=/usr/bin/node services/commerce/dist/InternalRuntimeMain.js',
  'ExecStartPost=/usr/bin/node services/commerce/dist/InternalRuntimeReadyMain.js',
  'ConditionPathExists=/opt/zhudatuan-staging-full/shared/full-secrets.json',
  'ConditionPathExists=/opt/zhudatuan-staging-full/shared/tls/internal-ca.crt',
  'IPAddressAllow=localhost',
])
  assert.ok(internalRuntimeService.includes(token), `InternalRuntime systemd token missing: ${token}`);
for (const token of ['https://127.0.0.1:8543', 'https://127.0.0.1:8544', '127.0.0.1:55432']) {
  assert.ok(!internalRuntimeService.includes(token), `formal acceptance endpoint forbidden in full staging service: ${token}`);
}

const deploymentSources = [
  identityCaddy,
  fullCaddy,
  files['delivery.yml'],
  files['artifacts.yml'],
  internalRuntimeService,
  ...Object.entries(files)
    .filter(([name]) => name.endsWith('.env.example'))
    .map(([, source]) => source),
].join('\n');
for (const token of ['/opt/zhudatuan/current', '/opt/zhudatuan/shared', '/var/log/pm2', 'accounts.zhudatuan.com', 'console.zhudatuan.com', 'api.zhudatuan.com'])
  assert.ok(!deploymentSources.includes(token), `production token forbidden in staging configuration: ${token}`);

const [buildSource, jobsEntrypoint, fullJobsSource, internalRuntimeSource] = await Promise.all([
  readFile(resolve(repository, 'scripts/build-commerce.mjs'), 'utf8'),
  readFile(resolve(repository, 'services/commerce/src/entry/JobsEntrypoint.ts'), 'utf8'),
  readFile(resolve(repository, 'services/commerce/src/entry/FullJobsMain.ts'), 'utf8'),
  readFile(resolve(repository, 'tools/localinfra/src/Run.ts'), 'utf8'),
]);
assert.ok(buildSource.includes("JobsMain: 'services/commerce/src/entry/JobsMain.ts'"));
for (const token of [
  "InternalRuntimeMain: 'tools/localinfra/src/Run.ts'",
  "InternalRuntimeReadyMain: 'tools/localinfra/src/RegistrationReady.ts'",
  "LocalSecretsMain: 'tools/localsecrets/src/Main.ts'",
  "LocalKmsMain: 'tools/localkms/src/Main.ts'",
  "BootstrapStagingOwner: 'tools/seed/src/BootstrapStagingOwner.ts'",
])
  assert.ok(buildSource.includes(token), `build artifact entry missing: ${token}`);
assert.ok(jobsEntrypoint.includes("import('./FullJobsMain')"));
assert.ok(fullJobsSource.includes('export async function runFullJobs'));
assert.ok(fullJobsSource.includes('JOB_RUNTIME_CATALOG_DRIFT'));
assert.ok(internalRuntimeSource.includes("process.env.LOCAL_RUNTIME_PROFILE === 'registration-only'"));
assert.ok(internalRuntimeSource.includes("'services/commerce/dist/LocalSecretsMain.js'"));
assert.ok(internalRuntimeSource.includes("'services/commerce/dist/LocalKmsMain.js'"));

console.log('Identity-SMS and blocked-until-provisioned full staging profiles verified.');

function process(configuration, name) {
  const application = configuration.apps.find((candidate) => candidate.name === name);
  assert.ok(application, `process missing: ${name}`);
  return application;
}

function assertProcess(application, cwd, logPrefix) {
  assert.equal(application.cwd, cwd);
  assert.equal(application.script, '/usr/bin/env');
  assert.equal(application.interpreter, 'none');
  assert.deepEqual(application.args.slice(0, 3), ['-i', 'PATH=/usr/bin:/bin', 'NODE_ENV=production']);
  assert.equal(application.instances, 1);
  assert.equal(application.exec_mode, 'fork');
  assert.ok(application.error_file.startsWith(logPrefix));
  assert.ok(application.out_file.startsWith(logPrefix));
}

function assertCaddy(source, contract) {
  for (const host of contract.hosts) assert.ok(source.includes(`{$${host}}`), `Caddy host missing: ${host}`);
  for (const token of [
    `root * ${contract.root}/apps/auth-web/dist`,
    `root * ${contract.root}/apps/console/dist`,
    `reverse_proxy ${contract.upstream}`,
    'path /api/v1/identity/invitations',
    'method POST',
    'path_regexp invitationRevoke ^/api/v1/identity/invitations/[^/]+$',
    'method DELETE',
    'respond "Not Found" 404',
  ])
    assert.ok(source.includes(token), `Caddy route token missing: ${token}`);
  assert.ok(!source.includes('/api/v1/identity/invitations/*'), 'invitation wildcard path is forbidden');
}

function assertKeys(environment, expected) {
  assert.deepEqual(Object.keys(environment).sort(), [...expected].sort());
  for (const [key, value] of Object.entries(environment)) assert.ok(value, `empty environment value: ${key}`);
}

function parseEnvironment(source) {
  return Object.fromEntries(
    source.split(/\r?\n/u).flatMap((line) => {
      const candidate = line.trim();
      if (!candidate || candidate.startsWith('#')) return [];
      const separator = candidate.indexOf('=');
      assert.ok(separator > 0, `invalid environment line: ${candidate}`);
      const key = candidate.slice(0, separator);
      let value = candidate.slice(separator + 1);
      if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1);
      return [[key, value]];
    })
  );
}
