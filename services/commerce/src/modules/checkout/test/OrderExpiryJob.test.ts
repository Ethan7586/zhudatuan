import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { PgTransactionManager } from '../../../adapter/database/PgTransactionManager';
import { ExpireOrders } from '../application/process/ExpireOrders';
import { PgOrderExpiryRepository } from '../infrastructure/persistence/PgOrderExpiryRepository';
import { OrderExpiryJob } from '../interface/job/OrderExpiryJob';

describe('OrderExpiryJob', () => {
  it('writes a typed order id in the cancellation event payload', async () => {
    const calls: { statement: string; values: readonly unknown[] }[] = [];
    const client = {
      query: vi.fn(async (statement: string, values: readonly unknown[] = []) => {
        calls.push({ statement, values });
        return statement.includes('checkout.expiryreceipt') ? result([{ id: String(values[0]) }]) : result([]);
      }),
      release: vi.fn(),
    } as unknown as PoolClient;
    const query: DatabasePool['query'] = async () => result([]) as never;
    const pool: DatabasePool = { connect: async () => client, query, workload: () => pool, end: async () => undefined };
    const processor = new OrderExpiryJob(
      new ExpireOrders(new PgTransactionManager(pool), new PgOrderExpiryRepository(), {
        checkouts: { expire: vi.fn(async () => []) },
        inventory: { expireCheckout: vi.fn() },
        payments: {
          expirations: vi.fn(async () => [{ intent: 'intent:1', order: 'order:1', external: false }]),
          expire: vi.fn(),
        },
        orders: {
          expirable: vi.fn(async () => [{ id: 'order:1', scope: 'mall:1' }]),
          cancelUnpaid: vi.fn(),
        },
        holds: { release: vi.fn() },
      })
    );

    await processor.process({ id: 'job:expiry:1', kind: 'orderexpiry', payload: {}, attempts: 1 } as never, new AbortController().signal);

    const outbox = calls.find(({ statement }) => statement.includes('insert into runtime.outbox'));
    expect(JSON.parse(String(outbox?.values[6]))).toEqual({ order: 'order:1', reason: 'paymenttimeout' });
  });
});

function result<T extends Record<string, unknown>>(rows: T[]): QueryResult<T> {
  return { rows, command: '', rowCount: rows.length, oid: 0, fields: [] };
}
