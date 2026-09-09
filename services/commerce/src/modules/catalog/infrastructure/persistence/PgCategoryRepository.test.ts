import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CategoryRecord } from '../../application/port/CategoryRepository';
import { PgCategoryRepository } from './PgCategoryRepository';

describe('PgCategoryRepository', () => {
  it('reads names, hierarchy and product usage as a bounded page', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => result([{ ...category, sort_order: '10', product_count: '3' }]));
    const repository = repositoryWith(query);

    const categories = await repository.read({} as ReadTransactionContext, '餐', { fetch: 21, sort: null, id: null });

    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain("product.status<>'archived'");
    expect(query.mock.calls[0]?.[1]).toEqual(['餐', null, null, 21]);
    expect(categories).toEqual([category]);
  });

  it('creates one deterministic category and returns its public projection', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql.includes('lower(btrim(category.name))')) return result([]);
      if (sql.startsWith('insert into catalog.category')) return result([category]);
      return result([]);
    });
    const repository = repositoryWith(query);

    const created = await repository.create({} as WriteTransactionContext, { name: ' 餐食 ', parent: null, sort: 10 });

    expect(created).toEqual(category);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[1]).toEqual([expect.stringMatching(/^category:custom:[a-f0-9]{24}$/), null, expect.stringMatching(/^CUSTOM-[A-F0-9]{24}$/), '餐食', 'active', 10]);
  });

  it('returns an existing normalized name under the same parent instead of creating a duplicate', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => result([category]));
    const repository = repositoryWith(query);

    await expect(repository.create({} as WriteTransactionContext, { name: '餐食', parent: null, sort: 0 })).resolves.toEqual(category);
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]?.[1]).toEqual(['餐食', null]);
  });

  it('includes the parent in the deterministic identity so sibling taxonomies may reuse a readable name', async () => {
    const inserted: CategoryRecord = { ...category, id: 'category:child', parent_id: 'category:benefit', parent_name: '企业福利' };
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql.startsWith('select status from catalog.category')) return result([{ status: 'active' }]);
      if (sql.includes('lower(btrim(category.name))')) return result([]);
      if (sql.startsWith('insert into catalog.category')) return result([inserted]);
      return result([]);
    });
    const repository = repositoryWith(query);

    await expect(repository.create({} as WriteTransactionContext, { name: '餐食', parent: 'category:benefit', sort: 10 })).resolves.toEqual(inserted);
    expect(query.mock.calls[1]?.[1]).toEqual(['餐食', 'category:benefit']);
    expect(query.mock.calls[2]?.[1]).toEqual([
      expect.stringMatching(/^category:custom:[a-f0-9]{24}$/),
      'category:benefit',
      expect.stringMatching(/^CUSTOM-[A-F0-9]{24}$/),
      '餐食',
      'active',
      10,
    ]);
  });

  it('requires an active parent before creating a child category', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => result([{ status: 'disabled' }]));
    const repository = repositoryWith(query);

    await expect(repository.create({} as WriteTransactionContext, { name: '早餐', parent: 'category:meal', sort: 0 })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(query).toHaveBeenCalledOnce();
  });
});

const category = Object.freeze({
  id: 'category:meal',
  parent_id: null,
  parent_name: null,
  code: 'MEAL',
  name: '餐食',
  status: 'active' as const,
  sort_order: 10,
  product_count: 3,
});

function repositoryWith(query: ReturnType<typeof vi.fn>) {
  const database = { query } as unknown as SqlExecutor;
  return new PgCategoryRepository({ database: () => database } as unknown as PgTransactionAccess);
}

function result<T>(rows: readonly T[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
