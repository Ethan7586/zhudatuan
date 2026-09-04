import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgRiskAdministrationRepository } from './PgRiskAdministrationRepository';

const context = {} as ReadTransactionContext;

describe('PgRiskAdministrationRepository', () => {
  it('returns actor principals without crossing the risk schema boundary', async () => {
    const rows = [{ id: 'riskcase:one', actor_id: 'principal:one', actor_display_name: null, actor_mobile_masked: null }];
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => ({ rows, rowCount: rows.length, command: '', oid: 0, fields: [] }));
    const database = { query } as unknown as SqlExecutor;
    const repository = new PgRiskAdministrationRepository({ database: () => database } as unknown as PgTransactionAccess);

    await expect(repository.center(context, 'mall:one', null, 201)).resolves.toEqual(rows);
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).not.toContain('member.profile');
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('from risk.case riskcase'), ['mall:one', null, 201]);
  });
});
