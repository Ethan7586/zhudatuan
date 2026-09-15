import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateDeliveryStatus } from '../src/delivery-status.mjs';
import { createOssClient } from '../src/oss.mjs';
import { createSealKey, createSealLifecycleStore, runSealLifecycle, sealObjectPaths } from '../src/seal-lifecycle.mjs';
import { sha256 } from '../src/stable.mjs';

const sourceSha = 'a'.repeat(40);
const controlPlaneSha = 'b'.repeat(40);
const artifactDigest = `sha256:${'c'.repeat(64)}`;
const base = { project: 'fixture', sourceSha, releaseTarget: 'app', physicalNode: 'node-a', artifactDigest, controlPlaneSha };
const artifact = { object: `fixture/app/${sourceSha}/artifact.tar.gz`, digest: artifactDigest, bytes: 8 };
const provenance = { object: `fixture/app/${sourceSha}/provenance.json`, digest: `sha256:${'d'.repeat(64)}` };

test('Canonical Seal Key has one strict serialization and canonical object path', () => {
  const key = createSealKey(base);
  assert.equal(key.serialization, [
    'zdt-seal-key/v1', `source_sha=${sourceSha}`, 'release_target=app', 'physical_node=node-a',
    `artifact_digest=${artifactDigest}`, `control_plane_sha=${controlPlaneSha}`,
  ].join('\n'));
  assert.equal(key.seal_key, `sha256:${sha256(key.serialization)}`);
  assert.equal(sealObjectPaths('fixture', key).final,
    `fixture/app/${sourceSha}/seals/v1/node-a/${'c'.repeat(64)}/${controlPlaneSha}/final-seal.json`);
  assert.throws(() => createSealKey({ ...base, sourceSha: 'short' }), (error) => error.code === 'SEAL_SOURCE_SHA_INVALID');
});

test('two concurrent identical requests create one artifact and one final Seal receipt', async () => {
  const fixture = lifecycleFixture();
  let builds = 0;
  let validations = 0;
  const execute = (requestId) => runSealLifecycle(fixture.store, {
    requestId, observeTimeoutMs: 1000, observeIntervalMs: 2,
    build: async () => {
      builds += 1;
      await fixture.client.putImmutable(artifact.object, Buffer.from('artifact'));
      await new Promise((resolve) => setTimeout(resolve, 15));
      return { artifact, provenance, buildRunner: 'build-1' };
    },
    validate: async () => {
      validations += 1;
      return { validation: { ok: true, receipt_digest: `sha256:${'e'.repeat(64)}` }, releaseRunner: 'release-1' };
    },
  });
  const [first, second] = await Promise.all([execute('request-1'), execute('request-2')]);
  assert.equal(first.status, 'SEALED');
  assert.equal(second.status, 'SEALED');
  assert.equal(builds, 1);
  assert.equal(validations, 1);
  assert.equal([...fixture.remote.objects.keys()].filter((path) => path === artifact.object).length, 1);
  assert.equal([...fixture.remote.objects.keys()].filter((path) => path.endsWith('/final-seal.json')).length, 1);
});

test('SEALED requests return the original receipt without build or validation', async () => {
  const fixture = lifecycleFixture();
  await complete(fixture.store, 'original');
  let called = false;
  const result = await runSealLifecycle(fixture.store, {
    requestId: 'repeat', build: async () => { called = true; }, validate: async () => { called = true; },
  });
  assert.equal(result.status, 'SEALED');
  assert.equal(result.reused, true);
  assert.equal(called, false);
});

test('a valid BUILDING lease is observed and never creates a duplicate build', async () => {
  const fixture = lifecycleFixture();
  const first = await fixture.store.begin({ requestId: 'owner', actorRole: 'build', leaseSeconds: 60 });
  const second = await fixture.store.begin({ requestId: 'observer', actorRole: 'build', leaseSeconds: 60 });
  assert.equal(first.action, 'build');
  assert.equal(first.owner, true);
  assert.equal(second.action, 'observe');
  assert.equal(second.owner, false);
  assert.equal(second.lease.request_id, 'owner');
});

test('an expired BUILDING lease is recovered with one new immutable generation', async () => {
  const fixture = lifecycleFixture();
  await fixture.store.begin({ requestId: 'expired-owner', actorRole: 'build', leaseSeconds: 30 });
  fixture.advance(31_000);
  const recovered = await fixture.store.begin({ requestId: 'recovery', actorRole: 'build', leaseSeconds: 30 });
  assert.equal(recovered.action, 'recover');
  assert.equal(recovered.owner, true);
  assert.equal(recovered.lease.generation, 1);
  assert.equal(recovered.lease.request_id, 'recovery');
});

test('UPLOADED resumes at validation without rebuilding', async () => {
  const fixture = lifecycleFixture();
  await fixture.store.begin({ requestId: 'upload-owner', actorRole: 'build' });
  await fixture.store.markUploaded({ requestId: 'upload-owner', actorRole: 'build', artifact, provenance, buildRunner: 'build-1' });
  let builds = 0;
  let validations = 0;
  const result = await runSealLifecycle(fixture.store, {
    requestId: 'resume-uploaded', build: async () => { builds += 1; },
    validate: async () => { validations += 1; return validation(); },
  });
  assert.equal(result.status, 'SEALED');
  assert.equal(builds, 0);
  assert.equal(validations, 1);
});

test('VALIDATED resumes by creating only the final Seal receipt', async () => {
  const fixture = lifecycleFixture();
  await uploaded(fixture.store, 'validated-owner');
  await fixture.store.markValidated({ requestId: 'validated-owner', actorRole: 'release', ...validation() });
  let called = false;
  const result = await runSealLifecycle(fixture.store, {
    requestId: 'resume-validated', build: async () => { called = true; }, validate: async () => { called = true; },
  });
  assert.equal(result.status, 'SEALED');
  assert.equal(called, false);
});

test('final Seal is atomically created, idempotently reused, and cannot be overwritten', async () => {
  const fixture = lifecycleFixture();
  await uploaded(fixture.store, 'atomic');
  await fixture.store.markValidated({ requestId: 'atomic', actorRole: 'release', ...validation() });
  const first = await fixture.store.seal({ requestId: 'atomic', actorRole: 'release' });
  const second = await fixture.store.seal({ requestId: 'repeat', actorRole: 'release' });
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.deepEqual(second.receipt, first.receipt);
  await assert.rejects(
    () => fixture.client.putImmutable(fixture.store.paths.final, Buffer.from('{"different":true}\n'), 'application/json'),
    (error) => error.code === 'OSS_IMMUTABLE_OBJECT_CONFLICT'
  );
});

test('an existing OSS object with a different digest stops as a conflict', async () => {
  const fixture = lifecycleFixture();
  await fixture.client.putImmutable(artifact.object, Buffer.from('first'));
  await assert.rejects(
    () => fixture.client.putImmutable(artifact.object, Buffer.from('second')),
    (error) => error.code === 'OSS_IMMUTABLE_OBJECT_CONFLICT'
  );
});

test('candidate validation failure records FAILED and cannot create a Seal', async () => {
  const fixture = lifecycleFixture();
  const result = await runSealLifecycle(fixture.store, {
    requestId: 'invalid-candidate', build: async () => ({ artifact, provenance, buildRunner: 'build-1' }),
    validate: async () => { throw Object.assign(new Error('candidate unhealthy'), { code: 'CANDIDATE_UNHEALTHY' }); },
    retryable: () => false,
  });
  assert.equal(result.status, 'FAILED');
  assert.deepEqual(result.failure, { classification: 'CANDIDATE_UNHEALTHY', retryable: false, reason: 'candidate unhealthy' });
  assert.equal(fixture.remote.objects.has(fixture.store.paths.final), false);
});

test('retryable FAILED resumes from its last immutable safe stage', async () => {
  const fixture = lifecycleFixture();
  let builds = 0;
  let validations = 0;
  const failed = await runSealLifecycle(fixture.store, {
    requestId: 'retryable-failure',
    build: async () => { builds += 1; return { artifact, provenance, buildRunner: 'build-1' }; },
    validate: async () => { validations += 1; throw Object.assign(new Error('temporary validator outage'), { code: 'VALIDATOR_UNAVAILABLE' }); },
    retryable: () => true,
  });
  assert.equal(failed.status, 'FAILED');
  fixture.advance(1);
  const recovered = await runSealLifecycle(fixture.store, {
    requestId: 'retry-after-failure',
    build: async () => { builds += 1; },
    validate: async () => { validations += 1; return validation(); },
  });
  assert.equal(recovered.status, 'SEALED', JSON.stringify(recovered));
  assert.equal(builds, 1);
  assert.equal(validations, 2);
});

test('green Action without an OSS final Seal receipt remains explicitly unsealed', () => {
  const green = { databaseId: 10, status: 'completed', conclusion: 'success' };
  const result = evaluateDeliveryStatus({
    localCommit: true, remoteCommit: true, inMainline: true, channelConfigured: true,
    prepareRuns: [green], sealRuns: [green], sealAuthority: { status: 'ABSENT' },
  });
  assert.equal(result.code, 'SEAL_RECEIPT_MISSING');
  assert.equal(result.states.sealed, false);
  assert.equal(result.states.deployable, false);
});

test('Build cannot validate, Seal, or obtain deployment authority', async () => {
  const fixture = lifecycleFixture();
  await uploaded(fixture.store, 'role-owner');
  await assert.rejects(
    () => fixture.store.markValidated({ requestId: 'role-owner', actorRole: 'build', ...validation() }),
    (error) => error.code === 'SEAL_VALIDATE_ROLE_FORBIDDEN'
  );
  await assert.rejects(
    () => fixture.store.seal({ requestId: 'role-owner', actorRole: 'build' }),
    (error) => error.code === 'SEAL_FINALIZE_ROLE_FORBIDDEN'
  );
});

function lifecycleFixture() {
  const remote = memoryOss();
  const client = createOssClient({ accessKeyId: 'id', accessKeySecret: 'secret', bucket: 'bucket', endpoint: 'oss.example.test' }, { fetchImpl: remote.fetch });
  let milliseconds = Date.parse('2026-09-15T00:00:00.000Z');
  const store = createSealLifecycleStore(client, { ...base, now: () => new Date(milliseconds) });
  return { remote, client, store, advance: (value) => { milliseconds += value; } };
}

async function uploaded(store, requestId) {
  await store.begin({ requestId, actorRole: 'build' });
  await store.markUploaded({ requestId, actorRole: 'build', artifact, provenance, buildRunner: 'build-1' });
}

function validation() {
  return { validation: { ok: true, receipt_digest: `sha256:${'e'.repeat(64)}` }, releaseRunner: 'release-1' };
}

async function complete(store, requestId) {
  await uploaded(store, requestId);
  await store.markValidated({ requestId, actorRole: 'release', ...validation() });
  await store.seal({ requestId, actorRole: 'release' });
}

function memoryOss() {
  const state = {
    objects: new Map(),
    async fetch(url, options = {}) {
      const requestUrl = new URL(url);
      const method = options.method ?? 'GET';
      const object = decodeURIComponent(requestUrl.pathname.replace(/^\//, ''));
      if (method === 'GET' && object === '' && requestUrl.searchParams.get('list-type') === '2') {
        const prefix = requestUrl.searchParams.get('prefix') ?? '';
        const keys = [...state.objects.keys()].filter((key) => key.startsWith(prefix)).sort();
        return new Response(`<ListBucketResult><IsTruncated>false</IsTruncated>${keys.map((key) => `<Contents><Key>${encodeURIComponent(key)}</Key></Contents>`).join('')}</ListBucketResult>`, { status: 200 });
      }
      const existing = state.objects.get(object);
      if (method === 'HEAD') return existing
        ? new Response(null, { status: 200, headers: { 'content-length': String(existing.body.byteLength), 'x-oss-meta-sha256': existing.sha256 } })
        : new Response(null, { status: 404 });
      if (method === 'GET') return existing
        ? new Response(existing.body, { status: 200, headers: { 'content-length': String(existing.body.byteLength), 'x-oss-meta-sha256': existing.sha256 } })
        : new Response('missing', { status: 404 });
      if (method === 'PUT') {
        if (existing && new Headers(options.headers).get('x-oss-forbid-overwrite') === 'true') return new Response('exists', { status: 409 });
        const body = Buffer.from(options.body);
        state.objects.set(object, { body, sha256: sha256(body) });
        return new Response(null, { status: 200 });
      }
      return new Response('unsupported', { status: 405 });
    },
  };
  return state;
}
