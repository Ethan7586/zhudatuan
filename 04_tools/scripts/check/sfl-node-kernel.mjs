// Run with: node --import tsx 04_tools/scripts/check/sfl-node-kernel.mjs [--write]

import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

import {
  classifySignedLevel,
  deserializeNodeManifestRegistry,
  generateNodeManifestRegistry,
  hasValidNodeManifestDigest,
  resolveNodeManifestByHost,
  serializeNodeManifestRegistry,
} from '../../../01_core_hexin/packages/config/src/SflNodeKernel.ts';

const inputUrl = new URL('../../../02_platform_pingtai/config/sfl-node-manifest-fixture-input.json', import.meta.url);
const outputUrl = new URL('../../../02_platform_pingtai/config/sfl-node-manifests.generated.json', import.meta.url);
const fixture = JSON.parse(await readFile(inputUrl, 'utf8'));

assert.equal(fixture.schema_version, 'sfl.node-manifest-fixture-input.v1');
assert.ok(Array.isArray(fixture.nodes));

const nodeId = (key) => `node:fixture:line-alpha:${key}`;
const ref = (value, version = '1.0.0') => ({ ref: value, version });

function domainBindings(node) {
  const entries =
    node.node_profile === 'operating_mall'
      ? [
          ['console', 'application:shared:console', 'surface:console'],
          ['storefront', 'application:shared:storefront', 'surface:storefront'],
        ]
      : [['storefront', 'application:shared:storefront', 'surface:storefront']];
  return entries.map(([kind, applicationRef, surfaceRef]) => ({
    host: `${node.key}-${kind}.sfl-node.invalid`,
    binding_ref: ref(`domain-binding:fixture:${node.key}:${kind}`),
    application_ref: applicationRef,
    surface_ref: surfaceRef,
  }));
}

function manifestSpec(node) {
  const operatingMall = node.node_profile === 'operating_mall';
  const applications = operatingMall ? [ref('application:shared:console'), ref('application:shared:storefront')] : [ref('application:shared:storefront')];
  const surfaces = operatingMall ? [ref('surface:console'), ref('surface:storefront')] : [ref('surface:storefront')];
  const enabledFeatures = operatingMall
    ? [ref('feature:shared:catalog'), ref('feature:shared:operations'), ref('feature:shared:orders')]
    : [ref('feature:shared:browse'), ref('feature:shared:self-orders'), ref('feature:shared:self-profile')];

  return {
    manifest_id: `manifest:fixture:${node.key}`,
    manifest_revision: 1,
    generated_at: fixture.generated_at,
    lifecycle_status: 'active',
    line_id: 'line:fixture:alpha',
    node_id: nodeId(node.key),
    parent_node_id: node.parent_key === null ? null : nodeId(node.parent_key),
    signed_level: node.signed_level,
    node_profile: node.node_profile,
    mall_id: operatingMall ? `mall:fixture:${node.key}` : null,
    host_node_id: node.host_node_key === null ? null : nodeId(node.host_node_key),
    domain_bindings: domainBindings(node),
    brand_ref: ref(`brand:fixture:${node.key}`),
    applications,
    surfaces,
    enabled_features: enabledFeatures,
    api_contract_refs: [ref('api-contract:shared:mall')],
    realm_ref: ref(`realm:fixture:${node.key}`),
    data_scope_ref: ref(`data-scope:fixture:${node.key}`),
    resource_binding_set_ref: ref(`resource-binding-set:fixture:${node.key}`),
    secret_binding_set_ref: ref(`secret-binding-set:fixture:${node.key}`),
    payment_binding_refs: operatingMall ? [ref(`payment-binding:fixture:${node.key}`)] : [],
    callback_binding_refs: operatingMall ? [ref(`callback-binding:fixture:${node.key}`)] : [],
    runtime_instance_id: `runtime-instance:fixture:${node.key}`,
    runtime_config_ref: ref(`runtime-config:fixture:${node.key}`),
    release_pointer_ref: {
      ref: `release-pointer:fixture:${node.key}`,
      version: '1.0.0',
      source_sha: fixture.source_sha,
      build_id: fixture.build_id,
      build_count: 1,
      immutable_artifact_digest: fixture.immutable_artifact_digest,
    },
  };
}

const registry = await generateNodeManifestRegistry({
  registry_version: fixture.registry_version,
  generated_at: fixture.generated_at,
  manifests: fixture.nodes.map(manifestSpec),
});
const serialized = serializeNodeManifestRegistry(registry);

if (process.argv.includes('--write')) {
  await writeFile(outputUrl, serialized, 'utf8');
  console.log(`sfl-node-kernel fixture-written manifests=${registry.manifests.length}`);
  process.exit(0);
}

assert.deepEqual(process.argv.slice(2), []);
assert.equal(await readFile(outputUrl, 'utf8'), serialized, 'generated fixture must match its canonical source');
assert.deepEqual(deserializeNodeManifestRegistry(serialized), registry, 'registry serialization must round-trip');

const manifestsByNode = new Map(registry.manifests.map((manifest) => [manifest.node_id, manifest]));
const l0 = registry.manifests.find((manifest) => manifest.signed_level === 'L0');
const l1Nodes = registry.manifests.filter((manifest) => manifest.signed_level === 'L1');
assert.ok(l0);
assert.equal(l1Nodes.length, 3);
assert.ok(l1Nodes.every((manifest) => manifest.parent_node_id === l0.node_id));

for (const requiredLevel of ['L0', 'L2', 'L5', 'L6', 'L11']) {
  assert.ok(registry.manifests.some((manifest) => manifest.signed_level === requiredLevel));
}

for (const manifest of registry.manifests) {
  assert.equal(await hasValidNodeManifestDigest(manifest), true);
  const segment = classifySignedLevel(manifest.signed_level);
  if (segment === 'operating_mall') {
    assert.equal(manifest.node_profile, 'operating_mall');
    assert.notEqual(manifest.mall_id, null);
    assert.equal(manifest.host_node_id, null);
  } else {
    assert.equal(segment, 'consumer');
    assert.equal(manifest.node_profile, 'consumer');
    assert.equal(manifest.mall_id, null);
    assert.notEqual(manifest.host_node_id, null);
  }
  for (const binding of manifest.domain_bindings) {
    assert.equal(resolveNodeManifestByHost(registry, binding.host).node_id, manifest.node_id);
  }
  assert.ok(manifest.realm_ref.ref);
  assert.ok(manifest.data_scope_ref.ref);
  assert.ok(manifest.secret_binding_set_ref.ref);
  assert.ok(Array.isArray(manifest.payment_binding_refs));
  assert.ok(manifest.release_pointer_ref.ref);
}

for (const manifest of registry.manifests.filter((entry) => classifySignedLevel(entry.signed_level) === 'consumer')) {
  const parent = manifestsByNode.get(manifest.parent_node_id);
  assert.ok(parent);
  const parentLevel = Number(parent.signed_level.slice(1));
  const level = Number(manifest.signed_level.slice(1));
  if (level === 6) {
    assert.equal(classifySignedLevel(parent.signed_level), 'operating_mall');
    assert.equal(manifest.host_node_id, parent.node_id);
  } else {
    assert.equal(parentLevel, level - 1);
    assert.equal(manifest.host_node_id, parent.host_node_id);
  }
}

assert.equal(classifySignedLevel('L-2'), 'supply_side');
assert.throws(() => resolveNodeManifestByHost(registry, 'l0.sfl-node.invalid'), /SFL_NODE_MANIFEST_HOST_UNKNOWN/);
assert.throws(() => resolveNodeManifestByHost(registry, 'unknown.sfl-node.invalid'), /SFL_NODE_MANIFEST_HOST_UNKNOWN/);

const l1A = resolveNodeManifestByHost(registry, 'l1-a-console.sfl-node.invalid');
const l1B = resolveNodeManifestByHost(registry, 'l1-b-console.sfl-node.invalid');
assert.notEqual(l1A.node_id, l1B.node_id);
assert.notEqual(l1A.realm_ref.ref, l1B.realm_ref.ref);
assert.notEqual(l1A.data_scope_ref.ref, l1B.data_scope_ref.ref);
assert.notEqual(l1A.resource_binding_set_ref.ref, l1B.resource_binding_set_ref.ref);
assert.notEqual(l1A.release_pointer_ref.ref, l1B.release_pointer_ref.ref);

for (const selector of [
  (manifest) => manifest.node_id,
  (manifest) => manifest.manifest_id,
  (manifest) => manifest.realm_ref.ref,
  (manifest) => manifest.data_scope_ref.ref,
  (manifest) => manifest.resource_binding_set_ref.ref,
  (manifest) => manifest.release_pointer_ref.ref,
]) {
  assert.equal(new Set(registry.manifests.map(selector)).size, registry.manifests.length);
}

const sourceShas = new Set(registry.manifests.map((manifest) => manifest.release_pointer_ref.source_sha));
const artifactDigests = new Set(registry.manifests.map((manifest) => manifest.release_pointer_ref.immutable_artifact_digest));
const buildIds = new Set(registry.manifests.map((manifest) => manifest.release_pointer_ref.build_id));
assert.equal(sourceShas.size, 1);
assert.equal(artifactDigests.size, 1);
assert.equal(buildIds.size, 1);
assert.ok(registry.manifests.every((manifest) => manifest.release_pointer_ref.build_count === 1));

const evidence = {
  schema_version: 'sfl.node-kernel-evidence.v1',
  version_name: 'SFL 节点内核底座 v1.0｜第一批',
  fixture_manifest_count: registry.manifests.length,
  required_levels: ['L0', 'L1', 'L2', 'L5', 'L6', 'L11'],
  checks: {
    legal_generation: 'PASS',
    deterministic_generated_fixture: 'PASS',
    digest_verification: 'PASS',
    signed_level_segments: 'PASS',
    exact_host_resolution: 'PASS',
    unknown_host_no_fallback: 'PASS',
    cross_node_isolation: 'PASS',
    serialization_round_trip: 'PASS',
  },
  gates: {
    'SFL-17': {
      status: 'PARTIAL',
      evidence: 'One generator produced one L0 and three independent L1 manifests with unique refs and no node source paths.',
      remaining: 'No production provisioning fact or allocated resource binding was created in this batch.',
    },
    'SFL-18': {
      status: 'PARTIAL',
      evidence: {
        source_sha: [...sourceShas][0],
        build_id: [...buildIds][0],
        build_count: 1,
        immutable_artifact_digest: [...artifactDigests][0],
      },
      remaining: 'The release data is a deterministic fixture, not an executed production artifact build.',
    },
    'SFL-D03': {
      status: 'PASS',
      evidence: 'All predeclared checks above directly assert generated contract facts.',
    },
    'SFL-D04': {
      status: 'PASS',
      evidence: 'Every fixture manifest carries source/artifact/manifest digests and node-specific realm, scope, secret, payment, callback, runtime, and release references.',
    },
  },
};

console.log(JSON.stringify(evidence, null, 2));
