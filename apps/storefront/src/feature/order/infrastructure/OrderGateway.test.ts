import { describe, expect, it, vi } from 'vitest';
import type { RequestContext } from '@shop/sdk';
import { OrderGateway } from './OrderGateway';

describe('Storefront OrderGateway', () => {
  it('sends cancellation to the exact aggregate version with CSRF and one idempotency key', async () => {
    const ordersCancel = vi.fn(async () => ({ orderId: 'order:one', lifecycleState: 'cancelled', fulfillmentState: 'cancelled', cancelledAt: '2026-09-05T02:00:00.000Z', version: 4, eventId: 'event:one', repeated: false }));
    const context = vi.fn((_session, options) => ({ ...options }) as RequestContext);
    const gateway = new OrderGateway({ ordersCancel } as never, context);
    const session = { membership: 'membership:one', scope: { kind: 'mall' as const, id: 'mall:one' }, accessVersion: 7, csrfToken: 'csrf:one' };
    await gateway.cancel(session, 'order:one', 3, '收货信息有误，需要重新下单', 'cancel-key');
    expect(ordersCancel).toHaveBeenCalledWith(
      { path: { orderid: 'order:one' }, body: { expectedVersion: 3, reason: '收货信息有误，需要重新下单' } },
      expect.objectContaining({ write: true, expectedVersion: 3, idempotencyKey: 'cancel-key' })
    );
    expect(context).toHaveBeenCalledWith(session, { write: true, expectedVersion: 3, idempotencyKey: 'cancel-key' });
  });
});
