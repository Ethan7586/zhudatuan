import { describe, expect, it } from 'vitest';
import { projectBenefitLedger } from '../infrastructure/persistence/BenefitLedgerProjection';

describe('benefit ledger projection', () => {
  it('projects the finance entry through the public benefit contract without leaking its internal account id', () => {
    const projected = projectBenefitLedger(
      [
        {
          id: 'entry:one',
          accountId: 'finance:one',
          amountMinor: 100,
          referenceType: 'benefit.grant',
          referenceId: 'grant:one',
          description: '福利发放',
          occurredAt: '2026-09-06T00:00:00.000Z',
        },
      ],
      [{ id: 'benefit:one', kind: 'welfare', currency: 'CNY', financeAccountId: 'finance:one' }]
    );

    expect(projected).toEqual([
      {
        id: 'entry:one',
        account: 'benefit:one',
        kind: 'welfare',
        currency: 'CNY',
        amountMinor: 100,
        referenceType: 'benefit.grant',
        referenceId: 'grant:one',
        description: '福利发放',
        occurredAt: '2026-09-06T00:00:00.000Z',
      },
    ]);
    expect(projected[0]).not.toHaveProperty('accountId');
    expect(Object.isFrozen(projected)).toBe(true);
    expect(Object.isFrozen(projected[0])).toBe(true);
  });

  it('fails closed when a finance account cannot be mapped to the signed-in member', () => {
    expect(() =>
      projectBenefitLedger(
        [{ id: 'entry:one', accountId: 'finance:other', amountMinor: 100, referenceType: 'benefit.grant', referenceId: 'grant:one', description: '福利发放', occurredAt: '2026-09-06T00:00:00.000Z' }],
        [{ id: 'benefit:one', kind: 'welfare', currency: 'CNY', financeAccountId: 'finance:one' }]
      )
    ).toThrow('BENEFIT_LEDGER_ACCOUNT_MISSING');
  });
});
