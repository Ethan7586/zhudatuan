import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { promisify } from 'node:util';

import { createAutoNodeControlServer } from './autonode-control-server.mjs';
import { LArchStateFile } from './l-arch-state-file.mjs';

const execute = promisify(execFile);
const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test('lists and changes one switch through the localhost control API with revision safety', async () => {
  const root = await mkdtemp(join(tmpdir(), 'l-arch-cli-'));
  roots.push(root);
  const server = createAutoNodeControlServer(engine(), new LArchStateFile(join(root, 'state.json')));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    const changed = await cli(['SET', 'node:l0', 'member.read', 'disconnected', '--url', url]);
    assert.deepEqual(changed, {
      schema_version: 'l-arch-state.v1', revision: 1,
      node_id: 'node:l0', interface_id: 'member.read', state: 'disconnected',
    });
    const unchanged = await cli(['SET', 'node:l0', 'member.read', 'disconnected', '--url', url]);
    assert.equal(unchanged.revision, 1);
    const listed = await cli(['LIST', 'node:l0', 'member.read', '--url', url]);
    assert.equal(listed.connections.length, 1);
    const removed = await cli(['SET', 'node:l0', 'member.read', 'unmounted', '--url', url]);
    assert.equal(removed.revision, 2);
    assert.equal(removed.state, 'unmounted');
  } finally {
    await new Promise((resolve, reject) => server.close((cause) => cause ? reject(cause) : resolve()));
  }
});

test('refuses a non-loopback control URL', async () => {
  await assert.rejects(cli(['LIST', '--url', 'http://10.170.0.3:4370']), /L_ARCH_CONTROL_URL_NOT_LOOPBACK/);
});

async function cli(arguments_) {
  const result = await execute(process.execPath, ['04_tools/scripts/provisioning/l-arch-control.mjs', ...arguments_]);
  return JSON.parse(result.stdout);
}

function engine() {
  return {
    submit: async () => undefined,
    read: async () => undefined,
    retry: async () => undefined,
    list: async () => [],
  };
}
