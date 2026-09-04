import { describe, expect, it, vi } from 'vitest';
import { result, transactionManager } from '../../../../test/TransactionFixture';
import type { ImportRuntimeCoordinator, ImportTarget } from '../../public/ImportProcess';
import { RuntimeBatchImportProcess } from './StageImport';

describe('runtime itemized import receipts', () => {
  it('persists domain preflight failures with the normalized chunk before marking the import ready', async () => {
    const runtime = coordinator();
    runtime.begin.mockResolvedValue({ sequence: 0, staged: 0 });
    runtime.stage.mockResolvedValue(undefined);
    runtime.ready.mockResolvedValue(undefined);
    const process = new RuntimeBatchImportProcess({ owner: 'catalog', failure: 'CATALOG_ROW_INVALID',
      transactions: transactionManager(async () => result([])), runtime: runtime as unknown as ImportRuntimeCoordinator, authorization: { assert: vi.fn(async () => undefined) },
      prepare: async (_target, rows) => ({
        rows: rows.map(({ row, value }) => ({ row, payload: value.sku === 'BAD' ? { invalid: 'CATALOG_SKU_INVALID' } : value })),
        failures: [{ row: 3, reason: 'CATALOG_SKU_INVALID', field: 'sku', detail: 'SKU 编码格式不正确' }],
      }), write: vi.fn(), continue: vi.fn(async () => undefined) });

    await process.stage({ ...target(), state: 'uploaded', confirmed: false }, [{ sku: 'GOOD' }, { sku: 'BAD' }], {
      scope: 'scope:one', signal: new AbortController().signal, deadline: Date.now() + 10_000,
    });

    expect(runtime.stage).toHaveBeenCalledWith(expect.anything(), 'import:one', 'catalog', [{ sequence: 0, rows: [
      { row: 2, payload: { sku: 'GOOD' } }, { row: 3, payload: { invalid: 'CATALOG_SKU_INVALID' } },
    ] }], [{ row: 3, reason: 'CATALOG_SKU_INVALID', field: 'sku', detail: 'SKU 编码格式不正确' }]);
    expect(runtime.ready).toHaveBeenCalledAfter(runtime.stage);
  });

  it('checks the active fence before every row and settles one receipt per item', async () => {
    const runtime = coordinator();
    const write = vi.fn(async (_context, _target, row: number) => {
      if (row === 3) throw new Error('CATALOG_ROW_INVALID');
    });
    const process = new RuntimeBatchImportProcess({ owner: 'catalog', failure: 'CATALOG_ROW_INVALID',
      transactions: transactionManager(async () => result([])), runtime: runtime as unknown as ImportRuntimeCoordinator, authorization: { assert: vi.fn(async () => undefined) },
      write, continue: vi.fn(async () => undefined), concurrency: 2 });
    expect(await process.process(target(), new AbortController().signal, Date.now() + 10_000)).toBe(true);
    expect(runtime.assertLease).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledTimes(2);
    expect(runtime.finish).toHaveBeenCalledWith(expect.anything(), 'import:one', 'catalog', 0, 11, 1, [{
      row: 3, reason: 'CATALOG_ROW_INVALID', field: null, detail: 'CATALOG_ROW_INVALID',
    }]);
  });
});

function coordinator() {
  let claimed = false;
  return {
    find: vi.fn(), begin: vi.fn(), stage: vi.fn(), ready: vi.fn(), failures: vi.fn(), progress: vi.fn(), report: vi.fn(), complete: vi.fn(), reject: vi.fn(), fault: vi.fn(), abandon: vi.fn(),
    claim: vi.fn(async () => claimed ? null : (claimed = true, { sequence: 0, token: 11, rows: [
      { row: 2, payload: { sku: 'good' } }, { row: 3, payload: { sku: 'bad' } },
    ] })),
    assertLease: vi.fn(async () => undefined),
    finish: vi.fn(async () => true),
  };
}

function target(): ImportTarget {
  return Object.freeze({ id: 'import:one', scope: 'scope:one', reference: 'object:one', sha256: 'a'.repeat(64), state: 'running',
    authorization: Object.freeze({ actor: 'actor:one' }), confirmed: true });
}
