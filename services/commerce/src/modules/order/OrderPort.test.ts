import type { QueryResult } from 'pg';
import { Money } from '@shop/kernel';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { OrderPort } from './OrderPort';

describe('OrderPort', () => {
  it('returns only the public checkout order projection', async () => {
    const queries: string[] = [];
    const query = vi.fn(async (sql: string) => {
      queries.push(sql);
      if (sql.includes('nextval')) return result([{ number: 'SW20260831000000000001' }]);
      if (sql.includes('insert into ordering.orderrecord')) return result([orderRecord()]);
      return result([]);
    });
    const created = await new OrderPort().create({ query } as unknown as OperationDatabase, {
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
      lines: [],
    });

    const insert = queries.find((sql) => sql.includes('insert into ordering.orderrecord')) ?? '';
    expect(insert).not.toContain('returning *');
    expect(insert).not.toContain('received_at');
    expect(created.record).not.toHaveProperty('received_at');
    expect(created.record).not.toHaveProperty('receipt_event_id');
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
