import { describe, expect, it } from 'vitest';
import { invitationCandidates } from './InvitationCandidate';
import type { InvitationMembership } from './Invitation';

const issuerPermissions = ['access.role.delegate', 'access.scope.delegate', 'order.read'];

describe('invitationCandidates', () => {
  it('keeps only active, verifiable members whose existing access can be delegated', () => {
    const allowed = membership('allowed', 'custom', ['order.read']);
    expect(
      invitationCandidates(
        [allowed, membership('actor', 'system'), membership('owner', 'owner'), membership('blocked', 'custom', ['access.ownership.transfer']), { ...membership('nophone', 'system'), mobileMasked: null }],
        'actor',
        issuerPermissions
      )
    ).toEqual([allowed]);
  });

  it('returns no candidates when the issuer cannot delegate roles and scopes', () => {
    expect(invitationCandidates([membership('allowed', 'system')], 'actor', ['order.read'])).toEqual([]);
  });
});

function membership(id: string, kind: InvitationMembership['roles'][number]['kind'], allows: readonly string[] = []): InvitationMembership {
  return {
    id,
    displayName: id,
    employeeNo: null,
    mobileMasked: '138****8000',
    client: 'console',
    status: 'active',
    roles: [{ id: `role:${id}`, kind, allows, denies: [] }],
  };
}
