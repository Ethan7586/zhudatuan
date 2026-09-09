import { describe, expect, it, vi } from 'vitest';
import { withWriteTransaction } from '../../../../test/TransactionFixture';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { PgChallengeRepository } from './PgChallengeRepository';

describe('PgChallengeRepository member-code assurance', () => {
  it('rejects issuing a member code when the canonical profile has no verified mobile', async () => {
    const database = vi.fn(async () => {
      throw new Error('DATABASE_WRITE_MUST_NOT_RUN');
    });
    const repository = new PgChallengeRepository(
      new PgTransactionAccess(),
      { profile: vi.fn(async () => accessMember()) } as never,
      { summary: vi.fn(async () => ({ id: 'member:one', displayName: '测试员工', employeeNo: 'E1001', mobileMasked: null, status: 'active', version: 2 })) } as never,
      {} as never,
      {} as never,
      { require: vi.fn() } as never
    );

    await expect(
      withWriteTransaction(database, (context) =>
        repository.issue(context, {
          id: 'verification:test',
          scope: 'mall:one',
          membership: 'membership:one',
          purpose: 'member_code',
          voucher: null,
          tokenHash: 'a'.repeat(64),
          now: new Date('2026-09-10T00:00:00.000Z'),
        })
      )
    ).rejects.toThrow('VERIFICATION_MOBILE_REQUIRED');
    expect(database).not.toHaveBeenCalled();
  });
});

function accessMember() {
  return Object.freeze({
    id: 'membership:one',
    member: 'member:one',
    organization: 'mall:one',
    employee: 'E1001',
    status: 'active',
    accessversion: 3,
    joinedat: new Date('2026-01-01T00:00:00.000Z'),
    registrationresetallowed: false,
    registrationresetblockreason: 'protected' as const,
  });
}
