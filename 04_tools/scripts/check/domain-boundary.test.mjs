import assert from 'node:assert/strict';
import test from 'node:test';

import { IDENTITY_NODE_MANIFEST } from '../../../01_core_hexin/packages/config/src/IdentityNodeManifest.ts';
import { SFL_NODE_REGISTRY } from '../../../01_core_hexin/packages/config/src/SflNodeRegistry.ts';
import { verifyRawRegistryNoCrossNodeFallback, verifySflNodeDomainBoundary } from './domain-boundary.mjs';

test('canonical SFL registry owns L0 and L1 without a default node', async () => {
  await verifySflNodeDomainBoundary();
  assert.equal('defaultNodeId' in IDENTITY_NODE_MANIFEST, false);
  assert.deepEqual(IDENTITY_NODE_MANIFEST.nodes.map((node) => node.nodeId), [
    'node:zhudatuan:l0',
    'node:hbbtzn:l1',
  ]);
});

test('duplicate host ownership is rejected', () => {
  const invalid = structuredClone(SFL_NODE_REGISTRY);
  invalid.manifests[1].domain_bindings[0].host = invalid.manifests[0].domain_bindings[0].host;
  assert.throws(() => verifyRawRegistryNoCrossNodeFallback(invalid), /SFL_PRODUCTION_HOST_OWNERSHIP_AMBIGUOUS/);
});

test('undeclared default node is rejected', () => {
  const invalid = { ...structuredClone(SFL_NODE_REGISTRY), defaultNodeId: 'node:zhudatuan:l0' };
  assert.throws(() => verifyRawRegistryNoCrossNodeFallback(invalid), /SFL_DEFAULT_NODE_FORBIDDEN/);
});

test('resource bindings cannot reference an unknown node', () => {
  const invalid = structuredClone(SFL_NODE_REGISTRY);
  invalid.node_bindings[1].node_id = 'node:unknown:l1';
  assert.throws(() => verifyRawRegistryNoCrossNodeFallback(invalid), /SFL_NODE_RESOURCE_BINDING_UNKNOWN/);
});
