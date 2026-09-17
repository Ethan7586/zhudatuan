import { describe, expect, it } from 'vitest';
import { parseMemberNodeRegistrationRequest, parseMemberNodeRegistrationResult } from './MemberNodeRegistration';

const request = {
  registration_id: 'registration:fixture', business_number: 'SFLREG-FIXTURE', idempotency_key: 'registration-key',
  registration_origin: 'invitation', registration_host_node_id: 'node:l0', invitation_token_hash: 'a'.repeat(64),
  business_identity_hash: 'b'.repeat(64), node_key: 'member-fixture', realm_id: 'realm:fixture',
  membership_id: 'membership:fixture', requested_by: 'principal:fixture', trace_id: 'trace:fixture',
} as const;

describe('original MB node registration rules', () => {
  it('preserves the command and its exact fields', () => {
    expect(parseMemberNodeRegistrationRequest(request)).toEqual(request);
    expect(() => parseMemberNodeRegistrationRequest({ ...request, signed_level: 'L11' }))
      .toThrow('SFL_MEMBER_REGISTRATION_REQUEST_INVALID');
    expect(() => parseMemberNodeRegistrationRequest({ ...request, registration_origin: 'direct' }))
      .toThrow('SFL_MEMBER_REGISTRATION_INVITATION_INVALID');
  });

  it('preserves the L11 boundary without inventing a new member node', () => {
    const result = parseMemberNodeRegistrationResult({
      outcome: 'level_boundary', registration_id: request.registration_id, business_number: request.business_number,
      registration_origin: request.registration_origin, registration_host_node_id: request.registration_host_node_id,
      invitation_id: 'invitation:fixture', inviter_node_id: 'node:l11', inviter_membership_id: 'membership:inviter',
      node_id: null, line_id: 'line:fixture', parent_node_id: null, signed_level: null, relation_version: null,
      host_sovereign_node_id: 'node:l0', realm_id: request.realm_id, membership_id: null,
      effective_at: null, accepted_at: null, idempotency_key: request.idempotency_key,
      request_hash: 'c'.repeat(64), created_at: '2026-09-17T00:00:00.000Z', replayed: false,
    });
    expect(result).toMatchObject({ outcome: 'level_boundary', node_id: null, signed_level: null });
  });
});
