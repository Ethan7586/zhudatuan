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
type JsonRecord = Record<string, unknown>;

const NODE_CONTEXT_KEYS = ['line_id', 'node_id', 'parent_node_id', 'signed_level', 'node_profile', 'mall_id', 'host_node_id'] as const;
const NODE_MANIFEST_KEYS = [
  'schema_version',
  'manifest_id',
  'manifest_version',
  'manifest_digest',
  'generated_at',
  'lifecycle_status',
  ...NODE_CONTEXT_KEYS,
  'domain_bindings',
  'brand_ref',
  'applications',
  'surfaces',
  'enabled_features',
  'api_contract_refs',
  'realm_ref',
  'data_scope_ref',
  'resource_binding_set_ref',
  'secret_binding_set_ref',
  'payment_binding_refs',
  'callback_binding_refs',
  'runtime_instance_id',
  'runtime_config_ref',
  'release_pointer_ref',
] as const;
const NODE_MANIFEST_REGISTRY_KEYS = ['schema_version', 'registry_version', 'generated_at', 'manifests'] as const;
const VERSIONED_REF_KEYS = ['ref', 'version'] as const;
const DOMAIN_BINDING_KEYS = ['host', 'binding_ref', 'application_ref', 'surface_ref'] as const;
const RELEASE_POINTER_KEYS = ['ref', 'version', 'source_sha', 'build_id', 'build_count', 'immutable_artifact_digest'] as const;
const NODE_LIFECYCLE_STATUSES = new Set<NodeLifecycleStatus>(['provisioning', 'active', 'suspended', 'retired']);
const MANIFEST_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const SOURCE_SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const MANIFEST_VERSION_PATTERN = /^1\.0\.(?:0|[1-9][0-9]*)$/;
const CONSOLE_SURFACE_REF = 'surface:console';

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
    lifecycle_status: normalizeLifecycleStatus(spec.lifecycle_status),
    ...context,
    domain_bindings: normalizeDomainBindings(spec.domain_bindings),
    brand_ref: normalizeRef(spec.brand_ref, 'brand_ref'),
    applications: normalizeRefs(spec.applications, 'applications'),
    surfaces: normalizeRefs(spec.surfaces, 'surfaces'),
    enabled_features: normalizeRefs(spec.enabled_features, 'enabled_features'),
    api_contract_refs: normalizeRefs(spec.api_contract_refs, 'api_contract_refs'),
    realm_ref: normalizeRef(spec.realm_ref, 'realm_ref'),
    data_scope_ref: normalizeRef(spec.data_scope_ref, 'data_scope_ref'),
    resource_binding_set_ref: normalizeRef(spec.resource_binding_set_ref, 'resource_binding_set_ref'),
    secret_binding_set_ref: normalizeRef(spec.secret_binding_set_ref, 'secret_binding_set_ref'),
    payment_binding_refs: normalizeRefs(spec.payment_binding_refs, 'payment_binding_refs'),
    callback_binding_refs: normalizeRefs(spec.callback_binding_refs, 'callback_binding_refs'),
    runtime_instance_id: requiredText(spec.runtime_instance_id, 'runtime_instance_id'),
    runtime_config_ref: normalizeRef(spec.runtime_config_ref, 'runtime_config_ref'),
    release_pointer_ref: normalizeReleasePointerRef(spec.release_pointer_ref),
  };
  const manifest_digest = await digestCanonicalJson(unsigned);
  return parseNodeManifestStructure({ ...unsigned, manifest_digest });
}

export async function generateNodeManifestRegistry(spec: NodeManifestRegistrySpec): Promise<NodeManifestRegistry> {
  requiredArray(spec.manifests, 'manifests');
  const manifests = await Promise.all(spec.manifests.map((manifest) => generateNodeManifest(manifest)));
  manifests.sort(compareManifests);
  const registry: NodeManifestRegistry = {
    schema_version: SFL_NODE_MANIFEST_REGISTRY_SCHEMA_VERSION,
    registry_version: requiredText(spec.registry_version, 'registry_version'),
    generated_at: normalizeTimestamp(spec.generated_at),
    manifests,
  };
  validateNodeManifestRegistry(registry);
  return registry;
}

export function parseNodeContext(value: unknown): NodeContext {
  const record = exactRecord(value, NODE_CONTEXT_KEYS, 'SFL_NODE_CONTEXT_INVALID');
  return parseNodeContextFields(record);
}

export async function parseNodeManifest(value: unknown): Promise<NodeManifest> {
  const manifest = parseNodeManifestStructure(value);
  const computedDigest = await digestUnsignedNodeManifest(manifest);
  if (computedDigest !== manifest.manifest_digest) {
    throw new Error(`SFL_NODE_MANIFEST_DIGEST_MISMATCH:${manifest.manifest_id}`);
  }
  return manifest;
}

export async function parseNodeManifestRegistry(value: unknown): Promise<NodeManifestRegistry> {
  const registry = parseNodeManifestRegistryStructure(value);
  await Promise.all(
    registry.manifests.map(async (manifest) => {
      const computedDigest = await digestUnsignedNodeManifest(manifest);
      if (computedDigest !== manifest.manifest_digest) {
        throw new Error(`SFL_NODE_MANIFEST_DIGEST_MISMATCH:${manifest.manifest_id}`);
      }
    })
  );
  validateNodeManifestRegistry(registry);
  return registry;
}

export async function deserializeNodeManifest(serialized: string): Promise<NodeManifest> {
  return parseNodeManifest(parseSerializedJson(serialized, 'SFL_NODE_MANIFEST_JSON_INVALID'));
}

export async function deserializeNodeManifestRegistry(serialized: string): Promise<NodeManifestRegistry> {
  return parseNodeManifestRegistry(parseSerializedJson(serialized, 'SFL_NODE_MANIFEST_REGISTRY_JSON_INVALID'));
}

export async function computeNodeManifestDigest(manifest: NodeManifest): Promise<ManifestDigest> {
  return digestUnsignedNodeManifest(parseNodeManifestStructure(manifest));
}

export async function hasValidNodeManifestDigest(manifest: NodeManifest): Promise<boolean> {
  try {
    const parsed = parseNodeManifestStructure(manifest);
    return (await digestUnsignedNodeManifest(parsed)) === parsed.manifest_digest;
  } catch {
    return false;
  }
}

export function resolveNodeManifestByHost(registry: NodeManifestRegistry, host: string): NodeManifest {
  const normalizedHost = normalizeHost(host);
  const matches = registry.manifests.flatMap((manifest) =>
    manifest.domain_bindings.filter((binding) => binding.host === normalizedHost).map(() => manifest)
  );
  if (matches.length === 0) throw new Error(`SFL_NODE_MANIFEST_HOST_UNKNOWN:${normalizedHost}`);
  if (matches.length > 1) throw new Error(`SFL_NODE_MANIFEST_HOST_AMBIGUOUS:${normalizedHost}`);
  return matches[0]!;
}

export function resolveNodeDomainBindingByHost(manifest: NodeManifest, host: string): DomainBindingRef {
  const normalizedHost = normalizeHost(host);
  const matches = manifest.domain_bindings.filter((binding) => binding.host === normalizedHost);
  if (matches.length === 0) throw new Error(`SFL_NODE_MANIFEST_HOST_UNKNOWN:${normalizedHost}`);
  if (matches.length > 1) throw new Error(`SFL_NODE_MANIFEST_HOST_AMBIGUOUS:${normalizedHost}`);
  return matches[0]!;
}

export function nodeContextOf(manifest: NodeManifest): NodeContext {
  return parseNodeContext({
    line_id: manifest.line_id,
    node_id: manifest.node_id,
    parent_node_id: manifest.parent_node_id,
    signed_level: manifest.signed_level,
    node_profile: manifest.node_profile,
    mall_id: manifest.mall_id,
    host_node_id: manifest.host_node_id,
  });
}

export function serializeNodeManifest(manifest: NodeManifest): string {
  return stableJson(parseNodeManifestStructure(manifest));
}

export function serializeNodeManifestRegistry(registry: NodeManifestRegistry): string {
  const parsed = parseNodeManifestRegistryStructure(registry);
  validateNodeManifestRegistry(parsed);
  return stableJson(parsed);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function parseNodeManifestStructure(value: unknown): NodeManifest {
  const record = exactRecord(value, NODE_MANIFEST_KEYS, 'SFL_NODE_MANIFEST_INVALID');
  if (record.schema_version !== SFL_NODE_MANIFEST_SCHEMA_VERSION) {
    throw new Error('SFL_NODE_MANIFEST_SCHEMA_VERSION_INVALID');
  }
  const context = parseNodeContextFields(record);
  const manifest: NodeManifest = {
    schema_version: SFL_NODE_MANIFEST_SCHEMA_VERSION,
    manifest_id: canonicalText(record.manifest_id, 'manifest_id'),
    manifest_version: parseManifestVersion(record.manifest_version),
    manifest_digest: parseManifestDigest(record.manifest_digest, 'manifest_digest'),
    generated_at: parseCanonicalTimestamp(record.generated_at),
    lifecycle_status: parseLifecycleStatus(record.lifecycle_status),
    ...context,
    domain_bindings: parseDomainBindings(record.domain_bindings),
    brand_ref: parseVersionedRef(record.brand_ref, 'brand_ref'),
    applications: parseVersionedRefs(record.applications, 'applications'),
    surfaces: parseVersionedRefs(record.surfaces, 'surfaces'),
    enabled_features: parseVersionedRefs(record.enabled_features, 'enabled_features'),
    api_contract_refs: parseVersionedRefs(record.api_contract_refs, 'api_contract_refs'),
    realm_ref: parseVersionedRef(record.realm_ref, 'realm_ref'),
    data_scope_ref: parseVersionedRef(record.data_scope_ref, 'data_scope_ref'),
    resource_binding_set_ref: parseVersionedRef(record.resource_binding_set_ref, 'resource_binding_set_ref'),
    secret_binding_set_ref: parseVersionedRef(record.secret_binding_set_ref, 'secret_binding_set_ref'),
    payment_binding_refs: parseVersionedRefs(record.payment_binding_refs, 'payment_binding_refs'),
    callback_binding_refs: parseVersionedRefs(record.callback_binding_refs, 'callback_binding_refs'),
    runtime_instance_id: canonicalText(record.runtime_instance_id, 'runtime_instance_id'),
    runtime_config_ref: parseVersionedRef(record.runtime_config_ref, 'runtime_config_ref'),
    release_pointer_ref: parseReleasePointerRef(record.release_pointer_ref),
  };
  validateNodeManifestReferences(manifest);
  return manifest;
}

function parseNodeManifestRegistryStructure(value: unknown): NodeManifestRegistry {
  const record = exactRecord(value, NODE_MANIFEST_REGISTRY_KEYS, 'SFL_NODE_MANIFEST_REGISTRY_INVALID');
  if (record.schema_version !== SFL_NODE_MANIFEST_REGISTRY_SCHEMA_VERSION) {
    throw new Error('SFL_NODE_MANIFEST_REGISTRY_SCHEMA_VERSION_INVALID');
  }
  const manifests = requiredArray(record.manifests, 'manifests').map(parseNodeManifestStructure).sort(compareManifests);
  return {
    schema_version: SFL_NODE_MANIFEST_REGISTRY_SCHEMA_VERSION,
    registry_version: canonicalText(record.registry_version, 'registry_version'),
    generated_at: parseCanonicalTimestamp(record.generated_at),
    manifests,
  };
}

function parseNodeContextFields(record: JsonRecord): NodeContext {
  const context: NodeContext = {
    line_id: canonicalText(record.line_id, 'line_id'),
    node_id: canonicalText(record.node_id, 'node_id'),
    parent_node_id: parseNullableText(record.parent_node_id, 'parent_node_id'),
    signed_level: parseSignedLevel(record.signed_level),
    node_profile: parseNodeProfile(record.node_profile),
    mall_id: parseNullableText(record.mall_id, 'mall_id'),
    host_node_id: parseNullableText(record.host_node_id, 'host_node_id'),
  };
  validateNodeContext(context);
  return context;
}

function validateNodeContext(context: NodeContext): void {
  const segment = classifySignedLevel(context.signed_level);
  if (segment === 'supply_side') {
    if (context.parent_node_id !== null || context.node_profile !== null || context.mall_id !== null || context.host_node_id !== null) {
      throw new Error('SFL_SUPPLY_SIDE_CONTEXT_INVALID');
    }
    return;
  }
  if (segment === 'operating_mall') {
    if (context.node_profile !== 'operating_mall' || context.mall_id === null || context.host_node_id !== null) {
      throw new Error('SFL_OPERATING_MALL_CONTEXT_INVALID');
    }
    if (context.signed_level === 'L0' ? context.parent_node_id !== null : context.parent_node_id === null) {
      throw new Error('SFL_OPERATING_MALL_PARENT_INVALID');
    }
    return;
  }
  if (context.node_profile !== 'consumer' || context.mall_id !== null || context.host_node_id === null || context.parent_node_id === null) {
    throw new Error('SFL_CONSUMER_CONTEXT_INVALID');
  }
}

function validateNodeManifestReferences(manifest: NodeManifest): void {
  const referenceLists: ReadonlyArray<readonly [string, readonly VersionedRef[]]> = [
    ['applications', manifest.applications],
    ['surfaces', manifest.surfaces],
    ['enabled_features', manifest.enabled_features],
    ['api_contract_refs', manifest.api_contract_refs],
    ['payment_binding_refs', manifest.payment_binding_refs],
    ['callback_binding_refs', manifest.callback_binding_refs],
  ];
  for (const [field, references] of referenceLists) {
    assertUniqueReferences(references, field);
  }
  assertUniqueValues(
    manifest.domain_bindings.map((binding) => binding.host),
    (host) => `SFL_NODE_MANIFEST_HOST_AMBIGUOUS:${host}`
  );
  assertUniqueValues(
    manifest.domain_bindings.map((binding) => binding.binding_ref.ref),
    (ref) => `SFL_NODE_MANIFEST_REFERENCE_AMBIGUOUS:domain_bindings.binding_ref:${ref}`
  );

  const applicationRefs = new Set(manifest.applications.map((reference) => reference.ref));
  const surfaceRefs = new Set(manifest.surfaces.map((reference) => reference.ref));
  for (const binding of manifest.domain_bindings) {
    if (!applicationRefs.has(binding.application_ref)) {
      throw new Error(`SFL_NODE_MANIFEST_REFERENCE_UNKNOWN:application_ref:${binding.application_ref}`);
    }
    if (!surfaceRefs.has(binding.surface_ref)) {
      throw new Error(`SFL_NODE_MANIFEST_REFERENCE_UNKNOWN:surface_ref:${binding.surface_ref}`);
    }
  }
  if (manifest.node_profile === 'consumer' && surfaceRefs.has(CONSOLE_SURFACE_REF)) {
    throw new Error(`SFL_CONSUMER_SURFACE_INVALID:${CONSOLE_SURFACE_REF}`);
  }
}

function validateNodeManifestRegistry(registry: NodeManifestRegistry): void {
  const manifests = registry.manifests;
  assertRegistryIdentifierUnique(manifests.map((manifest) => manifest.node_id), 'node_id');
  assertRegistryIdentifierUnique(manifests.map((manifest) => manifest.manifest_id), 'manifest_id');
  assertRegistryIdentifierUnique(manifests.map((manifest) => manifest.runtime_instance_id), 'runtime_instance_id');
  assertRegistryIdentifierUnique(
    manifests.flatMap((manifest) => (manifest.mall_id === null ? [] : [manifest.mall_id])),
    'mall_id'
  );
  assertRegistryIdentifierUnique(manifests.map((manifest) => manifest.realm_ref.ref), 'realm_ref');
  assertRegistryIdentifierUnique(manifests.map((manifest) => manifest.data_scope_ref.ref), 'data_scope_ref');
  assertRegistryIdentifierUnique(manifests.map((manifest) => manifest.resource_binding_set_ref.ref), 'resource_binding_set_ref');
  assertRegistryIdentifierUnique(manifests.map((manifest) => manifest.secret_binding_set_ref.ref), 'secret_binding_set_ref');
  assertRegistryIdentifierUnique(manifests.map((manifest) => manifest.runtime_config_ref.ref), 'runtime_config_ref');
  assertRegistryIdentifierUnique(manifests.map((manifest) => manifest.release_pointer_ref.ref), 'release_pointer_ref');
  assertRegistryIdentifierUnique(
    manifests.flatMap((manifest) => manifest.domain_bindings.map((binding) => binding.binding_ref.ref)),
    'domain_binding_ref'
  );
  assertRegistryIdentifierUnique(
    manifests.flatMap((manifest) => manifest.payment_binding_refs.map((reference) => reference.ref)),
    'payment_binding_ref'
  );
  assertRegistryIdentifierUnique(
    manifests.flatMap((manifest) => manifest.callback_binding_refs.map((reference) => reference.ref)),
    'callback_binding_ref'
  );
  assertUniqueValues(
    manifests.flatMap((manifest) => manifest.domain_bindings.map((binding) => binding.host)),
    (host) => `SFL_NODE_MANIFEST_HOST_AMBIGUOUS:${host}`
  );

  const manifestsByNode = new Map(manifests.map((manifest) => [manifest.node_id, manifest]));
  const lineRoots = new Set<string>();
  for (const manifest of manifests) {
    const level = signedLevelNumber(manifest.signed_level);
    const segment = classifySignedLevel(manifest.signed_level);
    if (segment === 'supply_side') continue;

    if (segment === 'operating_mall') {
      if (level === 0) {
        if (lineRoots.has(manifest.line_id)) {
          throw new Error(`SFL_NODE_MANIFEST_LINE_ROOT_AMBIGUOUS:${manifest.line_id}`);
        }
        lineRoots.add(manifest.line_id);
        continue;
      }
      const parent = requireParentManifest(manifest, manifestsByNode);
      if (parent.line_id !== manifest.line_id || classifySignedLevel(parent.signed_level) !== 'operating_mall') {
        throw new Error(`SFL_OPERATING_MALL_PARENT_INVALID:${manifest.node_id}`);
      }
      const parentLevel = signedLevelNumber(parent.signed_level);
      if (parentLevel < 0 || parentLevel >= level) {
        throw new Error(`SFL_OPERATING_MALL_PARENT_INVALID:${manifest.node_id}`);
      }
      continue;
    }

    const parent = requireParentManifest(manifest, manifestsByNode);
    if (parent.line_id !== manifest.line_id) {
      throw new Error(`SFL_CONSUMER_PARENT_LINE_INVALID:${manifest.node_id}`);
    }
    if (level === 6) {
      if (classifySignedLevel(parent.signed_level) !== 'operating_mall' || manifest.host_node_id !== parent.node_id) {
        throw new Error(`SFL_CONSUMER_L6_PARENT_INVALID:${manifest.node_id}`);
      }
    } else if (parent.signed_level !== `L${level - 1}` || parent.node_profile !== 'consumer' || manifest.host_node_id !== parent.host_node_id) {
      throw new Error(`SFL_CONSUMER_PARENT_CHAIN_INVALID:${manifest.node_id}`);
    }

    const hostNode = manifestsByNode.get(manifest.host_node_id!);
    if (
      hostNode === undefined ||
      hostNode.line_id !== manifest.line_id ||
      classifySignedLevel(hostNode.signed_level) !== 'operating_mall' ||
      hostNode.node_profile !== 'operating_mall'
    ) {
      throw new Error(`SFL_CONSUMER_HOST_NODE_INVALID:${manifest.node_id}`);
    }
  }
}

function requireParentManifest(manifest: NodeManifest, manifestsByNode: ReadonlyMap<string, NodeManifest>): NodeManifest {
  const parent = manifest.parent_node_id === null ? undefined : manifestsByNode.get(manifest.parent_node_id);
  if (parent === undefined) throw new Error(`SFL_NODE_MANIFEST_PARENT_UNKNOWN:${manifest.node_id}`);
  return parent;
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`;
}

async function digestUnsignedNodeManifest(manifest: NodeManifest): Promise<ManifestDigest> {
  const { manifest_digest: _manifestDigest, ...unsigned } = manifest;
  return digestCanonicalJson(unsigned);
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
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, entry]) => [key, canonicalValue(entry)])
    );
  }
  throw new Error('SFL_CANONICAL_JSON_VALUE_INVALID');
}

function normalizeNodeContext(context: NodeContext): NodeContext {
  const signedLevel = requiredText(context.signed_level, 'signed_level') as SignedLevel;
  signedLevelNumber(signedLevel);
  const nodeProfile = normalizeNodeProfile(context.node_profile);
  const normalized: NodeContext = {
    line_id: requiredText(context.line_id, 'line_id'),
    node_id: requiredText(context.node_id, 'node_id'),
    parent_node_id: nullableText(context.parent_node_id, 'parent_node_id'),
    signed_level: signedLevel,
    node_profile: nodeProfile,
    mall_id: nullableText(context.mall_id, 'mall_id'),
    host_node_id: nullableText(context.host_node_id, 'host_node_id'),
  };
  validateNodeContext(normalized);
  return normalized;
}

function signedLevelNumber(signedLevel: SignedLevel | string): number {
  if (typeof signedLevel !== 'string') throw new Error('SFL_SIGNED_LEVEL_INVALID');
  const match = /^L(0|[1-9][0-9]*|-[1-9][0-9]*)$/.exec(signedLevel);
  if (match === null) throw new Error('SFL_SIGNED_LEVEL_INVALID');
  const level = Number(match[1]);
  if (!Number.isSafeInteger(level) || level > 11) throw new Error('SFL_SIGNED_LEVEL_INVALID');
  return level;
}

function normalizeDomainBindings(bindings: readonly DomainBindingRef[]): readonly DomainBindingRef[] {
  return requiredArray(bindings, 'domain_bindings')
    .map((binding, index) => {
      const record = exactRecord(binding, DOMAIN_BINDING_KEYS, `SFL_NODE_MANIFEST_DOMAIN_BINDING_INVALID:${index}`);
      return {
        host: normalizeHost(record.host),
        binding_ref: normalizeRef(record.binding_ref, `domain_bindings[${index}].binding_ref`),
        application_ref: requiredText(record.application_ref, `domain_bindings[${index}].application_ref`),
        surface_ref: requiredText(record.surface_ref, `domain_bindings[${index}].surface_ref`),
      };
    })
    .sort(compareDomainBindings);
}

function parseDomainBindings(value: unknown): readonly DomainBindingRef[] {
  return requiredArray(value, 'domain_bindings')
    .map((binding, index) => {
      const record = exactRecord(binding, DOMAIN_BINDING_KEYS, `SFL_NODE_MANIFEST_DOMAIN_BINDING_INVALID:${index}`);
      return {
        host: parseCanonicalHost(record.host),
        binding_ref: parseVersionedRef(record.binding_ref, `domain_bindings[${index}].binding_ref`),
        application_ref: canonicalText(record.application_ref, `domain_bindings[${index}].application_ref`),
        surface_ref: canonicalText(record.surface_ref, `domain_bindings[${index}].surface_ref`),
      };
    })
    .sort(compareDomainBindings);
}

function normalizeHost(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new Error('SFL_NODE_MANIFEST_HOST_INVALID');
  }
  const host = value;
  const normalized = host.toLowerCase().replace(/\.$/, '');
  if (normalized.length > 253) throw new Error('SFL_NODE_MANIFEST_HOST_INVALID');
  const labels = normalized.split('.');
  if (
    labels.some(
      (label) => label.length === 0 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    )
  ) {
    throw new Error('SFL_NODE_MANIFEST_HOST_INVALID');
  }
  return normalized;
}

function parseCanonicalHost(value: unknown): string {
  const host = canonicalText(value, 'host');
  const normalized = normalizeHost(host);
  if (normalized !== host) throw new Error('SFL_NODE_MANIFEST_HOST_NON_CANONICAL');
  return host;
}

function normalizeRefs(refs: readonly VersionedRef[], field: string): readonly VersionedRef[] {
  return requiredArray(refs, field)
    .map((ref, index) => normalizeRef(ref, `${field}[${index}]`))
    .sort(compareVersionedRefs);
}

function parseVersionedRefs(value: unknown, field: string): readonly VersionedRef[] {
  return requiredArray(value, field)
    .map((ref, index) => parseVersionedRef(ref, `${field}[${index}]`))
    .sort(compareVersionedRefs);
}

function normalizeRef(value: unknown, field: string): VersionedRef {
  const record = exactRecord(value, VERSIONED_REF_KEYS, `SFL_NODE_MANIFEST_REFERENCE_INVALID:${field}`);
  return {
    ref: requiredText(record.ref, `${field}.ref`),
    version: requiredText(record.version, `${field}.version`),
  };
}

function parseVersionedRef(value: unknown, field: string): VersionedRef {
  const record = exactRecord(value, VERSIONED_REF_KEYS, `SFL_NODE_MANIFEST_REFERENCE_INVALID:${field}`);
  return {
    ref: canonicalText(record.ref, `${field}.ref`),
    version: canonicalText(record.version, `${field}.version`),
  };
}

function normalizeReleasePointerRef(value: ReleasePointerRef): ReleasePointerRef {
  const record = exactRecord(value, RELEASE_POINTER_KEYS, 'SFL_RELEASE_POINTER_INVALID');
  return {
    ref: requiredText(record.ref, 'release_pointer_ref'),
    version: requiredText(record.version, 'release_pointer_version'),
    source_sha: normalizeSourceSha(record.source_sha),
    build_id: requiredText(record.build_id, 'build_id'),
    build_count: parseBuildCount(record.build_count),
    immutable_artifact_digest: normalizeManifestDigest(record.immutable_artifact_digest, 'immutable_artifact_digest'),
  };
}

function parseReleasePointerRef(value: unknown): ReleasePointerRef {
  const record = exactRecord(value, RELEASE_POINTER_KEYS, 'SFL_RELEASE_POINTER_INVALID');
  return {
    ref: canonicalText(record.ref, 'release_pointer_ref'),
    version: canonicalText(record.version, 'release_pointer_version'),
    source_sha: parseCanonicalSourceSha(record.source_sha),
    build_id: canonicalText(record.build_id, 'build_id'),
    build_count: parseBuildCount(record.build_count),
    immutable_artifact_digest: parseManifestDigest(record.immutable_artifact_digest, 'immutable_artifact_digest'),
  };
}

function parseBuildCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value !== 1) {
    throw new Error('SFL_RELEASE_BUILD_COUNT_INVALID');
  }
  return value;
}

function normalizeSourceSha(value: unknown): string {
  const normalized = requiredText(value, 'source_sha').toLowerCase();
  if (!SOURCE_SHA_PATTERN.test(normalized)) throw new Error('SFL_RELEASE_SOURCE_SHA_INVALID');
  return normalized;
}

function parseCanonicalSourceSha(value: unknown): string {
  const sourceSha = canonicalText(value, 'source_sha');
  if (!SOURCE_SHA_PATTERN.test(sourceSha)) throw new Error('SFL_RELEASE_SOURCE_SHA_INVALID');
  return sourceSha;
}

function normalizeManifestDigest(value: unknown, field: string): ManifestDigest {
  const digest = requiredText(value, field).toLowerCase();
  if (!MANIFEST_DIGEST_PATTERN.test(digest)) throw new Error(`SFL_NODE_MANIFEST_DIGEST_INVALID:${field}`);
  return digest as ManifestDigest;
}

function parseManifestDigest(value: unknown, field: string): ManifestDigest {
  const digest = canonicalText(value, field);
  if (!MANIFEST_DIGEST_PATTERN.test(digest)) throw new Error(`SFL_NODE_MANIFEST_DIGEST_INVALID:${field}`);
  return digest as ManifestDigest;
}

function parseManifestVersion(value: unknown): string {
  const version = canonicalText(value, 'manifest_version');
  if (!MANIFEST_VERSION_PATTERN.test(version)) throw new Error('SFL_NODE_MANIFEST_VERSION_INVALID');
  return version;
}

function normalizeLifecycleStatus(value: unknown): NodeLifecycleStatus {
  const status = requiredText(value, 'lifecycle_status');
  if (!NODE_LIFECYCLE_STATUSES.has(status as NodeLifecycleStatus)) {
    throw new Error('SFL_NODE_MANIFEST_LIFECYCLE_STATUS_INVALID');
  }
  return status as NodeLifecycleStatus;
}

function parseLifecycleStatus(value: unknown): NodeLifecycleStatus {
  const status = canonicalText(value, 'lifecycle_status');
  if (!NODE_LIFECYCLE_STATUSES.has(status as NodeLifecycleStatus)) {
    throw new Error('SFL_NODE_MANIFEST_LIFECYCLE_STATUS_INVALID');
  }
  return status as NodeLifecycleStatus;
}

function normalizeNodeProfile(value: unknown): NodeProfile | null {
  if (value === null) return null;
  const profile = requiredText(value, 'node_profile');
  if (profile !== 'operating_mall' && profile !== 'consumer') {
    throw new Error('SFL_NODE_PROFILE_INVALID');
  }
  return profile;
}

function parseNodeProfile(value: unknown): NodeProfile | null {
  if (value === null) return null;
  const profile = canonicalText(value, 'node_profile');
  if (profile !== 'operating_mall' && profile !== 'consumer') {
    throw new Error('SFL_NODE_PROFILE_INVALID');
  }
  return profile;
}

function parseSignedLevel(value: unknown): SignedLevel {
  const signedLevel = canonicalText(value, 'signed_level');
  signedLevelNumber(signedLevel);
  return signedLevel as SignedLevel;
}

function normalizeTimestamp(value: unknown): string {
  const timestamp = new Date(requiredText(value, 'generated_at'));
  if (Number.isNaN(timestamp.valueOf())) throw new Error('SFL_NODE_MANIFEST_TIMESTAMP_INVALID');
  return timestamp.toISOString();
}

function parseCanonicalTimestamp(value: unknown): string {
  const timestamp = canonicalText(value, 'generated_at');
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== timestamp) {
    throw new Error('SFL_NODE_MANIFEST_TIMESTAMP_INVALID');
  }
  return timestamp;
}

function parseNullableText(value: unknown, field: string): string | null {
  return value === null ? null : canonicalText(value, field);
}

function nullableText(value: unknown, field: string): string | null {
  return value === null ? null : requiredText(value, field);
}

function canonicalText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new Error(`SFL_NODE_MANIFEST_FIELD_INVALID:${field}`);
  }
  return value;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`SFL_NODE_MANIFEST_FIELD_INVALID:${field}`);
  const normalized = value.trim();
  if (normalized === '') throw new Error(`SFL_NODE_MANIFEST_FIELD_INVALID:${field}`);
  return normalized;
}

function requiredArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`SFL_NODE_MANIFEST_ARRAY_INVALID:${field}`);
  return value;
}

function exactRecord(value: unknown, expectedKeys: readonly string[], code: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  const record = value as JsonRecord;
  const keys = Object.keys(record);
  const expected = new Set(expectedKeys);
  if (keys.length !== expected.size || keys.some((key) => !expected.has(key))) throw new Error(code);
  return record;
}

function parseSerializedJson(serialized: unknown, code: string): unknown {
  if (typeof serialized !== 'string') throw new Error(code);
  try {
    return JSON.parse(serialized);
  } catch {
    throw new Error(code);
  }
}

function assertUniqueReferences(references: readonly VersionedRef[], field: string): void {
  assertUniqueValues(
    references.map((reference) => reference.ref),
    (ref) => `SFL_NODE_MANIFEST_REFERENCE_AMBIGUOUS:${field}:${ref}`
  );
}

function assertRegistryIdentifierUnique(values: readonly string[], field: string): void {
  assertUniqueValues(values, (value) => `SFL_NODE_MANIFEST_REGISTRY_IDENTIFIER_AMBIGUOUS:${field}:${value}`);
}

function assertUniqueValues(values: readonly string[], errorFor: (value: string) => string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(errorFor(value));
    seen.add(value);
  }
}

function compareManifests(left: NodeManifest, right: NodeManifest): number {
  return compareText(left.node_id, right.node_id) || compareText(left.manifest_id, right.manifest_id);
}

function compareDomainBindings(left: DomainBindingRef, right: DomainBindingRef): number {
  return (
    compareText(left.host, right.host) ||
    compareText(left.application_ref, right.application_ref) ||
    compareText(left.surface_ref, right.surface_ref) ||
    compareVersionedRefs(left.binding_ref, right.binding_ref)
  );
}

function compareVersionedRefs(left: VersionedRef, right: VersionedRef): number {
  return compareText(left.ref, right.ref) || compareText(left.version, right.version);
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
