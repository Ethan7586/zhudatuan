import { describe, expect, it, vi } from 'vitest';
import type { ProductCommand, ProductImportPort } from '../public';
import type { ProductImport } from '../model/ProductImport';
import { CreateProductImport } from './CreateProductImport';

describe('CreateProductImport', () => {
  it('delegates the untouched file to the server-backed import port', async () => {
    const file = new File(['title,sku\n礼盒,SKU-1\n'], 'products.csv', { type: 'text/csv' });
    const created = task('queued');
    const createProductImport = vi.fn<ProductImportPort['createProductImport']>(() => Promise.resolve(created));
    const command = request();
    await expect(new CreateProductImport({ createProductImport }).execute(command, file)).resolves.toBe(created);
    expect(createProductImport).toHaveBeenCalledWith(command, file, undefined);
  });

  it('rejects a missing file before opening an upload session', () => {
    const createProductImport = vi.fn<ProductImportPort['createProductImport']>();
    expect(() => new CreateProductImport({ createProductImport }).execute(request(), null)).toThrow('VALIDATION_FAILED');
    expect(createProductImport).not.toHaveBeenCalled();
  });
});

function request(): ProductCommand {
  return { scope: { kind: 'mall', id: 'mall:one' }, accessVersion: 7, identity: 'command:import', csrf: 'csrf:one' };
}
function task(state: ProductImport['state']): ProductImport {
  return {
    id: 'import:one',
    type: 'import',
    owner: 'catalog',
    kind: 'product',
    title: '商品导入',
    state,
    processed: 0,
    total: 0,
    succeeded: 0,
    failed: 0,
    retryableItems: 0,
    cancellable: true,
    retryable: false,
    version: 1,
    createdAt: '2026-09-07T08:00:00.000Z',
    updatedAt: '2026-09-07T08:00:00.000Z',
    expiresAt: '2026-09-08T08:00:00.000Z',
    fileName: 'products.csv',
    downloadAvailable: false,
    confirmationRequired: false,
    previewHash: null,
    columns: [],
    validationErrors: 0,
    last_error: null,
    errors: [],
  };
}
