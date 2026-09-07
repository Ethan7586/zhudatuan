export const SFL_NODE_MANIFEST_SCHEMA_VERSION = 'sfl.node-manifest.v1' as const;
export const SFL_NODE_MANIFEST_REGISTRY_SCHEMA_VERSION = 'sfl.node-manifest-registry.v1' as const;

export type ManifestDigest = `sha256:${string}`;
export type SignedLevel = `L${number}`;
export type SignedLevelSegment = 'supply_side' | 'operating_mall' | 'consumer';
export type NodeProfile = 'operating_mall' | 'consumer';
export type NodeLifecycleStatus = 'provisioning' | 'active' | 'suspended' | 'retired';

export interface VersionedRef {
  readonly ref: string;
  readonly version: string;
}

export interface ResourceBindingSetRef {
  readonly ref: string;
  readonly version: string;
}

export interface ReleasePointerRef {
  readonly ref: string;
  readonly version: string;
  readonly source_sha: string;
  readonly build_id: string;
  readonly build_count: number;
  readonly immutable_artifact_digest: ManifestDigest;
}

export interface NodeContext {
  readonly line_id: string;
  readonly node_id: string;
  readonly parent_node_id: string | null;
  readonly signed_level: SignedLevel;
  readonly node_profile: NodeProfile | null;
  readonly mall_id: string | null;
  readonly host_node_id: string | null;
}

export interface DomainBindingRef {
  readonly host: string;
  readonly binding_ref: VersionedRef;
  readonly application_ref: string;
  readonly surface_ref: string;
}

export interface NodeManifest extends NodeContext {
  readonly schema_version: typeof SFL_NODE_MANIFEST_SCHEMA_VERSION;
  readonly manifest_id: string;
  readonly manifest_version: string;
  readonly manifest_digest: ManifestDigest;
  readonly generated_at: string;
  readonly lifecycle_status: NodeLifecycleStatus;
  readonly domain_bindings: readonly DomainBindingRef[];
  readonly brand_ref: VersionedRef;
  readonly applications: readonly VersionedRef[];
  readonly surfaces: readonly VersionedRef[];
  readonly enabled_features: readonly VersionedRef[];
  readonly api_contract_refs: readonly VersionedRef[];
  readonly realm_ref: VersionedRef;
  readonly data_scope_ref: VersionedRef;
  readonly resource_binding_set_ref: ResourceBindingSetRef;
  readonly secret_binding_set_ref: ResourceBindingSetRef;
  readonly payment_binding_refs: readonly VersionedRef[];
  readonly callback_binding_refs: readonly VersionedRef[];
  readonly runtime_instance_id: string;
  readonly runtime_config_ref: VersionedRef;
  readonly release_pointer_ref: ReleasePointerRef;
}

export interface NodeManifestSpec extends NodeContext {
  readonly manifest_id: string;
  readonly manifest_revision: number;
  readonly generated_at: string;
  readonly lifecycle_status: NodeLifecycleStatus;
  readonly domain_bindings: readonly DomainBindingRef[];
  readonly brand_ref: VersionedRef;
  readonly applications: readonly VersionedRef[];
  readonly surfaces: readonly VersionedRef[];
  readonly enabled_features: readonly VersionedRef[];
  readonly api_contract_refs: readonly VersionedRef[];
  readonly realm_ref: VersionedRef;
  readonly data_scope_ref: VersionedRef;
  readonly resource_binding_set_ref: ResourceBindingSetRef;
  readonly secret_binding_set_ref: ResourceBindingSetRef;
  readonly payment_binding_refs: readonly VersionedRef[];
  readonly callback_binding_refs: readonly VersionedRef[];
  readonly runtime_instance_id: string;
  readonly runtime_config_ref: VersionedRef;
  readonly release_pointer_ref: ReleasePointerRef;
}

export interface NodeManifestRegistry {
  readonly schema_version: typeof SFL_NODE_MANIFEST_REGISTRY_SCHEMA_VERSION;
  readonly registry_version: string;
  readonly generated_at: string;
  readonly manifests: readonly NodeManifest[];
}

export interface NodeManifestRegistrySpec {
  readonly registry_version: string;
  readonly generated_at: string;
  readonly manifests: readonly NodeManifestSpec[];
}

type UnsignedNodeManifest = Omit<NodeManifest, 'manifest_digest'>;

export function classifySignedLevel(signedLevel: SignedLevel | string): SignedLevelSegment {
  const level = signedLevelNumber(signedLevel);
  if (level < 0) return 'supply_side';
  if (level <= 5) return 'operating_mall';
  return 'consumer';
}

export function formatNodeManifestVersion(revision: number): string {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('SFL_NODE_MANIFEST_REVISION_INVALID');
  }
  return `1.0.${revision}`;
}

export async function generateNodeManifest(spec: NodeManifestSpec): Promise<NodeManifest> {
  const context = normalizeNodeContext(spec);
  const unsigned: UnsignedNodeManifest = {
    schema_version: SFL_NODE_MANIFEST_SCHEMA_VERSION,
    manifest_id: requiredText(spec.manifest_id, 'manifest_id'),
    manifest_version: formatNodeManifestVersion(spec.manifest_revision),
    generated_at: normalizeTimestamp(spec.generated_at),
    lifecycle_status: spec.lifecycle_status,
    ...context,
    domain_bindings: normalizeDomainBindings(spec.domain_bindings),
    brand_ref: normalizeRef(spec.brand_ref),
    applications: normalizeRefs(spec.applications),
    surfaces: normalizeRefs(spec.surfaces),
    enabled_features: normalizeRefs(spec.enabled_features),
    api_contract_refs: normalizeRefs(spec.api_contract_refs),
    realm_ref: normalizeRef(spec.realm_ref),
    data_scope_ref: normalizeRef(spec.data_scope_ref),
    resource_binding_set_ref: normalizeRef(spec.resource_binding_set_ref),
    secret_binding_set_ref: normalizeRef(spec.secret_binding_set_ref),
    payment_binding_refs: normalizeRefs(spec.payment_binding_refs),
    callback_binding_refs: normalizeRefs(spec.callback_binding_refs),
    runtime_instance_id: requiredText(spec.runtime_instance_id, 'runtime_instance_id'),
    runtime_config_ref: normalizeRef(spec.runtime_config_ref),
    release_pointer_ref: normalizeReleasePointerRef(spec.release_pointer_ref),
  };
  const manifest_digest = await digestCanonicalJson(unsigned);
  return { ...unsigned, manifest_digest };
}

export async function generateNodeManifestRegistry(spec: NodeManifestRegistrySpec): Promise<NodeManifestRegistry> {
  const manifests = await Promise.all(spec.manifests.map(generateNodeManifest));
  manifests.sort((left, right) => left.node_id.localeCompare(right.node_id));
  return {
    schema_version: SFL_NODE_MANIFEST_REGISTRY_SCHEMA_VERSION,
    registry_version: requiredText(spec.registry_version, 'registry_version'),
    generated_at: normalizeTimestamp(spec.generated_at),
    manifests,
  };
}

export async function computeNodeManifestDigest(manifest: NodeManifest): Promise<ManifestDigest> {
  const { manifest_digest: _manifestDigest, ...unsigned } = manifest;
  return digestCanonicalJson(unsigned);
}

export async function hasValidNodeManifestDigest(manifest: NodeManifest): Promise<boolean> {
  return (await computeNodeManifestDigest(manifest)) === manifest.manifest_digest;
}

export function resolveNodeManifestByHost(registry: NodeManifestRegistry, host: string): NodeManifest {
  const normalizedHost = normalizeHost(host);
  const matches = registry.manifests.filter((manifest) => manifest.domain_bindings.some((binding) => binding.host === normalizedHost));
  if (matches.length === 0) throw new Error(`SFL_NODE_MANIFEST_HOST_UNKNOWN:${normalizedHost}`);
  if (matches.length > 1) throw new Error(`SFL_NODE_MANIFEST_HOST_AMBIGUOUS:${normalizedHost}`);
  return matches[0]!;
}

export function nodeContextOf(manifest: NodeManifest): NodeContext {
  return {
    line_id: manifest.line_id,
    node_id: manifest.node_id,
    parent_node_id: manifest.parent_node_id,
    signed_level: manifest.signed_level,
    node_profile: manifest.node_profile,
    mall_id: manifest.mall_id,
    host_node_id: manifest.host_node_id,
  };
}

export function serializeNodeManifest(manifest: NodeManifest): string {
  return stableJson(manifest);
}

export function serializeNodeManifestRegistry(registry: NodeManifestRegistry): string {
  return stableJson(registry);
}

export function deserializeNodeManifestRegistry(serialized: string): NodeManifestRegistry {
  const value: unknown = JSON.parse(serialized);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('SFL_NODE_MANIFEST_REGISTRY_INVALID');
  }
  const registry = value as Partial<NodeManifestRegistry>;
  if (registry.schema_version !== SFL_NODE_MANIFEST_REGISTRY_SCHEMA_VERSION || !Array.isArray(registry.manifests)) {
    throw new Error('SFL_NODE_MANIFEST_REGISTRY_INVALID');
  }
  return registry as NodeManifestRegistry;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`;
}

async function digestCanonicalJson(value: unknown): Promise<ManifestDigest> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('SFL_CANONICAL_JSON_NUMBER_INVALID');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)])
    );
  }
  throw new Error('SFL_CANONICAL_JSON_VALUE_INVALID');
}

function normalizeNodeContext(context: NodeContext): NodeContext {
  const signedLevel = requiredText(context.signed_level, 'signed_level') as SignedLevel;
  const segment = classifySignedLevel(signedLevel);
  const parentNodeId = nullableText(context.parent_node_id, 'parent_node_id');
  const mallId = nullableText(context.mall_id, 'mall_id');
  const hostNodeId = nullableText(context.host_node_id, 'host_node_id');

  if (segment === 'supply_side') {
    if (context.node_profile !== null || mallId !== null || hostNodeId !== null) {
      throw new Error('SFL_SUPPLY_SIDE_CONTEXT_INVALID');
    }
  } else if (segment === 'operating_mall') {
    if (context.node_profile !== 'operating_mall' || mallId === null || hostNodeId !== null) {
      throw new Error('SFL_OPERATING_MALL_CONTEXT_INVALID');
    }
    if (signedLevel === 'L0' ? parentNodeId !== null : parentNodeId === null) {
      throw new Error('SFL_OPERATING_MALL_PARENT_INVALID');
    }
  } else if (context.node_profile !== 'consumer' || mallId !== null || hostNodeId === null || parentNodeId === null) {
    throw new Error('SFL_CONSUMER_CONTEXT_INVALID');
  }

  return {
    line_id: requiredText(context.line_id, 'line_id'),
    node_id: requiredText(context.node_id, 'node_id'),
    parent_node_id: parentNodeId,
    signed_level: signedLevel,
    node_profile: context.node_profile,
    mall_id: mallId,
    host_node_id: hostNodeId,
  };
}

function signedLevelNumber(signedLevel: SignedLevel | string): number {
  const match = /^L(0|[1-9][0-9]*|-[1-9][0-9]*)$/.exec(signedLevel);
  if (match === null) throw new Error('SFL_SIGNED_LEVEL_INVALID');
  const level = Number(match[1]);
  if (!Number.isSafeInteger(level) || level > 11) throw new Error('SFL_SIGNED_LEVEL_INVALID');
  return level;
}

function normalizeDomainBindings(bindings: readonly DomainBindingRef[]): readonly DomainBindingRef[] {
  return bindings
    .map((binding) => ({
      host: normalizeHost(binding.host),
      binding_ref: normalizeRef(binding.binding_ref),
      application_ref: requiredText(binding.application_ref, 'application_ref'),
      surface_ref: requiredText(binding.surface_ref, 'surface_ref'),
    }))
    .sort((left, right) => left.host.localeCompare(right.host));
}

function normalizeHost(host: string): string {
  const normalized = requiredText(host, 'host').toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9.-]+$/.test(normalized)) throw new Error('SFL_NODE_MANIFEST_HOST_INVALID');
  return normalized;
}

function normalizeRefs<T extends VersionedRef>(refs: readonly T[]): readonly T[] {
  return refs.map((ref) => normalizeRef(ref) as T).sort((left, right) => left.ref.localeCompare(right.ref) || left.version.localeCompare(right.version));
}

function normalizeRef<T extends VersionedRef>(ref: T): T {
  return {
    ref: requiredText(ref.ref, 'ref'),
    version: requiredText(ref.version, 'version'),
  } as T;
}

function normalizeReleasePointerRef(pointer: ReleasePointerRef): ReleasePointerRef {
  const immutableArtifactDigest = requiredText(pointer.immutable_artifact_digest, 'immutable_artifact_digest') as ManifestDigest;
  if (!/^sha256:[0-9a-f]{64}$/.test(immutableArtifactDigest)) {
    throw new Error('SFL_IMMUTABLE_ARTIFACT_DIGEST_INVALID');
  }
  if (pointer.build_count !== 1) throw new Error('SFL_RELEASE_BUILD_COUNT_INVALID');
  return {
    ref: requiredText(pointer.ref, 'release_pointer_ref'),
    version: requiredText(pointer.version, 'release_pointer_version'),
    source_sha: requiredText(pointer.source_sha, 'source_sha'),
    build_id: requiredText(pointer.build_id, 'build_id'),
    build_count: pointer.build_count,
    immutable_artifact_digest: immutableArtifactDigest,
  };
}

function normalizeTimestamp(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.valueOf())) throw new Error('SFL_NODE_MANIFEST_TIMESTAMP_INVALID');
  return timestamp.toISOString();
}

function nullableText(value: string | null, field: string): string | null {
  return value === null ? null : requiredText(value, field);
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized === '') throw new Error(`SFL_NODE_MANIFEST_FIELD_INVALID:${field}`);
  return normalized;
}
