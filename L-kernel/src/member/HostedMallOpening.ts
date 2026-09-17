import type { SignedLevel } from '../node/SignedLevel';
import {
  canonicalText, exactRecord, parseCanonicalTimestamp, parseNodeProfile, parseNullableText,
  parseSignedLevel, requiredArray, type NodeProfile,
} from '../node/NodeParsing';

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

const HOSTED_MALL_OPENING_REQUEST_KEYS = ['idempotency_key', 'mall_name', 'operating_entity_name'] as const;
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
