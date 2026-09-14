export const SFL_NODE_MANIFEST_SCHEMA_VERSION = 'sfl.node-manifest.v1' as const;
export * from './AdminSegmentScope.ts';
export const SFL_NODE_MANIFEST_REGISTRY_SCHEMA_VERSION = 'sfl.node-manifest-registry.v1' as const;
export const SFL_NODE_TOPOLOGY_SCHEMA_VERSION = 'sfl.node-topology.v1' as const;

export type ManifestDigest = `sha256:${string}`;
export type SignedLevel = `L${number}`;
export type SignedLevelSegment = 'supply_side' | 'member_l0_l5' | 'member_l6_l11';
export type NodeProfile = 'operating_mall' | 'consumer';
export type SovereigntyTier = 'sovereign' | 'hosted';
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

export interface NodeRecord {
  readonly line_id: string;
  readonly node_id: string;
  readonly sovereignty_tier: SovereigntyTier;
  readonly node_profile: NodeProfile;
  readonly realm_id: string;
  readonly mall_id: string | null;
  readonly status: NodeLifecycleStatus;
  readonly created_at: string;
}

export interface NodeRelationRecord {
  readonly line_id: string;
  readonly node_id: string;
  readonly parent_node_id: string | null;
  readonly original_parent_node_id: string | null;
  readonly signed_level: SignedLevel;
  readonly host_sovereign_node_id: string;
  readonly relation_version: number;
  readonly effective_at: string;
  readonly superseded_at: string | null;
}

export interface SflNodeTopology {
  readonly schema_version: typeof SFL_NODE_TOPOLOGY_SCHEMA_VERSION;
  readonly nodes: readonly NodeRecord[];
  readonly relations: readonly NodeRelationRecord[];
}

export interface ResolvedNodeRecord extends NodeRecord, NodeRelationRecord {}

/** Server-authoritative node facts resolved from persisted node and current relation rows. */
export interface AuthoritativeNodeContext {
  readonly line_id: string;
  readonly node_id: string;
  readonly parent_node_id: string | null;
  readonly signed_level: SignedLevel;
  readonly sovereignty_tier: SovereigntyTier;
  readonly node_profile: NodeProfile;
  readonly realm_id: string;
  readonly mall_id: string | null;
  readonly host_sovereign_node_id: string;
  readonly relation_version: number;
  readonly effective_at: string;
  readonly status: NodeLifecycleStatus;
}

/** One indexed closure result relative to a resolved node. */
export interface NodeScopeRecord {
  readonly line_id: string;
  readonly node_id: string;
  readonly distance: number;
  readonly relation_version: number;
  readonly effective_at: string;
  readonly status: NodeLifecycleStatus;
}

export interface HostedNodeProvisioningRequest {
  readonly idempotency_key: string;
  readonly node_id: string;
  readonly parent_node_id: string;
  readonly realm_id: string;
  readonly node_profile: NodeProfile;
  readonly mall_id: string | null;
  readonly signed_level: SignedLevel;
  readonly effective_at: string;
  readonly requested_by: string;
  readonly trace_id: string;
}

export interface HostedNodeProvisioningResult extends ResolvedNodeRecord {
  readonly idempotency_key: string;
  readonly request_hash: string;
  readonly requested_by: string;
  readonly trace_id: string;
  readonly replayed: boolean;
}

export type MemberNodeRegistrationOrigin = 'direct' | 'invitation';
export type MemberNodeRegistrationOutcome = 'registered' | 'level_boundary';

/** Server-built registration command. Line, parent, level and host sovereignty are deliberately absent. */
export interface MemberNodeRegistrationRequest {
  readonly registration_id: string;
  readonly business_number: string;
  readonly idempotency_key: string;
  readonly registration_origin: MemberNodeRegistrationOrigin;
  readonly registration_host_node_id: string;
  readonly invitation_token_hash: string | null;
  readonly business_identity_hash: string;
  readonly node_key: string;
  readonly realm_id: string;
  readonly membership_id: string;
  readonly requested_by: string;
  readonly trace_id: string;
}

export interface MemberNodeRegistrationResult {
  readonly outcome: MemberNodeRegistrationOutcome;
  readonly registration_id: string;
  readonly business_number: string;
  readonly registration_origin: MemberNodeRegistrationOrigin;
  readonly registration_host_node_id: string;
  readonly invitation_id: string | null;
  readonly inviter_node_id: string | null;
  readonly inviter_membership_id: string | null;
  readonly node_id: string | null;
  readonly line_id: string;
  readonly parent_node_id: string | null;
  readonly signed_level: SignedLevel | null;
  readonly relation_version: number | null;
  readonly host_sovereign_node_id: string;
  readonly realm_id: string;
  readonly membership_id: string | null;
  readonly effective_at: string | null;
  readonly accepted_at: string | null;
  readonly idempotency_key: string;
  readonly request_hash: string;
  readonly created_at: string;
  readonly replayed: boolean;
}

/** Business-only request. Node, Realm, lineage and Membership authority come from the active server session. */
export interface HostedMallOpeningRequest {
  readonly idempotency_key: string;
  readonly mall_name: string;
  readonly operating_entity_name: string;
}

export interface HostedMallOpeningResult {
  readonly opening_id: string;
  readonly business_number: string;
  readonly idempotency_key: string;
  readonly request_hash: string;
  readonly node_id: string;
  readonly membership_id: string;
  readonly principal_id: string;
  readonly mall_id: string;
  readonly operating_entity_id: string;
  readonly realm_id: string;
  readonly line_id: string;
  readonly signed_level: SignedLevel;
  readonly parent_node_id: string | null;
  readonly original_parent_node_id: string | null;
  readonly host_sovereign_node_id: string;
  readonly sovereignty_tier: 'hosted';
  readonly node_profile: 'operating_mall';
  readonly capabilities: readonly NodeProfile[];
  readonly capability_version: number;
  readonly relation_version: number;
  readonly mall_version: number;
  readonly entity_binding_version: number;
  readonly configuration_version: number;
  readonly payment_configuration_version: number;
  readonly status: 'active';
  readonly opened_at: string;
  readonly replayed: boolean;
}

export type SovereignUpgradeStatus =
  | 'planned'
  | 'resources_ready'
  | 'bindings_complete'
  | 'upgraded'
  | 'failed'
  | 'rolled_back';

/** Business configuration only. Node, Realm, Mall, Membership and lineage are server-authoritative. */
export interface SovereignUpgradeRequest {
  readonly idempotency_key: string;
  readonly brand_ref: string;
  readonly public_api_host: string;
  readonly storefront_host: string;
  readonly accounts_host: string;
  readonly console_host: string;
  readonly payment_callback_host: string;
  readonly edge_binding_ref: string;
  readonly tunnel_ref: string;
  readonly gateway_ref: string;
  readonly runtime_identity_ref: string;
  readonly data_scope_ref: string;
  readonly secret_binding_set_ref: string;
  readonly payment_binding_ref: string;
  readonly callback_binding_ref: string;
  readonly runtime_config_ref: string;
}

export interface SovereignUpgradeResult {
  readonly business_number: string;
  readonly upgrade_id: string;
  readonly idempotency_key: string;
  readonly request_hash: string;
  readonly node_id: string;
  readonly membership_id: string;
  readonly principal_id: string;
  readonly mall_id: string;
  readonly operating_entity_id: string;
  readonly realm_id: string;
  readonly line_id: string;
  readonly signed_level: SignedLevel;
  readonly parent_node_id: string | null;
  readonly original_parent_node_id: string | null;
  readonly previous_host_sovereign_node_id: string;
  readonly host_sovereign_node_id: string;
  readonly source_tier: 'hosted';
  readonly target_tier: 'sovereign';
  readonly node_profile: 'operating_mall';
  readonly status: SovereignUpgradeStatus;
  readonly previous_relation_version: number;
  readonly active_relation_version: number;
  readonly sovereignty_version: number;
  readonly domain_binding_set_version: number;
  readonly resource_binding_version: number;
  readonly manifest_version: number;
  readonly manifest_digest: ManifestDigest;
  readonly manifest_summary: Readonly<Record<string, unknown>>;
  readonly recoverable: boolean;
  readonly upgraded_at: string;
  readonly replayed: boolean;
}

/** One server-resolved Realm account and its only active Membership for the current session/request. */
export interface ActiveRealmMembershipContext {
  readonly entry_realm_id: string;
  readonly current_realm_id: string;
  readonly account_id: string;
  readonly active_membership_id: string;
  readonly line_id: string;
  readonly node_id: string;
  readonly parent_node_id: string | null;
  readonly signed_level: SignedLevel;
  readonly sovereignty_tier: SovereigntyTier;
  readonly node_profile: NodeProfile;
  readonly mall_id: string | null;
  readonly host_sovereign_node_id: string;
  readonly relation_version: number;
  readonly effective_at: string;
  readonly access_version: number;
  readonly status: NodeLifecycleStatus;
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

export type NodeManifestDeclaration = Omit<NodeManifestSpec, 'release_pointer_ref'> & Readonly<{
  release_pointer_ref: VersionedRef;
}>;

export interface NodeManifestRegistryDeclaration {
  readonly registry_version: string;
  readonly generated_at: string;
  readonly manifests: readonly NodeManifestDeclaration[];
}

export interface NodeManifestReleaseEvidence {
  readonly source_sha: string;
  readonly build_id: string;
  readonly immutable_artifact_digest: ManifestDigest;
  readonly generated_at: string;
}

export interface ResolvedNodeContext extends NodeContext {
  readonly root_node_id: string;
  readonly ancestry: readonly string[];
  readonly level: number;
  readonly host: string;
  readonly surface: string;
  readonly host_binding: DomainBindingRef;
  readonly scope: VersionedRef;
  readonly realm: VersionedRef;
  readonly manifest_digest: ManifestDigest;
  readonly manifest: NodeManifest;
}

export interface NodeContextResolver {
  readonly registry: NodeManifestRegistry;
  resolve(host: string): ResolvedNodeContext;
}

type UnsignedNodeManifest = Omit<NodeManifest, 'manifest_digest'>;
type JsonRecord = Record<string, unknown>;

const NODE_CONTEXT_KEYS = ['line_id', 'node_id', 'parent_node_id', 'signed_level', 'node_profile', 'mall_id', 'host_node_id'] as const;
const NODE_RECORD_KEYS = ['line_id', 'node_id', 'sovereignty_tier', 'node_profile', 'realm_id', 'mall_id', 'status', 'created_at'] as const;
const NODE_RELATION_KEYS = [
  'line_id',
  'node_id',
  'parent_node_id',
  'original_parent_node_id',
  'signed_level',
  'host_sovereign_node_id',
  'relation_version',
  'effective_at',
  'superseded_at',
] as const;
const AUTHORITATIVE_NODE_CONTEXT_KEYS = [
  'line_id',
  'node_id',
  'parent_node_id',
  'signed_level',
  'sovereignty_tier',
  'node_profile',
  'realm_id',
  'mall_id',
  'host_sovereign_node_id',
  'relation_version',
  'effective_at',
  'status',
] as const;
const NODE_SCOPE_RECORD_KEYS = [
  'line_id',
  'node_id',
  'distance',
  'relation_version',
  'effective_at',
  'status',
] as const;
const NODE_TOPOLOGY_KEYS = ['schema_version', 'nodes', 'relations'] as const;
const HOSTED_NODE_PROVISIONING_REQUEST_KEYS = [
  'idempotency_key',
  'node_id',
  'parent_node_id',
  'realm_id',
  'node_profile',
  'mall_id',
  'signed_level',
  'effective_at',
  'requested_by',
  'trace_id',
] as const;
const HOSTED_NODE_PROVISIONING_RESULT_KEYS = [
  ...NODE_RECORD_KEYS,
  ...NODE_RELATION_KEYS.filter((key) => key !== 'line_id' && key !== 'node_id'),
  'idempotency_key',
  'request_hash',
  'requested_by',
  'trace_id',
  'replayed',
] as const;
const MEMBER_NODE_REGISTRATION_REQUEST_KEYS = [
  'registration_id',
  'business_number',
  'idempotency_key',
  'registration_origin',
  'registration_host_node_id',
  'invitation_token_hash',
  'business_identity_hash',
  'node_key',
  'realm_id',
  'membership_id',
  'requested_by',
  'trace_id',
] as const;
const MEMBER_NODE_REGISTRATION_RESULT_KEYS = [
  'outcome',
  'registration_id',
  'business_number',
  'registration_origin',
  'registration_host_node_id',
  'invitation_id',
  'inviter_node_id',
  'inviter_membership_id',
  'node_id',
  'line_id',
  'parent_node_id',
  'signed_level',
  'relation_version',
  'host_sovereign_node_id',
  'realm_id',
  'membership_id',
  'effective_at',
  'accepted_at',
  'idempotency_key',
  'request_hash',
  'created_at',
  'replayed',
] as const;
const HOSTED_MALL_OPENING_REQUEST_KEYS = [
  'idempotency_key',
  'mall_name',
  'operating_entity_name',
] as const;
const HOSTED_MALL_OPENING_RESULT_KEYS = [
  'opening_id',
  'business_number',
  'idempotency_key',
  'request_hash',
  'node_id',
  'membership_id',
  'principal_id',
  'mall_id',
  'operating_entity_id',
  'realm_id',
  'line_id',
  'signed_level',
  'parent_node_id',
  'original_parent_node_id',
  'host_sovereign_node_id',
  'sovereignty_tier',
  'node_profile',
  'capabilities',
  'capability_version',
  'relation_version',
  'mall_version',
  'entity_binding_version',
  'configuration_version',
  'payment_configuration_version',
  'status',
  'opened_at',
  'replayed',
] as const;
const SOVEREIGN_UPGRADE_REQUEST_KEYS = [
  'idempotency_key',
  'brand_ref',
  'public_api_host',
  'storefront_host',
  'accounts_host',
  'console_host',
  'payment_callback_host',
  'edge_binding_ref',
  'tunnel_ref',
  'gateway_ref',
  'runtime_identity_ref',
  'data_scope_ref',
  'secret_binding_set_ref',
  'payment_binding_ref',
  'callback_binding_ref',
  'runtime_config_ref',
] as const;
const SOVEREIGN_UPGRADE_RESULT_KEYS = [
  'business_number',
  'upgrade_id',
  'idempotency_key',
  'request_hash',
  'node_id',
  'membership_id',
  'principal_id',
  'mall_id',
  'operating_entity_id',
  'realm_id',
  'line_id',
  'signed_level',
  'parent_node_id',
  'original_parent_node_id',
  'previous_host_sovereign_node_id',
  'host_sovereign_node_id',
  'source_tier',
  'target_tier',
  'node_profile',
  'status',
  'previous_relation_version',
  'active_relation_version',
  'sovereignty_version',
  'domain_binding_set_version',
  'resource_binding_version',
  'manifest_version',
  'manifest_digest',
  'manifest_summary',
  'recoverable',
  'upgraded_at',
  'replayed',
] as const;
const ACTIVE_REALM_MEMBERSHIP_CONTEXT_KEYS = [
  'entry_realm_id',
  'current_realm_id',
  'account_id',
  'active_membership_id',
  'line_id',
  'node_id',
  'parent_node_id',
  'signed_level',
  'sovereignty_tier',
  'node_profile',
  'mall_id',
  'host_sovereign_node_id',
  'relation_version',
  'effective_at',
  'access_version',
  'status',
] as const;
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

export function classifySignedLevel(signedLevel: SignedLevel | string): SignedLevelSegment {
  const level = signedLevelNumber(signedLevel);
  if (level < 0) return 'supply_side';
  if (level <= 5) return 'member_l0_l5';
  return 'member_l6_l11';
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

export async function materializeNodeManifestRegistryDeclaration(
  declaration: NodeManifestRegistryDeclaration,
): Promise<NodeManifestRegistry> {
  const declarationDigest = await digestCanonicalJson(declaration);
  const sourceSha = declarationDigest.slice('sha256:'.length);
  return materializeNodeManifestRegistryRelease(declaration, {
    source_sha: sourceSha,
    build_id: `node-manifest-declaration:${sourceSha}`,
    immutable_artifact_digest: declarationDigest,
    generated_at: declaration.generated_at,
  });
}

export async function materializeNodeManifestRegistryRelease(
  declaration: NodeManifestRegistryDeclaration,
  evidence: NodeManifestReleaseEvidence,
): Promise<NodeManifestRegistry> {
  return generateNodeManifestRegistry({
    registry_version: declaration.registry_version,
    generated_at: evidence.generated_at,
    manifests: declaration.manifests.map((manifest) => ({
      ...manifest,
      generated_at: evidence.generated_at,
      release_pointer_ref: {
        ...manifest.release_pointer_ref,
        source_sha: evidence.source_sha,
        build_id: evidence.build_id,
        build_count: 1,
        immutable_artifact_digest: evidence.immutable_artifact_digest,
      },
    })),
  });
}

export function parseNodeContext(value: unknown): NodeContext {
  const record = exactRecord(value, NODE_CONTEXT_KEYS, 'SFL_NODE_CONTEXT_INVALID');
  return parseNodeContextFields(record);
}

export function parseNodeRecord(value: unknown): NodeRecord {
  const record = exactRecord(value, NODE_RECORD_KEYS, 'SFL_NODE_RECORD_INVALID');
  const sovereigntyTier = canonicalText(record.sovereignty_tier, 'sovereignty_tier');
  if (sovereigntyTier !== 'sovereign' && sovereigntyTier !== 'hosted') {
    throw new Error('SFL_SOVEREIGNTY_TIER_INVALID');
  }
  const nodeProfile = parseNodeProfile(record.node_profile);
  if (nodeProfile === null) throw new Error('SFL_NODE_PROFILE_INVALID');
  const node: NodeRecord = {
    line_id: canonicalText(record.line_id, 'line_id'),
    node_id: canonicalText(record.node_id, 'node_id'),
    sovereignty_tier: sovereigntyTier,
    node_profile: nodeProfile,
    realm_id: canonicalText(record.realm_id, 'realm_id'),
    mall_id: parseNullableText(record.mall_id, 'mall_id'),
    status: parseLifecycleStatus(record.status),
    created_at: parseCanonicalTimestamp(record.created_at),
  };
  if (node.sovereignty_tier === 'sovereign' && node.node_profile !== 'operating_mall') {
    throw new Error(`SFL_SOVEREIGN_NODE_PROFILE_INVALID:${node.node_id}`);
  }
  if (node.node_profile === 'consumer' && node.mall_id !== null) {
    throw new Error(`SFL_CONSUMER_NODE_MALL_INVALID:${node.node_id}`);
  }
  return Object.freeze(node);
}

export function parseNodeRelationRecord(value: unknown): NodeRelationRecord {
  const record = exactRecord(value, NODE_RELATION_KEYS, 'SFL_NODE_RELATION_INVALID');
  const relationVersion = record.relation_version;
  if (!Number.isSafeInteger(relationVersion) || (relationVersion as number) < 1) {
    throw new Error('SFL_NODE_RELATION_VERSION_INVALID');
  }
  const effectiveAt = parseCanonicalTimestamp(record.effective_at);
  const supersededAt = record.superseded_at === null ? null : parseCanonicalTimestamp(record.superseded_at);
  if (supersededAt !== null && supersededAt <= effectiveAt) {
    throw new Error('SFL_NODE_RELATION_PERIOD_INVALID');
  }
  return Object.freeze({
    line_id: canonicalText(record.line_id, 'line_id'),
    node_id: canonicalText(record.node_id, 'node_id'),
    parent_node_id: parseNullableText(record.parent_node_id, 'parent_node_id'),
    original_parent_node_id: parseNullableText(record.original_parent_node_id, 'original_parent_node_id'),
    signed_level: parseSignedLevel(record.signed_level),
    host_sovereign_node_id: canonicalText(record.host_sovereign_node_id, 'host_sovereign_node_id'),
    relation_version: relationVersion as number,
    effective_at: effectiveAt,
    superseded_at: supersededAt,
  });
}

export function parseAuthoritativeNodeContext(value: unknown): AuthoritativeNodeContext {
  const record = exactRecord(value, AUTHORITATIVE_NODE_CONTEXT_KEYS, 'SFL_AUTHORITATIVE_NODE_CONTEXT_INVALID');
  const node = parseNodeRecord({
    line_id: record.line_id,
    node_id: record.node_id,
    sovereignty_tier: record.sovereignty_tier,
    node_profile: record.node_profile,
    realm_id: record.realm_id,
    mall_id: record.mall_id,
    status: record.status,
    created_at: record.effective_at,
  });
  const relation = parseNodeRelationRecord({
    line_id: record.line_id,
    node_id: record.node_id,
    parent_node_id: record.parent_node_id,
    original_parent_node_id: record.parent_node_id,
    signed_level: record.signed_level,
    host_sovereign_node_id: record.host_sovereign_node_id,
    relation_version: record.relation_version,
    effective_at: record.effective_at,
    superseded_at: null,
  });
  return Object.freeze({
    line_id: node.line_id,
    node_id: node.node_id,
    parent_node_id: relation.parent_node_id,
    signed_level: relation.signed_level,
    sovereignty_tier: node.sovereignty_tier,
    node_profile: node.node_profile,
    realm_id: node.realm_id,
    mall_id: node.mall_id,
    host_sovereign_node_id: relation.host_sovereign_node_id,
    relation_version: relation.relation_version,
    effective_at: relation.effective_at,
    status: node.status,
  });
}

export function parseNodeScopeRecord(value: unknown): NodeScopeRecord {
  const record = exactRecord(value, NODE_SCOPE_RECORD_KEYS, 'SFL_NODE_SCOPE_RECORD_INVALID');
  if (!Number.isSafeInteger(record.distance) || (record.distance as number) < 0
    || !Number.isSafeInteger(record.relation_version) || (record.relation_version as number) < 1) {
    throw new Error('SFL_NODE_SCOPE_RECORD_INVALID');
  }
  return Object.freeze({
    line_id: canonicalText(record.line_id, 'line_id'),
    node_id: canonicalText(record.node_id, 'node_id'),
    distance: record.distance as number,
    relation_version: record.relation_version as number,
    effective_at: parseCanonicalTimestamp(record.effective_at),
    status: parseLifecycleStatus(record.status),
  });
}

export function parseSflNodeTopology(value: unknown): SflNodeTopology {
  const record = exactRecord(value, NODE_TOPOLOGY_KEYS, 'SFL_NODE_TOPOLOGY_INVALID');
  if (record.schema_version !== SFL_NODE_TOPOLOGY_SCHEMA_VERSION) {
    throw new Error('SFL_NODE_TOPOLOGY_SCHEMA_VERSION_INVALID');
  }
  const topology: SflNodeTopology = {
    schema_version: SFL_NODE_TOPOLOGY_SCHEMA_VERSION,
    nodes: requiredArray(record.nodes, 'nodes').map(parseNodeRecord).sort(compareNodes),
    relations: requiredArray(record.relations, 'relations').map(parseNodeRelationRecord).sort(compareNodeRelations),
  };
  validateSflNodeTopology(topology);
  return Object.freeze(topology);
}

export function parseHostedNodeProvisioningRequest(value: unknown): HostedNodeProvisioningRequest {
  const record = exactRecord(value, HOSTED_NODE_PROVISIONING_REQUEST_KEYS, 'SFL_HOSTED_NODE_PROVISIONING_REQUEST_INVALID');
  const nodeProfile = parseNodeProfile(record.node_profile);
  if (nodeProfile === null) throw new Error('SFL_NODE_PROFILE_INVALID');
  const mallId = parseNullableText(record.mall_id, 'mall_id');
  if ((nodeProfile === 'operating_mall') !== (mallId !== null)) {
    throw new Error('SFL_HOSTED_NODE_PROFILE_MALL_INVALID');
  }
  const signedLevel = parseSignedLevel(record.signed_level);
  const level = signedLevelNumber(signedLevel);
  if (level < 1) throw new Error('SFL_HOSTED_NODE_LEVEL_INVALID');
  if (level === 1) throw new Error('SFL_L1_REQUIRES_SOVEREIGN');
  const nodeId = canonicalText(record.node_id, 'node_id');
  const parentNodeId = canonicalText(record.parent_node_id, 'parent_node_id');
  if (nodeId === parentNodeId) throw new Error('SFL_HOSTED_NODE_PARENT_INVALID');
  return Object.freeze({
    idempotency_key: canonicalText(record.idempotency_key, 'idempotency_key'),
    node_id: nodeId,
    parent_node_id: parentNodeId,
    realm_id: canonicalText(record.realm_id, 'realm_id'),
    node_profile: nodeProfile,
    mall_id: mallId,
    signed_level: signedLevel,
    effective_at: parseCanonicalTimestamp(record.effective_at),
    requested_by: canonicalText(record.requested_by, 'requested_by'),
    trace_id: canonicalText(record.trace_id, 'trace_id'),
  });
}

export function parseHostedNodeProvisioningResult(value: unknown): HostedNodeProvisioningResult {
  const record = exactRecord(value, HOSTED_NODE_PROVISIONING_RESULT_KEYS, 'SFL_HOSTED_NODE_PROVISIONING_RESULT_INVALID');
  const node = parseNodeRecord(Object.fromEntries(NODE_RECORD_KEYS.map((key) => [key, record[key]])));
  const relation = parseNodeRelationRecord(Object.fromEntries(NODE_RELATION_KEYS.map((key) => [key, record[key]])));
  if (node.sovereignty_tier !== 'hosted' || relation.parent_node_id === null
    || relation.original_parent_node_id !== relation.parent_node_id || relation.relation_version !== 1) {
    throw new Error('SFL_HOSTED_NODE_PROVISIONING_RESULT_INVALID');
  }
  const requestHash = canonicalText(record.request_hash, 'request_hash');
  if (!/^[0-9a-f]{64}$/.test(requestHash) || typeof record.replayed !== 'boolean') {
    throw new Error('SFL_HOSTED_NODE_PROVISIONING_RESULT_INVALID');
  }
  return Object.freeze({
    ...node,
    ...relation,
    idempotency_key: canonicalText(record.idempotency_key, 'idempotency_key'),
    request_hash: requestHash,
    requested_by: canonicalText(record.requested_by, 'requested_by'),
    trace_id: canonicalText(record.trace_id, 'trace_id'),
    replayed: record.replayed,
  });
}

export function parseMemberNodeRegistrationRequest(value: unknown): MemberNodeRegistrationRequest {
  const record = exactRecord(value, MEMBER_NODE_REGISTRATION_REQUEST_KEYS, 'SFL_MEMBER_REGISTRATION_REQUEST_INVALID');
  const registrationOrigin = parseRegistrationOrigin(record.registration_origin);
  const invitationTokenHash = parseNullableText(record.invitation_token_hash, 'invitation_token_hash');
  if ((registrationOrigin === 'invitation') !== (invitationTokenHash !== null)) {
    throw new Error('SFL_MEMBER_REGISTRATION_INVITATION_INVALID');
  }
  const businessIdentityHash = canonicalText(record.business_identity_hash, 'business_identity_hash');
  if (!/^[0-9a-f]{64}$/.test(businessIdentityHash)
    || (invitationTokenHash !== null && !/^[0-9a-f]{64}$/.test(invitationTokenHash))) {
    throw new Error('SFL_MEMBER_REGISTRATION_HASH_INVALID');
  }
  const nodeKey = canonicalText(record.node_key, 'node_key');
  if (!/^[a-z0-9][a-z0-9-]{0,50}$/.test(nodeKey)) throw new Error('SFL_MEMBER_REGISTRATION_NODE_KEY_INVALID');
  return Object.freeze({
    registration_id: canonicalText(record.registration_id, 'registration_id'),
    business_number: canonicalText(record.business_number, 'business_number'),
    idempotency_key: canonicalText(record.idempotency_key, 'idempotency_key'),
    registration_origin: registrationOrigin,
    registration_host_node_id: canonicalText(record.registration_host_node_id, 'registration_host_node_id'),
    invitation_token_hash: invitationTokenHash,
    business_identity_hash: businessIdentityHash,
    node_key: nodeKey,
    realm_id: canonicalText(record.realm_id, 'realm_id'),
    membership_id: canonicalText(record.membership_id, 'membership_id'),
    requested_by: canonicalText(record.requested_by, 'requested_by'),
    trace_id: canonicalText(record.trace_id, 'trace_id'),
  });
}

export function parseMemberNodeRegistrationResult(value: unknown): MemberNodeRegistrationResult {
  const record = exactRecord(value, MEMBER_NODE_REGISTRATION_RESULT_KEYS, 'SFL_MEMBER_REGISTRATION_RESULT_INVALID');
  const outcome = record.outcome;
  if (outcome !== 'registered' && outcome !== 'level_boundary') throw new Error('SFL_MEMBER_REGISTRATION_OUTCOME_INVALID');
  const registrationOrigin = parseRegistrationOrigin(record.registration_origin);
  const invitationId = parseNullableText(record.invitation_id, 'invitation_id');
  const inviterNodeId = parseNullableText(record.inviter_node_id, 'inviter_node_id');
  const inviterMembershipId = parseNullableText(record.inviter_membership_id, 'inviter_membership_id');
  const nodeId = parseNullableText(record.node_id, 'node_id');
  const parentNodeId = parseNullableText(record.parent_node_id, 'parent_node_id');
  const membershipId = parseNullableText(record.membership_id, 'membership_id');
  const signedLevel = record.signed_level === null ? null : parseSignedLevel(record.signed_level);
  const relationVersion = record.relation_version === null ? null : Number(record.relation_version);
  if (relationVersion !== null && (!Number.isSafeInteger(relationVersion) || relationVersion < 1)) {
    throw new Error('SFL_MEMBER_REGISTRATION_RELATION_VERSION_INVALID');
  }
  const effectiveAt = record.effective_at === null ? null : parseCanonicalTimestamp(record.effective_at);
  const acceptedAt = record.accepted_at === null ? null : parseCanonicalTimestamp(record.accepted_at);
  const requestHash = canonicalText(record.request_hash, 'request_hash');
  if (!/^[0-9a-f]{64}$/.test(requestHash) || typeof record.replayed !== 'boolean') {
    throw new Error('SFL_MEMBER_REGISTRATION_RESULT_INVALID');
  }
  if (registrationOrigin === 'direct' && (invitationId !== null || inviterNodeId !== null || inviterMembershipId !== null)) {
    throw new Error('SFL_MEMBER_REGISTRATION_INVITER_INVALID');
  }
  if (registrationOrigin === 'invitation' && (invitationId === null || inviterNodeId === null || inviterMembershipId === null)) {
    throw new Error('SFL_MEMBER_REGISTRATION_INVITER_INVALID');
  }
  if (outcome === 'registered') {
    if (nodeId === null || parentNodeId === null || membershipId === null || signedLevel === null || relationVersion === null
      || effectiveAt === null || acceptedAt === null || (registrationOrigin === 'invitation' && inviterNodeId !== parentNodeId)) {
      throw new Error('SFL_MEMBER_REGISTRATION_RESULT_INVALID');
    }
  } else if (registrationOrigin !== 'invitation' || nodeId !== null || parentNodeId !== null || membershipId !== null
    || signedLevel !== null || relationVersion !== null || effectiveAt !== null || acceptedAt !== null) {
    throw new Error('SFL_MEMBER_REGISTRATION_BOUNDARY_INVALID');
  }
  return Object.freeze({
    outcome,
    registration_id: canonicalText(record.registration_id, 'registration_id'),
    business_number: canonicalText(record.business_number, 'business_number'),
    registration_origin: registrationOrigin,
    registration_host_node_id: canonicalText(record.registration_host_node_id, 'registration_host_node_id'),
    invitation_id: invitationId,
    inviter_node_id: inviterNodeId,
    inviter_membership_id: inviterMembershipId,
    node_id: nodeId,
    line_id: canonicalText(record.line_id, 'line_id'),
    parent_node_id: parentNodeId,
    signed_level: signedLevel,
    relation_version: relationVersion,
    host_sovereign_node_id: canonicalText(record.host_sovereign_node_id, 'host_sovereign_node_id'),
    realm_id: canonicalText(record.realm_id, 'realm_id'),
    membership_id: membershipId,
    effective_at: effectiveAt,
    accepted_at: acceptedAt,
    idempotency_key: canonicalText(record.idempotency_key, 'idempotency_key'),
    request_hash: requestHash,
    created_at: parseCanonicalTimestamp(record.created_at),
    replayed: record.replayed,
  });
}

export function parseHostedMallOpeningRequest(value: unknown): HostedMallOpeningRequest {
  const record = exactRecord(value, HOSTED_MALL_OPENING_REQUEST_KEYS, 'SFL_HOSTED_MALL_OPENING_REQUEST_INVALID');
  return Object.freeze({
    idempotency_key: canonicalText(record.idempotency_key, 'idempotency_key'),
    mall_name: canonicalText(record.mall_name, 'mall_name'),
    operating_entity_name: canonicalText(record.operating_entity_name, 'operating_entity_name'),
  });
}

export function parseHostedMallOpeningResult(value: unknown): HostedMallOpeningResult {
  const record = exactRecord(value, HOSTED_MALL_OPENING_RESULT_KEYS, 'SFL_HOSTED_MALL_OPENING_RESULT_INVALID');
  const requestHash = canonicalText(record.request_hash, 'request_hash');
  const capabilities = requiredArray(record.capabilities, 'capabilities').map(parseNodeProfile);
  const versions = [
    record.capability_version,
    record.relation_version,
    record.mall_version,
    record.entity_binding_version,
    record.configuration_version,
    record.payment_configuration_version,
  ].map(Number);
  if (!/^[0-9a-f]{64}$/.test(requestHash)
    || capabilities.some((profile) => profile === null)
    || !capabilities.includes('consumer')
    || !capabilities.includes('operating_mall')
    || versions.some((version) => !Number.isSafeInteger(version) || version < 1)
    || record.sovereignty_tier !== 'hosted'
    || record.node_profile !== 'operating_mall'
    || record.status !== 'active'
    || typeof record.replayed !== 'boolean') {
    throw new Error('SFL_HOSTED_MALL_OPENING_RESULT_INVALID');
  }
  return Object.freeze({
    opening_id: canonicalText(record.opening_id, 'opening_id'),
    business_number: canonicalText(record.business_number, 'business_number'),
    idempotency_key: canonicalText(record.idempotency_key, 'idempotency_key'),
    request_hash: requestHash,
    node_id: canonicalText(record.node_id, 'node_id'),
    membership_id: canonicalText(record.membership_id, 'membership_id'),
    principal_id: canonicalText(record.principal_id, 'principal_id'),
    mall_id: canonicalText(record.mall_id, 'mall_id'),
    operating_entity_id: canonicalText(record.operating_entity_id, 'operating_entity_id'),
    realm_id: canonicalText(record.realm_id, 'realm_id'),
    line_id: canonicalText(record.line_id, 'line_id'),
    signed_level: parseSignedLevel(record.signed_level),
    parent_node_id: parseNullableText(record.parent_node_id, 'parent_node_id'),
    original_parent_node_id: parseNullableText(record.original_parent_node_id, 'original_parent_node_id'),
    host_sovereign_node_id: canonicalText(record.host_sovereign_node_id, 'host_sovereign_node_id'),
    sovereignty_tier: 'hosted',
    node_profile: 'operating_mall',
    capabilities: Object.freeze(capabilities as NodeProfile[]),
    capability_version: versions[0]!,
    relation_version: versions[1]!,
    mall_version: versions[2]!,
    entity_binding_version: versions[3]!,
    configuration_version: versions[4]!,
    payment_configuration_version: versions[5]!,
    status: 'active',
    opened_at: parseCanonicalTimestamp(record.opened_at),
    replayed: record.replayed,
  });
}

export function parseSovereignUpgradeRequest(value: unknown): SovereignUpgradeRequest {
  const record = exactRecord(value, SOVEREIGN_UPGRADE_REQUEST_KEYS, 'SFL_SOVEREIGN_UPGRADE_REQUEST_INVALID');
  const hosts = [
    record.public_api_host,
    record.storefront_host,
    record.accounts_host,
    record.console_host,
    record.payment_callback_host,
  ].map((host, index) => sovereignUpgradeHost(host, SOVEREIGN_UPGRADE_REQUEST_KEYS[index + 2]!));
  if (new Set(hosts).size !== hosts.length) throw new Error('SFL_SOVEREIGN_UPGRADE_HOSTS_AMBIGUOUS');
  return Object.freeze({
    idempotency_key: canonicalText(record.idempotency_key, 'idempotency_key'),
    brand_ref: canonicalText(record.brand_ref, 'brand_ref'),
    public_api_host: hosts[0]!,
    storefront_host: hosts[1]!,
    accounts_host: hosts[2]!,
    console_host: hosts[3]!,
    payment_callback_host: hosts[4]!,
    edge_binding_ref: canonicalText(record.edge_binding_ref, 'edge_binding_ref'),
    tunnel_ref: canonicalText(record.tunnel_ref, 'tunnel_ref'),
    gateway_ref: canonicalText(record.gateway_ref, 'gateway_ref'),
    runtime_identity_ref: canonicalText(record.runtime_identity_ref, 'runtime_identity_ref'),
    data_scope_ref: canonicalText(record.data_scope_ref, 'data_scope_ref'),
    secret_binding_set_ref: canonicalText(record.secret_binding_set_ref, 'secret_binding_set_ref'),
    payment_binding_ref: canonicalText(record.payment_binding_ref, 'payment_binding_ref'),
    callback_binding_ref: canonicalText(record.callback_binding_ref, 'callback_binding_ref'),
    runtime_config_ref: canonicalText(record.runtime_config_ref, 'runtime_config_ref'),
  });
}

export function parseSovereignUpgradeResult(value: unknown): SovereignUpgradeResult {
  const record = exactRecord(value, SOVEREIGN_UPGRADE_RESULT_KEYS, 'SFL_SOVEREIGN_UPGRADE_RESULT_INVALID');
  const status = record.status;
  const statuses: readonly SovereignUpgradeStatus[] = [
    'planned', 'resources_ready', 'bindings_complete', 'upgraded', 'failed', 'rolled_back',
  ];
  const versions = [
    record.previous_relation_version,
    record.active_relation_version,
    record.sovereignty_version,
    record.domain_binding_set_version,
    record.resource_binding_version,
    record.manifest_version,
  ].map(Number);
  const requestHash = canonicalText(record.request_hash, 'request_hash');
  const manifestDigest = canonicalText(record.manifest_digest, 'manifest_digest');
  if (!statuses.includes(status as SovereignUpgradeStatus)
    || record.source_tier !== 'hosted'
    || record.target_tier !== 'sovereign'
    || record.node_profile !== 'operating_mall'
    || !/^[0-9a-f]{64}$/.test(requestHash)
    || !MANIFEST_DIGEST_PATTERN.test(manifestDigest)
    || versions.some((version) => !Number.isSafeInteger(version) || version < 1)
    || typeof record.recoverable !== 'boolean'
    || typeof record.replayed !== 'boolean') {
    throw new Error('SFL_SOVEREIGN_UPGRADE_RESULT_INVALID');
  }
  const manifestSummary = record.manifest_summary;
  if (!manifestSummary || typeof manifestSummary !== 'object' || Array.isArray(manifestSummary)) {
    throw new Error('SFL_SOVEREIGN_UPGRADE_MANIFEST_SUMMARY_INVALID');
  }
  return Object.freeze({
    business_number: canonicalText(record.business_number, 'business_number'),
    upgrade_id: canonicalText(record.upgrade_id, 'upgrade_id'),
    idempotency_key: canonicalText(record.idempotency_key, 'idempotency_key'),
    request_hash: requestHash,
    node_id: canonicalText(record.node_id, 'node_id'),
    membership_id: canonicalText(record.membership_id, 'membership_id'),
    principal_id: canonicalText(record.principal_id, 'principal_id'),
    mall_id: canonicalText(record.mall_id, 'mall_id'),
    operating_entity_id: canonicalText(record.operating_entity_id, 'operating_entity_id'),
    realm_id: canonicalText(record.realm_id, 'realm_id'),
    line_id: canonicalText(record.line_id, 'line_id'),
    signed_level: parseSignedLevel(record.signed_level),
    parent_node_id: parseNullableText(record.parent_node_id, 'parent_node_id'),
    original_parent_node_id: parseNullableText(record.original_parent_node_id, 'original_parent_node_id'),
    previous_host_sovereign_node_id: canonicalText(record.previous_host_sovereign_node_id, 'previous_host_sovereign_node_id'),
    host_sovereign_node_id: canonicalText(record.host_sovereign_node_id, 'host_sovereign_node_id'),
    source_tier: 'hosted',
    target_tier: 'sovereign',
    node_profile: 'operating_mall',
    status: status as SovereignUpgradeStatus,
    previous_relation_version: versions[0]!,
    active_relation_version: versions[1]!,
    sovereignty_version: versions[2]!,
    domain_binding_set_version: versions[3]!,
    resource_binding_version: versions[4]!,
    manifest_version: versions[5]!,
    manifest_digest: manifestDigest as ManifestDigest,
    manifest_summary: Object.freeze({ ...(manifestSummary as JsonRecord) }),
    recoverable: record.recoverable,
    upgraded_at: parseCanonicalTimestamp(record.upgraded_at),
    replayed: record.replayed,
  });
}

export function parseActiveRealmMembershipContext(value: unknown): ActiveRealmMembershipContext {
  const record = exactRecord(value, ACTIVE_REALM_MEMBERSHIP_CONTEXT_KEYS, 'SFL_ACTIVE_MEMBERSHIP_CONTEXT_INVALID');
  const relationVersion = Number(record.relation_version);
  const accessVersion = Number(record.access_version);
  const sovereigntyTier = canonicalText(record.sovereignty_tier, 'sovereignty_tier');
  const nodeProfile = parseNodeProfile(record.node_profile);
  if (!Number.isSafeInteger(relationVersion) || relationVersion < 1
    || !Number.isSafeInteger(accessVersion) || accessVersion < 1) {
    throw new Error('SFL_ACTIVE_MEMBERSHIP_CONTEXT_VERSION_INVALID');
  }
  if ((sovereigntyTier !== 'sovereign' && sovereigntyTier !== 'hosted') || nodeProfile === null) {
    throw new Error('SFL_ACTIVE_MEMBERSHIP_CONTEXT_NODE_INVALID');
  }
  return Object.freeze({
    entry_realm_id: canonicalText(record.entry_realm_id, 'entry_realm_id'),
    current_realm_id: canonicalText(record.current_realm_id, 'current_realm_id'),
    account_id: canonicalText(record.account_id, 'account_id'),
    active_membership_id: canonicalText(record.active_membership_id, 'active_membership_id'),
    line_id: canonicalText(record.line_id, 'line_id'),
    node_id: canonicalText(record.node_id, 'node_id'),
    parent_node_id: parseNullableText(record.parent_node_id, 'parent_node_id'),
    signed_level: parseSignedLevel(record.signed_level),
    sovereignty_tier: sovereigntyTier,
    node_profile: nodeProfile,
    mall_id: parseNullableText(record.mall_id, 'mall_id'),
    host_sovereign_node_id: canonicalText(record.host_sovereign_node_id, 'host_sovereign_node_id'),
    relation_version: relationVersion,
    effective_at: parseCanonicalTimestamp(record.effective_at),
    access_version: accessVersion,
    status: parseLifecycleStatus(record.status),
  });
}

function parseRegistrationOrigin(value: unknown): MemberNodeRegistrationOrigin {
  if (value !== 'direct' && value !== 'invitation') throw new Error('SFL_MEMBER_REGISTRATION_ORIGIN_INVALID');
  return value;
}

export function resolveNodeRecord(topology: SflNodeTopology, nodeId: string, at: string): ResolvedNodeRecord {
  const parsed = parseSflNodeTopology(topology);
  const node = parsed.nodes.find((candidate) => candidate.node_id === nodeId);
  if (node === undefined) throw new Error(`SFL_NODE_UNKNOWN:${nodeId}`);
  const instant = parseCanonicalTimestamp(at);
  const matches = parsed.relations.filter((relation) => relation.node_id === nodeId
    && relation.effective_at <= instant
    && (relation.superseded_at === null || instant < relation.superseded_at));
  if (matches.length !== 1) throw new Error(`SFL_NODE_RELATION_NOT_UNIQUE:${nodeId}:${instant}`);
  return Object.freeze({ ...node, ...matches[0]! });
}

export function validateNodeManifestOwnership(topology: SflNodeTopology, registry: NodeManifestRegistry): void {
  const parsed = parseSflNodeTopology(topology);
  const nodes = new Map(parsed.nodes.map((node) => [node.node_id, node]));
  const manifests = new Set(registry.manifests.map((manifest) => manifest.node_id));
  for (const manifest of registry.manifests) {
    const node = nodes.get(manifest.node_id);
    if (node === undefined || node.sovereignty_tier !== 'sovereign') {
      throw new Error(`SFL_NODE_MANIFEST_NON_SOVEREIGN:${manifest.node_id}`);
    }
  }
  for (const node of parsed.nodes) {
    if (node.sovereignty_tier === 'sovereign' && !manifests.has(node.node_id)) {
      throw new Error(`SFL_SOVEREIGN_NODE_MANIFEST_MISSING:${node.node_id}`);
    }
    if (node.sovereignty_tier === 'hosted' && manifests.has(node.node_id)) {
      throw new Error(`SFL_HOSTED_NODE_MANIFEST_FORBIDDEN:${node.node_id}`);
    }
  }
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

export function resolveNodeContextByHost(registry: NodeManifestRegistry, host: string): ResolvedNodeContext {
  const manifest = resolveNodeManifestByHost(registry, host);
  const hostBinding = resolveNodeDomainBindingByHost(manifest, host);
  const hierarchy = resolveNodeHierarchy(registry, manifest.node_id);
  return Object.freeze({
    line_id: manifest.line_id,
    node_id: manifest.node_id,
    parent_node_id: manifest.parent_node_id,
    signed_level: manifest.signed_level,
    node_profile: manifest.node_profile,
    mall_id: manifest.mall_id,
    host_node_id: manifest.host_node_id,
    ...hierarchy,
    host: hostBinding.host,
    surface: hostBinding.surface_ref,
    host_binding: hostBinding,
    scope: manifest.data_scope_ref,
    realm: manifest.realm_ref,
    manifest_digest: manifest.manifest_digest,
    manifest,
  });
}

export function resolveNodeHierarchy(
  registry: NodeManifestRegistry,
  nodeId: string,
): Readonly<{ root_node_id: string; ancestry: readonly string[]; level: number }> {
  const manifestsByNode = new Map(registry.manifests.map((manifest) => [manifest.node_id, manifest]));
  const target = manifestsByNode.get(nodeId);
  if (target === undefined) throw new Error(`SFL_NODE_MANIFEST_NODE_UNKNOWN:${nodeId}`);
  const ancestry = [target.node_id];
  let cursor = target;
  while (cursor.parent_node_id !== null) {
    const parent = manifestsByNode.get(cursor.parent_node_id);
    if (parent === undefined) throw new Error(`SFL_NODE_MANIFEST_PARENT_UNKNOWN:${cursor.node_id}`);
    ancestry.unshift(parent.node_id);
    cursor = parent;
  }
  return Object.freeze({
    root_node_id: ancestry[0]!,
    ancestry: Object.freeze(ancestry),
    level: signedLevelNumber(target.signed_level),
  });
}

export function createNodeContextResolver(registry: NodeManifestRegistry): NodeContextResolver {
  return Object.freeze({
    registry,
    resolve: (host: string) => resolveNodeContextByHost(registry, host),
  });
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
  if (context.node_profile !== 'operating_mall' || context.mall_id === null || context.host_node_id !== null) {
    throw new Error('SFL_SOVEREIGN_MANIFEST_CONTEXT_INVALID');
  }
  if (context.signed_level === 'L0' ? context.parent_node_id !== null : context.parent_node_id === null) {
    throw new Error('SFL_SOVEREIGN_MANIFEST_PARENT_INVALID');
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
    if (level === 0) {
      if (lineRoots.has(manifest.line_id)) {
        throw new Error(`SFL_NODE_MANIFEST_LINE_ROOT_AMBIGUOUS:${manifest.line_id}`);
      }
      lineRoots.add(manifest.line_id);
      continue;
    }
    const parent = manifestsByNode.get(manifest.parent_node_id!);
    if (parent !== undefined && (parent.line_id !== manifest.line_id || signedLevelNumber(parent.signed_level) >= level)) {
      throw new Error(`SFL_SOVEREIGN_MANIFEST_PARENT_INVALID:${manifest.node_id}`);
    }
  }
}

function validateSflNodeTopology(topology: SflNodeTopology): void {
  assertRegistryIdentifierUnique(topology.nodes.map((node) => node.node_id), 'node_id');
  assertRegistryIdentifierUnique(topology.nodes.map((node) => node.realm_id), 'realm_id');
  const nodes = new Map(topology.nodes.map((node) => [node.node_id, node]));
  const grouped = new Map<string, NodeRelationRecord[]>();
  for (const relation of topology.relations) {
    const node = nodes.get(relation.node_id);
    if (node === undefined || node.line_id !== relation.line_id) {
      throw new Error(`SFL_NODE_RELATION_NODE_INVALID:${relation.node_id}`);
    }
    for (const reference of [relation.parent_node_id, relation.original_parent_node_id]) {
      if (reference !== null && nodes.get(reference)?.line_id !== relation.line_id) {
        throw new Error(`SFL_NODE_RELATION_PARENT_INVALID:${relation.node_id}`);
      }
    }
    const host = nodes.get(relation.host_sovereign_node_id);
    if (host === undefined || host.line_id !== relation.line_id || host.sovereignty_tier !== 'sovereign') {
      throw new Error(`SFL_NODE_RELATION_HOST_INVALID:${relation.node_id}`);
    }
    if (node.sovereignty_tier === 'sovereign'
      ? relation.host_sovereign_node_id !== node.node_id
      : relation.host_sovereign_node_id === node.node_id) {
      throw new Error(`SFL_NODE_RELATION_SOVEREIGNTY_INVALID:${relation.node_id}`);
    }
    const level = signedLevelNumber(relation.signed_level);
    if (level === 0 ? relation.parent_node_id !== null : relation.parent_node_id === null) {
      throw new Error(`SFL_NODE_RELATION_PARENT_INVALID:${relation.node_id}`);
    }
    const key = `${relation.line_id}\u0000${relation.node_id}`;
    const history = grouped.get(key) ?? [];
    history.push(relation);
    grouped.set(key, history);
  }
  if (grouped.size !== topology.nodes.length) throw new Error('SFL_NODE_RELATION_MISSING');
  for (const history of grouped.values()) validateNodeRelationHistory(history, topology.relations);
}

function validateNodeRelationHistory(history: NodeRelationRecord[], relations: readonly NodeRelationRecord[]): void {
  history.sort(compareNodeRelations);
  const first = history[0]!;
  if (first.relation_version !== 1 || first.original_parent_node_id !== first.parent_node_id) {
    throw new Error(`SFL_NODE_RELATION_ORIGIN_INVALID:${first.node_id}`);
  }
  for (let index = 0; index < history.length; index += 1) {
    const relation = history[index]!;
    if (relation.relation_version !== index + 1 || relation.original_parent_node_id !== first.original_parent_node_id) {
      throw new Error(`SFL_NODE_RELATION_VERSION_SEQUENCE_INVALID:${relation.node_id}`);
    }
    const next = history[index + 1];
    if (next !== undefined && (relation.superseded_at === null || relation.superseded_at > next.effective_at)) {
      throw new Error(`SFL_NODE_RELATION_PERIOD_OVERLAP:${relation.node_id}`);
    }
    const level = signedLevelNumber(relation.signed_level);
    if (level <= 0) continue;
    const parent = relations.find((candidate) => candidate.node_id === relation.parent_node_id
      && candidate.line_id === relation.line_id
      && candidate.effective_at <= relation.effective_at
      && (candidate.superseded_at === null || relation.effective_at < candidate.superseded_at));
    if (parent === undefined) throw new Error(`SFL_NODE_RELATION_PARENT_INACTIVE:${relation.node_id}`);
    const parentLevel = signedLevelNumber(parent.signed_level);
    if (parentLevel !== level - 1) {
      throw new Error(`SFL_NODE_RELATION_LEVEL_INVALID:${relation.node_id}`);
    }
  }
}

function compareNodes(left: NodeRecord, right: NodeRecord): number {
  return compareText(left.line_id, right.line_id) || compareText(left.node_id, right.node_id);
}

function compareNodeRelations(left: NodeRelationRecord, right: NodeRelationRecord): number {
  return compareText(left.line_id, right.line_id)
    || compareText(left.node_id, right.node_id)
    || left.relation_version - right.relation_version;
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

function sovereignUpgradeHost(value: unknown, field: string): string {
  const host = canonicalText(value, field).toLowerCase();
  if (host.length > 253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) {
    throw new Error(`SFL_SOVEREIGN_UPGRADE_HOST_INVALID:${field}`);
  }
  return host;
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
