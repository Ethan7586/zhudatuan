import { describe, expect, it, vi } from 'vitest';
import type { RequestContext } from '@shop/sdk';
import { OrderGateway } from './OrderGateway';

describe('Storefront OrderGateway', () => {
  it('sends cancellation to the exact aggregate version with CSRF and one idempotency key', async () => {
    const ordersCancel = vi.fn(async () => ({ orderId: 'order:one', lifecycleState: 'cancelled', fulfillmentState: 'cancelled', cancelledAt: '2026-09-05T02:00:00.000Z', version: 4, eventId: 'event:one', repeated: false }));
    const context = vi.fn((_session, options) => ({ ...options }) as RequestContext);
    const gateway = new OrderGateway({ ordersCancel } as never, {} as never, context);
    const session = { membership: 'membership:one', scope: { kind: 'mall' as const, id: 'mall:one' }, accessVersion: 7, csrfToken: 'csrf:one' };
    await gateway.cancel(session, 'order:one', 3, '收货信息有误，需要重新下单', 'cancel-key');
    expect(ordersCancel).toHaveBeenCalledWith(
      { path: { orderid: 'order:one' }, body: { expectedVersion: 3, reason: '收货信息有误，需要重新下单' } },
      expect.objectContaining({ write: true, expectedVersion: 3, idempotencyKey: 'cancel-key' })
    );
    expect(context).toHaveBeenCalledWith(session, { write: true, expectedVersion: 3, idempotencyKey: 'cancel-key' });
  });

  it('reads the aggregate detail and provider tracking concurrently for the same order', async () => {
    const detailRead = vi.fn(async () => { throw new Error('DETAIL_STOP'); });
    const trackingRead = vi.fn(async () => ({ items: [], count: 0 }));
    const context = vi.fn(() => ({ headers: {} }) as unknown as RequestContext);
    const gateway = new OrderGateway({ detailRead } as never, { trackingRead } as never, context);
    const session = { membership: 'membership:one', scope: { kind: 'mall' as const, id: 'mall:one' }, accessVersion: 7, csrfToken: 'csrf:one' };
    await expect(gateway.order(session, { id: 'mall:one' } as never, 'order:one')).rejects.toThrow('DETAIL_STOP');
    expect(detailRead).toHaveBeenCalledWith({ path: { orderid: 'order:one' } }, expect.anything());
    expect(trackingRead).toHaveBeenCalledWith({ query: { order: 'order:one' } }, expect.anything());
  });
});
