import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgOrganizationRepository } from './PgOrganizationRepository';

const context = {} as ReadTransactionContext;

describe('PgOrganizationRepository', () => {
  it('returns the readable parent name with every visible organization in one query', async () => {
    const rows = [{ id: 'enterprise:one', parent_id: 'platform:one', parent_name: '福利商城平台', name: '鸿泰集团' }];
    const database = { query: vi.fn(async () => ({ rows, rowCount: rows.length, command: '', oid: 0, fields: [] })) } as unknown as SqlExecutor;
    const repository = new PgOrganizationRepository({ database: () => database } as unknown as PgTransactionAccess);

    await expect(repository.layers(context, { scope: 'platform:one', after: null, fetch: 51 })).resolves.toEqual(rows);
    expect(database.query).toHaveBeenCalledWith(expect.stringMatching(/left join organization\.organization parent on parent\.id=child\.parent_id/), ['platform:one', null, 51]);
  });
});
