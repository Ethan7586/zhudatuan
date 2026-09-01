import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { JobProcessor } from '../../foundation/application/JobRunner';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import { InventorySyncJobProcessor } from './interface/job/InventorySyncJob';
import { InventoryPort } from './InventoryPort';

describe('inventory reservation locking', () => {
  it('locks stock rows before aggregating reservations', async () => {
    const queries: string[] = [];
    const database = { query: async (text: string) => {
      queries.push(text);
      const rows = text.startsWith('with locked as') ? [{ id: 'stock:1', onhand: 10, safety: 1, reserved: 2 }] : [];
      return { rows, rowCount: rows.length } as unknown as QueryResult;
    } };
    await new InventoryPort().reserve(database, 'order:1', 'mall:1', [
      { sku: 'sku:1', listing: 'listing:1', stockitem: 'stock:1', quantity: 2, accepted: true },
    ]);
    expect(queries[0]).toContain('order by array_position($1::text[],stock.id) for update');
    expect(queries[0]).not.toMatch(/group by[\s\S]*for update/i);
    expect(queries.filter((query) => query.startsWith('insert into inventory.reservation'))).toHaveLength(1);
  });

  it('writes mall_id into reservation and reserve movement facts', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.startsWith('with locked as')
      ? [{ id: 'stock:1', onhand: 10, safety: 1, reserved: 0 }] : []);

    await new InventoryPort().reserve(database, 'order:1', 'mall:1', [
      { sku: 'sku:1', listing: 'listing:1', stockitem: 'stock:1', quantity: 2, accepted: true },
    ]);

    expect(calls[1]?.text).toContain('inventory.reservation(id,mall_id,stockitem_id');
    expect(calls[1]?.values[1]).toBe('mall:1');
    expect(calls[2]?.text).toContain('inventory.movement(id,mall_id,stockitem_id');
    expect(calls[2]?.values[1]).toBe('mall:1');
  });

  it('commits and releases by mall once when commands are repeated', async () => {
    const commitCalls: QueryCall[] = [];
    let commitActive = true;
    const commitDatabase = recordingDatabase(commitCalls, (text) => {
      if (text.startsWith('select id,stockitem_id')) {
        if (!commitActive) return [];
        commitActive = false;
        return [{ id: 'reservation:1', stockitem_id: 'stock:1', quantity: 2 }];
      }
      if (text.startsWith('update inventory.stockitem')) return [{ id: 'stock:1' }];
      return [];
    });
    const port = new InventoryPort();
    await port.commit(commitDatabase, 'mall:1', 'order:1');
    await port.commit(commitDatabase, 'mall:1', 'order:1');
    expect(commitCalls.filter(({ text }) => text.includes("'commit'"))).toHaveLength(1);
    expect(commitCalls.find(({ text }) => text.startsWith('select id,stockitem_id'))?.values).toEqual(['mall:1', 'order:1']);

    const releaseCalls: QueryCall[] = [];
    let releaseActive = true;
    const releaseDatabase = recordingDatabase(releaseCalls, (text) => {
      if (!text.startsWith('update inventory.reservation')) return [];
      if (!releaseActive) return [];
      releaseActive = false;
      return [{ stockitem_id: 'stock:1', quantity: 2 }];
    });
    await port.release(releaseDatabase, 'mall:1', 'order:2');
    await port.release(releaseDatabase, 'mall:1', 'order:2');
    expect(releaseCalls.filter(({ text }) => text.includes("'release'"))).toHaveLength(1);
    expect(releaseCalls[0]?.values).toEqual(['mall:1', 'order:2']);
  });

  it('restocks a return idempotently by its job mall without an OrderRecord lookup', async () => {
    const calls: QueryCall[] = [];
    let movementCreated = true;
    const client = {
      async query(text: string, values: readonly unknown[] = []) {
        calls.push({ text, values });
        const rows = text.includes('from fulfillment.returnrecord')
          ? [{ stockitem_id: 'stock:1', quantity: 2 }]
          : text.startsWith('insert into inventory.movement') && movementCreated
            ? (movementCreated = false, [{ id: 'movement:1' }]) : [];
        return { rows, rowCount: rows.length } as unknown as QueryResult;
      },
      release() {},
    };
    const pool = { connect: async () => client } as unknown as DatabasePool;
    const channel = { process: async () => {} } as JobProcessor;
    const processor = new InventorySyncJobProcessor(pool, channel);
    const job = { id: 'job:1', kind: 'inventorysync', scope_id: 'mall:1', payload: { return: 'return:1' }, attempts: 0 };

    await processor.process(job, new AbortController().signal);
    await processor.process(job, new AbortController().signal);

    const lookup = calls.find(({ text }) => text.includes('from fulfillment.returnrecord'));
    expect(lookup?.text).not.toContain('ordering.orderrecord');
    expect(lookup?.values).toEqual(['mall:1', 'return:1']);
    expect(calls.filter(({ text }) => text.startsWith('update inventory.stockitem'))).toHaveLength(1);
  });

  it('keeps import and availability writes explicitly mall-scoped', async () => {
    const importSource = await readFile(new URL('./application/StockImport.ts', import.meta.url), 'utf8');
    const operationSource = await readFile(new URL('./InventoryOperations.ts', import.meta.url), 'utf8');
    expect(importSource).toContain('inventory.movement(id,mall_id,stockitem_id');
    expect(importSource).toContain('where mall_id=$1 and stockitem_id=$2');
    expect(operationSource).toContain('where stock.scope_id=$1');
    expect(operationSource).not.toContain('organization.unitclosure');
  });
});

interface QueryCall { readonly text: string; readonly values: readonly unknown[] }

function recordingDatabase(calls: QueryCall[], rows: (text: string) => readonly QueryResultRow[]): OperationDatabase {
  return {
    async query<R extends QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<R>> {
      calls.push({ text, values });
      const result = rows(text) as R[];
      return { rows: result, rowCount: result.length } as QueryResult<R>;
    },
  };
}
