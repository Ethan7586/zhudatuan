import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Client } from 'pg';
import { ensureLocalPricebook, LOCAL_PRICEBOOK } from './LocalPricing';

describe('local pricebook', () => {
  it('rekeys a historical pricebook without deleting its prices', async () => {
    const calls: Array<Readonly<{ sql: string; values: readonly unknown[] }>> = [];
    const database = {
      async query(sql: string, values: readonly unknown[] = []) {
        calls.push(Object.freeze({ sql, values }));
        return { rows: calls.length === 1 ? [{ id: 'pricebook-local-zhudatuan' }] : [] };
      },
    } as unknown as Pick<Client, 'query'>;

    await ensureLocalPricebook(database);

    assert.equal(calls.length, 5);
    assert.match(calls[0]!.sql, /for update/);
    assert.match(calls[1]!.sql, /__local_rekey__/);
    assert.match(calls[2]!.sql, /insert into pricing\.pricebook/);
    assert.match(calls[3]!.sql, /update pricing\.price set book_id=\$1/);
    assert.match(calls[4]!.sql, /delete from pricing\.pricebook/);
    assert.deepEqual(calls[3]!.values, [LOCAL_PRICEBOOK.id, ['pricebook-local-zhudatuan']]);
  });

  it('upserts the canonical pricebook directly when no historical id exists', async () => {
    const calls: string[] = [];
    const database = {
      async query(sql: string) {
        calls.push(sql);
        return { rows: [] };
      },
    } as unknown as Pick<Client, 'query'>;

    await ensureLocalPricebook(database);

    assert.equal(calls.length, 2);
    assert.match(calls[1]!, /on conflict\(id\) do update/);
  });
});
