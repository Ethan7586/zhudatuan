import { signedLevelNumber, type SignedLevel } from './SignedLevel.ts';
import {
  canonicalText, exactRecord, parseCanonicalTimestamp, parseNodeProfile, parseNullableText,
  parseSignedLevel, type NodeProfile,
} from './NodeParsing.ts';
import {
  NODE_RECORD_KEYS, NODE_RELATION_KEYS, parseNodeRecord, parseNodeRelationRecord,
  type ResolvedNodeRecord,
} from './NodeTopology.ts';

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
