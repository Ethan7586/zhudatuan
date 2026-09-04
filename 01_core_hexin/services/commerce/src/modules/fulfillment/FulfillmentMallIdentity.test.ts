import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import type { ExtensionRegistry } from '../../bootstrap/ExtensionRegistry';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { SecretStore } from '../../foundation/infrastructure/SecretStore';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import { FulfillmentJobProcessor } from './FulfillmentJobs';
import { FulfillmentPort } from './FulfillmentPort';

describe('Fulfillment mall identity', () => {
  it('writes mall and member snapshots into fulfillment and line records', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.startsWith('insert into fulfillment.fulfillmentorder')
      ? [{ id: 'fulfillment:a' }] : []);

    const ids = await new FulfillmentPort().create(database, {
      mall: 'mall:a', member: 'member:a', order: 'order:a', payment: 'payment:a',
    });

    expect(ids).toEqual(['fulfillment:a']);
    expect(calls[0]?.text).toContain('fulfillmentorder(id,mall_id,member_id,provider_scope_id');
    expect(calls[0]?.text).toContain('orders.mall_id=$1 and orders.member_id=$2');
    expect(calls[0]?.text).toContain('on conflict(mall_id,source_effect_id,suborder_id)');
    expect(calls[0]?.values).toEqual(['mall:a', 'member:a', 'order:a', 'payment:a']);
    expect(calls[1]?.text).toContain('fulfillment.line(mall_id,fulfillment_id,order_line_id');
    expect(calls[1]?.text).toContain('where fulfillment.mall_id=$1 and fulfillment.order_id=$2');
  });

  it('locates a tracking recovery by job mall and fulfillment without querying OrderRecord', async () => {
    const calls: QueryCall[] = [];
    const pool = recordingPool(calls, (text) => text.includes('from fulfillment.fulfillmentorder') ? [{
      id: 'fulfillment:a', mall_id: 'mall:a', order_id: 'order:a', provider: null, provider_scope_id: 'tenant:a',
      member_id: 'member:a', state: 'accepted', external_reference: null, lines: [],
    }] : []);
    const processor = new FulfillmentJobProcessor(pool, {} as ExtensionRegistry, {} as SecretStore, 'tracking');

    await processor.process({ id: 'job:a', kind: 'tracking', scope_id: 'mall:a', payload: { fulfillment: 'fulfillment:a' }, attempts: 0 },
      new AbortController().signal);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain('where fulfillment.mall_id=$1 and fulfillment.id=$2');
    expect(calls[0]?.text).not.toContain('ordering.orderrecord');
    expect(calls[0]?.values).toEqual(['mall:a', 'fulfillment:a', ['accepted', 'processing', 'ready']]);
  });

  it('keeps Track, Receive, and Inspect runtime SQL independent of Order and hierarchy joins', async () => {
    for (const file of [
      new URL('./FulfillmentJobs.ts', import.meta.url),
      new URL('./FulfillmentOperations.ts', import.meta.url),
    ]) {
      const source = await readFile(file, 'utf8');
      expect(source, file.pathname).not.toMatch(/(?:join|from)\s+ordering\.orderrecord/i);
      expect(source, file.pathname).not.toContain('organization.unitclosure');
    }
  });

  it('passes Payment mall identity into fulfillment creation and job scope', async () => {
    const source = await readFile(new URL('../payment_zhifu/03_application_yingyong/services_fuwu/PaymentSettlement.ts', import.meta.url), 'utf8');
    expect(source).toContain('mall: target.mall, member: target.member, order: target.order, payment');
    expect(source).toContain("enqueue(database, target.mall, fulfillment)");
  });
});

interface QueryCall { readonly text: string; readonly values: readonly unknown[] }

function recordingDatabase(calls: QueryCall[], rows: (text: string) => readonly QueryResultRow[] = () => []): OperationDatabase {
  return {
    async query<R extends QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<R>> {
      calls.push({ text, values });
      const result = rows(text) as R[];
      return { rows: result, rowCount: result.length } as QueryResult<R>;
    },
  };
}

function recordingPool(calls: QueryCall[], rows: (text: string) => readonly QueryResultRow[]): DatabasePool {
  const database = recordingDatabase(calls, rows);
  return {
    query: database.query.bind(database),
    connect: async () => { throw new Error('UNEXPECTED_CONNECT'); },
    workload() { return this; },
    async end() {},
  };
}
