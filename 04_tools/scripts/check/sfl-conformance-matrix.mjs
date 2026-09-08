import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const path = (...parts) => resolve(root, ...parts);
const text = (...parts) => readFile(path(...parts), 'utf8');
const json = async (...parts) => JSON.parse(await text(...parts));

const matrixPath = [
  '05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence',
  'SFL-1.6-L0-L1-完整符合性矩阵-2026-09-08.json',
];
const matrix = await json(...matrixPath);
const expectedGateIds = [
  ...Array.from({ length: 26 }, (_, index) => `SFL-${String(index + 1).padStart(2, '0')}`),
  ...Array.from({ length: 4 }, (_, index) => `SFL-D${String(index + 1).padStart(2, '0')}`),
];
const statuses = new Set(['PASS', 'FAIL', 'UNKNOWN', 'N/A']);

assert.equal(matrix.schema_version, 'sfl.conformance-matrix.v1');
assert.equal(matrix.standard_version, 'SFL 1.6');
assert.deepEqual(matrix.status_vocabulary, [...statuses]);
assert.deepEqual(matrix.gates.map((gate) => gate.id), expectedGateIds, 'SFL matrix must contain every gate exactly once and in order');
for (const gate of matrix.gates) {
  assert.ok(typeof gate.title === 'string' && gate.title.length > 0, `${gate.id}: title missing`);
  for (const layer of ['candidate', 'production']) {
    const status = gate[`${layer}_status`];
    const evidence = gate[`${layer}_evidence`];
    assert.ok(statuses.has(status), `${gate.id}: ${layer} status invalid`);
    assert.ok(Array.isArray(evidence) && evidence.length > 0 && evidence.every((item) => typeof item === 'string' && item.length > 0),
      `${gate.id}: ${layer} evidence missing`);
  }
}

const v15 = await text('05_docs_ziliao', 'docs_wendang', 'architecture', '08-SFL-四流合一节点主权架构标准 V1.5.md');
assert.equal(createHash('sha256').update(v15).digest('hex'), 'fd050004ace1f126790c9927311aa22e5010ea2343a106f0e71f891675afc88d',
  'SFL 1.5 historical standard must remain byte-for-byte unchanged');
const v16 = await text('05_docs_ziliao', 'docs_wendang', 'architecture', '10-SFL-四流合一节点主权架构标准 V1.6.md');
assert.match(v16, /version: 'SFL 1\.6'/);
assert.match(v16, /SFL-25 \| 节点域名主权/);
assert.match(v16, /SFL-26 \| 主动跨节点授权/);
assert.match(v16, /Cross-Node Grant 保留项/);

const registry = await json('02_platform_pingtai', 'config', 'sfl-node-registry.declaration.json');
assert.equal(registry.registry_version, '1.6.0');
const l0 = registry.manifests.find((manifest) => manifest.node_id === 'node:zhudatuan:l0');
const l1 = registry.manifests.find((manifest) => manifest.node_id === 'node:hbbtzn:l1');
assert.ok(l0 && l1);
const apiHost = (manifest) => manifest.domain_bindings.find((binding) => binding.surface_ref === 'surface:api')?.host;
assert.equal(apiHost(l0), 'api.zhudatuan.com');
assert.equal(apiHost(l1), 'api.hbbtzn.com');
assert.notEqual(apiHost(l0), apiHost(l1));

async function readWorkerConfig() {
  return json('02_platform_pingtai', 'infrastructure', 'zhudatuan', 'cloudflare', 'hbbtzn-alias', 'wrangler.jsonc');
}

const retiredWorker = await readWorkerConfig();
assert.deepEqual(retiredWorker.routes, []);
assert.equal(retiredWorker.workers_dev, false);
const workerSource = await text('02_platform_pingtai', 'infrastructure', 'zhudatuan', 'cloudflare', 'hbbtzn-alias', 'src', 'index.ts');
assert.doesNotMatch(workerSource, /https?:\/\//);
assert.doesNotMatch(workerSource, /\b(?:await|return)\s+fetch\s*\(/);
assert.match(workerSource, /status:\s*410/);

const tunnel = await text('02_platform_pingtai', 'config', 'node-runtime', 'hbbtzn-l1', 'cloudflared.yml.example');
for (const host of ['api', 'accounts', 'console', 'www', 'h5', 'mall']) assert.match(tunnel, new RegExp(`hostname: ${host}\\.hbbtzn\\.com`));
assert.match(tunnel, /hostname: hbbtzn\.com/);
assert.match(tunnel, /credentials-file: \/opt\/sfl\/nodes\/hbbtzn-l1\/tunnel\/credentials\.json/);
assert.match(tunnel, /matchSNItoHost: true/);
assert.doesNotMatch(tunnel, /httpHostHeader/);
assert.doesNotMatch(tunnel, /zhudatuan\.com/);
assert.equal((tunnel.match(/service: https:\/\/127\.0\.0\.1:4430/g) ?? []).length, 7);
assert.match(tunnel, /- service: http_status:404/);

const gateway = await text('02_platform_pingtai', 'config', 'node-runtime', 'hbbtzn-l1', 'api-gateway.Caddyfile');
assert.doesNotMatch(gateway, /zhudatuan\.com/);
assert.match(gateway, /host api\.hbbtzn\.com/);
assert.match(gateway, /@storefrontPublicCatalog\s*\{\s*host h5\.hbbtzn\.com hbbtzn\.com mall\.hbbtzn\.com www\.hbbtzn\.com\s*method GET HEAD OPTIONS\s*path \/api\/v1\/catalog\/public\/products\*/);
assert.match(gateway, /@catalogBatch/);
assert.match(gateway, /path \/api\/v1\/catalog\/listings\/batches/);
for (const port of [4431, 4432, 4433, 4434, 4436]) assert.match(gateway, new RegExp(`reverse_proxy 127\\.0\\.0\\.1:${port}`));
assert.match(gateway, /header_up Host \{http\.request\.host\}/);
for (const header of ['X-Sfl-Node-Id', 'X-Sfl-Node-Manifest-Id', 'X-Zdt-Identity-Entry-Host']) {
  assert.match(gateway, new RegExp(`header_up -${header}`));
}
assert.match(gateway, /NODE_BOUNDARY_HOST_MISMATCH/);
assert.match(gateway, /421/);

const l1Environments = [
  ['identity-api.env.example', 'API_PORT', '4433'],
  ['purchase-api.env.example', 'API_PORT', '4434'],
  ['payment-webhook-api.env.example', 'API_PORT', '4436'],
];
for (const [file, key, value] of l1Environments) {
  const source = await text('02_platform_pingtai', 'config', 'node-runtime', 'hbbtzn-l1', file);
  assert.match(source, new RegExp(`^${key}=${value}$`, 'm'));
  assert.match(source, /^NODE_MANIFEST_ID=manifest:hbbtzn:l1:v1$/m);
  assert.match(source, /^NODE_RELEASE_POINTER_REF=\/opt\/sfl\/nodes\/hbbtzn-l1\/current$/m);
  assert.doesNotMatch(source, /zhudatuan\/nodes\/l0\//);
}
const jobsEnvironment = await text('02_platform_pingtai', 'config', 'node-runtime', 'hbbtzn-l1', 'payment-jobs.env.example');
assert.match(jobsEnvironment, /^JOB_RUNTIME_PROFILE=payment-only$/m);
assert.match(jobsEnvironment, /^NODE_MANIFEST_ID=manifest:hbbtzn:l1:v1$/m);
assert.doesNotMatch(jobsEnvironment, /zhudatuan\/nodes\/l0\//);

for (const unit of ['api-gateway', 'cloudflared', 'identity-api', 'purchase-api', 'payment-webhook-api', 'payment-jobs']) {
  const source = await text('02_platform_pingtai', 'infrastructure', 'zhudatuan', 'aliyun', 'systemd', `sfl-${unit}@.service`);
  assert.match(source, /\/opt\/sfl\/nodes\/%i\//);
}
const jobsRuntime = await text('01_core_hexin', 'services', 'commerce', 'src', 'bootstrap', 'PaymentJobsRuntime.ts');
assert.match(jobsRuntime, /createPaymentJobs\([^\n]+manifest\.data_scope_ref\.ref\)/);
for (const runtime of ['IdentityRegistrationApiRuntime.ts', 'PurchaseApiRuntime.ts', 'PaymentWebhookApiRuntime.ts']) {
  const source = await text('01_core_hexin', 'services', 'commerce', 'src', 'bootstrap', runtime);
  assert.match(source, /singleNodeManifestRegistry\(manifest\)/);
  assert.match(source, /NODE_RELEASE_POINTER_REF/);
}

const nodeServer = await text('01_core_hexin', 'services', 'commerce', 'src', 'foundation', 'interface', 'NodeServer.ts');
assert.doesNotMatch(nodeServer, /x-zdt-identity-entry-host/i);
assert.doesNotMatch(nodeServer, /x-sfl-node-id/i);
assert.match(nodeServer, /NODE_BOUNDARY_HOST_MISMATCH/);

const loginIntent = await text('02_platform_pingtai', 'database', 'supabase', 'migrations', '20260908012000_create_sfl_login_intents.sql');
assert.match(loginIntent, /clock_timestamp\(\)\+interval '5 minutes'/);
assert.match(loginIntent, /intent\.consumed_at is null and intent\.expires_at>clock_timestamp\(\)/);
assert.match(loginIntent, /intent\.target_realm_id=p_target_realm_id/);
assert.match(loginIntent, /intent\.target_target=p_target_target/);
assert.match(loginIntent, /intent\.target_application is not distinct from p_target_application/);
assert.match(loginIntent, /target_session\.account_id=p_target_account_id/);
assert.match(loginIntent, /target_session\.realm_id=p_target_realm_id/);
assert.match(loginIntent, /source_realm\.id<>target_realm\.id/);

const gate = (id) => matrix.gates.find((item) => item.id === id);
for (const id of ['SFL-19', 'SFL-20', 'SFL-23', 'SFL-24', 'SFL-25', 'SFL-26', 'SFL-D03', 'SFL-D04']) {
  assert.equal(gate(id)?.candidate_status, 'PASS', `${id}: candidate architecture must be complete`);
}
for (const id of ['SFL-23', 'SFL-25', 'SFL-D02', 'SFL-D03']) {
  assert.equal(gate(id)?.production_status, 'PASS', `${id}: production cutover must be verified`);
}

function summarize(field) {
  return Object.fromEntries([...statuses].map((status) => [status, matrix.gates.filter((gate) => gate[field] === status).length]));
}

console.log(JSON.stringify({
  schema_version: 'sfl.conformance-check.v1',
  standard_version: matrix.standard_version,
  gate_count: matrix.gates.length,
  candidate: summarize('candidate_status'),
  production: summarize('production_status'),
  focused_candidate_gates: Object.fromEntries(['SFL-19', 'SFL-20', 'SFL-23', 'SFL-24', 'SFL-25', 'SFL-26', 'SFL-D03', 'SFL-D04']
    .map((id) => [id, gate(id).candidate_status])),
}, null, 2));
