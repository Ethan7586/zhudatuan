import { beforeAll, describe, expect, it } from 'vitest';
import consoleReleaseDeclaration from '../../../../02_platform_pingtai/config/console-node-manifests.json';
import {
  materializeSflConsoleArtifact,
  normalizeConsoleClientVersion,
  parseSflConsoleArtifact,
  resolveConsoleAppConfig,
  type SflConsoleArtifact,
} from './SflNodeKernelConsole';

const sourceSha = 'a'.repeat(40);
const artifactDigest = `sha256:${'b'.repeat(64)}` as const;
let artifact: SflConsoleArtifact;

beforeAll(async () => {
  artifact = await materializeSflConsoleArtifact(consoleReleaseDeclaration, {
    source_sha: sourceSha,
    build_id: 'console:test:single-build',
    source_tree: 'clean',
    client_version: '1.0.0-test',
    immutable_artifact_digest: artifactDigest,
  });
});

describe('SFL Console runtime adapter', () => {
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

  it('resolves L0 and L1 by exact Console Host with independent API, Identity, Scope, and NodeContext', () => {
    const l0 = resolveConsoleAppConfig(artifact, 'console.zhudatuan.com');
    const l1 = resolveConsoleAppConfig(artifact, 'console.hbbtzn.com');

    expect(l0).toMatchObject({
      apiBaseUrl: 'https://api.zhudatuan.com',
      identityEntryUrl: 'https://accounts.zhudatuan.com/?target=console',
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
      identityEntryUrl: 'https://accounts.hbbtzn.com/?target=console-hbbtzn',
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
    const ambiguous = structuredClone(consoleReleaseDeclaration);
    ambiguous.manifests[1]!.domain_bindings.find(({ surface_ref }) => surface_ref === 'surface:console')!.host =
      'console.zhudatuan.com';
    await expect(materializeSflConsoleArtifact(ambiguous, {
      source_sha: sourceSha,
      build_id: 'console:test:single-build',
      source_tree: 'clean',
      client_version: '1.0.0-test',
      immutable_artifact_digest: artifactDigest,
    })).rejects.toThrow('SFL_NODE_MANIFEST_HOST_AMBIGUOUS:console.zhudatuan.com');

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
