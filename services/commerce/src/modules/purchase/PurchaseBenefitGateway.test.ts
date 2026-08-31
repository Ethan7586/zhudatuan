import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { PurchaseBenefitGateway } from './PurchaseBenefitGateway';

describe('purchase benefit gateway', () => {
  it('uses only session-bound purchase functions', async () => {
    const query = vi.fn(async (text: string, values?: readonly unknown[]) => {
      if (text.includes('purchase_available')) return result([{ id: 'account:one', available_minor: 100, version: 1, kind: 'welfare' }]);
      return result([]);
    });
    const database = { query } as unknown as OperationDatabase;
    const gateway = new PurchaseBenefitGateway('membership:one', 'session:one', 'intent:one');
    await expect(gateway.preview(database, 'member:one', 'mall:one', ['account:one']))
      .resolves.toEqual([{ id: 'account:one', available_minor: 100, version: 1, kind: 'welfare' }]);
    await gateway.reserve(database, 'order:one', 'member:one', 'mall:one', [{ reference: 'account:one', amountMinor: 100 }]);
    await gateway.consume(database, 'order:one', 'account:one', 100);
    expect(query.mock.calls.map(([text]) => text)).toEqual([
      expect.stringContaining('benefit.purchase_available'),
      expect.stringContaining('benefit.purchase_reserve'),
      expect.stringContaining('benefit.purchase_consume'),
    ]);
    expect(query.mock.calls[2]?.[1]).toEqual(['membership:one', 'session:one', 'order:one', 'intent:one', 'account:one', 100]);
  });

  it('never exposes refund or recovery through the purchase adapter', async () => {
    const database = { query: vi.fn() } as unknown as OperationDatabase;
    const gateway = new PurchaseBenefitGateway('membership:one', 'session:one');
    await expect(gateway.consume(database, 'order:one', 'account:one', 1)).rejects.toThrow('PURCHASE_PAYMENT_INTENT_CONTEXT_REQUIRED');
    await expect(gateway.refund(database, { id: 'refund:one', order: 'order:one', member: 'member:one', scope: 'mall:one',
      account: 'account:one', amountMinor: 1 })).rejects.toThrow('PURCHASE_REFUND_FORBIDDEN');
    await expect(gateway.release(database, 'order:one')).rejects.toThrow('PURCHASE_RECOVERY_FORBIDDEN');
    expect(database.query).not.toHaveBeenCalled();
  });
});

function result(rows: object[]): QueryResult {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] } as unknown as QueryResult;
}
