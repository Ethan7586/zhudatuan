import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { Container } from '../../../bootstrap/Container';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { SECURITY_KEYS } from '../../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../../foundation/persistence/Pool';
import { OrderPort } from '../01_public_gongkai/ports_jiekou/OrderPort';
import { orderOperations } from '../03_application_yingyong/services_fuwu/OrderOperations';

describe('order aftersale review', () => {
  it('casts the aftersale id before building the payment refund job payload', async () => {
    const harness = approvalHarness();

    const response = await orderOperations(context(harness.pool)).invoke(approvalRequest());

    expect(response).toMatchObject({ status: 200, body: { id: 'aftersale:test', state: 'approved' } });
    const enqueue = harness.queries.find(({ text }) => text.includes("'paymentrefund'"));
    expect(enqueue?.text).toContain("jsonb_build_object('aftersale',$2::text)");
    expect(enqueue?.values).toEqual(['job:refund:aftersale:test', 'aftersale:test', 'order:test']);
  });

  it('accepts an already-processing aftersale when a refund job retries', async () => {
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const database = {
      query: async (text: string, values: readonly unknown[] = []) => {
        queries.push({ text, values });
        return result([{ id: 'aftersale:test' }]);
      },
    };

    await expect(new OrderPort().startAftersaleRefund(database, 'aftersale:test')).resolves.toBeUndefined();

    expect(queries[0]?.text).toContain("where id=$1 and state='approved'");
    expect(queries[0]?.text).toContain("where id=$1 and state='processing'");
    expect(queries[0]?.values).toEqual(['aftersale:test']);
  });

  it('types both refund totals before comparing them in PostgreSQL', async () => {
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const database = {
      query: async (text: string, values: readonly unknown[] = []) => {
        queries.push({ text, values });
        return result(text.includes('update ordering.orderrecord') ? [{ id: 'order:test' }] : []);
      },
    };

    await new OrderPort().markRefunded(database, {
      order: 'order:test', refundedMinor: 5_180, capturedMinor: 5_180, aftersale: 'aftersale:test',
    });

    expect(queries[0]?.text).toContain('$2::bigint=$3::bigint');
    expect(queries[0]?.values).toEqual(['order:test', 5_180, 5_180, 'aftersale:test']);
  });
});

function approvalRequest(): OperationRequest {
  return {
    type: 'order.aftersales.approve',
    access: {
      actor: { id: 'principal:reviewer', session: 'session:reviewer', membership: 'membership:reviewer', credentialVersion: 1,
        accessVersion: 1, target: 'console', assurance: { level: 2 } },
      membership: { id: 'membership:reviewer', active: true, accessVersion: 1, denies: [], grants: [] },
      scope: { id: 'mall:test', kind: 'mall', tenant: 'tenant:test', path: [] },
      mallContext: { mall_id: 'mall:test' }, mall_id: 'mall:test', accessVersion: 1,
      capabilities: ['order.aftersales.approve'], assurance: { level: 2 }, trace: 'trace:aftersale-approval',
    },
    input: {
      path: { aftersaleid: 'aftersale:test' }, query: {}, headers: {},
      body: { reason: 'approved in regression test' }, rawBody: '', deadline: Date.now() + 10_000,
      signal: new AbortController().signal, idempotency: 'idempotency:aftersale-approval', expectedVersion: 0,
    },
  };
}

function approvalHarness(): Readonly<{
  pool: DatabasePool;
  queries: ReadonlyArray<Readonly<{ text: string; values: readonly unknown[] }>>;
}> {
  let requestHash = '';
  const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
  const client = {
    query: async (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values });
      if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
      if (text.includes("update runtime.idempotency set state='completed'")) return result([{}]);
      if (text.startsWith('select request_hash,state,response')) {
        return result([{ request_hash: requestHash, state: 'started', response: null }]);
      }
      if (text.startsWith('update ordering.aftersale set')) {
        return result([{ id: 'aftersale:test', order_id: 'order:test', requested_by: 'principal:customer', state: 'approved', version: 1 }]);
      }
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
  return { pool, queries };
}

function context(pool: DatabasePool): ModuleContext {
  const container = new Container();
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
  container.bind(SECURITY_KEYS, { identity: 'identity-key', session: 'session-key', quote: 'q'.repeat(32) });
  return { container } as unknown as ModuleContext;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
