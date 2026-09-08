import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { PgRuntimeImporting } from './PgRuntimeImporting';

const context = {} as WriteTransactionContext;

describe('PgRuntimeImporting', () => {
  it('maps persistence rows without leaking tenant or object-store columns', async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          id: 'import:one',
          state: 'uploaded',
          total_count: 0,
          cursor_value: 0,
          success_count: 0,
          failure_count: 0,
          created_at: '2026-09-05T00:00:00.000Z',
          updated_at: '2026-09-05T00:00:00.000Z',
          validation_summary: {},
          last_error: null,
          errors: [],
          report_object_ref: null,
          report_sha256: null,
          report_size: null,
          scope_id: 'mall:one',
          owner: 'catalog',
          object_key: 'object:one',
          file_hash: 'a'.repeat(64),
        },
      ],
      rowCount: 1,
    }));
    const importing = new PgRuntimeImporting(access(query));
    const created = await importing.create(context, {
      id: 'import:one',
      scope: 'mall:one',
      owner: 'catalog',
      kind: 'product',
      reference: 'object:one',
      sha256: 'a'.repeat(64),
      name: 'catalog.csv',
      mediaType: 'text/csv',
      size: 12,
      actor: 'principal:one',
      authorization: {},
    });
    expect(created).toEqual({ id: 'import:one', state: 'uploaded', total_count: 0, cursor_value: 0, success_count: 0, failure_count: 0, created_at: '2026-09-05T00:00:00.000Z', updated_at: '2026-09-05T00:00:00.000Z' });
    expect(created).not.toHaveProperty('scope_id');
    expect(created).not.toHaveProperty('object_key');
  });

  it('keeps the API view and confidential report reference in separate public values', async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          id: 'import:one',
          state: 'completed',
          total_count: 2,
          cursor_value: 2,
          success_count: 1,
          failure_count: 1,
          created_at: '2026-09-05T00:00:00.000Z',
          updated_at: '2026-09-05T00:01:00.000Z',
          validation_summary: { columns: ['sku'] },
          last_error: null,
          errors: [{ row_number: 3, reason_code: 'SKU_INVALID', field: 'sku', detail: '商品编码无效' }],
          report_object_ref: 'object:report',
          report_sha256: 'b'.repeat(64),
          report_size: '128',
          scope_id: 'mall:one',
          owner: 'catalog',
          object_key: 'object:one',
          file_hash: 'a'.repeat(64),
        },
      ],
      rowCount: 1,
    }));
    const importing = new PgRuntimeImporting(access(query));

    const found = await importing.read({} as never, 'import:one', 'mall:one', 'catalog');

    expect(found).toEqual({
      body: {
        id: 'import:one',
        state: 'completed',
        total_count: 2,
        cursor_value: 2,
        success_count: 1,
        failure_count: 1,
        created_at: '2026-09-05T00:00:00.000Z',
        updated_at: '2026-09-05T00:01:00.000Z',
        validation_summary: { columns: ['sku'] },
        last_error: null,
        errors: [{ row_number: 3, reason_code: 'SKU_INVALID', field: 'sku', detail: '商品编码无效' }],
      },
      report: { reference: 'object:report', sha256: 'b'.repeat(64), size: 128 },
    });
    expect(found?.body).not.toHaveProperty('report_object_ref');
  });

  it('fails closed when report metadata is partially persisted', async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          id: 'import:one',
          state: 'completed',
          total_count: 0,
          cursor_value: 0,
          success_count: 0,
          failure_count: 0,
          created_at: '2026-09-05T00:00:00.000Z',
          updated_at: '2026-09-05T00:00:00.000Z',
          validation_summary: {},
          last_error: null,
          errors: [],
          report_object_ref: 'object:report',
          report_sha256: null,
          report_size: null,
          scope_id: 'mall:one',
          owner: 'catalog',
          object_key: 'object:one',
          file_hash: 'a'.repeat(64),
        },
      ],
      rowCount: 1,
    }));

    await expect(new PgRuntimeImporting(access(query)).read({} as never, 'import:one', 'mall:one', 'catalog')).rejects.toThrow('RUNTIME_IMPORT_REPORT_INVALID');
  });

  it('exposes validated progress through the Runtime port instead of cross-schema SQL', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => ({ rows: [{ total: '4', processed: '3', succeeded: '2', failed: '1' }], rowCount: 1 }));
    const importing = new PgRuntimeImporting(access(query));

    await expect(importing.progress({ scope: 'mall:one' } as never, 'import:one', 'finance')).resolves.toEqual({ total: 4, processed: 3, succeeded: 2, failed: 1 });
    expect(query.mock.calls[0]?.[1]).toEqual(['import:one', 'mall:one', 'finance']);
  });

  it('rejects impossible persisted progress', async () => {
    const query = vi.fn(async () => ({ rows: [{ total: 2, processed: 3, succeeded: 2, failed: 1 }], rowCount: 1 }));

    await expect(new PgRuntimeImporting(access(query)).progress({ scope: 'mall:one' } as never, 'import:one', 'finance')).rejects.toThrow('RUNTIME_IMPORT_PROGRESS_INVALID');
  });

  it('claims failed chunks for retry and refuses premature completion while another lease is running', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ exists: 1 }], rowCount: 1 });
    const importing = new PgRuntimeImporting(access(query));
    await expect(importing.claim(context, 'import:one', 'catalog', 60)).rejects.toThrow('RUNTIME_IMPORT_CHUNK_BUSY');
    expect(String(query.mock.calls[0]?.[0])).toContain("state in('pending','failed')");
    expect(String(query.mock.calls[0]?.[0])).toContain('not exists(select 1 from runtime.import_errors');
  });

  it('stores normalized chunks and preflight row errors under the same transaction context', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ sequence: 0, rowStart: 2, rowEnd: 2 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const importing = new PgRuntimeImporting(access(query));

    await importing.stage(
      { scope: 'mall:one' } as never,
      'import:one',
      'catalog',
      [{ sequence: 0, rows: [{ row: 2, payload: { invalid: 'CATALOG_SKU_INVALID' } }] }],
      [{ row: 2, reason: 'CATALOG_SKU_INVALID', field: 'sku', detail: 'SKU 编码格式不正确' }]
    );

    expect(query).toHaveBeenCalledTimes(3);
    expect(String(query.mock.calls[2]?.[0])).toContain('insert into runtime.import_errors');
    expect(query.mock.calls[2]?.[1]).toEqual(['import:one', JSON.stringify([{ row: 2, reason: 'CATALOG_SKU_INVALID', field: 'sku', detail: 'SKU 编码格式不正确' }]), 'mall:one', 'catalog']);
  });

  it('attaches a preflight error report without completing the import', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => ({ rows: [{ id: 'import:one' }], rowCount: 1 }));
    const importing = new PgRuntimeImporting(access(query));

    await importing.report({ scope: 'mall:one' } as never, 'import:one', 'catalog', { reference: 'object:report', sha256: 'b'.repeat(64), size: 128 });

    expect(String(query.mock.calls[0]?.[0])).toContain("state='ready'");
    expect(String(query.mock.calls[0]?.[0])).not.toContain("state='succeeded'");
  });

  it('records a transient processing fault without releasing another worker lease', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => ({ rows: [], rowCount: 1 }));
    const importing = new PgRuntimeImporting(access(query));
    await importing.fault(context, 'import:one', 'catalog', 'temporary');
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0]?.[0])).not.toContain("set state='failed'");
  });
});

function access(query: ReturnType<typeof vi.fn>): PgTransactionAccess {
  return { database: () => ({ query }) as unknown as SqlExecutor } as unknown as PgTransactionAccess;
}
