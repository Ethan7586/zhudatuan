import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { AccessPort } from './AccessPort';

describe('registration access membership', () => {
  it('binds the invitation role and canonical self role before returning the membership', async () => {
    const query = vi.fn<(text: string, values?: readonly unknown[]) => Promise<QueryResult>>(async (text: string) =>
      result(text.includes('returning *') ? [{ id: 'membership:one' }] : []));
    const port = new AccessPort();
    await port.createRegistration({ query } as unknown as OperationDatabase, {
      membership: 'membership:one', member: 'member:one', principal: 'principal:one', organization: 'mall-zhudatuan',
      role: 'role-zhudatuan-storefront-member', scopeKind: 'mall', scopes: ['scope:mall', 'scope:owner', 'scope:self'],
    });

    const role = query.mock.calls.find(([sql]) => sql.includes('insert into access.membershiprole'));
    expect(role?.[0]).toContain("($1,'role:self',clock_timestamp())");
    expect(role?.[1]).toEqual(['membership:one', 'role-zhudatuan-storefront-member']);
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
