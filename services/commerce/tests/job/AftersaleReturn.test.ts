import { describe, expect, it, vi } from 'vitest';
import type { PoolClient, QueryResult } from 'pg';
import type { ClaimedJob } from '../../src/modules/runtime/public/JobProcess';
import type { DatabasePool } from '../../src/platform/database/Pool';
import { PgTransactionManager } from '../../src/platform/database/PgTransactionManager';
import { RunFulfillment } from '../../src/modules/fulfillment/application/process/RunFulfillment';
import { PgFulfillmentJobProcess } from '../../src/modules/fulfillment/infrastructure/persistence/PgFulfillmentJobProcess';
import { FulfillmentJob } from '../../src/modules/fulfillment/interface/job/FulfillmentJob';

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
    const extensions = { has: vi.fn(() => true), strategy: vi.fn(() => ({ authorize })) };
    const processor = new FulfillmentJob(
      'fulfillment',
      new RunFulfillment(
        new PgFulfillmentJobProcess(new PgTransactionManager(fixture.pool), extensions as never, {
          operations: operations as never,
          orders: orders as never,
          organizations: { scope: vi.fn(async () => ({ tenant: 'tenant:one' })) } as never,
          vouchers: { issue: vi.fn() } as never,
        })
      )
    );
    await processor.process(job(), new AbortController().signal);
    await processor.process(job(), new AbortController().signal);
    expect(authorize).toHaveBeenCalledOnce();
    expect(operations.record).toHaveBeenCalledOnce();
    expect(orders.markReturning).toHaveBeenCalledOnce();
    let transactions = 0;
    for (const call of calls) {
      if (call === 'begin') transactions += 1;
      if (call === 'commit' || call === 'rollback') transactions -= 1;
      if (call === 'provider') expect(transactions).toBe(0);
    }
    expect(calls.indexOf('operation')).toBeLessThan(calls.indexOf('order'));
  });
});

function job(): ClaimedJob {
  return { id: 'job:return:one', kind: 'fulfillment', scope: 'mall:one', payload: { aftersale: 'aftersale:one' }, attempts: 1, token: 1,
    authorization: { kind: 'system', actor: 'test', scope: 'mall:one', operation: 'test', source: 'jobs', capturedAt: new Date().toISOString() } };
}

function database(calls: string[]) {
  const query = async (text: string) => {
    const normalized = text.trim().toLowerCase();
    if (normalized.startsWith('begin')) calls.push('begin');
    if (normalized === 'commit') calls.push('commit');
    if (normalized === 'rollback') calls.push('rollback');
    if (normalized.includes('from fulfillment.fulfillmentorder')) return result([{ fulfillment: 'fulfillment:one', provider: 'jdproduct', line: 'line:one', quantity: 1 }]);
    if (normalized.startsWith('insert into fulfillment.sagastep')) return result([{ state: 'running' }]);
    if (normalized.startsWith('update fulfillment.sagastep') && normalized.includes('returning fulfillment_id')) return result([{ fulfillment_id: 'fulfillment:one' }]);
    if (normalized.includes('from fulfillment.returnrecord')) {
      return result([{ id: 'return:one', state: 'authorized', provider: 'jdproduct', providerReference: 'JD-R-1', trackingNumber: null, instruction: { address: '北京市退货中心' }, version: 0 }]);
    }
    return result([]);
  };
  const client = { query, release: () => undefined } as unknown as PoolClient;
  const pool = { query, connect: async () => client, workload: () => pool, end: async () => undefined } as unknown as DatabasePool;
  return { pool };
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows: [...rows], rowCount: rows.length } as unknown as QueryResult;
}
