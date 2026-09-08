import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ImportTarget } from '../../../runtime/public';
import { importProduct } from './ProductImportRow';

const target: ImportTarget = Object.freeze({ id: 'import:one', scope: 'mall:one', reference: 'object:one', sha256: 'a'.repeat(64), state: 'running', authorization: {}, confirmed: true });
const row = Object.freeze({ spu: 'MEAL-1', title: '早餐', sku: 'MEAL-1-RED', category: 'category:food', supplier: 'partner:one', type: 'physical', attributes: '{"color":"red"}', specifications: '{"size":"S"}' });

describe('product import row', () => {
  it('writes product, SKU, durable receipt, event and audit in the row transaction', async () => {
    let receiptReads = 0;
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('select product_id,sku_id')) return result(receiptReads++ === 0 ? [] : []);
      if (sql.startsWith('select id,parent_id')) return result([{ id: 'category:food', parent_id: null, code: 'FOOD', name: '食品', status: 'active', sort_order: 1, required_attributes: ['color'] }]);
      if (sql.startsWith('select * from catalog.product')) return result([]);
      if (sql.startsWith('insert into catalog.product')) return result([{ id: 'product:import:one', version: 1 }]);
      if (sql.startsWith('select id,product_id')) return result([]);
      if (sql.startsWith('insert into catalog.sku')) return result([{ id: 'sku:import:one', version: 1 }]);
      if (sql.startsWith('insert into catalog.import_receipts')) return result([{ product_id: 'product:import:one', sku_id: 'sku:import:one', product_version: 1, sku_version: 1, source_hash: digest(JSON.stringify(row)) }]);
      return result([]);
    });
    const audit = { record: vi.fn(async () => undefined) };

    await importProduct({ query } as unknown as SqlExecutor, {} as never, target, 2, row, { scopes: vi.fn(async () => new Map([['partner:one', 'supplier:one']])) } as never, audit as never);

    expect(query.mock.calls.some(([sql]) => String(sql).includes('insert into catalog.import_receipts'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('insert into runtime.outbox'))).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ operation: 'catalog.imports.apply', request: 'import:one:2' }));
  });

  it('returns an existing matching receipt without replaying business writes', async () => {
    const query = vi.fn(async () => result([{ product_id: 'product:one', sku_id: 'sku:one', product_version: 1, sku_version: 1, source_hash: digest(JSON.stringify(row)) }]));
    const partners = { scopes: vi.fn() };
    const audit = { record: vi.fn() };

    await importProduct({ query } as unknown as SqlExecutor, {} as never, target, 2, row, partners as never, audit as never);

    expect(query).toHaveBeenCalledOnce();
    expect(partners.scopes).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

function result(rows: readonly Record<string, unknown>[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
