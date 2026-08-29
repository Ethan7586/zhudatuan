import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execPath } from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { canonical, digest } from './readiness-common.mjs';
import { assertEcsTargetBoundary, gates, validateEvidence, verifyGate } from './readiness-contract.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(directory, '../../../..');
const execute = promisify(execFile);
const require = createRequire(import.meta.url);
const identityProcesses = require(resolve(directory, 'ecosystem.identity-sms.config.cjs'));

const files = Object.fromEntries(
  await Promise.all(
    [
      'Caddyfile.identity-sms',
      'Caddyfile.full',
      'caddy-zhudatuan-staging-full.conf',
      'ecosystem.full.config.cjs',
      'delivery.yml',
      'artifacts.yml',
      'identity-registration-api.env.example',
      'identity-notification-jobs.env.example',
      'full-identity-registration-api.env.example',
      'full-identity-notification-jobs.env.example',
      'full-database-retire.env.example',
      'full-jobs.env.example',
      'full-internal-runtime.env.example',
      'full-internal-access.bootstrap.example.json',
      'full-internal-access.example.json',
      'full-secrets.bootstrap.example.json',
      'full-secrets.example.json',
      'full-migration.env.example',
      'full-owner-bootstrap.env.example',
      'full-caddy.env.example',
      'full-postgres-proxy.env.example',
      'full-rds-init.env.example',
      'prepare-internal-tls.mjs',
      'prepare-release.mjs',
      'validate-cost-approval.mjs',
      'install-caddy-candidate.sh',
      'zhudatuan-staging-full-identity-api.service',
      'zhudatuan-staging-full-identity-notification-jobs.service',
      'zhudatuan-staging-full-database-retire.service',
      'zhudatuan-staging-full-internal-runtime.service',
      'zhudatuan-staging-full-jobs.service',
      'zhudatuan-staging-full-migration.service',
      'zhudatuan-staging-full-owner-bootstrap.service',
      'zhudatuan-staging-full-postgres-proxy.service',
      'zhudatuan-staging-full-rds-init.service',
      'README.md',
      'PREPARE.md',
      'STAGING-INFRASTRUCTURE-SPEC-20260829.md',
      'staging-cost-approval.example.yml',
      'readiness.evidence.example.yml',
      'readiness-candidate.mjs',
      'readiness-cloud-host.mjs',
      'readiness-common.mjs',
      'readiness-contract.mjs',
      'readiness-database.mjs',
      'readiness-full-jobs.mjs',
      'readiness-host.mjs',
      'readiness-runtime.mjs',
      'readiness-systemd.mjs',
      'readiness-toolchain.mjs',
      'verify-readiness.mjs',
    ].map(async (name) => [name, await readFile(resolve(directory, name), 'utf8')])
  )
);
const delivery = parseYaml(files['delivery.yml']);
const artifacts = parseYaml(files['artifacts.yml']);
const readinessEvidence = parseYaml(files['readiness.evidence.example.yml']);
const readinessSource = [
  'verify-readiness.mjs', 'readiness-candidate.mjs', 'readiness-common.mjs', 'readiness-contract.mjs',
  'readiness-cloud-host.mjs', 'readiness-database.mjs', 'readiness-full-jobs.mjs', 'readiness-host.mjs', 'readiness-runtime.mjs',
  'readiness-systemd.mjs', 'readiness-toolchain.mjs',
].map((name) => files[name]).join('\n');
const identityCaddy = files['Caddyfile.identity-sms'];
const fullCaddy = files['Caddyfile.full'];
const bootstrapAccess = JSON.parse(files['full-internal-access.bootstrap.example.json']);
const runtimeAccess = JSON.parse(files['full-internal-access.example.json']);
const bootstrapSecrets = JSON.parse(files['full-secrets.bootstrap.example.json']);
const runtimeSecrets = JSON.parse(files['full-secrets.example.json']);
const environments = Object.fromEntries(
  Object.entries(files)
    .filter(([name]) => name.endsWith('.env.example'))
    .map(([name, source]) => [name, parseEnvironment(source)])
);

assert.deepEqual(identityProcesses.apps.map(({ name }) => name).sort(), ['zhudatuan-staging-identity-api', 'zhudatuan-staging-identity-notification-jobs']);
assert.match(files['ecosystem.full.config.cjs'], /throw new Error\(/);
assert.match(files['ecosystem.full.config.cjs'], /FORBIDDEN: the full staging profile is systemd-only/);
assert.ok(!files['ecosystem.full.config.cjs'].includes('module.exports'), 'full PM2 config must fail closed');

const identityApi = process(identityProcesses, 'zhudatuan-staging-identity-api');
const identityJobs = process(identityProcesses, 'zhudatuan-staging-identity-notification-jobs');
assertProcess(identityApi, '/opt/zhudatuan-staging/current', '/var/log/zhudatuan-staging/');
assertProcess(identityJobs, '/opt/zhudatuan-staging/current', '/var/log/zhudatuan-staging/');

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
assert.equal(delivery.deploymentState, 'gated-not-yet-verified');
assert.equal(delivery.productionTrafficPercent, 0);
assert.equal(delivery.productionDataAccess, 'forbidden');
assert.deepEqual(Object.keys(delivery.profiles).sort(), ['full', 'identity-sms']);
assert.equal(delivery.profiles['identity-sms'].selection, 'optional');
assert.equal(delivery.profiles.full.selection, 'owner-approved-target');
assert.equal(delivery.profiles.full.authorization, 'readiness-gates-required');
assert.equal(delivery.profiles.full.processManager, 'systemd');
assert.equal(delivery.profiles.full.pm2.state, 'forbidden');
assert.equal(delivery.profiles.full.proxyEnvironmentExample,
  'infrastructure/zhudatuan/aliyun/staging/full-caddy.env.example');
assert.equal(delivery.profiles.full.proxySystemdDropIn,
  'infrastructure/zhudatuan/aliyun/staging/caddy-zhudatuan-staging-full.conf');
assert.equal(delivery.profiles.full.proxyInstaller,
  'infrastructure/zhudatuan/aliyun/staging/install-caddy-candidate.sh');
assert.equal(delivery.profiles.full.runtime.identityApi.port, 4431);
assert.equal(delivery.profiles.full.runtime.jobs.artifact, 'services/commerce/dist/JobsMain.js');
assert.equal(delivery.profiles.full.runtime.jobs.implementationSource, 'services/commerce/src/entry/FullJobsMain.ts');
assert.equal(delivery.profiles.full.runtime.internalRuntime.artifact, 'services/commerce/dist/InternalRuntimeMain.js');
assert.equal(delivery.profiles.full.runtime.internalRuntime.readinessArtifact, 'services/commerce/dist/InternalRuntimeReadyMain.js');
assert.equal(delivery.profiles.full.runtime.internalRuntime.profile, 'full-staging');
assert.equal(delivery.profiles.full.runtime.internalRuntime.capability, 'secret-store-kms-and-object-store');
assert.equal(delivery.profiles.full.runtime.internalRuntime.secretStorePort, 8643);
assert.equal(delivery.profiles.full.runtime.internalRuntime.kmsPort, 8644);
assert.equal(delivery.profiles.full.runtime.internalRuntime.objectStorePort, 8645);
assert.equal(delivery.profiles.full.runtime.postgresTlsProxy.listener, '127.0.0.1:55442');
assert.equal(delivery.profiles.full.runtime.postgresTlsProxy.upstreamTls, 'ca-and-hostname-verified');
assert.equal(delivery.profiles.full.dependencies.redis.connectionRef, 'zhudatuan/staging/full/redis/jobs');
assert.equal(delivery.profiles.full.dependencies.redis.productionEndpointReuse, 'forbidden');
assert.equal(delivery.profiles.full.dependencies.secretStore.bearerMode, 'exact-ref-per-workload-policy');
assert.equal(delivery.profiles.full.dependencies.secretStore.managedAliyunSecretsManager, 'not-integrated');
assert.equal(delivery.profiles.full.dependencies.secretStore.oneShotRemovalBeforePublicRuntime, 'required');
assert.equal(delivery.profiles.full.dependencies.kms.bearerMode, 'exact-key-ref-per-workload-policy');
assert.equal(delivery.profiles.full.dependencies.kms.managedAliyunKms, 'not-integrated');
assert.equal(delivery.profiles.full.dependencies.kms.allWorkloadAndServiceTokensMustDiffer, true);
assert.equal(delivery.profiles.full.runtime.identityNotificationJobs.activationGate, 'P10');
assert.equal(delivery.profiles.full.runtime.identityApi.activationGate, 'P10');
assert.equal(delivery.profiles.full.runtime.identityApi.activeOwnerGate, 'exactly-one-active-platform-owner');
assert.equal(delivery.profiles.full.runtime.identityApi.bootstrapPendingPublicReadiness, 'forbidden');
assert.equal(delivery.profiles.full.runtime.identityNotificationJobs.activeOwnerGate, 'exactly-one-active-platform-owner');
assert.equal(delivery.profiles.full.runtime.jobs.activationGate, 'blocked-provider-sandbox-not-integrated');
assert.equal(delivery.profiles.full.runtime.jobs.activationMode, 'forbidden');
assert.equal(delivery.profiles.full.runtime.jobs.enable, 'forbidden');
assert.equal(delivery.profiles.full.runtime.jobs.providerPreflight, 'not-integrated');
assert.equal(delivery.profiles.full.runtime.jobs.activeOwnerGate, 'exactly-one-active-platform-owner');
assert.equal(delivery.profiles.full.dependencies.objectStore.providedByInternalRuntime, true);
assert.equal(delivery.profiles.full.dependencies.objectStore.endpoint, 'https://127.0.0.1:8645');
assert.equal(delivery.profiles.full.dependencies.objectStore.tokenRef, 'zhudatuan/staging/full/objects/jobs');
assert.deepEqual(delivery.oneShots.executionOrder, ['rdsInitialization', 'migration', 'registrationBoundaryReconcile',
  'stagingOwnerBootstrap', 'databasePrincipalRetirement']);
assert.deepEqual(delivery.oneShots.cutoverBeforeP10.requiredAbsent, [
  '/opt/zhudatuan-staging-full/shared/full-migration.env',
  '/opt/zhudatuan-staging-full/shared/full-owner-bootstrap.env',
  '/run/zhudatuan-staging-full/rds-init.env',
  '/run/zhudatuan-staging-full/database-retire.env',
]);
assert.equal(delivery.oneShots.cutoverBeforeP10.oneShotLoginPasswordAndMembershipRetired, 'required');
assert.equal(delivery.oneShots.rdsInitialization.artifact, 'infrastructure/zhudatuan/aliyun/postgres-init-registration.sh');
assert.equal(delivery.oneShots.rdsInitialization.service, 'infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-rds-init.service');
assert.equal(delivery.oneShots.rdsInitialization.environmentExample, 'infrastructure/zhudatuan/aliyun/staging/full-rds-init.env.example');
assert.equal(delivery.oneShots.migration.artifact, 'services/commerce/dist/MigrationMain.js');
assert.equal(delivery.oneShots.stagingOwnerBootstrap.artifact, 'services/commerce/dist/BootstrapStagingOwner.js');
assert.equal(delivery.oneShots.databasePrincipalRetirement.artifact,
  'infrastructure/zhudatuan/aliyun/postgres-retire-registration-bootstrap.sql');
assert.equal(delivery.oneShots.databasePrincipalRetirement.service,
  'infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-database-retire.service');
assert.equal(delivery.oneShots.registrationBootstrap.state, 'forbidden');
assert.equal(delivery.prerequisites.externalResourcesEvidence, 'required');
assert.equal(delivery.prerequisites.loopbackProxy.databaseListener, '127.0.0.1:55442');
assert.equal(delivery.prerequisites.loopbackProxy.upstreamTls, 'ca-and-hostname-verified');
assert.equal(delivery.prerequisites.loopbackProxy.productionUpstream, 'forbidden');
assert.equal(delivery.prerequisites.internalRuntime.secretStoreListener, 'https://127.0.0.1:8643');
assert.equal(delivery.prerequisites.internalRuntime.kmsListener, 'https://127.0.0.1:8644');
assert.equal(delivery.prerequisites.internalRuntime.objectStoreListener, 'https://127.0.0.1:8645');
assert.equal(delivery.prerequisites.internalRuntime.formalRuntimeAccess, 'forbidden');
assert.equal(delivery.prerequisites.readinessRunbook, 'infrastructure/zhudatuan/aliyun/staging/PREPARE.md');
assert.equal(delivery.prerequisites.readinessEvidence, '/opt/zhudatuan-staging-full/shared/evidence/readiness.yml');
assert.deepEqual(delivery.prerequisites.readinessGates, Object.keys(readinessEvidence.checks));
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
const expectedReleaseArtifacts = [
  ['internalRuntime', 'services/commerce/dist/InternalRuntimeMain.js'],
  ['internalRuntimeReadiness', 'services/commerce/dist/InternalRuntimeReadyMain.js'],
  ['internalSecretStore', 'services/commerce/dist/LocalSecretsMain.js'],
  ['internalKms', 'services/commerce/dist/LocalKmsMain.js'],
  ['internalObjectStore', 'services/commerce/dist/LocalObjectsMain.js'],
  ['postgresTlsProxy', 'services/commerce/dist/PostgresTlsProxyMain.js'],
  ['identityApi', 'services/commerce/dist/IdentityRegistrationApiMain.js'],
  ['identityApiReadiness', 'services/commerce/dist/IdentityRegistrationApiReadyMain.js'],
  ['identityNotificationJobs', 'services/commerce/dist/IdentityNotificationJobsOnlyMain.js'],
  ['identityNotificationJobsReadiness', 'services/commerce/dist/IdentityNotificationJobsReadyMain.js'],
  ['fullJobs', 'services/commerce/dist/JobsMain.js'],
  ['migration', 'services/commerce/dist/MigrationMain.js'],
  ['stagingOwnerBootstrap', 'services/commerce/dist/BootstrapStagingOwner.js'],
  ['stagingReadiness', 'services/commerce/dist/StagingReadinessMain.js'],
  ['migrations', 'database/supabase/migrations'],
  ['authWeb', 'apps/auth-web/dist'],
  ['console', 'apps/console/dist'],
];
assert.deepEqual(artifacts.releaseArtifacts.map(({ id, artifact }) => [id, artifact]), expectedReleaseArtifacts,
  'release artifacts must be the exact reviewed allowlist in order');
assert.equal(new Set(artifacts.releaseArtifacts.map(({ id }) => id)).size, artifacts.releaseArtifacts.length,
  'release artifact ids must be unique');
assert.equal(new Set(artifacts.releaseArtifacts.map(({ artifact }) => artifact)).size, artifacts.releaseArtifacts.length,
  'release artifact paths must be unique');
const artifactsById = new Map(artifacts.releaseArtifacts.map((entry) => [entry.id, entry]));
assert.equal(artifactsById.get('fullJobs').artifact, 'services/commerce/dist/JobsMain.js');
assert.equal(artifactsById.get('fullJobs').bundledImplementation, 'services/commerce/src/entry/FullJobsMain.ts');
assert.equal(artifactsById.get('stagingReadiness').artifact, 'services/commerce/dist/StagingReadinessMain.js');
assert.equal(artifactsById.get('stagingReadiness').requiredMarker, 'example:validation-only');
assert.equal(artifacts.explicitExclusions.find(({ artifact }) => artifact.endsWith('/FullJobsMain.js')).reason, 'no standalone build artifact; FullJobsMain.ts is bundled into JobsMain.js');
assert.deepEqual(artifacts.explicitExclusions.map(({ artifact }) => artifact), [
  'services/commerce/dist/RegistrationMigrationMain.js',
  'services/commerce/dist/FullJobsMain.js',
  'services/commerce/dist/BootstrapOwner.js',
  'services/commerce/dist/BootstrapRegistration.js',
], 'explicit exclusions must be the exact reviewed list');
const expectedDeploymentArtifacts = [
  'infrastructure/zhudatuan/aliyun/postgres-init-registration.sh',
  'infrastructure/zhudatuan/aliyun/postgres-reconcile-registration-boundary.sql',
  'infrastructure/zhudatuan/aliyun/postgres-retire-registration-bootstrap.sql',
  'infrastructure/zhudatuan/aliyun/staging/Caddyfile.full',
  'infrastructure/zhudatuan/aliyun/staging/caddy-zhudatuan-staging-full.conf',
  'infrastructure/zhudatuan/aliyun/staging/full-caddy.env.example',
  'infrastructure/zhudatuan/aliyun/staging/full-identity-registration-api.env.example',
  'infrastructure/zhudatuan/aliyun/staging/full-identity-notification-jobs.env.example',
  'infrastructure/zhudatuan/aliyun/staging/full-database-retire.env.example',
  'infrastructure/zhudatuan/aliyun/staging/full-jobs.env.example',
  'infrastructure/zhudatuan/aliyun/staging/full-internal-runtime.env.example',
  'infrastructure/zhudatuan/aliyun/staging/full-internal-access.bootstrap.example.json',
  'infrastructure/zhudatuan/aliyun/staging/full-internal-access.example.json',
  'infrastructure/zhudatuan/aliyun/staging/full-secrets.bootstrap.example.json',
  'infrastructure/zhudatuan/aliyun/staging/full-secrets.example.json',
  'infrastructure/zhudatuan/aliyun/staging/full-migration.env.example',
  'infrastructure/zhudatuan/aliyun/staging/full-owner-bootstrap.env.example',
  'infrastructure/zhudatuan/aliyun/staging/full-postgres-proxy.env.example',
  'infrastructure/zhudatuan/aliyun/staging/full-rds-init.env.example',
  'infrastructure/zhudatuan/aliyun/staging/prepare-internal-tls.mjs',
  'infrastructure/zhudatuan/aliyun/staging/prepare-release.mjs',
  'infrastructure/zhudatuan/aliyun/staging/validate-cost-approval.mjs',
  'infrastructure/zhudatuan/aliyun/staging/install-caddy-candidate.sh',
  'infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-identity-api.service',
  'infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-identity-notification-jobs.service',
  'infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-database-retire.service',
  'infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-internal-runtime.service',
  'infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-jobs.service',
  'infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-migration.service',
  'infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-owner-bootstrap.service',
  'infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-postgres-proxy.service',
  'infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-rds-init.service',
  'infrastructure/zhudatuan/aliyun/staging/PREPARE.md',
  'infrastructure/zhudatuan/aliyun/staging/STAGING-INFRASTRUCTURE-SPEC-20260829.md',
  'infrastructure/zhudatuan/aliyun/staging/readiness.evidence.example.yml',
  'infrastructure/zhudatuan/aliyun/staging/staging-cost-approval.example.yml',
];
assert.deepEqual(artifacts.deploymentArtifacts, expectedDeploymentArtifacts,
  'deployment artifacts must be the exact reviewed allowlist in order');
assert.equal(new Set(artifacts.deploymentArtifacts).size, artifacts.deploymentArtifacts.length,
  'deployment artifacts must be unique');
assert.ok(!artifacts.deploymentArtifacts.includes('infrastructure/zhudatuan/aliyun/staging/ecosystem.full.config.cjs'), 'forbidden Full PM2 guard is not a deployment artifact');

for (const token of [
  '本文件不授權建立或修改任何雲資源',
  'i-2zeewhay0farxq8lucrd',
  'i-2zeewhay0farxq8lucrc',
  'cn-beijing-f',
  '最終顯示名為「福福網 staging」',
  '不授權備份、登入、快照、改名、改網路／RAM role 或部署',
  '目前沒有建立或修改它們的授權',
  'Secret Store / local envelope KMS boundary',
  '改為阿里雲託管 KMS／Secrets Manager',
  '登入後的北京控制台即時資料',
]) assert.ok(files['STAGING-INFRASTRUCTURE-SPEC-20260829.md'].includes(token), `infrastructure approval boundary missing: ${token}`);
const costApproval = parseYaml(files['staging-cost-approval.example.yml']);
assert.equal(costApproval.state, 'pending-user-approval');
assert.equal(costApproval.region, 'cn-beijing');
assert.equal(costApproval.approval.approvedBy, 'Ethan');
assert.equal(costApproval.approval.approvedAt, 'pending');
assert.equal(costApproval.quoteEvidenceSha256, 'replace-with-sha256-of-redacted-beijing-console-quotes');
assert.equal(costApproval.ecs.acceptancePublicTrafficCapGb, 'replace-with-approved-cap');
assert.equal(costApproval.approval.externalApprovalReceiptSha256, 'replace-with-independent-approval-receipt-sha256');
for (const token of ['COST_APPROVAL_SCHEMA_INVALID', 'COST_APPROVAL_TIME_WINDOW_INVALID',
  'COST_TOTAL_72_MISMATCH', 'COST_TOTAL_730_MISMATCH', 'COST_HARD_CAP_BELOW_72_HOUR_ESTIMATE',
  'externalApprovalReceiptSha256', 'COST_EXTERNAL_EVIDENCE_DIGEST_MISMATCH',
  'loadExternalEvidence', "schema: 'zhudatuan.staging.cost-approval.v1'"]) {
  assert.ok(files['validate-cost-approval.mjs'].includes(token), `cost approval validator token missing: ${token}`);
}
for (const token of ['--quote-evidence <redacted-quote-file> --specification <spec-file> --approval-receipt <receipt-file>',
  '實際讀取三份 evidence bytes', 'costEstimateSha256', '不替代 Ethan 在獨立 task 中的明確批准']) {
  assert.ok(files['PREPARE.md'].includes(token), `cost approval runbook token missing: ${token}`);
}

assert.equal(readinessEvidence.profile, 'full');
assert.equal(readinessEvidence.productionTrafficPercent, 0);
assert.equal(readinessEvidence.productionDataAccess, 'forbidden');
assert.equal(readinessEvidence.ownerIntegration.tenantBoundaryTestSha256, 'pending');
assert.equal(readinessEvidence.network.productionEcsInstanceId, 'i-2zeewhay0farxq8lucrd');
assert.equal(readinessEvidence.network.productionEcsCurrentName, '福福网全域系统');
assert.equal(readinessEvidence.network.stagingCandidateEcsInstanceId, 'i-2zeewhay0farxq8lucrc');
assert.equal(readinessEvidence.network.stagingCandidateCurrentName, '福福网-staging');
assert.equal(readinessEvidence.network.stagingCandidateTargetName, '福福网 staging');
assert.equal(readinessEvidence.network.stagingCandidateZone, 'cn-beijing-f');
assert.equal(readinessEvidence.network.existingHostInventorySha256, 'pending');
assert.equal(readinessEvidence.network.dedicatedStagingHostSha256, 'pending');
assert.equal(readinessEvidence.network.publicAddressFingerprint, 'pending');
assert.equal(readinessEvidence.hostConfiguration.hostToolchainSha256, 'pending');
assert.equal(readinessEvidence.hostConfiguration.kmsMasterKeyFingerprint, 'pending');
assert.equal(readinessEvidence.hostConfiguration.runtimeBoundarySha256, 'pending');
assert.equal(readinessEvidence.database.rdsAdminInitReplaySha256, 'pending');
assert.equal(readinessEvidence.runtime.internalAccessProbeSha256, 'pending');
assert.equal(readinessEvidence.runtime.dnsResolutionSha256, 'pending');
assert.equal(readinessEvidence.fullJobs.extensionInventorySha256, 'pending');
assert.equal(readinessEvidence.fullJobs.objectRoundTripSha256, 'pending');
assert.equal(readinessEvidence.fullJobs.systemdStateSha256, 'pending');
assert.ok(!Object.hasOwn(readinessEvidence.runtime, 'pm2StateSha256'));
assert.deepEqual(Object.keys(readinessEvidence.checks), Array.from({ length: 13 }, (_, index) => `P${String(index).padStart(2, '0')}`));
for (const gate of Object.keys(readinessEvidence.checks)) {
  assert.ok(files['PREPARE.md'].includes(`| ${gate} |`), `runbook gate missing: ${gate}`);
  assert.ok(readinessSource.includes(`${gate}: [`), `readiness verifier gate missing: ${gate}`);
}
const completeEvidenceFixture = structuredClone(readinessEvidence);
for (const paths of Object.values(gates)) {
  for (const path of paths) setEvidenceValue(completeEvidenceFixture, path, fixtureValue(path));
}
for (const gate of Object.keys(gates)) completeEvidenceFixture.checks[gate] = 'verified';
validateEvidence(completeEvidenceFixture);
for (const gate of Object.keys(gates)) {
  assert.deepEqual(verifyGate(completeEvidenceFixture, gate).missing, [],
    `complete evidence fixture must satisfy ${gate}`);
}
const productionEcsCandidateFixture = structuredClone(completeEvidenceFixture);
productionEcsCandidateFixture.network.ecsInstanceId = productionEcsCandidateFixture.network.productionEcsInstanceId;
assert.throws(() => assertEcsTargetBoundary(productionEcsCandidateFixture),
  /EVIDENCE_PRODUCTION_ECS_SELECTED_AS_STAGING/u,
  'the production instance must remain forbidden even though its ID differs only in the last character');
const wrongStagingEcsCandidateFixture = structuredClone(completeEvidenceFixture);
wrongStagingEcsCandidateFixture.network.ecsInstanceId = 'i-unapproved-staging-candidate';
assert.throws(() => assertEcsTargetBoundary(wrongStagingEcsCandidateFixture),
  /EVIDENCE_STAGING_ECS_TARGET_MISMATCH/u,
  'P05 must use the exact Owner-confirmed staging candidate');
const missingPriorFieldFixture = structuredClone(completeEvidenceFixture);
missingPriorFieldFixture.candidate.commit = 'pending';
assert.ok(verifyGate(missingPriorFieldFixture, 'P05').missing.includes('candidate.commit:prerequisite'),
  'a later gate must reject an incomplete prior-gate field');
const expiredCloudSessionFixture = structuredClone(completeEvidenceFixture);
expiredCloudSessionFixture.cloudIdentity.sessionExpiresAt = '2000-01-01T00:00:00.000Z';
assert.ok(verifyGate(expiredCloudSessionFixture, 'P05').missing.includes('cloudIdentity.sessionExpiresAt:prerequisite-not-active'),
  'every later gate must reject an expired cloud session');
for (const token of [
  'RDS initialization → Migration → boundary reconcile → Staging Owner bootstrap',
  'systemctl start zhudatuan-staging-full-identity-api.service',
  'systemctl start zhudatuan-staging-full-identity-notification-jobs.service',
  'ExecCondition=/usr/bin/false',
  'Full Jobs 必須保持 inactive',
]) assert.ok(files['PREPARE.md'].includes(token) || files['README.md'].includes(token), `systemd runbook token missing: ${token}`);
for (const token of ['精確暫時 SET edge', 'database.rdsAdminInitReplaySha256',
  '本機 vanilla superuser fixture 不能替代這一步']) {
  assert.ok(files['README.md'].includes(token) || files['PREPARE.md'].includes(token),
    `live RDS pseudo-superuser gate missing: ${token}`);
}
assert.ok(!files['README.md'].includes('pm2 start'), 'Full README must not start PM2');
assert.ok(!files['README.md'].includes('/var/lib/zhudatuan-staging-full/pm2'), 'Full README must not create PM2_HOME');
for (const token of [
  'install -d -o root -g root -m 0755 /opt/zhudatuan-staging-full /opt/zhudatuan-staging-full/releases',
  'install_new_root_secret infrastructure/zhudatuan/aliyun/staging/full-jobs.env.example',
  'install_new_root_secret infrastructure/zhudatuan/aliyun/staging/full-internal-runtime.env.example',
  'install_new_root_secret infrastructure/zhudatuan/aliyun/staging/full-postgres-proxy.env.example',
  'infrastructure/zhudatuan/aliyun/staging/full-rds-init.env.example',
  'install_new_root_secret infrastructure/zhudatuan/aliyun/staging/readiness.evidence.example.yml',
  'refusing to overwrite existing secret',
  '密鑰輪換必須先另建',
  'prepare-internal-tls.mjs',
  'prepare-release.mjs',
  '/opt/zhudatuan-staging-full/archives/${release_commit}.tar.gz',
  'sha256sum --check .zhudatuan-staging-inventory.sha256',
  '/run/zhudatuan-staging-full/rds-init.env',
]) assert.ok(files['README.md'].includes(token), `Full install boundary missing: ${token}`);
assert.ok(!files['README.md'].includes('root:zhudatuan'));
assert.ok(!files['PREPARE.md'].includes('root:zhudatuan'));
for (const token of [
  'verifyLiveHostConfiguration',
  'verifyLiveCloudHost',
  "'/latest/api/token'",
  "'x-aliyun-ecs-metadata-token'",
  'KNOWN_PRODUCTION_INSTANCE_ID',
  'KNOWN_STAGING_CANDIDATE_INSTANCE_ID',
  'stagingCandidateEcsInstanceId',
  'staging-target-mismatch',
  "get('zone-id')",
  'verifyLiveHostToolchain',
  'verifyInstalledFullUnits',
  'NeedDaemonReload',
  'FragmentPath',
  "['verify', ...unitPaths]",
  'hostConfiguration.hostToolchainSha256',
  'network.publicAddressFingerprint',
  'runtime.dnsResolutionSha256',
  'CURRENT_RELEASE_HOST_RECEIPT_INVALID',
  '/full-internal-access.json',
  'live:access-policy:token-isolation',
  'live:object-store:catalog-token-mismatch',
  'live:object-store:authenticated-probe',
  "'/v1/envelopes'",
]) assert.ok(readinessSource.includes(token), `P07 live access verifier token missing: ${token}`);
for (const token of [
  'example:validation-only',
  'EVIDENCE_DIRECTORY_BOUNDARY_INVALID',
  'candidateOrCurrentRelease',
  'verifyCurrentReleaseIdentity',
]) assert.ok(readinessSource.includes(token), `readiness anti-bypass token missing: ${token}`);
for (const forbidden of ['password:', 'token:', 'otp:', 'phone:', 'dsn:', 'accessKey:', 'privateKey:']) {
  assert.ok(!files['readiness.evidence.example.yml'].toLowerCase().includes(forbidden.toLowerCase()), `sensitive evidence field forbidden: ${forbidden}`);
}

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
assertKeys(environments['full-identity-notification-jobs.env.example'], [
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
  'LOCAL_KMS_MASTER_KEY',
  'LOCAL_KMS_PORT',
  'LOCAL_SECRETS_FILE',
  'LOCAL_SECRETS_PORT',
  'LOCAL_WORKLOAD_ACCESS_POLICY_FILE',
  'LOCAL_OBJECTS_DIRECTORY',
  'LOCAL_OBJECTS_PORT',
  'LOCAL_OBJECTS_TOKEN',
  'LOCAL_TLS_CERT_FILE',
  'LOCAL_TLS_KEY_FILE',
  'NODE_EXTRA_CA_CERTS',
]);
assertKeys(environments['full-postgres-proxy.env.example'], ['ZHUDATUAN_POSTGRES_PROXY_CA_FILE', 'ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_HOST', 'ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_PORT']);
assertKeys(environments['full-rds-init.env.example'], [
  'POSTGRES_USER',
  'PGPASSWORD',
  'ZHUDATUAN_EXPECTED_RDS_SERVER_ADDR',
  'SHOPAPP_PASSWORD',
  'SHOPJOB_PASSWORD',
  'SHOPMIGRATION_PASSWORD',
  'SHOPREAD_PASSWORD',
  'ZHUDATUAN_IDENTITY_API_PASSWORD',
  'ZHUDATUAN_IDENTITY_JOB_PASSWORD',
  'ZHUDATUAN_BOOTSTRAP_PASSWORD',
  'ZHUDATUAN_WEB_API_PASSWORD',
  'ZHUDATUAN_PURCHASE_API_PASSWORD',
  'ZHUDATUAN_SANDBOX_BOOTSTRAP_PASSWORD',
  'ZHUDATUAN_DATABASE_SENTINEL',
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
assertKeys(environments['full-caddy.env.example'], [
  'ZHUDATUAN_STAGING_FULL_ACCOUNTS_HOST',
  'ZHUDATUAN_STAGING_FULL_CONSOLE_HOST',
  'ZHUDATUAN_STAGING_FULL_API_HOST',
]);
for (const [key, value] of Object.entries(environments['full-caddy.env.example'])) {
  assert.match(value, /^replace-with-dedicated-staging-[a-z]+-host$/, `unsafe Caddy hostname placeholder: ${key}`);
  assert.ok(!/\d+\.\d+\.\d+\.\d+/u.test(value), `Caddy hostname must not be an IP: ${key}`);
}

const bearerValues = Object.values(environments).flatMap((environment) =>
  Object.entries(environment)
    .filter(([key]) => key.endsWith('BEARER_TOKEN'))
    .map(([, value]) => value)
);
for (const value of bearerValues) assert.match(value, /^[A-Za-z0-9_-]{43,512}$/);
const fullApiEnvironment = environments['full-identity-registration-api.env.example'];
const fullIdentityJobsEnvironment = environments['full-identity-notification-jobs.env.example'];
const fullJobsEnvironment = environments['full-jobs.env.example'];
const fullMigrationEnvironment = environments['full-migration.env.example'];
const fullOwnerEnvironment = environments['full-owner-bootstrap.env.example'];
const fullInternalRuntimeEnvironment = environments['full-internal-runtime.env.example'];
const fullPostgresProxyEnvironment = environments['full-postgres-proxy.env.example'];
const runtimeSecretGrants = runtimeAccess.secretStore;
const runtimeKmsGrants = runtimeAccess.kms;
const bootstrapSecretGrants = bootstrapAccess.secretStore;
const bootstrapKmsGrants = bootstrapAccess.kms;
assert.equal(runtimeAccess.phase, 'runtime');
assert.equal(bootstrapAccess.phase, 'bootstrap');
assert.deepEqual(Object.keys(runtimeSecrets).sort(), uniqueResources(runtimeSecretGrants));
assert.deepEqual(Object.keys(bootstrapSecrets).sort(), [...new Set([
  ...uniqueResources(bootstrapSecretGrants),
  'zhudatuan/staging/full/objects/jobs',
])].sort());
assert.deepEqual([...delivery.profiles.full.dependencies.secretStore.runtimeCatalogKeys].sort(), Object.keys(runtimeSecrets).sort());
assert.deepEqual([...delivery.profiles.full.dependencies.secretStore.bootstrapCatalogKeys].sort(), Object.keys(bootstrapSecrets).sort());
assert.equal(fullApiEnvironment.SECRET_STORE_BEARER_TOKEN, runtimeSecretGrants['identity-registration-api'].bearerToken);
assert.equal(fullApiEnvironment.KMS_BEARER_TOKEN, runtimeKmsGrants['identity-registration-api'].bearerToken);
assert.equal(fullIdentityJobsEnvironment.SECRET_STORE_BEARER_TOKEN, runtimeSecretGrants['identity-notification-jobs'].bearerToken);
assert.equal(fullIdentityJobsEnvironment.KMS_BEARER_TOKEN, runtimeKmsGrants['identity-notification-jobs'].bearerToken);
assert.equal(fullJobsEnvironment.SECRET_STORE_BEARER_TOKEN, runtimeSecretGrants['full-jobs'].bearerToken);
assert.equal(fullJobsEnvironment.KMS_BEARER_TOKEN, runtimeKmsGrants['full-jobs'].bearerToken);
assert.equal(fullMigrationEnvironment.SECRET_STORE_BEARER_TOKEN, bootstrapSecretGrants.migration.bearerToken);
assert.equal(fullMigrationEnvironment.KMS_BEARER_TOKEN, bootstrapKmsGrants.migration.bearerToken);
assert.equal(fullOwnerEnvironment.SECRET_STORE_BEARER_TOKEN, bootstrapSecretGrants['owner-bootstrap'].bearerToken);
const fullPolicyBearers = [...Object.values(runtimeSecretGrants), ...Object.values(runtimeKmsGrants),
  ...Object.values(bootstrapSecretGrants), ...Object.values(bootstrapKmsGrants)].map(({ bearerToken }) => bearerToken);
assert.equal(new Set(fullPolicyBearers).size, fullPolicyBearers.length, 'every full workload and service bearer must differ');
for (const value of fullPolicyBearers) assert.match(value, /^[A-Za-z0-9_-]{43,512}$/);
assert.ok(!fullPolicyBearers.includes(fullInternalRuntimeEnvironment.LOCAL_OBJECTS_TOKEN), 'Object Store bearer must differ from every policy bearer');
assert.equal(runtimeSecrets['zhudatuan/staging/full/objects/jobs'], fullInternalRuntimeEnvironment.LOCAL_OBJECTS_TOKEN);
assert.equal(bootstrapSecrets['zhudatuan/staging/full/objects/jobs'], fullInternalRuntimeEnvironment.LOCAL_OBJECTS_TOKEN);
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
    const migrationKmsReference = name === 'full-migration.env.example' && key.startsWith('MIGRATION_') && key.endsWith('_KEY_REF');
    assert.ok(migrationKmsReference || value.startsWith('zhudatuan/staging/full/'), `${name}:${key} escapes full staging namespace`);
  }
  if (environment.NODE_EXTRA_CA_CERTS !== undefined) {
    assert.ok(environment.NODE_EXTRA_CA_CERTS.startsWith('/opt/zhudatuan-staging-full/'), `${name} CA path is not profile-isolated`);
  }
}
assert.match(environments['full-migration.env.example'].MIGRATION_SOURCE_SNAPSHOT_REF, /^replace-with-/);
assert.match(fullOwnerEnvironment.ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL, /@127\.0\.0\.1:55442\/zhudatuan_registration\?sslmode=disable$/);
assert.equal(fullOwnerEnvironment.SECRET_STORE_ENDPOINT, 'https://127.0.0.1:8643');
assert.notEqual(fullOwnerEnvironment.ZHUDATUAN_OWNER_BOOTSTRAP_RECEIPT_REF, fullOwnerEnvironment.ZHUDATUAN_OWNER_PASSWORD_REF);
for (const environment of [fullApiEnvironment, fullJobsEnvironment, fullMigrationEnvironment]) {
  assert.equal(environment.SECRET_STORE_ENDPOINT, 'https://127.0.0.1:8643');
  assert.equal(environment.KMS_ENDPOINT, 'https://127.0.0.1:8644');
}
assert.equal(fullInternalRuntimeEnvironment.LOCAL_SECRETS_PORT, '8643');
assert.equal(fullInternalRuntimeEnvironment.LOCAL_KMS_PORT, '8644');
assert.equal(fullInternalRuntimeEnvironment.LOCAL_OBJECTS_PORT, '8645');
assert.equal(fullInternalRuntimeEnvironment.LOCAL_OBJECTS_DIRECTORY, '/var/lib/zhudatuan-staging-full/objects');
assert.equal(fullInternalRuntimeEnvironment.LOCAL_SECRETS_FILE, '/opt/zhudatuan-staging-full/shared/full-secrets.json');
assert.equal(fullInternalRuntimeEnvironment.LOCAL_WORKLOAD_ACCESS_POLICY_FILE, '/opt/zhudatuan-staging-full/shared/full-internal-access.json');
assert.match(fullInternalRuntimeEnvironment.LOCAL_KMS_MASTER_KEY, /^REPLACE_/);
assert.equal(fullJobsEnvironment.OBJECT_STORE_ENDPOINT, 'https://127.0.0.1:8645');
assert.match(fullPostgresProxyEnvironment.ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_HOST, /^replace-with-staging-rds-private-endpoint\./);
assert.equal(fullPostgresProxyEnvironment.ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_PORT, '5432');
assert.equal(fullPostgresProxyEnvironment.ZHUDATUAN_POSTGRES_PROXY_CA_FILE, '/opt/zhudatuan-staging-full/shared/tls/aliyun-rds-ca.pem');

const internalRuntimeService = files['zhudatuan-staging-full-internal-runtime.service'];
for (const token of [
  'User=zhudatuan-stg-internal',
  'DynamicUser=yes',
  'Environment=APP_ENV=production',
  'Environment=LOCAL_RUNTIME_PROFILE=full-staging',
  'EnvironmentFile=/opt/zhudatuan-staging-full/shared/full-internal-runtime.env',
  'LoadCredential=internal-tls-key:/opt/zhudatuan-staging-full/shared/tls/internal.key',
  'LoadCredential=internal-tls-certificate:/opt/zhudatuan-staging-full/shared/tls/internal.crt',
  'LoadCredential=internal-ca-certificate:/opt/zhudatuan-staging-full/shared/tls/internal-ca.crt',
  'LoadCredential=secrets-catalog:/opt/zhudatuan-staging-full/shared/full-secrets.json',
  'LoadCredential=workload-access-policy:/opt/zhudatuan-staging-full/shared/full-internal-access.json',
  'LOCAL_TLS_KEY_FILE=%d/internal-tls-key',
  'LOCAL_TLS_CERT_FILE=%d/internal-tls-certificate',
  'NODE_EXTRA_CA_CERTS=%d/internal-ca-certificate',
  'LOCAL_SECRETS_FILE=%d/secrets-catalog',
  'LOCAL_WORKLOAD_ACCESS_POLICY_FILE=%d/workload-access-policy',
  '/usr/bin/node services/commerce/dist/InternalRuntimeMain.js',
  '/usr/bin/node services/commerce/dist/InternalRuntimeReadyMain.js',
  'ConditionPathExists=/opt/zhudatuan-staging-full/shared/full-secrets.json',
  'ConditionPathExists=/opt/zhudatuan-staging-full/shared/full-internal-access.json',
  'ConditionPathExists=/opt/zhudatuan-staging-full/shared/tls/internal.key',
  'ConditionPathExists=/opt/zhudatuan-staging-full/shared/tls/internal.crt',
  'ConditionPathExists=/opt/zhudatuan-staging-full/shared/tls/internal-ca.crt',
  'ConditionPathExists=/opt/zhudatuan-staging-full/current/services/commerce/dist/LocalObjectsMain.js',
  'ReadWritePaths=/var/lib/zhudatuan-staging-full/objects',
  'InaccessiblePaths=/opt/zhudatuan-staging-full/shared',
  'IPAddressAllow=localhost',
])
  assert.ok(internalRuntimeService.includes(token), `InternalRuntime systemd token missing: ${token}`);
const postgresProxyService = files['zhudatuan-staging-full-postgres-proxy.service'];
for (const token of [
  'User=zhudatuan-stg-pgproxy',
  'DynamicUser=yes',
  'ConditionPathExists=/opt/zhudatuan-staging-full/current/services/commerce/dist/PostgresTlsProxyMain.js',
  'EnvironmentFile=/opt/zhudatuan-staging-full/shared/full-postgres-proxy.env',
  'LoadCredential=rds-ca-certificate:/opt/zhudatuan-staging-full/shared/tls/aliyun-rds-ca.pem',
  'ZHUDATUAN_POSTGRES_PROXY_CA_FILE=%d/rds-ca-certificate',
  '/usr/bin/node services/commerce/dist/PostgresTlsProxyMain.js',
  '--host=127.0.0.1 --port=55442 --dbname=zhudatuan_registration',
  'ReadOnlyPaths=/opt/zhudatuan-staging-full/current',
  'InaccessiblePaths=/opt/zhudatuan-staging-full/shared',
])
  assert.ok(postgresProxyService.includes(token), `PostgreSQL TLS proxy systemd token missing: ${token}`);

const fullSystemdUnits = [
  'zhudatuan-staging-full-identity-api.service',
  'zhudatuan-staging-full-identity-notification-jobs.service',
  'zhudatuan-staging-full-database-retire.service',
  'zhudatuan-staging-full-internal-runtime.service',
  'zhudatuan-staging-full-jobs.service',
  'zhudatuan-staging-full-migration.service',
  'zhudatuan-staging-full-owner-bootstrap.service',
  'zhudatuan-staging-full-postgres-proxy.service',
  'zhudatuan-staging-full-rds-init.service',
];
assert.equal(fullSystemdUnits.length, 9);

const dynamicUserUnits = [...fullSystemdUnits];
const manualUnitsWithoutInstall = [
  'zhudatuan-staging-full-identity-api.service',
  'zhudatuan-staging-full-identity-notification-jobs.service',
  'zhudatuan-staging-full-database-retire.service',
  'zhudatuan-staging-full-jobs.service',
  'zhudatuan-staging-full-migration.service',
  'zhudatuan-staging-full-owner-bootstrap.service',
  'zhudatuan-staging-full-rds-init.service',
];
const persistentUnitsWithInstall = [
  'zhudatuan-staging-full-internal-runtime.service',
  'zhudatuan-staging-full-postgres-proxy.service',
];
for (const name of dynamicUserUnits) {
  const source = files[name];
  assert.ok(source.includes('DynamicUser=yes'), `DynamicUser missing: ${name}`);
  assert.ok(!source.includes('--env-file'), `Node --env-file is forbidden in DynamicUser unit: ${name}`);
  assert.ok(!/^Group=/m.test(source), `shared primary group is forbidden in DynamicUser unit: ${name}`);
  assert.ok(!source.includes('SupplementaryGroups=zhudatuan'), `shared secret group is forbidden in DynamicUser unit: ${name}`);
}
for (const name of manualUnitsWithoutInstall) {
  assert.ok(!/^\[Install\]\s*$/m.test(files[name]), `manual unit must not be enabled: ${name}`);
}
for (const name of persistentUnitsWithInstall) {
  assert.ok(/^\[Install\]\s*$/m.test(files[name]), `persistent unit must be enableable: ${name}`);
}
for (const name of fullSystemdUnits) {
  assert.equal(/^\[Install\]\s*$/m.test(files[name]), persistentUnitsWithInstall.includes(name),
    `systemd install-state classification drift: ${name}`);
}
for (const token of ["PERSISTENT_UNITS = new Set", "? 'enabled' : 'static'"]) {
  assert.ok(files['readiness-systemd.mjs'].includes(token), `systemd readiness state contract missing: ${token}`);
}
for (const name of fullSystemdUnits) {
  assert.ok(artifacts.deploymentArtifacts.includes(`infrastructure/zhudatuan/aliyun/staging/${name}`), `systemd deployment artifact missing: ${name}`);
}

const identityApiService = files['zhudatuan-staging-full-identity-api.service'];
const identityJobsService = files['zhudatuan-staging-full-identity-notification-jobs.service'];
const databaseRetireService = files['zhudatuan-staging-full-database-retire.service'];
const fullJobsService = files['zhudatuan-staging-full-jobs.service'];
const migrationService = files['zhudatuan-staging-full-migration.service'];
const ownerBootstrapService = files['zhudatuan-staging-full-owner-bootstrap.service'];
const rdsInitService = files['zhudatuan-staging-full-rds-init.service'];
for (const [source, tokens] of [
  [identityApiService, ['full-identity-registration-api.env', 'IdentityRegistrationApiMain.js', 'IdentityRegistrationApiReadyMain.js']],
  [identityJobsService, ['full-identity-notification-jobs.env', 'IdentityNotificationJobsOnlyMain.js', 'IdentityNotificationJobsReadyMain.js']],
  [databaseRetireService, ['/run/zhudatuan-staging-full/database-retire.env', 'postgres-retire-registration-bootstrap.sql',
    'zhudatuan-staging-full-owner-bootstrap.service']],
  [fullJobsService, ['full-jobs.env', 'JOB_RUNTIME_PROFILE=full', 'services/commerce/dist/JobsMain.js']],
  [migrationService, ['full-migration.env', 'services/commerce/dist/MigrationMain.js', 'zhudatuan-staging-full-rds-init.service']],
  [ownerBootstrapService, ['full-owner-bootstrap.env', 'services/commerce/dist/BootstrapStagingOwner.js', 'zhudatuan-staging-full-migration.service']],
  [rdsInitService, ['/run/zhudatuan-staging-full/rds-init.env', 'postgres-init-registration.sh',
    'zhudatuan-staging-full-postgres-proxy.service', 'PGOPTIONS PSQLRC', 'PGAPPNAME=zhudatuan-staging-full-rds-init']],
]) {
  for (const token of tokens) assert.ok(source.includes(token), `systemd workload token missing: ${token}`);
}
for (const [name, source] of [
  ['identity-api', identityApiService],
  ['identity-notification-jobs', identityJobsService],
  ['full-jobs', fullJobsService],
]) {
  for (const token of [
    'After=network-online.target',
    'zhudatuan-staging-full-owner-bootstrap.service',
    'zhudatuan-staging-full-database-retire.service',
    'ConditionPathExists=!/opt/zhudatuan-staging-full/shared/full-migration.env',
    'ConditionPathExists=!/opt/zhudatuan-staging-full/shared/full-owner-bootstrap.env',
    'ConditionPathExists=!/run/zhudatuan-staging-full/rds-init.env',
    'ConditionPathExists=!/run/zhudatuan-staging-full/database-retire.env',
  ]) assert.ok(source.includes(token), `post-bootstrap runtime gate missing (${name}): ${token}`);
}
assert.ok(files['zhudatuan-staging-full-owner-bootstrap.service'].includes(
  'Before=zhudatuan-staging-full-database-retire.service zhudatuan-staging-full-identity-api.service zhudatuan-staging-full-identity-notification-jobs.service zhudatuan-staging-full-jobs.service'));
assert.ok(databaseRetireService.includes(
  'Before=zhudatuan-staging-full-identity-api.service zhudatuan-staging-full-identity-notification-jobs.service zhudatuan-staging-full-jobs.service'));
assert.ok(!/^\[Install\]\s*$/m.test(fullJobsService));
assert.ok(fullJobsService.includes('ExecCondition=/usr/bin/false'));
assert.equal(delivery.profiles.full.runtime.jobs.activationGate, 'blocked-provider-sandbox-not-integrated');
assert.equal(delivery.profiles.full.runtime.jobs.activationMode, 'forbidden');
assert.equal(delivery.profiles.full.runtime.jobs.enable, 'forbidden');
assert.equal(delivery.profiles.full.runtime.jobs.providerPreflight, 'not-integrated');
for (const token of ['live:full-jobs:provider-sandbox-not-integrated', 'ExecCondition=/usr/bin/false',
  'live:systemd:full-jobs-must-remain-inactive']) {
  assert.ok(files['readiness-full-jobs.mjs'].includes(token), `Full Jobs permanent blocker missing: ${token}`);
}
assert.ok(files['readiness-runtime.mjs'].includes('live:systemd:full-jobs-must-remain-inactive'));
assert.ok(!files['readiness-runtime.mjs'].includes("valueAt(evidence, 'checks.P12')"),
  'P10 must never weaken the Full Jobs inactive requirement based on a future evidence flag');
for (const token of ['https://127.0.0.1:8543', 'https://127.0.0.1:8544', '127.0.0.1:55432']) {
  assert.ok(!internalRuntimeService.includes(token), `formal acceptance endpoint forbidden in full staging service: ${token}`);
}

const caddyDropIn = files['caddy-zhudatuan-staging-full.conf'];
assert.deepEqual(caddyDropIn.split(/\r?\n/u).filter((line) => line && !line.startsWith('#')), [
  '[Service]',
  'EnvironmentFile=/opt/zhudatuan-staging-full/shared/full-caddy.env',
]);
assert.ok(!caddyDropIn.includes('ExecStart='), 'Caddy drop-in must preserve the distro ExecStart');
const caddyInstaller = files['install-caddy-candidate.sh'];
for (const token of [
  "[[ \"${EUID}\" == '0' ]]",
  '--dedicated-staging-host',
  'reject_production_or_import',
  'validate_drop_in_candidate',
  'read_and_validate_environment',
  'assert_distro_caddy_unit',
  'assert_live_dedicated_host',
  'assert_virgin_or_managed_caddy',
  'backup_file_once',
  'shared/caddy-backups',
  'exact distro virgin configuration',
  "grep -Fqx -- \"$MANAGED_MARKER\" \"$CANDIDATE_CADDY\"",
  'mv -fT',
  'caddy_bin\" validate --config',
  'accounts|console|api',
]) assert.ok(caddyInstaller.includes(token), `Caddy installer safety token missing: ${token}`);
assert.equal(fullCaddy.split(/\r?\n/u)[0], '# Managed by the Zhudatuan isolated full-staging deployment.');
assert.ok(!/^\s*(?:systemctl|service)\s+.*(?:daemon-reload|reload|restart)/mu.test(caddyInstaller),
  'Caddy candidate installer must not activate or reload the service');

const deploymentSources = [
  identityCaddy,
  fullCaddy,
  files['delivery.yml'],
  files['artifacts.yml'],
  ...fullSystemdUnits.map((name) => files[name]),
  ...Object.entries(files)
    .filter(([name]) => name.endsWith('.env.example'))
    .map(([, source]) => source),
].join('\n');
for (const token of ['/opt/zhudatuan/current', '/opt/zhudatuan/shared', '/var/log/pm2', 'accounts.zhudatuan.com', 'console.zhudatuan.com', 'api.zhudatuan.com'])
  assert.ok(!deploymentSources.includes(token), `production token forbidden in staging configuration: ${token}`);

const [buildSource, jobsEntrypoint, fullJobsSource, internalRuntimeSource, postgresInitSource, postgresRetireSource,
  liveBoundarySource, liveBoundaryTestSource,postgresInitFixtureSource] = await Promise.all([
  readFile(resolve(repository, 'scripts/build-commerce.mjs'), 'utf8'),
  readFile(resolve(repository, 'services/commerce/src/entry/JobsEntrypoint.ts'), 'utf8'),
  readFile(resolve(repository, 'services/commerce/src/entry/FullJobsMain.ts'), 'utf8'),
  readFile(resolve(repository, 'tools/localinfra/src/Run.ts'), 'utf8'),
  readFile(resolve(repository, 'infrastructure/zhudatuan/aliyun/postgres-init-registration.sh'), 'utf8'),
  readFile(resolve(repository, 'infrastructure/zhudatuan/aliyun/postgres-retire-registration-bootstrap.sql'), 'utf8'),
  readFile(resolve(repository, 'services/commerce/src/bootstrap/LiveDatabaseBoundary.ts'), 'utf8'),
  readFile(resolve(repository, 'services/commerce/src/bootstrap/LiveDatabaseBoundary.test.ts'), 'utf8'),
  readFile(resolve(repository, 'scripts/audit/postgres-init-registration.pg16-fixture.mjs'), 'utf8'),
]);
assert.ok(buildSource.includes("JobsMain: 'services/commerce/src/entry/JobsMain.ts'"));
for (const token of [
  "InternalRuntimeMain: 'tools/localinfra/src/Run.ts'",
  "InternalRuntimeReadyMain: 'tools/localinfra/src/RegistrationReady.ts'",
  "LocalSecretsMain: 'tools/localsecrets/src/Main.ts'",
  "LocalKmsMain: 'tools/localkms/src/Main.ts'",
  "LocalObjectsMain: 'tools/localobjects/src/Main.ts'",
  "PostgresTlsProxyMain: 'tools/localinfra/src/PostgresTlsProxyMain.ts'",
  "BootstrapStagingOwner: 'tools/seed/src/BootstrapStagingOwner.ts'",
  "StagingReadinessMain: 'infrastructure/zhudatuan/aliyun/staging/verify-readiness.mjs'",
])
  assert.ok(buildSource.includes(token), `build artifact entry missing: ${token}`);
assert.ok(jobsEntrypoint.includes("import('./FullJobsMain')"));
assert.ok(fullJobsSource.includes('export async function runFullJobs'));
assert.ok(fullJobsSource.includes('JOB_RUNTIME_CATALOG_DRIFT'));
assert.ok(internalRuntimeSource.includes('const profile = process.env.LOCAL_RUNTIME_PROFILE'));
assert.ok(internalRuntimeSource.includes("'services/commerce/dist/LocalSecretsMain.js'"));
assert.ok(internalRuntimeSource.includes("'services/commerce/dist/LocalKmsMain.js'"));
assert.ok(internalRuntimeSource.includes("profile === 'full-staging'"));
assert.ok(internalRuntimeSource.includes("'services/commerce/dist/LocalObjectsMain.js'"));
for (const token of ['state.active_platform_owner_count !== 1', 'LIVE_DATABASE_BOUNDARY_ASSERTION_FAILED']) {
  assert.ok(liveBoundarySource.includes(token), `active Owner runtime boundary missing: ${token}`);
}
for (const token of ["['missing Owner bootstrap', { active_platform_owner_count: 0 }]",
  "['multiple active Owners', { active_platform_owner_count: 2 }]"]) {
  assert.ok(liveBoundaryTestSource.includes(token), `active Owner negative test missing: ${token}`);
}
for (const token of ['ZHUDATUAN_EXPECTED_RDS_SERVER_ADDR', 'ZHUDATUAN_IDENTITY_API_PASSWORD', 'ZHUDATUAN_IDENTITY_JOB_PASSWORD',
  'SHOPJOB_PASSWORD', 'SHOPMIGRATION_PASSWORD', 'ZHUDATUAN_BOOTSTRAP_PASSWORD', '\\getenv', 'ZHUDATUAN_RDS_INIT_PRISTINE_TARGET_REQUIRED'])
  assert.ok(postgresInitSource.includes(token), `RDS initialization input missing: ${token}`);
for (const token of ['wrong-address=1','nonempty=1','wrong-sentinel=1','zero-mutation=3','boundary-memberships=0',
  'POSTGRES_INIT_FIXTURE_SECRET_OUTPUT'])
  assert.ok(postgresInitFixtureSource.includes(token), `RDS initialization PG16 fixture missing: ${token}`);
for (const role of [
  'shopapp', 'shopmigration', 'shopread', 'zhudatuanbootstrap', 'zhudatuanwebapi',
  'zhudatuanpurchaseapi', 'zhudatuansandboxbootstrap',
]) {
  assert.ok(postgresRetireSource.includes(role), `retired database role missing: ${role}`);
}
for (const role of ['shopjob', 'zhudatuanidentityapi', 'zhudatuanidentityjob']) {
  assert.ok(postgresRetireSource.includes(role), `runtime database role missing: ${role}`);
}
for (const role of ['anon', 'authenticated', 'service_role', 'zhudatuanregistrationboundary']) {
  assert.ok(postgresRetireSource.includes(role), `NOLOGIN database role missing: ${role}`);
}
for (const token of ['NOLOGIN PASSWORD NULL', 'revoke', 'pg_auth_members', 'rolcanlogin']) {
  assert.ok(postgresRetireSource.toLowerCase().includes(token.toLowerCase()), `database retirement assertion missing: ${token}`);
}
for (const token of [
  '/opt/zhudatuan-staging-full/shared/tls',
  'internal-ca.crt',
  'internal.key',
  'internal.crt',
  'openssl',
  "process.getuid?.() !== 0",
  'await chown(destination, 0, 0)',
  'await chmod(destination, 0o600)',
  'DIRECTORY_CHAIN',
  "metadata = await lstat(candidate.path)",
  "mode !== 0o700",
  'STAGING_TLS_DIRECTORY_MISSING',
  'metadata.uid !== 0',
  'metadata.gid !== 0',
])
  assert.ok(files['prepare-internal-tls.mjs'].includes(token), `internal TLS preparation token missing: ${token}`);
for (const token of ["['-g', 'zhudatuan']", '0o640', '0o750', 'mkdir(path', 'chmod(path'])
  assert.ok(!files['prepare-internal-tls.mjs'].includes(token), `shared TLS credential boundary forbidden: ${token}`);
for (const name of ['readiness-cloud-host.mjs', 'readiness-runtime.mjs']) {
  assert.ok(files[name].includes('KNOWN_PRODUCTION_PUBLIC_ADDRESS_SHA256'),
    `known production public address fingerprint guard missing: ${name}`);
}
for (const token of ['RELEASE_WORKTREE_NOT_CLEAN', 'npm run build:auth', 'npm run build:console', 'npm run build:commerce',
  'zhudatuan.staging.release.v2', 'artifacts.yml', '.zhudatuan-staging-release.json',
  '.zhudatuan-staging-inventory.sha256', 'archiveSha256', 'inventorySha256',
  "VITE_ZHUDIAN_SOLUTION_ORIGIN: solutionOrigin", "npm_config_userconfig: '/dev/null'",
  "const solutionOrigin = 'https://disabled.full.staging.example.invalid'", 'await assertBuildMarkers(hosts, solutionOrigin)',
  'resolveBuildToolchain', 'RELEASE_NPM_CLI_NOT_FOUND', 'nodeBinarySha256', 'npmCliSha256',
  "PATH: `${dirname(buildToolchain.node)}:/usr/bin:/bin:/usr/sbin:/sbin`"])
  assert.ok(files['prepare-release.mjs'].includes(token), `release preparation token missing: ${token}`);
assert.ok(!files['prepare-release.mjs'].includes('env: process.env'), 'release build must not inherit the whole shell environment');
assert.ok(!files['prepare-release.mjs'].includes("execute('npm'"), 'release build must not resolve npm through caller PATH');
for (const token of ["const git = '/usr/bin/git'", "const tar = '/usr/bin/tar'"]) {
  assert.ok(files['prepare-release.mjs'].includes(token), `release system tool pin missing: ${token}`);
}
for (const token of ['verifyReleaseInventory(release, manifest.fileCount)', 'CANDIDATE_UNINVENTORIED_ARTIFACT',
  'CURRENT_RELEASE_INVENTORY_RECEIPT_INVALID', 'information.uid !== 0', 'mode & 0o022',
  "build.solutionOrigin !== 'https://disabled.full.staging.example.invalid'", 'build.nodeBinarySha256', 'build.npmCliSha256']) {
  assert.ok(files['readiness-candidate.mjs'].includes(token), `current release integrity check missing: ${token}`);
}
assert.ok(files['readiness-host.mjs'].includes('live:rds-init:sentinel-binding'),
  'RDS init and Owner bootstrap must use the same sentinel');
assert.ok(!/caddy\s+reload/u.test(files['README.md']), 'manual Caddy CLI reload is forbidden');
for (const name of (await readdir(directory)).filter((candidate) => candidate.endsWith('.mjs')).sort()) {
  await execute(execPath, ['--check', resolve(directory, name)]);
}
await execute(execPath, ['--check', resolve(directory, 'ecosystem.full.config.cjs')]);
for (const path of artifacts.deploymentArtifacts.filter((candidate) => candidate.endsWith('.sh'))) {
  await execute('/bin/bash', ['-n', resolve(repository, path)]);
}
await execute(execPath, [resolve(directory, 'validate-cost-approval.mjs'), '--self-test']);

console.log('Identity-SMS and evidence-gated full staging profiles verified.');

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

function uniqueResources(grants) {
  return [...new Set(Object.values(grants).flatMap(({ resources }) => resources))].sort();
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

function setEvidenceValue(evidence, path, value) {
  const segments = path.split('.');
  const key = segments.pop();
  let cursor = evidence;
  for (const segment of segments) cursor = cursor[segment];
  cursor[key] = value;
}

function fixtureValue(path) {
  if (path === 'cloudIdentity.region') return 'cn-beijing';
  if (path === 'candidate.treeState') return 'clean';
  if (path === 'network.productionEcsInstanceId') return 'i-2zeewhay0farxq8lucrd';
  if (path === 'network.productionEcsCurrentName') return '福福网全域系统';
  if (path === 'network.stagingCandidateEcsInstanceId' || path === 'network.ecsInstanceId') return 'i-2zeewhay0farxq8lucrc';
  if (path === 'network.stagingCandidateCurrentName') return '福福网-staging';
  if (path === 'network.stagingCandidateTargetName') return '福福网 staging';
  if (path === 'network.stagingCandidateZone') return 'cn-beijing-f';
  if (path === 'network.existingHostInventorySha256') return digest(canonical({
    region: 'cn-beijing',
    production: { instanceId: 'i-2zeewhay0farxq8lucrd', instanceName: '福福网全域系统' },
    stagingCandidate: {
      instanceId: 'i-2zeewhay0farxq8lucrc',
      currentName: '福福网-staging',
      targetName: '福福网 staging',
      zone: 'cn-beijing-f',
    },
  }));
  if (path.endsWith('Host')) return 'test.staging.example.invalid';
  if (path.endsWith('Absent') || path.endsWith('Enabled') || path.endsWith('Protection')) return true;
  if (path.endsWith('At') || path.endsWith('ExpiresAt')) return '2099-01-01T00:00:00.000Z';
  if (path.endsWith('Sha256') || path.endsWith('Fingerprint') || path.endsWith('.commit')) return 'a'.repeat(64);
  return 'staging-value';
}
