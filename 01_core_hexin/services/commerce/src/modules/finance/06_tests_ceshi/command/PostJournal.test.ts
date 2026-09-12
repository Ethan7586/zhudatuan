import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { PostJournal } from '../../03_application_yingyong/command/PostJournal';

describe('PostJournal', () => {
  it('posts only the external tender as order receivable and makes an inbox replay a no-op', async () => {
    let pending = true;
    const payload = {
      order: 'order:one',
      totalMinor: 1_000,
      currency: 'CNY',
      tenders: [
        { kind: 'voucher', reference: 'voucher:one', amountMinor: 300 },
        { kind: 'benefit', reference: 'benefit:one', amountMinor: 300 },
        { kind: 'wechat', reference: null, amountMinor: 400 },
      ],
    };
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return result([]);
      if (sql.includes('join runtime.outbox') && sql.includes('for update')) return result(pending ? [{ scope_id: 'mall:one', occurred_at: '2026-08-28T01:02:04.000Z', payload }] : []);
      if (sql.includes('processed_at is not null')) return result([{ accepted: 1 }]);
      if (sql.includes('from ordering.suborder')) return result([]);
      if (sql.includes('from ordering.orderrecord')) return result([{ scope_id: 'mall:one', currency: 'CNY', total_minor: '1000', occurred_at: '2026-08-28T01:02:03.000Z', tenders: payload.tenders }]);
      if (sql.includes('select finance.post')) return result([{ journal: 'journal:order:one' }]);
      if (sql.includes('update runtime.inbox')) {
        pending = false;
        return result([]);
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;
    const event = {
      eventId: 'event:order:one',
      event: 'order.placed',
      payload: { tampered: true },
    } as const;

    const posting = new PostJournal(pool);
    await posting.execute(event);
    await posting.execute(event);

    const posts = query.mock.calls.filter(([sql]) => sql.includes('select finance.post'));
    expect(posts).toHaveLength(1);
    expect(posts[0]?.[1]).toEqual(['mall:one', 'order.placed', 'order:one', 'CNY', 'External-tender order receivable accrual', 'order.receivable.order:one', 'asset', 'commerce.revenue', 'income', 400, '2026-08-28T01:02:03.000Z']);
    expect(query.mock.calls.filter(([sql]) => sql.includes('update runtime.inbox'))).toHaveLength(1);
    expect(query.mock.calls.filter(([sql]) => sql === 'commit')).toHaveLength(2);
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  it('rolls back and leaves the inbox unprocessed when tender allocations do not equal the order total', async () => {
    const payload = { order: 'order:invalid', totalMinor: 1_000, currency: 'CNY', tenders: [{ kind: 'wechat', reference: null, amountMinor: 999 }] };
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql === 'begin' || sql === 'rollback') return result([]);
      if (sql.includes('join runtime.outbox') && sql.includes('for update')) return result([{ scope_id: 'mall:one', occurred_at: '2026-08-28T01:02:03.000Z', payload }]);
      if (sql.includes('from ordering.orderrecord')) return result([{ scope_id: 'mall:one', currency: 'CNY', total_minor: '1000', occurred_at: '2026-08-28T01:02:03.000Z', tenders: payload.tenders }]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;

    await expect(
      new PostJournal(pool).execute({
        eventId: 'event:order:invalid',
        event: 'order.placed',
        payload,
      })
    ).rejects.toThrow('FINANCE_ORDER_TENDER_ALLOCATION_INVALID');

    expect(query.mock.calls.some(([sql]) => sql.includes('select finance.post'))).toBe(false);
    expect(query.mock.calls.some(([sql]) => sql.includes('update runtime.inbox'))).toBe(false);
    expect(query).toHaveBeenCalledWith('rollback');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('books a verified late capture into a dedicated refund payable and uses the capture completion instant', async () => {
    const payload = { intent: 'intent:late', order: 'order:late', payment: 'payment:late', refund: 'refund:late', transaction: 'wechat:late', providerMinor: 420, detectedAt: '2026-08-28T01:00:00.000Z' };
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return result([]);
      if (sql.includes('join runtime.outbox') && sql.includes('for update')) return result([{ scope_id: 'mall:late', occurred_at: '2026-08-28T01:00:01.000Z', payload }]);
      if (sql.includes('from payment.payment payment'))
        return result([
          {
            order_id: 'order:late',
            scope_id: 'mall:late',
            currency: 'CNY',
            total_minor: '420',
            amount: '420',
            occurred_at: '2026-08-28T00:59:59.000Z',
            capture_source: 'latewechat',
            late_refund_id: 'refund:late',
            refund_reason: 'latepayment',
          },
        ]);
      if (sql.includes('select finance.post')) return result([{ journal: 'journal:late' }]);
      if (sql.includes('update runtime.inbox')) return result([]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;

    await new PostJournal(pool).execute({ eventId: 'event:late', event: 'payment.late.detected', payload: { tampered: true } });

    const post = query.mock.calls.find(([sql]) => sql.includes('select finance.post'));
    expect(post?.[1]).toEqual([
      'mall:late',
      'payment.late.detected',
      'payment:late',
      'CNY',
      'Late external capture pending automatic refund',
      'channel.clearing.wechat',
      'asset',
      'late-refund.payable.refund:late',
      'liability',
      420,
      '2026-08-28T00:59:59.000Z',
    ]);
  });

  it('rejects a payment whose authoritative order Scope differs from the immutable event Scope', async () => {
    const payload = { payment: 'payment:scope', order: 'order:scope', amountMinor: 100, currency: 'CNY' };
    const query = vi.fn(async (sql: string) => {
      if (sql === 'begin' || sql === 'rollback') return result([]);
      if (sql.includes('join runtime.outbox') && sql.includes('for update')) return result([{ scope_id: 'mall:event', occurred_at: '2026-08-28T01:00:00.000Z', payload }]);
      if (sql.includes('from payment.payment payment'))
        return result([{ order_id: 'order:scope', scope_id: 'mall:other', currency: 'CNY', total_minor: '100', amount: '100', occurred_at: '2026-08-28T00:59:59.000Z', capture_source: 'wechat', late_refund_id: null, refund_reason: null }]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;
    await expect(new PostJournal(pool).execute({ eventId: 'event:scope', event: 'payment.succeeded', payload: {} })).rejects.toThrow('FINANCE_EXTERNAL_TENDER_EVIDENCE_MISMATCH');
    expect(query.mock.calls.some(([sql]) => sql.includes('select finance.post'))).toBe(false);
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length } as unknown as QueryResult<Record<string, unknown>>;
}
