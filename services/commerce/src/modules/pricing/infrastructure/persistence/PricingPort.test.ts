import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { PricingPort } from './PricingPort';

const context = { trace: 'trace:pricing' } as WriteTransactionContext;
const input = { id: 'price:one', book: 'pricebook:one', sku: 'sku:one', amountMinor: 1000, compareMinor: 1200, effectiveAt: '2026-09-05T00:00:00.000Z', expiresAt: null } as const;

describe('PricingPort provider offer persistence', () => {
  it('emits one offer-change event after a real versioned write', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) =>
      sql.includes('with changed as') ? { rows: [{ id: input.id, book_id: input.book, sku_id: input.sku, scope_id: 'mall:one', version: 2, changed: true }], rowCount: 1 } : { rows: [], rowCount: 1 }
    );
    await new PricingPort(access(query)).saveProviderPrice(context, input);
    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[1]?.[0])).toContain('runtime.outbox');
    expect(query.mock.calls[1]?.[1]).toEqual(expect.arrayContaining(['pricing.offer.changed']));
  });

  it('does not emit a duplicate event when provider content is unchanged', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => ({ rows: [{ id: input.id, book_id: input.book, sku_id: input.sku, scope_id: 'mall:one', version: 2, changed: false }], rowCount: 1 }));
    await new PricingPort(access(query)).saveProviderPrice(context, input);
    expect(query).toHaveBeenCalledOnce();
  });
});

function access(query: ReturnType<typeof vi.fn>): PgTransactionAccess {
  return { database: () => ({ query }) as unknown as SqlExecutor } as unknown as PgTransactionAccess;
}
