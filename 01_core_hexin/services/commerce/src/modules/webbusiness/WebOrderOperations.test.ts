import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { DATABASE_POOL, type DatabasePool } from '../../foundation/persistence/Pool';
import { webOrderOperations } from './WebOrderOperations';

describe('web order read model', () => {
  it('applies production filters and returns inventory, aftersales and real responsibility operations in the authorized scope', async () => {
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        queries.push({ text, values });
        return result([]);
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const pool: DatabasePool = {
      connect: async () => client,
      query: async () => result([]),
      workload: () => pool,
      end: async () => undefined,
    };

    await webOrderOperations(context(pool)).invoke(request());

    const read = queries.find(({ text }) => text.includes('select orders.*'));
    expect(read?.text).toContain('inventory_reservations');
    expect(read?.text).toContain('aftersales');
    expect(read?.text).toContain("'placed' kind");
    expect(read?.text).toContain("milestone.evidence->>'actor'");
    expect(read?.text).toContain('aftersale.requested_by');
    expect(read?.text).toContain('review.actor_id');
    expect(read?.text).toContain('member.profile');
    expect(read?.text).toContain('orders.order_number=$5');
    expect(read?.text).toContain("orders.payment_state=$8");
    expect(read?.text).toContain("$13='aftersale'");
    expect(read?.values).toEqual([
      false, 'mall:test', false, false, 'SW-TEST-1', null, null,
      'paid', 'allocated', 'active', 'mall:test', '30days', 'aftersale', 51,
    ]);
  });
});

function request(): OperationRequest {
  return {
    type: 'order.orders.read',
    access: {
      actor: { id: 'principal:operator', session: 'session:operator', membership: 'membership:operator', credentialVersion: 1,
        accessVersion: 1, target: 'console', assurance: { level: 1 } },
      membership: { id: 'membership:operator', active: true, accessVersion: 1, denies: [], grants: [] },
      scope: { id: 'mall:test', kind: 'mall', path: [] },
      mallContext: { mall_id: 'mall:test' }, mall_id: 'mall:test', accessVersion: 1,
      capabilities: ['order.orders.read'], assurance: { level: 1 }, trace: 'trace:orders',
    },
    input: {
      path: {},
      query: { order: 'SW-TEST-1', payment: 'paid', fulfillment: 'allocated', lifecycle: 'active', mall: 'mall:test', placed: '30days', view: 'aftersale', limit: '50' },
      headers: {}, body: null, rawBody: '', deadline: Date.now() + 10_000, signal: new AbortController().signal,
    },
  };
}

function context(pool: DatabasePool): ModuleContext {
  const container = new Container();
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
  return { container } as unknown as ModuleContext;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
