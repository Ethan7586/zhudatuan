import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { FinancePort } from '../../03_application_yingyong/port/FinancePort';

describe('supplier-leg finance replay', () => {
  it('uses the original aftersale time so a retry submits the identical accounting fact', async () => {
    const postings: unknown[][] = [];
    const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
      if (sql.includes('from ordering.aftersale aftersale')) return result([{
        aftersale_id: 'aftersale:one', order_id: 'order:one', order_line_id: 'line:one', supplier_leg_id: 'leg:one',
        supplier_id: 'supplier:one', scope_id: 'mall:one', transaction_id: 'transaction:one', correlation_id: 'correlation:one',
        currency: 'CNY', occurred_at: '2026-09-12T01:02:03.000Z', amount_minor: 500, line_payable_minor: 1000,
        line_cost_minor: 600, reversed_amount_minor: 0, reversed_cost_minor: 0,
      }]);
      if (sql.includes('select finance.post')) {
        postings.push([...values]);
        return result([{ journal: `journal:${String(values[1])}` }]);
      }
      if (sql.includes('insert into finance.supplierlegreversal')) return result([]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const finance = new FinancePort();
    const database = { query } as unknown as Parameters<FinancePort['reverseSupplierAftersale']>[0];

    await finance.reverseSupplierAftersale(database, 'aftersale:one', 'refund:one');
    await finance.reverseSupplierAftersale(database, 'aftersale:one', 'refund:one');

    expect(postings).toHaveLength(4);
    expect(postings.map((values) => values[10])).toEqual(Array(4).fill('2026-09-12T01:02:03.000Z'));
    expect(postings.map((values) => values[1])).toEqual([
      'supplier-leg.refund-sale', 'supplier-leg.refund-cost', 'supplier-leg.refund-sale', 'supplier-leg.refund-cost',
    ]);
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows } as QueryResult<Record<string, unknown>>;
}
