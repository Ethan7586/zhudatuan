import { describe, expect, it } from 'vitest';
import generatedFixture from '../../../../02_platform_pingtai/config/sfl-node-manifests.generated.json';
import {
  classifySignedLevel,
  computeNodeManifestDigest,
  deserializeNodeManifest,
  deserializeNodeManifestRegistry,
  formatNodeManifestVersion,
  generateNodeManifest,
  generateNodeManifestRegistry,
  hasValidNodeManifestDigest,
  nodeContextOf,
  parseHostedNodeProvisioningRequest,
  parseHostedNodeProvisioningResult,
  parseNodeContext,
  parseNodeManifest,
  parseNodeManifestRegistry,
  parseSflNodeTopology,
  resolveNodeRecord,
  resolveNodeManifestByHost,
  serializeNodeManifest,
  serializeNodeManifestRegistry,
  validateNodeManifestOwnership,
  type NodeLifecycleStatus,
  type NodeManifest,
  type NodeManifestRegistrySpec,
  type NodeManifestSpec,
} from './SflNodeKernel';

const registry = await parseNodeManifestRegistry(generatedFixture);
const relationEffectiveAt = '2026-09-01T00:00:00.000Z';
const relationChangedAt = '2026-09-10T00:00:00.000Z';
const topologyFixture = {
  schema_version: 'sfl.node-topology.v1',
  nodes: [
    node('l0', 'sovereign', 'operating_mall', 'mall:fixture:l0'),
    node('l5', 'hosted', 'operating_mall', 'mall:fixture:l5'),
    node('l6', 'hosted', 'operating_mall', 'mall:fixture:l6'),
    node('l7', 'hosted', 'consumer', null),
    node('l8', 'hosted', 'operating_mall', 'mall:fixture:l8'),
    node('l9', 'hosted', 'consumer', null),
    node('l10', 'hosted', 'consumer', null),
    node('l11', 'hosted', 'consumer', null),
  ],
  relations: [
    relation('l0', null, 'L0'),
    relation('l5', 'l0', 'L5'),
    { ...relation('l6', 'l5', 'L6'), superseded_at: relationChangedAt },
    { ...relation('l6', 'l0', 'L6'), original_parent_node_id: nodeId('l5'), relation_version: 2, effective_at: relationChangedAt },
    relation('l7', 'l6', 'L7'),
    relation('l8', 'l7', 'L8'),
    relation('l9', 'l8', 'L9'),
    relation('l10', 'l9', 'L10'),
    relation('l11', 'l10', 'L11'),
  ],
};

function nodeId(key: string): string {
  return `node:fixture:line-alpha:${key}`;
}

function node(key: string, sovereignty_tier: 'sovereign' | 'hosted', node_profile: 'operating_mall' | 'consumer', mall_id: string | null) {
  return {
    line_id: 'line:fixture:alpha',
    node_id: nodeId(key),
    sovereignty_tier,
    node_profile,
    realm_id: `realm:fixture:${key}`,
    mall_id,
    status: 'active',
    created_at: relationEffectiveAt,
  };
}

function relation(key: string, parentKey: string | null, signed_level: `L${number}`) {
  return {
    line_id: 'line:fixture:alpha',
    node_id: nodeId(key),
    parent_node_id: parentKey === null ? null : nodeId(parentKey),
    original_parent_node_id: parentKey === null ? null : nodeId(parentKey),
    signed_level,
    host_sovereign_node_id: nodeId('l0'),
    relation_version: 1,
    effective_at: relationEffectiveAt,
    superseded_at: null,
  };
}

function specFrom(manifest: NodeManifest): NodeManifestSpec {
  const {
    schema_version: _schemaVersion,
    manifest_version,
    manifest_digest: _manifestDigest,
    ...spec
  } = manifest;
  return { ...spec, manifest_revision: Number(manifest_version.split('.')[2]) };
}

function manifestByNode(nodeId: string): NodeManifest {
  const manifest = registry.manifests.find((entry) => entry.node_id === nodeId);
  if (manifest === undefined) throw new Error(`TEST_MANIFEST_UNKNOWN:${nodeId}`);
  return manifest;
}

function manifestByLevel(signedLevel: string): NodeManifest {
  const manifest = registry.manifests.find((entry) => entry.signed_level === signedLevel);
  if (manifest === undefined) throw new Error(`TEST_MANIFEST_LEVEL_UNKNOWN:${signedLevel}`);
  return manifest;
}

function registrySpec(manifests: readonly NodeManifestSpec[]): NodeManifestRegistrySpec {
  return {
    registry_version: registry.registry_version,
    generated_at: registry.generated_at,
    manifests,
  };
}

function replaceSpec(nodeId: string, patch: Partial<NodeManifestSpec>): readonly NodeManifestSpec[] {
  return registry.manifests.map(specFrom).map((spec) => (spec.node_id === nodeId ? { ...spec, ...patch } : spec));
}

async function expectRegistryPatchRejected(nodeId: string, patch: Partial<NodeManifestSpec>, error: string): Promise<void> {
  await expect(generateNodeManifestRegistry(registrySpec(replaceSpec(nodeId, patch)))).rejects.toThrow(error);
}

describe('SFL node kernel', () => {
  it('generates a legal manifest with deterministic version, ordering, and digest', async () => {
    const source = manifestByLevel('L0');
    const spec = specFrom(source);
    const reordered: NodeManifestSpec = {
      ...spec,
      generated_at: '2026-09-07T08:00:00+08:00',
      domain_bindings: [...spec.domain_bindings].reverse(),
      applications: [...spec.applications].reverse(),
      surfaces: [...spec.surfaces].reverse(),
      enabled_features: [...spec.enabled_features].reverse(),
      api_contract_refs: [...spec.api_contract_refs].reverse(),
    };

    const first = await generateNodeManifest(spec);
    const second = await generateNodeManifest(reordered);

    expect(formatNodeManifestVersion(1)).toBe('1.0.1');
    expect(second).toEqual(first);
    expect(await hasValidNodeManifestDigest(first)).toBe(true);
    expect(first.manifest_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('makes equivalent registry input order produce identical serialization and digests', async () => {
    const reorderedSpecs = registry.manifests
      .map(specFrom)
      .reverse()
      .map((spec) => ({
        ...spec,
        domain_bindings: [...spec.domain_bindings].reverse(),
        applications: [...spec.applications].reverse(),
        surfaces: [...spec.surfaces].reverse(),
        enabled_features: [...spec.enabled_features].reverse(),
        api_contract_refs: [...spec.api_contract_refs].reverse(),
        payment_binding_refs: [...spec.payment_binding_refs].reverse(),
        callback_binding_refs: [...spec.callback_binding_refs].reverse(),
      }));
    const regenerated = await generateNodeManifestRegistry(registrySpec(reorderedSpecs));

    expect(serializeNodeManifestRegistry(regenerated)).toBe(serializeNodeManifestRegistry(registry));
    expect(regenerated.manifests.map((manifest) => manifest.manifest_digest)).toEqual(
      registry.manifests.map((manifest) => manifest.manifest_digest)
    );
  });

  it.each<NodeLifecycleStatus>(['provisioning', 'active', 'suspended', 'retired'])(
    'parses the supported %s lifecycle state',
    async (lifecycleStatus) => {
      const manifest = await generateNodeManifest({ ...specFrom(manifestByLevel('L0')), lifecycle_status: lifecycleStatus });
      await expect(parseNodeManifest(manifest)).resolves.toEqual(manifest);
    }
  );

  it('fully parses exact manifest, registry, nested references, digest, Host, and node context shapes', async () => {
    const manifest = manifestByLevel('L0');
    const context = nodeContextOf(manifest);

    expect(parseNodeContext(context)).toEqual(context);
    await expect(parseNodeManifest(manifest)).resolves.toEqual(manifest);
    await expect(parseNodeManifestRegistry(registry)).resolves.toEqual(registry);
    await expect(deserializeNodeManifest(serializeNodeManifest(manifest))).resolves.toEqual(manifest);
    await expect(deserializeNodeManifestRegistry(serializeNodeManifestRegistry(registry))).resolves.toEqual(registry);
  });

  it('rejects malformed JSON, extra fields, invalid lifecycle, malformed digest, and incomplete references', async () => {
    const manifest = manifestByLevel('L0');

    await expect(deserializeNodeManifestRegistry('{')).rejects.toThrow('SFL_NODE_MANIFEST_REGISTRY_JSON_INVALID');
    await expect(parseNodeManifest({ ...manifest, unexpected: true })).rejects.toThrow('SFL_NODE_MANIFEST_INVALID');
    await expect(parseNodeManifest({ ...manifest, lifecycle_status: 'deleted' })).rejects.toThrow(
      'SFL_NODE_MANIFEST_LIFECYCLE_STATUS_INVALID'
    );
    await expect(parseNodeManifest({ ...manifest, manifest_digest: 'sha256:abc' })).rejects.toThrow(
      'SFL_NODE_MANIFEST_DIGEST_INVALID'
    );
    await expect(parseNodeManifest({ ...manifest, realm_ref: { ref: manifest.realm_ref.ref } })).rejects.toThrow(
      'SFL_NODE_MANIFEST_REFERENCE_INVALID'
    );
    expect(() => parseNodeContext({ ...nodeContextOf(manifest), mall_id: 42 })).toThrow(
      'SFL_NODE_MANIFEST_FIELD_INVALID:mall_id'
    );
  });

  const authorityTamperCases: ReadonlyArray<readonly [string, (manifest: NodeManifest) => unknown]> = [
    ['schema_version', (manifest) => ({ ...manifest, schema_version: 'sfl.node-manifest.v2' })],
    ['manifest_id', (manifest) => ({ ...manifest, manifest_id: `${manifest.manifest_id}:tampered` })],
    ['manifest_version', (manifest) => ({ ...manifest, manifest_version: '1.0.2' })],
    ['manifest_digest', (manifest) => ({ ...manifest, manifest_digest: `sha256:${'0'.repeat(64)}` })],
    ['generated_at', (manifest) => ({ ...manifest, generated_at: '2026-09-07T00:00:01.000Z' })],
    ['lifecycle_status', (manifest) => ({ ...manifest, lifecycle_status: 'suspended' })],
    ['line_id', (manifest) => ({ ...manifest, line_id: 'line:fixture:tampered' })],
    ['node_id', (manifest) => ({ ...manifest, node_id: `${manifest.node_id}:tampered` })],
    ['parent_node_id', (manifest) => ({ ...manifest, parent_node_id: manifestByNode(nodeId('l1-a')).node_id })],
    ['signed_level', (manifest) => ({ ...manifest, signed_level: 'L2' })],
    ['node_profile', (manifest) => ({ ...manifest, node_profile: 'consumer' })],
    ['mall_id', (manifest) => ({ ...manifest, mall_id: `${manifest.mall_id}:tampered` })],
    ['host_node_id', (manifest) => ({ ...manifest, host_node_id: manifestByLevel('L0').node_id })],
    [
      'domain_bindings',
      (manifest) => ({
        ...manifest,
        domain_bindings: manifest.domain_bindings.map((binding, index) =>
          index === 0 ? { ...binding, host: 'tampered.sfl-node.invalid' } : binding
        ),
      }),
    ],
    ['brand_ref', (manifest) => ({ ...manifest, brand_ref: { ...manifest.brand_ref, ref: 'brand:tampered' } })],
    [
      'applications',
      (manifest) => ({
        ...manifest,
        applications: [...manifest.applications, { ref: 'application:tampered', version: '1.0.0' }],
      }),
    ],
    [
      'surfaces',
      (manifest) => ({ ...manifest, surfaces: [...manifest.surfaces, { ref: 'surface:tampered', version: '1.0.0' }] }),
    ],
    [
      'enabled_features',
      (manifest) => ({
        ...manifest,
        enabled_features: [...manifest.enabled_features, { ref: 'feature:tampered', version: '1.0.0' }],
      }),
    ],
    [
      'api_contract_refs',
      (manifest) => ({
        ...manifest,
        api_contract_refs: [...manifest.api_contract_refs, { ref: 'api-contract:tampered', version: '1.0.0' }],
      }),
    ],
    ['realm_ref', (manifest) => ({ ...manifest, realm_ref: { ...manifest.realm_ref, ref: 'realm:tampered' } })],
    ['data_scope_ref', (manifest) => ({ ...manifest, data_scope_ref: { ...manifest.data_scope_ref, ref: 'scope:tampered' } })],
    [
      'resource_binding_set_ref',
      (manifest) => ({
        ...manifest,
        resource_binding_set_ref: { ...manifest.resource_binding_set_ref, ref: 'resource-binding-set:tampered' },
      }),
    ],
    [
      'secret_binding_set_ref',
      (manifest) => ({
        ...manifest,
        secret_binding_set_ref: { ...manifest.secret_binding_set_ref, ref: 'secret-binding-set:tampered' },
      }),
    ],
    [
      'payment_binding_refs',
      (manifest) => ({
        ...manifest,
        payment_binding_refs: [{ ...manifest.payment_binding_refs[0]!, ref: 'payment-binding:tampered' }],
      }),
    ],
    [
      'callback_binding_refs',
      (manifest) => ({
        ...manifest,
        callback_binding_refs: [{ ...manifest.callback_binding_refs[0]!, ref: 'callback-binding:tampered' }],
      }),
    ],
    ['runtime_instance_id', (manifest) => ({ ...manifest, runtime_instance_id: 'runtime-instance:tampered' })],
    [
      'runtime_config_ref',
      (manifest) => ({ ...manifest, runtime_config_ref: { ...manifest.runtime_config_ref, ref: 'runtime-config:tampered' } }),
    ],
    [
      'release_pointer_ref',
      (manifest) => ({
        ...manifest,
        release_pointer_ref: { ...manifest.release_pointer_ref, ref: 'release-pointer:tampered' },
      }),
    ],
  ];

  it.each(authorityTamperCases)('rejects %s authority-field tampering while loading', async (_field, tamper) => {
    const target = manifestByNode('node:fixture:line-alpha:l1-b');
    const tampered = tamper(target);
    const value = {
      ...registry,
      manifests: registry.manifests.map((manifest) => (manifest.node_id === target.node_id ? tampered : manifest)),
    };

    await expect(parseNodeManifestRegistry(value)).rejects.toThrow();
  });

  it('rejects unresolved application and surface references instead of guessing them', async () => {
    const l1 = manifestByLevel('L1');
    const binding = l1.domain_bindings[0]!;

    await expectRegistryPatchRejected(
      l1.node_id,
      { domain_bindings: [{ ...binding, application_ref: 'application:missing' }] },
      'SFL_NODE_MANIFEST_REFERENCE_UNKNOWN:application_ref'
    );
    await expectRegistryPatchRejected(
      l1.node_id,
      { domain_bindings: [{ ...binding, surface_ref: 'surface:missing' }] },
      'SFL_NODE_MANIFEST_REFERENCE_UNKNOWN:surface_ref'
    );
  });

  it('rejects duplicate node, manifest, runtime, realm, resource, and Host authority identifiers', async () => {
    const l1A = manifestByNode('node:fixture:line-alpha:l1-a');
    const l1B = manifestByNode('node:fixture:line-alpha:l1-b');
    const duplicateCases: ReadonlyArray<readonly [Partial<NodeManifestSpec>, string]> = [
      [{ node_id: l1A.node_id }, 'node_id'],
      [{ manifest_id: l1A.manifest_id }, 'manifest_id'],
      [{ runtime_instance_id: l1A.runtime_instance_id }, 'runtime_instance_id'],
      [{ realm_ref: l1A.realm_ref }, 'realm_ref'],
      [{ resource_binding_set_ref: l1A.resource_binding_set_ref }, 'resource_binding_set_ref'],
    ];

    for (const [patch, field] of duplicateCases) {
      await expectRegistryPatchRejected(l1B.node_id, patch, `SFL_NODE_MANIFEST_REGISTRY_IDENTIFIER_AMBIGUOUS:${field}`);
    }

    await expectRegistryPatchRejected(
      l1B.node_id,
      {
        domain_bindings: l1B.domain_bindings.map((binding, index) =>
          index === 0 ? { ...binding, host: l1A.domain_bindings[0]!.host } : binding
        ),
      },
      'SFL_NODE_MANIFEST_HOST_AMBIGUOUS'
    );
  });

  it('uses one node and relation model for L0, L5, L6, and L11 without deriving profile from level', () => {
    const topology = parseSflNodeTopology(topologyFixture);
    const samples = ['l0', 'l5', 'l6', 'l11'].map((key) => resolveNodeRecord(topology, nodeId(key), relationChangedAt));

    expect(samples.map((sample) => sample.signed_level)).toEqual(['L0', 'L5', 'L6', 'L11']);
    expect(samples.map((sample) => sample.node_profile)).toEqual(['operating_mall', 'operating_mall', 'operating_mall', 'consumer']);
    expect(classifySignedLevel('L5')).toBe('member_l0_l5');
    expect(classifySignedLevel('L6')).toBe('member_l6_l11');
    expect(samples.every((sample) => sample.host_sovereign_node_id === nodeId('l0'))).toBe(true);
  });

  it('supports the three legal sovereignty/profile combinations and rejects sovereign consumer', () => {
    const topology = parseSflNodeTopology(topologyFixture);
    expect(topology.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ sovereignty_tier: 'sovereign', node_profile: 'operating_mall' }),
      expect.objectContaining({ sovereignty_tier: 'hosted', node_profile: 'operating_mall' }),
      expect.objectContaining({ sovereignty_tier: 'hosted', node_profile: 'consumer' }),
    ]));
    const invalid = {
      ...topologyFixture,
      nodes: topologyFixture.nodes.map((entry) => entry.node_id === nodeId('l0') ? { ...entry, node_profile: 'consumer', mall_id: null } : entry),
    };
    expect(() => parseSflNodeTopology(invalid)).toThrow('SFL_SOVEREIGN_NODE_PROFILE_INVALID');
  });

  it('keeps hosted nodes data-only and reserves manifests for sovereign nodes', () => {
    const topology = parseSflNodeTopology(topologyFixture);
    const hosted = topology.nodes.find((entry) => entry.node_id === nodeId('l11'))!;
    expect(Object.keys(hosted)).not.toEqual(expect.arrayContaining([
      'domain_bindings', 'resource_binding_set_ref', 'runtime_instance_id', 'release_pointer_ref', 'manifest_id',
    ]));
    validateNodeManifestOwnership(topology, { ...registry, manifests: [manifestByLevel('L0')] });
    expect(() => validateNodeManifestOwnership(topology, {
      ...registry,
      manifests: [{ ...manifestByLevel('L0'), node_id: nodeId('l11') }],
    })).toThrow('SFL_NODE_MANIFEST_NON_SOVEREIGN');
  });

  it('parses hosted provisioning requests without deriving profile from signed level', () => {
    const base = {
      idempotency_key: 'hosted-request:fixture:1',
      node_id: 'node:fixture-hosted:l5',
      parent_node_id: nodeId('l0'),
      realm_id: 'realm:fixture-hosted-l5',
      node_profile: 'consumer',
      mall_id: null,
      signed_level: 'L5',
      effective_at: relationEffectiveAt,
      requested_by: 'principal:fixture:operator',
      trace_id: 'trace:fixture:hosted',
    } as const;

    expect(parseHostedNodeProvisioningRequest(base)).toMatchObject({ signed_level: 'L5', node_profile: 'consumer' });
    expect(parseHostedNodeProvisioningRequest({
      ...base,
      idempotency_key: 'hosted-request:fixture:2',
      node_id: 'node:fixture-hosted:l6',
      realm_id: 'realm:fixture-hosted-l6',
      node_profile: 'operating_mall',
      mall_id: 'mall:fixture:hosted-l6',
      signed_level: 'L6',
    })).toMatchObject({ signed_level: 'L6', node_profile: 'operating_mall' });
  });

  it('rejects hosted request shapes outside the shared node model', () => {
    const request = {
      idempotency_key: 'hosted-request:fixture:invalid',
      node_id: 'node:fixture-hosted:l1',
      parent_node_id: nodeId('l0'),
      realm_id: 'realm:fixture-hosted-invalid',
      node_profile: 'consumer',
      mall_id: null,
      signed_level: 'L1',
      effective_at: relationEffectiveAt,
      requested_by: 'principal:fixture:operator',
      trace_id: 'trace:fixture:hosted-invalid',
    } as const;

    expect(() => parseHostedNodeProvisioningRequest({ ...request, mall_id: 'mall:forbidden' }))
      .toThrow('SFL_HOSTED_NODE_PROFILE_MALL_INVALID');
    expect(() => parseHostedNodeProvisioningRequest({ ...request, signed_level: 'L0' }))
      .toThrow('SFL_HOSTED_NODE_LEVEL_INVALID');
    expect(() => parseHostedNodeProvisioningRequest({ ...request, parent_node_id: request.node_id }))
      .toThrow('SFL_HOSTED_NODE_PARENT_INVALID');
  });

  it('parses a data-only hosted provisioning result and its persisted replay fact', () => {
    const result = parseHostedNodeProvisioningResult({
      ...node('l5', 'hosted', 'consumer', null),
      ...relation('l5', 'l0', 'L5'),
      idempotency_key: 'hosted-request:fixture:result',
      request_hash: 'a'.repeat(64),
      requested_by: 'principal:fixture:operator',
      trace_id: 'trace:fixture:hosted-result',
      replayed: true,
    });

    expect(result).toMatchObject({ sovereignty_tier: 'hosted', node_profile: 'consumer', relation_version: 1, replayed: true });
    expect(Object.keys(result)).not.toEqual(expect.arrayContaining([
      'manifest_id', 'domain_bindings', 'gateway_port', 'runtime_instance_id', 'release_pointer_ref',
    ]));
  });

  it('preserves relation history and resolves exactly one parent edge per effective period', () => {
    const topology = parseSflNodeTopology(topologyFixture);
    const before = resolveNodeRecord(topology, nodeId('l6'), '2026-09-05T00:00:00.000Z');
    const after = resolveNodeRecord(topology, nodeId('l6'), relationChangedAt);

    expect(before).toMatchObject({ parent_node_id: nodeId('l5'), original_parent_node_id: nodeId('l5'), relation_version: 1 });
    expect(after).toMatchObject({ parent_node_id: nodeId('l0'), original_parent_node_id: nodeId('l5'), relation_version: 2 });
    const overlap = {
      ...topologyFixture,
      relations: topologyFixture.relations.map((entry) => entry.node_id === nodeId('l6') && entry.relation_version === 1
        ? { ...entry, superseded_at: null }
        : entry),
    };
    expect(() => parseSflNodeTopology(overlap)).toThrow('SFL_NODE_RELATION_PERIOD_OVERLAP');
  });

  it('caps the member line at L11 without creating an L12 model', () => {
    const invalid = {
      ...topologyFixture,
      relations: topologyFixture.relations.map((entry) => entry.node_id === nodeId('l11') ? { ...entry, signed_level: 'L12' } : entry),
    };
    expect(() => parseSflNodeTopology(invalid)).toThrow('SFL_SIGNED_LEVEL_INVALID');
  });

  it('preserves negative supply-side labels without profile, mall, host, ordering, or party-kind inference', async () => {
    const source = specFrom(manifestByLevel('L0'));
    const supply = await generateNodeManifest({
      ...source,
      manifest_id: 'manifest:fixture:supply-side',
      node_id: 'node:fixture:supply-side',
      parent_node_id: null,
      signed_level: 'L-2',
      node_profile: null,
      mall_id: null,
      host_node_id: null,
      domain_bindings: [
        {
          host: 'supply-side.sfl-node.invalid',
          binding_ref: { ref: 'domain-binding:fixture:supply-side', version: '1.0.0' },
          application_ref: 'application:shared:supplier',
          surface_ref: 'surface:supplier',
        },
      ],
      applications: [{ ref: 'application:shared:supplier', version: '1.0.0' }],
      surfaces: [{ ref: 'surface:supplier', version: '1.0.0' }],
      realm_ref: { ref: 'realm:fixture:supply-side', version: '1.0.0' },
      data_scope_ref: { ref: 'data-scope:fixture:supply-side', version: '1.0.0' },
      resource_binding_set_ref: { ref: 'resource-binding-set:fixture:supply-side', version: '1.0.0' },
      secret_binding_set_ref: { ref: 'secret-binding-set:fixture:supply-side', version: '1.0.0' },
      runtime_instance_id: 'runtime-instance:fixture:supply-side',
      runtime_config_ref: { ref: 'runtime-config:fixture:supply-side', version: '1.0.0' },
      release_pointer_ref: { ...source.release_pointer_ref, ref: 'release-pointer:fixture:supply-side' },
    });

    expect(classifySignedLevel(supply.signed_level)).toBe('supply_side');
    expect(nodeContextOf(supply)).toMatchObject({ signed_level: 'L-2', node_profile: null, mall_id: null, host_node_id: null });
    expect(serializeNodeManifest(supply)).not.toMatch(/party_kind|signed_level_order/);
  });

  it('uses exact canonical Host resolution with no unknown, ambiguous, port, brand, or node fallback', () => {
    const l1A = resolveNodeManifestByHost(registry, 'L1-A-CONSOLE.SFL-NODE.INVALID.');
    const l1B = manifestByNode('node:fixture:line-alpha:l1-b');
    const collidingL1B: NodeManifest = {
      ...l1B,
      domain_bindings: l1B.domain_bindings.map((binding, index) =>
        index === 0 ? { ...binding, host: 'l1-a-console.sfl-node.invalid' } : binding
      ),
    };
    const ambiguousRegistry = {
      ...registry,
      manifests: registry.manifests.map((manifest) => (manifest.node_id === l1B.node_id ? collidingL1B : manifest)),
    };

    expect(l1A.node_id).toBe('node:fixture:line-alpha:l1-a');
    expect(() => resolveNodeManifestByHost(registry, 'l1-a.sfl-node.invalid')).toThrow('SFL_NODE_MANIFEST_HOST_UNKNOWN');
    expect(() => resolveNodeManifestByHost(registry, 'l1-a-console.sfl-node.invalid:443')).toThrow(
      'SFL_NODE_MANIFEST_HOST_INVALID'
    );
    expect(() => resolveNodeManifestByHost(registry, 'https://l1-a-console.sfl-node.invalid')).toThrow(
      'SFL_NODE_MANIFEST_HOST_INVALID'
    );
    expect(() => resolveNodeManifestByHost(ambiguousRegistry, 'l1-a-console.sfl-node.invalid')).toThrow(
      'SFL_NODE_MANIFEST_HOST_AMBIGUOUS'
    );
  });

  it('keeps host, identity, scope, resources, runtime, and release pointers isolated by node', () => {
    const l1A = resolveNodeManifestByHost(registry, 'l1-a-console.sfl-node.invalid');
    const l1B = resolveNodeManifestByHost(registry, 'l1-b-console.sfl-node.invalid');

    expect(l1A.node_id).not.toBe(l1B.node_id);
    expect(l1A.realm_ref).not.toEqual(l1B.realm_ref);
    expect(l1A.data_scope_ref).not.toEqual(l1B.data_scope_ref);
    expect(l1A.resource_binding_set_ref).not.toEqual(l1B.resource_binding_set_ref);
    expect(l1A.runtime_instance_id).not.toBe(l1B.runtime_instance_id);
    expect(l1A.release_pointer_ref.ref).not.toBe(l1B.release_pointer_ref.ref);
    expect(l1A.release_pointer_ref.source_sha).toBe(l1B.release_pointer_ref.source_sha);
    expect(l1A.release_pointer_ref.immutable_artifact_digest).toBe(l1B.release_pointer_ref.immutable_artifact_digest);
  });

  it('round-trips canonical bytes and verifies every manifest digest', async () => {
    const serialized = serializeNodeManifestRegistry(registry);
    const roundTrip = await deserializeNodeManifestRegistry(serialized);

    expect(serializeNodeManifestRegistry(roundTrip)).toBe(serialized);
    for (const manifest of roundTrip.manifests) {
      expect(await deserializeNodeManifest(serializeNodeManifest(manifest))).toEqual(manifest);
      expect(await hasValidNodeManifestDigest(manifest)).toBe(true);
      expect(await computeNodeManifestDigest(manifest)).toBe(manifest.manifest_digest);
    }
  });
});
