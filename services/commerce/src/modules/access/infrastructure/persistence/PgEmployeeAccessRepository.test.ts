import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { withReadTransaction } from '../../../../test/TransactionFixture';
import { PgEmployeeAccessRepository } from './PgEmployeeAccessRepository';

describe('employee invitation access persistence', () => {
  it('reads the active department grant using the scope grant lifecycle', async () => {
    let sql = '';
    const query = async (text: string) => {
      sql = text;
      return {
        rows: [{ member: 'member:one', organization: 'mall:one', employee_no: 'E001', department: 'department:one' }],
        rowCount: 1,
      } as unknown as QueryResult;
    };

    const employee = await withReadTransaction(query, (context) => new PgEmployeeAccessRepository().pendingEmployee(context, 'membership:one'));

    expect(employee).toEqual({ member: 'member:one', organization: 'mall:one', employeeNo: 'E001', department: 'department:one' });
    expect(sql).toContain("grantrow.effect='allow'");
    expect(sql).toContain('grantrow.expires_at');
    expect(sql).not.toContain('grantrow.revoked_at');
  });
});
