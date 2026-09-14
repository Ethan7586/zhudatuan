import assert from 'node:assert/strict';
import test from 'node:test';

import { automaticClosureManifest, automaticClosureSelection, automaticPreparationMatrix } from '../src/automatic-preparation.mjs';

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

test('tree-identical production lineage merge selects only the named physical placement', () => {
  const adapter = {
    targets: { storefront: { kind: 'frontend' } },
    nodes: {
      'zhudatuan-l0': { key: 'zhudatuan-l0', realmId: 'realm:l0', deployments: { storefront: {} } },
      'hbbtzn-l1': { key: 'hbbtzn-l1', realmId: 'realm:l1', deployments: { storefront: {} } },
    },
  };
  const mainline = 'a'.repeat(40);
  const production = 'b'.repeat(40);
  const selection = automaticClosureSelection(adapter, {
    plannedTargets: [],
    changeCount: 0,
    beforeSha: mainline,
    commit: {
      parents: [mainline, production],
      message: 'merge(release): reconnect L1 storefront production lineage',
    },
  });

  assert.deepEqual(selection, {
    targets: ['storefront'],
    sealNodesByTarget: { storefront: ['hbbtzn-l1'] },
    reconciliation: {
      mode: 'production-lineage',
      target: 'storefront',
      node: 'hbbtzn-l1',
      previousProductionSourceSha: production,
      evidence: 'strict-merge-subject',
    },
  });
  assert.deepEqual(automaticPreparationMatrix(adapter, selection.targets, selection.sealNodesByTarget), [
    { target: 'storefront', prepare_node: 'hbbtzn-l1', seal_nodes_json: '["hbbtzn-l1"]' },
  ]);
});

test('ordinary tree-identical commits remain no-op and malformed lineage declarations fail closed', () => {
  const adapter = {
    targets: { storefront: { kind: 'frontend' } },
    nodes: { 'hbbtzn-l1': { realmId: 'realm:l1', deployments: { storefront: {} } } },
  };
  const mainline = 'a'.repeat(40);
  assert.deepEqual(automaticClosureSelection(adapter, {
    plannedTargets: [], changeCount: 0, beforeSha: mainline,
    commit: { parents: [mainline], message: 'docs: explain production lineage' },
  }), { targets: [], sealNodesByTarget: {}, reconciliation: null });
  assert.throws(() => automaticClosureSelection(adapter, {
    plannedTargets: [], changeCount: 0, beforeSha: mainline,
    commit: { parents: [mainline, 'b'.repeat(40)], message: 'merge(release): reconnect storefront production lineage' },
  }), (error) => error.code === 'AUTO_RECONCILIATION_SUBJECT_INVALID');
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
