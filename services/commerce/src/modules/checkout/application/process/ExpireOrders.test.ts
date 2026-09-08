import { describe, expect, it, vi } from 'vitest';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { ExpireOrders } from './ExpireOrders';

describe('ExpireOrders', () => {
  it('uses a durable receipt to make repeated expiry delivery a no-op', async () => {
    const expireCheckout = vi.fn();
    const expirations = vi.fn();
    const process = new ExpireOrders(
      { write: async (_options: unknown, operation: (context: WriteTransactionContext) => Promise<void>) => operation({} as WriteTransactionContext) } as never,
      { claim: vi.fn().mockResolvedValue(false) } as never,
      {
        checkouts: { expire: expireCheckout },
        inventory: { expireCheckout: vi.fn() },
        payments: { expirations, expire: vi.fn() },
        orders: { expirable: vi.fn(), cancelUnpaid: vi.fn() },
        holds: { release: vi.fn() },
      } as never
    );
    await process.execute({ checkout: 'checkout:one', order: null, scope: 'mall:one', trace: 'event:one', signal: new AbortController().signal, deadline: Date.now() + 1_000 });
    expect(expireCheckout).not.toHaveBeenCalled();
    expect(expirations).not.toHaveBeenCalled();
  });
});
