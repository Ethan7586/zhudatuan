import { beforeAll, describe, expect, it } from 'vitest';
import {
  SFL_CONSOLE_RELEASE_DECLARATION,
  SFL_NODE_MANIFEST_REGISTRY_DECLARATION,
} from './SflNodeRegistry';
import {
  materializeSflConsoleArtifact,
  normalizeConsoleClientVersion,
  parseSflConsoleArtifact,
  parseSflConsoleNodeRuntime,
  resolveConsoleAppConfig,
  resolveConsoleNodeRuntimeConfig,
  type SflConsoleArtifact,
} from './SflNodeKernelConsole';
import {
  createNodeContextResolver,
  materializeNodeManifestRegistryDeclaration,
  materializeNodeManifestRegistryRelease,
} from './SflNodeKernel';

const sourceSha = 'a'.repeat(40);
const artifactDigest = `sha256:${'b'.repeat(64)}` as const;
let artifact: SflConsoleArtifact;

beforeAll(async () => {
  artifact = await materializeSflConsoleArtifact(SFL_CONSOLE_RELEASE_DECLARATION, {
    source_sha: sourceSha,
    build_id: 'console:test:single-build',
    source_tree: 'clean',
    client_version: '1.0.0-test',
    immutable_artifact_digest: artifactDigest,
  });
});

describe('SFL Console runtime adapter', () => {
  it('resolves Console and API Hosts to one authoritative context per node', () => {
    const resolver = createNodeContextResolver(artifact.node_manifest_registry);
    const l0Console = resolver.resolve('console.fufu.wang');
    const l0Api = resolver.resolve('api.fufu.wang');
    const l1Console = resolver.resolve('console.hbbtzn.com');
    const l1Api = resolver.resolve('api.hbbtzn.com');

    expect(l0Console).toMatchObject({
      line_id: 'line:zhudatuan:commerce:v1',
      node_id: 'node:zhudatuan:l0',
      signed_level: 'L0',
      mall_id: 'mall-zhudatuan',
      host: 'console.fufu.wang',
      surface: 'surface:console',
      scope: { ref: 'organization-platform-root', version: '1' },
    });
    expect(l1Console).toMatchObject({
      line_id: 'line:zhudatuan:commerce:v1',
      node_id: 'node:hbbtzn:l1',
      parent_node_id: 'node:zhudatuan:l0',
      signed_level: 'L1',
      mall_id: 'mall:d1708f04df2dd8a61736852c4900fb43',
      host: 'console.hbbtzn.com',
      surface: 'surface:console',
      scope: { ref: 'mall:d1708f04df2dd8a61736852c4900fb43', version: '1' },
    });
    expect(l0Api.manifest).toBe(l0Console.manifest);
    expect(l0Api.manifest_digest).toBe(l0Console.manifest_digest);
    expect(l0Api.surface).toBe('surface:api');
    expect(l1Api.manifest).toBe(l1Console.manifest);
    expect(l1Api.manifest_digest).toBe(l1Console.manifest_digest);
    expect(l1Api.surface).toBe('surface:api');
    expect(l1Api.manifest_digest).not.toBe(l0Api.manifest_digest);
    expect(() => resolver.resolve('api.hbbtzn.com.evil')).toThrow('SFL_NODE_MANIFEST_HOST_UNKNOWN');
    expect(() => resolver.resolve('api.hbbtzn.com:443')).toThrow('SFL_NODE_MANIFEST_HOST_INVALID');
  });

  it('materializes a deterministic verified server registry from the shared declaration', async () => {
    const first = await materializeNodeManifestRegistryDeclaration(SFL_NODE_MANIFEST_REGISTRY_DECLARATION);
    const second = await materializeNodeManifestRegistryDeclaration(SFL_NODE_MANIFEST_REGISTRY_DECLARATION);

    expect(first).toEqual(second);
    expect(first.manifests).toHaveLength(2);
    expect(first.manifests[0]!.release_pointer_ref).toMatchObject({ build_count: 1 });
    expect(first.manifests[0]!.release_pointer_ref.source_sha).toMatch(/^[0-9a-f]{64}$/);
  });

  it('materializes release manifests from actual source and artifact evidence', async () => {
    const released = await materializeNodeManifestRegistryRelease(SFL_NODE_MANIFEST_REGISTRY_DECLARATION, {
      source_sha: sourceSha,
      build_id: 'sfl:test:single-build',
      immutable_artifact_digest: artifactDigest,
      generated_at: '2026-09-08T01:30:00.000Z',
    });

    expect(released.generated_at).toBe('2026-09-08T01:30:00.000Z');
    for (const manifest of released.manifests) {
      expect(manifest.generated_at).toBe('2026-09-08T01:30:00.000Z');
      expect(manifest.release_pointer_ref).toEqual({
        ...manifest.release_pointer_ref,
        source_sha: sourceSha,
        build_id: 'sfl:test:single-build',
        build_count: 1,
        immutable_artifact_digest: artifactDigest,
      });
    }
  });

  it('materializes two complete generic NodeManifests from one source and artifact', () => {
    expect(artifact.node_manifest_registry.manifests).toHaveLength(2);
    for (const manifest of artifact.node_manifest_registry.manifests) {
      expect(manifest).toMatchObject({
        schema_version: 'sfl.node-manifest.v1',
        line_id: 'line:zhudatuan:commerce:v1',
        node_profile: 'operating_mall',
        release_pointer_ref: {
          source_sha: sourceSha,
          build_id: 'console:test:single-build',
          build_count: 1,
          immutable_artifact_digest: artifactDigest,
        },
      });
      expect(manifest.manifest_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(manifest.realm_ref.ref).toMatch(/^realm:l[01]$/);
      expect(manifest.resource_binding_set_ref.ref).toMatch(/^resource-binding:/);
      expect(manifest.secret_binding_set_ref.ref).toMatch(/\/secrets$/);
      expect(manifest.payment_binding_refs).toHaveLength(1);
      expect(manifest.callback_binding_refs).toHaveLength(1);
    }
  });

  it('loads one newly provisioned node from runtime data without rebuilding the shared registry', async () => {
    const manifest = artifact.node_manifest_registry.manifests.find((entry) => entry.signed_level === 'L1')!;
    const binding = artifact.runtime_bindings.find((entry) =>
      entry.resource_binding_set_ref.ref === manifest.resource_binding_set_ref.ref)!;
    const consoleHost = manifest.domain_bindings.find((entry) => entry.surface_ref === 'surface:console')!.host;
    const runtime = await parseSflConsoleNodeRuntime({
      schema_version: 'sfl.console-node-runtime.v1',
      source_sha: artifact.source_sha,
      build_id: artifact.build_id,
      build_count: 1,
      source_tree: artifact.source_tree,
      client_version: artifact.client_version,
      immutable_artifact_digest: artifact.immutable_artifact_digest,
      node_manifest: manifest,
      runtime_binding: binding,
    });

    expect(resolveConsoleNodeRuntimeConfig(runtime, consoleHost)).toMatchObject({
      apiBaseUrl: binding.api_base_url,
      nodeContext: { node_id: manifest.node_id },
      sourceSha,
      buildCount: 1,
      immutableArtifactDigest: artifactDigest,
    });
    await expect(parseSflConsoleNodeRuntime({ ...runtime, build_count: 2 }))
      .rejects.toThrow('SFL_CONSOLE_ARTIFACT_BUILD_COUNT_INVALID');
  });

  it('resolves L0 and L1 by exact Console Host with independent API, Identity, Scope, and NodeContext', () => {
    const l0 = resolveConsoleAppConfig(artifact, 'console.fufu.wang');
    const l1 = resolveConsoleAppConfig(artifact, 'console.hbbtzn.com');

    expect(l0).toMatchObject({
      apiBaseUrl: 'https://api.fufu.wang',
      identityEntryUrl: 'https://accounts.fufu.wang/?target=console',
      scope: { kind: 'platform', id: 'organization-platform-root' },
      nodeContext: {
        line_id: 'line:zhudatuan:commerce:v1',
        node_id: 'node:zhudatuan:l0',
        parent_node_id: null,
        signed_level: 'L0',
      },
    });
    expect(l1).toMatchObject({
      apiBaseUrl: 'https://api.hbbtzn.com',
      identityEntryUrl: 'https://accounts.hbbtzn.com/?target=console',
      scope: { kind: 'mall', id: 'mall:d1708f04df2dd8a61736852c4900fb43' },
      nodeContext: {
        line_id: 'line:zhudatuan:commerce:v1',
        node_id: 'node:hbbtzn:l1',
        parent_node_id: 'node:zhudatuan:l0',
        signed_level: 'L1',
      },
    });
    expect(l0.sourceSha).toBe(l1.sourceSha);
    expect(l0.immutableArtifactDigest).toBe(l1.immutableArtifactDigest);
    expect(l0.nodeManifest.manifest_digest).not.toBe(l1.nodeManifest.manifest_digest);
  });

  it('fails unknown, suffix-derived, and non-Console Hosts without fallback', () => {
    expect(() => resolveConsoleAppConfig(artifact, 'console.unknown.example'))
      .toThrow('SFL_NODE_MANIFEST_HOST_UNKNOWN:console.unknown.example');
    expect(() => resolveConsoleAppConfig(artifact, 'console.hbbtzn.com.example'))
      .toThrow('SFL_NODE_MANIFEST_HOST_UNKNOWN:console.hbbtzn.com.example');
    expect(() => resolveConsoleAppConfig(artifact, 'api.hbbtzn.com'))
      .toThrow('SFL_CONSOLE_HOST_SURFACE_INVALID:api.hbbtzn.com');
  });

  it('rejects ambiguous Hosts and tampered generic manifest digests', async () => {
    const ambiguous = structuredClone(SFL_CONSOLE_RELEASE_DECLARATION);
    (ambiguous.manifests[1]!.domain_bindings.find(({ surface_ref }) => surface_ref === 'surface:console') as { host: string }).host =
      'console.fufu.wang';
    await expect(materializeSflConsoleArtifact(ambiguous, {
      source_sha: sourceSha,
      build_id: 'console:test:single-build',
      source_tree: 'clean',
      client_version: '1.0.0-test',
      immutable_artifact_digest: artifactDigest,
    })).rejects.toThrow('SFL_NODE_MANIFEST_HOST_AMBIGUOUS:console.fufu.wang');

    const tampered = {
      ...artifact,
      node_manifest_registry: {
        ...artifact.node_manifest_registry,
        manifests: artifact.node_manifest_registry.manifests.map((manifest, index) => index === 0
          ? { ...manifest, manifest_digest: `sha256:${'c'.repeat(64)}` as const }
          : manifest),
      },
    };
    await expect(parseSflConsoleArtifact(tampered)).rejects.toThrow('SFL_NODE_MANIFEST_DIGEST_MISMATCH');
  });

  it('uses the stable client-version default when release environments omit it', () => {
    expect(normalizeConsoleClientVersion(undefined)).toBe('0.0.0');
    expect(() => normalizeConsoleClientVersion(undefined, '')).toThrow('SFL_CONSOLE_CLIENT_VERSION_INVALID');
  });
});
