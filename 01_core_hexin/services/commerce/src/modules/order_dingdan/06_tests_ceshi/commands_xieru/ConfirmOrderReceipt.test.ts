import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationAction, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { confirmOrderReceiptOperations } from '../../03_application_yingyong/commands_xieru/ConfirmOrderReceipt';

describe('order receipt confirmation', () => {
  it('completes an order only after every fulfillment has shipped and publishes one canonical event', async () => {
    const query = vi.fn(async (sql: string, _parameters?: readonly unknown[]) => {
      if (sql.includes('select id,mall_id,member_id')) return result([activeOrder()]);
      if (sql.includes('count(*) filter')) return result([{ total: '2', shipped: '2' }]);
      if (sql.startsWith('update ordering.orderrecord')) return result([{ ...activeOrder(), lifecycle_state: 'completed', fulfillment_state: 'delivered', version: 4 }]);
      return result([]);
    });

    const response = await action()(request(), { query } as unknown as OperationDatabase);

    expect(response).toEqual({ status: 200, body: { id: 'order:one', lifecycleState: 'completed', fulfillmentState: 'delivered', version: 4, changed: true } });
    expect(String(query.mock.calls[1]?.[0])).toContain("lower(milestone.state) in");
    expect(String(query.mock.calls[3]?.[0])).toContain("'order.received'");
    expect(String(query.mock.calls[3]?.[0])).toContain('on conflict(id) do nothing');
    expect(query.mock.calls[3]?.[1]).toEqual([expect.stringMatching(/^event:order:received:/), 'order:one', 'mall:one', 'member:one', 'member', 'member:one', 'trace:order-receive']);
  });

  it('rejects confirmation while any fulfillment has not shipped', async () => {
    const query = vi.fn(async (sql: string) => sql.includes('select id,mall_id,member_id')
      ? result([activeOrder()]) : result([{ total: '2', shipped: '1' }]));

    await expect(action()(request(), { query } as unknown as OperationDatabase)).rejects.toThrow('ORDER_RECEIPT_STATE_INVALID');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('returns the completed order without publishing a duplicate event', async () => {
    const query = vi.fn(async () => result([{ ...activeOrder(), lifecycle_state: 'completed', fulfillment_state: 'delivered', version: 4 }]));

    const response = await action()(request(), { query } as unknown as OperationDatabase);

    expect(response).toEqual({ status: 200, body: { id: 'order:one', lifecycleState: 'completed', fulfillmentState: 'delivered', version: 4, changed: false } });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale expected version after readiness is established', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('select id,mall_id,member_id')) return result([activeOrder()]);
      if (sql.includes('count(*) filter')) return result([{ total: '1', shipped: '1' }]);
      return result([]);
    });

    await expect(action()(request(), { query } as unknown as OperationDatabase)).rejects.toThrow('VERSION_CONFLICT');
    expect(query).toHaveBeenCalledTimes(3);
  });
});

function action(): OperationAction {
  return confirmOrderReceiptOperations()['order.orders.receive'] as OperationAction;
}

function activeOrder() {
  return { id: 'order:one', mall_id: 'mall:one', member_id: 'member:one', lifecycle_state: 'active', fulfillment_state: 'shipped', version: 3 };
}

function request(): OperationRequest {
  return {
    type: 'order.orders.receive',
    access: {
      actor: { id: 'member:one' },
      scope: { id: 'member:one', kind: 'owner' },
      trace: 'trace:order-receive',
    },
    input: {
      path: { orderid: 'order:one' },
      query: {},
      headers: {},
      body: {},
      rawBody: '{}',
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
      expectedVersion: 3,
      idempotency: 'receive:order:one',
    },
  } as unknown as OperationRequest;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length } as unknown as QueryResult<Record<string, unknown>>;
}
