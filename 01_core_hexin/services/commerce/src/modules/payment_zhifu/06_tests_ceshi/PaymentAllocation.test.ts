import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { allocatePaymentToEconomicLegs } from '../03_application_yingyong/services_fuwu/PaymentAllocation';

describe('payment allocation by supplier economic leg', () => {
  it('uses balanced order suborders as the payment authority and keeps a legacy order fallback', async () => {
    const calls: Array<Readonly<{ sql: string; values: readonly unknown[] }>> = [];
    const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
      calls.push({ sql, values });
      return { rows: [], rowCount: 0 } as unknown as QueryResult<Record<string, unknown>>;
    });

    await allocatePaymentToEconomicLegs({ query } as unknown as OperationDatabase, {
      mall: 'mall:one', payment: 'payment:one', order: 'order:one', amountMinor: 42569, currency: 'CNY',
    });

    expect(query).toHaveBeenCalledOnce();
    expect(calls[0]?.sql).toContain("'supplier_economic_leg'");
    expect(calls[0]?.sql).toContain('from ordering.suborder');
    expect(calls[0]?.sql).toContain("'order',$3,$4,$5 from balanced where not balanced.valid");
    expect(calls[0]?.values).toEqual(['mall:one', 'payment:one', 'order:one', 42569, 'CNY']);
  });
});
