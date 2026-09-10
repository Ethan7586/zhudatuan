import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseOriginalCommand, validateAgentArguments } from '../remote/candidate-gateway.mjs';

const engineSource = await readFile(new URL('../src/engine.mjs', import.meta.url), 'utf8');

const identity = [
  '--project', 'zdt-next',
  '--node', 'hbbtzn-l1',
  '--target', 'storefront',
  '--source-sha', 'a'.repeat(40),
  '--sha256', 'b'.repeat(64),
  '--tree-digest', `sha256:${'c'.repeat(64)}`,
  '--manifest-digest', `sha256:${'d'.repeat(64)}`,
];

test('candidate gateway accepts only candidate and read-only agent actions', () => {
  for (const action of ['lookup', 'reuse']) assert.doesNotThrow(() => validateAgentArguments([action, ...identity]));
  for (const action of ['activate', 'rollback', 'preflight', 'seed']) {
    assert.throws(() => validateAgentArguments([action, ...identity]), { code: 'PRODUCTION_ACTION_DENIED' });
  }
});

test('candidate gateway confines untrusted files to the upload directory', () => {
  assert.deepEqual(
    parseOriginalCommand('scp -t /opt/ai-delivery/uploads/zdt-next--hbbtzn-l1--storefront--abc.tar.gz'),
    { kind: 'scp', path: '/opt/ai-delivery/uploads/zdt-next--hbbtzn-l1--storefront--abc.tar.gz' },
  );
  assert.doesNotThrow(() => validateAgentArguments([
    'stage', '--project', 'zdt-next', '--node', 'hbbtzn-l1', '--target', 'storefront',
    '--archive', '/opt/ai-delivery/uploads/artifact.tar.gz',
    '--manifest', '/opt/ai-delivery/uploads/artifact.json',
    '--sha256', 'b'.repeat(64), '--tree-digest', `sha256:${'c'.repeat(64)}`,
  ]));
  assert.throws(() => validateAgentArguments([
    'stage', '--project', 'zdt-next', '--node', 'hbbtzn-l1', '--target', 'storefront',
    '--archive', '/opt/ai-delivery/incoming/artifact.tar.gz',
    '--manifest', '/opt/ai-delivery/incoming/artifact.json',
    '--sha256', 'b'.repeat(64), '--tree-digest', `sha256:${'c'.repeat(64)}`,
  ]), { code: 'UPLOAD_PATH_REQUIRED' });
  assert.throws(() => parseOriginalCommand('scp -t /etc/sudoers'), { code: 'COMMAND_ENTRYPOINT_DENIED' });
});

test('candidate uploads use the forced-command compatible SCP protocol', () => {
  assert.match(engineSource, /return \['scp', '-O', \.\.\.endpoint\.identityArgs/);
});

test('candidate gateway rejects shell syntax and approval arguments', () => {
  assert.throws(() => parseOriginalCommand('/usr/local/sbin/ai-delivery-candidate status --project zdt-next; id'), { code: 'COMMAND_CHARACTERS_DENIED' });
  assert.throws(() => validateAgentArguments(['status', '--project', 'zdt-next', '--node', 'hbbtzn-l1', '--target', 'storefront', '--approval', 'zdt-next:sha']), { code: 'ARGUMENT_DENIED' });
});
