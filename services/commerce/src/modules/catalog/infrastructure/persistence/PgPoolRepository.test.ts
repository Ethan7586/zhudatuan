import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { PgPoolRepository } from './PgPoolRepository';

describe('PgPoolRepository', () => {
  it('projects the owning scope so clients can offer only valid pool operations', async () => {
    const row = { id: 'pool:enterprise', scope_id: 'enterprise:one', kind: 'global', name: '集团总池', status: 'active', version: 1, item_count: 3 };
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => result([row]));
    const visible = vi.fn(async () => ['enterprise:one', 'mall:one']);
    const repository = new PgPoolRepository({ database: () => ({ query }) as unknown as SqlExecutor } as unknown as PgTransactionAccess, { visible } as never);
    const context = {} as ReadTransactionContext;

    await expect(repository.read(context, 'enterprise:one', { fetch: 21, sort: null, id: null })).resolves.toEqual([row]);
    expect(visible).toHaveBeenCalledWith(context, 'enterprise:one', false);
    expect(String(query.mock.calls[0]?.[0])).toContain('pool.scope_id');
    expect(query.mock.calls[0]?.[1]).toEqual([['enterprise:one', 'mall:one'], null, null, 21]);
  });
});

function result(rows: readonly Readonly<Record<string, unknown>>[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
