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
    const scopes = query.mock.calls.find(([sql]) => sql.includes('insert into access.scopegrant'));
    expect(scopes?.[1]?.at(-1)).toBe('self:principal:one');
  });

  it('creates isolated storefront and zero-business-permission operator memberships atomically', async () => {
    const query = vi.fn<(text: string, values?: readonly unknown[]) => Promise<QueryResult>>(async (text: string) =>
      result(text.includes('returning *') ? [{ id: text.includes("'operator'") ? 'membership:operator' : 'membership:storefront' }] : []));
    const port = new AccessPort();

    const created = await port.createOperatorRegistration({ query } as unknown as OperationDatabase, {
      operatorMembership: 'membership:operator', storefrontMembership: 'membership:storefront', member: 'member:one',
      principal: 'principal:one', operatorOrganization: 'tenant-zhudatuan', storefrontOrganization: 'mall-zhudatuan',
      operatorRole: 'role-zhudatuan-pending-operator', storefrontRole: 'role-zhudatuan-storefront-member',
      storefrontScopes: ['scope:storefront', 'scope:owner', 'scope:storefront-self'],
      operatorScopes: ['scope:operator', 'scope:operator-self'],
    });

    expect(created).toMatchObject({ id: 'membership:operator' });
    const membershipWrites = query.mock.calls.filter(([sql]) => sql.includes('insert into access.membership('));
    expect(membershipWrites).toHaveLength(2);
    expect(membershipWrites[0]?.[0]).toContain("'storefront'");
    expect(membershipWrites[1]?.[0]).toContain("'operator'");
    const operatorRole = query.mock.calls.find(([sql], index) => index > 2 && sql.includes('insert into access.membershiprole'));
    expect(operatorRole?.[1]).toEqual(['membership:operator', 'role-zhudatuan-pending-operator']);
  });

  it('derives caller and candidate mobile readiness and executable enrollment capabilities from authority', async () => {
    const query = vi.fn<(text: string, values?: readonly unknown[]) => Promise<QueryResult>>(async (text: string) =>
      result(text.includes('from access.platformowner owner') ? [{ state: 'active', version: 1, mobileReady: false,
        owner: null, candidates: [], formerOwnerRoles: [], pending: null }] : []));
    const port = new AccessPort();

    await port.ownership({ query } as unknown as OperationDatabase, 'membership:candidate');

    const ownership = query.mock.calls.find(([sql]) => sql.includes('from access.platformowner owner'))?.[0] ?? '';
    expect(ownership).toContain('caller_profile.mobile_ciphertext is not null');
    expect(ownership).toContain("'mobileReady',profile.mobile_ciphertext is not null");
    expect(ownership).toContain("('identity.mobile.challenge')");
    expect(ownership).toContain('capability.membership_operations(candidate.id)');
    expect(query.mock.calls[0]?.[0]).toContain('zhudatuan:platform-owner-transfer:v1');
    expect(query.mock.calls[1]?.[0]).toContain('access.expire_owner_transfers()');
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
