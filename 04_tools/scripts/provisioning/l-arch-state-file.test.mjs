import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { LArchStateFile } from './l-arch-state-file.mjs';

const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test('persists one versioned board state and restores it through a new host instance', async () => {
  const root = await mkdtemp(join(tmpdir(), 'l-arch-control-'));
  roots.push(root);
  const path = join(root, 'state.json');
  const first = new LArchStateFile(path);
  assert.deepEqual(await first.read(), {
    schema_version: 'l-arch-state.v1', revision: 0, updated_at: null, connections: [],
  });

  const connected = await first.update({
    node_id: 'node:hbbtzn:l1', interface_id: 'member.profile.read', state: 'connected', expected_revision: 0,
  });
  assert.equal(connected.revision, 1);
  const unchangedConnected = await first.update({
    node_id: 'node:hbbtzn:l1', interface_id: 'member.profile.read', state: 'connected', expected_revision: 1,
  });
  assert.deepEqual(unchangedConnected, connected);
  const disconnected = await first.update({
    node_id: 'node:hbbtzn:l1', interface_id: 'member.profile.read', state: 'disconnected', expected_revision: 1,
  });
  assert.equal(disconnected.revision, 2);
  assert.deepEqual(disconnected.connections, [{
    nodeId: 'node:hbbtzn:l1', interfaceId: 'member.profile.read', state: 'disconnected',
  }]);

  const restarted = new LArchStateFile(path);
  assert.deepEqual(await restarted.read(), disconnected);
  await assert.rejects(restarted.update({
    node_id: 'node:hbbtzn:l1', interface_id: 'member.profile.read', state: 'connected', expected_revision: 1,
  }), /L_ARCH_REVISION_CONFLICT:2/);

  const unmounted = await restarted.update({
    node_id: 'node:hbbtzn:l1', interface_id: 'member.profile.read', state: 'unmounted', expected_revision: 2,
  });
  assert.equal(unmounted.revision, 3);
  assert.deepEqual(unmounted.connections, []);
  const unchangedUnmounted = await restarted.update({
    node_id: 'node:hbbtzn:l1', interface_id: 'member.profile.read', state: 'unmounted', expected_revision: 3,
  });
  assert.deepEqual(unchangedUnmounted, unmounted);
});
