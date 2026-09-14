import assert from 'node:assert/strict';
import test from 'node:test';

import { automaticPreparationMatrix } from '../src/automatic-preparation.mjs';

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
