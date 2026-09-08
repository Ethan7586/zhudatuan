import { describe, expect, it } from 'vitest';
import { Evidence } from './Evidence';
import { QualificationCase, type QualificationCaseSnapshot } from './QualificationCase';

describe('QualificationCase', () => {
  it('publishes only reviewed, nonexpired cases whose immutable evidence is verified', () => {
    const verified = QualificationCase.restore(snapshot());
    expect(verified.publish('2026-09-05T00:00:00.000Z').snapshot()).toMatchObject({ state: 'published', version: 1, publishedAt: '2026-09-05T00:00:00.000Z' });

    const unverified = QualificationCase.restore(
      snapshot({
        evidence: [{ ...snapshot().evidence[0]!, state: 'submitted', verifiedAt: null, verifiedBy: null }],
      })
    );
    expect(() => unverified.publish('2026-09-05T00:00:00.000Z')).toThrow('VALIDATION_FAILED');
    expect(() => verified.publish('2026-10-01T00:00:00.000Z')).toThrow('VALIDATION_FAILED');
  });

  it('rejects an object reference, digest or scan result that differs from the reviewed material', () => {
    const input = { id: 'evidence:one', kind: 'license' as const, reference: 'object:license-one', sha256: 'a'.repeat(64), actor: 'principal:reviewer', now: '2026-09-05T00:00:00.000Z' };
    const metadata = {
      reference: input.reference,
      sha256: input.sha256,
      size: 128,
      scan: 'clean' as const,
      contentType: 'application/pdf',
      path: 'qualification/license-one.pdf',
      retentionUntil: '2036-09-05T00:00:00.000Z',
      lockedUntil: null,
    };
    expect(Evidence.verified(input, metadata).state).toBe('verified');
    expect(() => Evidence.verified(input, { ...metadata, sha256: 'b'.repeat(64) })).toThrow('VALIDATION_FAILED');
    expect(() => Evidence.verified(input, { ...metadata, reference: 'object:replaced' })).toThrow('VALIDATION_FAILED');
    expect(() => Evidence.verified(input, { ...metadata, retentionUntil: null })).toThrow('VALIDATION_FAILED');
  });

  it('makes revocation terminal and expires only the scheduled published version', () => {
    const published = QualificationCase.restore(snapshot()).publish('2026-09-05T00:00:00.000Z');
    const revoked = published.revoke('principal:reviewer', '证照已被监管机构撤销', '2026-09-06T00:00:00.000Z');
    expect(revoked.snapshot()).toMatchObject({ state: 'revoked', version: 2, revokedBy: 'principal:reviewer' });
    expect(() => revoked.revoke('principal:reviewer', '再次撤销', '2026-09-07T00:00:00.000Z')).toThrow('VALIDATION_FAILED');
    expect(revoked.expire('2026-10-01T00:00:00.000Z')).toBeNull();
    expect(published.expire('2026-09-29T23:59:59.999Z')).toBeNull();
    expect(published.expire('2026-09-30T00:00:00.000Z')?.snapshot()).toMatchObject({ state: 'expired', version: 2 });
  });
});

function snapshot(overrides: Partial<QualificationCaseSnapshot> = {}): QualificationCaseSnapshot {
  return {
    id: 'qualification:one',
    scope: 'mall:one',
    title: '食品经营许可证',
    subject: { kind: 'partner', id: 'partner:one' },
    applicability: [{ kind: 'category', id: 'category:food' }],
    state: 'verified',
    version: 0,
    effectiveAt: '2026-09-01T00:00:00.000Z',
    expiresAt: '2026-09-30T00:00:00.000Z',
    evidence: [{ id: 'evidence:one', kind: 'license', reference: 'object:license-one', sha256: 'a'.repeat(64), state: 'verified', verifiedAt: '2026-09-04T00:00:00.000Z', verifiedBy: 'principal:reviewer' }],
    reviewedAt: '2026-09-04T00:00:00.000Z',
    reviewedBy: 'principal:reviewer',
    publishedAt: null,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    ...overrides,
  };
}
