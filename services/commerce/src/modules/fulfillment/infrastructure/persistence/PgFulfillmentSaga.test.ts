import { describe, expect, it, vi } from 'vitest';
import type { QueryResult } from 'pg';
import { PgFulfillmentSaga } from './PgFulfillmentSaga';

describe('PgFulfillmentSaga', () => {
  it('does not repeat an already succeeded provider step', async () => {
    const query = vi.fn(async (_sql: string) => result([]));
    await expect(new PgFulfillmentSaga().begin({ query } as never, 'fulfillment:one', 'submit', 'key:one')).resolves.toBe(false);
    expect(query.mock.calls[0]?.[0]).toContain("where fulfillment.sagastep.state<>'succeeded'");
  });

  it('moves an exhausted step and its aggregate to manual takeover', async () => {
    const query = vi.fn(async (sql: string) => sql.includes('select attempts') ? result([{ attempts: 5 }]) : sql.includes('returning state') ? result([{ state: 'needsaction' }]) : result([]));
    await expect(new PgFulfillmentSaga().fail({ query } as never, 'fulfillment:one', 'submit', new Error('PROVIDER_TIMEOUT'))).resolves.toBe('needsaction');
    expect(query.mock.calls.some(([sql]) => String(sql).includes("set state='needsaction'"))).toBe(true);
  });

  it('records compensation without deleting the original checkpoint', async () => {
    const query = vi.fn(async (_sql: string) => result([{ fulfillment_id: 'fulfillment:one' }]));
    await expect(new PgFulfillmentSaga().compensate({ query } as never, 'fulfillment:one', 'submit', 'ordercancelled')).resolves.toBeUndefined();
    expect(query.mock.calls[0]?.[0]).toContain("state='compensated'");
  });
});

function result<T>(rows: readonly T[]): QueryResult<T & Record<string, unknown>> {
  return { rows: rows as (T & Record<string, unknown>)[], rowCount: rows.length, command: '', oid: 0, fields: [] };
}
