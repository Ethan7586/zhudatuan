import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { OwnerActionProof } from '../03_application_yingyong/OwnerActionProof';

const now = new Date('2026-08-29T08:00:00.000Z');
const expected = Object.freeze({
  action: 'create' as const,
  actor: 'principal:owner',
  session: 'session:owner',
  sourceMembership: 'membership:owner',
  targetMembership: 'membership:successor',
  formerOwnerMode: 'retain_admin' as const,
  formerOwnerRole: 'role:administrator',
  formerOwnerRoleVersion: 3,
  ownershipVersion: 7,
  transferVersion: null,
  targetAccessVersion: 4,
  reasonHash: null,
});

describe('OwnerActionProof', () => {
  it('binds every ownership snapshot field and accepts the exact action once it is decoded', () => {
    const signer = new OwnerActionProof('session-key', () => now);
    const issued = signer.issue(expected);
    expect(signer.verify(issued.proof, expected)).toMatchObject(expected);
  });

  it('fails closed for a different target, tampering, missing proof, and expiry', () => {
    const signer = new OwnerActionProof('session-key', () => now);
    const issued = signer.issue({ ...expected, ttlMilliseconds: 1_000 });
    expect(() => signer.verify(issued.proof, { ...expected, targetMembership: 'membership:other' })).toThrow('ACTION_PROOF_INVALID');
    expect(() => signer.verify(`${issued.proof}x`, expected)).toThrow('ACTION_PROOF_INVALID');
    expect(() => signer.verify(undefined, expected)).toThrow('ACTION_PROOF_REQUIRED');
    const expired = new OwnerActionProof('session-key', () => new Date(now.getTime() + 1_001));
    expect(() => expired.verify(issued.proof, expected)).toThrow('ACTION_PROOF_EXPIRED');
  });

  it('domain-separates owner proofs from protocols that use the raw session secret', () => {
    const signer = new OwnerActionProof('session-key', () => now);
    const issued = signer.issue(expected);
    const [encoded] = issued.proof.split('.');
    const forgedWithRawSessionKey = `${encoded}.${createHmac('sha256', 'session-key').update(encoded!).digest('base64url')}`;
    expect(() => signer.verify(forgedWithRawSessionKey, expected)).toThrow('ACTION_PROOF_INVALID');
  });
});
