import { describe, expect, it, vi } from 'vitest';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';
import { PgVerificationPort } from '../infrastructure/persistence/PgVerificationPort';

describe('verification public proof boundary', () => {
  it('consumes a proof only for its exact purpose, operation, subject and scope', async () => {
    const query = vi.fn(async () => result([{ session_id: 'verification:one', expires_at: new Date('2026-09-05T00:05:00.000Z') }]));
    const port = new PgVerificationPort();
    const proof = 'a'.repeat(43);
    const receipt = await withWriteTransaction(query, (context) =>
      port.verify(context, {
        proof,
        scope: 'mall:one',
        subjectType: 'resource',
        subject: 'settlement:one',
        purpose: 'financial_approval',
        operation: 'finance.approvals.decide',
        actor: 'principal:one',
        now: new Date('2026-09-05T00:00:00.000Z'),
      })
    );
    expect(receipt).toEqual({ verification: 'verification:one', expiresAt: '2026-09-05T00:05:00.000Z' });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("state='active'"), expect.arrayContaining(['mall:one', 'resource', 'settlement:one', 'financial_approval', 'finance.approvals.decide']));
  });

  it('fails closed for purpose mismatch and proof replay', async () => {
    const port = new PgVerificationPort();
    expect(() => port.request({ purpose: 'financial_approval', operation: 'voucher.redemptions.create' })).toThrow('CHALLENGE_PURPOSE_INVALID');
    await expect(
      withWriteTransaction(
        async () => result([]),
        (context) => port.verify(context, { proof: 'a'.repeat(43), scope: 'mall:one', subjectType: 'resource', subject: 'settlement:one', purpose: 'financial_approval', operation: 'finance.approvals.decide', actor: 'principal:one' })
      )
    ).rejects.toThrow('PROOF_REQUIRED');
  });
});
