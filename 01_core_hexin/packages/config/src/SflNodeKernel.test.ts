import { describe, expect, it } from 'vitest';
import generatedFixture from '../../../../02_platform_pingtai/config/sfl-node-manifests.generated.json';
import {
  classifySignedLevel,
  deserializeNodeManifestRegistry,
  formatNodeManifestVersion,
  generateNodeManifest,
  hasValidNodeManifestDigest,
  resolveNodeManifestByHost,
  serializeNodeManifest,
  serializeNodeManifestRegistry,
  type NodeManifest,
  type NodeManifestRegistry,
  type NodeManifestSpec,
} from './SflNodeKernel';

const registry = generatedFixture as NodeManifestRegistry;

function specFrom(manifest: NodeManifest): NodeManifestSpec {
  const { schema_version: _schemaVersion, manifest_version: _manifestVersion, manifest_digest: _manifestDigest, ...spec } = manifest;
  return { ...spec, manifest_revision: 1 };
}

describe('SFL node kernel', () => {
  it('generates a legal manifest with deterministic version, ordering, and digest', async () => {
    const source = registry.manifests.find((manifest) => manifest.signed_level === 'L0');
    expect(source).toBeDefined();
    const spec = specFrom(source!);
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

  it('covers L0-L5 operating malls, L6-L11 consumers, and signed supply levels', async () => {
    const manifestsByNode = new Map(registry.manifests.map((manifest) => [manifest.node_id, manifest]));
    for (const manifest of registry.manifests) {
      const level = Number(manifest.signed_level.slice(1));
      if (level <= 5) {
        expect(classifySignedLevel(manifest.signed_level)).toBe('operating_mall');
        expect(manifest.node_profile).toBe('operating_mall');
        expect(manifest.mall_id).not.toBeNull();
      } else {
        expect(classifySignedLevel(manifest.signed_level)).toBe('consumer');
        expect(manifest.node_profile).toBe('consumer');
        expect(manifest.mall_id).toBeNull();
        const parent = manifestsByNode.get(manifest.parent_node_id!);
        expect(parent).toBeDefined();
        if (level === 6) {
          expect(classifySignedLevel(parent!.signed_level)).toBe('operating_mall');
          expect(manifest.host_node_id).toBe(parent!.node_id);
        } else {
          expect(Number(parent!.signed_level.slice(1))).toBe(level - 1);
          expect(manifest.host_node_id).toBe(parent!.host_node_id);
        }
      }
    }

    const source = registry.manifests[0]!;
    const supplySide = await generateNodeManifest({
      ...specFrom(source),
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
    });
    expect(classifySignedLevel(supplySide.signed_level)).toBe('supply_side');
    expect(supplySide.node_profile).toBeNull();
  });

  it('generates the required hierarchy from one shared source without naming undefined levels', () => {
    const l0 = registry.manifests.filter((manifest) => manifest.signed_level === 'L0');
    const l1 = registry.manifests.filter((manifest) => manifest.signed_level === 'L1');
    const levels = new Set(registry.manifests.map((manifest) => manifest.signed_level));
    const sourceShas = new Set(registry.manifests.map((manifest) => manifest.release_pointer_ref.source_sha));
    const artifactDigests = new Set(registry.manifests.map((manifest) => manifest.release_pointer_ref.immutable_artifact_digest));

    expect(l0).toHaveLength(1);
    expect(l1).toHaveLength(3);
    expect(l1.every((manifest) => manifest.parent_node_id === l0[0]!.node_id)).toBe(true);
    expect([...levels]).toEqual(expect.arrayContaining(['L0', 'L1', 'L2', 'L5', 'L6', 'L11']));
    expect(sourceShas.size).toBe(1);
    expect(artifactDigests.size).toBe(1);
    expect(registry.manifests.every((manifest) => manifest.release_pointer_ref.build_count === 1)).toBe(true);
    expect(serializeNodeManifestRegistry(registry)).not.toMatch(/business_name|level_name|source_path/);
  });

  it('resolves only an exactly registered Host and never falls back by node or brand', () => {
    const l1A = resolveNodeManifestByHost(registry, 'L1-A-CONSOLE.SFL-NODE.INVALID.');
    expect(l1A.node_id).toBe('node:fixture:line-alpha:l1-a');
    expect(() => resolveNodeManifestByHost(registry, 'l1-a.sfl-node.invalid')).toThrow('SFL_NODE_MANIFEST_HOST_UNKNOWN:l1-a.sfl-node.invalid');
    expect(() => resolveNodeManifestByHost(registry, 'unknown.sfl-node.invalid')).toThrow('SFL_NODE_MANIFEST_HOST_UNKNOWN:unknown.sfl-node.invalid');
  });

  it('keeps host, identity, scope, resources, and release pointers isolated by node', () => {
    const l1A = resolveNodeManifestByHost(registry, 'l1-a-console.sfl-node.invalid');
    const l1B = resolveNodeManifestByHost(registry, 'l1-b-console.sfl-node.invalid');

    expect(l1A.node_id).not.toBe(l1B.node_id);
    expect(l1A.realm_ref).not.toEqual(l1B.realm_ref);
    expect(l1A.data_scope_ref).not.toEqual(l1B.data_scope_ref);
    expect(l1A.resource_binding_set_ref).not.toEqual(l1B.resource_binding_set_ref);
    expect(l1A.release_pointer_ref.ref).not.toBe(l1B.release_pointer_ref.ref);
    expect(l1A.release_pointer_ref.source_sha).toBe(l1B.release_pointer_ref.source_sha);
    expect(l1A.release_pointer_ref.immutable_artifact_digest).toBe(l1B.release_pointer_ref.immutable_artifact_digest);
  });

  it('round-trips the registry and every manifest without changing bytes or digests', async () => {
    const serialized = serializeNodeManifestRegistry(registry);
    const roundTrip = deserializeNodeManifestRegistry(serialized);

    expect(serializeNodeManifestRegistry(roundTrip)).toBe(serialized);
    for (const manifest of roundTrip.manifests) {
      expect(JSON.parse(serializeNodeManifest(manifest))).toEqual(manifest);
      expect(await hasValidNodeManifestDigest(manifest)).toBe(true);
    }
  });
});
