import { describe, expect, it, vi } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import { PgTransactionManager } from '../../../adapter/database/PgTransactionManager';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { PgAfterSalePolicyPort } from '../infrastructure/persistence/PgAfterSalePolicyPort';

describe('PgAfterSalePolicyPort', () => {
  it('combines published, provider and order-snapshot rules deterministically', async () => {
    const decision = await evaluate(
      { id: 'policy:1', version: 4, rule: { windowDays: 30, providers: { jd: { windowDays: 15 } } } },
      {
        scope: 'mall:1',
        member: 'member:1',
        line: 'line:1',
        productType: 'physical',
        provider: 'jd',
        fulfilledAt: new Date(Date.now() - 86_400_000).toISOString(),
        fulfilledQuantity: 4,
        claimedQuantity: 1,
        requestedQuantity: 2,
        providerRule: { windowDays: 10 },
      }
    );
    expect(decision).toMatchObject({ eligible: true, requiresReturn: true, maximumQuantity: 3, windowDays: 10 });
    expect(decision.policy).toMatchObject({ id: 'policy:1', policyVersion: 4, rule: { windowDays: 10 } });
  });

  it('rejects unfulfilled, exhausted, expired and provider-disabled lines', async () => {
    const common = { scope: 'mall:1', member: 'member:1', line: 'line:1', productType: 'digital', provider: null, fulfilledQuantity: 1, claimedQuantity: 0, requestedQuantity: 1, providerRule: {} } as const;
    expect((await evaluate(undefined, { ...common, fulfilledAt: null })).unavailableReason).toBe('NOT_FULFILLED');
    expect((await evaluate(undefined, { ...common, fulfilledAt: new Date().toISOString(), claimedQuantity: 1 })).unavailableReason).toBe('QUANTITY_EXHAUSTED');
    expect((await evaluate(undefined, { ...common, fulfilledAt: '2020-01-01T00:00:00.000Z' })).unavailableReason).toBe('AFTERSALE_WINDOW_EXPIRED');
    expect((await evaluate(undefined, { ...common, fulfilledAt: new Date().toISOString(), providerRule: { returnable: false } })).unavailableReason).toBe('PROVIDER_NOT_RETURNABLE');
  });
});

async function evaluate(row: Readonly<Record<string, unknown>> | undefined, candidate: Parameters<PgAfterSalePolicyPort['evaluate']>[1]) {
  const manager = new PgTransactionManager(pool(row));
  return manager.read(options(), (context) => new PgAfterSalePolicyPort().evaluate(context, candidate));
}

function options() {
  return { tenant: '', membership: 'membership:1', scope: 'mall:1', actor: 'member:1', trace: 'test:aftersale', operation: 'order.aftersales.apply', deadline: Date.now() + 10_000, signal: new AbortController().signal };
}

function pool(row: Readonly<Record<string, unknown>> | undefined): DatabasePool {
  const client = {
    release: vi.fn(),
    query: async <R extends QueryResultRow>(text: string): Promise<QueryResult<R>> => result<R>(text.includes('qualification.policy') && row ? [row as R] : []),
  };
  const database = { connect: async () => client, query: client.query, workload: () => database, end: async () => undefined };
  return database as unknown as DatabasePool;
}

function result<R extends QueryResultRow>(rows: R[]): QueryResult<R> {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
}
