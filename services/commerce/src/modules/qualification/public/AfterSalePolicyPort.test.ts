import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { PgAfterSalePolicyPort } from './AfterSalePolicyPort';

describe('PgAfterSalePolicyPort', () => {
  it('combines published, provider and order-snapshot rules deterministically', async () => {
    const database = stub({ id: 'policy:1', version: 4, rule: { windowDays: 30, providers: { jd: { windowDays: 15 } } } });
    const decision = await new PgAfterSalePolicyPort().evaluate(database, {
      scope: 'mall:1',
      member: 'member:1',
      line: 'line:1',
      productType: 'physical',
      provider: 'jd',
      fulfilledAt: new Date(Date.now() - 86_400_000).toISOString(),
      fulfilledQuantity: 4,
      claimedQuantity: 1,
      requestedQuantity: 2,
      providerRule: { windowDays: 10 },
    });
    expect(decision).toMatchObject({ eligible: true, requiresReturn: true, maximumQuantity: 3, windowDays: 10 });
    expect(decision.policy).toMatchObject({ id: 'policy:1', version: 4, windowDays: 10 });
  });

  it('rejects unfulfilled, exhausted, expired and provider-disabled lines', async () => {
    const policy = new PgAfterSalePolicyPort();
    const common = { scope: 'mall:1', member: 'member:1', line: 'line:1', productType: 'digital', provider: null, fulfilledQuantity: 1, claimedQuantity: 0, requestedQuantity: 1, providerRule: {} } as const;
    expect((await policy.evaluate(stub(), { ...common, fulfilledAt: null })).unavailableReason).toBe('NOT_FULFILLED');
    expect((await policy.evaluate(stub(), { ...common, fulfilledAt: new Date().toISOString(), claimedQuantity: 1 })).unavailableReason).toBe('QUANTITY_EXHAUSTED');
    expect((await policy.evaluate(stub(), { ...common, fulfilledAt: '2020-01-01T00:00:00.000Z' })).unavailableReason).toBe('AFTERSALE_WINDOW_EXPIRED');
    expect((await policy.evaluate(stub(), { ...common, fulfilledAt: new Date().toISOString(), providerRule: { returnable: false } })).unavailableReason).toBe('PROVIDER_NOT_RETURNABLE');
  });
});

function stub(row?: Readonly<Record<string, unknown>>): OperationDatabase {
  return { query: async () => ({ rows: row ? [row] : [], rowCount: row ? 1 : 0, command: 'SELECT', oid: 0, fields: [] }) } as OperationDatabase;
}
