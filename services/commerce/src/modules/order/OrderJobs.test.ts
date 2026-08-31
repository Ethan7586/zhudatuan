import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import { OrderExpiryJobProcessor } from './OrderJobs';

describe('OrderExpiryJobProcessor', () => {
  it('types the order id used by the polymorphic JSON event builder', async () => {
    const statements: string[] = [];
    const client = {
      query: vi.fn(async (statement: string) => {
        statements.push(statement);
        return result([]);
      }),
      release: vi.fn(),
    } as unknown as PoolClient;
    const query: DatabasePool['query'] = async () => result([]) as never;
    const pool: DatabasePool = { connect: async () => client, query, workload: () => pool, end: async () => undefined };
    const processor = new OrderExpiryJobProcessor(pool, {
      checkouts: { expire: vi.fn(async () => result([])) },
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
    });

    await processor.process({ id: 'job:expiry:1', kind: 'orderexpiry', payload: {}, attempts: 1 } as never, new AbortController().signal);

    const outbox = statements.find((statement) => statement.includes('insert into runtime.outbox'));
    expect(outbox).toContain("jsonb_build_object('order',$2::text");
  });
});

function result<T extends Record<string, unknown>>(rows: T[]): QueryResult<T> {
  return { rows, command: '', rowCount: rows.length, oid: 0, fields: [] };
}
