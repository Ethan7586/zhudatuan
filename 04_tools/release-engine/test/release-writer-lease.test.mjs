import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { DeliveryError } from '../src/errors.mjs';
import { createOssClient } from '../src/oss.mjs';
import { createReleaseWriterLeaseStore, createReleaseWriterRequest, selectReleaseWriterClass, writerLeasePaths } from '../src/release-writer-lease.mjs';

const sourceRequest = 'a'.repeat(64);
const secondRequest = 'b'.repeat(64);
const runnerRequestId = 'f'.repeat(64);
const controlPlaneSha = 'c'.repeat(40);
const sealKey = `sha256:${'d'.repeat(64)}`;
const identity = { project: 'fixture', physicalNode: 'node-a', releaseTarget: 'app' };
const primary = { actorRole: 'release', writerIdentity: 'release-primary', writerClass: 'primary', requestId: sourceRequest, runnerRequestId, controlPlaneSha, sealKey };
const standby = { actorRole: 'release', writerIdentity: 'release-standby', writerClass: 'standby', requestId: sourceRequest, runnerRequestId, controlPlaneSha, sealKey,
  primaryAvailable: false, takeoverReason: 'primary-unavailable-after-lease-expiry' };

test('Writer Lease schema and lock scope bind project, physical node and target', () => {
  const paths = writerLeasePaths(identity);
  assert.equal(paths.root, 'fixture/release-writers/v1/node-a/app/');
  assert.equal(paths.leases, `${paths.root}leases/`);
});

test('candidate validation and deployment share source identity but use distinct Release transaction IDs', () => {
  const validation = createReleaseWriterRequest({ runnerRequestId, operation: 'validate-candidate', sealKey });
  const deployment = createReleaseWriterRequest({ runnerRequestId, operation: 'deploy', sealKey });
  assert.equal(validation.runner_request_id, runnerRequestId);
  assert.equal(deployment.runner_request_id, runnerRequestId);
  assert.notEqual(validation.request_id, deployment.request_id);
  assert.equal(validation.request_id, createReleaseWriterRequest({ runnerRequestId, operation: 'validate-candidate', sealKey }).request_id);
});

test('Primary acquires one lease and Standby cannot overlap it', async () => {
  const fixture = leaseFixture();
  const acquired = await fixture.store.acquire(primary);
  assert.equal(acquired.leaseStatus, 'ACTIVE');
  assert.equal(acquired.writerClass, 'primary');
  await assert.rejects(() => fixture.store.acquire(standby), (error) => error.code === 'RELEASE_WRITER_LEASE_CONFLICT' && error.details.leaseStatus === 'ACTIVE');
});

test('Standby waits while an unavailable Primary lease is still valid', () => {
  assert.deepEqual(selectReleaseWriterClass({ primaryAvailable: false, standbyAvailable: true, leaseStatus: 'ACTIVE', activeWriterClass: 'primary' }), {
    writerClass: null, action: 'wait', message: '等待主Release租约',
  });
});

test('expired Primary lease is taken over by Standby through a new immutable generation', async () => {
  const fixture = leaseFixture();
  await fixture.store.acquire({ ...primary, leaseSeconds: 30 });
  fixture.advance(31_000);
  const takeover = await fixture.store.acquire(standby);
  assert.equal(takeover.writerClass, 'standby');
  assert.equal(takeover.leaseGeneration, 2);
  assert.equal(takeover.actualSwitch, true);
  assert.equal(takeover.originalWriter, 'release-primary');
  assert.equal(takeover.takeoverReason, standby.takeoverReason);
});

test('recovered Primary cannot reclaim a task actively owned by Standby', async () => {
  const fixture = leaseFixture();
  await fixture.store.acquire({ ...primary, leaseSeconds: 30 });
  fixture.advance(31_000);
  await fixture.store.acquire(standby);
  await assert.rejects(() => fixture.store.acquire(primary), (error) => error.code === 'RELEASE_WRITER_LEASE_CONFLICT');
});

test('after release, a different new request returns to Primary preference', async () => {
  const fixture = leaseFixture();
  await fixture.store.acquire({ ...primary, leaseSeconds: 30 });
  fixture.advance(31_000);
  await fixture.store.acquire(standby);
  await fixture.store.release(standby);
  const next = await fixture.store.acquire({ ...primary, requestId: secondRequest, sealKey: `sha256:${'e'.repeat(64)}` });
  assert.equal(next.writerClass, 'primary');
  assert.equal(next.leaseGeneration, 3);
});

test('two Release processes racing for one target produce exactly one writer', async () => {
  const fixture = leaseFixture();
  const results = await Promise.allSettled([fixture.store.acquire(primary), fixture.store.acquire({ ...primary, writerIdentity: 'other-primary' })]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.code === 'RELEASE_WRITER_LEASE_CONFLICT').length, 1);
});

test('same request ID is completed once and repeated submission does not call deployment again', async () => {
  const fixture = leaseFixture();
  let deployments = 0;
  await fixture.store.run(primary, async () => { deployments += 1; return { repeatedDeployment: false, actualSwitch: true }; });
  const repeated = await fixture.store.run(primary, async () => { deployments += 1; });
  assert.equal(deployments, 1);
  assert.equal(repeated.value.repeatedDeployment, true);
  assert.equal(repeated.value.actualSwitch, false);
});

test('a failed writer lease may be retried with the exact same request', async () => {
  const fixture = leaseFixture();
  let attempts = 0;
  await assert.rejects(() => fixture.store.run(primary, async () => {
    attempts += 1;
    throw new DeliveryError('REMOTE_AGENT_SHA256_MISMATCH', 'remote delivery agent is stale');
  }), (error) => error.code === 'REMOTE_AGENT_SHA256_MISMATCH');
  const retried = await fixture.store.run(primary, async () => {
    attempts += 1;
    return { repeatedDeployment: false, actualSwitch: false };
  });
  assert.equal(attempts, 2);
  assert.equal(retried.value.repeatedDeployment, false);
  assert.equal(retried.writer.leaseGeneration, 2);
});

test('different request for an already deployed Seal may return idempotently without switching', async () => {
  const fixture = leaseFixture();
  await fixture.store.run(primary, async () => ({ repeatedDeployment: false, actualSwitch: true }));
  const next = { ...primary, requestId: secondRequest };
  const result = await fixture.store.run(next, async (writer) => {
    assert.equal((await fixture.store.read()).leaseStatus, 'ACTIVE');
    return { repeatedDeployment: true, actualSwitch: false, writer };
  });
  assert.equal(result.value.repeatedDeployment, true);
  assert.equal(result.value.actualSwitch, false);
});

test('Standby takeover rejects source request, Seal Key or control-plane identity drift', async () => {
  for (const changed of [{ runnerRequestId: 'e'.repeat(64) }, { sealKey: `sha256:${'f'.repeat(64)}` }, { controlPlaneSha: 'e'.repeat(40) }]) {
    const fixture = leaseFixture();
    await fixture.store.acquire({ ...primary, leaseSeconds: 30 });
    fixture.advance(31_000);
    await assert.rejects(() => fixture.store.acquire({ ...standby, ...changed }), (error) => error.code === 'RELEASE_WRITER_TAKEOVER_IDENTITY_MISMATCH');
  }
});

test('Writer stays active through health failure rollback and releases only afterward', async () => {
  const fixture = leaseFixture();
  let rollbackHeldLease = false;
  await assert.rejects(() => fixture.store.run(primary, async () => {
    rollbackHeldLease = (await fixture.store.read()).leaseStatus === 'ACTIVE';
    throw new DeliveryError('CUTOVER_FAILED_AND_ROLLED_BACK', 'health failed and rollback completed');
  }), (error) => error.code === 'CUTOVER_FAILED_AND_ROLLED_BACK');
  assert.equal(rollbackHeldLease, true);
  assert.equal((await fixture.store.read()).leaseStatus, 'RELEASED');
});

test('active Release work renews its lease before expiry and stops the heartbeat before release', async () => {
  let milliseconds = Date.parse('2026-09-16T00:00:00.000Z');
  let heartbeat;
  let cleared = false;
  const store = createReleaseWriterLeaseStore(memoryStore(), identity, {
    now: () => new Date(milliseconds),
    setInterval(callback, delay) {
      assert.equal(delay, 10_000);
      heartbeat = callback;
      return { unref() {} };
    },
    clearInterval() { cleared = true; },
  });
  const result = await store.run({ ...primary, leaseSeconds: 30 }, async () => {
    milliseconds += 20_000;
    await heartbeat();
    milliseconds += 20_000;
    assert.equal((await store.read()).leaseStatus, 'ACTIVE');
    return { repeatedDeployment: false, actualSwitch: true };
  });
  assert.equal(cleared, true);
  assert.equal(result.writer.leaseStatus, 'RELEASED');
});

test('Build identity cannot acquire, renew or release a Writer Lease', async () => {
  const fixture = leaseFixture();
  await assert.rejects(() => fixture.store.acquire({ ...primary, actorRole: 'build' }), (error) => error.code === 'RELEASE_WRITER_ROLE_FORBIDDEN');
  await fixture.store.acquire(primary);
  await assert.rejects(() => fixture.store.renew({ ...primary, actorRole: 'build' }), (error) => error.code === 'RELEASE_WRITER_ROLE_FORBIDDEN');
  await assert.rejects(() => fixture.store.release({ ...primary, actorRole: 'build' }), (error) => error.code === 'RELEASE_WRITER_ROLE_FORBIDDEN');
});

test('renewal extends only the exact active writer and release is idempotent', async () => {
  const fixture = leaseFixture();
  await fixture.store.acquire({ ...primary, leaseSeconds: 30 });
  fixture.advance(10_000);
  const renewed = await fixture.store.renew({ ...primary, leaseSeconds: 60 });
  assert.equal(renewed.leaseStatus, 'ACTIVE');
  assert.equal(Date.parse(renewed.leaseExpiresAt) - fixture.time(), 60_000);
  const first = await fixture.store.release(primary);
  const second = await fixture.store.release(primary);
  assert.equal(first.leaseStatus, 'RELEASED');
  assert.equal(second.reused, true);
});

test('lease storage retries one transient network error but immutable conflicts are not overwritten', async () => {
  const remote = memoryOss({ failFirstNetwork: true });
  const client = createOssClient({ accessKeyId: 'id', accessKeySecret: 'secret', bucket: 'bucket', endpoint: 'https://oss.example.com' }, {
    fetchImpl: remote.fetch, sleep: async () => {}, now: () => new Date('2026-09-16T00:00:00.000Z'),
  });
  const store = createReleaseWriterLeaseStore(client, identity, { now: () => new Date('2026-09-16T00:00:00.000Z') });
  assert.equal((await store.acquire(primary)).leaseStatus, 'ACTIVE');
  assert.ok(remote.calls >= 2);
  await assert.rejects(() => store.acquire({ ...primary, writerIdentity: 'conflicting-writer' }),
    (error) => error.code === 'RELEASE_WRITER_LEASE_CONFLICT' && error.details.retryable === false);
  assert.equal(remote.objects.size, 1);
});

test('both writers unavailable fail closed without creating a half deployment', () => {
  assert.throws(() => selectReleaseWriterClass({ primaryAvailable: false, standbyAvailable: false, leaseStatus: 'EXPIRED' }),
    (error) => error.code === 'RELEASE_WRITERS_UNAVAILABLE');
});

test('deployment obtains exact final Seal and Writer Lease before SSH while preserving pure deploy and remote rollback lock', async () => {
  const root = new URL('../../../', import.meta.url);
  const [engine, workflow, agent] = await Promise.all([
    readFile(new URL('04_tools/release-engine/src/engine.mjs', root), 'utf8'),
    readFile(new URL('.github/workflows/deploy-prepared-aliyun.yml', root), 'utf8'),
    readFile(new URL('04_tools/release-engine/remote/agent.mjs', root), 'utf8'),
  ]);
  const finalSeal = engine.indexOf('await resolveExactFinalSealReceipt(adapter');
  const writer = engine.indexOf('await writerStore.run(writerOptions');
  const remote = engine.indexOf('const remote = await runCommand(', writer);
  assert.ok(finalSeal >= 0 && writer > finalSeal && remote > writer);
  assert.match(engine, /: authoritativeSeal\.key;/);
  assert.match(engine, /controlPlaneSha: sealIdentity\.control_plane_sha/);
  assert.match(engine, /operation: candidateOnly \? 'validate-candidate' : 'deploy'/);
  assert.match(engine, /verify-superseded-control/);
  assert.match(engine, /verify-superseded-current/);
  assert.match(engine, /cacheStatus: 'superseded_current'/);
  assert.ok(engine.indexOf('verify-superseded-control') < engine.indexOf('verify-superseded-current'));
  assert.match(engine, /Remote Agent or policy differs before superseded health verification/);
  assert.match(engine, /requestId: releaseRequest\.request_id, runnerRequestId: runnerRequest\.request_id/);
  assert.match(workflow, /--writer-identity "\$RUNNER_NAME"/);
  assert.match(workflow, /ZDT_RUNNER_READ_TOKEN/);
  assert.doesNotMatch(workflow, /npm ci|\brelease\s+--\s+(?:build|package|publish)\b/);
  assert.match(agent, /await acquireDirectoryLock/);
  assert.ok(agent.indexOf("await atomicPointer(join(root, 'current'), previousCurrent)") < agent.indexOf("throw failure('CUTOVER_FAILED_AND_ROLLED_BACK'"));
});

function leaseFixture() {
  let milliseconds = Date.parse('2026-09-16T00:00:00.000Z');
  const client = memoryStore();
  return { client, store: createReleaseWriterLeaseStore(client, identity, { now: () => new Date(milliseconds) }),
    advance: (value) => { milliseconds += value; }, time: () => milliseconds };
}

function memoryStore() {
  const objects = new Map();
  return {
    objects,
    async listPrefix(prefix) { return [...objects.keys()].filter((key) => key.startsWith(prefix)).sort(); },
    async getObject(key) { if (!objects.has(key)) throw new DeliveryError('OSS_OBJECT_NOT_FOUND', `missing ${key}`); return objects.get(key); },
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

function memoryOss({ failFirstNetwork = false } = {}) {
  const objects = new Map();
  let calls = 0;
  return {
    objects,
    get calls() { return calls; },
    fetch: async (input, options = {}) => {
      calls += 1;
      if (failFirstNetwork && calls === 1) throw Object.assign(new TypeError('reset'), { cause: { code: 'ECONNRESET' } });
      const url = new URL(input);
      if (url.searchParams.get('list-type') === '2') {
        const prefix = url.searchParams.get('prefix') ?? '';
        const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort().map((key) => `<Contents><Key>${encodeURIComponent(key)}</Key></Contents>`).join('');
        return new Response(`<ListBucketResult>${keys}<IsTruncated>false</IsTruncated></ListBucketResult>`, { status: 200 });
      }
      const key = decodeURIComponent(url.pathname.slice(1));
      if (options.method === 'HEAD') {
        if (!objects.has(key)) return new Response(null, { status: 404 });
        const body = objects.get(key);
        return new Response(null, { status: 200, headers: { 'content-length': String(body.byteLength), 'x-oss-meta-sha256': options.headers?.['x-oss-meta-sha256'] ?? '' } });
      }
      if (options.method === 'GET') return objects.has(key) ? new Response(objects.get(key), { status: 200 }) : new Response('missing', { status: 404 });
      if (options.method === 'PUT') {
        if (objects.has(key)) return new Response('conflict', { status: 409 });
        objects.set(key, Buffer.from(options.body));
        return new Response(null, { status: 200 });
      }
      return new Response('unsupported', { status: 400 });
    },
  };
}
