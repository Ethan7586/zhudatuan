import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const NODE_MANIFEST_SCHEMA_VERSION = 'sfl.node-manifest/v1' as const;

export const SIGNED_NODE_LEVELS = Object.freeze([
  'L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10', 'L11',
] as const);
export type SignedNodeLevel = (typeof SIGNED_NODE_LEVELS)[number];
export type NodeManifestLifecycle = 'draft' | 'active' | 'retired';
export type NodeSurface = 'storefront' | 'console' | 'identity' | 'api';
export type NodeProfile = 'operating_mall' | 'consumer';

export interface NodeDomainBinding {
  readonly surface: NodeSurface;
  readonly origin: string;
}

export interface NodeManifest {
  readonly schema_version: typeof NODE_MANIFEST_SCHEMA_VERSION;
  readonly manifest_id: string;
  readonly manifest_version: string;
  readonly manifest_digest: string;
  readonly generated_at: string;
  readonly lifecycle_status: NodeManifestLifecycle;
  readonly line_id: string;
  readonly node_id: string;
  readonly parent_node_id: string | null;
  readonly signed_level: SignedNodeLevel;
  readonly node_profile: NodeProfile;
  readonly domain_bindings: readonly NodeDomainBinding[];
  readonly brand_ref: string;
  readonly applications: readonly string[];
  readonly surfaces: readonly NodeSurface[];
  readonly enabled_features: readonly string[];
  readonly api_contract_refs: readonly string[];
  readonly realm_ref: string;
  readonly data_scope_ref: string;
  readonly secret_binding_set_ref: string;
  readonly payment_binding_refs: readonly string[];
  readonly callback_binding_refs: readonly string[];
  readonly runtime_instance_id: string;
  readonly runtime_config_ref: string;
  readonly resource_binding_version: string;
  readonly release_pointer_ref: string;
}

export interface NodeManifestRuntimeExpectation {
  readonly manifestId: string;
  readonly manifestDigest: string;
  readonly runtimeInstanceId: string;
  readonly runtimeConfigRef: string;
  readonly resourceBindingVersion: string;
  readonly releasePointerRef: string;
}

export async function loadNodeManifest(
  path: string,
  expectation?: NodeManifestRuntimeExpectation,
): Promise<NodeManifest> {
  const manifest = parseNodeManifest(JSON.parse(await readFile(path, 'utf8')));
  if (expectation) assertNodeManifestRuntime(manifest, expectation);
  return manifest;
}

export function parseNodeManifest(input: unknown): NodeManifest {
  const value = record(input, 'NODE_MANIFEST_INVALID');
  if (value.schema_version !== NODE_MANIFEST_SCHEMA_VERSION) throw new Error('NODE_MANIFEST_SCHEMA_VERSION_INVALID');
  const manifest: NodeManifest = Object.freeze({
    schema_version: NODE_MANIFEST_SCHEMA_VERSION,
    manifest_id: text(value.manifest_id, 'NODE_MANIFEST_ID_INVALID'),
    manifest_version: text(value.manifest_version, 'NODE_MANIFEST_VERSION_INVALID'),
    manifest_digest: digest(value.manifest_digest),
    generated_at: timestamp(value.generated_at),
    lifecycle_status: oneOf(value.lifecycle_status, ['draft', 'active', 'retired'], 'NODE_MANIFEST_LIFECYCLE_INVALID'),
    line_id: text(value.line_id, 'NODE_MANIFEST_LINE_ID_INVALID'),
    node_id: text(value.node_id, 'NODE_MANIFEST_NODE_ID_INVALID'),
    parent_node_id: nullableText(value.parent_node_id, 'NODE_MANIFEST_PARENT_NODE_ID_INVALID'),
    signed_level: oneOf(value.signed_level, SIGNED_NODE_LEVELS, 'NODE_MANIFEST_SIGNED_LEVEL_INVALID'),
    node_profile: oneOf(value.node_profile, ['operating_mall', 'consumer'], 'NODE_MANIFEST_NODE_PROFILE_INVALID'),
    domain_bindings: Object.freeze(nonEmptyArray(value.domain_bindings, 'NODE_MANIFEST_DOMAIN_BINDINGS_INVALID').map((item) => {
      const binding = record(item, 'NODE_MANIFEST_DOMAIN_BINDING_INVALID');
      return Object.freeze({
        surface: oneOf(binding.surface, ['storefront', 'console', 'identity', 'api'], 'NODE_MANIFEST_DOMAIN_SURFACE_INVALID'),
        origin: origin(binding.origin),
      });
    })),
    brand_ref: text(value.brand_ref, 'NODE_MANIFEST_BRAND_REF_INVALID'),
    applications: stringArray(value.applications, 'NODE_MANIFEST_APPLICATIONS_INVALID'),
    surfaces: Object.freeze(nonEmptyArray(value.surfaces, 'NODE_MANIFEST_SURFACES_INVALID')
      .map((item) => oneOf(item, ['storefront', 'console', 'identity', 'api'], 'NODE_MANIFEST_SURFACE_INVALID'))),
    enabled_features: stringArray(value.enabled_features, 'NODE_MANIFEST_FEATURES_INVALID'),
    api_contract_refs: stringArray(value.api_contract_refs, 'NODE_MANIFEST_API_CONTRACTS_INVALID'),
    realm_ref: text(value.realm_ref, 'NODE_MANIFEST_REALM_REF_INVALID'),
    data_scope_ref: text(value.data_scope_ref, 'NODE_MANIFEST_DATA_SCOPE_REF_INVALID'),
    secret_binding_set_ref: text(value.secret_binding_set_ref, 'NODE_MANIFEST_SECRET_BINDING_SET_REF_INVALID'),
    payment_binding_refs: stringArray(value.payment_binding_refs, 'NODE_MANIFEST_PAYMENT_BINDINGS_INVALID'),
    callback_binding_refs: stringArray(value.callback_binding_refs, 'NODE_MANIFEST_CALLBACK_BINDINGS_INVALID'),
    runtime_instance_id: text(value.runtime_instance_id, 'NODE_MANIFEST_RUNTIME_INSTANCE_ID_INVALID'),
    runtime_config_ref: text(value.runtime_config_ref, 'NODE_MANIFEST_RUNTIME_CONFIG_REF_INVALID'),
    resource_binding_version: text(value.resource_binding_version, 'NODE_MANIFEST_RESOURCE_BINDING_VERSION_INVALID'),
    release_pointer_ref: text(value.release_pointer_ref, 'NODE_MANIFEST_RELEASE_POINTER_REF_INVALID'),
  });
  if (manifest.parent_node_id === manifest.node_id) throw new Error('NODE_MANIFEST_PARENT_SELF_REFERENCE');
  const level = Number(manifest.signed_level.slice(1));
  if ((level <= 5) !== (manifest.node_profile === 'operating_mall')) throw new Error('NODE_MANIFEST_PROFILE_LEVEL_MISMATCH');
  if (manifest.node_profile === 'consumer' && manifest.surfaces.includes('console')) {
    throw new Error('NODE_MANIFEST_CONSUMER_CONSOLE_FORBIDDEN');
  }
  if (new Set(manifest.domain_bindings.map(({ origin: value }) => value)).size !== manifest.domain_bindings.length) {
    throw new Error('NODE_MANIFEST_DOMAIN_ORIGIN_DUPLICATE');
  }
  if (new Set(manifest.surfaces).size !== manifest.surfaces.length
    || manifest.domain_bindings.some(({ surface }) => !manifest.surfaces.includes(surface))) {
    throw new Error('NODE_MANIFEST_SURFACES_MISMATCH');
  }
  if (nodeManifestDigest(manifest) !== manifest.manifest_digest) throw new Error('NODE_MANIFEST_DIGEST_MISMATCH');
  return manifest;
}

export function nodeManifestDigest(manifest: Omit<NodeManifest, 'manifest_digest'> | NodeManifest): string {
  const { manifest_digest: _ignored, ...payload } = manifest as NodeManifest;
  return `sha256:${createHash('sha256').update(canonicalJson(payload)).digest('hex')}`;
}

export function assertNodeManifestRuntime(
  manifest: NodeManifest,
  expectation: NodeManifestRuntimeExpectation,
): void {
  const pairs = [
    [manifest.manifest_id, expectation.manifestId, 'NODE_MANIFEST_ID_MISMATCH'],
    [manifest.manifest_digest, expectation.manifestDigest, 'NODE_MANIFEST_DIGEST_MISMATCH'],
    [manifest.runtime_instance_id, expectation.runtimeInstanceId, 'NODE_MANIFEST_RUNTIME_INSTANCE_MISMATCH'],
    [manifest.runtime_config_ref, expectation.runtimeConfigRef, 'NODE_MANIFEST_RUNTIME_CONFIG_MISMATCH'],
    [manifest.resource_binding_version, expectation.resourceBindingVersion, 'NODE_MANIFEST_RESOURCE_BINDING_VERSION_MISMATCH'],
    [manifest.release_pointer_ref, expectation.releasePointerRef, 'NODE_MANIFEST_RELEASE_POINTER_MISMATCH'],
  ] as const;
  for (const [actual, expected, code] of pairs) if (actual !== expected) throw new Error(code);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function list(value: unknown, code: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

function nonEmptyArray(value: unknown, code: string): readonly unknown[] {
  const values = list(value, code);
  if (values.length === 0) throw new Error(code);
  return values;
}

function stringArray(value: unknown, code: string): readonly string[] {
  const values = Object.freeze(list(value, code).map((item) => text(item, code)));
  if (new Set(values).size !== values.length) throw new Error(code);
  return values;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

function nullableText(value: unknown, code: string): string | null {
  return value === null ? null : text(value, code);
}

function timestamp(value: unknown): string {
  const normalized = text(value, 'NODE_MANIFEST_GENERATED_AT_INVALID');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(normalized)
    || !Number.isFinite(Date.parse(normalized))) throw new Error('NODE_MANIFEST_GENERATED_AT_INVALID');
  return normalized;
}

function digest(value: unknown): string {
  const normalized = text(value, 'NODE_MANIFEST_DIGEST_INVALID');
  if (!/^sha256:[0-9a-f]{64}$/.test(normalized)) throw new Error('NODE_MANIFEST_DIGEST_INVALID');
  return normalized;
}

function origin(value: unknown): string {
  const normalized = text(value, 'NODE_MANIFEST_DOMAIN_ORIGIN_INVALID');
  let parsed: URL;
  try { parsed = new URL(normalized); } catch { throw new Error('NODE_MANIFEST_DOMAIN_ORIGIN_INVALID'); }
  if (parsed.protocol !== 'https:' || parsed.origin !== normalized) throw new Error('NODE_MANIFEST_DOMAIN_ORIGIN_INVALID');
  return normalized;
}

function oneOf<const T extends string>(value: unknown, values: readonly T[], code: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new Error(code);
  return value as T;
}
