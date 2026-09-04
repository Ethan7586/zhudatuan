import { describe, expect, it, vi } from 'vitest';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { prepareProducts } from './ProductImportPreflight';

describe('product import preflight', () => {
  it('normalizes SPU, SKU, category, supplier, images and required attributes in one server batch', async () => {
    const database = executor([{ id: 'category:food', code: 'FOOD', name: '食品', status: 'active', required_attributes: ['color'] }]);
    const partners = { scopes: vi.fn(async () => new Map([['partner:one', 'supplier:one']])) };
    const qualifications = { decisions: vi.fn(async (_context, _scope, subjects) => subjects.map((subject: { listing: string }) => ({ listing: subject.listing, eligible: true, policyVersion: 7 }))) };

    const prepared = await prepareProducts(database, {} as never, 'mall:one', [{ row: 2, value: {
      spu: ' MEAL-1 ', title: ' 早餐 ', sku: ' meal-1-red ', category: 'FOOD', supplier: 'partner:one', type: 'physical',
      images: '["https://assets.example/meal.webp"]', attributes: '{"color":"red"}', specifications: '{"size":"S"}',
    } }], partners as never, qualifications as never);

    expect(prepared.failures).toEqual([]);
    expect(prepared.rows[0]).toMatchObject({ row: 2, payload: { spu: 'MEAL-1', title: '早餐', sku: 'MEAL-1-RED', category: 'category:food', supplier: 'partner:one' } });
    expect(JSON.parse(prepared.rows[0]!.payload.attributes!)).toMatchObject({ color: 'red', coverUrl: 'https://assets.example/meal.webp' });
    expect(partners.scopes).toHaveBeenCalledWith(expect.anything(), ['partner:one']);
    expect(qualifications.decisions).toHaveBeenCalledWith(expect.anything(), 'mall:one', [expect.objectContaining({ category: 'category:food', partner: 'partner:one' })]);
  });

  it('returns row-level failures before confirmation without persisting unsafe source rows', async () => {
    const database = executor([{ id: 'category:food', code: 'FOOD', name: '食品', status: 'active', required_attributes: ['color'] }]);
    const partners = { scopes: vi.fn(async () => new Map()) };
    const qualifications = { decisions: vi.fn(async () => []) };

    const prepared = await prepareProducts(database, {} as never, 'mall:one', [
      { row: 2, value: row({ attributes: '{}' }) },
      { row: 3, value: row({ supplier: 'partner:missing' }) },
      { row: 4, value: row({ images: '["http://127.0.0.1/a.png"]' }) },
    ], partners as never, qualifications as never);

    expect(prepared.failures.map(({ row, reason }) => [row, reason])).toEqual([
      [2, 'CATALOG_ATTRIBUTE_REQUIRED'], [3, 'CATALOG_SUPPLIER_UNKNOWN'], [4, 'CATALOG_IMAGES_INVALID'],
    ]);
    expect(prepared.rows.every(({ payload }) => Object.keys(payload).length === 1 && typeof payload.invalid === 'string')).toBe(true);
  });
});

function row(overrides: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return { spu: 'MEAL-1', title: '早餐', sku: 'SKU-1', category: 'FOOD', supplier: '', type: 'physical', images: '', attributes: '{"color":"red"}', specifications: '{}', ...overrides };
}

function executor(rows: readonly Record<string, unknown>[]): SqlExecutor {
  return { query: vi.fn(async () => ({ rows, rowCount: rows.length, command: '', oid: 0, fields: [] })) } as unknown as SqlExecutor;
}
