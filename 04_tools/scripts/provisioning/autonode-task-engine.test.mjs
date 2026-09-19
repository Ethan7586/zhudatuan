import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { createAutoNodeControlServer } from './autonode-control-server.mjs';
import { LArchStateFile } from './l-arch-state-file.mjs';
import {
  AUTONODE_TASK_REQUEST_SCHEMA_VERSION,
  AutoNodeTaskEngine,
} from './autonode-task-engine.mjs';

const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test('persists a real activation task and replays the same idempotent result once', async () => {
  const root = await stateRoot();
  const calls = [];
  const engine = new AutoNodeTaskEngine(root, {
    plan: async (request) => {
      calls.push(['plan', request.activation_request_id]);
      return { plan: { plan_digest: 'sha256:plan-one' }, waiting_external: [] };
    },
    apply: async (request, digest) => {
      calls.push(['apply', request.activation_request_id, digest]);
      return {
        status: 'ACTIVE',
        waiting_external: [],
        result: {
          manifest_id: 'manifest:platform:one',
          access_entries: [
            { surface_ref: 'surface:storefront', url: 'https://h6.hbbtzn.com' },
            { surface_ref: 'surface:api', url: 'https://api.h6.hbbtzn.com' },
          ],
        },
      };
    },
  });
  const request = taskRequest({ activation_request: {
    schema_version: 'sfl.autonode-activation-request.v1',
    activation_request_id: 'activation:platform:one',
    provisioning_request: {
      business: { scope_id: 'mall:one', name: '平台一', public_slug: 'h6' },
      domains: { storefront: 'h6.hbbtzn.com' },
    },
  } });

  const queued = await engine.submit(request);
  assert.equal(queued.status, 'QUEUED');
  await engine.waitForIdle();
  const completed = await engine.read(request.task_id);
  assert.equal(completed.status, 'SUCCEEDED');
  assert.equal(completed.phase, 'ACTIVE');
  assert.equal(completed.progress, 100);
  assert.equal(completed.plan_digest, 'sha256:plan-one');
  assert.deepEqual(completed.platform, {
    mall_id: 'mall:one', application_id: null, name: '平台一', public_slug: 'h6',
  });
  assert.deepEqual(completed.result, {
    manifest_id: 'manifest:platform:one',
    access_entries: [
      { surface_ref: 'surface:storefront', url: 'https://h6.hbbtzn.com' },
      { surface_ref: 'surface:api', url: 'https://api.h6.hbbtzn.com' },
    ],
  });
  assert.deepEqual(calls, [
    ['plan', 'activation:platform:one'],
    ['apply', 'activation:platform:one', 'sha256:plan-one'],
  ]);

  const replay = await engine.submit(request);
  await engine.waitForIdle();
  assert.equal(replay.status, 'SUCCEEDED');
  assert.equal(calls.length, 2);
  await assert.rejects(
    engine.submit({ ...request, node_id: 'node:platform:changed' }),
    /AUTONODE_TASK_IDEMPOTENCY_CONFLICT/,
  );

  const taskFile = join(root, 'tasks', `${sha256(request.task_id)}.json`);
  const persisted = JSON.parse(await readFile(taskFile, 'utf8'));
  assert.equal(persisted.receipt.status, 'SUCCEEDED');
  assert.equal(persisted.receipt.result.manifest_id, 'manifest:platform:one');
  assert.equal(persisted.receipt.events.at(-1).phase, 'ACTIVE');
  delete persisted.receipt.platform;
  delete persisted.receipt.result;
  await writeFile(taskFile, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
  const legacy = await engine.read(request.task_id);
  assert.equal(legacy.platform.mall_id, 'mall:one');
  assert.deepEqual(legacy.result, {
    manifest_id: null,
    access_entries: [{ surface_ref: 'surface:storefront', url: 'https://h6.hbbtzn.com' }],
  });
});

test('holds an external-resource task and resumes it without creating a duplicate', async () => {
  const root = await stateRoot();
  let plans = 0;
  let applies = 0;
  const engine = new AutoNodeTaskEngine(root, {
    plan: async () => {
      plans += 1;
      return {
        plan: { plan_digest: 'sha256:plan-waiting' },
        waiting_external: plans === 1 ? ['dns:h7.hbbtzn.com'] : [],
      };
    },
    apply: async () => {
      applies += 1;
      return { status: 'ACTIVE', waiting_external: [] };
    },
  });
  const request = taskRequest({
    task_id: 'task:platform:waiting',
    idempotency_key: 'idempotency:waiting',
    activation_request: {
      schema_version: 'sfl.autonode-activation-request.v1',
      activation_request_id: 'activation:platform:waiting',
      provisioning_request: {
        business: { scope_id: 'mall:waiting' },
        domains: { storefront: 'h7.hbbtzn.com' },
      },
    },
  });

  await engine.submit(request);
  await engine.waitForIdle();
  const waiting = await engine.read(request.task_id);
  assert.equal(waiting.status, 'WAITING_EXTERNAL');
  assert.deepEqual(waiting.waiting_external, ['dns:h7.hbbtzn.com']);
  assert.equal(applies, 0);

  await engine.retry(request.task_id);
  await engine.waitForIdle();
  const completed = await engine.read(request.task_id);
  assert.equal(completed.status, 'SUCCEEDED');
  assert.deepEqual(completed.result, {
    manifest_id: null,
    access_entries: [{ surface_ref: 'surface:storefront', url: 'https://h7.hbbtzn.com' }],
  });
  assert.equal(plans, 2);
  assert.equal(applies, 1);
});

test('records a retryable failure and succeeds after an explicit retry', async () => {
  const root = await stateRoot();
  let attempts = 0;
  const engine = new AutoNodeTaskEngine(root, {
    plan: async () => ({ plan: { plan_digest: 'sha256:plan-retry' }, waiting_external: [] }),
    apply: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('DNS_PROVIDER_TEMPORARY_FAILURE');
      return { status: 'ACTIVE', waiting_external: [] };
    },
  });
  const request = taskRequest({ task_id: 'task:platform:retry', idempotency_key: 'idempotency:retry' });

  await engine.submit(request);
  await engine.waitForIdle();
  const failed = await engine.read(request.task_id);
  assert.equal(failed.status, 'FAILED_RETRYABLE');
  assert.equal(failed.last_error.message, 'DNS_PROVIDER_TEMPORARY_FAILURE');

  await engine.retry(request.task_id);
  await engine.waitForIdle();
  assert.equal((await engine.read(request.task_id)).status, 'SUCCEEDED');
  assert.equal(attempts, 2);
});

test('recovers an interrupted persisted task after the controller restarts', async () => {
  const root = await stateRoot();
  const request = taskRequest({ task_id: 'task:platform:recover', idempotency_key: 'idempotency:recover' });
  const first = new AutoNodeTaskEngine(root, {
    plan: async () => ({ plan: { plan_digest: 'sha256:recover' }, waiting_external: [] }),
    apply: async () => ({ status: 'ACTIVE', waiting_external: [] }),
  });
  await first.submit(request);
  await first.waitForIdle();

  const taskFile = join(root, 'tasks', `${sha256(request.task_id)}.json`);
  const interrupted = JSON.parse(await readFile(taskFile, 'utf8'));
  interrupted.receipt.status = 'RUNNING';
  interrupted.receipt.phase = 'ACTIVATING';
  interrupted.receipt.finished_at = null;
  await writeFile(taskFile, `${JSON.stringify(interrupted, null, 2)}\n`, 'utf8');

  const recovered = new AutoNodeTaskEngine(root, {
    plan: async () => ({ plan: { plan_digest: 'sha256:recover' }, waiting_external: [] }),
    apply: async () => ({ status: 'ACTIVE', waiting_external: [] }),
  });
  assert.equal(await recovered.recover(), 1);
  await recovered.waitForIdle();
  const completed = await recovered.read(request.task_id);
  assert.equal(completed.status, 'SUCCEEDED');
  assert.ok(completed.events.some((item) => item.message.includes('控制器重启')));
});

test('exposes submit, status and list through the localhost control API', async () => {
  const root = await stateRoot();
  const engine = new AutoNodeTaskEngine(root, {
    plan: async () => ({ plan: { plan_digest: 'sha256:http' }, waiting_external: [] }),
    apply: async () => ({ status: 'ACTIVE', waiting_external: [] }),
  });
  const archState = new LArchStateFile(join(root, 'arch', 'state.json'));
  const server = createAutoNodeControlServer(engine, archState);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const ready = await fetch(`${base}/health/ready`);
    assert.equal(ready.status, 200);
    assert.equal((await ready.json()).status, 'READY');

    const created = await fetch(`${base}/v1/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(taskRequest({ task_id: 'task:http', idempotency_key: 'idempotency:http' })),
    });
    assert.equal(created.status, 202);
    await engine.waitForIdle();

    const status = await fetch(`${base}/v1/tasks/${encodeURIComponent('task:http')}`);
    assert.equal(status.status, 200);
    assert.equal((await status.json()).status, 'SUCCEEDED');
    const list = await fetch(`${base}/v1/tasks`);
    assert.equal((await list.json()).items.length, 1);

    const emptyArch = await fetch(`${base}/v1/arch`);
    assert.equal(emptyArch.status, 200);
    assert.deepEqual(await emptyArch.json(), {
      schema_version: 'l-arch-state.v1', revision: 0, updated_at: null, connections: [],
    });
    const changedArch = await fetch(`${base}/v1/arch`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        node_id: 'node:hbbtzn:l1', interface_id: 'member.profile.read', state: 'disconnected', expected_revision: 0,
      }),
    });
    assert.equal(changedArch.status, 200);
    assert.deepEqual((await changedArch.json()).connections, [{
      nodeId: 'node:hbbtzn:l1', interfaceId: 'member.profile.read', state: 'disconnected',
    }]);
    const filteredArch = await fetch(`${base}/v1/arch?node_id=${encodeURIComponent('node:hbbtzn:l1')}`);
    assert.equal((await filteredArch.json()).connections.length, 1);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

function taskRequest(overrides = {}) {
  return {
    schema_version: AUTONODE_TASK_REQUEST_SCHEMA_VERSION,
    task_id: 'task:platform:one',
    idempotency_key: 'idempotency:platform:one',
    action: 'ACTIVATE',
    node_id: 'node:platform:one',
    requested_by: {
      actor_id: 'principal:ethan',
      membership_id: 'membership:platform:owner',
    },
    activation_request: {
      schema_version: 'sfl.autonode-activation-request.v1',
      activation_request_id: 'activation:platform:one',
    },
    ...overrides,
  };
}

async function stateRoot() {
  const root = await mkdtemp(join(tmpdir(), 'autonode-task-engine-'));
  roots.push(root);
  return root;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
