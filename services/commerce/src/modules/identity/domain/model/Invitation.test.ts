import { describe, expect, it } from 'vitest';
import { Invitation } from './Invitation';

const NOW = new Date('2026-08-30T00:00:00.000Z');

describe('Invitation', () => {
  it('owns activation, reservation, consumption and exhaustion transitions', () => {
    const draft = invitation('draft', 0, 1);
    const active = draft.activate(NOW);
    active.reserve(NOW, 0);
    const exhausted = active.consume(NOW);
    expect(exhausted.state).toMatchObject({ status: 'exhausted', useCount: 1, version: 2 });
    expect(() => exhausted.assertRedeemable(NOW, 'storefront')).toThrow('INVITATION_INVALID');
  });

  it('derives expiry without treating an expired active row as redeemable', () => {
    const active = invitation('active', 0, 1);
    expect(active.deriveValidity(new Date('2026-09-01T00:00:00.000Z'))).toBe('expired');
    expect(active.expire(new Date('2026-09-01T00:00:00.000Z')).state).toMatchObject({ status: 'expired', version: 2 });
  });
});

function invitation(status: 'draft' | 'active', uses: number, version: number): Invitation {
  return new Invitation(
    Object.freeze({
      id: 'invitation:one',
      kind: 'signin',
      target: 'storefront',
      organization: 'mall:one',
      membership: 'membership:one',
      principal: 'principal:one',
      recipientHash: null,
      keyVersion: 'current',
      issuer: 'membership:issuer',
      issuerAccessVersion: 4,
      grantDigest: 'a'.repeat(64),
      assurance: 1 as const,
      maxUses: 1,
      useCount: uses,
      notBefore: NOW,
      expiresAt: new Date('2026-08-31T00:00:00.000Z'),
      status,
      policy: null,
      termsHash: null,
      reason: 'member sign in',
      version,
    })
  );
}
