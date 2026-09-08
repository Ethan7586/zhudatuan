import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

import { CLIENT_SURFACES } from '../../packages/contract/src/Surface.ts';

const root = resolve(import.meta.dirname, '../..');
const requiredFiles = [
  'infrastructure/container/Runtime.yml',
  'infrastructure/container/Provider.yml',
  'infrastructure/container/Migration.yml',
  'infrastructure/container/Dockerfile',
  'infrastructure/cloud/Delivery.yml',
  'infrastructure/cloud/Topology.yml',
  'infrastructure/cloud/Deploy.sh',
  'infrastructure/network/Edge.yml',
  'infrastructure/network/Policy.yml',
  'infrastructure/network/Egress.yml',
  'infrastructure/storage/Policy.yml',
  'infrastructure/storage/Cors.yml',
  'infrastructure/monitoring/Catalog.yml',
  'infrastructure/monitoring/Dashboard.yml',
  'infrastructure/monitoring/Alerts.yml',
  'infrastructure/backup/Policy.yml',
  'infrastructure/security/SupplyChain.yml',
  'infrastructure/security/Secrets.yml',
  'infrastructure/security/Data.yml',
  'infrastructure/security/Browser.yml',
  'infrastructure/security/Database.yml',
  'infrastructure/security/Extensions.yml',
  'config/telemetry.yml',
  'scripts/release/validate.mjs',
  'scripts/release/validatebundle.mjs',
  'scripts/release/candidate.mjs',
  'scripts/release/cutover.mjs',
  'scripts/release/stage.mjs',
  'scripts/release/promote.mjs',
  'scripts/release/requirements.mjs',
  'scripts/smoke/MallEntry.ts',
  'docs/operations/deployment.md',
  'docs/operations/mallentry.md',
  '.github/workflows/quality.yml',
];
for (const file of requiredFiles) if (!existsSync(resolve(root, file))) fail(`DEPLOYMENT_FILE_MISSING:${file}`);

const read = (file) => readFileSync(resolve(root, file), 'utf8');
const delivery = parse(read('infrastructure/cloud/Delivery.yml'));
const clients = [...CLIENT_SURFACES];
const pipelineIds = ['artifactverify', 'snapshot', 'migrationprepare', 'migrationbackfill', 'migrationassert', 'runtimecanary', 'contractcutover', 'clientpublish', 'fullrollout', 'migrationretire', 'evidencearchive'];
if (delivery.version !== 2 || delivery.owner !== 'platform' || delivery.authority !== 'infrastructure/cloud/Delivery.yml') fail('DELIVERY_AUTHORITY_INVALID');
if (same(delivery.release?.clients, clients) === false || same(delivery.release?.canaryPercent, [1, 10, 50, 100]) === false) fail('DELIVERY_CLIENT_OR_TRAFFIC_SET_INVALID');
if (!['api', 'jobs', 'provider', 'migration'].every((service) => delivery.release?.services?.includes(service))) fail('DELIVERY_PROCESS_SET_INVALID');
if (
  same(
    delivery.pipeline?.map(({ id }) => id),
    pipelineIds
  ) === false ||
  new Set(pipelineIds).size !== pipelineIds.length
)
  fail('DELIVERY_PIPELINE_ORDER_INVALID');
for (const [index, stage] of delivery.pipeline.entries()) {
  const expectedAfter = index === 0 ? undefined : [pipelineIds[index - 1]];
  if (same(stage.after, expectedAfter) === false || !Array.isArray(stage.gates) || stage.gates.length === 0 || typeof stage.rollback !== 'string') fail(`DELIVERY_STAGE_INVALID:${stage.id}`);
}
const phases = delivery.pipeline.flatMap(({ parameters }) => (parameters?.phase === undefined ? [] : [parameters.phase]));
if (same(phases, ['prepare', 'backfill', 'assert', 'cutover', 'retire']) === false) fail('DELIVERY_MIGRATION_PHASES_INVALID');
for (const stage of delivery.pipeline.filter(({ parameters }) => parameters?.phase !== undefined)) {
  if (stage.parameters.parallelism !== 1 || stage.manifest !== 'infrastructure/container/Migration.yml') fail(`DELIVERY_MIGRATION_SINGLETON_INVALID:${stage.id}`);
}
if (same(delivery.pipeline.find(({ id }) => id === 'runtimecanary')?.traffic, [1]) === false || same(delivery.pipeline.find(({ id }) => id === 'fullrollout')?.traffic, [10, 50, 100]) === false) fail('DELIVERY_CANARY_INVALID');
if (same(delivery.pipeline.find(({ id }) => id === 'clientpublish')?.clients, clients) === false) fail('DELIVERY_CLIENT_PUBLISH_INVALID');
const retire = delivery.pipeline.find(({ id }) => id === 'migrationretire');
if (retire?.irreversible !== true || retire.rollback !== 'forwardfix') fail('DELIVERY_RETIRE_BOUNDARY_INVALID');

const boundaries = delivery.boundaries;
if (
  boundaries?.reversibleBefore !== 'migrationretire' ||
  same(boundaries.reversible, ['application', 'clients', 'extensionEnablement', 'cdnPointer', 'configuration']) === false ||
  same(boundaries.compensateOnly, ['payment', 'redemption', 'refund', 'journal', 'issuance', 'approvalDecision']) === false ||
  boundaries.voucherFailureMode !== 'readonly' ||
  boundaries.databaseAfterRetire !== 'forwardfix' ||
  same(boundaries.automaticRollback, ['runtimecanary', 'fullrollout']) === false
)
  fail('DELIVERY_ROLLBACK_BOUNDARY_INVALID');
for (const field of ['code', 'configuration', 'contract', 'migration', 'extensions', 'sbom', 'provenance', 'commerce', 'clients']) if (!delivery.release?.contentIdentity?.includes(field)) fail(`RELEASE_CONTENT_IDENTITY_MISSING:${field}`);
for (const field of ['checksums', 'sbom', 'provenance', 'stage', 'approval', 'databaseSnapshot', 'providerSandbox', 'requirementEvidence'])
  if (!delivery.artifact?.requiredEvidence?.includes(field)) fail(`RELEASE_EVIDENCE_MISSING:${field}`);
if (delivery.artifact?.signature !== 'sigstore-keyless' || delivery.artifact?.digest !== 'sha256' || delivery.artifact?.rejectContentDrift !== true || delivery.artifact?.rejectMutableImage !== true) fail('RELEASE_IMMUTABILITY_INVALID');

const artifacts = JSON.parse(read('config/artifacts.json'));
if (
  same(
    artifacts.applications,
    clients.map((client) => `apps/${client}`)
  ) === false
)
  fail('ARTIFACT_CLIENT_SET_INVALID');
const candidate = read('scripts/release/candidate.mjs');
for (const field of ['sourceTreeHash', 'contractHash', 'migrationHash', 'extensionHash', 'runtimeConfigHash', 'sbomHash', 'provenanceHash']) if (!candidate.includes(field)) fail(`CANDIDATE_FACT_MISSING:${field}`);
for (const script of ['candidate', 'stage', 'validate']) if (!read(`scripts/release/${script}.mjs`).includes('CLIENT_SURFACES')) fail(`RELEASE_CLIENT_AUTHORITY_MISSING:${script}`);

const deploy = read('infrastructure/cloud/Deploy.sh');
if ((deploy.match(/"\$controller" apply --delivery/g) ?? []).length !== 1 || !deploy.includes('cutover.mjs')) fail('DEPLOY_CONTROLLER_CALL_INVALID');
if (/\bkubectl\b|\bossutil\b|npm ci|docker build|for percentage|trap rollback/.test(deploy)) fail('DEPLOY_BUSINESS_OR_BUILD_LOGIC_FORBIDDEN');
if (/SHOP_NAMESPACE:-production|SHOP_RELEASE_(?:IDENTITY|ISSUER):-[a-z0-9]/i.test(deploy)) fail('DEPLOY_PRODUCTION_DEFAULT_FORBIDDEN');

const combined = requiredFiles
  .map((file) => read(file))
  .join('\n')
  .toLowerCase();
for (const retired of ['storefront-web', 'admin-web', 'auth-web', 'commerce-api', 'core-read-cache', 'services/jobs', 'pm2', 'vite preview', '/api/ai', 'admin-voucher-test']) {
  if (combined.includes(retired)) fail(`RETIRED_DEPLOYMENT_REFERENCE:${retired}`);
}
for (let stage = 1; stage <= 15; stage += 1) if (!combined.includes(`ci/${String(stage).padStart(2, '0')}_`)) fail(`CI_STAGE_MISSING:${stage}`);

console.log(`deployment contract: ${pipelineIds.length} ordered stages, 4 runtime process roles, ${clients.length} signed clients, explicit irreversible retirement and domain compensation boundaries`);

function same(actual, expected) {
  if (actual === undefined || expected === undefined) return actual === expected;
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function fail(code) {
  throw new Error(code);
}
