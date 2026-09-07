import {
  generateNodeManifestRegistry,
  nodeContextOf,
  parseNodeManifestRegistry,
  resolveNodeDomainBindingByHost,
  resolveNodeManifestByHost,
  type DomainBindingRef,
  type ManifestDigest,
  type NodeContext,
  type NodeManifest,
  type NodeManifestRegistry,
  type NodeManifestSpec,
  type ResourceBindingSetRef,
} from '@shop/config/sfl-node-kernel';

export const SFL_CONSOLE_ARTIFACT_SCHEMA_VERSION = 'sfl.console-artifact.v1' as const;
export const SFL_CONSOLE_RELEASE_DECLARATION_SCHEMA_VERSION = 'sfl.console-release-declaration.v1' as const;

export type ConsoleScopeKind = 'platform' | 'mall';
export type ConsoleSourceTree = 'clean' | 'dirty';

export interface ConsoleRuntimeBinding {
  readonly resource_binding_set_ref: ResourceBindingSetRef;
  readonly api_base_url: string;
  readonly identity_entry_url: string;
  readonly scope_kind: ConsoleScopeKind;
}

export interface SflConsoleArtifact {
  readonly schema_version: typeof SFL_CONSOLE_ARTIFACT_SCHEMA_VERSION;
  readonly source_sha: string;
  readonly build_id: string;
  readonly build_count: 1;
  readonly source_tree: ConsoleSourceTree;
  readonly client_version: string;
  readonly immutable_artifact_digest: ManifestDigest;
  readonly node_manifest_registry: NodeManifestRegistry;
  readonly runtime_bindings: readonly ConsoleRuntimeBinding[];
}

export interface SflConsoleReleaseDescriptor {
  readonly source_sha: string;
  readonly build_id: string;
  readonly source_tree: ConsoleSourceTree;
  readonly client_version: string;
  readonly immutable_artifact_digest: ManifestDigest;
}

export interface ConsoleAppConfig {
  readonly apiBaseUrl: string;
  readonly identityOrigin: string;
  readonly identityEntryUrl: string;
  readonly consoleOrigin: string;
  readonly clientVersion: string;
  readonly scope: Readonly<{ kind: ConsoleScopeKind; id: string }>;
  readonly nodeManifest: NodeManifest;
  readonly nodeContext: NodeContext;
  readonly domainBinding: DomainBindingRef;
  readonly sourceSha: string;
  readonly buildId: string;
  readonly buildCount: 1;
  readonly immutableArtifactDigest: ManifestDigest;
}

const ARTIFACT_KEYS = [
  'schema_version',
  'source_sha',
  'build_id',
  'build_count',
  'source_tree',
  'client_version',
  'immutable_artifact_digest',
  'node_manifest_registry',
  'runtime_bindings',
] as const;
const RELEASE_DESCRIPTOR_KEYS = [
  'source_sha',
  'build_id',
  'source_tree',
  'client_version',
  'immutable_artifact_digest',
] as const;
const RELEASE_DECLARATION_KEYS = [
  'schema_version',
  'registry_version',
  'generated_at',
  'manifests',
  'runtime_bindings',
] as const;
const RELEASE_POINTER_DECLARATION_KEYS = ['ref', 'version'] as const;
const RUNTIME_BINDING_KEYS = [
  'resource_binding_set_ref',
  'api_base_url',
  'identity_entry_url',
  'scope_kind',
] as const;
const VERSIONED_REF_KEYS = ['ref', 'version'] as const;
const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const CONSOLE_SURFACE_REF = 'surface:console';

export async function materializeSflConsoleArtifact(
  declarationValue: unknown,
  releaseValue: unknown,
): Promise<SflConsoleArtifact> {
  const declaration = exactRecord(
    declarationValue,
    RELEASE_DECLARATION_KEYS,
    'SFL_CONSOLE_RELEASE_DECLARATION_INVALID',
  );
  if (declaration.schema_version !== SFL_CONSOLE_RELEASE_DECLARATION_SCHEMA_VERSION) {
    throw new Error('SFL_CONSOLE_RELEASE_DECLARATION_SCHEMA_INVALID');
  }
  const release = parseReleaseDescriptor(releaseValue);
  const manifests = requiredArray(declaration.manifests, 'SFL_CONSOLE_RELEASE_MANIFESTS_INVALID').map((value) => {
    const manifest = record(value, 'SFL_CONSOLE_RELEASE_MANIFEST_INVALID');
    const pointer = exactRecord(
      manifest.release_pointer_ref,
      RELEASE_POINTER_DECLARATION_KEYS,
      'SFL_CONSOLE_RELEASE_POINTER_INVALID',
    );
    return {
      ...manifest,
      release_pointer_ref: {
        ref: requiredText(pointer.ref, 'SFL_CONSOLE_RELEASE_POINTER_REF_INVALID'),
        version: requiredText(pointer.version, 'SFL_CONSOLE_RELEASE_POINTER_VERSION_INVALID'),
        source_sha: release.source_sha,
        build_id: release.build_id,
        build_count: 1,
        immutable_artifact_digest: release.immutable_artifact_digest,
      },
    } as unknown as NodeManifestSpec;
  });
  const nodeManifestRegistry = await generateNodeManifestRegistry({
    registry_version: requiredText(declaration.registry_version, 'SFL_CONSOLE_REGISTRY_VERSION_INVALID'),
    generated_at: requiredText(declaration.generated_at, 'SFL_CONSOLE_REGISTRY_GENERATED_AT_INVALID'),
    manifests,
  });
  return parseSflConsoleArtifact({
    schema_version: SFL_CONSOLE_ARTIFACT_SCHEMA_VERSION,
    source_sha: release.source_sha,
    build_id: release.build_id,
    build_count: 1,
    source_tree: release.source_tree,
    client_version: release.client_version,
    immutable_artifact_digest: release.immutable_artifact_digest,
    node_manifest_registry: nodeManifestRegistry,
    runtime_bindings: declaration.runtime_bindings,
  });
}

export async function parseSflConsoleArtifact(value: unknown): Promise<SflConsoleArtifact> {
  const source = exactRecord(value, ARTIFACT_KEYS, 'SFL_CONSOLE_ARTIFACT_INVALID');
  if (source.schema_version !== SFL_CONSOLE_ARTIFACT_SCHEMA_VERSION) {
    throw new Error('SFL_CONSOLE_ARTIFACT_SCHEMA_INVALID');
  }
  const sourceSha = sourceShaValue(source.source_sha);
  const buildId = requiredText(source.build_id, 'SFL_CONSOLE_ARTIFACT_BUILD_ID_INVALID');
  if (source.build_count !== 1) throw new Error('SFL_CONSOLE_ARTIFACT_BUILD_COUNT_INVALID');
  const sourceTree = source.source_tree;
  if (sourceTree !== 'clean' && sourceTree !== 'dirty') throw new Error('SFL_CONSOLE_ARTIFACT_SOURCE_TREE_INVALID');
  const clientVersion = normalizeConsoleClientVersion(source.client_version);
  const immutableArtifactDigest = digestValue(
    source.immutable_artifact_digest,
    'SFL_CONSOLE_ARTIFACT_DIGEST_INVALID',
  );
  const nodeManifestRegistry = await parseNodeManifestRegistry(source.node_manifest_registry);
  const runtimeBindings = parseRuntimeBindings(source.runtime_bindings);
  validateArtifactReferences(
    nodeManifestRegistry,
    runtimeBindings,
    sourceSha,
    buildId,
    immutableArtifactDigest,
  );
  return Object.freeze({
    schema_version: SFL_CONSOLE_ARTIFACT_SCHEMA_VERSION,
    source_sha: sourceSha,
    build_id: buildId,
    build_count: 1,
    source_tree: sourceTree,
    client_version: clientVersion,
    immutable_artifact_digest: immutableArtifactDigest,
    node_manifest_registry: nodeManifestRegistry,
    runtime_bindings: runtimeBindings,
  });
}

export function resolveConsoleAppConfig(artifact: SflConsoleArtifact, hostname: string): ConsoleAppConfig {
  const manifest = resolveNodeManifestByHost(artifact.node_manifest_registry, hostname);
  const domainBinding = resolveNodeDomainBindingByHost(manifest, hostname);
  if (domainBinding.surface_ref !== CONSOLE_SURFACE_REF) {
    throw new Error(`SFL_CONSOLE_HOST_SURFACE_INVALID:${domainBinding.host}`);
  }
  const bindings = artifact.runtime_bindings.filter((binding) =>
    sameReference(binding.resource_binding_set_ref, manifest.resource_binding_set_ref));
  if (bindings.length === 0) {
    throw new Error(`SFL_CONSOLE_RUNTIME_BINDING_MISSING:${manifest.resource_binding_set_ref.ref}`);
  }
  if (bindings.length > 1) {
    throw new Error(`SFL_CONSOLE_RUNTIME_BINDING_AMBIGUOUS:${manifest.resource_binding_set_ref.ref}`);
  }
  const runtime = bindings[0]!;
  const identityEntryUrl = runtime.identity_entry_url;
  return Object.freeze({
    apiBaseUrl: runtime.api_base_url,
    identityOrigin: new URL(identityEntryUrl).origin,
    identityEntryUrl,
    consoleOrigin: `https://${domainBinding.host}`,
    clientVersion: artifact.client_version,
    scope: Object.freeze({ kind: runtime.scope_kind, id: manifest.data_scope_ref.ref }),
    nodeManifest: manifest,
    nodeContext: nodeContextOf(manifest),
    domainBinding,
    sourceSha: artifact.source_sha,
    buildId: artifact.build_id,
    buildCount: artifact.build_count,
    immutableArtifactDigest: artifact.immutable_artifact_digest,
  });
}

export function normalizeConsoleClientVersion(value: unknown, fallback = '0.0.0'): string {
  const candidate = typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?$/i.test(candidate)) {
    throw new Error('SFL_CONSOLE_CLIENT_VERSION_INVALID');
  }
  return candidate;
}

function parseReleaseDescriptor(value: unknown): SflConsoleReleaseDescriptor {
  const source = exactRecord(value, RELEASE_DESCRIPTOR_KEYS, 'SFL_CONSOLE_RELEASE_DESCRIPTOR_INVALID');
  const sourceTree = source.source_tree;
  if (sourceTree !== 'clean' && sourceTree !== 'dirty') throw new Error('SFL_CONSOLE_ARTIFACT_SOURCE_TREE_INVALID');
  return Object.freeze({
    source_sha: sourceShaValue(source.source_sha),
    build_id: requiredText(source.build_id, 'SFL_CONSOLE_ARTIFACT_BUILD_ID_INVALID'),
    source_tree: sourceTree,
    client_version: normalizeConsoleClientVersion(source.client_version),
    immutable_artifact_digest: digestValue(
      source.immutable_artifact_digest,
      'SFL_CONSOLE_ARTIFACT_DIGEST_INVALID',
    ),
  });
}

function parseRuntimeBindings(value: unknown): readonly ConsoleRuntimeBinding[] {
  const bindings = requiredArray(value, 'SFL_CONSOLE_RUNTIME_BINDINGS_INVALID').map((entry) => {
    const source = exactRecord(entry, RUNTIME_BINDING_KEYS, 'SFL_CONSOLE_RUNTIME_BINDING_INVALID');
    const reference = exactRecord(
      source.resource_binding_set_ref,
      VERSIONED_REF_KEYS,
      'SFL_CONSOLE_RUNTIME_BINDING_REF_INVALID',
    );
    const scopeKind = source.scope_kind;
    if (scopeKind !== 'platform' && scopeKind !== 'mall') {
      throw new Error('SFL_CONSOLE_RUNTIME_SCOPE_KIND_INVALID');
    }
    return Object.freeze({
      resource_binding_set_ref: Object.freeze({
        ref: requiredText(reference.ref, 'SFL_CONSOLE_RUNTIME_BINDING_REF_INVALID'),
        version: requiredText(reference.version, 'SFL_CONSOLE_RUNTIME_BINDING_VERSION_INVALID'),
      }),
      api_base_url: httpsOrigin(source.api_base_url, 'SFL_CONSOLE_RUNTIME_API_ORIGIN_INVALID'),
      identity_entry_url: httpsEntryUrl(source.identity_entry_url),
      scope_kind: scopeKind,
    });
  });
  const keys = bindings.map(({ resource_binding_set_ref: reference }) => `${reference.ref}\0${reference.version}`);
  if (new Set(keys).size !== keys.length) throw new Error('SFL_CONSOLE_RUNTIME_BINDING_AMBIGUOUS');
  return Object.freeze(bindings);
}

function validateArtifactReferences(
  registry: NodeManifestRegistry,
  runtimeBindings: readonly ConsoleRuntimeBinding[],
  sourceSha: string,
  buildId: string,
  immutableArtifactDigest: ManifestDigest,
): void {
  if (registry.manifests.length === 0) throw new Error('SFL_CONSOLE_NODE_MANIFESTS_MISSING');
  for (const manifest of registry.manifests) {
    const consoleBindings = manifest.domain_bindings.filter((binding) => binding.surface_ref === CONSOLE_SURFACE_REF);
    if (consoleBindings.length !== 1) throw new Error(`SFL_CONSOLE_DOMAIN_BINDING_INVALID:${manifest.node_id}`);
    const pointer = manifest.release_pointer_ref;
    if (pointer.source_sha !== sourceSha) throw new Error(`SFL_CONSOLE_SOURCE_SHA_MISMATCH:${manifest.node_id}`);
    if (pointer.build_id !== buildId || pointer.build_count !== 1) {
      throw new Error(`SFL_CONSOLE_BUILD_REFERENCE_MISMATCH:${manifest.node_id}`);
    }
    if (pointer.immutable_artifact_digest !== immutableArtifactDigest) {
      throw new Error(`SFL_CONSOLE_ARTIFACT_DIGEST_MISMATCH:${manifest.node_id}`);
    }
    const bindings = runtimeBindings.filter((binding) =>
      sameReference(binding.resource_binding_set_ref, manifest.resource_binding_set_ref));
    if (bindings.length !== 1) throw new Error(`SFL_CONSOLE_RUNTIME_BINDING_INVALID:${manifest.node_id}`);
    const expectedScope = manifest.signed_level === 'L0' ? 'platform' : 'mall';
    if (bindings[0]!.scope_kind !== expectedScope) {
      throw new Error(`SFL_CONSOLE_RUNTIME_SCOPE_MISMATCH:${manifest.node_id}`);
    }
  }
  if (runtimeBindings.length !== registry.manifests.length) {
    throw new Error('SFL_CONSOLE_RUNTIME_BINDING_ORPHANED');
  }
}

function sameReference(left: ResourceBindingSetRef, right: ResourceBindingSetRef): boolean {
  return left.ref === right.ref && left.version === right.version;
}

function sourceShaValue(value: unknown): string {
  const sourceSha = requiredText(value, 'SFL_CONSOLE_ARTIFACT_SOURCE_SHA_INVALID');
  if (!SOURCE_SHA_PATTERN.test(sourceSha)) throw new Error('SFL_CONSOLE_ARTIFACT_SOURCE_SHA_INVALID');
  return sourceSha;
}

function digestValue(value: unknown, code: string): ManifestDigest {
  const digest = requiredText(value, code);
  if (!DIGEST_PATTERN.test(digest)) throw new Error(code);
  return digest as ManifestDigest;
}

function httpsOrigin(value: unknown, code: string): string {
  const candidate = requiredText(value, code);
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(code);
  }
  if (url.protocol !== 'https:' || url.origin !== candidate) throw new Error(code);
  return candidate;
}

function httpsEntryUrl(value: unknown): string {
  const candidate = requiredText(value, 'SFL_CONSOLE_RUNTIME_IDENTITY_ENTRY_INVALID');
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('SFL_CONSOLE_RUNTIME_IDENTITY_ENTRY_INVALID');
  }
  if (url.protocol !== 'https:' || url.hash !== '' || url.username !== '' || url.password !== '') {
    throw new Error('SFL_CONSOLE_RUNTIME_IDENTITY_ENTRY_INVALID');
  }
  return url.href;
}

function exactRecord(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  const source = record(value, code);
  const expected = new Set(keys);
  const actual = Object.keys(source);
  if (actual.length !== expected.size || actual.some((key) => !expected.has(key))) throw new Error(code);
  return source;
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredArray(value: unknown, code: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

function requiredText(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value.trim();
}
