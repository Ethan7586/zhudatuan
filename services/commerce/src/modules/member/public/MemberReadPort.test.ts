import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import type { ReadScope } from '../../../foundation/persistence/ReadSession';
import { PgMemberReadPort } from './MemberReadPort';

const scope: ReadScope = Object.freeze({
  tenant: 'tenant:one',
  membership: 'membership:one',
  scope: 'mall:one',
  actor: 'principal:one',
  trace: 'trace:one',
  operation: 'storefront.bootstrap.read',
});

describe('PgMemberReadPort', () => {
  it('reads the canonical access membership and maps its active member', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('from member.profile')) {
        return { rows: [{ id: 'member:one', display_name: '测试员工', status: 'active', version: 4 }], rowCount: 1 } as unknown as QueryResult;
      }
      return { rows: [], rowCount: 0 } as unknown as QueryResult;
    });
    const client = { query, release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: async () => client, workload: () => pool } as unknown as DatabasePool;

    await expect(new PgMemberReadPort(pool).summary(scope, 'member:one')).resolves.toEqual({ id: 'member:one', displayName: '测试员工', status: 'active', version: 4 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('from member.profile'), ['member:one']);
  });
});
