import { describe, expect, it, vi } from 'vitest';
import { result, withReadTransaction, withWriteTransaction } from '../../../test/TransactionFixture';
import { PaymentPort } from '../infrastructure/persistence/PaymentPort';

describe('payment intent repository', () => {
  it('maps Payment-owned records to order references without reading Ordering', async () => {
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      expect(sql).toContain('from payment.payment');
      expect(sql).not.toContain('ordering.');
      expect(values).toEqual([['payment:two', 'payment:one']]);
      return result([
        { payment: 'payment:one', order: 'order:one' },
        { payment: 'payment:two', order: 'order:two' },
      ]);
    });

    await expect(withReadTransaction(query, (context) => new PaymentPort().orders(context, ['payment:two', 'payment:one']))).resolves.toEqual([
      { payment: 'payment:one', order: 'order:one' },
      { payment: 'payment:two', order: 'order:two' },
    ]);
  });

  it('reuses the one active intent for an order instead of creating a second provider request', async () => {
    const query = vi.fn(async (sql: string) =>
      sql.includes('from payment.intent intent') ? result([{ id: 'intent:one', scope_id: 'mall:one', member_id: 'member:one', currency: 'CNY', amount_minor: 100, expires_at: '2026-09-05T00:30:00.000Z', external: true }]) : result([])
    );
    const receipt = await withWriteTransaction(query, (context) =>
      new PaymentPort().prepare(context, {
        order: 'order:one',
        orderNumber: 'SW-1',
        scope: 'mall:one',
        mall: 'mall:one',
        member: 'member:one',
        currency: 'CNY',
        amountMinor: 100,
        idempotency: 'request:two',
        tenders: [{ kind: 'wechat', reference: null, amountMinor: 100 }],
      })
    );
    expect(receipt).toEqual({ intent: 'intent:one', external: true, expiresAt: '2026-09-05T00:30:00.000Z' });
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith('insert into payment.intent'))).toBe(false);
  });

  it('retries an external-only failed intent explicitly without changing its provider reference', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("intent.state in('created','preparing','pending')")) return result([]);
      if (sql.includes("intent.state='failed'"))
        return result([
          {
            id: 'intent:one',
            scope_id: 'mall:one',
            mall_id: 'mall:one',
            member_id: 'member:one',
            currency: 'CNY',
            amount_minor: 100,
            idempotency_key: 'request:one',
            provider_reference: 'PSW1',
            expires_at: '2026-09-05T00:30:00.000Z',
            version: 2,
            external: true,
            internal: false,
          },
        ]);
      if (sql.startsWith('update payment.intent set state=')) return result([{ expires_at: '2026-09-05T01:00:00.000Z' }]);
      return result([]);
    });
    const receipt = await withWriteTransaction(
      query,
      (context) =>
        new PaymentPort().prepare(context, {
          order: 'order:one',
          orderNumber: 'SW-1',
          scope: 'mall:one',
          mall: 'mall:one',
          member: 'member:one',
          currency: 'CNY',
          amountMinor: 100,
          idempotency: 'request:two',
          tenders: [{ kind: 'wechat', reference: null, amountMinor: 100 }],
        }),
      'payment.intents.create'
    );
    expect(receipt).toEqual({ intent: 'intent:one', external: true, expiresAt: '2026-09-05T01:00:00.000Z' });
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith('insert into payment.intent'))).toBe(false);
  });
});
