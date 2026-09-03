import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgRiskAdministrationRepository } from './PgRiskAdministrationRepository';

const context = {} as ReadTransactionContext;

describe('PgRiskAdministrationRepository', () => {
  it('projects the actor account through the unique principal profile in one query', async () => {
    const rows = [{ id: 'riskcase:one', actor_id: 'principal:one', actor_display_name: '李小明', actor_mobile_masked: '139****0002' }];
    const database = { query: vi.fn(async () => ({ rows, rowCount: rows.length, command: '', oid: 0, fields: [] })) } as unknown as SqlExecutor;
    const repository = new PgRiskAdministrationRepository({ database: () => database } as unknown as PgTransactionAccess);

    await expect(repository.center(context, 'mall:one', null, 201)).resolves.toEqual(rows);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('left join member.profile actorprofile on actorprofile.principal_id=center.actor_id'), ['mall:one', null, 201]);
  });
});
