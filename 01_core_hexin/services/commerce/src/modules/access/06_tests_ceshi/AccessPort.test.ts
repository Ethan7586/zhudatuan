import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { AccessPort } from '../01_public_gongkai/AccessPort';

describe('AccessPort invited registration', () => {
  it('creates storefront and zero-operation console memberships in one transaction boundary', async () => {
    const query = vi.fn(async (text: string, _values: readonly unknown[] = []) => result(text.includes("'storefront'") && text.includes('returning *') ? [{ id: 'membership:storefront', client: 'storefront', status: 'active' }] : []));
    const port = new AccessPort();

    await expect(
      port.createInvitedRegistration({ query } as unknown as OperationDatabase, {
        storefrontMembership: 'membership:storefront',
        operatorMembership: 'membership:operator',
        member: 'member:one',
        principal: 'principal:one',
        organization: 'tenant:one',
        storefrontRole: 'role:employee',
        operatorRole: 'role:console-pending',
        scopeKind: 'tenant',
        scopes: ['scope:storefront:organization', 'scope:storefront:owner', 'scope:storefront:self', 'scope:operator:organization', 'scope:operator:owner', 'scope:operator:self'],
      })
    ).resolves.toMatchObject({ id: 'membership:storefront', client: 'storefront' });

    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[0]?.[0]).toContain("'storefront'");
    expect(query.mock.calls[1]?.[0]).toContain("'operator'");
    expect(query.mock.calls[2]?.[0]).toContain("'role:self'");
    expect(query.mock.calls[2]?.[1]).toEqual(['membership:storefront', 'role:employee', 'membership:operator', 'role:console-pending']);
    expect(query.mock.calls[3]?.[1]).toContain('self:principal:one');
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
