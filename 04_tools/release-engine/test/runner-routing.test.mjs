import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { DeliveryError } from '../src/errors.mjs';
import { createOssClient } from '../src/oss.mjs';
import { classifyDeliveryFailure, withFiniteRetry } from '../src/retry.mjs';
import { ALIYUN_BUILD_HOST, createRunnerRequest, markRunnerFinished, markRunnerStarted, routeBuildRequest, STANDARD_GITHUB_RUNNER } from '../src/runner-routing.mjs';

const project = 'fixture';
const sourceSha = 'a'.repeat(40);
const controlPlaneSha = 'b'.repeat(40);
const base = { project, sourceSha, controlPlaneSha, releaseTarget: 'console', physicalNode: 'node-a' };
const fixedNow = new Date('2026-09-16T00:00:00.000Z');
const slots = [
  { name: 'aliyun-staging-zdt-build', status: 'online', busy: false, labels: ['self-hosted', 'zdt-aliyun-build', 'zdt-aliyun-build-1'] },
  { name: 'aliyun-staging-zdt-build-2', status: 'online', busy: false, labels: ['self-hosted', 'zdt-aliyun-build', 'zdt-aliyun-build-2'] },
];

test('stable request ID binds source, target, physical node and control-plane SHA', () => {
  const request = createRunnerRequest(base);
  assert.match(request.request_id, /^[a-f0-9]{64}$/);
  assert.match(request.serialization, /source_sha=a{40}/);
  assert.match(request.serialization, /release_target=console/);
  assert.match(request.serialization, /physical_node=node-a/);
  assert.match(request.serialization, /control_plane_sha=b{40}/);
  assert.notEqual(request.request_id, createRunnerRequest({ ...base, physicalNode: 'node-b' }).request_id);
});

test('Aliyun is preferred when either logical slot on the same 202 ECS is claimable', async () => {
  const route = await routeBuildRequest(memoryStore(), { ...base, runners: slots }, clock());
  assert.equal(route.selectedRunnerClass, 'aliyun');
  assert.equal(route.selectedRunnerName, slots[0].name);
  assert.equal(route.host.id, ALIYUN_BUILD_HOST);
  assert.equal(route.host.topology, 'same-physical-host-logical-dual-slot');
  assert.equal(route.shouldBuild, true);
});

test('two busy slots overflow only to the standard GitHub runner', async () => {
  const route = await routeBuildRequest(memoryStore(), { ...base, runners: slots.map((runner) => ({ ...runner, busy: true })) }, clock());
  assert.equal(route.selectedRunnerClass, 'github');
  assert.deepEqual(route.runnerLabels, [STANDARD_GITHUB_RUNNER]);
  assert.equal(route.overflowReason, 'aliyun-slots-busy-or-offline');
});

test('one offline slot plus one busy slot overflows to GitHub', async () => {
  const runners = [{ ...slots[0], status: 'offline' }, { ...slots[1], busy: true }];
  const route = await routeBuildRequest(memoryStore(), { ...base, runners }, clock());
  assert.equal(route.selectedRunnerClass, 'github');
});

test('a later request returns to Aliyun after capacity recovers', async () => {
  const store = memoryStore();
  const first = await routeBuildRequest(store, { ...base, runners: slots.map((runner) => ({ ...runner, busy: true })) }, clock());
  const second = await routeBuildRequest(store, { ...base, sourceSha: 'c'.repeat(40), runners: slots }, clock());
  assert.equal(first.selectedRunnerClass, 'github');
  assert.equal(second.selectedRunnerClass, 'aliyun');
});

test('two concurrent requests atomically claim different logical slots', async () => {
  const store = memoryStore();
  const [left, right] = await Promise.all([
    routeBuildRequest(store, { ...base, sourceSha: 'c'.repeat(40), runners: slots }, clock()),
    routeBuildRequest(store, { ...base, sourceSha: 'd'.repeat(40), runners: slots }, clock()),
  ]);
  assert.equal(left.selectedRunnerClass, 'aliyun');
  assert.equal(right.selectedRunnerClass, 'aliyun');
  assert.notEqual(left.selectedRunnerName, right.selectedRunnerName);
});

test('the same request ID has exactly one dispatch owner', async () => {
  const store = memoryStore();
  const routes = await Promise.all([
    routeBuildRequest(store, { ...base, runners: slots }, clock()),
    routeBuildRequest(store, { ...base, runners: slots }, { now: () => new Date(fixedNow.getTime() + 1) }),
  ]);
  assert.equal(routes.filter((route) => route.shouldBuild).length, 1);
  assert.equal(routes.filter((route) => route.reusedExistingTask).length, 1);
  assert.equal(new Set(routes.map((route) => route.requestId)).size, 1);
});

test('a Runner going offline before claim is abandoned and safely reselected', async () => {
  const route = await routeBuildRequest(memoryStore(), { ...base, runners: slots }, {
    ...clock(), verifyRunnerAvailable: async (runner) => runner.name === slots[1].name,
  });
  assert.equal(route.selectedRunnerName, slots[1].name);
  assert.equal(route.leaseGeneration, 2);
  assert.equal(route.overflowReason, 'aliyun-runner-offline-before-claim');
});

test('an unstarted expired lease may safely choose a new Runner generation', async () => {
  const store = memoryStore();
  const first = await routeBuildRequest(store, { ...base, runners: slots }, clock());
  const later = { now: () => new Date(fixedNow.getTime() + 3_600_000) };
  const rerouted = await routeBuildRequest(store, { ...base, runners: slots.map((runner) => ({ ...runner, busy: true })) }, later);
  assert.equal(first.leaseGeneration, 1);
  assert.equal(rerouted.leaseGeneration, 2);
  assert.equal(rerouted.selectedRunnerClass, 'github');
  assert.equal(rerouted.shouldBuild, true);
});

test('a started build can never migrate after lease expiry or observation loss', async () => {
  const store = memoryStore();
  const routed = await routeBuildRequest(store, { ...base, runners: slots }, clock());
  await markRunnerStarted(store, { ...base, leaseGeneration: routed.leaseGeneration, selectedRunnerName: routed.selectedRunnerName, now: fixedNow });
  const later = { now: () => new Date(fixedNow.getTime() + 3_600_000) };
  const observed = await routeBuildRequest(store, { ...base, runners: [] }, later);
  assert.equal(observed.phase, 'BUILDING');
  assert.equal(observed.selectedRunnerName, routed.selectedRunnerName);
  assert.equal(observed.shouldBuild, false);
  assert.equal(observed.reusedExistingTask, true);
});

test('build failure is final and never automatically retried', async () => {
  const store = memoryStore();
  const routed = await routeBuildRequest(store, { ...base, runners: slots }, clock());
  await markRunnerStarted(store, { ...base, leaseGeneration: routed.leaseGeneration, selectedRunnerName: routed.selectedRunnerName, now: fixedNow });
  const finished = await markRunnerFinished(store, { ...base, leaseGeneration: routed.leaseGeneration, status: 'failed', now: fixedNow });
  const observed = await routeBuildRequest(store, { ...base, runners: slots }, clock());
  assert.equal(finished.failure.retryable, false);
  assert.equal(observed.phase, 'BUILD_FAILED');
  assert.equal(observed.shouldBuild, false);
});

test('UPLOADED and later Seal stages bypass build routing', async () => {
  for (const sealStage of ['UPLOADED', 'VALIDATED', 'SEALED']) {
    const route = await routeBuildRequest(memoryStore(), { ...base, runners: slots, sealStage }, clock());
    assert.equal(route.phase, sealStage);
    assert.equal(route.shouldBuild, false);
  }
});

test('GitHub reset and OSS HEAD, GET and PUT transient errors use finite retry without retrying conflicts', async () => {
  let githubAttempts = 0;
  const github = await withFiniteRetry(async () => {
    githubAttempts += 1;
    if (githubAttempts === 1) throw Object.assign(new Error('reset'), { code: 'ECONNRESET' });
    return 'visible';
  }, { stage: 'github-api', sleep: async () => {} });
  assert.equal(github.value, 'visible');
  assert.equal(github.retryCount, 1);

  for (const operation of ['head', 'get', 'put']) {
    let fetchAttempts = 0;
    const client = createOssClient({ accessKeyId: 'id', accessKeySecret: 'secret', bucket: 'bucket', endpoint: 'https://oss.example.com' }, {
      sleep: async () => {}, now: () => fixedNow,
      fetchImpl: async () => {
        fetchAttempts += 1;
        if (fetchAttempts === 1) throw Object.assign(new TypeError('socket reset'), { cause: { code: 'ECONNRESET' } });
        return new Response(operation === 'get' ? '{}' : null, { status: 200, headers: operation === 'head' ? { 'content-length': '0' } : {} });
      },
    });
    if (operation === 'head') await client.headObject('fixture.json');
    if (operation === 'get') await client.getObject('fixture.json');
    if (operation === 'put') await client.putImmutable('fixture.json', Buffer.from('{}'), 'application/json');
    assert.equal(fetchAttempts, 2, operation);
  }

  for (const code of ['BUILD_FAILED', 'TEST_FAILED', 'TYPECHECK_FAILED', 'OSS_IMMUTABLE_OBJECT_CONFLICT', 'OSS_PROVENANCE_SCOPE_MISMATCH', 'SEAL_KEY_CONFLICT', 'PREPARED_DEPLOY_CONTROL_SHA_MISMATCH', 'SEAL_VALIDATION_FAILED', 'OSS_ACCESS_DENIED', 'RUNNER_REQUEST_SOURCE_SHA_INVALID']) {
    assert.equal(classifyDeliveryFailure(new DeliveryError(code, code), 'fixture').retryable, false, code);
  }
  let conflictAttempts = 0;
  await assert.rejects(() => withFiniteRetry(async () => {
    conflictAttempts += 1;
    throw new DeliveryError('OSS_IMMUTABLE_OBJECT_CONFLICT', 'conflict');
  }, { stage: 'oss-put', sleep: async () => {} }), (error) => error.code === 'OSS_IMMUTABLE_OBJECT_CONFLICT');
  assert.equal(conflictAttempts, 1);
});

test('workflow contracts unify manual and automatic routing and forbid Larger Runner labels', async () => {
  const root = new URL('../../../', import.meta.url);
  const [prepare, automatic, manual, engine] = await Promise.all([
    readFile(new URL('.github/workflows/prepare-artifact-aliyun.yml', root), 'utf8'),
    readFile(new URL('.github/workflows/auto-prepare-one-target.yml', root), 'utf8'),
    readFile(new URL('scripts/prepare-release.sh', root), 'utf8'),
    readFile(new URL('04_tools/release-engine/src/engine.mjs', root), 'utf8'),
  ]);
  assert.match(automatic, /build_runner: auto/);
  assert.match(manual, /build_runner="\$BUILD_RUNNER"/);
  assert.doesNotMatch(manual, /actions\/runners|idle_slots|queued_runs/);
  assert.match(prepare, /select-runner/);
  assert.match(prepare, /GH_TOKEN: \$\{\{ secrets\.ZDT_RUNNER_READ_TOKEN \}\}/);
  assert.match(engine, /recheck-runner-capacity/);
  assert.match(prepare, /ubuntu-24\.04/);
  assert.doesNotMatch(prepare, /ubuntu-latest-\d+-core|larger|xlarge|[1-9][0-9]-core/i);
});

test('sing-box transport remains GitHub-only while OSS, metadata and production stay direct', async () => {
  const root = new URL('../../../', import.meta.url);
  const transport = await readFile(new URL('02_platform_pingtai/infrastructure/github-actions-runner/install-github-transport.sh', root), 'utf8');
  assert.match(transport, /loopback HTTP proxy/);
  assert.match(transport, /100\.100\.100\.200/);
  assert.match(transport, /\.aliyuncs\.com/);
  assert.match(transport, /123\.57\.62\.202/);
  assert.match(transport, /123\.57\.232\.253/);
  assert.doesNotMatch(transport, /default-route|tun:\s*true|route-all/i);
});

function clock() { return { now: () => fixedNow }; }

function memoryStore() {
  const objects = new Map();
  return {
    async listPrefix(prefix) { return [...objects.keys()].filter((key) => key.startsWith(prefix)).sort(); },
    async getObject(key) {
      if (!objects.has(key)) throw new DeliveryError('OSS_OBJECT_NOT_FOUND', `missing ${key}`);
      return objects.get(key);
    },
    async putImmutable(key, body) {
      const value = Buffer.from(body);
      if (objects.has(key)) {
        if (objects.get(key).equals(value)) return { object: key, status: 'hit_remote', bytes: value.byteLength };
        throw new DeliveryError('OSS_IMMUTABLE_OBJECT_CONFLICT', `conflict ${key}`);
      }
      objects.set(key, value);
      return { object: key, status: 'uploaded', bytes: value.byteLength };
    },
  };
}
