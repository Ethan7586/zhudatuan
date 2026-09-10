import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { PgProductRepository } from './PgProductRepository';

describe('PgProductRepository detail projection', () => {
  it('returns media, channel, pool and ordered timeline facts from one catalog query', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => ({
      rows: [
        {
          id: 'product:one',
          title: '早餐',
          product_type: 'physical',
          status: 'active',
          version: '7',
          category_id: 'category:food',
          category_name: '餐饮美食',
          brand_id: null,
          owner_partner_id: null,
          cover_object: null,
          cover_url: 'https://assets.example/cover.jpg',
          subtitle: null,
          description: '工作日早餐',
          createdAt: new Date('2026-09-01T00:00:00.000Z'),
          updatedAt: new Date('2026-09-07T00:00:00.000Z'),
          attributes: {
            regionIds: ['region:east'],
            media: [
              { id: 'media:manual', kind: 'document', url: 'https://assets.example/manual.pdf', alt: '说明书', sort: 2 },
              { id: 'media:unsafe', kind: 'image', url: 'javascript:alert(1)', sort: 1 },
            ],
          },
          skus: [{ id: 'sku:one', code: 'MEAL-1', status: 'active', specifications: [], version: '2' }],
          listings: [
            {
              id: 'listing:one',
              scope: 'mall:one',
              pool: 'pool:one',
              poolName: '早餐池',
              sku: 'sku:one',
              skuCode: 'MEAL-1',
              title: '早餐',
              status: 'published',
              effectiveAt: null,
              expiresAt: null,
              createdAt: '2026-09-02T00:00:00.000Z',
              updatedAt: '2026-09-06T00:00:00.000Z',
              version: '3',
            },
          ],
          channels: [{ provider: 'supplier', externalId: 'EXT-1', status: 'mapped', sourceVersion: '4', observedAt: '2026-09-07T08:00:00.000Z' }],
          pools: [{ id: 'pool:one', name: '早餐池', kind: 'private', status: 'active', listingCount: 1 }],
        },
      ],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    }));
    const database = { query } as unknown as SqlExecutor;
    const repository = new PgProductRepository(
      { database: () => database } as unknown as PgTransactionAccess,
      { visible: vi.fn(async () => ['mall:one']) } as never,
      { scopes: vi.fn(async () => new Map()), names: vi.fn(async () => new Map()) } as never
    );

    const detail = await repository.detail({} as ReadTransactionContext, 'product:one', 'mall:one', false);

    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain('catalog.sourcelisting');
    expect(String(query.mock.calls[0]?.[0])).toContain('listingCount');
    expect(String(query.mock.calls[0]?.[0])).toContain("product.attributes->>'coverObject' cover_object");
    expect(detail.media).toEqual([
      { id: 'media:cover', kind: 'image', url: 'https://assets.example/cover.jpg', alt: '早餐', sort: 0 },
      { id: 'media:manual', kind: 'document', url: 'https://assets.example/manual.pdf', alt: '说明书', sort: 2 },
    ]);
    expect(detail.regionIds).toEqual(['region:east']);
    expect(detail.createdAt).toBe('2026-09-01T00:00:00.000Z');
    expect(detail.updatedAt).toBe('2026-09-07T00:00:00.000Z');
    expect(detail.listings[0]).toMatchObject({
      effectiveAt: null,
      expiresAt: null,
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z',
    });
    expect(detail.channels).toHaveLength(1);
    expect(detail.pools).toEqual([{ id: 'pool:one', name: '早餐池', kind: 'private', status: 'active', listingCount: 1 }]);
    expect(detail.timeline[0]).toMatchObject({ kind: 'sourceobserved', occurredAt: '2026-09-07T08:00:00.000Z' });
    expect(detail.timeline.every(({ occurredAt }) => typeof occurredAt === 'string')).toBe(true);
    expect(detail).not.toHaveProperty('attributes');
  });

  it('creates a draft listing without silently choosing a product pool', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('select id,parent_id')) return result([{ id: 'category:food', parent_id: null, code: 'FOOD', name: '餐饮美食', status: 'active', sort_order: 1 }]);
      if (sql.includes('insert into catalog.product'))
        return result([{ id: 'product:one', scope_id: 'mall:one', owner_partner_id: null, brand_id: null, category_id: 'category:food', title: '早餐', product_type: 'physical', attributes: {}, status: 'draft', version: 1 }]);
      return result([]);
    });
    const database = { query } as unknown as SqlExecutor;
    const repository = new PgProductRepository(
      { database: () => database } as unknown as PgTransactionAccess,
      { visible: vi.fn() } as never,
      { scopes: vi.fn(), names: vi.fn() } as never
    );

    await repository.create({} as WriteTransactionContext, { scope: 'mall:one', owner: null, brand: null, category: 'category:food', title: '早餐', kind: 'physical', attributes: {} });

    const listingSql = query.mock.calls.map(([sql]) => sql).find((sql) => sql.includes('insert into catalog.listing'));
    expect(listingSql).toContain('values($1,$2,null,$3,$4');
    expect(listingSql).not.toContain('select id from catalog.pool');
  });
});

function result(rows: readonly Readonly<Record<string, unknown>>[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
