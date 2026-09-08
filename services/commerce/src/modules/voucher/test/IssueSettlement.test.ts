import { describe, expect, it, vi } from 'vitest';
import { result, transactionManager } from '../../../test/TransactionFixture';
import type { JobPort } from '../../runtime/public';
import { PgIssueBatchProcess } from '../infrastructure/persistence/PgIssueBatchProcess';

describe('issue batch retry settlement', () => {
  it('posts only newly successful credentials and emits one transactional event per receipt', async () => {
    let succeeded = 3;
    let accounted = 0;
    let version = 4;
    const post = vi.fn(async () => 'journal:one');
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      if (sql.includes('from voucher.issuebatch batch') && sql.includes('for update'))
        return result([{ id: 'issuebatch:one', order_id: 'issueorder:one', state: 'running', requested: 5, processed: 5, succeeded, failed: 5 - succeeded, retryable: 5 - succeeded, version }]);
      if (sql.startsWith('select issue.id')) return result([{ id: 'issueorder:one', customer_id: 'customer:one', product_id: 'product:one', stock_request_id: 'stock:one', quantity: 5, state: 'issuing', face_minor: 1000 }]);
      if (sql.includes("count(*) filter(where state<>'queued')")) return result([{ processed: 5, succeeded, failed: 5 - succeeded, retryable: 5 - succeeded }]);
      if (sql.startsWith('select accounted::integer')) return result([{ accounted, version }]);
      if (sql.startsWith('update voucher.issuebatch set accounted')) {
        accounted = Number(values?.[2]);
        version++;
      }
      return result([]);
    });
    const process = new PgIssueBatchProcess(transactionManager(query), {} as JobPort, { post });
    const input = { job: 'job:one', batch: 'issuebatch:one', scope: 'mall:one', signal: new AbortController().signal, deadline: Date.now() + 10_000 };
    await process.issue(input);
    expect(accounted).toBe(3);
    succeeded = 5;
    await process.issue({ ...input, job: 'job:retry' });
    await process.issue({ ...input, job: 'job:replay' });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls.map((call) => (call as unknown as [unknown, { amountMinor: number }])[1].amountMinor)).toEqual([3000, 2000]);
    const events = query.mock.calls.filter(([sql]) => sql.includes('item."eventType"')).flatMap(([, values]) => JSON.parse(String(values?.[0])) as Array<{ aggregateVersion: number; payload: { count: number; amountMinor: number } }>);
    expect(events.map(({ payload }) => payload)).toEqual([
      { batch: 'issuebatch:one', count: 3, amountMinor: 3000 },
      { batch: 'issuebatch:one', count: 2, amountMinor: 2000 },
    ]);
    expect(events.map(({ aggregateVersion }) => aggregateVersion)).toEqual([5, 6]);
    expect(accounted).toBe(5);
  });
});
