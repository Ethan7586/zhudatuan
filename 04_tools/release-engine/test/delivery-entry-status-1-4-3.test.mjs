import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';

import { evaluateAuthoritativeDeliveryStatus, formatDeliveryStatusHuman } from '../src/delivery-status.mjs';
import { DeliveryError } from '../src/errors.mjs';
import { findSealLifecycleState } from '../src/oss.mjs';
import { createSealLifecycleStore } from '../src/seal-lifecycle.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceSha = 'a'.repeat(40);
const controlPlaneSha = 'b'.repeat(40);
const artifactDigest = `sha256:${'c'.repeat(64)}`;
const sealKey = `sha256:${'d'.repeat(64)}`;
const key = { source_sha: sourceSha, control_plane_sha: controlPlaneSha, artifact_digest: artifactDigest, seal_key: sealKey };
const final = { schema: 'ai.delivery.final-seal.v1', release_runner: 'release-primary', reused_artifact: false, reused_validation: false };
const lifecycle = (status, extra = {}) => ({ availability: 'AVAILABLE', key, paths: { final: 'final-seal.json' }, state: { status, ...extra } });
const artifact = { sourceSha, archive: { sha256: artifactDigest } };
const candidateSeal = { schema: 'ai.delivery.candidate-seal.v1', sourceSha, artifactSha256: artifactDigest,
  candidate: '/release/candidate', expectedCurrent: '/release/other', controlPlane: { sourceSha: controlPlaneSha } };
const availableRemote = { availability: 'AVAILABLE', candidate: '/release/candidate', candidateSeal, candidateArtifact: artifact,
  current: '/release/other', currentArtifact: { sourceSha: 'e'.repeat(40), archive: { sha256: `sha256:${'f'.repeat(64)}` } },
  previous: null, previousArtifact: null };
const input = (sealLifecycle, remote = availableRemote, other = {}) => ({ sourceSha, target: 'storefront', physicalNode: 'zhudatuan-l0', sealLifecycle, remote, ...other });

test('Action success without final Seal remains not prepared or at the authoritative OSS stage', () => {
  const result = evaluateAuthoritativeDeliveryStatus(input(lifecycle('ABSENT'), { availability: 'UNAVAILABLE', error: 'offline' },
    { latestAction: { conclusion: 'success', url: 'https://example.test/old' } }));
  assert.equal(result.status, 'NOT_PREPARED');
  assert.equal(result.evidence.actions, 'AUXILIARY');
});

test('status discovers the current Seal lifecycle directly from immutable OSS objects', async () => {
  const objects = new Map();
  const client = {
    authoritativeNow() { return new Date('2026-09-16T00:00:00Z'); },
    async listPrefix(prefix) { return [...objects.keys()].filter((object) => object.startsWith(prefix)); },
    async getObject(object, missingCode = 'OSS_OBJECT_NOT_FOUND') {
      if (!objects.has(object)) throw new DeliveryError(missingCode, 'missing');
      return objects.get(object);
    },
    async putImmutable(object, value) {
      if (objects.has(object)) return { status: 'hit_remote', object };
      objects.set(object, Buffer.from(value));
      return { status: 'uploaded', object };
    },
  };
  const adapter = { project: 'fixture', targets: { storefront: {} } };
  const store = createSealLifecycleStore(client, { project: 'fixture', sourceSha, releaseTarget: 'storefront',
    physicalNode: 'zhudatuan-l0', artifactDigest, controlPlaneSha, now: () => new Date('2026-09-16T00:00:00Z') });
  await store.begin({ requestId: 'request-1', actorRole: 'build' });
  const found = await findSealLifecycleState(adapter, { sourceSha, target: 'storefront', node: 'zhudatuan-l0' }, { client });
  assert.equal(found.state.status, 'BUILDING');
  assert.equal(found.key.seal_key, store.key.seal_key);
});

test('matching final Seal and remote candidate returns SEALED', () => {
  const result = evaluateAuthoritativeDeliveryStatus(input(lifecycle('SEALED', { final, uploaded: { build_runner: 'build-a' }, validated: { release_runner: 'release-primary' } })));
  assert.equal(result.status, 'SEALED');
  assert.equal(result.controlPlaneSha, controlPlaneSha);
  assert.equal(result.finalSealReceipt.object, 'final-seal.json');
});

test('current matching the exact Seal returns DEPLOYED', () => {
  const remote = { ...availableRemote, current: candidateSeal.candidate, currentArtifact: artifact };
  const result = evaluateAuthoritativeDeliveryStatus(input(lifecycle('SEALED', { final }), remote));
  assert.equal(result.status, 'DEPLOYED');
  assert.match(formatDeliveryStatusHuman(result), /^交付状态：已部署/m);
  assert.equal(JSON.parse(JSON.stringify(result)).status, 'DEPLOYED');
});

test('previous matching the Seal never impersonates current', () => {
  const remote = { ...availableRemote, previous: candidateSeal.candidate, previousArtifact: artifact };
  const result = evaluateAuthoritativeDeliveryStatus(input(lifecycle('SEALED', { final }), remote));
  assert.equal(result.status, 'SEALED');
  assert.equal(result.previous.matchesSeal, true);
  assert.equal(result.current.matchesSeal, false);
});

test('OSS final Seal, remote Seal and current conflicts fail closed', () => {
  const mismatched = { ...availableRemote, candidateSeal: { ...candidateSeal, artifactSha256: `sha256:${'0'.repeat(64)}` } };
  const result = evaluateAuthoritativeDeliveryStatus(input(lifecycle('SEALED', { final }), mismatched));
  assert.equal(result.status, 'FAILED');
  assert.equal(result.failureCode, 'AUTHORITATIVE_SEAL_CONFLICT');
});

test('production current drifting after validation fails closed', () => {
  const remote = { ...availableRemote, current: '/release/unrelated' };
  const result = evaluateAuthoritativeDeliveryStatus(input(lifecycle('SEALED', { final }), remote));
  assert.equal(result.status, 'FAILED');
  assert.equal(result.failureCode, 'CURRENT_POINTER_CONFLICT');
});

test('unreadable authority returns UNKNOWN instead of a success state', () => {
  const noOss = evaluateAuthoritativeDeliveryStatus(input({ availability: 'UNAVAILABLE', error: 'OSS_DENIED' }));
  assert.equal(noOss.status, 'UNKNOWN');
  assert.equal(noOss.evidence.completeness, 'UNKNOWN');
  const noRemote = evaluateAuthoritativeDeliveryStatus(input(lifecycle('SEALED', { final }), { availability: 'UNAVAILABLE', error: 'SSH_DOWN' }));
  assert.equal(noRemote.status, 'UNKNOWN');
  assert.equal(noRemote.evidence.completeness, 'PARTIAL');
});

test('old or missing Actions do not change an authoritative result', () => {
  const sealed = lifecycle('SEALED', { final });
  const without = evaluateAuthoritativeDeliveryStatus(input(sealed));
  const old = evaluateAuthoritativeDeliveryStatus(input(sealed, availableRemote, { latestAction: { createdAt: '2020-01-01', url: 'https://example.test/old' } }));
  assert.equal(without.status, 'SEALED');
  assert.equal(old.status, 'SEALED');
});

test('only one normal workflow is user-dispatchable and reusable children have no dispatch trigger', async () => {
  const normal = parse(await readFile(join(root, '.github/workflows/delivery-1-4-3.yml'), 'utf8'));
  assert.ok(normal.on.workflow_dispatch);
  for (const file of ['prepare-artifact-aliyun.yml', 'deploy-prepared-aliyun.yml', 'deploy-source-aliyun.yml', 'auto-prepare-one-target.yml']) {
    const workflow = parse(await readFile(join(root, '.github/workflows', file), 'utf8'));
    assert.ok(workflow.on.workflow_call);
    assert.equal(workflow.on.workflow_dispatch, undefined);
  }
});

test('every active user-visible workflow name identifies Delivery Control 1.4.3', async () => {
  for (const file of ['delivery-1-4-3.yml', 'prepare-artifact-aliyun.yml', 'deploy-prepared-aliyun.yml',
    'deploy-source-aliyun.yml', 'auto-prepare-one-target.yml', 'auto-prepare-artifacts.yml']) {
    const firstLines = (await readFile(join(root, '.github/workflows', file), 'utf8')).split('\n').slice(0, 2).join('\n');
    assert.match(firstLines, /1\.4\.3/, file);
    assert.doesNotMatch(firstLines, /1\.4(?!\.3)/, file);
  }
});

test('system entry maps all writes to one 1.4.3 dispatcher and recovery remains isolated', async () => {
  const [dispatcher, internal, directRecovery, ossRecovery] = await Promise.all([
    readFile(join(root, '02_platform_pingtai/infrastructure/github-actions-runner/zdt-delivery'), 'utf8'),
    readFile(join(root, 'scripts/delivery-dispatch.sh'), 'utf8'),
    readFile(join(root, '.github/workflows/legacy-direct-recovery-aliyun.yml'), 'utf8'),
    readFile(join(root, '.github/workflows/legacy-oss-recovery-aliyun.yml'), 'utf8'),
  ]);
  assert.match(dispatcher, /delivery-dispatch\.sh prepare/);
  assert.match(dispatcher, /delivery-dispatch\.sh deploy/);
  assert.match(dispatcher, /delivery-dispatch\.sh deploy-source/);
  assert.match(internal, /workflow='delivery-1-4-3\.yml'/);
  assert.doesNotMatch(internal + dispatcher, /legacy-(?:direct|oss)-recovery/);
  assert.match(directRecovery, /RECOVERY ONLY/);
  assert.match(ossRecovery, /RECOVERY ONLY/);
});

test('retired predecessor entries remain impossible to schedule on a real Runner', async () => {
  for (const file of ['quality-aliyun.yml', 'quality.yml', 'prepare-artifact.yml', 'deploy-prepared.yml', 'deploy-oss.yml',
    'register-current-baseline.yml', 'register-current-baseline-aliyun.yml']) {
    const source = await readFile(join(root, '.github/workflows', file), 'utf8');
    assert.match(source, /Retired/);
    assert.match(source, /retired-workflow-never-runs/);
  }
});

test('status command is strictly read-only and exposes the 1.4.3 v2 schema', async () => {
  const [status, remote] = await Promise.all([
    readFile(join(root, 'scripts/release-status.mjs'), 'utf8'),
    readFile(join(root, '04_tools/release-engine/remote/agent.mjs'), 'utf8'),
  ]);
  assert.doesNotMatch(status, /workflow run|putImmutable|\.acquire\(|\.renew\(|\.release\(/);
  assert.match(remote, /if \(action !== 'status'\) await audit/);
  assert.match(remote, /if \(actionName !== 'status' && loadedPolicy && loadedContext\)/);
  const result = evaluateAuthoritativeDeliveryStatus(input(lifecycle('UPLOADED', { uploaded: { build_runner: 'build-a' } }), { availability: 'UNAVAILABLE' }));
  assert.equal(result.schemaVersion, 'zdt-delivery-status/v2');
  assert.equal(result.deliveryControlVersion, '1.4.3');
  assert.equal(result.status, 'UPLOADED');
});
