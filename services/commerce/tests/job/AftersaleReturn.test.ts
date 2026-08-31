import { describe, expect, it, vi } from 'vitest';
import type { PoolClient, QueryResult } from 'pg';
import type { ClaimedJob } from '../../src/foundation/application/JobRunner';
import type { DatabasePool } from '../../src/foundation/persistence/Pool';
import { FulfillmentJobProcessor } from '../../src/modules/fulfillment/FulfillmentJobs';

describe('aftersale return authorization job', () => {
  it('gets a provider instruction once, persists it, then advances Order to returning', async () => {
    const calls: string[] = [];
    const authorize = vi.fn(async () => {
      calls.push('provider');
      return { externalReference: 'JD-R-1', state: 'authorized', instruction: { address: '北京市退货中心' } };
    });
    const request = {
      id: 'aftersale:one',
      order: 'order:one',
      scope: 'mall:one',
      member: 'member:one',
      reason: 'damaged',
      state: 'approved',
      requiresReturn: true,
      lines: [{ line: 'line:one', quantity: 1, provider: 'jdproduct', policy: {} }],
    } as const;
    const orders = {
      returnRequest: vi
        .fn()
        .mockResolvedValueOnce(request)
        .mockResolvedValue({ ...request, state: 'returning' }),
      markReturning: vi.fn(async (_database, _sale, returns) => {
        calls.push('order');
        expect(returns).toEqual([expect.objectContaining({ providerReference: 'JD-R-1', instruction: { address: '北京市退货中心' } })]);
      }),
    };
    const fixture = database(calls);
    const operations = { record: vi.fn(async () => calls.push('operation')), replayReference: vi.fn() };
    const extensions = { has: vi.fn(() => true), require: vi.fn(() => ({ authorize })) };
    const processor = new FulfillmentJobProcessor(fixture.pool, extensions as never, {} as never, 'fulfillment', {
      operations: operations as never,
      orders: orders as never,
      organizations: { scope: vi.fn(async () => ({ tenant: 'tenant:one' })) } as never,
    });
    await processor.process(job(), new AbortController().signal);
    await processor.process(job(), new AbortController().signal);
    expect(authorize).toHaveBeenCalledOnce();
    expect(operations.record).toHaveBeenCalledOnce();
    expect(orders.markReturning).toHaveBeenCalledOnce();
    expect(calls.indexOf('provider')).toBeLessThan(calls.indexOf('begin'));
    expect(calls.indexOf('operation')).toBeLessThan(calls.indexOf('order'));
  });
});

function job(): ClaimedJob {
  return { id: 'job:return:one', kind: 'fulfillment', scope_id: 'mall:one', payload: { aftersale: 'aftersale:one' }, attempts: 1, fencing_token: 1 };
}

function database(calls: string[]) {
  const query = async (text: string) => {
    const normalized = text.trim().toLowerCase();
    if (normalized.startsWith('begin')) calls.push('begin');
    if (normalized.includes('from fulfillment.fulfillmentorder')) return result([{ fulfillment: 'fulfillment:one', provider: 'jdproduct', line: 'line:one', quantity: 1 }]);
    return result([]);
  };
  const client = { query, release: () => undefined } as unknown as PoolClient;
  const pool = { query, connect: async () => client, workload: () => pool, end: async () => undefined } as unknown as DatabasePool;
  return { pool };
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows: [...rows], rowCount: rows.length } as unknown as QueryResult;
}
