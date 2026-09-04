import { describe, expect, it, vi } from 'vitest';
import { result, withWriteTransaction } from '../../../../test/TransactionFixture';
import { PgOrderSupportPort } from './PgOrderSupportPort';

describe('PgOrderSupportPort', () => {
  it('exposes a minimal summary and creates an idempotent Order-owned collaboration action', async () => {
    const calls: string[] = [];
    const query = vi.fn(async (sql: string) => {
      calls.push(sql);
      if (sql.includes('from ordering.orderrecord')) return result([{ id: 'order:one', scope_id: 'mall:one', member_id: 'member:one', order_number: 'O20260906001', lifecycle_state: 'fulfilling', total_minor: 12800 }]);
      if (sql.includes('insert into ordering.supportcollaboration')) return result([{ id: 'supportcollaboration:case:one', order_id: 'order:one', aftersale_id: 'aftersale:one', support_case_id: 'case:one', kind: 'caseopened', created_at: '2026-09-06T00:00:00.000Z' }]);
      return result([]);
    });
    const action = await withWriteTransaction(query, (context) => new PgOrderSupportPort().collaborate(context, { id: 'supportcollaboration:case:one', order: 'order:one', supportCase: 'case:one', scopes: ['mall:one'], member: 'member:one', memberOnly: true, actor: 'actor:one', trace: 'trace:one' }));
    expect(action).toEqual({ id: 'supportcollaboration:case:one', order: 'order:one', aftersale: 'aftersale:one', supportCase: 'case:one', kind: 'caseopened', createdAt: '2026-09-06T00:00:00.000Z' });
    expect(calls.every((sql) => !sql.includes(' support.'))).toBe(true);
  });

  it('does not disclose or mutate an order outside the supplied member and scope boundary', async () => {
    const query = vi.fn(async () => result([]));
    await expect(withWriteTransaction(query, (context) => new PgOrderSupportPort().collaborate(context, { id: 'supportcollaboration:case:one', order: 'order:foreign', supportCase: 'case:one', scopes: ['mall:one'], member: 'member:one', memberOnly: true, actor: 'actor:one', trace: 'trace:one' }))).rejects.toThrow('RESOURCE_NOT_FOUND');
    expect(query).toHaveBeenCalledTimes(1);
  });
});
