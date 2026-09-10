import type { QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it } from 'vitest';

import { executeWithMigrationOwnership, type MigrationOwnershipClient } from './MigrationOwnership';

describe('migration ownership transaction', () => {
  it('leases module ownership only inside the guarded transaction', async () => {
    const database = fakeDatabase();
    const result = await executeWithMigrationOwnership(database.client, async (client) => {
      await client.query('select acceptance_seed');
      return 'seeded';
    });

    expect(result).toBe('seeded');
    expect(database.queries[0]).toBe('begin');
    expect(database.queries).toContain("select pg_advisory_xact_lock(hashtext('shop-domain-hard-cut'))");
    expect(database.queries.find((query) => query.includes('with inherit true, set true'))).toBeDefined();
    expect(database.queries).toContain('set local role shopmigration');
    expect(database.queries).toContain('select acceptance_seed');
    expect(database.queries).toContain('reset role');
    expect(database.queries.find((query) => query.includes('with inherit false, set true'))).toBeDefined();
    expect(database.queries.at(-1)).toBe('commit');
  });

  it('rolls back data and the ownership lease together on failure', async () => {
    const database = fakeDatabase();
    await expect(
      executeWithMigrationOwnership(database.client, async () => {
        throw new Error('SEED_FAILED');
      })
    ).rejects.toThrow('SEED_FAILED');

    expect(database.queries).toContain('rollback');
    expect(database.queries).not.toContain('commit');
  });
});

function fakeDatabase(): { client: MigrationOwnershipClient; queries: string[] } {
  const queries: string[] = [];
  const client: MigrationOwnershipClient = {
    async connect() {},
    async end() {},
    async query<Row extends QueryResultRow = QueryResultRow>(queryText: string): Promise<QueryResult<Row>> {
      queries.push(queryText);
      const rows = queryText.includes("pg_has_role(session_user,'shopmigration','set')") ? [{ allowed: true }] : queryText.includes("current_user='shopmigration'") || queryText.includes('current_user=session_user') ? [{ valid: true }] : [];
      return { rows } as unknown as QueryResult<Row>;
    },
  };
  return { client, queries };
}
