import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { DeliveryError } from '../src/errors.mjs';
import {
  canonicalDeliveryAdapter,
  createProductionReleaseRequest,
  finalizeProductionClosureManifest,
  orchestrateProductionClosure,
  verifyProductionClosureManifest,
} from '../src/production-orchestrator.mjs';

const sourceSha = 'a'.repeat(40);
const controlPlaneSha = 'b'.repeat(40);
const provenanceDigest = `sha256:${'d'.repeat(64)}`;
const components = [
  { componentId: 'console', target: 'console', physicalNode: 'node-a', dependsOn: [] },
  { componentId: 'web-api', target: 'web-api', physicalNode: 'node-a', dependsOn: [] },
];

test('finalized closure makes exact final Seals the single deployment authority', async () => {
  const draft = {
    schemaVersion: 'zdt-automatic-artifact-closure/v1',
    sourceSha,
    beforeSha: '0'.repeat(40),
    targets: ['database-migration', 'support-api', 'console'],
    reconciliation: { action: 'prepare' },
    preparations: [],
    waves: {
      migrations: [{ target: 'database-migration', node: 'aliyun-shanghai' }],
      runtimes: [{ target: 'support-api', node: 'aliyun-shanghai' }],
      frontends: [{ target: 'console', node: 'aliyun-shanghai' }],
    },
  };
  const closure = await finalizeProductionClosureManifest({}, draft, { controlPlaneSha }, {
    now: () => new Date('2026-01-01T00:00:00Z'),
    resolveSeal: async ({ target }) => ({
      artifactDigest: `sha256:${target === 'console' ? 'c' : target === 'support-api' ? 'a' : 'e'}`.replace(
        /sha256:([cae])$/,
        (_match, character) => `sha256:${character.repeat(64)}`,
      ),
      provenanceDigest,
      recovered: target === 'database-migration',
      seal: {
        key: { control_plane_sha: controlPlaneSha, seal_key: `sha256:${'f'.repeat(64)}` },
        object: `releases/${sourceSha}/${target}/aliyun-shanghai/seals/${controlPlaneSha}/final-seal.json`,
        receipt: { seal_digest: `sha256:${'9'.repeat(64)}` },
      },
    }),
  });
  const verified = verifyProductionClosureManifest(closure, sourceSha);
  assert.equal(verified.schemaVersion, 'zdt-automatic-artifact-closure/v2');
  assert.equal(verified.bundleGate.allowDeploy, true);
  assert.equal(verified.deploymentEntries.length, 3);
  assert.equal(verified.waves.migrations[0].seal_recovered, true);
  assert.equal(verified.waves.frontends[0].seal_control_sha, controlPlaneSha);
});

test('draft or tampered closure cannot authorize deployment', async () => {
  assert.throws(() => verifyProductionClosureManifest({ schemaVersion: 'zdt-automatic-artifact-closure/v1' }, sourceSha),
    (error) => error.code === 'SEALED_CLOSURE_SCHEMA_INVALID');
  const empty = await finalizeProductionClosureManifest({}, {
    schemaVersion: 'zdt-automatic-artifact-closure/v1', sourceSha, beforeSha: '0'.repeat(40), targets: [],
    reconciliation: {}, preparations: [], waves: { migrations: [], runtimes: [], frontends: [] },
  }, { controlPlaneSha }, { now: () => new Date('2026-01-01T00:00:00Z') });
  assert.throws(() => verifyProductionClosureManifest({ ...empty, finalizedAt: '2027-01-01T00:00:00.000Z' }, sourceSha),
    (error) => error.code === 'SEALED_CLOSURE_DIGEST_MISMATCH');
});

test('release request resolves latest origin control separately from business source', async () => {
  const releaseRequest = await request();
  assert.equal(releaseRequest.sourceSha, sourceSha); assert.equal(releaseRequest.controlPlaneSha, controlPlaneSha); assert.notEqual(releaseRequest.sourceSha, releaseRequest.controlPlaneSha);
  assert.match(releaseRequest.idempotencyKey, /^sha256:[a-f0-9]{64}$/); assert.equal(releaseRequest.expectedComponentClosure.length, 2);
});

test('same release identity converges to the same idempotency key', async () => {
  const first = await request(); const second = await request({ requestId: 'another-visible-request' });
  assert.equal(first.idempotencyKey, second.idempotencyKey);
});

test('fresh source completes one-trigger simulated closure through health', async () => {
  const fixture = orchestrationFixture();
  const result = await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.equal(result.state, 'HEALTHY'); assert.equal(result.action, 'DEPLOYED_AND_HEALTHY');
  assert.equal(fixture.prepares.length, 2); assert.equal(fixture.deploys.length, 2); assert.equal(fixture.healthChecks, 2);
  assert.deepEqual(new Set(fixture.prepares.map(({ source }) => source)), new Set([sourceSha]));
  assert.deepEqual(new Set(fixture.prepares.map(({ control }) => control)), new Set([controlPlaneSha]));
});

test('already sealed source enters bundle gate without rebuilding', async () => {
  const fixture = orchestrationFixture({ initiallySealed: ['console', 'web-api'] });
  const result = await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.equal(result.state, 'HEALTHY'); assert.equal(fixture.prepares.length, 0); assert.equal(fixture.deploys.length, 2);
});

test('console resumes missing final Seal while web-api prepares independently', async () => {
  const fixture = orchestrationFixture({ initialActions: { console: 'RESUME_FINAL_SEAL_WRITE', 'web-api': 'RESUME_UPLOAD' } });
  const result = await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.equal(result.state, 'HEALTHY');
  assert.deepEqual(fixture.prepares.map(({ target }) => target).sort(), ['console', 'web-api']);
  assert.equal(fixture.prepareKinds.console, 'RESUME_FINAL_SEAL_WRITE');
});

test('ambiguous Seal write that committed is recovered by exact readback without duplicate prepare', async () => {
  const fixture = orchestrationFixture({ prepareFailures: { console: ['ambiguous-committed'] } });
  const result = await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.equal(result.state, 'HEALTHY'); assert.equal(fixture.prepares.filter(({ target }) => target === 'console').length, 1);
});

test('STS expiry refreshes and retries the same canonical prepare', async () => {
  const fixture = orchestrationFixture({ prepareFailures: { console: ['sts-expired'] } });
  const result = await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.equal(result.state, 'HEALTHY'); assert.equal(fixture.refreshes, 1);
  assert.equal(fixture.prepares.filter(({ target }) => target === 'console').length, 2);
});

for (const failure of ['http-500', 'http-429']) test(`${failure} retries with bounded backoff`, async () => {
  const fixture = orchestrationFixture({ prepareFailures: { console: [failure] } });
  const result = await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.equal(result.state, 'HEALTHY'); assert.deepEqual(fixture.delays, [100]);
});

test('exhausted transient budget exposes a resumable checkpoint for the same request', async () => {
  const fixture = orchestrationFixture({ prepareFailures: { console: ['http-500', 'http-500', 'http-500'] } });
  const result = await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.equal(result.state, 'FAILED_RETRYABLE'); assert.equal(result.action, 'REPLAY_SAME_REQUEST_FROM_CHECKPOINT');
  assert.equal(result.components.find(({ componentId }) => componentId === 'console').resumeAllowed, true);
  assert.deepEqual(fixture.delays, [100, 200]);
});

test('403 blocks without blind retry and preserves the component checkpoint', async () => {
  const fixture = orchestrationFixture({ prepareFailures: { console: ['403'] } });
  const result = await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.equal(result.state, 'FAILED_BLOCKED'); assert.equal(result.requiresHuman, true);
  assert.equal(fixture.prepares.filter(({ target }) => target === 'console').length, 1);
  assert.equal(fixture.deploys.length, 0);
});

test('security identity mismatch permanently blocks before canonical actions', async () => {
  const fixture = orchestrationFixture({ initialActions: { console: 'STOP_SECURITY_MISMATCH' } });
  const result = await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.equal(result.state, 'FAILED_BLOCKED'); assert.equal(fixture.prepares.length, 1, 'independent web-api may still prepare'); assert.equal(fixture.deploys.length, 0);
});

test('one component without final Seal makes bundle gate deny every deploy', async () => {
  const fixture = orchestrationFixture({ neverSeals: ['console'] });
  const result = await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.equal(result.state, 'FAILED_BLOCKED'); assert.equal(fixture.deploys.length, 0);
});

test('all exact sealed components invoke canonical deploy with exact arguments', async () => {
  const fixture = orchestrationFixture({ initiallySealed: ['console', 'web-api'] });
  await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.deepEqual(fixture.deploys.map(({ target, source, node, control }) => [target, source, node, control]), [
    ['console', sourceSha, 'node-a', controlPlaneSha], ['web-api', sourceSha, 'node-a', controlPlaneSha],
  ]);
});

test('active Release Writer conflict blocks duplicate deployment', async () => {
  const fixture = orchestrationFixture({ writerOwner: false, initiallySealed: ['console', 'web-api'] });
  const result = await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.equal(result.state, 'FAILED_BLOCKED'); assert.equal(fixture.deploys.length, 0);
});

test('completed duplicate request is an idempotent no-op', async () => {
  const fixture = orchestrationFixture({ completed: true });
  const result = await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.equal(result.action, 'NOOP_ALREADY_HEALTHY'); assert.equal(fixture.prepares.length, 0); assert.equal(fixture.deploys.length, 0);
});

test('health failure stops later dependency waves and preserves rollback evidence boundary', async () => {
  const dependent = [{ ...components[0] }, { ...components[1], dependsOn: ['console'] }];
  const fixture = orchestrationFixture({ unhealthy: ['console'] });
  const result = await orchestrateProductionClosure(await request({ requiredComponents: dependent }), fixture.dependencies);
  assert.equal(result.state, 'FAILED_BLOCKED'); assert.equal(fixture.deploys.length, 1); assert.equal(fixture.healthChecks, 1);
});

test('Seal-to-Deploy gap is measured as local evidence without production P95 claim', async () => {
  const fixture = orchestrationFixture({ initiallySealed: ['console', 'web-api'] });
  const result = await orchestrateProductionClosure(await request(), fixture.dependencies);
  assert.equal(result.productionP95Claimed, false); assert.ok(result.deployReceipt.sealToDeployGapMs <= 10_000); assert.equal(result.deployReceipt.localEvidenceOnly, true);
});

test('canonical adapter invokes only zdt-delivery prepare/deploy and rejects control drift', async () => {
  const calls = [];
  const adapter = canonicalDeliveryAdapter({ execFile: async (binary, args) => { calls.push([binary, args]); return { stdout: `Delivery control: ${controlPlaneSha}\n` }; } });
  await adapter.prepare('console', sourceSha, 'node-a', controlPlaneSha); await adapter.deploy('console', sourceSha, 'node-a', controlPlaneSha);
  assert.deepEqual(calls.map(([, args]) => args[0]), ['prepare', 'deploy']);
  await assert.rejects(canonicalDeliveryAdapter({ execFile: async () => ({ stdout: `Delivery control: ${'e'.repeat(40)}\n` }) })
    .deploy('console', sourceSha, 'node-a', controlPlaneSha), (error) => error.code === 'CANONICAL_CONTROL_SHA_DRIFT');
});

test('failed closure replay preserves exact identity without trusting event type', async () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
  const [automatic, consumer] = await Promise.all([
    readFile(join(root, '.github/workflows/auto-prepare-artifacts.yml'), 'utf8'),
    readFile(join(root, '.github/workflows/deploy-source-aliyun.yml'), 'utf8'),
  ]);
  assert.match(automatic, /head_sha:[\s\S]*required: true/);
  assert.match(automatic, /base_sha:[\s\S]*required: true/); assert.match(automatic, /assertGitAncestor/);
  assert.match(automatic, /No failed automatic closure exists for the exact source SHA/);
  assert.match(consumer, /automatic-artifact-closure-\$\{SOURCE_SHA\}/); assert.doesNotMatch(consumer, /--event push/);
  assert.match(consumer, /v\.event==='workflow_dispatch'/);
});

test('status and receipts redact supplied secrets', async () => {
  const fixture = orchestrationFixture(); const secret = 'fixture-sensitive-secret';
  const release = { ...(await request()), secretValues: [secret], triggerActor: secret };
  const result = await orchestrateProductionClosure(release, fixture.dependencies);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
});

async function request(overrides = {}) {
  return createProductionReleaseRequest({ project: 'zdt-next', sourceSha, triggerActor: 'fixture-actor',
    requiredComponents: components, retryPolicy: { budget: 3, baseDelayMs: 100 }, rolloutPolicy: { maxSealToDeployGapMs: 10_000 }, ...overrides },
  { resolveLatestControlSha: async () => controlPlaneSha, now: () => new Date('2026-01-01T00:00:00Z') });
}

function orchestrationFixture(options = {}) {
  const sealed = new Set(options.initiallySealed ?? []); const prepares = []; const deploys = []; const delays = [];
  const failures = Object.fromEntries(Object.entries(options.prepareFailures ?? {}).map(([key, value]) => [key, [...value]]));
  const initial = { ...(options.initialActions ?? {}) }; const prepareKinds = {}; const receipts = new Map();
  let healthChecks = 0; let refreshes = 0; let tick = 0;
  const now = () => new Date(Date.parse('2026-01-01T00:00:00Z') + tick++ * 100);
  const state = (component, action = sealed.has(component.componentId) ? 'NOOP_ALREADY_SEALED' : initial[component.componentId] ?? 'RESUME_UPLOAD') => ({
    state: action === 'NOOP_ALREADY_SEALED' ? 'SEALED' : action.startsWith('STOP_') ? 'FAILED_BLOCKED' : action === 'RESUME_FINAL_SEAL_WRITE' ? 'FAILED_RETRYABLE' : 'ABSENT',
    action, sourceSha, controlPlaneSha, target: component.target, physicalNode: component.physicalNode,
    artifactDigest: `sha256:${component.componentId === 'console' ? 'c' : 'f'.repeat(64)}`.replace(/^sha256:c$/, `sha256:${'c'.repeat(64)}`),
    provenanceDigest, exactResource: `fixture/${component.componentId}/final-seal.json`, checkpoint: action, completedEvidence: [],
    nextSafeAction: action.startsWith('STOP_') ? 'repair-and-replay-same-request' : 'continue', timestamp: now().toISOString(),
  });
  const canonical = {
    async prepare(target, source, node, control) {
      const componentId = target; prepares.push({ target, source, node, control }); prepareKinds[componentId] ??= initial[componentId] ?? 'RESUME_UPLOAD';
      const failure = failures[componentId]?.shift();
      if (failure === 'ambiguous-committed') { sealed.add(componentId); throw Object.assign(new Error('unknown'), { code: 'FINAL_SEAL_WRITE_OUTCOME_UNKNOWN' }); }
      if (failure === 'sts-expired') throw new DeliveryError('STS_CREDENTIAL_EXPIRED', 'expired');
      if (failure === '403') throw new DeliveryError('OSS_GET_FAILED', 'ImplicitDeny', { status: 403 });
      if (failure?.startsWith('http-')) throw Object.assign(new Error(failure), { status: Number(failure.slice(5)) });
      if (!options.neverSeals?.includes(componentId)) sealed.add(componentId);
      return { target, source, node, control };
    },
    async deploy(target, source, node, control) { deploys.push({ target, source, node, control }); return { target, source, node, control }; },
  };
  const dependencies = {
    now, canonical, sleep: async (ms) => delays.push(ms), random: () => 0,
    refreshCredential: async () => { refreshes += 1; },
    doctor: async () => ({ readyForPrepare: true }),
    reconcileComponent: async (_request, component, error) => {
      if (error?.details?.status === 403 || error?.status === 403) return state(component, 'STOP_PERMISSION_DENIED');
      return state(component);
    },
    evaluateBundle: undefined,
    healthCheck: async (_request, component) => { healthChecks += 1; return { healthy: !options.unhealthy?.includes(component.componentId),
      current: `/current/${component.componentId}`, previous: `/previous/${component.componentId}`, rollbackEvidence: `rollback-${component.componentId}` }; },
    stateStore: {
      async claimRequest(_key, value) { return { requestId: value.requestId }; },
      async getCompleted() { return options.completed ? { state: 'HEALTHY', components: [] } : null; },
      async acquireReleaseWriter() { return { owner: options.writerOwner !== false }; },
      async getDeployReceipt() { return options.deployReceipt ?? null; },
      async putImmutable(kind, key, value) { const id = `${kind}:${key}`; if (receipts.has(id)) assert.deepEqual(receipts.get(id), value); else receipts.set(id, value); },
    },
  };
  return { dependencies, prepares, deploys, delays, prepareKinds, receipts,
    get healthChecks() { return healthChecks; }, get refreshes() { return refreshes; } };
}
