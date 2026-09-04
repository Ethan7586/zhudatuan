import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgPriceWriter } from './PgPriceWriter';

describe('PgPriceWriter', () => {
  it('updates the operator price with optimistic concurrency and emits one event', async () => {
    const now = new Date('2026-09-07T08:00:00.000Z');
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('select price.id')) return { rows: [{ id: 'price:one', version: 4 }], rowCount: 1 };
      if (sql.startsWith('update pricing.price')) return { rows: [{ id: 'price:one', sku_id: 'sku:one', amount_minor: 9900, version: 5, effective_at: now, updated_at: now }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const result = await new PgPriceWriter(access(query)).set(context, { scope: 'mall:one', sku: 'sku:one', amountMinor: 9900, currency: 'CNY', expectedVersion: 4 });

    expect(result).toMatchObject({ amountMinor: 9900, version: 5, currency: 'CNY' });
    expect(query).toHaveBeenCalledTimes(4);
    expect(String(query.mock.calls[3]?.[0])).toContain('runtime.outbox');
  });

  it('rejects a stale expected version before changing price data', async () => {
    const query = vi.fn(async (sql: string) => sql.startsWith('select price.id') ? { rows: [{ id: 'price:one', version: 5 }], rowCount: 1 } : { rows: [], rowCount: 1 });
    await expect(new PgPriceWriter(access(query)).set(context, { scope: 'mall:one', sku: 'sku:one', amountMinor: 9900, currency: 'CNY', expectedVersion: 4 })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(query).toHaveBeenCalledTimes(2);
  });
});

const context = { trace: 'trace:pricing' } as WriteTransactionContext;

function access(query: ReturnType<typeof vi.fn>): PgTransactionAccess {
  return { database: () => ({ query }) as unknown as SqlExecutor } as unknown as PgTransactionAccess;
}
