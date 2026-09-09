import { describe, expect, it } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import type { ClaimedJob } from '../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { CatalogPublicationProcessor } from '../05_interface_jieru/job/CatalogPublicationJob';

describe('catalog publication job', () => {
  it('publishes the frozen target list and records exact success, skip and failure details', async () => {
    const calls: Readonly<{ text: string; values: readonly unknown[] }>[] = [];
    const mutableCalls = calls as { text: string; values: readonly unknown[] }[];
    const outcomes = [
      { id: 'listing:1', sku_id: 'sku:1', title: '商品一', outcome: 'published', code: null },
      { id: 'listing:2', sku_id: 'sku:2', title: '商品二', outcome: 'skipped', code: null },
      { id: 'listing:3', sku_id: 'sku:3', title: '商品三', outcome: 'failed', code: 'LISTING_NOT_READY' },
    ];
    const pool = {
      async query<R extends QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<R>> {
        mutableCalls.push({ text, values });
        if (text.startsWith('with selected_pool')) {
          return result([outcomes.shift()] as unknown as R[]);
        }
        return result([] as R[], 1);
      },
    } as unknown as DatabasePool;
    const job = { id: 'catalogpublication:test', kind: 'catalogpublication', scope_id: 'mall:hongtai',
      payload: { target_ids: ['listing:1', 'listing:2', 'listing:3'] }, attempts: 1 } as ClaimedJob;

    await new CatalogPublicationProcessor(pool).process(job, new AbortController().signal);

    const publications = calls.filter(({ text }) => text.startsWith('with selected_pool'));
    expect(publications).toHaveLength(3);
    expect(publications[0]?.values).toEqual(['listing:1', 'mall:hongtai']);
    expect(publications[0]?.text).toContain('pricing.pricebook');
    expect(publications[0]?.text).toContain('inventory.stockitem');
    expect(publications[0]?.text).toContain('experience.binding');
    expect(publications[0]?.text).toContain('for update of listing');
    expect(publications[0]?.text).toContain('insert into catalog.poolitem');
    const progress = calls.filter(({ text }) => text.startsWith('update runtime.job'));
    expect(progress).toHaveLength(2);
    expect(JSON.parse(String(progress[0]?.values[1]))).toMatchObject({
      total: 3, processed: 0, published: 0, failed: 0, skipped: 0, phase: 'publishing', failures: [],
    });
    expect(JSON.parse(String(progress[1]?.values[1]))).toMatchObject({
      total: 3, processed: 3, succeeded: 1, published: 1, failed: 1, skipped: 1, phase: 'completed',
      failures: [{ id: 'listing:3', sku_id: 'sku:3', title: '商品三', code: 'LISTING_NOT_READY',
        message: '商品资料、价格或库存尚未完善', retryable: false }],
    });
  });

  it('resumes from a persisted checkpoint without moving any counter backwards', async () => {
    const calls: { text: string; values: readonly unknown[] }[] = [];
    const outcomes = [
      { id: 'listing:2', sku_id: 'sku:2', title: '商品二', outcome: 'published', code: null },
      { id: 'listing:missing', sku_id: null, title: null, outcome: 'failed', code: 'LISTING_NOT_FOUND' },
    ];
    const pool = {
      async query<R extends QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<R>> {
        calls.push({ text, values });
        if (text.startsWith('with selected_pool')) return result([outcomes.shift()] as unknown as R[]);
        return result([] as R[], 1);
      },
    } as unknown as DatabasePool;
    const job = { id: 'catalogpublication:resume', kind: 'catalogpublication', scope_id: 'mall:hongtai', attempts: 2,
      payload: { target_ids: ['listing:1', 'listing:2', 'listing:missing'], total: 3, processed: 1,
        succeeded: 1, published: 1, failed: 0, skipped: 0, failures: [], started_at: '2026-09-09T00:00:00.000Z' } } as ClaimedJob;

    await new CatalogPublicationProcessor(pool).process(job, new AbortController().signal);

    expect(calls.filter(({ text }) => text.startsWith('with selected_pool')).map(({ values }) => values[0]))
      .toEqual(['listing:2', 'listing:missing']);
    const checkpoints = calls.filter(({ text }) => text.startsWith('update runtime.job'))
      .map(({ values }) => JSON.parse(String(values[1])) as Record<string, unknown>);
    expect(checkpoints[0]).toMatchObject({ processed: 1, succeeded: 1, failed: 0, skipped: 0 });
    expect(checkpoints[1]).toMatchObject({ processed: 3, succeeded: 2, failed: 1, skipped: 0,
      failures: [{ id: 'listing:missing', code: 'LISTING_NOT_FOUND', retryable: true }] });
  });
});

function result<R extends QueryResultRow>(rows: R[], rowCount = rows.length): QueryResult<R> {
  return { rows, rowCount } as QueryResult<R>;
}
