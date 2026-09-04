import { describe, expect, it, vi } from 'vitest';
import { PgTransactionAccess } from '../../../adapter/database/PgTransactionAccess';
import type { FinanceOrderPort } from '../../order/public';
import type { FinancePaymentPort } from '../../payment/public';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';
import type { FinanceAction, FinanceRequest } from '../infrastructure/persistence/FinanceOperation';
import { invoiceActions } from '../infrastructure/persistence/InvoiceActions';

describe('invoice source ownership', () => {
  it('verifies payment and order sources through their owner Ports before persisting the request', async () => {
    const paymentOrders = vi.fn<FinancePaymentPort['orders']>(async () => [{ payment: 'payment:one', order: 'order:one' }]);
    const verified = vi.fn<FinanceOrderPort['verified']>(async () => ['order:one', 'order:two']);
    const query = vi.fn(async (sql: string) => {
      expect(sql).not.toMatch(/\b(?:ordering|payment)\./);
      if (sql.includes('from finance.settlement settlement')) return result([
        { id: 'line:one', source_type: 'payment', source_id: 'payment:one', amount_minor: 60, tax_minor: 3 },
        { id: 'line:two', source_type: 'order', source_id: 'order:two', amount_minor: 40, tax_minor: 2 },
      ]);
      if (sql.startsWith('insert into invoice.request(')) return result([{ id: 'invoice:created' }]);
      return result([]);
    });
    const create = invoiceActions(() => { throw new Error('UNUSED_WORKFLOW'); }, { verified }, { orders: paymentOrders } as unknown as FinancePaymentPort).requestsCreate as FinanceAction;

    await withWriteTransaction(query, async (transaction) => {
      const request = invoiceRequest(transaction);
      await expect(create(request, new PgTransactionAccess().database(transaction))).resolves.toMatchObject({ status: 201 });
    });

    expect(paymentOrders).toHaveBeenCalledWith(expect.any(Object), ['payment:one']);
    expect(verified).toHaveBeenCalledWith(expect.any(Object), ['order:one', 'order:two']);
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith('insert into invoice.request('))).toBe(true);
  });

  it('fails closed when a source owner cannot verify every order', async () => {
    const query = vi.fn(async (sql: string) => sql.includes('from finance.settlement settlement')
      ? result([{ id: 'line:one', source_type: 'payment', source_id: 'payment:one', amount_minor: 100, tax_minor: 5 }])
      : result([]));
    const create = invoiceActions(() => { throw new Error('UNUSED_WORKFLOW'); }, { verified: async () => [] }, {
      orders: async () => [{ payment: 'payment:one', order: 'order:one' }],
    } as unknown as FinancePaymentPort).requestsCreate as FinanceAction;

    await withWriteTransaction(query, async (transaction) => {
      await expect(create(invoiceRequest(transaction, ['line:one'], 100), new PgTransactionAccess().database(transaction)))
        .rejects.toThrow('INVOICE_LINES_NOT_ELIGIBLE_OR_AMOUNT_MISMATCH');
    });
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith('insert into invoice.request('))).toBe(false);
  });
});

function invoiceRequest(transaction: FinanceRequest['transaction'], lines = ['line:one', 'line:two'], amountMinor = 100): FinanceRequest {
  return {
    type: 'invoice.requests.create',
    transaction,
    security: { kind: 'session', access: { scope: { id: 'mall:one' }, actor: { id: 'principal:maker' }, membership: { id: 'membership:maker' } } } as FinanceRequest['security'],
    input: { path: {}, query: {}, headers: {}, body: { settlement: 'settlement:one', profile: 'profile:one', amountMinor, lines, reason: '业务开票', evidence: {} },
      rawBody: '{}', deadline: Date.now() + 10_000, signal: new AbortController().signal },
  };
}
