import assert from 'node:assert/strict';
import test from 'node:test';

import { automaticClosureManifest, automaticPreparationMatrix } from '../src/automatic-preparation.mjs';

test('automatic preparation builds each target once and seals only physical deployments', () => {
  const adapter = {
    targets: { console: {}, support: {} },
    nodes: {
      'l1': { deployments: { console: {}, support: { hostedBy: 'l0' } } },
      'l0': { deployments: { console: {}, support: {} } },
    },
  };

  assert.deepEqual(automaticPreparationMatrix(adapter, ['console', 'support', 'console']), [
    { target: 'console', prepare_node: 'l0', seal_nodes_json: '["l0","l1"]' },
    { target: 'support', prepare_node: 'l0', seal_nodes_json: '["l0"]' },
  ]);
});

test('automatic preparation rejects a target without a physical deployment', () => {
  const adapter = {
    targets: { support: {} },
    nodes: { l1: { deployments: { support: { hostedBy: 'l0' } } } },
  };
  assert.throws(
    () => automaticPreparationMatrix(adapter, ['support']),
    (error) => error.code === 'AUTO_PREPARE_PHYSICAL_NODE_MISSING'
  );
});

test('automatic closure preserves target order and separates deployment waves', () => {
  const adapter = {
    targets: {
      migration: { kind: 'migration' },
      api: { kind: 'service' },
      media: { kind: 'content' },
      console: { kind: 'frontend' },
    },
    nodes: {
      l0: { deployments: { migration: {}, api: {}, media: {}, console: {} } },
      l1: { deployments: { api: {}, console: {} } },
    },
  };
  const closure = automaticClosureManifest(adapter, {
    sourceSha: 'a'.repeat(40),
    beforeSha: 'b'.repeat(40),
    targets: ['migration', 'api', 'media', 'console'],
  });

  assert.deepEqual(closure.waves, {
    migrations: [{ target: 'migration', node: 'l0' }],
    runtimes: [
      { target: 'api', node: 'l0' },
      { target: 'api', node: 'l1' },
      { target: 'media', node: 'l0' },
    ],
    frontends: [
      { target: 'console', node: 'l0' },
      { target: 'console', node: 'l1' },
    ],
  });
});
