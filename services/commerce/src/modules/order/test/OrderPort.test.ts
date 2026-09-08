import type { QueryResult } from 'pg';
import { Money } from '@shop/kernel';
import { describe, expect, it, vi } from 'vitest';
import { OrderPort } from '../infrastructure/persistence/OrderPort';
import { withWriteTransaction } from '../../../test/TransactionFixture';

describe('OrderPort', () => {
  it('returns only the public checkout order projection', async () => {
    const queries: string[] = [];
    const query = vi.fn(async (sql: string) => {
      queries.push(sql);
      if (sql.includes('nextval')) return result([{ number: 'SW20260831000000000001' }]);
      if (sql.includes('insert into ordering.orderrecord')) return result([orderRecord()]);
      return result([]);
    });
    const created = await withWriteTransaction(query, (context) =>
      new OrderPort().create(context, {
        id: 'order:one',
        scope: 'mall:one',
        member: 'member:one',
        checkout: 'checkout:one',
        money: Money.of(100),
        evidence: {},
        address: null,
        invoice: null,
        delivery: {},
        experienceVersion: 'version:one',
        lines: [
          {
            sku: 'sku:one',
            listing: 'listing:one',
            product: 'product:one',
            productType: 'physical',
            category: '福利',
            title: '礼品',
            quantity: 1,
            unitMinor: 100,
            totalMinor: 100,
            discountMinor: 0,
            payableMinor: 100,
            provider: null,
            partner: null,
            versions: { listing: 1, product: 1, sku: 1, price: 'price:one', stock: 1 },
            accepted: true,
          },
        ],
      })
    );

    const insert = queries.find((sql) => sql.includes('insert into ordering.orderrecord')) ?? '';
    expect(insert).not.toContain('returning *');
    expect(insert).not.toContain('received_at');
    expect(created.record).not.toHaveProperty('received_at');
    expect(created.record).not.toHaveProperty('receipt_event_id');
    expect(created.record.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
    expect(created.record.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  });

  it('keeps a split order in progress until every line quantity is fulfilled', async () => {
    const queries: string[] = [];
    const query = vi.fn(async (sql: string) => {
      queries.push(sql);
      return result([{ id: 'order:one' }]);
    });
    await withWriteTransaction(query, (context) => new OrderPort().completeFulfillment(context, 'order:one', [{ line: 'line:digital', quantity: 1 }]));
    const aggregate = queries.find((sql) => sql.includes('update ordering.orderrecord')) ?? '';
    expect(aggregate).toContain("then 'processing' else 'delivered'");
    expect(aggregate).toContain('fulfilled_quantity<quantity');
  });
});

function orderRecord() {
  return {
    id: 'order:one',
    order_number: 'SW20260831000000000001',
    scope_id: 'mall:one',
    member_id: 'member:one',
    mall_id: 'mall:one',
    checkout_id: 'checkout:one',
    currency: 'CNY',
    total_minor: 100,
    payment_state: 'unpaid',
    fulfillment_state: 'unallocated',
    aftersale_state: 'none',
    lifecycle_state: 'awaitingpayment',
    evidence: {},
    address_snapshot: null,
    invoice_snapshot: null,
    delivery_snapshot: {},
    experience_version: 'version:one',
    created_at: new Date(),
    updated_at: new Date(),
    version: 0,
  };
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
