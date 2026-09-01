import { describe, expect, it, vi } from 'vitest';
import type { HandlerContext, WriteHandlerContext } from '../../../foundation/application/HandlerContext';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { NotificationsAckHandler } from '../application/handler/NotificationsAckHandler';
import { NotificationsReadHandler } from '../application/handler/NotificationsReadHandler';
import type { NotificationRepository } from '../application/port/NotificationRepository';

describe('notification member receipt', () => {
  it('reads storefront visibility without organization-wide dispatches', async () => {
    const transaction = {} as ReadTransactionContext;
    const notifications = vi.fn(async () => [{ id: 'dispatch:one', kind: 'dispatch', created_at: '2026-08-31T01:00:00Z' }]);
    const handler = new NotificationsReadHandler({ notifications } as unknown as NotificationRepository);
    const result = await handler.execute({ path: {}, query: {} } as never, context('notification.notifications.read', transaction));
    expect(notifications).toHaveBeenCalledWith(transaction, 'membership:one', false, null, null, 51);
    expect(result).toMatchObject({ status: 200, body: { count: 1 } });
  });

  it('creates an idempotent receipt for a visible message', async () => {
    const transaction = {} as WriteTransactionContext;
    const acknowledge = vi.fn(async () => ({ id: 'dispatch:one', readAt: '2026-08-31T01:02:00Z' }));
    const handler = new NotificationsAckHandler({ acknowledge } as unknown as NotificationRepository);
    const result = await handler.execute({ path: { notificationid: 'dispatch:one' }, query: {}, body: {} } as never, context('notification.notifications.ack', transaction));
    expect(acknowledge).toHaveBeenCalledWith(transaction, 'membership:one', 'dispatch:one');
    expect(result).toMatchObject({ status: 200, body: { id: 'dispatch:one' } });
  });
});

function context<TKey extends 'notification.notifications.read' | 'notification.notifications.ack'>(
  operation: TKey,
  transaction: TKey extends 'notification.notifications.ack' ? WriteTransactionContext : ReadTransactionContext
): TKey extends 'notification.notifications.ack' ? WriteHandlerContext<TKey> : HandlerContext<TKey> {
  return {
    requestId: 'request:one',
    traceId: 'trace:one',
    deadline: Date.now() + 1000,
    signal: new AbortController().signal,
    operation,
    headers: {},
    rawBody: '',
    idempotencyKey: 'notification:one',
    transaction,
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 1 } },
        membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(['notification.read', 'notification.ack']), denies: new Set() }, scopes: [] },
        organization: 'mall:one',
        scope: { id: 'self:principal:one', kind: 'self', path: [] },
        accessVersion: 1,
        capabilities: new Set([operation]),
        capabilityVersion: 1,
        assurance: { level: 1 },
        trace: 'trace:one',
      },
    },
  } as never;
}
