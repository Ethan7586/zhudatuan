import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { PgTaskRepository } from './PgTaskRepository';

describe('runtime import confirmation', () => {
  it('rejects confirmation when server preflight has row errors', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => result([task(2)]));
    const repository = new PgTaskRepository(access(query));

    await expect(repository.confirmImport({} as never, { id: 'import:one', scope: 'mall:one', actor: 'principal:one', expectedVersion: 2,
      previewHash: 'a'.repeat(64), reason: '确认商品导入' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED', details: { field: 'validationErrors' } });
    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain('error_report_key is not null');
  });

  it('guards the confirming update against errors inserted after the task read', async () => {
    const query = vi.fn(async (sql: string) => sql.includes('update runtime.imports set') ? result([{ id: 'import:one' }]) : result([task(0)]));
    const repository = new PgTaskRepository(access(query));

    await repository.confirmImport({} as never, { id: 'import:one', scope: 'mall:one', actor: 'principal:one', expectedVersion: 2,
      previewHash: 'a'.repeat(64), reason: '确认商品导入' });

    const update = query.mock.calls.find(([sql]) => String(sql).includes('update runtime.imports set'));
    expect(String(update?.[0])).toContain('not exists(select 1 from runtime.import_errors');
  });
});

function task(validationErrors: number) {
  return { id: 'import:one', type: 'import', owner: 'catalog', kind: 'product', state: 'ready', processed: 0, total: 1, succeeded: 0, failed: 0,
    retryableItems: 0, version: 2, createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:01:00.000Z', expiresAt: '2026-09-08T00:00:00.000Z',
    fileName: 'products.csv', downloadAvailable: validationErrors > 0, cancelRequested: false, confirmationRequired: true, previewHash: 'a'.repeat(64),
    columns: ['spu', 'sku'], validationErrors };
}

function result(rows: readonly Record<string, unknown>[]) { return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] }; }
function access(query: ReturnType<typeof vi.fn>): PgTransactionAccess {
  return { database: () => ({ query } as unknown as SqlExecutor) } as unknown as PgTransactionAccess;
}
