import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { result } from '../../../../test/TransactionFixture';
import { PgReservationExpiryRepository } from './PgReservationExpiryRepository';

const context = { trace: 'trace:expiry', scope: 'mall:one' } as WriteTransactionContext;

describe('PgReservationExpiryRepository', () => {
  it('locks due reservations with skip locked, expires once and publishes authoritative balances', async () => {
    const query = vi.fn(async (text: string, _values?: readonly unknown[]) => {
      if (text.startsWith('select reservation.id')) return result([{
        id: 'reservation:one', stockitem_id: 'stock:one', owner_type: 'order', owner_id: 'order:one', quantity: 2,
        state: 'reserved', expires_at: new Date('2026-09-05T00:30:00.000Z'), created_at: new Date('2026-09-05T00:00:00.000Z'),
        version: 1, scope_id: 'mall:one', sku_id: 'sku:one', location_id: 'warehouse:one', onhand: 10, safety: 1,
        stock_version: 2, stock_status: 'active', updated_at: new Date('2026-09-05T00:00:00.000Z'),
      }]);
      if (text.startsWith('update inventory.reservation')) return result([{ id: 'reservation:one' }]);
      if (text.startsWith('update inventory.stockitem')) return result([{ id: 'stock:one' }]);
      if (text.startsWith('select stock.id')) return result([{ id: 'stock:one', reserved: 0 }]);
      return result([]);
    });
    const value = await new PgReservationExpiryRepository(access(query)).expire(context, 'order:one', new Date('2026-09-05T00:30:00.000Z'), 200);
    expect(value).toEqual({ expired: 1, more: false });
    expect(String(query.mock.calls[0]?.[0])).toContain('for update of stock,reservation skip locked');
    expect(query.mock.calls.some(([text, values]) => String(text).includes('runtime.outbox') && String(values).includes('inventory.reservation.expired'))).toBe(true);
  });
});

function access(query: ReturnType<typeof vi.fn>): PgTransactionAccess {
  return { database: () => ({ query } as unknown as SqlExecutor) } as unknown as PgTransactionAccess;
}
