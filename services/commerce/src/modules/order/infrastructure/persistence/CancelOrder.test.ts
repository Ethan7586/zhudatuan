import { describe, expect, it, vi } from 'vitest';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { result, withWriteTransaction } from '../../../../test/TransactionFixture';
import { CancelOrder } from './CancelOrder';

const now = new Date('2026-09-05T02:00:00.000Z');
const input = Object.freeze({ orderId: 'order:one', memberId: 'member:one', scopeIds: [], actorId: 'actor:one', membershipId: 'membership:one', expectedVersion: 3, reason: '收货信息有误，需要重新下单', traceId: 'trace:one' });

describe('CancelOrder', () => {
  it('atomically cancels an unpaid order, stores immutable evidence and publishes one event', async () => {
    const statements: string[] = [];
    const query = vi.fn(async (sql: string) => {
      statements.push(sql);
      if (sql.includes('from ordering.orderrecord orders')) return result([activeOrder()]);
      if (sql.startsWith("update ordering.orderrecord set lifecycle_state='cancelled'"))
        return result([{ ...activeOrder(), lifecycle_state: 'cancelled', fulfillment_state: 'cancelled', cancelled_at: now, cancellation_event_id: eventId(), version: 4 }]);
      if (sql.includes('insert into ordering.cancellation')) return result([]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const outbox = { append: vi.fn(async () => undefined) };
    const command = new CancelOrder(new PgTransactionAccess(), outbox, { now: () => now });
    const receipt = await withWriteTransaction(query, (context) => command.execute(context, input));
    expect(receipt).toEqual({ orderId: 'order:one', lifecycleState: 'cancelled', fulfillmentState: 'cancelled', cancelledAt: now.toISOString(), version: 4, eventId: eventId(), repeated: false });
    expect(statements.some((sql) => sql.includes('insert into ordering.cancellation'))).toBe(true);
    expect(outbox.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'order.cancelled', payload: { order: 'order:one', reason: input.reason } }));
  });

  it('returns the existing cancellation receipt on a repeated command without a second write or event', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('from ordering.orderrecord orders')) return result([{ ...activeOrder(), lifecycle_state: 'cancelled', fulfillment_state: 'cancelled', cancelled_at: now, cancellation_event_id: eventId(), version: 4 }]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const outbox = { append: vi.fn(async () => undefined) };
    const command = new CancelOrder(new PgTransactionAccess(), outbox, { now: () => now });
    await expect(withWriteTransaction(query, (context) => command.execute(context, { ...input, expectedVersion: 3 }))).resolves.toMatchObject({ repeated: true, version: 4 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(outbox.append).not.toHaveBeenCalled();
  });

  it('rejects stale and paid state races before updating the aggregate', async () => {
    const stale = vi.fn(async () => result([activeOrder()]));
    const paid = vi.fn(async () => result([{ ...activeOrder(), payment_state: 'paid', lifecycle_state: 'paid', fulfillment_state: 'allocated' }]));
    const command = new CancelOrder(new PgTransactionAccess(), { append: vi.fn(async () => undefined) }, { now: () => now });
    await expect(withWriteTransaction(stale, (context) => command.execute(context, { ...input, expectedVersion: 2 }))).rejects.toThrow('VERSION_CONFLICT');
    await expect(withWriteTransaction(paid, (context) => command.execute(context, input))).rejects.toThrow('ORDER_NOT_CANCELLABLE');
    expect(stale).toHaveBeenCalledTimes(1);
    expect(paid).toHaveBeenCalledTimes(1);
  });
});

function activeOrder() {
  return {
    id: 'order:one',
    scope_id: 'mall:one',
    member_id: 'member:one',
    lifecycle_state: 'awaitingpayment',
    payment_state: 'unpaid',
    fulfillment_state: 'unallocated',
    aftersale_state: 'none',
    cancelled_at: null,
    cancellation_event_id: null,
    version: 3,
  };
}

function eventId(): string {
  return 'event:5eed5380713766d857727c9359b1b14837ab55a52e3b56f2e02819c9cfd15974';
}
