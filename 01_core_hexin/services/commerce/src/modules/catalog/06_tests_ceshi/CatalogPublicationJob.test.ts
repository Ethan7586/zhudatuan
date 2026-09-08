import { describe, expect, it } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import type { ClaimedJob } from '../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { CatalogPublicationProcessor } from '../05_interface_jieru/job/CatalogPublicationJob';

describe('catalog publication job', () => {
  it('publishes eligible listings in bounded batches and records real progress', async () => {
    const calls: Readonly<{ text: string; values: readonly unknown[] }>[] = [];
    const mutableCalls = calls as { text: string; values: readonly unknown[] }[];
    const batchSizes = [20, 5, 0];
    const pool = {
      async query<R extends QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<R>> {
        mutableCalls.push({ text, values });
        if (text.startsWith('select count(*)')) return result([{ count: 25 }] as unknown as R[]);
        if (text.startsWith('with selected_pool')) {
          const size = batchSizes.shift() ?? 0;
          return result(Array.from({ length: size }, (_, index) => ({ id: `listing:${index}` })) as unknown as R[]);
        }
        return result([] as R[], 1);
      },
    } as unknown as DatabasePool;
    const job = { id: 'catalogpublication:test', kind: 'catalogpublication', scope_id: 'mall:hongtai', payload: {}, attempts: 1 } as ClaimedJob;

    await new CatalogPublicationProcessor(pool).process(job, new AbortController().signal);

    const publications = calls.filter(({ text }) => text.startsWith('with selected_pool'));
    expect(publications).toHaveLength(3);
    expect(publications[0]?.values).toEqual(['mall:hongtai', 20]);
    expect(publications[0]?.text).toContain('pricing.pricebook');
    expect(publications[0]?.text).toContain('inventory.stockitem');
    expect(publications[0]?.text).toContain('experience.binding');
    expect(publications[0]?.text).toContain('coalesce(listing.pool_id,(select pool_id from selected_pool))');
    expect(publications[0]?.text).toContain('insert into catalog.poolitem');
    const progress = calls.filter(({ text }) => text.startsWith('update runtime.job'));
    expect(progress.map(({ values }) => values.slice(1))).toEqual([
      [25, 0, 'publishing'], [25, 20, 'publishing'], [25, 25, 'publishing'], [25, 25, 'completed'],
    ]);
  });
});

function result<R extends QueryResultRow>(rows: R[], rowCount = rows.length): QueryResult<R> {
  return { rows, rowCount } as QueryResult<R>;
}
