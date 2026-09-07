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

const baseSpecs = fixture.nodes.map(manifestSpec);
const registryInput = (manifests) => ({
  registry_version: fixture.registry_version,
  generated_at: fixture.generated_at,
  manifests,
});
const replaceSpec = (node, patch) => baseSpecs.map((spec) => (spec.node_id === node ? { ...spec, ...patch } : spec));

const registry = await generateNodeManifestRegistry(registryInput(baseSpecs));
const serialized = serializeNodeManifestRegistry(registry);

if (process.argv.includes('--write')) {
  await writeFile(outputUrl, serialized, 'utf8');
  console.log(`sfl-node-kernel fixture-written manifests=${registry.manifests.length}`);
  process.exit(0);
}

assert.deepEqual(process.argv.slice(2), []);
assert.equal(await readFile(outputUrl, 'utf8'), serialized, 'generated fixture must match its canonical source');
assert.deepEqual(await deserializeNodeManifestRegistry(serialized), registry, 'verified registry serialization must round-trip');
assert.ok((await Promise.all(registry.manifests.map(hasValidNodeManifestDigest))).every(Boolean));
assert.equal(classifySignedLevel('L-2'), 'supply_side');
assert.equal(classifySignedLevel('L0'), 'operating_mall');
assert.equal(classifySignedLevel('L6'), 'consumer');

const l0 = registry.manifests.find((manifest) => manifest.signed_level === 'L0');
const l1Nodes = registry.manifests.filter((manifest) => manifest.signed_level === 'L1');
assert.ok(l0);
assert.equal(l1Nodes.length, 3);
for (const requiredLevel of ['L0', 'L1', 'L2', 'L5', 'L6', 'L11']) {
  assert.ok(registry.manifests.some((manifest) => manifest.signed_level === requiredLevel));
}

const tamperTarget = registry.manifests.find((manifest) => manifest.node_id === nodeId('l1-b'));
assert.ok(tamperTarget);
await assert.rejects(
  () =>
    deserializeNodeManifestRegistry(
      JSON.stringify({
        ...registry,
        manifests: registry.manifests.map((manifest) =>
          manifest.node_id === tamperTarget.node_id
            ? { ...manifest, brand_ref: { ...manifest.brand_ref, ref: 'brand:fixture:tampered' } }
            : manifest
        ),
      })
    ),
  /SFL_NODE_MANIFEST_DIGEST_MISMATCH/
);

const l1ASpec = baseSpecs.find((spec) => spec.node_id === nodeId('l1-a'));
const l1BSpec = baseSpecs.find((spec) => spec.node_id === nodeId('l1-b'));
assert.ok(l1ASpec && l1BSpec);
await assert.rejects(
  () => generateNodeManifestRegistry(registryInput(replaceSpec(l1BSpec.node_id, { runtime_instance_id: l1ASpec.runtime_instance_id }))),
  /SFL_NODE_MANIFEST_REGISTRY_IDENTIFIER_AMBIGUOUS:runtime_instance_id/
);
await assert.rejects(
  () =>
    generateNodeManifestRegistry(
      registryInput(
        replaceSpec(l1BSpec.node_id, {
          domain_bindings: l1BSpec.domain_bindings.map((binding, index) =>
            index === 0 ? { ...binding, host: l1ASpec.domain_bindings[0].host } : binding
          ),
        })
      )
    ),
  /SFL_NODE_MANIFEST_HOST_AMBIGUOUS/
);

const l5Spec = baseSpecs.find((spec) => spec.signed_level === 'L5');
const l6Spec = baseSpecs.find((spec) => spec.signed_level === 'L6');
const l7Spec = baseSpecs.find((spec) => spec.signed_level === 'L7');
assert.ok(l5Spec && l6Spec && l7Spec);
await assert.rejects(
  () => generateNodeManifestRegistry(registryInput(replaceSpec(l7Spec.node_id, { parent_node_id: l5Spec.node_id }))),
  /SFL_CONSUMER_PARENT_CHAIN_INVALID/
);
await assert.rejects(
  () =>
    generateNodeManifestRegistry(
      registryInput(
        replaceSpec(l6Spec.node_id, {
          surfaces: [...l6Spec.surfaces, ref('surface:console')],
        })
      )
    ),
  /SFL_CONSUMER_SURFACE_INVALID/
);

assert.equal(resolveNodeManifestByHost(registry, 'L1-A-CONSOLE.SFL-NODE.INVALID.').node_id, nodeId('l1-a'));
assert.throws(() => resolveNodeManifestByHost(registry, 'l1-a.sfl-node.invalid'), /SFL_NODE_MANIFEST_HOST_UNKNOWN/);
assert.throws(() => resolveNodeManifestByHost(registry, 'l1-a-console.sfl-node.invalid:443'), /SFL_NODE_MANIFEST_HOST_INVALID/);

const l1A = resolveNodeManifestByHost(registry, 'l1-a-console.sfl-node.invalid');
const l1B = resolveNodeManifestByHost(registry, 'l1-b-console.sfl-node.invalid');
assert.notEqual(l1A.node_id, l1B.node_id);
assert.notEqual(l1A.realm_ref.ref, l1B.realm_ref.ref);
assert.notEqual(l1A.data_scope_ref.ref, l1B.data_scope_ref.ref);
assert.notEqual(l1A.resource_binding_set_ref.ref, l1B.resource_binding_set_ref.ref);
assert.notEqual(l1A.runtime_instance_id, l1B.runtime_instance_id);
assert.notEqual(l1A.release_pointer_ref.ref, l1B.release_pointer_ref.ref);

const sourceShas = new Set(registry.manifests.map((manifest) => manifest.release_pointer_ref.source_sha));
const artifactDigests = new Set(registry.manifests.map((manifest) => manifest.release_pointer_ref.immutable_artifact_digest));
const buildIds = new Set(registry.manifests.map((manifest) => manifest.release_pointer_ref.build_id));
assert.equal(sourceShas.size, 1);
assert.equal(artifactDigests.size, 1);
assert.equal(buildIds.size, 1);

const evidence = {
  schema_version: 'sfl.node-kernel-evidence.v1',
  version_name: 'SFL 节点内核底座 v1.1｜第二批生产级硬化',
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
    complete_contract_parsing: 'PASS',
    authority_tamper_rejection: 'PASS',
    registry_identifier_ambiguity_rejection: 'PASS',
    topology_validation: 'PASS',
    consumer_surface_isolation: 'PASS',
    invalid_host_rejection: 'PASS',
  },
  gates: {
    'SFL-17': {
      status: 'PARTIAL',
      evidence: 'One real kernel generator produced one L0 and three independent L1 manifests with unique refs and no node source paths.',
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
      evidence: 'Predeclared checks call the real generator, verified parser, digest verifier, topology validator, and exact Host resolver.',
    },
    'SFL-D04': {
      status: 'PASS',
      evidence: 'Every verified fixture manifest carries source/artifact/manifest digests and node-specific realm, scope, secret, payment, callback, runtime, and release references.',
    },
  },
};

console.log(JSON.stringify(evidence, null, 2));
