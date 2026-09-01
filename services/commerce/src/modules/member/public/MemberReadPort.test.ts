import { PgMemberReadPort } from '../infrastructure/persistence/PgMemberReadPort';

import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { withReadTransaction } from '../../../test/TransactionFixture';

describe('PgMemberReadPort', () => {
  it('reads the canonical access membership and maps its active member', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('from member.profile')) {
        return { rows: [{ id: 'member:one', display_name: '测试员工', status: 'active', version: 4 }], rowCount: 1 } as unknown as QueryResult;
      }
      return { rows: [], rowCount: 0 } as unknown as QueryResult;
    });
    await expect(withReadTransaction(query, (context) => new PgMemberReadPort().summary(context, 'member:one'))).resolves.toEqual({ id: 'member:one', displayName: '测试员工', status: 'active', version: 4 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('from member.profile'), ['member:one']);
  });
});
