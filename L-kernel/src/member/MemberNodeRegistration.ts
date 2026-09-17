import { canonicalText, exactRecord, parseCanonicalTimestamp, parseNullableText, parseSignedLevel } from '../node/NodeParsing.ts';
import type { SignedLevel } from '../node/SignedLevel.ts';

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

function parseRegistrationOrigin(value: unknown): MemberNodeRegistrationOrigin {
  if (value !== 'direct' && value !== 'invitation') throw new Error('SFL_MEMBER_REGISTRATION_ORIGIN_INVALID');
  return value;
}
