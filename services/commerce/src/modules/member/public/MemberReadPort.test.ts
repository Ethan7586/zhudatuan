import { PgMemberReadPort } from '../infrastructure/persistence/PgMemberReadPort';

import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { withReadTransaction } from '../../../test/TransactionFixture';

describe('PgMemberReadPort', () => {
  it('reads the canonical access membership and maps its active member', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('from member.profile_summary')) {
        return { rows: [{ id: 'member:one', display_name: '测试员工', employee_no: 'E1001', mobile_masked: '138****0000', status: 'active', version: 4 }], rowCount: 1 } as unknown as QueryResult;
      }
      return { rows: [], rowCount: 0 } as unknown as QueryResult;
    });
    await expect(withReadTransaction(query, (context) => new PgMemberReadPort().summary(context, 'member:one', 'mall:one'))).resolves.toEqual({
      id: 'member:one',
      displayName: '测试员工',
      employeeNo: 'E1001',
      mobileMasked: '138****0000',
      status: 'active',
      version: 4,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('from member.profile_summary($1,$2)'), ['member:one', 'mall:one']);
  });

  it('resolves risk actor presentation in one bounded batch', async () => {
    const query = vi.fn(async () => ({ rows: [{ principal: 'principal:one', display_name: '测试员工', mobile_masked: '138****0000' }], rowCount: 1 }) as unknown as QueryResult);
    await expect(withReadTransaction(query, (context) => new PgMemberReadPort().principals(context, ['principal:one', 'principal:one'], 'mall:one'))).resolves.toEqual([
      { principal: 'principal:one', displayName: '测试员工', mobileMasked: '138****0000' },
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('member.profile_summary(profile.id,$2)'), [['principal:one'], 'mall:one']);
  });

  it('reads invitation labels only through the scope-redacted projection', async () => {
    const query = vi.fn(async () => ({ rows: [{ member: 'member:one', display_name: '测试员工', mobile_masked: '138****0000' }], rowCount: 1 }) as unknown as QueryResult);
    await expect(withReadTransaction(query, (context) => new PgMemberReadPort().profiles(context, ['member:one', 'member:one'], 'mall:one'))).resolves.toEqual([
      { member: 'member:one', displayName: '测试员工', mobileMasked: '138****0000' },
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('member.profile_summary(requested.member,$2)'), [['member:one'], 'mall:one']);
  });
});
